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
  const [wb, oz, ym, ord] = await Promise.all([listWbInStock(), listOzonOffers(), listYmOffers(), collectOpenOrders()]);

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
  const missYm = wb.filter((it) => !ymKeys.has(it.barcode)).length;
  const baseTotal = [...available.values()].reduce((s, v) => s + v, 0);
  const zeroItems = [...available.values()].filter((v) => v === 0).length;

  const lines = [
    `WB в наличии: ${wb.length} (ед. в пуле: ${baseTotal}, нулевых позиций: ${zeroItems})`,
    `Ozon: офферов ${oz.length}, рассинхрон ${ozMis}, без карточки ${missOz}`,
    `ЯМ: офферов ${ym.length}, рассинхрон ${ymMis}, без карточки ${missYm}`,
    ord.errors.length ? `⚠ сбой тянучки заказов: ${ord.errors.join(', ')}` : `заказов за 30д: ${ord.orders.length}`,
  ];
  log(lines.join(' | '));
  await notify(alertBlock('📊 Reconcile · здоровье синка', lines));
}
