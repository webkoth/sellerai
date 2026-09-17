/**
 * Пул остатков для Яндекс KIT — те же цифры, что получают Ozon и ЯМ (только чтение).
 *
 * Источник — FBS-остаток WB на нашем складе «Склад Краснодар» минус открытые заказы
 * Ozon и ЯМ (reconcile по леджеру). FBO-остаток на складах самого WB в пул не входит:
 * эти единицы физически лежат у WB и отправить их покупателю KIT нельзя.
 * Леджер не сохраняется, Telegram не трогается.
 *
 *   node sync/scripts/kit-pool.mjs <путь.json>
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const dist = (p) => pathToFileURL(resolve(ROOT, 'sync/dist', p)).href;

const { collectOpenOrders } = await import(dist('clients.js'));
const { loadLedger, reconcile } = await import(dist('inventory.js'));
const { listWbInStockNoPrices } = await import(pathToFileURL(resolve(HERE, '_wb-instock-noprices.mjs')).href);

const out = process.argv[2];
if (!out) { console.error('укажите путь для JSON'); process.exit(2); }

const [wb, ord] = await Promise.all([listWbInStockNoPrices(), collectOpenOrders()]);
if (ord.errors.length) console.log(`⚠ сбой чтения заказов: ${ord.errors.join(', ')} — пул считается без них`);

const ledger = loadLedger();
const { available, events } = reconcile(structuredClone(ledger), wb, ord.orders);

const wbByBc = new Map(wb.map((it) => [it.barcode, it]));
const items = [];
for (const [bc, amount] of available) {
  const w = wbByBc.get(bc);
  items.push({ barcode: bc, available: amount, wbStock: w?.stock ?? 0,
    vendorCode: w?.vendorCode ?? ledger.items[bc]?.vendorCode ?? null,
    title: (w?.title || ledger.items[bc]?.title || '').slice(0, 60) });
}
const units = items.reduce((s, i) => s + i.available, 0);
writeFileSync(out, JSON.stringify({ ledgerUpdated: ledger._meta?.updated, wbInStock: wb.length,
  openOrders: ord.orders.length, orderErrors: ord.errors, events, items }, null, 2));
console.log(`WB в наличии: ${wb.length} товаров · пул: ${items.length} позиций, ${units} шт · открытых заказов: ${ord.orders.length} · событий: ${events.length}`);
