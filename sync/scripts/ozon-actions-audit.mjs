/**
 * Аудит акций Ozon и защитных флагов цен (read-only).
 * Собирает:
 *   1) /v5/product/info/prices — per-SKU: цена, min_price, флаги auto_action_enabled /
 *      auto_add_to_ozon_actions_list_enabled / price_strategy_enabled (сырые поля price.*);
 *   2) GET /v1/actions — все акции Ozon с признаком участия;
 *   3) /v1/actions/products — наши товары в каждой акции с participating_products_count>0;
 *   4) /v1/actions/auto-add/products/list — товары в очереди автодобавления;
 *   5) /v1/seller-actions/list — собственные акции продавца.
 *
 * Пишет JSON-снапшот в reports/ozon-actions-audit-<date>.json + печатает сводку.
 *
 *   node sync/scripts/ozon-actions-audit.mjs
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
dotenvConfig({ path: resolve(ROOT, '.env') });

const API = 'https://api-seller.ozon.ru';
const HEADERS = {
  'Client-Id': process.env.OZON_CLIENT_ID,
  'Api-Key': process.env.OZON_API_TOKEN,
  'Content-Type': 'application/json',
};

async function call(path, body, method = 'POST') {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: HEADERS,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// ---------- 1. Цены + флаги ----------
const products = []; // {offer_id, product_id, price, old_price, min_price, marketing_price, flags...}
{
  let cursor = '';
  for (;;) {
    const body = { filter: { visibility: 'ALL' }, limit: 100 };
    if (cursor) body.cursor = cursor;
    const j = await call('/v5/product/info/prices', body);
    for (const it of j.items || []) {
      const p = it.price || {};
      products.push({
        offer_id: String(it.offer_id || ''),
        product_id: it.product_id,
        price: Number(p.price) || 0,
        old_price: Number(p.old_price) || 0,
        min_price: Number(p.min_price) || 0,
        marketing_price: Number(p.marketing_price) || 0,
        marketing_seller_price: Number(p.marketing_seller_price) || 0,
        auto_action_enabled: p.auto_action_enabled ?? null,
        auto_add_to_ozon_actions_list_enabled: p.auto_add_to_ozon_actions_list_enabled ?? null,
        min_price_for_auto_actions_enabled: p.min_price_for_auto_actions_enabled ?? null,
        price_strategy_enabled: it.price_strategy_enabled ?? p.price_strategy_enabled ?? null,
        vat: String(p.vat ?? '0'),
      });
    }
    cursor = j.cursor || '';
    if (!cursor || (j.items || []).length < 100) break;
  }
}
console.log(`товаров в кабинете: ${products.length}`);

// ---------- 2. Акции ----------
const actionsResp = await call('/v1/actions', null, 'GET');
const actions = actionsResp.result || actionsResp.actions || [];
console.log(`акций доступно: ${actions.length}`);

// ---------- 3. Товары в акциях ----------
const byId = new Map(products.map((p) => [Number(p.product_id), p]));
const participation = []; // {action, products: [...]}
for (const a of actions) {
  const cnt = Number(a.participating_products_count) || 0;
  if (cnt === 0) continue;
  const rows = [];
  let last_id = 0;
  for (;;) {
    const j = await call('/v1/actions/products', { action_id: a.id, limit: 100, last_id });
    const items = j.result?.products || [];
    for (const it of items) {
      const known = byId.get(Number(it.id));
      rows.push({
        product_id: it.id,
        offer_id: known?.offer_id || '?',
        cur_price: known?.price ?? null,
        action_price: Number(it.action_price) || 0,
        max_action_price: Number(it.max_action_price) || 0,
        add_mode: it.add_mode || '',
        stock: it.stock ?? null,
      });
    }
    last_id = j.result?.last_id || 0;
    if (items.length < 100 || !last_id) break;
  }
  participation.push({
    action_id: a.id,
    title: a.title,
    action_type: a.action_type,
    date_start: a.date_start,
    date_end: a.date_end,
    is_participating: a.is_participating,
    participating_products_count: cnt,
    products: rows,
  });
  console.log(`  акция ${a.id} «${a.title}» [${a.action_type}] ${a.date_start}→${a.date_end}: наших товаров ${rows.length}`);
}

// ---------- 4. Автодобавление ----------
let autoAdd = [];
try {
  let last_id = '';
  for (;;) {
    const j = await call('/v1/actions/auto-add/products/list', { limit: 100, last_id });
    const items = j.result?.products || j.products || [];
    autoAdd.push(...items);
    last_id = j.result?.last_id || j.last_id || '';
    if (items.length < 100 || !last_id) break;
  }
} catch (e) {
  autoAdd = { error: String(e.message).slice(0, 200) };
}
console.log(`в автодобавлении: ${Array.isArray(autoAdd) ? autoAdd.length : JSON.stringify(autoAdd)}`);

// ---------- 5. Собственные акции продавца ----------
let sellerActions = [];
try {
  const j = await call('/v1/seller-actions/list', { limit: 100, offset: 0 });
  sellerActions = j.result || j.actions || j;
} catch (e) {
  sellerActions = { error: String(e.message).slice(0, 200) };
}

// ---------- Сводка по флагам ----------
const flagStat = {};
for (const p of products) {
  const k = `auto_action=${p.auto_action_enabled} | auto_add=${p.auto_add_to_ozon_actions_list_enabled} | min_price_guard=${p.min_price_for_auto_actions_enabled} | strategy=${p.price_strategy_enabled}`;
  flagStat[k] = (flagStat[k] || 0) + 1;
}
console.log('\nраспределение флагов:');
for (const [k, v] of Object.entries(flagStat)) console.log(`  ${v} шт: ${k}`);

const noMin = products.filter((p) => p.price > 0 && p.min_price === 0);
console.log(`\nбез min_price: ${noMin.length} из ${products.filter((p) => p.price > 0).length} с ценой`);
const marketingBelow = products.filter((p) => p.marketing_seller_price > 0 && p.marketing_seller_price < p.price);
console.log(`marketing_seller_price < price (активная акция за наш счёт): ${marketingBelow.length}`);
for (const p of marketingBelow.slice(0, 20)) {
  console.log(`  ${p.offer_id}: price=${p.price} → с акциями=${p.marketing_seller_price} (min=${p.min_price})`);
}

const out = {
  generated_at: new Date().toISOString(),
  products,
  actions_all: actions.map((a) => ({
    id: a.id, title: a.title, action_type: a.action_type,
    date_start: a.date_start, date_end: a.date_end,
    is_participating: a.is_participating,
    participating_products_count: a.participating_products_count,
    potential_products_count: a.potential_products_count,
    with_targeting: a.with_targeting,
  })),
  participation,
  auto_add: autoAdd,
  seller_actions: sellerActions,
};
const day = new Date().toISOString().slice(0, 10);
const outPath = resolve(ROOT, `reports/ozon-actions-audit-${day}.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\nснапшот: ${outPath}`);
