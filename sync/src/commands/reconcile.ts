/**
 * Подкоманда `reconcile` — health-сводка синка в Telegram (без мутаций).
 * Считает рассинхрон остатков, отсутствующие карточки, состояние пула, сбои тянучки.
 */
import { listWbInStock, listOzonOffers, listYmOffers, collectOpenOrders } from '../clients.js';
import { loadLedger, reconcile } from '../inventory.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';

export async function runReconcile(): Promise<void> {
  log('=== reconcile (health) ===');
  const [wb, oz, ym, ord] = await Promise.all([listWbInStock(true), listOzonOffers(), listYmOffers(), collectOpenOrders()]);

  // прогон пула в памяти (клон леджера — без сохранения), чтобы получить актуальный available
  const ledger = loadLedger();
  const { available } = reconcile(structuredClone(ledger), wb, ord.orders);

  const vendorToBarcode = new Map<string, string>();
  for (const it of wb) if (it.vendorCode) vendorToBarcode.set(it.vendorCode, it.barcode);
  const targetFor = (k: string): number => (available.has(k) ? available.get(k)! : available.get(vendorToBarcode.get(k) || '') ?? 0);

  const ozMis = oz.filter((o) => o.available !== targetFor(o.key)).length;
  const ymMis = ym.filter((o) => o.available !== targetFor(o.key)).length;
  const ozKeys = new Set(oz.map((o) => o.key));
  const ymKeys = new Set(ym.map((o) => o.key));
  const missOz = wb.filter((it) => !ozKeys.has(it.barcode) && !ozKeys.has(it.vendorCode)).length;
  // ЯМ: офферы нового магазина (2026-07-19) заведены по артикулам — проверяем оба ключа
  const missYm = wb.filter((it) => !ymKeys.has(it.barcode) && !ymKeys.has(it.vendorCode)).length;
  const baseTotal = [...available.values()].reduce((s, v) => s + v, 0);
  const zeroItems = [...available.values()].filter((v) => v === 0).length;

  // подробности — в лог; в TG — вердикт и только реальные проблемы (формат утв. 2026-07-19)
  log(
    `WB в наличии: ${wb.length} (ед. в пуле: ${baseTotal}, нулевых: ${zeroItems}) | ` +
      `Ozon: офферов ${oz.length}, рассинхрон ${ozMis}, без карточки ${missOz} | ` +
      `ЯМ: офферов ${ym.length}, рассинхрон ${ymMis}, без карточки ${missYm} | заказов 30д: ${ord.orders.length}`,
  );
  const problems: string[] = [];
  if (ozMis) problems.push(`Ozon: неверный остаток у ${ozMis} товаров`);
  if (missOz) problems.push(`Ozon: нет карточки у ${missOz} товаров`);
  if (ymMis) problems.push(`ЯМ: неверный остаток у ${ymMis} товаров`);
  if (missYm) problems.push(`ЯМ: нет карточки у ${missYm} товаров`);
  if (ord.errors.length) problems.push(`⚠ сбой чтения заказов: ${ord.errors.join(', ')}`);
  const ok = problems.length === 0;
  const lines = [`В наличии: ${wb.length} товара (${baseTotal} шт)`];
  lines.push(...(ok ? ['Ozon и ЯМ: остатки и карточки сходятся'] : problems));
  lines.push(`Заказов за 30 дней: ${ord.orders.length}`);
  if (!ok) lines.push('Что делать: расхождения остатков выровняет ближайший тик stocks; по карточкам — создать вручную');
  await notify(alertBlock(ok ? '📊 Синхронизация: всё в порядке ✅' : '📊 Синхронизация: есть расхождения ⚠️', lines));
}
