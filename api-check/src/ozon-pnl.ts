/**
 * Ozon P&L за период через relay. Финансы: /v3/finance/transaction/totals (помесячно ≤31дн).
 * Единицы и COGS: /v3/finance/transaction/list (orders) — sku→offer_id→cost (через WB vendorCode→nmid→cost).
 * Запуск: node src/ozon-pnl.ts 2026-01-01 2026-06-10
 */
import { readFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

const dateFrom = process.argv[2] || '2026-01-01';
const dateTo = process.argv[3] || '2026-06-10';
loadEnv();
const proxy = await installProxy();
const cid = env('OZON_CLIENT_ID')!, key = env('OZON_API_TOKEN')!;
const H = { 'Client-Id': cid, 'Api-Key': key, 'Content-Type': 'application/json' };
const rub = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
console.log(`proxy: ${proxy ? 'ON' : 'OFF'} | период ${dateFrom}..${dateTo}`);

function* months(from: string, to: string) {
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const a = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let b = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    if (b > to) b = to;
    yield [a < from ? from : a, b] as [string, string];
    m++; if (m > 12) { m = 1; y++; }
  }
}

// ---- финансовые агрегаты ----
const tot = { accruals_for_sale: 0, sale_commission: 0, processing_and_delivery: 0, refunds_and_cancellations: 0, services_amount: 0, compensation_amount: 0, money_transfer: 0, others_amount: 0 };
for (const [a, b] of months(dateFrom, dateTo)) {
  const body = { date: { from: `${a}T00:00:00.000Z`, to: `${b}T23:59:59.999Z` }, posting_number: '', transaction_type: 'all' };
  const r = await fetch('https://api-seller.ozon.ru/v3/finance/transaction/totals', { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!r.ok) { console.log(`  ${a}: HTTP ${r.status} ${(await r.text()).slice(0, 150)}`); continue; }
  const j = await r.json();
  const t = j.result || {};
  for (const k of Object.keys(tot)) (tot as any)[k] += Number(t[k]) || 0;
  console.log(`  ${a}..${b}: накопления ${rub(t.accruals_for_sale || 0)}`);
}
const netPayout = Object.values(tot).reduce((s, v) => s + v, 0);
console.log('\n=== Финансовые агрегаты Ozon (весь период) ===');
for (const [k, v] of Object.entries(tot)) console.log(`  ${k}: ${rub(v)}`);
console.log(`  >>> НЕТТО к перечислению (сумма): ${rub(netPayout)}`);

// ---- vendorCode -> cost (WB мастер): все карточки WB + tsv ----
const WBH = { Authorization: env('WB_API_TOKEN')!, 'Content-Type': 'application/json' };
const vc2nm = new Map<string, number>();
let cursor: any = { limit: 100 };
for (let i = 0; i < 50; i++) {
  const r = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', { method: 'POST', headers: WBH, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) });
  const j = await r.json(); const b = j.cards || [];
  for (const c of b) if (c.vendorCode) vc2nm.set(String(c.vendorCode).toLowerCase(), c.nmID);
  if (b.length < 100) break; cursor = { limit: 100, updatedAt: j.cursor.updatedAt, nmID: j.cursor.nmID };
}
const nm2cost = new Map<number, number>();
for (const line of readFileSync('/Users/minas/projects/sai_kotelnikovartifact/data/cogs-source.tsv', 'utf8').trim().split('\n').slice(1)) {
  const [nmid, cost] = line.split('\t'); if (nmid) nm2cost.set(Number(nmid), Number(cost));
}
const vc2cost = (vc: string): number | null => { const nm = vc2nm.get(String(vc).toLowerCase()); return nm != null ? nm2cost.get(nm) ?? null : null; };

// ---- Ozon выкупленные отправления FBS -> штуки по offer_id ----
const unitsByOffer = new Map<string, number>();
let offset = 0;
for (let i = 0; i < 100; i++) {
  const body = { dir: 'ASC', filter: { since: `${dateFrom}T00:00:00.000Z`, to: `${dateTo}T23:59:59.999Z`, status: 'delivered' }, limit: 1000, offset, with: {} };
  const r = await fetch('https://api-seller.ozon.ru/v3/posting/fbs/list', { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!r.ok) { console.log(`postings: HTTP ${r.status} ${(await r.text()).slice(0, 150)}`); break; }
  const j = await r.json();
  const post = j.result?.postings || [];
  for (const p of post) for (const it of p.products || []) unitsByOffer.set(it.offer_id, (unitsByOffer.get(it.offer_id) || 0) + (Number(it.quantity) || 0));
  if (post.length < 1000) break; offset += 1000;
}
let cogs = 0, units = 0, noCost = 0, noCostUnits = 0;
const missed: string[] = [];
for (const [offer, q] of unitsByOffer) {
  units += q; const c = vc2cost(offer);
  if (c == null) { noCost++; noCostUnits += q; missed.push(`${offer}×${q}`); } else cogs += c * q;
}
if (missed.length) {
  console.log('\n⚠ offer_id без себестоимости:', missed.join(', '));
  console.log('Примеры WB vendorCode:', [...vc2nm.keys()].slice(0, 8).join(', '));
}
console.log(`\n=== Единицы и COGS Ozon ===`);
console.log(`Выкуплено (delivered): ${units} шт, offer_id: ${unitsByOffer.size} | без себест.: ${noCost} (${noCostUnits} шт)`);
console.log(`COGS: ${rub(cogs)}`);

// допокрытие по средней (как в propose-cogs) для непокрытых
const avgCost = (units - noCostUnits) > 0 ? cogs / (units - noCostUnits) : 0;
const cogsImputed = cogs + avgCost * noCostUnits;
console.log(`COGS с допокрытием (${noCostUnits} шт по ср.${rub(avgCost)}): ${rub(cogsImputed)}`);

// ---- итоговый P&L ----
const revenue = tot.accruals_for_sale;
const pack = units * 775;
const tax = revenue * 0.06;
cogs = cogsImputed;
const pretax = netPayout - cogs - pack;
const net = pretax - tax;
console.log(`\n========== P&L Ozon · ${dateFrom}..${dateTo} ==========`);
console.log(`Выручка (accruals_for_sale):  ${rub(revenue)}`);
console.log(`Нетто-выплата Ozon:           ${rub(netPayout)}  (комиссия ${Math.round(-tot.sale_commission / revenue * 100)}% от выручки)`);
console.log(`− COGS (${units} шт):             ${rub(cogs)}`);
console.log(`− Упаковка (${units}×775):        ${rub(pack)}`);
console.log(`= Прибыль до налога:          ${rub(pretax)}`);
console.log(`− Налог УСН 6% от выручки:     ${rub(tax)}`);
console.log(`= ЧИСТАЯ ПРИБЫЛЬ Ozon:        ${rub(net)}  (маржа ${Math.round(net / revenue * 100)}%)`);
