/**
 * Подкоманда `stocks` — сквозная синхронизация остатков WB↔Ozon↔ЯМ↔KIT через общий пул.
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
import { listKitVariants, listKitOffers, writeKitStock } from '../kit.js';
import { GUARD, SKIP_OZON } from '../config.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';
import type { StockChange } from '../types.js';

export async function runStocks(apply: boolean): Promise<void> {
  log(`=== stocks ${apply ? 'APPLY' : 'DRY-RUN'} ===`);

  // KIT читается первым и отдельно: его варианты нужны и заказам, и остаткам, а параллельных запросов KIT не держит.
  let kitVariants: Awaited<ReturnType<typeof listKitVariants>>;
  try {
    kitVariants = await listKitVariants();
  } catch (e) {
    log(`🔴 сверка пропущена: KIT не отдал варианты (${(e as Error).message.slice(0, 160)})`);
    await notify(alertBlock('🔴 Сверка остатков пропущена', ['Не удалось прочитать варианты KIT.', 'Остатки не тронуты. Следующая сверка через 30 минут.']));
    return;
  }
  const [wbItems, ozOffers, ymOffers, ordersRes] = await Promise.all([
    listWbInStock(true), // цены не нужны — не зависеть от лимита discounts-prices
    listOzonOffers(),
    listYmOffers(),
    collectOpenOrders(30, kitVariants),
  ]);
  const kitOffers = await listKitOffers(kitVariants);

  // Сбой тянучки заказов → НЕ синхронизируем вслепую (иначе можно обнулить из-за «нет заказов»).
  if (ordersRes.errors.length) {
    log(`🔴 сверка пропущена: не стянулись заказы (${ordersRes.errors.join(', ')})`);
    await notify(
      alertBlock('🔴 Сверка остатков пропущена', [
        `Не удалось получить заказы: ${ordersRes.errors.join(', ')}`,
        'Остатки не тронуты — это защита от выравнивания вслепую.',
        'Разовый сбой не страшен: следующая сверка через 30 минут. Повторяется — проверьте площадку.',
      ]),
    );
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

  const kitChanges: StockChange[] = [];
  for (const o of kitOffers) {
    const t = targetFor(o.key);
    if (o.available !== t) kitChanges.push({ mp: 'kit', key: o.key, was: o.available, becomes: t });
  }

  const total = wbChanges.length + ozChanges.length + ymChanges.length + kitChanges.length;
  log(`пул: WB-товаров ${wbItems.length}, заказов ${ordersRes.orders.length}, seed ${seeded}. К изменению: WB ${wbChanges.length}, Ozon ${ozChanges.length}, ЯМ ${ymChanges.length}, KIT ${kitChanges.length}`);
  if (ozSkipped) log(`  Ozon skip-list: пропущено ${ozSkipped} barcode (${SKIP_OZON.join(', ')})`);
  for (const ev of events.slice(0, 30)) log('  · ' + ev);

  // sanity-guard
  if (total > GUARD.stock_abort_if_changes_over) {
    log(`🔴 STOP: аномально много изменений (${total} > ${GUARD.stock_abort_if_changes_over}) — не применяю, леджер не сохраняю.`);
    await notify(
      alertBlock('🔴 Сверка остатков остановлена защитой', [
        `Слишком много изменений за раз: ${total} при лимите ${GUARD.stock_abort_if_changes_over} (WB ${wbChanges.length} · Ozon ${ozChanges.length} · ЯМ ${ymChanges.length} · KIT ${kitChanges.length}).`,
        'Ничего не применено. Обычно так бывает после долгого простоя или массовой правки остатков.',
        'Если изменения ожидаемы — запустить вручную: stocks --apply',
      ]),
    );
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
  preview('KIT', kitChanges);

  if (!apply) {
    log('dry-run: ничего не изменено, леджер не сохранён.');
    return;
  }

  // APPLY
  if (wbChanges.length) await writeWbStock(wbChanges.map((c) => ({ key: c.key, amount: c.becomes })));
  const ozRes = await writeOzonStock(ozChanges.map((c) => ({ key: c.key, amount: c.becomes })));
  const ymRes = await writeYmStock(ymChanges.map((c) => ({ key: c.key, amount: c.becomes })));
  let kitOk = 0;
  try {
    kitOk = (await writeKitStock(kitChanges.map((c) => ({ key: c.key, amount: c.becomes })), kitVariants)).ok;
  } catch (e) {
    log(`🟡 KIT не принял остатки: ${(e as Error).message.slice(0, 160)}`);
  }
  saveLedger(ledger);
  log(`applied: WB ${wbChanges.length}, Ozon ${ozRes.ok}/${ozChanges.length}, ЯМ ${ymRes.ok}/${ymChanges.length}, KIT ${kitOk}/${kitChanges.length}`);
  if (ozRes.errors.length) log('  Ozon ошибки: ' + ozRes.errors.slice(0, 8).join(', '));
  if (ymRes.notUpdated.length) log('  ЯМ notUpdated: ' + ymRes.notUpdated.slice(0, 8).join(', '));

  // сквозной алерт: товары, обнулённые/уменьшенные из-за продажи на ДРУГОМ МП.
  // Формат утв. 2026-07-19: название вместо баркода, группировка, остаток в строке.
  const crossRe = /^заказ (ozon|ym|kit) (\S+) −(\d+)$/;
  const grouped = new Map<string, { mp: string; bc: string; qty: number }>();
  for (const ev of events) {
    const m = ev.match(crossRe);
    if (!m) continue;
    const g = grouped.get(`${m[1]}:${m[2]}`) || { mp: m[1], bc: m[2], qty: 0 };
    g.qty += Number(m[3]);
    grouped.set(`${g.mp}:${g.bc}`, g);
  }
  if (grouped.size) {
    const MP: Record<string, string> = { ozon: 'Ozon', ym: 'ЯМ', kit: 'KIT' };
    const lines = [...grouped.values()].slice(0, 15).map((g) => {
      const it = ledger.items[g.bc];
      const name = (it?.title || g.bc).slice(0, 40);
      const left = it ? it.base : '?';
      return `${MP[g.mp]}: ${name} — ${g.qty} шт → остаток ${left}${it && it.base === 0 ? ' ❗️' : ''}`;
    });
    if (grouped.size > 15) lines.push(`… и ещё ${grouped.size - 15}`);
    lines.push('Остатки выровнены на всех площадках');
    await notify(alertBlock('🔁 Продажи, подхваченные сверкой (order-loop их пропустил)', lines));
  }
}
