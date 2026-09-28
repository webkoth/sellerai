// Запись остатка WB на склад продавца (этап 1.4 синка v2). Спецификация:
// docs/api-reference/openapi/wildberries/02-products.yaml, PUT /api/v3/stocks/{warehouseId}.
import { errorText } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { requestJsonOrNull } from "../http"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { fetchFbsStocks } from "./client"

const MARKETPLACE = "https://marketplace-api.wildberries.ru"
/** maxItems тела PUT /api/v3/stocks/{warehouseId}. */
export const WB_STOCKS_PUT_MAX = 1000
/**
 * Короткие повторы записи: пока запрос висит, на WB может пройти продажа, и наше абсолютное число,
 * принятое через минуту, затёрло бы её. Длинные паузы (http.ts, до минуты) здесь опаснее отказа —
 * отказ повторит следующий тик.
 */
const WB_WRITE_RETRY_DELAYS_MS = [2_000, 5_000]
const WB_WRITE_TIMEOUT_MS = 20_000

export interface WbStockWriterConfig {
  token: string
  /** Склад продавца, на который пишет sync2 (WB_WAREHOUSE_ID); проверено 28.09: он один — 1408913. */
  warehouseId: number
  /** Только для тестов. */
  retryDelaysMs?: number[]
}

/** Остаток по штрихкодам на складе; строк с нулём WB не отдаёт — отсутствие строки = 0. */
async function readAmounts(cfg: WbStockWriterConfig, barcodes: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (const row of await fetchFbsStocks(cfg.token, cfg.warehouseId, barcodes)) {
    if (row.sku) out.set(row.sku, Math.max(0, row.amount ?? 0))
  }
  return out
}

/**
 * Запись остатка WB в три шага:
 * 1. перечитать остаток записываемых штрихкодов и не писать те, что изменились с момента снимка
 *    (`op.before`): продажа на WB между снимком и записью иначе затёрлась бы нашим абсолютным числом
 *    (контракт адаптеров, план 1.2). Такая позиция — отказ без неопределённости: следующий снимок
 *    покажет продажу сигналом WB;
 * 2. PUT `{ stocks: [{ chrtId, amount }] }` пачками по 1000 — ключ chrtId, а не sku: спецификация
 *    отклоняет sku (`SKUUploadDisabled`), а неверные имена полей WB принимает ответом 204 без записи;
 * 3. проверить чтением: «применено» — только если на складе целевое число. 204 без записи и
 *    расхождение после записи — «итог неизвестен» (applyWbWriteOutcomes возьмёт max(база, факт)).
 */
export async function writeWbStocks(cfg: WbStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  const withChrt: Array<{ op: WriteOp; chrtId: number }> = []
  for (const { op, key } of valid) {
    const chrtId = Number(key)
    if (!Number.isSafeInteger(chrtId) || chrtId <= 0) results.push(failed(op, `WB: chrtId «${key}» не число — запись невозможна`))
    else withChrt.push({ op, chrtId })
  }
  if (withChrt.length === 0) return results

  let current: Map<string, number>
  try {
    current = await readAmounts(cfg, withChrt.map((x) => x.op.barcode))
  } catch (e) {
    for (const x of withChrt) results.push(failed(x.op, `WB: остаток перед записью не прочитан — ${errorText(e)}`))
    return results
  }
  const toWrite: Array<{ op: WriteOp; chrtId: number }> = []
  for (const x of withChrt) {
    const now = current.get(x.op.barcode) ?? 0
    if (x.op.before !== null && now !== x.op.before) {
      results.push(
        failed(x.op, `WB: остаток изменился после снимка (было ${x.op.before}, сейчас ${now}) — запись отложена до следующего прогона`, {
          response: { currentAmount: now },
        }),
      )
    } else {
      toWrite.push(x)
    }
  }

  const sent: Array<{ op: WriteOp; chrtId: number }> = []
  for (const batch of chunk(toWrite, WB_STOCKS_PUT_MAX)) {
    try {
      await requestJsonOrNull("wb", `${MARKETPLACE}/api/v3/stocks/${cfg.warehouseId}`, {
        token: cfg.token,
        method: "PUT",
        body: { stocks: batch.map((x) => ({ chrtId: x.chrtId, amount: x.op.after })) },
        retryDelaysMs: cfg.retryDelaysMs ?? WB_WRITE_RETRY_DELAYS_MS,
        timeoutMs: WB_WRITE_TIMEOUT_MS,
      })
      sent.push(...batch)
    } catch (e) {
      const response = e instanceof PlatformApiError ? e.body : undefined
      for (const x of batch) results.push(failed(x.op, `WB: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e), response }))
    }
  }
  if (sent.length === 0) return results

  let after: Map<string, number>
  try {
    after = await readAmounts(cfg, sent.map((x) => x.op.barcode))
  } catch (e) {
    for (const x of sent) results.push(failed(x.op, `WB: запись отправлена, проверочное чтение не удалось — ${errorText(e)}`, { uncertain: true }))
    return results
  }
  for (const x of sent) {
    const got = after.get(x.op.barcode) ?? 0
    if (got === x.op.after) results.push(succeeded(x.op, { chrtId: x.chrtId, amount: got }))
    else results.push(failed(x.op, `WB: после записи на складе ${got}, ожидалось ${x.op.after}`, { uncertain: true, response: { chrtId: x.chrtId, amount: got } }))
  }
  return results
}
