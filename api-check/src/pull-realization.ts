/**
 * Разовый харнесс: тянет отчёт о реализации WB (reportDetailByPeriod) за период
 * через VPS-relay (API_CHECK_PROXY) с пагинацией, выгружает сырьё и считает
 * суммы по всем числовым полям + разбивку по типам операций.
 * Запуск: node src/pull-realization.ts 2026-01-01 2026-06-10
 */
import { writeFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

const dateFrom = process.argv[2] || '2026-01-01';
const dateTo = process.argv[3] || '2026-06-10';

const envPath = loadEnv();
const proxy = await installProxy();
console.log(`env: ${envPath} | proxy: ${proxy ? 'ON' : 'OFF'} | период: ${dateFrom}..${dateTo}`);

const token = env('WB_API_TOKEN');
if (!token) throw new Error('нет WB_API_TOKEN');

const BASE = 'https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod';
const all: any[] = [];
let rrdid = 0;
let req = 0;
while (req < 200) {
  req++;
  const url = `${BASE}?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=100000&rrdid=${rrdid}`;
  const r = await fetch(url, { headers: { Authorization: token } });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`WB ${r.status}: ${t.slice(0, 300)}`);
  }
  const text = await r.text();
  if (!text || text.trim() === '') break;
  const batch = JSON.parse(text);
  if (!Array.isArray(batch) || batch.length === 0) break;
  all.push(...batch);
  const last = batch[batch.length - 1];
  process.stdout.write(`  стр ${req}: +${batch.length} (всего ${all.length}) rrd_id=${last?.rrd_id}\n`);
  if (batch.length < 100000) break;
  if (!last?.rrd_id) break;
  rrdid = last.rrd_id;
}

console.log(`\nВсего записей: ${all.length}`);
if (all.length === 0) {
  console.log('Пусто — нет данных за период (или отчёты ещё не сформированы).');
  process.exit(0);
}

// какие поля есть
const sample = all[0];
const numFields = Object.keys(sample).filter((k) => typeof sample[k] === 'number');
console.log('\nЧисловые поля:', numFields.join(', '));

// суммы по всем числовым полям
const sums: Record<string, number> = {};
for (const k of numFields) sums[k] = 0;
for (const row of all) for (const k of numFields) sums[k] += Number(row[k]) || 0;
console.log('\n=== Суммы по числовым полям (весь период) ===');
for (const k of numFields) {
  if (Math.abs(sums[k]) < 0.005) continue;
  console.log(`  ${k}: ${Math.round(sums[k]).toLocaleString('ru-RU')}`);
}

// разбивка по типу операции (supplier_oper_name)
const byOper = new Map<string, { n: number; for_pay: number; retail: number; delivery: number }>();
for (const row of all) {
  const op = row.supplier_oper_name || '(пусто)';
  const e = byOper.get(op) || { n: 0, for_pay: 0, retail: 0, delivery: 0 };
  e.n++;
  e.for_pay += Number(row.ppvz_for_pay) || 0;
  e.retail += Number(row.retail_amount) || 0;
  e.delivery += Number(row.delivery_rub) || 0;
  byOper.set(op, e);
}
console.log('\n=== По типам операций (supplier_oper_name) ===');
for (const [op, e] of [...byOper.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(
    `  ${op}: n=${e.n} | for_pay=${Math.round(e.for_pay).toLocaleString('ru-RU')} | retail=${Math.round(e.retail).toLocaleString('ru-RU')} | delivery=${Math.round(e.delivery).toLocaleString('ru-RU')}`
  );
}

// продажи/возвраты по количеству
let saleQty = 0, retQty = 0;
const soldByNm = new Map<number, { qty: number; ret: number; retail: number; for_pay: number; name: string; art: string }>();
for (const row of all) {
  const q = Number(row.quantity) || 0;
  const op = String(row.supplier_oper_name || '');
  const isReturn = op.toLowerCase().includes('возврат') || q < 0;
  const nm = row.nm_id;
  const e = soldByNm.get(nm) || { qty: 0, ret: 0, retail: 0, for_pay: 0, name: row.subject_name || '', art: row.sa_name || '' };
  if (isReturn) { retQty += Math.abs(q); e.ret += Math.abs(q); }
  else { saleQty += q; e.qty += q; }
  e.retail += Number(row.retail_amount) || 0;
  e.for_pay += Number(row.ppvz_for_pay) || 0;
  soldByNm.set(nm, e);
}
console.log(`\nКол-во продаж (шт): ${saleQty} | возвратов (шт): ${retQty} | уникальных nmId: ${soldByNm.size}`);

const out = `/tmp/wb-realization-${dateFrom}_${dateTo}.json`;
writeFileSync(out, JSON.stringify({ dateFrom, dateTo, count: all.length, sums, records: all }, null, 0));
console.log(`\nСырьё сохранено: ${out}`);

// выгрузим проданные кол-ва по nmId для расчёта COGS
const soldOut = `/tmp/wb-sold-by-nm-${dateFrom}_${dateTo}.json`;
writeFileSync(soldOut, JSON.stringify([...soldByNm.entries()].map(([nm, e]) => ({ nm, ...e })), null, 0));
console.log(`Продажи по nmId: ${soldOut}`);
