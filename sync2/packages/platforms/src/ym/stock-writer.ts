// Запись остатка ЯМ (этап 1.4 синка v2): PUT /v2/campaigns/{campaignId}/offers/stocks —
// образец sync/src/clients.ts (writeYmStock), работающий на проде с 19.07.2026.
import { errorText } from "@sync2/shared"
import { requestJson } from "../http"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { BASE, ymAuth, type YmCredentials } from "./client"

/** Офферов в запросе: спецификация до 2000; 200 — как у старого синка. */
export const YM_STOCKS_BATCH = 200

export interface YmStockWriterConfig extends YmCredentials {
  /** Склад магазина «Kotelnikovartifact» — первый из YM_WAREHOUSE_IDS (2369574). */
  warehouseId: number
  /** Только для тестов. */
  now?: () => Date
  retryDelaysMs?: number[]
}

/**
 * Тело — как у старого синка: `{ sku, warehouseId, items: [{ count, type: "FIT", updatedAt }] }`.
 * Текущая спецификация описывает `{ sku, items: [{ count, updatedAt }] }` на уровне кампании;
 * `warehouseId` и `type` площадка принимает (проверено продом старого синка) — тело не меняем
 * без живой проверки (решение владельца п. 6: перед шагом B — запись одному офферу его текущего
 * остатка ровно этим телом; отсюда отдельная функция, которой пользуется и writeYmStocks).
 */
export function ymStocksBody(
  items: ReadonlyArray<{ offerId: string; count: number }>,
  warehouseId: number,
  updatedAt: string,
): { skus: Array<{ sku: string; warehouseId: number; items: Array<{ count: number; type: "FIT"; updatedAt: string }> }> } {
  return { skus: items.map((x) => ({ sku: x.offerId, warehouseId, items: [{ count: x.count, type: "FIT", updatedAt }] })) }
}

/**
 * `count` — доступный остаток, как FIT в снимке (ym/mapper.ts).
 * Данные в каталоге ЯМ обновляются до нескольких минут: «применено» здесь — «принято»; что
 * остаток встал, показывает следующий снимок (drift).
 */
export async function writeYmStocks(cfg: YmStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  const updatedAt = (cfg.now ?? (() => new Date()))().toISOString()
  for (const batch of chunk(valid, YM_STOCKS_BATCH)) {
    let body: { status?: string; result?: { notUpdatedOfferIds?: string[] | null } | null }
    try {
      body = await requestJson("ym", `${BASE}/v2/campaigns/${cfg.campaignId}/offers/stocks`, {
        ...ymAuth(cfg),
        method: "PUT",
        body: ymStocksBody(
          batch.map(({ op, key }) => ({ offerId: key, count: op.after })),
          cfg.warehouseId,
          updatedAt,
        ),
        ...(cfg.retryDelaysMs ? { retryDelaysMs: cfg.retryDelaysMs } : {}),
      })
    } catch (e) {
      for (const { op } of batch) results.push(failed(op, `ЯМ: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
      continue
    }
    const notUpdated = new Set(body.result?.notUpdatedOfferIds ?? [])
    for (const { op, key } of batch) {
      if (notUpdated.has(key)) results.push(failed(op, `ЯМ: оффер ${key} не обновлён (notUpdatedOfferIds)`, { response: body }))
      else results.push(succeeded(op, { status: body.status }))
    }
  }
  return results
}
