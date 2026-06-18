/**
 * Фаза 2: дозаполнение характеристик. Полный объект карточки, title = уже залитый (title_new),
 * characteristics = существующие + добавления (по id). Канарейка → проверка принятых значений → все.
 * Режимы: dry | push [limit]
 */
import { readFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

const mode = process.argv[2] || 'dry';
const limit = process.argv[3] ? Number(process.argv[3]) : Infinity;
loadEnv();
await installProxy();
const token = env('WB_API_TOKEN')!;
const H = { Authorization: token, 'Content-Type': 'application/json' };

const full = new Map<number, any>(JSON.parse(readFileSync('/tmp/wb-cards-full.json', 'utf8')).map((c: any) => [c.nmID, c]));
const titleNew = new Map<number, string>(JSON.parse(readFileSync('/tmp/wb-seo-titles.json', 'utf8')).map((t: any) => [t.nmID, t.title_new]));
const additions = JSON.parse(readFileSync('/tmp/wb-char-additions.json', 'utf8')) as any[];

function buildPayload(a: any) {
  const c = full.get(a.nmID);
  const existing = (c.characteristics || []).map((ch: any) => ({ id: ch.id, value: ch.value }));
  const haveIds = new Set(existing.map((e: any) => e.id));
  const merged = [...existing];
  for (const add of a.adds) if (!haveIds.has(add.id)) merged.push({ id: add.id, value: add.value });
  return {
    nmID: c.nmID, vendorCode: c.vendorCode, brand: c.brand,
    title: titleNew.get(c.nmID) || c.title, // сохраняем уже залитое название
    description: c.description,
    dimensions: c.dimensions ? { length: c.dimensions.length, width: c.dimensions.width, height: c.dimensions.height } : undefined,
    characteristics: merged,
    sizes: (c.sizes || []).map((s: any) => ({ techSize: s.techSize, wbSize: s.wbSize, skus: s.skus, chrtID: s.chrtID })),
  };
}

const payloads = additions.map(buildPayload);
console.log(`Карточек с дозаполнением: ${payloads.length} (режим ${mode}${isFinite(limit) ? `, limit ${limit}` : ''})`);

if (mode === 'dry') {
  const p = payloads[0];
  console.log(`\nПример (nmID ${p.nmID}): title сохранён = "${p.title}"`);
  console.log('Характеристики после мёржа:', JSON.stringify(p.characteristics));
  process.exit(0);
}

const batch = payloads.slice(0, isFinite(limit) ? limit : payloads.length);
for (let i = 0; i < batch.length; i += 50) {
  const chunk = batch.slice(i, i + 50);
  const r = await fetch('https://content-api.wildberries.ru/content/v2/cards/update', { method: 'POST', headers: H, body: JSON.stringify(chunk) });
  console.log(`  чанк ${i / 50 + 1}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
}

// проверка: перечитать обработанные карточки, сверить что добавленные id присутствуют с нашими значениями
console.log('\nЖду 10 сек, перечитываю и проверяю принятые значения...');
await new Promise((res) => setTimeout(res, 10000));
const want = new Map(additions.filter((a) => batch.some((b) => b.nmID === a.nmID)).map((a) => [a.nmID, a.adds]));
const cards: any[] = [];
let cursor: any = { limit: 100 };
for (let i = 0; i < 50; i++) {
  const r = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', { method: 'POST', headers: H, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) });
  const j = await r.json(); const b = j.cards || []; cards.push(...b);
  if (b.length < 100) break; cursor = { limit: 100, updatedAt: j.cursor.updatedAt, nmID: j.cursor.nmID };
}
let okAll = 0, dropped = 0;
for (const c of cards) {
  if (!want.has(c.nmID)) continue;
  const cur = new Map((c.characteristics || []).map((ch: any) => [ch.id, JSON.stringify(ch.value)]));
  for (const add of want.get(c.nmID)!) {
    const got = cur.get(add.id);
    if (got != null) okAll++;
    else { dropped++; console.log(`   ⚠ ${c.nmID} «${add.name}» НЕ принят (id ${add.id})`); }
  }
}
console.log(`\nПринято значений: ${okAll} | отброшено: ${dropped}`);
