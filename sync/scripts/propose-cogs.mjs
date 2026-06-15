/**
 * Допокрытие COGS по аналогии: непокрытым позициям активного пула проставляет
 * ОЦЕНОЧНУЮ себестоимость по модели (тип метеорита + форма изделия + вес),
 * откалиброванной на data/cogs-source.tsv.
 *
 *   node sync/scripts/propose-cogs.mjs           # превью предложений
 *   node sync/scripts/propose-cogs.mjs --apply   # записать (source=est:by-type), кроме conf=low
 *   node sync/scripts/propose-cogs.mjs --apply --with-low   # записать включая low
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const APPLY = process.argv.includes('--apply');
const WITH_LOW = process.argv.includes('--with-low');
dotenvConfig({ path: resolve(ROOT, '.env') });
const { getCards } = await import(pathToFileURL(resolve(ROOT, 'mcp/wb-mcp/dist/tools/cards.js')).href);
const { loadCosts, setCost, saveCosts } = await import(pathToFileURL(resolve(ROOT, 'sync/dist/costs.js')).href);

const inv = JSON.parse(readFileSync(resolve(ROOT, 'data/state/inventory.json'), 'utf8'));
const costs0 = JSON.parse(readFileSync(resolve(ROOT, 'data/state/costs.json'), 'utf8'));

const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е');
const r50 = (n) => Math.round(n / 50) * 50;
const typeOf = (s) => {
  s = norm(s);
  if (/муонион|muonion/.test(s)) return 'Муонионалуста';
  if (/campo|кампо|сьело|сьела/.test(s)) return 'Campo';
  if (/сихот/.test(s)) return 'Сихотэ';
  if (/дронино/.test(s)) return 'Дронино';
  if (/царев/.test(s)) return 'Царев';
  if (/алетай|aletai/.test(s)) return 'Алетай';
  if (/серич|sericho/.test(s)) return 'Серичо';
  if (/ливийск|индошинит|молдавит|тектит/.test(s)) return 'Тектит';
  return 'Прочее';
};
const formOf = (s) => {
  s = norm(s);
  if (/браслет/.test(s)) return 'браслет';
  if (/кулон/.test(s)) return 'кулон';
  if (/кольцо/.test(s)) return 'кольцо';
  if (/бусина|дзи/.test(s)) return 'бусина';
  if (/фигурк/.test(s)) return 'фигурка';
  if (/часы/.test(s)) return 'часы';
  if (/подвеск|амулет|мелонг|меркаба|крест/.test(s)) return 'подвеска';
  return 'образец';
};
const weightOf = (s) => { const m = norm(s).match(/(\d+[.,]?\d*)\s*гр/); return m ? +m[1].replace(',', '.') : null; };

// модель: возвращает {cost, conf, basis}
function model(title) {
  const t = typeOf(title), f = formOf(title), w = weightOf(title);
  const W = w ? `${w}г` : 'без веса';
  switch (t) {
    case 'Campo': return { cost: 1150, conf: 'high', basis: `Campo ~1150 (медиана, плоско)` };
    case 'Царев': return w ? { cost: r50(w * 78), conf: 'high', basis: `Царев 78₽/гр × ${W}` } : { cost: 2800, conf: 'med', basis: 'Царев образец медиана' };
    case 'Дронино': return w ? { cost: r50(w * 148), conf: 'med', basis: `Дронино 148₽/гр × ${W}` } : { cost: 2900, conf: 'med', basis: 'Дронино медиана' };
    case 'Сихотэ':
      if (f === 'подвеска') return { cost: 2500, conf: 'med', basis: 'Сихотэ подвеска медиана' };
      if (w) { const c = w < 6 ? 2000 : w < 15 ? 2300 : w < 35 ? 2900 : r50(w * 90); return { cost: c, conf: 'med', basis: `Сихотэ образец по весу (${W})` }; }
      return { cost: 2300, conf: 'med', basis: 'Сихотэ образец медиана' };
    case 'Серичо': return { cost: 4400, conf: 'med', basis: 'Серичо подвеска медиана' };
    case 'Муонионалуста': return { cost: 7800, conf: 'low', basis: 'Муонионалуста медиана (разброс 3000–18000!)' };
    case 'Алетай':
      if (f === 'браслет') return { cost: 2300, conf: 'med', basis: 'Алетай браслет медиана' };
      if (f === 'бусина') return { cost: 6250, conf: 'med', basis: 'Алетай бусина Дзи медиана' };
      if (f === 'кулон') return { cost: 4750, conf: 'med', basis: 'Алетай кулон медиана' };
      return { cost: 3400, conf: 'med', basis: 'Алетай подвеска' };
    case 'Тектит':
      if (f === 'фигурка') return { cost: 13000, conf: 'low', basis: 'ливийское стекло фигурка (n=1)' };
      if (f === 'браслет') return { cost: 3500, conf: 'low', basis: 'тектит браслет (n=1)' };
      return { cost: 4000, conf: 'low', basis: 'тектит/индошинит — мало данных' };
    default:
      if (f === 'браслет') return { cost: 2500, conf: 'low', basis: 'прочее браслет (грубо)' };
      return { cost: null, conf: 'low', basis: 'нет аналога — ввести вручную' };
  }
}

// nmID по barcode (для отображения артикула)
const { cards } = await getCards({ limit: 1000 });
const bcToNm = new Map();
for (const c of cards) for (const s of c.sizes || []) for (const sku of s.skus || []) bcToNm.set(String(sku), c.nmId);

const poolNoCost = Object.keys(inv.items).filter((b) => !(costs0.items[b] && costs0.items[b].cost > 0));
const props = poolNoCost.map((b) => {
  const e = inv.items[b];
  const m = model(e.title);
  return { barcode: b, nm: bcToNm.get(String(b)) ?? '?', title: e.title || '', type: typeOf(e.title), ...m };
});
props.sort((a, b) => a.type.localeCompare(b.type, 'ru') || (b.cost || 0) - (a.cost || 0));

console.log('=== Предложение COGS по аналогии ' + (APPLY ? '(APPLY)' : '(превью)') + ' ===');
let cur = '';
let sum = 0, n = 0;
const conf = { high: 0, med: 0, low: 0, none: 0 };
for (const p of props) {
  if (p.type !== cur) { cur = p.type; console.log(`\n— ${cur} —`); }
  const tag = p.conf === 'high' ? '🟢' : p.conf === 'med' ? '🟡' : '🔴';
  console.log(`  ${tag} ${String(p.nm).padEnd(11)} ${p.cost == null ? '   ?  ' : String(p.cost).padStart(6)}₽  ${p.title.slice(0, 44).padEnd(44)} ← ${p.basis}`);
  if (p.cost == null) conf.none++; else { conf[p.conf]++; sum += p.cost; n++; }
}
console.log(`\nИтого: ${props.length} поз. | 🟢${conf.high} 🟡${conf.med} 🔴${conf.low} (без аналога: ${conf.none}) | сумма оценок: ${sum.toLocaleString('ru-RU')}₽`);

if (APPLY) {
  const cat = loadCosts();
  let written = 0;
  for (const p of props) {
    if (p.cost == null) continue;
    if (p.conf === 'low' && !WITH_LOW) continue;
    setCost(cat, p.barcode, p.cost, { source: 'est:by-type', note: `~${p.basis}` });
    written++;
  }
  saveCosts(cat);
  console.log(`Записано (est:by-type): ${written}${WITH_LOW ? ' (вкл. low)' : ', low пропущены'}`);
}
