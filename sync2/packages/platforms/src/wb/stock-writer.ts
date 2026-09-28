// Запись остатка WB на склад продавца (этап 1.4 синка v2). Спецификация:
// docs/api-reference/openapi/wildberries/02-products.yaml, PUT /api/v3/stocks/{warehouseId}.
import { errorText } from "@sync2/shared"
import { PlatformApiError, RateLimitError } from "../errors"
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
/**
 * Пауза перед проверочным чтением после записи: WB применяет остаток не мгновенно, и чтение
 * сразу после 204 могло бы не увидеть только что записанное число (итог «неизвестно» без причины).
 * 1,5 с — наблюдаемого запаздывания нет, это запас; тик длится десятки секунд, пауза в нём незаметна.
 */
const WB_VERIFY_DELAY_MS = 1_500

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface WbStockWriterConfig {
  token: string
  /** Склад продавца, на который пишет sync2 (WB_WAREHOUSE_ID); проверено 28.09: он один — 1408913. */
  warehouseId: number
  /** Только для тестов. */
  retryDelaysMs?: number[]
  /** Только для тестов: пауза перед проверочным чтением (по умолчанию WB_VERIFY_DELAY_MS). */
  verifyDelayMs?: number
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
 * 3. проверить чтением (после короткой паузы): «применено» — только если на складе целевое число.
 *    204 без записи и расхождение после записи — «итог неизвестен» (applyWbWriteOutcomes возьмёт
 *    max(база, факт)). После ЛЮБОЙ ошибки PUT, кроме чистого лимита (429 без признаков доставки),
 *    — тоже проверочное чтение, решение по каждой позиции: целевое число — применено (ответ потерян
 *    или WB применил часть пачки, 409 не говорит, что с остальными); прежнее — отказ; иное — неизвестно.
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

  for (const batch of chunk(toWrite, WB_STOCKS_PUT_MAX)) results.push(...(await putAndVerify(cfg, batch)))
  return results
}

type Keyed = { op: WriteOp; chrtId: number }

/** Чистый лимит: площадка отказала до применения, и ни одна попытка не могла дойти — читать незачем. */
const isPureRateLimit = (e: unknown) => e instanceof RateLimitError && !e.mayHaveBeenDelivered

/** Одна пачка: PUT → пауза → проверочное чтение → итог по каждой позиции (см. writeWbStocks, шаг 3). */
async function putAndVerify(cfg: WbStockWriterConfig, batch: Keyed[]): Promise<SendResult[]> {
  let putError: unknown = null
  try {
    await requestJsonOrNull("wb", `${MARKETPLACE}/api/v3/stocks/${cfg.warehouseId}`, {
      token: cfg.token,
      method: "PUT",
      body: { stocks: batch.map((x) => ({ chrtId: x.chrtId, amount: x.op.after })) },
      retryDelaysMs: cfg.retryDelaysMs ?? WB_WRITE_RETRY_DELAYS_MS,
      timeoutMs: WB_WRITE_TIMEOUT_MS,
    })
  } catch (e) {
    putError = e
  }
  const errorBody = putError instanceof PlatformApiError ? putError.body : undefined
  const rejectedText = putError === null ? "" : `WB: запись не принята — ${errorText(putError)}`
  if (putError !== null && isPureRateLimit(putError)) {
    return batch.map((x) => failed(x.op, rejectedText, { response: errorBody }))
  }

  await sleep(cfg.verifyDelayMs ?? WB_VERIFY_DELAY_MS)
  let after: Map<string, number>
  try {
    after = await readAmounts(cfg, batch.map((x) => x.op.barcode))
  } catch (e) {
    if (putError === null) {
      return batch.map((x) => failed(x.op, `WB: запись отправлена, проверочное чтение не удалось — ${errorText(e)}`, { uncertain: true }))
    }
    return batch.map((x) =>
      failed(x.op, `${rejectedText}; проверочное чтение не удалось — ${errorText(e)}`, { uncertain: isUncertain(putError), response: errorBody }),
    )
  }

  return batch.map((x) => {
    const got = after.get(x.op.barcode) ?? 0
    if (got === x.op.after) return succeeded(x.op, { chrtId: x.chrtId, amount: got })
    if (putError === null) {
      return failed(x.op, `WB: после записи на складе ${got}, ожидалось ${x.op.after}`, { uncertain: true, response: { chrtId: x.chrtId, amount: got } })
    }
    // Ошибка PUT, на складе прежнее число — запись не применилась: отказ, итог известен.
    if (got === x.op.before) return failed(x.op, rejectedText, { response: errorBody })
    return failed(x.op, `${rejectedText}; после ошибки на складе ${got} (было ${x.op.before}, ожидалось ${x.op.after})`, {
      uncertain: true,
      response: errorBody,
    })
  })
}
