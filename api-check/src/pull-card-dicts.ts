/**
 * Тянет ПОЛНУЮ структуру карточек в наличии + справочники характеристик по предметам.
 * Нужно для валидной перезаписи карточек (wb cards/update — полный объект).
 * Запуск: node src/pull-card-dicts.ts
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { loadEnv, installProxy, env } from './lib.ts';

loadEnv();
await installProxy();
const token = env('WB_API_TOKEN')!;
const H = { Authorization: token, 'Content-Type': 'application/json' };

// nmID в наличии
const instock = JSON.parse(readFileSync('/tmp/wb-cards-instock.json', 'utf8')) as any[];
const wantNm = new Set(instock.map((c) => c.nmID));

// полная выгрузка карточек
const full: any[] = [];
let cursor: any = { limit: 100 };
for (let i = 0; i < 50; i++) {
  const body = { settings: { cursor, filter: { withPhoto: -1 } } };
  const r = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', { method: 'POST', headers: H, body: JSON.stringify(body) });
  const j = await r.json();
  const batch = j.cards || [];
  for (const c of batch) if (wantNm.has(c.nmID)) full.push(c);
  if (batch.length < 100) break;
  cursor = { limit: 100, updatedAt: j.cursor.updatedAt, nmID: j.cursor.nmID };
}
writeFileSync('/tmp/wb-cards-full.json', JSON.stringify(full, null, 0));
console.log(`Полных карточек в наличии: ${full.length}`);

// распределение по subjectID
const subj = new Map<number, { name: string; n: number }>();
for (const c of full) { const e = subj.get(c.subjectID) || { name: c.subjectName, n: 0 }; e.n++; subj.set(c.subjectID, e); }
console.log('Предметы:', [...subj.entries()].map(([id, e]) => `${id}=${e.name}(${e.n})`).join(', '));

// справочники характеристик по предметам
const dicts: Record<number, any> = {};
for (const [sid, e] of subj) {
  const r = await fetch(`https://content-api.wildberries.ru/content/v2/object/charcs/${sid}?locale=ru`, { headers: H });
  if (!r.ok) { console.log(`  charcs ${sid}: HTTP ${r.status}`); continue; }
  const j = await r.json();
  dicts[sid] = j.data || [];
  console.log(`\n=== ${e.name} (subjectID ${sid}) — характеристик: ${(j.data || []).length} ===`);
  for (const ch of j.data || []) {
    console.log(`  id=${ch.charcID} | ${ch.name}${ch.required ? ' *обяз' : ''} | тип=${ch.charcType} | maxCount=${ch.maxCount}${ch.unitName ? ' | ' + ch.unitName : ''}`);
  }
}
writeFileSync('/tmp/wb-charc-dicts.json', JSON.stringify(dicts, null, 0));
console.log('\nСохранено: /tmp/wb-cards-full.json, /tmp/wb-charc-dicts.json');
