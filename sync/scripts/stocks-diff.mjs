/**
 * Полная сверка остатков WB↔Ozon↔ЯМ (read-only, леджер НЕ сохраняется, Telegram не трогается).
 * Показывает ВСЕ расхождения (dry-run `stocks` режет превью до 12 строк), недостающие карточки,
 * лишние офферы с остатком на зеркалах и риск двойного учёта после простоя
 * (WB-дельта < 0 и одновременно вычтен заказ Ozon/ЯМ по тому же баркоду).
 *
 *   node sync/scripts/stocks-diff.mjs [--json путь]
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const dist = (p) => pathToFileURL(resolve(ROOT, 'sync/dist', p)).href;

const { listOzonOffers, listYmOffers, collectOpenOrders } = await import(dist('clients.js'));
const { loadLedger, reconcile } = await import(dist('inventory.js'));
const { SKIP_OZON, GUARD } = await import(dist('config.js'));

const jsonArg = process.argv.indexOf('--json');
const jsonPath = jsonArg > 0 ? process.argv[jsonArg + 1] : null;

const { listWbInStockNoPrices } = await import(pathToFileURL(resolve(HERE, '_wb-instock-noprices.mjs')).href);

const [wb, oz, ym, ord] = await Promise.all([listWbInStockNoPrices(), listOzonOffers(), listYmOffers(), collectOpenOrders()]);
if (ord.errors.length) console.log(`⚠ сбой чтения заказов: ${ord.errors.join(', ')} — пул считается без них!`);

const ledger = loadLedger();
const ledgerUpdated = ledger._meta?.updated;
const { available, events, seeded } = reconcile(structuredClone(ledger), wb, ord.orders);

const wbByBc = new Map(wb.map((it) => [it.barcode, it]));
const vendorToBarcode = new Map();
for (const it of wb) if (it.vendorCode) vendorToBarcode.set(it.vendorCode, it.barcode);
for (const [bc, e] of Object.entries(ledger.items)) if (e.vendorCode) vendorToBarcode.set(e.vendorCode, bc);
const bcOf = (key) => (available.has(key) ? key : vendorToBarcode.get(key) ?? null);
const targetFor = (key) => {
  const bc = bcOf(key);
  return bc !== null && available.has(bc) ? available.get(bc) : 0;
};
const titleOf = (key) => {
  const bc = bcOf(key) ?? key;
  return (wbByBc.get(bc)?.title || ledger.items[bc]?.title || '').slice(0, 45);
};

// --- расхождения ---
const wbChanges = [];
for (const [bc, target] of available) {
  const cur = wbByBc.get(bc)?.stock ?? 0;
  if (cur !== target) wbChanges.push({ mp: 'wb', key: bc, was: cur, becomes: target, title: titleOf(bc) });
}
const skip = new Set(SKIP_OZON);
const ozChanges = [];
for (const o of oz) {
  if (skip.has(o.key) || skip.has(vendorToBarcode.get(o.key) || '')) continue;
  const t = targetFor(o.key);
  if (o.available !== t) ozChanges.push({ mp: 'ozon', key: o.key, was: o.available, becomes: t, title: titleOf(o.key), inWb: bcOf(o.key) !== null });
}
const ymChanges = [];
for (const o of ym) {
  const t = targetFor(o.key);
  if (o.available !== t) ymChanges.push({ mp: 'ym', key: o.key, was: o.available, becomes: t, title: titleOf(o.key), inWb: bcOf(o.key) !== null });
}

// --- карточки ---
const ozKeys = new Set(oz.map((o) => o.key));
const ymKeys = new Set(ym.map((o) => o.key));
const missOz = wb.filter((it) => !ozKeys.has(it.barcode) && !ozKeys.has(it.vendorCode));
const missYm = wb.filter((it) => !ymKeys.has(it.barcode) && !ymKeys.has(it.vendorCode));

// --- риск двойного учёта ---
const deltaNeg = new Map();
const orderSub = new Map();
for (const ev of events) {
  let m = ev.match(/^(\S+) WB-дельта (-\d+)$/);
  if (m) deltaNeg.set(m[1], Number(m[2]));
  m = ev.match(/^заказ (ozon|ym) (\S+) −(\d+)$/);
  if (m) orderSub.set(m[2], (orderSub.get(m[2]) || 0) + Number(m[3]));
}
const doubleRisk = [...orderSub.keys()].filter((bc) => deltaNeg.has(bc)).map((bc) => ({
  bc, title: titleOf(bc), wbDelta: deltaNeg.get(bc), ordersSubtracted: orderSub.get(bc),
  wbNow: wbByBc.get(bc)?.stock ?? 0, target: available.get(bc),
}));

// --- вывод ---
const poolUnits = [...available.values()].reduce((s, v) => s + v, 0);
const total = wbChanges.length + ozChanges.length + ymChanges.length;
console.log(`Леджер: ${ledgerUpdated} · WB в наличии: ${wb.length} товаров (${wb.reduce((s, i) => s + i.stock, 0)} шт) · пул: ${poolUnits} шт, seed ${seeded} · заказов 30д: ${ord.orders.length}`);
console.log(`Ozon офферов: ${oz.length} (с остатком ${oz.filter((o) => o.available > 0).length}) · ЯМ офферов: ${ym.length} (с остатком ${ym.filter((o) => o.available > 0).length})`);
console.log(`К изменению: WB ${wbChanges.length} · Ozon ${ozChanges.length} · ЯМ ${ymChanges.length} · всего ${total} (guard ${GUARD.stock_abort_if_changes_over})\n`);

const dump = (label, ch) => {
  if (!ch.length) return;
  console.log(`[${label}] ${ch.length}:`);
  for (const c of ch) console.log(`  ${c.key.padEnd(18)} ${String(c.was).padStart(3)} → ${String(c.becomes).padEnd(3)} ${c.inWb === false ? '(нет в WB-наличии) ' : ''}${c.title}`);
  console.log();
};
dump('WB', wbChanges);
dump('OZON', ozChanges);
dump('ЯМ', ymChanges);

console.log(`Нет карточки на Ozon: ${missOz.length}`);
for (const it of missOz) console.log(`  ${it.barcode} ${it.vendorCode.padEnd(18)} сток ${it.stock}  ${(it.title || '').slice(0, 50)}`);
console.log(`\nНет карточки на ЯМ: ${missYm.length}`);
for (const it of missYm) console.log(`  ${it.barcode} ${it.vendorCode.padEnd(18)} сток ${it.stock}  ${(it.title || '').slice(0, 50)}`);

console.log(`\nСобытия пула (${events.length}):`);
for (const ev of events) console.log('  · ' + ev);

console.log(`\nРиск двойного учёта: ${doubleRisk.length}`);
for (const r of doubleRisk) console.log(`  ${r.bc} WB-дельта ${r.wbDelta}, вычтено заказов ${r.ordersSubtracted}, WB сейчас ${r.wbNow} → цель ${r.target}  ${r.title}`);

if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify({ ledgerUpdated, wb, oz, ym, orders: ord.orders, wbChanges, ozChanges, ymChanges, missOz, missYm, events, doubleRisk }, null, 2));
  console.log(`\nJSON → ${jsonPath}`);
}
