/**
 * Ozon: включить и продлить флаг «учитывать минимальную цену в акциях»
 * (min_price_for_auto_actions_enabled) — БЕЗ изменения цен.
 * Решение владельца 25.09.2026 (business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md).
 *
 * Флаг сам гаснет через 30 дней после установки. На 25.09 включён у 18 из 81 товара
 * (истекает 04.10), у 63 уже погас.
 *
 * Шлёт /v1/product/import/prices с ТЕКУЩИМИ price/old_price/min_price из v5,
 * min_price_for_auto_actions_enabled=true, остальные механики — UNKNOWN («не менять»),
 * затем /v1/product/action/timer/update, затем проверяет, что цены не сдвинулись.
 *
 *   node sync/scripts/ozon-min-price-flag.mjs --verify   # только прочитать статус флага
 *   node sync/scripts/ozon-min-price-flag.mjs --smoke    # первые 3 товара
 *   node sync/scripts/ozon-min-price-flag.mjs --apply    # все
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(HERE, '../../.env') });

const API = 'https://api-seller.ozon.ru';
const HEADERS = {
  'Client-Id': process.env.OZON_CLIENT_ID,
  'Api-Key': process.env.OZON_API_TOKEN,
  'Content-Type': 'application/json',
};

async function call(path, body) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
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
        offer_id: String(it.offer_id),
        product_id: it.product_id,
        price: Number(p.price) || 0,
        old_price: Number(p.old_price) || 0,
        min_price: Number(p.min_price) || 0,
        vat: String(p.vat ?? '0'),
      });
    }
    cursor = j.cursor || '';
    if (!cursor || (j.items || []).length < 100) break;
  }
  return out;
}

async function timerStatus(ids) {
  const j = await call('/v1/product/action/timer/status', { product_ids: ids.map(String) });
  return j.statuses || [];
}

function summarize(statuses) {
  const on = statuses.filter((s) => s.min_price_for_auto_actions_enabled);
  const byDate = {};
  for (const s of on) {
    const d = (s.expired_at || '').slice(0, 10);
    byDate[d] = (byDate[d] || 0) + 1;
  }
  return `флаг включён: ${on.length} из ${statuses.length}; истекает: ${JSON.stringify(byDate)}`;
}

const mode = process.argv[2] || '--verify';
const all = (await listPrices()).filter((p) => p.price > 0);
console.log(`товаров с ценой: ${all.length}`);

if (mode === '--verify') {
  console.log(summarize(await timerStatus(all.map((p) => p.product_id))));
  process.exit(0);
}
if (mode !== '--smoke' && mode !== '--apply') {
  console.error('режим: --verify | --smoke | --apply');
  process.exit(2);
}

const targets = mode === '--smoke' ? all.slice(0, 3) : all;
const noMin = targets.filter((p) => !p.min_price);
if (noMin.length) console.log(`⚠ без min_price (флаг без порога бессмыслен): ${noMin.map((p) => p.offer_id).join(', ')}`);
console.log(`к отправке: ${targets.length} (${mode})`);

let ok = 0;
const errors = [];
for (let i = 0; i < targets.length; i += 50) {
  const prices = targets.slice(i, i + 50).map((p) => ({
    offer_id: p.offer_id,
    price: String(p.price),
    old_price: String(p.old_price),
    min_price: String(p.min_price),
    min_price_for_auto_actions_enabled: true,
    auto_action_enabled: 'UNKNOWN',
    auto_add_to_ozon_actions_list_enabled: 'UNKNOWN',
    price_strategy_enabled: 'UNKNOWN',
    vat: p.vat,
    currency_code: 'RUB',
  }));
  const j = await call('/v1/product/import/prices', { prices });
  for (const r of j.result || []) {
    if (r.updated) ok++;
    else errors.push({ offer_id: r.offer_id, errors: r.errors });
  }
}
console.log(`import/prices updated=true: ${ok} из ${targets.length}`);
for (const e of errors) console.log('  ошибка', e.offer_id, JSON.stringify(e.errors).slice(0, 300));

const tu = await call('/v1/product/action/timer/update', { product_ids: targets.map((p) => String(p.product_id)) });
console.log(`timer/update: ${JSON.stringify(tu).slice(0, 200)}`);

await new Promise((r) => setTimeout(r, 5000));
const after = new Map((await listPrices()).map((p) => [p.product_id, p]));
const moved = targets.filter((b) => {
  const a = after.get(b.product_id);
  return !a || a.price !== b.price || a.old_price !== b.old_price || a.min_price !== b.min_price;
});
console.log(moved.length ? `🔴 цены сдвинулись у ${moved.length}: ${moved.map((p) => p.offer_id).join(', ')}` : '🟢 цены не сдвинулись');
console.log(summarize(await timerStatus(targets.map((p) => p.product_id))));
