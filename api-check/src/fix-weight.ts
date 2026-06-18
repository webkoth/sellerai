/**
 * ФИКС РЕГРЕССА: вернуть dimensions.weightBrutto, который был потерян при обновлении карточек.
 * Берём ТЕКУЩЕЕ состояние карточек (новые названия+характеристики) и подставляем вес из исходника.
 * Режимы: dry | push
 */
import { readFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

const mode = process.argv[2] || 'dry';
loadEnv();
await installProxy();
const token = env('WB_API_TOKEN')!;
const H = { Authorization: token, 'Content-Type': 'application/json' };

// исходный вес по nmID
const orig = JSON.parse(readFileSync('/tmp/wb-cards-full.json', 'utf8')) as any[];
const wMap = new Map<number, number>();
for (const c of orig) { const w = c.dimensions?.weightBrutto; if (w) wMap.set(c.nmID, w); }
console.log(`Исходных весов: ${wMap.size}`);

// текущее состояние карточек
const cur: any[] = [];
let cursor: any = { limit: 100 };
for (let i = 0; i < 50; i++) {
  const r = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', { method: 'POST', headers: H, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) });
  const j = await r.json(); const b = j.cards || []; cur.push(...b);
  if (b.length < 100) break; cursor = { limit: 100, updatedAt: j.cursor.updatedAt, nmID: j.cursor.nmID };
}

// строим payload только для тех, кому нужно вернуть вес (сейчас weightBrutto пуст/0, а исходный есть)
const payloads = cur
  .filter((c) => wMap.has(c.nmID) && !(c.dimensions?.weightBrutto > 0))
  .map((c) => ({
    nmID: c.nmID, vendorCode: c.vendorCode, brand: c.brand,
    title: c.title, description: c.description,
    dimensions: { length: c.dimensions.length, width: c.dimensions.width, height: c.dimensions.height, weightBrutto: wMap.get(c.nmID) },
    characteristics: (c.characteristics || []).map((ch: any) => ({ id: ch.id, value: ch.value })),
    sizes: (c.sizes || []).map((s: any) => ({ techSize: s.techSize, wbSize: s.wbSize, skus: s.skus, chrtID: s.chrtID })),
  }));
console.log(`Карточек без веса (к фиксу): ${payloads.length}`);

if (mode === 'dry') {
  const p = payloads[0];
  if (p) console.log('Пример dimensions:', JSON.stringify(p.dimensions), '| title сохранён:', p.title.slice(0, 40));
  process.exit(0);
}

for (let i = 0; i < payloads.length; i += 50) {
  const chunk = payloads.slice(i, i + 50);
  const r = await fetch('https://content-api.wildberries.ru/content/v2/cards/update', { method: 'POST', headers: H, body: JSON.stringify(chunk) });
  console.log(`  чанк ${i / 50 + 1}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
}
// проверка
console.log('Жду 10с, перечитываю и проверяю вес...');
await new Promise((res) => setTimeout(res, 10000));
const chk: any[] = []; cursor = { limit: 100 };
for (let i = 0; i < 50; i++) {
  const r = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', { method: 'POST', headers: H, body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } }) });
  const j = await r.json(); const b = j.cards || []; chk.push(...b);
  if (b.length < 100) break; cursor = { limit: 100, updatedAt: j.cursor.updatedAt, nmID: j.cursor.nmID };
}
const stillEmpty = chk.filter((c) => wMap.has(c.nmID) && !(c.dimensions?.weightBrutto > 0));
console.log(`Без веса после фикса: ${stillEmpty.length} (было ${payloads.length})`);
