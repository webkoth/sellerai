/**
 * Заливка SEO-названий в WB (content cards/update). Полный объект карточки, меняем только title.
 * Режимы:  node src/push-titles.ts dry            — собрать и показать payload (без записи)
 *          node src/push-titles.ts push 1         — залить первые N (канарейка)
 *          node src/push-titles.ts push           — залить все
 * После push — проверка /content/v2/cards/error/list.
 */
import { readFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

const mode = process.argv[2] || 'dry';
const limit = process.argv[3] ? Number(process.argv[3]) : Infinity;
loadEnv();
await installProxy();
const token = env('WB_API_TOKEN')!;
const H = { Authorization: token, 'Content-Type': 'application/json' };

const full = JSON.parse(readFileSync('/tmp/wb-cards-full.json', 'utf8')) as any[];
const titles = JSON.parse(readFileSync('/tmp/wb-seo-titles.json', 'utf8')) as any[];
const newTitle = new Map<number, string>(titles.map((t) => [t.nmID, t.title_new]));

// собираем update-объекты: полный объект, меняем только title
const payloads = full
  .filter((c) => newTitle.has(c.nmID) && newTitle.get(c.nmID) !== c.title)
  .map((c) => ({
    nmID: c.nmID,
    vendorCode: c.vendorCode,
    brand: c.brand,
    title: newTitle.get(c.nmID),
    description: c.description,
    dimensions: c.dimensions ? { length: c.dimensions.length, width: c.dimensions.width, height: c.dimensions.height } : undefined,
    characteristics: (c.characteristics || []).map((ch: any) => ({ id: ch.id, value: ch.value })),
    sizes: (c.sizes || []).map((s: any) => ({ techSize: s.techSize, wbSize: s.wbSize, skus: s.skus, chrtID: s.chrtID })),
  }));

console.log(`Карточек к обновлению: ${payloads.length} (режим: ${mode}${isFinite(limit) ? `, limit ${limit}` : ''})`);

if (mode === 'dry') {
  const p = payloads[0];
  console.log('\nПример payload (1-я карточка):');
  console.log(JSON.stringify({ ...p, description: (p.description || '').slice(0, 60) + '…' }, null, 2));
  console.log(`\nХарактеристик в объекте: ${p.characteristics.length} | размеров: ${p.sizes.length}`);
  console.log('Запуск заливки: node src/push-titles.ts push 1   (канарейка)');
} else if (mode === 'push') {
  const batch = payloads.slice(0, isFinite(limit) ? limit : payloads.length);
  // WB cards/update: до 3000 объектов, шлём чанками по 50
  let ok = 0;
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50);
    const r = await fetch('https://content-api.wildberries.ru/content/v2/cards/update', { method: 'POST', headers: H, body: JSON.stringify(chunk) });
    const txt = await r.text();
    console.log(`  чанк ${i / 50 + 1}: HTTP ${r.status} ${txt.slice(0, 200)}`);
    if (r.ok) ok += chunk.length;
  }
  console.log(`\nОтправлено: ${ok}/${batch.length}. Жду 8 сек и проверяю ошибки...`);
  await new Promise((res) => setTimeout(res, 8000));
  const er = await fetch('https://content-api.wildberries.ru/content/v2/cards/error/list?locale=ru', { headers: H });
  if (er.ok) {
    const ej = await er.json();
    const errs = ej.data || [];
    const mine = errs.filter((e: any) => batch.some((b) => b.vendorCode === e.vendorCode));
    console.log(`Ошибок в очереди (по нашим артикулам): ${mine.length}`);
    for (const e of mine.slice(0, 20)) console.log(`  ${e.vendorCode}: ${(e.errors || []).join('; ')}`);
  } else {
    console.log(`error/list: HTTP ${er.status}`);
  }
}
