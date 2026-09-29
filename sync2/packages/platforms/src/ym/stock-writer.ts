// Запись остатка ЯМ (этап 1.4 синка v2): PUT /v2/campaigns/{campaignId}/offers/stocks —
// образец sync/src/clients.ts (writeYmStock), работающий на проде с 19.07.2026.
import { errorText } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { requestJson } from "../http"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
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
 * Офферы пачки, названные в тексте ошибок 400 (`errors[].message`): offerId → код ошибки. Спецификация
 * даёт у ошибки только code и message, поэтому оффер ищется в тексте целым словом — «JW-1» не
 * совпадает с «JW-12». Не 400 или офферы не названы — пусто.
 */
function namedInYmError(e: unknown, keys: readonly string[]): Map<string, string> {
  const out = new Map<string, string>()
  if (!(e instanceof PlatformApiError) || e.status !== 400) return out
  const errors = (e.body as { errors?: Array<{ code?: unknown; message?: unknown }> } | null)?.errors
  if (!Array.isArray(errors)) return out
  const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  for (const err of errors) {
    if (typeof err?.message !== "string") continue
    const code = typeof err.code === "string" && err.code ? err.code : "ошибка оффера"
    for (const key of keys) {
      if (new RegExp(`(^|[^A-Za-z0-9_-])${escape(key)}($|[^A-Za-z0-9_-])`).test(err.message)) out.set(key, code)
    }
  }
  return out
}

type Keyed = { op: WriteOp; key: string }

async function sendBatch(cfg: YmStockWriterConfig, batch: Keyed[], updatedAt: string, retryWithoutNamed: boolean): Promise<SendResult[]> {
  if (batch.length === 0) return []
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
      // Короткие повторы записи (stock-write.ts).
      retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
      timeoutMs: WRITE_TIMEOUT_MS,
      maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS,
    })
  } catch (e) {
    const uncertain = isUncertain(e)
    const named = namedInYmError(e, batch.map((x) => x.key))
    if (retryWithoutNamed && named.size > 0) {
      // Одна плохая позиция не должна держать всю площадку каждый тик: ей — отказ, остальным — один повтор.
      const bad = batch.filter(({ key }) => named.has(key))
      const good = batch.filter(({ key }) => !named.has(key))
      return [
        ...bad.map(({ op, key }) => failed(op, `ЯМ: ${named.get(key)} — запись не принята — ${errorText(e)}`, { uncertain })),
        ...(await sendBatch(cfg, good, updatedAt, false)),
      ]
    }
    return batch.map(({ op }) => failed(op, `ЯМ: запись не принята — ${errorText(e)}`, { uncertain }))
  }
  if (body.status !== "OK") {
    // 200 без status OK спецификация не описывает: что площадка сделала с пачкой — неизвестно.
    return batch.map(({ op }) => failed(op, `ЯМ: ответ без status OK (${String(body.status)})`, { uncertain: true, response: body }))
  }
  const notUpdated = new Set(body.result?.notUpdatedOfferIds ?? [])
  return batch.map(({ op, key }) =>
    notUpdated.has(key) ? failed(op, `ЯМ: оффер ${key} не обновлён (notUpdatedOfferIds)`, { response: body }) : succeeded(op, { status: body.status }),
  )
}

/**
 * `count` — цель пула как есть: свободный остаток БЕЗ резерва, резерв FREEZE не прибавляется.
 * Документация PUT v2/campaigns/{campaignId}/offers/stocks, `UpdateStockItemDTO.count`: «Количество
 * доступного товара» (https://yandex.ru/dev/market/partner-api/doc/ru/reference/stocks/updateStocks#entity-UpdateStockItemDTO);
 * Справка «Как управлять остатками» (https://yandex.ru/support/marketplace/ru/assortment/operations/stocks#count):
 * «В остатках нужно передавать количество свободных для новых заказов товаров», после заказа —
 * «Передавайте только количество товаров, доступное для продажи»; «Для моделей FBS и Экспресс: не
 * снимает резерв, пока заказ не будет доставлен». Резерв Маркет держит сам, поэтому после записи 0
 * при резерве 1 чтение отдаёт FIT 1, FREEZE 1 (FIT = свободный + резерв) — это не отказ записи.
 * Снимок сравнивается с целью тем же свободным остатком (ym/mapper.ts, stockCount).
 * Данные в каталоге ЯМ обновляются до нескольких минут: «применено» здесь — «принято» (ответ со
 * status OK); что остаток встал, показывает следующий снимок (drift). 400, называющий офферы, — им
 * отказ, остальным — один повтор без них.
 */
export async function writeYmStocks(cfg: YmStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  const updatedAt = (cfg.now ?? (() => new Date()))().toISOString()
  for (const batch of chunk(valid, YM_STOCKS_BATCH)) results.push(...(await sendBatch(cfg, batch, updatedAt, true)))
  return results
}
