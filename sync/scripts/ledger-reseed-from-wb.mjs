/**
 * Пересев леджера пула от WB после долгого простоя синка.
 *
 * Зачем: движок считает base' = base + (WB − wbBaseline) − новые заказы Ozon/ЯМ. Если синк стоял,
 * а клиент вручную снимал остаток на WB после продаж на Ozon/ЯМ, то и WB-дельта, и заказ вычтутся —
 * двойной учёт (пример 03.09.2026: «Вершитель» WB 2 → цель 1). Правило бизнеса: WB — единственный
 * источник правды, поэтому после простоя леджер приводится к WB:
 *   base = wbBaseline = текущий WB-сток; все видимые заказы Ozon/ЯМ (окно 30 дн) помечаются учтёнными;
 *   позиции, которых нет в WB-наличии, → 0.
 * WB-заказы помечать не нужно: первый `stocks` пометит их сам (wbByBc), не вычитая.
 *
 * Порядок восстановления: reseed --apply → stocks --apply (Ozon/ЯМ = WB) → включить кроны.
 *
 *   node sync/scripts/ledger-reseed-from-wb.mjs            # dry-run
 *   node sync/scripts/ledger-reseed-from-wb.mjs --apply    # записать леджер (бэкап рядом: inventory.json.bak-<ts>)
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const dist = (p) => pathToFileURL(resolve(ROOT, 'sync/dist', p)).href;

const { collectOpenOrders } = await import(dist('clients.js'));
const { loadLedger, saveLedger } = await import(dist('inventory.js'));
const { LEDGER_PATH } = await import(dist('config.js'));
const { costsMap } = await import(dist('costs.js'));
const { listWbInStockNoPrices } = await import(pathToFileURL(resolve(HERE, '_wb-instock-noprices.mjs')).href);

const APPLY = process.argv.includes('--apply');
// --no-wb-orders: не трогать statistics-api /supplier/orders (лимит 1 запрос, штрафное окно растёт с каждым 429).
// WB-заказы пересеву не нужны — их пометит первый `stocks`. Берём только Ozon/ЯМ напрямую из MCP-обёрток.
const NO_WB = process.argv.includes('--no-wb-orders');

async function collectOzonYmOrders() {
  const mcp = (p) => pathToFileURL(resolve(ROOT, 'mcp', p)).href;
  const { getOrders: ozGetOrders } = await import(mcp('ozon-mcp/dist/tools/orders.js'));
  const { getOrders: ymGetOrders } = await import(mcp('ym-mcp/dist/tools/orders.js'));
  const isCancelled = (s) => /cancel|отмен|reject|return|возврат/i.test(s || '');
  const orders = [];
  const errors = [];
  try {
    const oz = await ozGetOrders({ status: 'all', limit: 1000 });
    for (const o of oz.orders || []) for (const it of o.items || []) orders.push({ mp: 'ozon', orderId: `ozon:${o.postingNumber}:${it.offerId}`, key: String(it.offerId), qty: Number(it.quantity) || 1, consuming: !isCancelled(String(o.status)) });
  } catch { errors.push('ozon'); }
  try {
    const ym = await ymGetOrders({ limit: 200 });
    for (const o of ym.orders || []) for (const it of o.items || []) orders.push({ mp: 'ym', orderId: `ym:${o.id}:${it.offerId}`, key: String(it.offerId), qty: Number(it.quantity) || 1, consuming: !isCancelled(String(o.status)) });
  } catch { errors.push('ym'); }
  return { orders, errors };
}

const [wb, ord] = await Promise.all([listWbInStockNoPrices(), NO_WB ? collectOzonYmOrders() : collectOpenOrders(30)]);
if (ord.errors.some((e) => e !== 'wb')) { console.log(`STOP: не стянулись заказы ${ord.errors.join(', ')} — без них помечать нечего, пересев небезопасен.`); process.exit(2); }
if (ord.errors.length) console.log(`⚠ не стянулись заказы: ${ord.errors.join(', ')} (их id не будут помечены учтёнными${ord.errors.includes('wb') ? '; для WB это нормально — пометит первый stocks' : ''})`);

const ledger = loadLedger();
console.log(`Леджер: ${ledger._meta?.updated}, записей ${Object.keys(ledger.items).length} · WB в наличии ${wb.length} (${wb.reduce((s, i) => s + i.stock, 0)} шт)`);

const vendorToBarcode = new Map();
for (const it of wb) if (it.vendorCode) vendorToBarcode.set(it.vendorCode, it.barcode);
for (const [bc, e] of Object.entries(ledger.items)) if (e.vendorCode) vendorToBarcode.set(e.vendorCode, bc);
const known = new Set([...wb.map((i) => i.barcode), ...Object.keys(ledger.items)]);
const resolveKey = (k) => (known.has(k) ? k : vendorToBarcode.get(k) || null);

// заказы Ozon/ЯМ по barcode (только потребляющие — их и вычитает движок)
const ordersByBc = new Map();
for (const o of ord.orders) {
  if (o.mp === 'wb' || !o.consuming) continue;
  const bc = resolveKey(o.key);
  if (!bc) continue;
  const a = ordersByBc.get(bc) || [];
  a.push(o.orderId);
  ordersByBc.set(bc, a);
}

const costs = costsMap();
const now = new Date().toISOString();
const rows = [];
let changed = 0, marked = 0, zeroed = 0, created = 0;

const wbByBc = new Map(wb.map((i) => [i.barcode, i]));
for (const bc of known) {
  const it = wbByBc.get(bc);
  const stock = it?.stock ?? 0;
  let e = ledger.items[bc];
  const was = e ? e.base : null;
  if (!e) {
    e = { base: stock, wbBaseline: stock, appliedOrders: [], lastPushed: {}, title: it?.title, vendorCode: it?.vendorCode, category: it?.category, cost: costs.get(bc), updatedAt: now };
    ledger.items[bc] = e;
    created++;
  }
  const newIds = (ordersByBc.get(bc) || []).filter((id) => !e.appliedOrders.includes(id));
  if (was !== null && was !== stock) changed++;
  if (was !== null && was > 0 && stock === 0) zeroed++;
  marked += newIds.length;
  if (was !== stock || newIds.length) rows.push({ bc, title: (it?.title || e.title || '').slice(0, 45), was, stock, newIds });
  e.base = stock;
  e.wbBaseline = stock;
  e.appliedOrders.push(...newIds);
  if (it?.title) e.title = it.title;
  if (it?.vendorCode) e.vendorCode = it.vendorCode;
  if (it?.category) e.category = it.category;
  if (costs.has(bc)) e.cost = costs.get(bc);
  e.updatedAt = now;
}

console.log(`Изменится base у ${changed} позиций (в т.ч. обнулится ${zeroed}), новых записей ${created}, заказов Ozon/ЯМ помечено учтёнными: ${marked}\n`);
for (const r of rows) console.log(`  ${r.bc} ${String(r.was ?? '—').padStart(3)} → ${String(r.stock).padEnd(3)} ${r.newIds.length ? `+${r.newIds.length} заказ(ов) учтено ` : ''}${r.title}`);

if (!APPLY) {
  console.log('\ndry-run: леджер не записан. Запустить с --apply для записи.');
} else {
  if (existsSync(LEDGER_PATH)) {
    const bak = `${LEDGER_PATH}.bak-${now.replace(/[:.]/g, '-')}`;
    copyFileSync(LEDGER_PATH, bak);
    console.log(`\nбэкап: ${bak}`);
  }
  saveLedger(ledger);
  console.log(`леджер записан: ${LEDGER_PATH}`);
}
