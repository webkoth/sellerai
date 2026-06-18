/**
 * Сводный P&L WB за период: нетто-выплата (из отчёта о реализации) − COGS − реклама − налог.
 * Берёт сырьё из /tmp (pull-realization.ts), себестоимость из data/cogs-source.tsv + data/state/costs.json,
 * рекламу тянет из advert-api /adv/v1/upd через relay.
 * Запуск: node src/pnl-wb.ts 2026-01-01 2026-06-10
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, installProxy, env } from './lib.ts';

const dateFrom = process.argv[2] || '2026-01-01';
const dateTo = process.argv[3] || '2026-06-10';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rub = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₽';

loadEnv();
const proxy = await installProxy();
const token = env('WB_API_TOKEN');

// ---------- 1. отчёт о реализации (сырьё) ----------
const realPath = `/tmp/wb-realization-${dateFrom}_${dateTo}.json`;
if (!existsSync(realPath)) throw new Error(`нет ${realPath} — сначала pull-realization.ts`);
const { records, sums } = JSON.parse(readFileSync(realPath, 'utf8')) as { records: any[]; sums: Record<string, number> };

const S = (k: string) => Number(sums[k] || 0);
// нетто-выплата продавцу (формула WB по агрегатам отчёта)
const forPay = S('ppvz_for_pay');
const delivery = S('delivery_rub');
const storage = S('storage_fee');
const penalty = S('penalty');
const acceptance = S('acceptance');
const deduction = S('deduction'); // прочие удержания (вкл. возможные списания за рекламу/услуги)
const addPay = S('additional_payment');
const rebill = S('rebill_logistic_cost'); // возмещения
const netPayout = forPay - delivery - storage - penalty - acceptance - deduction + addPay + rebill;

const retailSales = records.filter((r) => String(r.supplier_oper_name).includes('Продаж')).reduce((s, r) => s + (Number(r.retail_amount) || 0), 0);
const retailRet = records.filter((r) => String(r.supplier_oper_name).includes('Возврат')).reduce((s, r) => s + (Number(r.retail_amount) || 0), 0);
const grossRetail = retailSales - retailRet;

// ---------- 2. COGS ----------
// ВАЖНО: продажи только из операций "Продажа"/"Возврат" (иначе логистика/возмещения раздувают qty)
const soldMap = new Map<number, { nm: number; qty: number; ret: number; name: string; art: string }>();
for (const r of records) {
  const op = String(r.supplier_oper_name || '');
  const isSale = op.includes('Продаж');
  const isRet = op.includes('Возврат');
  if (!isSale && !isRet) continue;
  const nm = Number(r.nm_id) || 0;
  const q = Math.abs(Number(r.quantity) || 0) || 1; // у штучного хендмейда обычно 1
  const e = soldMap.get(nm) || { nm, qty: 0, ret: 0, name: r.subject_name || '', art: r.sa_name || '' };
  if (isRet) e.ret += q; else e.qty += q;
  soldMap.set(nm, e);
}
const sold = [...soldMap.values()];
// cogs из tsv (nmid -> cost)
const cogsTsv = new Map<number, number>();
const tsv = readFileSync(join(root, 'data/cogs-source.tsv'), 'utf8').trim().split('\n').slice(1);
for (const line of tsv) {
  const [nmid, cost] = line.split('\t');
  if (nmid && cost) cogsTsv.set(Number(nmid), Number(cost));
}
// costs.json (barcode -> cost) — на случай, но в отчёте у нас nm_id; tsv по nmid основной
let cogsTotal = 0, coveredQty = 0, missingQty = 0;
const missing: Array<{ nm: number; qty: number; name: string }> = [];
for (const s of sold) {
  const net = s.qty - s.ret;
  if (net <= 0) continue;
  const c = cogsTsv.get(s.nm);
  if (c == null) { missingQty += net; missing.push({ nm: s.nm, qty: net, name: s.name }); continue; }
  cogsTotal += c * net;
  coveredQty += net;
}
const avgCogs = coveredQty ? cogsTotal / coveredQty : 0;
const cogsImputed = cogsTotal + avgCogs * missingQty; // допокрытие по средней

// ---------- 3. реклама (advert-api /adv/v1/upd, помесячно ≤31 дн) ----------
let adSpend = 0; let adCount = 0; const adNotes: string[] = [];
function* months(from: string, to: string) {
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const a = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let b = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    if (b > to) b = to;
    yield [a < from ? from : a, b] as [string, string];
    m++; if (m > 12) { m = 1; y++; }
  }
}
for (const [a, b] of months(dateFrom, dateTo)) {
  try {
    const url = `https://advert-api.wildberries.ru/adv/v1/upd?from=${a}&to=${b}`;
    const r = await fetch(url, { headers: { Authorization: token! } });
    if (!r.ok) { adNotes.push(`${a}:HTTP${r.status}`); continue; }
    const t = await r.text();
    const arr = t && t.trim() ? JSON.parse(t) : [];
    if (Array.isArray(arr)) { const s = arr.reduce((s, x) => s + (Number(x.updSum) || 0), 0); adSpend += s; adCount += arr.length; }
  } catch (e: any) { adNotes.push(`${a}:err`); }
}
const adNote = `${adCount} списаний${adNotes.length ? '; ' + adNotes.join(',') : ''}`;

// ---------- вывод ----------
console.log(`\n========== P&L Wildberries · ${dateFrom} … ${dateTo} ==========\n`);
console.log(`proxy: ${proxy ? 'ON' : 'OFF'}\n`);
console.log(`Продано (нетто, шт):           ${(sold.reduce((s, x) => s + (x.qty - x.ret), 0))}`);
console.log(`Выручка (retail, нетто):       ${rub(grossRetail)}`);
console.log(`  − продажи:                   ${rub(retailSales)}`);
console.log(`  − возвраты:                  ${rub(retailRet)}`);
console.log(`\n--- Удержания WB (из отчёта) ---`);
console.log(`К перечислению за товар:        ${rub(forPay)}`);
console.log(`− Логистика:                    ${rub(delivery)}`);
console.log(`− Хранение:                     ${rub(storage)}`);
console.log(`− Приёмка:                      ${rub(acceptance)}`);
console.log(`− Штрафы:                       ${rub(penalty)}`);
console.log(`− Прочие удержания (deduction): ${rub(deduction)}`);
console.log(`+ Доплаты:                      ${rub(addPay)}`);
console.log(`+ Возмещения (rebill):          ${rub(rebill)}`);
console.log(`= Нетто-выплата WB:             ${rub(netPayout)}`);
console.log(`\n--- Себестоимость ---`);
console.log(`COGS (покрыто ${coveredQty} шт):     ${rub(cogsTotal)}`);
if (missingQty) console.log(`COGS допокрытие (${missingQty} шт по ср.${rub(avgCogs)}): итого ${rub(cogsImputed)}`);
console.log(`\n--- Реклама ---`);
console.log(`Рекламные расходы (upd):        ${rub(adSpend)}  [${adNote}]`);

const cogsUse = cogsImputed;
const PACK = Number(process.argv[4] ?? 775);      // упаковка ₽/шт
const netUnits = sold.reduce((s, x) => s + (x.qty - x.ret), 0);
const packTotal = PACK * netUnits;
// ВАЖНО: реклама (deduction «WB Продвижение») УЖЕ внутри netPayout — отдельно не вычитаем.
const opProfit = netPayout - cogsUse - packTotal; // прибыль до налога
console.log(`\n========== ИТОГ (до налога) ==========`);
console.log(`Нетто-выплата WB (вкл. рекламу): ${rub(netPayout)}`);
console.log(`  · в т.ч. удержано за рекламу:  ${rub(deduction)}  (сверка /adv: ${rub(adSpend)})`);
console.log(`− COGS:                         ${rub(cogsUse)}`);
console.log(`− Упаковка (${netUnits}×${PACK}):       ${rub(packTotal)}`);
console.log(`= Прибыль до налога:            ${rub(opProfit)}  (маржа ${Math.round((opProfit / grossRetail) * 100)}% от выручки)`);
// УСН 6% «Доходы», ИП без работников: налог уменьшается на страховые до 100%.
// 6%×доход(77.6т только WB) > годовых фикс. взносов → взносы поглощены, нагрузка ≈ 6% выручки.
const tax6 = grossRetail * 0.06;
console.log(`\n--- Налог УСН 6% «Доходы» (ИП без работников) ---`);
console.log(`Налог 6% от выручки:            −${rub(tax6)}`);
console.log(`  (страховые взносы поглощены налогом → сверху не добавляются)`);
console.log(`\n========== ЧИСТАЯ ПРИБЫЛЬ (после налога) ==========`);
console.log(`= ${rub(opProfit - tax6)}  (маржа ${Math.round(((opProfit - tax6) / grossRetail) * 100)}% от выручки)`);
if (missing.length) {
  console.log(`\n⚠ Без себестоимости (${missing.length} nmId, ${missingQty} шт) — допокрыто средней:`);
  for (const m of missing.slice(0, 12)) console.log(`   ${m.nm}  ${m.qty}шт  ${m.name}`);
  if (missing.length > 12) console.log(`   … ещё ${missing.length - 12}`);
}
