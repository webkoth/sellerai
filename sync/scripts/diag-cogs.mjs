/** Диагностика покрытия COGS: почему позиции активного пула без себестоимости. */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
dotenvConfig({ path: resolve(ROOT, '.env') });
const { getCards } = await import(pathToFileURL(resolve(ROOT, 'mcp/wb-mcp/dist/tools/cards.js')).href);

const inv = JSON.parse(readFileSync(resolve(ROOT, 'data/state/inventory.json'), 'utf8'));
const costs = JSON.parse(readFileSync(resolve(ROOT, 'data/state/costs.json'), 'utf8'));
const tsv = readFileSync(resolve(ROOT, 'data/cogs-source.tsv'), 'utf8').trim().split('\n'); tsv.shift();
const sheetNm = new Set(tsv.map((l) => Number(l.split('\t')[0])));

const { cards } = await getCards({ limit: 1000 });
const bcToNm = new Map(), vcToNm = new Map();
for (const c of cards) {
  for (const s of c.sizes || []) for (const sku of s.skus || []) bcToNm.set(String(sku), c.nmId);
  if (c.vendorCode) vcToNm.set(c.vendorCode, c.nmId);
}

const poolNoCost = Object.keys(inv.items).filter((b) => !(costs.items[b] && costs.items[b].cost > 0));
let mapByBc = 0, mapByVc = 0, inSheet = 0, noCard = 0;
const fixable = [];
for (const b of poolNoCost) {
  const e = inv.items[b];
  let nm = bcToNm.get(String(b)); let how = nm ? 'bc' : '';
  if (!nm && e.vendorCode) { nm = vcToNm.get(e.vendorCode); if (nm) how = 'vc'; }
  if (!nm) { noCard++; continue; }
  if (how === 'bc') mapByBc++; else mapByVc++;
  if (sheetNm.has(nm)) { inSheet++; fixable.push(`nm${nm} via ${how} bc${b} ${(e.title || '').slice(0, 32)}`); }
}
console.log('пул без COGS:', poolNoCost.length);
console.log('  nmID по barcode:', mapByBc, '| по vendorCode:', mapByVc, '| карточки нет:', noCard);
console.log('  из них nmID ЕСТЬ в таблице (чинимо через vendorCode-маппинг):', inSheet);
console.log('--- примеры fixable ---');
console.log(fixable.slice(0, 20).join('\n'));

console.log('\n=== 67 позиций активного пула БЕЗ COGS (артикул WB + название) ===');
const rows = poolNoCost.map((b) => ({ nm: bcToNm.get(String(b)) ?? vcToNm.get(inv.items[b].vendorCode) ?? '?', title: inv.items[b].title || '', stock: inv.items[b].base }));
rows.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));
for (const r of rows) console.log(`${r.nm}\t${r.title}`);
