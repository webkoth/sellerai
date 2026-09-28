// Запись остатка пула на сайт (этап 1.4 синка v2): PUT /api/internal/stocks через putSiteStocks.
import { errorText } from "@sync2/shared"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { putSiteStocks, SITE_PUT_MAX_ITEMS, type SiteCredentials, type SitePutResult } from "./client"

/** Начало текста отказа «штрихкода нет в каталоге сайта» — site-push-all считает такие отдельно. */
export const SITE_UNKNOWN_BARCODE = "сайт не знает штрихкод"

/**
 * Ключ сайта — сам штрихкод WB (у сайта каталог — копия WB). Сайт пишет pool_stocks одной
 * транзакцией на пачку; в STOCK_SOURCE=pool — и агрегат витрины (репозиторий сайта, этап 1.4).
 * `source` из ответа — в журнал: видно, влияла ли запись на витрину.
 * Пачки режутся здесь, а не только в putSiteStocks: итог — по каждой пачке отдельно, и сбой второй
 * пачки не выдаёт уже записанную первую за отказ.
 */
export async function writeSiteStocks(cfg: SiteCredentials, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.barcode)
  const results: SendResult[] = [...rejected]
  for (const batch of chunk(valid, SITE_PUT_MAX_ITEMS)) {
    let r: SitePutResult
    try {
      r = await putSiteStocks(cfg, batch.map(({ op }) => ({ barcode: op.barcode, quantity: op.after })))
    } catch (e) {
      for (const { op } of batch) results.push(failed(op, `сайт: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
      continue
    }
    const unknown = new Set(r.unknown)
    for (const { op } of batch) {
      results.push(unknown.has(op.barcode) ? failed(op, `${SITE_UNKNOWN_BARCODE} ${op.barcode}`) : succeeded(op, { source: r.source }))
    }
  }
  return results
}
