/**
 * Анализ рекламы WB: кампании + fullstats за период. Считает расход/заказы/выручку/ДРР/CPO/CTR.
 * Запуск: node src/ad-analysis.ts 2026-01-01 2026-06-10
 */
import { writeFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

const beginDate = process.argv[2] || '2026-01-01';
const endDate = process.argv[3] || '2026-06-10';
loadEnv();
const proxy = await installProxy();
const token = env('WB_API_TOKEN')!;
const A = `https://advert-api.wildberries.ru`;
const H = { Authorization: token, 'Content-Type': 'application/json' };
const rub = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
console.log(`proxy: ${proxy ? 'ON' : 'OFF'} | ${beginDate}..${endDate}`);

// 1. список кампаний
const cnt = await fetch(`${A}/adv/v1/promotion/count`, { headers: H });
if (!cnt.ok) { console.log(`count: HTTP ${cnt.status} ${(await cnt.text()).slice(0, 150)}`); process.exit(1); }
const cj = await cnt.json();
const TYPE: Record<number, string> = { 4: 'каталог', 5: 'карточка', 6: 'поиск', 7: 'реком', 8: 'авто', 9: 'поиск+кат' };
const STATUS: Record<number, string> = { 4: 'готова', 7: 'завершена', 8: 'отказ', 9: 'активна', 11: 'пауза' };
const all: any[] = [];
for (const g of cj.adverts || []) for (const a of g.advert_list || []) all.push({ id: a.advertId, type: g.type, status: g.status, change: a.changeTime });
console.log(`Всего кампаний: ${all.length}`);
const byStatus = new Map<number, number>();
for (const a of all) byStatus.set(a.status, (byStatus.get(a.status) || 0) + 1);
console.log('По статусам:', [...byStatus.entries()].map(([s, n]) => `${STATUS[s] || s}=${n}`).join(', '));

// 2. имена кампаний (promotion/adverts, чанки по 50)
const names = new Map<number, string>();
const ids = all.map((a) => a.id);
for (let i = 0; i < ids.length; i += 50) {
  const r = await fetch(`${A}/adv/v1/promotion/adverts`, { method: 'POST', headers: H, body: JSON.stringify(ids.slice(i, i + 50)) });
  if (r.ok) for (const d of await r.json()) names.set(d.advertId, d.name || '');
}

// 3. fullstats помесячно (лимит 31 день), суммируем по кампании
function* months(from: string, to: string) {
  let [y, m] = from.split('-').map(Number); const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const a = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let b = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    if (b > to) b = to;
    yield [a < from ? from : a, b] as [string, string]; m++; if (m > 12) { m = 1; y++; }
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function statReq(chunk: string, a: string, b: string): Promise<any[] | null> {
  for (let t = 0; t < 4; t++) {
    const r = await fetch(`${A}/adv/v3/fullstats?ids=${chunk}&beginDate=${a}&endDate=${b}`, { headers: H });
    if (r.ok) { const d = await r.json(); return Array.isArray(d) ? d : []; }
    if (r.status === 429) { console.log(`  ${a}: 429, жду 65с (попытка ${t + 1})`); await sleep(65000); continue; }
    console.log(`  ${a}: HTTP ${r.status} ${(await r.text()).slice(0, 80)}`); return null;
  }
  return null;
}
const acc = new Map<number, any>();
let first = true;
for (const [a, b] of months(beginDate, endDate)) {
  if (!first) await sleep(20000); first = false; // пауза между месяцами
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).join(',');
    const d = await statReq(chunk, a, b);
    if (!d) continue;
    for (const s of d) {
      const e = acc.get(s.advertId) || { advertId: s.advertId, views: 0, clicks: 0, sum: 0, orders: 0, sum_price: 0, atbs: 0 };
      e.views += s.views || 0; e.clicks += s.clicks || 0; e.sum += s.sum || 0;
      e.orders += s.orders || 0; e.sum_price += s.sum_price || 0; e.atbs += s.atbs || 0;
      acc.set(s.advertId, e);
    }
  }
}
const stats = [...acc.values()];
console.log(`Статистики получено по ${stats.length} кампаниям\n`);

// 4. агрегаты
const rows = stats.map((s) => {
  const spend = s.sum || 0, orders = s.orders || 0, revenue = s.sum_price || 0, views = s.views || 0, clicks = s.clicks || 0;
  return {
    id: s.advertId, name: names.get(s.advertId) || '', type: TYPE[(all.find((a) => a.id === s.advertId) || {}).type] || '?',
    status: STATUS[(all.find((a) => a.id === s.advertId) || {}).status] || '?',
    views, clicks, ctr: views ? +(clicks / views * 100).toFixed(2) : 0, cpc: clicks ? Math.round(spend / clicks) : 0,
    spend, orders, revenue, atbs: s.atbs || 0,
    drr: revenue ? +(spend / revenue * 100).toFixed(1) : (spend ? 999 : 0),
    cpo: orders ? Math.round(spend / orders) : (spend ? -1 : 0),
    roi: spend ? +((revenue - spend) / spend * 100).toFixed(0) : 0,
  };
});
const tot = rows.reduce((a, r) => ({ spend: a.spend + r.spend, orders: a.orders + r.orders, revenue: a.revenue + r.revenue, clicks: a.clicks + r.clicks, views: a.views + r.views }), { spend: 0, orders: 0, revenue: 0, clicks: 0, views: 0 });
writeFileSync('/tmp/wb-ad-stats.json', JSON.stringify(rows, null, 0));

console.log('=== ИТОГО по рекламе за период ===');
console.log(`Расход: ${rub(tot.spend)} | заказов: ${tot.orders} | выручка с рекл: ${rub(tot.revenue)} | ДРР: ${(tot.spend / tot.revenue * 100).toFixed(1)}% | ROI: ${((tot.revenue - tot.spend) / tot.spend * 100).toFixed(0)}%`);
console.log(`Показы: ${tot.views.toLocaleString('ru-RU')} | клики: ${tot.clicks} | CTR: ${(tot.clicks / tot.views * 100).toFixed(2)}% | CPC: ${Math.round(tot.spend / tot.clicks)} ₽`);

const active = rows.filter((r) => r.spend > 0).sort((a, b) => b.spend - a.spend);
console.log(`\n=== Кампании с расходом (${active.length}) ===`);
console.log('id | тип | статус | расход | заказы | выручка | ДРР% | CPO | ROI% | назв');
for (const r of active) console.log(`${r.id} | ${r.type} | ${r.status} | ${rub(r.spend)} | ${r.orders} | ${rub(r.revenue)} | ${r.drr} | ${r.cpo} | ${r.roi} | ${r.name.slice(0, 30)}`);
