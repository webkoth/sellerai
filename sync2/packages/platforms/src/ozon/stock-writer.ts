// Запись остатка FBS Ozon (этап 1.4 синка v2): POST /v2/products/stocks — образец
// sync/src/clients.ts (writeOzonStock) и описание метода в swagger_ozon.json.
import { errorText } from "@sync2/shared"
import { requestJson } from "../http"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { BASE, ozonAuth, type OzonCredentials } from "./client"

/** Пар товар-склад в одном запросе. */
export const OZON_STOCKS_BATCH = 100

export interface OzonStockWriterConfig extends OzonCredentials {
  /** FBS-склад «Склад Краснодар» кабинета ИП (OZON_WAREHOUSE_ID = 1020005023618600). */
  warehouseId: number
  /** Только для тестов. */
  retryDelaysMs?: number[]
}

interface OzonStockUpdateRow {
  offer_id?: string
  warehouse_id?: number
  product_id?: number
  updated?: boolean
  errors?: Array<{ code?: string; message?: string }> | null
}

/**
 * Остаток — «в наличии без учёта резерва» (спецификация), то же, что снимок считает как
 * present − reserved (ozon/mapper.ts). Только offer_id, без product_id: при обоих Ozon берёт offer_id.
 * До 100 пар в запросе, до 80 запросов в минуту; одну пару — не чаще раза в 30 секунд
 * (TOO_MANY_REQUESTS в result.errors — отказ позиции, следующий тик повторит).
 */
export async function writeOzonStocks(cfg: OzonStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  for (const batch of chunk(valid, OZON_STOCKS_BATCH)) {
    let rows: OzonStockUpdateRow[]
    try {
      const body = await requestJson<{ result?: OzonStockUpdateRow[] | null }>("ozon", `${BASE}/v2/products/stocks`, {
        ...ozonAuth(cfg),
        method: "POST",
        body: { stocks: batch.map(({ op, key }) => ({ offer_id: key, stock: op.after, warehouse_id: cfg.warehouseId })) },
        ...(cfg.retryDelaysMs ? { retryDelaysMs: cfg.retryDelaysMs } : {}),
      })
      rows = body.result ?? []
    } catch (e) {
      for (const { op } of batch) results.push(failed(op, `Ozon: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
      continue
    }
    const byOffer = new Map(rows.map((r) => [String(r.offer_id ?? ""), r]))
    for (const { op, key } of batch) {
      const row = byOffer.get(key)
      if (!row) results.push(failed(op, `Ozon: нет итога по offer_id ${key}`, { uncertain: true }))
      else if (row.updated) results.push(succeeded(op, row))
      else {
        const codes = (row.errors ?? []).map((x) => x.code ?? x.message ?? "?").join(", ")
        results.push(failed(op, `Ozon: ${codes || "не обновлено"}`, { response: row }))
      }
    }
  }
  return results
}
