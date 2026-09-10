/**
 * Подкоманда `cards` — авто-создание недостающих карточек (in-stock WB, которых нет на площадке).
 * Ozon: клон-шаблон + import + цена/min_price/запрет автоакций + остаток. ЯМ: offer-mappings + цена + остаток.
 * Остаток новых Ozon-карточек может встать не сразу (модерация) — добьёт `stocks`.
 *
 * 2026-09-04: один снимок WB (с ценами) на оба построителя; ключ карточки — артикул WB; цены v2;
 * dry-run печатает ВСЕ позиции с категорией и ценой + список пропущенных с причиной.
 * Ограничение по ключам: [barcode...] или [vendorCode...] после команды — создать только их.
 */
import { getProductsInStock } from '../../../mcp/wb-mcp/dist/tools/products-in-stock.js';
import { buildOzonCards } from '../cards-ozon.js';
import { buildYmCards } from '../cards-ym.js';
import { ozImport, ozImportInfo, writeOzonStock, writeOzonPrices, ymUpsertOffer, ymSetPrice, writeYmStock } from '../clients.js';
import { log } from '../log.js';
import { notify, alertBlock } from '../notify.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function runCards(apply: boolean, only: string[] = []): Promise<void> {
  log(`=== cards ${apply ? 'APPLY' : 'DRY-RUN'}${only.length ? ` (только ${only.length} ключей)` : ''} ===`);
  // цены обязательны (модель v2 считает от витринной WB) — при 429 discounts-prices команда честно падает
  const wb: any = await getProductsInStock({ minQuantity: 1 });
  const wbProducts: any[] = wb.products || [];
  const wbQty = new Map(wbProducts.map((it) => [String(it.barcode), Number(it.stock) || 0]));

  const skipped: string[] = [];
  const { payloads } = await buildOzonCards(wbProducts, { offerIds: only, skipped });
  const { offers, businessId } = await buildYmCards(wbProducts, { offerIds: only, skipped });
  log(`WB в наличии: ${wbProducts.length}. К созданию: Ozon ${payloads.length}, ЯМ ${offers.length}. Пропущено: ${skipped.length}`);

  if (!apply) {
    if (payloads.length) log('  [Ozon]');
    for (const p of payloads) {
      const w: any = p._wb || {};
      log(`    ${p.offer_id.padEnd(18)} ${String(w.stock).padStart(2)} шт  ${w.typeName || ''}  WB ${w.finalP} → ${p.price}/${p.old_price} (min ${w.minPrice})  ${p.name.slice(0, 45)}`);
    }
    if (offers.length) log('  [ЯМ]');
    for (const o of offers) {
      log(`    ${o.offer.offerId.padEnd(18)} ${String(o._wb.stock).padStart(2)} шт  ${o._wb.categoryName}  WB ${o._price.wbFinal} → ${o._price.value}/${o._price.discountBase}  ${o.offer.name.slice(0, 45)}`);
    }
    if (skipped.length) log('  [пропущено]');
    for (const s of skipped) log(`    ${s}`);
    log('dry-run: ничего не создано');
    return;
  }

  const created: Array<{ mp: string; name: string }> = [];
  const failed: Array<{ mp: string; name: string; err: string }> = [];

  // ----- OZON -----
  if (payloads.length) {
    const items = payloads.map(({ _wb, ...i }) => i);
    const taskId = await ozImport(items);
    if (!taskId) {
      failed.push({ mp: 'Ozon', name: 'импорт', err: 'import не вернул task_id' });
    } else {
      log(`Ozon import task ${taskId}, жду результата…`);
      const nameByOffer = new Map(payloads.map((p) => [p.offer_id, p.name] as const));
      let finished = false;
      for (let i = 0; i < 20 && !finished; i++) {
        await sleep(6000);
        const info = await ozImportInfo(taskId);
        const its = info.result?.items || [];
        const done = its.filter((x: any) => x.status === 'imported');
        const err = its.filter((x: any) => (x.errors || []).some((e: any) => e.level === 'error'));
        if (its.length && done.length + err.length >= its.length) {
          for (const x of done) created.push({ mp: 'Ozon', name: nameByOffer.get(x.offer_id) || x.offer_id });
          for (const x of err) failed.push({ mp: 'Ozon', name: nameByOffer.get(x.offer_id) || x.offer_id, err: (x.errors || []).filter((e: any) => e.level === 'error').map((e: any) => `${e.code}${e.message ? ':' + String(e.message).slice(0, 60) : ''}`).join(',') });
          finished = true;
        }
      }
      if (!finished) log('Ozon import: статус не финализировался за 2 мин — проверить в ЛК, остаток и цены добьёт stocks/повторный прогон');
      // цена v2 + min_price + запрет автоакций (как у остальных карточек кабинета, решение 2026-07-19)
      const okOffers = new Set(created.filter((c) => c.mp === 'Ozon').map((c) => c.name));
      const priceRows = payloads
        .filter((p) => okOffers.has(p.name))
        .map((p) => ({
          offer_id: p.offer_id, price: p.price, old_price: p.old_price, min_price: String((p._wb as any)?.minPrice || 0), vat: p.vat,
          min_price_for_auto_actions_enabled: true, auto_action_enabled: 'DISABLED', auto_add_to_ozon_actions_list_enabled: 'DISABLED',
        }));
      if (priceRows.length) {
        const pr = await writeOzonPrices(priceRows as any);
        log(`Ozon цены/min_price: ${pr.ok}/${priceRows.length}${pr.errors.length ? ' ошибки: ' + pr.errors.slice(0, 5).join('; ') : ''}`);
      }
      // попытка остатка (часть встанет позже — добьёт stocks-reconcile)
      const st = await writeOzonStock(payloads.map((p) => ({ key: p.offer_id, amount: wbQty.get(String((p._wb as any)?.barcode)) ?? 1 })));
      log(`Ozon остатки: ${st.ok}/${payloads.length}${st.errors.length ? ' ошибки: ' + st.errors.slice(0, 5).join('; ') : ''}`);
    }
  }

  // ----- ЯМ -----
  for (const o of offers) {
    try {
      await ymUpsertOffer(businessId, o.offer);
      await sleep(1500);
      const discountBase = o._price.discountBase > o._price.value ? o._price.discountBase : undefined;
      await ymSetPrice(businessId, o.offer.offerId, o._price.value, discountBase);
      await writeYmStock([{ key: o.offer.offerId, amount: wbQty.get(o._wb.barcode) ?? 1 }]);
      created.push({ mp: 'ЯМ', name: o.offer.name || o.offer.offerId });
    } catch (e) {
      failed.push({ mp: 'ЯМ', name: o.offer.name || o.offer.offerId, err: (e as Error).message });
    }
  }

  log(`создано: ${created.length}, ошибок: ${failed.length}, пропущено: ${skipped.length}`);
  for (const f of failed) log(`  ❌ ${f.mp} ${f.name.slice(0, 40)}: ${f.err.slice(0, 160)}`);
  // Формат утв. 2026-07-19: названия вместо артикулов, группировка по площадкам.
  if (created.length || failed.length) {
    const lines: string[] = [];
    for (const mp of ['Ozon', 'ЯМ']) {
      const c = created.filter((x) => x.mp === mp);
      if (c.length) lines.push(`${mp} (${c.length}): ${c.slice(0, 6).map((x) => x.name.slice(0, 32)).join(', ')}${c.length > 6 ? '…' : ''}`);
    }
    for (const f of failed.slice(0, 8)) lines.push(`❌ Не создалась: ${f.mp} — ${f.name.slice(0, 32)} (${f.err.slice(0, 60)})`);
    if (failed.length > 8) lines.push(`… и ещё ${failed.length - 8} ошибок (см. лог)`);
    if (created.length) lines.push('Проверьте новые карточки: категория и контент — по WB-мастеру');
    await notify(alertBlock('🆕 Созданы карточки на Ozon / Яндекс Маркете', lines));
  }
}
