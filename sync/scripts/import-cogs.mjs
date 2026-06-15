/**
 * Разовый импорт себестоимости (COGS) из data/cogs-source.tsv в data/state/costs.json.
 * Ключ таблицы — Артикул WB (nmID); costs.json ключуется по barcode → маппим через карточки WB.
 *
 *   node sync/scripts/import-cogs.mjs           # dry-run: показать маппинг и нестыковки
 *   node sync/scripts/import-cogs.mjs --apply   # записать в costs.json (+ аудит-лог)
 *
 * Работает из любого места: пути считаются от расположения скрипта.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));   // .../sync/scripts
const ROOT = resolve(HERE, '../..');                    // корень репозитория
const APPLY = process.argv.includes('--apply');

dotenvConfig({ path: resolve(ROOT, '.env') });

// dynamic import ПОСЛЕ загрузки .env — токены читаются в рантайме
const { getCards } = await import(pathToFileURL(resolve(ROOT, 'mcp/wb-mcp/dist/tools/cards.js')).href);
const { loadCosts, setCost, saveCosts } = await import(pathToFileURL(resolve(ROOT, 'sync/dist/costs.js')).href);

// --- читаем TSV (nmid\tcost\tname) ---
const tsv = readFileSync(resolve(ROOT, 'data/cogs-source.tsv'), 'utf8').trim().split('\n');
tsv.shift(); // header
const costByNm = new Map();
for (const line of tsv) {
  const [nm, cost, name] = line.split('\t');
  if (!nm) continue;
  costByNm.set(Number(nm), { cost: Number(cost), name: (name || '').trim() });
}

// --- карточки WB: nmID -> barcodes ---
const { cards } = await getCards({ limit: 1000 });
const nmToCard = new Map();
for (const c of cards) {
  const barcodes = (c.sizes || []).flatMap((s) => s.skus || []).filter(Boolean);
  nmToCard.set(c.nmId, { barcodes, vendorCode: c.vendorCode, title: c.title });
}

// --- сопоставление ---
const catalog = loadCosts();
const matched = [];
const unmatched = [];
let applied = 0;
for (const [nm, { cost, name }] of costByNm) {
  const card = nmToCard.get(nm);
  if (!card || card.barcodes.length === 0) { unmatched.push({ nm, name, cost }); continue; }
  matched.push({ nm, cost, title: card.title || name, barcodes: card.barcodes });
  if (APPLY) {
    for (const bc of card.barcodes) {
      setCost(catalog, bc, cost, { source: 'gsheet:cogs', note: (card.title || name).slice(0, 48) });
      applied++;
    }
  }
}
if (APPLY) saveCosts(catalog);

// карточки без себестоимости (есть в WB, нет в таблице)
const tsvNms = new Set(costByNm.keys());
const stillMissing = cards.filter((c) => !tsvNms.has(c.nmId) && (c.sizes || []).some((s) => (s.skus || []).length)).map((c) => ({ nm: c.nmId, title: c.title }));

console.log('=== COGS import ' + (APPLY ? '(APPLY)' : '(dry-run)') + ' ===');
console.log(`карточек WB: ${cards.length} | строк в таблице: ${costByNm.size}`);
console.log(`сопоставлено: ${matched.length} | barcode записано: ${applied}`);
console.log(`НЕ найдено в карточках WB: ${unmatched.length}`);
for (const u of unmatched) console.log(`  ✗ nmID ${u.nm} (${u.cost}₽) ${u.name}`);
console.log(`карточек БЕЗ себестоимости (нет в таблице): ${stillMissing.length}`);
for (const m of stillMissing) console.log(`  · nmID ${m.nm} ${(m.title || '').slice(0, 50)}`);
