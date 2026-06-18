/**
 * Тянет карточки (content API) + остатки (statistics stocks) через relay,
 * джойнит по nmID, оставляет остаток>0, выгружает наполнение для SEO.
 * Запуск: node src/pull-cards-stock.ts
 */
import { writeFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

loadEnv();
const proxy = await installProxy();
const token = env('WB_API_TOKEN');
if (!token) throw new Error('нет WB_API_TOKEN');
const H = { Authorization: token, 'Content-Type': 'application/json' };
console.log(`proxy: ${proxy ? 'ON' : 'OFF'}`);

// ---- 1. карточки (пагинация по cursor) ----
const cards: any[] = [];
let cursor: any = { limit: 100 };
for (let i = 0; i < 50; i++) {
  const body = { settings: { cursor, filter: { withPhoto: -1 } } };
  const r = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
    method: 'POST', headers: H, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`cards ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const batch = j.cards || [];
  cards.push(...batch);
  const total = j.cursor?.total ?? 0;
  process.stdout.write(`  карточки: +${batch.length} (всего ${cards.length})\n`);
  if (batch.length < 100 || total < 100) break;
  cursor = { limit: 100, updatedAt: j.cursor.updatedAt, nmID: j.cursor.nmID };
}

// ---- 2a. остатки FBO (statistics) ----
const stockByNm = new Map<number, number>();
const r2 = await fetch('https://statistics-api.wildberries.ru/api/v1/supplier/stocks?dateFrom=2020-01-01T00:00:00', { headers: { Authorization: token } });
if (r2.ok) {
  for (const s of await r2.json()) stockByNm.set(s.nmId, (stockByNm.get(s.nmId) || 0) + (Number(s.quantity) || 0));
}
const fboCount = [...stockByNm.values()].filter((q) => q > 0).length;

// ---- 2b. остатки FBS (marketplace) ----
// barcode -> nmID
const bcToNm = new Map<string, number>();
const allBc: string[] = [];
for (const c of cards) for (const sz of c.sizes || []) for (const sku of sz.skus || []) { bcToNm.set(String(sku), c.nmID); allBc.push(String(sku)); }
const whR = await fetch('https://marketplace-api.wildberries.ru/api/v3/warehouses', { headers: H });
const whs = whR.ok ? await whR.json() : [];
console.log(`  склады FBS: ${whs.map((w: any) => w.name).join(', ') || '—'}`);
for (const w of whs) {
  for (let i = 0; i < allBc.length; i += 1000) {
    const chunk = allBc.slice(i, i + 1000);
    const sr = await fetch(`https://marketplace-api.wildberries.ru/api/v3/stocks/${w.id}`, { method: 'POST', headers: H, body: JSON.stringify({ skus: chunk }) });
    if (!sr.ok) continue;
    const sj = await sr.json();
    for (const st of sj.stocks || []) {
      const nm = bcToNm.get(String(st.sku)); if (nm == null) continue;
      stockByNm.set(nm, (stockByNm.get(nm) || 0) + (Number(st.amount) || 0));
    }
  }
}
console.log(`  остатки: FBO nmID>0=${fboCount} | итого nmID с остатком>0: ${[...stockByNm.values()].filter((q) => q > 0).length}`);

// ---- 3. джойн, остаток>0 ----
const out = cards
  .map((c) => {
    const stock = stockByNm.get(c.nmID) || 0;
    const chars = (c.characteristics || []).map((ch: any) => ({ name: ch.name, value: ch.value }));
    const kw = (c.characteristics || []).find((ch: any) => /ключев|поиск/i.test(ch.name || ''));
    return {
      nmID: c.nmID, vendorCode: c.vendorCode, subjectName: c.subjectName, brand: c.brand,
      stock,
      title: c.title || '',
      titleLen: (c.title || '').length,
      description: c.description || '',
      descLen: (c.description || '').length,
      charsCount: chars.length,
      keywords: kw?.value ?? null,
      chars,
    };
  })
  .filter((c) => c.stock > 0)
  .sort((a, b) => b.stock - a.stock);

writeFileSync('/tmp/wb-cards-instock.json', JSON.stringify(out, null, 0));
console.log(`\nКарточек в наличии (>0): ${out.length}`);
console.log(`Сохранено: /tmp/wb-cards-instock.json\n`);
console.log('nmID | ост | назв.длина | опис.длина | хар-к | товар');
for (const c of out) {
  console.log(`${c.nmID} | ${String(c.stock).padStart(3)} | ${String(c.titleLen).padStart(3)} | ${String(c.descLen).padStart(4)} | ${String(c.charsCount).padStart(2)} | ${c.title.slice(0, 45)}`);
}
