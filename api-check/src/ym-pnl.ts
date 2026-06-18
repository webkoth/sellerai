/**
 * Яндекс.Маркет P&L через relay. Финансы: /campaigns/{id}/stats/orders (заказы с комиссиями).
 * Запуск: node src/ym-pnl.ts 2026-01-01 2026-06-10 [probe]
 */
import { readFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

const dateFrom = process.argv[2] || '2026-01-01';
const dateTo = process.argv[3] || '2026-06-10';
const probe = process.argv[4] === 'probe';
loadEnv();
const proxy = await installProxy();
const token = env('YM_API_TOKEN')!, campaign = env('YM_CAMPAIGN_ID')!;
const H = { 'Api-Key': token, 'Content-Type': 'application/json' };
const rub = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
console.log(`proxy: ${proxy ? 'ON' : 'OFF'} | campaign ${campaign} | ${dateFrom}..${dateTo}`);

const orders: any[] = [];
let pageToken = '';
for (let i = 0; i < 100; i++) {
  const url = `https://api.partner.market.yandex.ru/campaigns/${campaign}/stats/orders${pageToken ? `?page_token=${pageToken}` : ''}`;
  const body = { dateFrom, dateTo, statuses: ['DELIVERED', 'PICKUP', 'DELIVERY'] };
  const r = await fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body) });
  if (!r.ok) { console.log(`HTTP ${r.status}: ${(await r.text()).slice(0, 250)}`); break; }
  const j = await r.json();
  const batch = j.result?.orders || [];
  orders.push(...batch);
  pageToken = j.result?.paging?.nextPageToken || '';
  if (!pageToken) break;
}
console.log(`Заказов: ${orders.length}`);
if (orders.length === 0) { console.log('Пусто или ошибка.'); process.exit(0); }

if (probe) {
  console.log('\nСтруктура первого заказа:');
  console.log(JSON.stringify(orders[0], null, 1).slice(0, 1600));
  process.exit(0);
}

// агрегация: выручка (BUYER) по items, комиссии и субсидии — на уровне ЗАКАЗА
const COMM: Record<string, number> = {};
let revenue = 0, units = 0, cogs = 0, noCostUnits = 0, subsidies = 0;
const unitsByBc = new Map<string, number>();
for (const o of orders) {
  for (const it of o.items || []) {
    const cnt = Number(it.count) || 1;
    const buyer = (it.prices || []).find((p: any) => p.type === 'BUYER') || it.prices?.[0];
    revenue += Number(buyer?.total ?? 0); units += cnt;
    unitsByBc.set(String(it.shopSku), (unitsByBc.get(String(it.shopSku)) || 0) + cnt);
  }
  for (const c of o.commissions || []) COMM[c.type] = (COMM[c.type] || 0) + (Number(c.actual) || 0);
  for (const s of o.subsidies || []) subsidies += Number(s.total ?? s.amount ?? 0) || 0;
}
const commission = Object.values(COMM).reduce((s, v) => s + v, 0);

// COGS: shopSku = баркод -> nmid (через WB sizes.skus) -> cost
const WBH = { Authorization: env('WB_API_TOKEN')!, 'Content-Type': 'application/json' };
const bc2nm = new Map<string, number>(); let cursor: any = { limit: 100 };
for (let i = 0; i < 50; i++) {
  const r = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', { method: 'POST', headers: WBH, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) });
  const j = await r.json(); const b = j.cards || [];
  for (const c of b) for (const sz of c.sizes || []) for (const sku of sz.skus || []) bc2nm.set(String(sku), c.nmID);
  if (b.length < 100) break; cursor = { limit: 100, updatedAt: j.cursor.updatedAt, nmID: j.cursor.nmID };
}
const nm2cost = new Map<number, number>();
for (const line of readFileSync('/Users/minas/projects/sai_kotelnikovartifact/data/cogs-source.tsv', 'utf8').trim().split('\n').slice(1)) {
  const [nmid, cost] = line.split('\t'); if (nmid) nm2cost.set(Number(nmid), Number(cost));
}
for (const [bc, q] of unitsByBc) {
  const nm = bc2nm.get(bc); const c = nm != null ? nm2cost.get(nm) : null;
  if (c == null) noCostUnits += q; else cogs += c * q;
}
const avg = (units - noCostUnits) > 0 ? cogs / (units - noCostUnits) : 0;
const cogsImp = cogs + avg * noCostUnits;
console.log(`Субсидии ЯМ (доплата продавцу): ${rub(subsidies)}`);

console.log('\n=== Комиссии ЯМ по типам ===');
for (const [k, v] of Object.entries(COMM).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${rub(v)}`);

// субсидии ЯМ уже внутри BUYER (выплат сверх BUYER нет) — НЕ добавляем
const payout = revenue - commission;
const pack = units * 775;
const tax = revenue * 0.06;
const pretax = payout - cogsImp - pack;
const net = pretax - tax;
console.log(`\n========== P&L Яндекс.Маркет · ${dateFrom}..${dateTo} ==========`);
console.log(`Выручка (BUYER):              ${rub(revenue)} (${units} шт)`);
console.log(`− Комиссии ЯМ:                ${rub(commission)} (${Math.round(commission / revenue * 100)}% от выручки)`);
console.log(`= Нетто-выплата ЯМ:           ${rub(payout)}`);
console.log(`− COGS (${noCostUnits} шт по средней): ${rub(cogsImp)}`);
console.log(`− Упаковка (${units}×775):        ${rub(pack)}`);
console.log(`= Прибыль до налога:          ${rub(pretax)}`);
console.log(`− Налог УСН 6%:               ${rub(tax)}`);
console.log(`= ЧИСТАЯ ПРИБЫЛЬ ЯМ:          ${rub(net)} (маржа ${Math.round(net / revenue * 100)}%)`);
