/**
 * Подкоманда `stocks` — сквозная синхронизация остатков WB↔Ozon↔ЯМ через общий пул.
 * dry-run по умолчанию; --apply применяет. Sanity-guard на аномальное число изменений.
 */
import {
  listWbInStock,
  listOzonOffers,
  listYmOffers,
  collectOpenOrders,
  writeWbStock,
  writeOzonStock,
  writeYmStock,
} from '../clients.js';
import { loadLedger, saveLedger, reconcile } from '../inventory.js';
import { GUARD, SKIP_OZON } from '../config.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';
import type { StockChange } from '../types.js';

export async function runStocks(apply: boolean): Promise<void> {
  log(`=== stocks ${apply ? 'APPLY' : 'DRY-RUN'} ===`);

  const [wbItems, ozOffers, ymOffers, ordersRes] = await Promise.all([
    listWbInStock(),
    listOzonOffers(),
    listYmOffers(),
    collectOpenOrders(),
  ]);

  // Сбой тянучки заказов → НЕ синхронизируем вслепую (иначе можно обнулить из-за «нет заказов»).
  if (ordersRes.errors.length) {
    const msg = `Синхронизация остатков пропущена: не стянулись заказы (${ordersRes.errors.join(', ')}). Чтобы не обнулить вслепую.`;
    log('🔴 ' + msg);
    await notify(alertBlock('🔴 STOCKS прерван', [msg]));
    return;
  }

  const ledger = loadLedger();
  const { available, events, seeded } = reconcile(ledger, wbItems, ordersRes.orders);

  // карта offerId/vendorCode → barcode для офферов площадок
  const vendorToBarcode = new Map<string, string>();
  for (const it of wbItems) if (it.vendorCode) vendorToBarcode.set(it.vendorCode, it.barcode);
  for (const [bc, e] of Object.entries(ledger.items)) if (e.vendorCode) vendorToBarcode.set(e.vendorCode, bc);
  const targetFor = (key: string): number => {
    if (available.has(key)) return available.get(key)!;
    const bc = vendorToBarcode.get(key);
    return bc !== undefined && available.has(bc) ? available.get(bc)! : 0;
  };

  // diff по WB (мастер тоже выравниваем под пул)
  const wbCur = new Map(wbItems.map((it) => [it.barcode, it.stock]));
  const wbChanges: StockChange[] = [];
  for (const [bc, target] of available) {
    const cur = wbCur.get(bc) ?? 0;
    if (cur !== target) wbChanges.push({ mp: 'wb', key: bc, was: cur, becomes: target });
  }
  // diff по Ozon / ЯМ. skip-list — товары, заблокированные модерацией Ozon: не трогаем, остаются на WB+ЯМ
  const skipOzon = new Set<string>(SKIP_OZON);
  const isSkippedOzon = (key: string): boolean => skipOzon.has(key) || skipOzon.has(vendorToBarcode.get(key) || '');
  let ozSkipped = 0;
  const ozChanges: StockChange[] = [];
  for (const o of ozOffers) {
    if (isSkippedOzon(o.key)) {
      ozSkipped++;
      continue;
    }
    const t = targetFor(o.key);
    if (o.available !== t) ozChanges.push({ mp: 'ozon', key: o.key, was: o.available, becomes: t });
  }
  const ymChanges: StockChange[] = [];
  for (const o of ymOffers) {
    const t = targetFor(o.key);
    if (o.available !== t) ymChanges.push({ mp: 'ym', key: o.key, was: o.available, becomes: t });
  }

  const total = wbChanges.length + ozChanges.length + ymChanges.length;
  log(`пул: WB-товаров ${wbItems.length}, заказов ${ordersRes.orders.length}, seed ${seeded}. К изменению: WB ${wbChanges.length}, Ozon ${ozChanges.length}, ЯМ ${ymChanges.length}`);
  if (ozSkipped) log(`  Ozon skip-list: пропущено ${ozSkipped} barcode (${SKIP_OZON.join(', ')})`);
  for (const ev of events.slice(0, 30)) log('  · ' + ev);

  // sanity-guard
  if (total > GUARD.stock_abort_if_changes_over) {
    const msg = `аномально много изменений (${total} > ${GUARD.stock_abort_if_changes_over}) — НЕ применяю, леджер не сохраняю.`;
    log('🔴 STOP: ' + msg);
    await notify(alertBlock('🔴 STOCKS sanity-stop', [msg, `WB ${wbChanges.length} · Ozon ${ozChanges.length} · ЯМ ${ymChanges.length}`]));
    return;
  }

  const preview = (label: string, ch: StockChange[]): void => {
    if (!ch.length) return;
    log(`  [${label}] ${ch.length}:`);
    for (const c of ch.slice(0, 12)) log(`     ${c.key} ${c.was} → ${c.becomes}`);
    if (ch.length > 12) log(`     … и ещё ${ch.length - 12}`);
  };
  preview('WB', wbChanges);
  preview('OZON', ozChanges);
  preview('ЯМ', ymChanges);

  if (!apply) {
    log('dry-run: ничего не изменено, леджер не сохранён.');
    return;
  }

  // APPLY
  if (wbChanges.length) await writeWbStock(wbChanges.map((c) => ({ key: c.key, amount: c.becomes })));
  const ozRes = await writeOzonStock(ozChanges.map((c) => ({ key: c.key, amount: c.becomes })));
  const ymRes = await writeYmStock(ymChanges.map((c) => ({ key: c.key, amount: c.becomes })));
  saveLedger(ledger);
  log(`applied: WB ${wbChanges.length}, Ozon ${ozRes.ok}/${ozChanges.length}, ЯМ ${ymRes.ok}/${ymChanges.length}`);
  if (ozRes.errors.length) log('  Ozon ошибки: ' + ozRes.errors.slice(0, 8).join(', '));
  if (ymRes.notUpdated.length) log('  ЯМ notUpdated: ' + ymRes.notUpdated.slice(0, 8).join(', '));

  // сквозной алерт: товары, обнулённые/уменьшенные из-за продажи на ДРУГОМ МП
  const crossOrders = events.filter((e) => e.startsWith('заказ ozon') || e.startsWith('заказ ym'));
  if (crossOrders.length) {
    await notify(alertBlock('🔁 Сквозной пул: продажа на МП → синхронизация', crossOrders.slice(0, 20)));
  }
}
