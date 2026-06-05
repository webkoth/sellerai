/**
 * Подкоманда `cards` — авто-создание недостающих карточек (in-stock WB, которых нет на площадке).
 * Ozon: клон-шаблон + import + попытка остатка. ЯМ: offer-mappings + цена + остаток.
 * Остаток новых Ozon-карточек может встать не сразу (модерация) — добьёт `stocks`.
 */
import { buildOzonCards } from '../cards-ozon.js';
import { buildYmCards } from '../cards-ym.js';
import { listWbInStock, ozImport, ozImportInfo, writeOzonStock, ymUpsertOffer, ymSetPrice, writeYmStock } from '../clients.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function runCards(apply: boolean): Promise<void> {
  log(`=== cards ${apply ? 'APPLY' : 'DRY-RUN'} ===`);
  const wbItems = await listWbInStock();
  const wbQty = new Map(wbItems.map((it) => [it.barcode, it.stock]));

  const { payloads } = await buildOzonCards();
  const { offers, businessId } = await buildYmCards();
  log(`к созданию: Ozon ${payloads.length}, ЯМ ${offers.length}`);

  if (!apply) {
    for (const p of payloads.slice(0, 10)) log(`  [Ozon] ${p.offer_id} ${p.name.slice(0, 40)}`);
    for (const o of offers.slice(0, 10)) log(`  [ЯМ] ${o.offer.offerId} ${o.offer.name.slice(0, 40)}`);
    log('dry-run: ничего не создано');
    return;
  }

  const created: string[] = [];
  const failed: string[] = [];

  // ----- OZON -----
  if (payloads.length) {
    const items = payloads.map(({ _wb, ...i }) => i);
    const taskId = await ozImport(items);
    if (!taskId) {
      failed.push('Ozon: import не вернул task_id');
    } else {
      for (let i = 0; i < 9; i++) {
        await sleep(6000);
        const info = await ozImportInfo(taskId);
        const its = info.result?.items || [];
        const done = its.filter((x: any) => x.status === 'imported');
        const err = its.filter((x: any) => (x.errors || []).some((e: any) => e.level === 'error'));
        if (done.length + err.length >= its.length) {
          for (const x of done) created.push(`Ozon ${x.offer_id}`);
          for (const x of err) failed.push(`Ozon ${x.offer_id}: ${(x.errors || []).filter((e: any) => e.level === 'error').map((e: any) => e.code).join(',')}`);
          break;
        }
      }
      // попытка остатка (часть встанет позже — добьёт stocks-reconcile)
      await writeOzonStock(payloads.map((p) => ({ key: p.offer_id, amount: wbQty.get(p.offer_id) ?? 1 })));
    }
  }

  // ----- ЯМ -----
  for (const o of offers) {
    try {
      await ymUpsertOffer(businessId, o.offer);
      const price = Math.ceil((o._price.finalP * o._price.k) / 10) * 10;
      let discountBase: number | undefined = o._price.baseP > o._price.finalP ? Math.ceil((o._price.baseP * o._price.k) / 10) * 10 : undefined;
      if (discountBase && (discountBase - price) / discountBase < 0.01) discountBase = undefined; // ЯМ требует скидку 1-99%
      await sleep(1500);
      await ymSetPrice(businessId, o.offer.offerId, price, discountBase);
      await writeYmStock([{ key: o.offer.offerId, amount: wbQty.get(o.offer.offerId) ?? 1 }]);
      created.push(`ЯМ ${o.offer.offerId}`);
    } catch (e) {
      failed.push(`ЯМ ${o.offer.offerId}: ${(e as Error).message}`);
    }
  }

  log(`создано: ${created.length}, ошибок: ${failed.length}`);
  if (created.length || failed.length) {
    const lines = created.slice(0, 15).map((c) => '✅ ' + c);
    if (failed.length) lines.push(...failed.slice(0, 10).map((f) => '❌ ' + f));
    await notify(alertBlock('🆕 Авто-создание карточек', lines));
  }
}
