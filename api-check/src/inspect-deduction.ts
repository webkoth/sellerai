import { readFileSync } from 'node:fs';
const { records } = JSON.parse(readFileSync('/tmp/wb-realization-2026-01-01_2026-06-10.json', 'utf8')) as { records: any[] };
const ded = records.filter((r) => String(r.supplier_oper_name).includes('Удержание'));
console.log(`Удержание: ${ded.length} строк, сумма deduction=${Math.round(ded.reduce((s, r) => s + (+r.deduction || 0), 0)).toLocaleString('ru-RU')}`);
const byBonus = new Map<string, { n: number; sum: number }>();
for (const r of ded) {
  const key = r.bonus_type_name || '(пусто)';
  const e = byBonus.get(key) || { n: 0, sum: 0 };
  e.n++; e.sum += +r.deduction || 0; byBonus.set(key, e);
}
console.log('\nПо bonus_type_name (причина удержания):');
for (const [k, e] of [...byBonus.entries()].sort((a, b) => b[1].sum - a[1].sum)) console.log(`  ${k}: n=${e.n} сумма=${Math.round(e.sum).toLocaleString('ru-RU')}`);
console.log('\nПримеры строк:');
for (const r of ded.slice(0, 8)) console.log(`  rr_dt=${r.rr_dt} deduction=${r.deduction} bonus=${r.bonus_type_name} nm=${r.nm_id}`);
// также проверим, нет ли рекламы в acceptance/penalty bonus
console.log('\nВсе уникальные bonus_type_name по всему отчёту:');
console.log([...new Set(records.map((r) => r.bonus_type_name).filter(Boolean))].join(' | '));
