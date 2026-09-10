/**
 * Блокировка авто-механик Ozon + минимальная цена = согласованная финалка.
 * Для КАЖДОГО товара с ценой шлёт /v1/product/import/prices:
 *   price/old_price/vat — БЕЗ изменений (текущие из v5),
 *   min_price           = текущая price (порог: ниже согласованной не продаваться),
 *   min_price_for_auto_actions_enabled = true,
 *   auto_action_enabled = DISABLED,
 *   auto_add_to_ozon_actions_list_enabled = DISABLED,
 *   price_strategy_enabled = DISABLED.
 *
 *   node sync/scripts/ozon-lock-actions.mjs --smoke   # первые 3 товара
 *   node sync/scripts/ozon-lock-actions.mjs --apply   # все
 *   node sync/scripts/ozon-lock-actions.mjs --verify  # перечитать флаги из v5
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

async function call(path, body) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body ?? {}) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function listPrices() {
  const out = [];
  let cursor = '';
  for (;;) {
    const body = { filter: { visibility: 'ALL' }, limit: 100 };
    if (cursor) body.cursor = cursor;
    const j = await call('/v5/product/info/prices', body);
    for (const it of j.items || []) {
      const p = it.price || {};
      out.push({
        offer_id: String(it.offer_id || ''),
        product_id: it.product_id,
        price: Number(p.price) || 0,
        old_price: Number(p.old_price) || 0,
        min_price: Number(p.min_price) || 0,
        auto_action: p.auto_action_enabled ?? null,
        auto_add: p.auto_add_to_ozon_actions_list_enabled ?? null,
        vat: String(p.vat ?? '0'),
      });
    }
    cursor = j.cursor || '';
    if (!cursor || (j.items || []).length < 100) break;
  }
  return out;
}

const mode = process.argv[2] || '--smoke';
const items = (await listPrices()).filter((p) => p.price > 0 && p.offer_id);
console.log(`товаров с ценой: ${items.length}`);

if (mode === '--verify') {
  const badAdd = items.filter((p) => p.auto_add !== false);
  const badAct = items.filter((p) => p.auto_action !== false);
  const badMin = items.filter((p) => p.min_price !== p.price);
  console.log(`auto_add != false: ${badAdd.length}${badAdd.length ? ' → ' + badAdd.map((p) => p.offer_id).join(',') : ''}`);
  console.log(`auto_action != false: ${badAct.length}${badAct.length ? ' → ' + badAct.map((p) => p.offer_id).join(',') : ''}`);
  console.log(`min_price != price: ${badMin.length}`);
  for (const p of badMin.slice(0, 10)) console.log(`  ${p.offer_id}: min=${p.min_price} price=${p.price}`);
  process.exit(0);
}

const targets = mode === '--smoke' ? items.slice(0, 3) : items;
console.log(`к отправке: ${targets.length} (${mode})`);

let ok = 0;
const errors = [];
for (let i = 0; i < targets.length; i += 50) {
  const batch = targets.slice(i, i + 50);
  const prices = batch.map((p) => ({
    offer_id: p.offer_id,
    price: String(p.price),
    old_price: String(p.old_price || 0),
    min_price: String(p.price),
    min_price_for_auto_actions_enabled: true,
    auto_action_enabled: 'DISABLED',
    auto_add_to_ozon_actions_list_enabled: 'DISABLED',
    price_strategy_enabled: 'DISABLED',
    vat: p.vat,
    currency_code: 'RUB',
  }));
  const j = await call('/v1/product/import/prices', { prices });
  for (const r of j.result || []) {
    if (r.updated) ok++;
    else errors.push({ offer_id: r.offer_id, errors: r.errors });
  }
  console.log(`  партия ${i / 50 + 1}: отправлено ${batch.length}`);
}
console.log(`\nupdated=true: ${ok} из ${targets.length}`);
if (errors.length) {
  console.log('ошибки:');
  for (const e of errors) console.log(' ', e.offer_id, JSON.stringify(e.errors).slice(0, 300));
}
