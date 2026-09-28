// Запись остатка WB на склад продавца (этап 1.4 синка v2). Спецификация:
// docs/api-reference/openapi/wildberries/02-products.yaml, PUT /api/v3/stocks/{warehouseId}.
import { errorText } from "@sync2/shared"
import { PlatformApiError, RateLimitError } from "../errors"
import { requestJsonOrNull } from "../http"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { fetchFbsStocks } from "./client"

const MARKETPLACE = "https://marketplace-api.wildberries.ru"
/** maxItems тела PUT /api/v3/stocks/{warehouseId}. */
export const WB_STOCKS_PUT_MAX = 1000
/**
 * Пауза перед проверочным чтением после записи: WB применяет остаток не мгновенно, и чтение
 * сразу после 204 могло бы не увидеть только что записанное число (итог «неизвестно» без причины).
 * 1,5 с — наблюдаемого запаздывания нет, это запас; тик длится десятки секунд, пауза в нём незаметна.
 */
const WB_VERIFY_DELAY_MS = 1_500
/**
 * Пауза перед ВТОРЫМ проверочным чтением — только для позиций, которые первое чтение не решило (не целевое
 * число после 204, прежнее после 5xx/таймаута, иное): «итог неизвестен» ставится лишь после него. 5 с —
 * запас на распространение остатка внутри WB; позиций таких единицы, тик длится десятки секунд.
 */
const WB_VERIFY_RETRY_DELAY_MS = 5_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface WbStockWriterConfig {
  token: string
  /** Склад продавца, на который пишет sync2 (WB_WAREHOUSE_ID); проверено 28.09: он один — 1408913. */
  warehouseId: number
  /** Только для тестов. */
  retryDelaysMs?: number[]
  /** Только для тестов: пауза перед проверочным чтением (по умолчанию WB_VERIFY_DELAY_MS). */
  verifyDelayMs?: number
  /** Только для тестов: пауза перед вторым проверочным чтением (по умолчанию WB_VERIFY_RETRY_DELAY_MS). */
  verifyRetryDelayMs?: number
}

/**
 * Остаток по штрихкодам на складе и chrtId, которым WB отвечает за штрихкод; строк с нулём WB не
 * отдаёт — отсутствие строки = 0 (и chrtId неизвестен).
 */
async function readRows(cfg: WbStockWriterConfig, barcodes: string[]): Promise<Map<string, { amount: number; chrtId: number | null }>> {
  const out = new Map<string, { amount: number; chrtId: number | null }>()
  for (const row of await fetchFbsStocks(cfg.token, cfg.warehouseId, barcodes)) {
    if (row.sku) out.set(row.sku, { amount: Math.max(0, row.amount ?? 0), chrtId: row.chrtId ?? null })
  }
  return out
}

async function readAmounts(cfg: WbStockWriterConfig, barcodes: string[]): Promise<Map<string, number>> {
  return new Map([...(await readRows(cfg, barcodes))].map(([barcode, r]) => [barcode, r.amount]))
}

/**
 * Позиции, названные в теле 409 (`StocksWarehouseError`: `[{ code, message, data: [{ sku, chrtId, amount }] }]`):
 * штрихкод → код ошибки. Совпадение по chrtId или по штрихкоду (`sku`). Не 409 или без data — пусто.
 */
function namedInWbError(e: unknown, batch: readonly Keyed[]): Map<string, string> {
  const out = new Map<string, string>()
  if (!(e instanceof PlatformApiError) || e.status !== 409 || !Array.isArray(e.body)) return out
  for (const err of e.body as Array<{ code?: unknown; data?: unknown }>) {
    if (!Array.isArray(err?.data)) continue
    const code = typeof err.code === "string" && err.code ? err.code : "ошибка позиции"
    for (const d of err.data as Array<{ sku?: unknown; chrtId?: unknown }>) {
      for (const x of batch) {
        if ((typeof d?.chrtId === "number" && d.chrtId === x.chrtId) || (typeof d?.sku === "string" && d.sku !== "" && d.sku === x.op.barcode)) {
          out.set(x.op.barcode, code)
        }
      }
    }
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
 *    После ЛЮБОЙ ошибки PUT, кроме чистого лимита (429 без признаков доставки), — тоже проверочное
 *    чтение: целевое число — применено (ответ потерян или WB применил часть пачки, 409 не говорит, что
 *    с остальными). «Отказ» — только прежнее число после ошибки, которая точно не дошла (4xx/409 без
 *    признака доставки): после 5xx/таймаута WB может применить запись позже, и «отказ» дал бы фантом
 *    (applyWbWriteOutcomes доверился бы факту, а поздняя запись на росте подняла бы WB выше пула).
 *    Всё нерешённое (204 без целевого числа, прежнее после 5xx/таймаута, иное) — второе чтение через
 *    WB_VERIFY_RETRY_DELAY_MS: целевое — применено, иначе «итог неизвестен» (max(база, факт)).
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

  let current: Map<string, { amount: number; chrtId: number | null }>
  try {
    current = await readRows(cfg, withChrt.map((x) => x.op.barcode))
  } catch (e) {
    for (const x of withChrt) results.push(failed(x.op, `WB: остаток перед записью не прочитан — ${errorText(e)}`))
    return results
  }
  const toWrite: Array<{ op: WriteOp; chrtId: number }> = []
  for (const x of withChrt) {
    const row = current.get(x.op.barcode)
    const now = row?.amount ?? 0
    if (row && row.chrtId !== null && row.chrtId !== x.chrtId) {
      // Каталог (products.wb_chrt_id) устарел или штрихкод переехал в другой размер: запись по нашему
      // chrtId ушла бы в чужой размер.
      results.push(
        failed(x.op, `WB: chrtId расходится с WB (в каталоге ${x.chrtId}, на складе ${row.chrtId}) — запись не делается до обновления каталога`, {
          response: { currentChrtId: row.chrtId, currentAmount: now },
        }),
      )
    } else if (x.op.before !== null && now !== x.op.before) {
      results.push(
        failed(x.op, `WB: остаток изменился после снимка (было ${x.op.before}, сейчас ${now}) — запись отложена до следующего прогона`, {
          response: { currentAmount: now },
        }),
      )
    } else {
      toWrite.push(x)
    }
  }

  for (const batch of chunk(toWrite, WB_STOCKS_PUT_MAX)) results.push(...(await putAndVerify(cfg, batch, true)))
  return results
}

type Keyed = { op: WriteOp; chrtId: number }

/** Чистый лимит: площадка отказала до применения, и ни одна попытка не могла дойти — читать незачем. */
const isPureRateLimit = (e: unknown) => e instanceof RateLimitError && !e.mayHaveBeenDelivered

/**
 * Одна пачка: PUT → пауза → проверочное чтение → итог по каждой позиции (см. writeWbStocks, шаг 3).
 * 409 с названными позициями (data[]): им — отказ с кодом WB, неприменённым остальным — ОДИН повтор
 * без них (`retryWithoutNamed`): одна плохая позиция не должна держать всю площадку каждый тик.
 */
async function putAndVerify(cfg: WbStockWriterConfig, batch: Keyed[], retryWithoutNamed: boolean): Promise<SendResult[]> {
  let putError: unknown = null
  try {
    await requestJsonOrNull("wb", `${MARKETPLACE}/api/v3/stocks/${cfg.warehouseId}`, {
      token: cfg.token,
      method: "PUT",
      body: { stocks: batch.map((x) => ({ chrtId: x.chrtId, amount: x.op.after })) },
      // Короткие повторы записи (stock-write.ts).
      retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
      timeoutMs: WRITE_TIMEOUT_MS,
      maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS,
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

  const named = namedInWbError(putError, batch)
  // Ошибка, которая точно не дошла (4xx/409 без признака доставки): прежнее число — отказ.
  const surelyRejected = putError !== null && !isUncertain(putError)
  const results: SendResult[] = []
  const retry: Keyed[] = []
  const unresolved: Keyed[] = []
  for (const x of batch) {
    const got = after.get(x.op.barcode) ?? 0
    if (got === x.op.after) {
      results.push(succeeded(x.op, { chrtId: x.chrtId, amount: got }))
    } else if (surelyRejected && got === x.op.before) {
      const code = named.get(x.op.barcode)
      if (code !== undefined) results.push(failed(x.op, `WB: ${code} — ${rejectedText}`, { response: errorBody }))
      // Повтор без названных: остаток позиции только что перечитан этим же проверочным чтением
      // (got === before) — окно затирания продажи между чтением и повтором минимально.
      else if (retryWithoutNamed && named.size > 0) retry.push(x)
      else results.push(failed(x.op, rejectedText, { response: errorBody }))
    } else {
      unresolved.push(x)
    }
  }
  if (unresolved.length > 0) results.push(...(await verifyAgain(cfg, unresolved, putError, rejectedText, errorBody)))
  if (retry.length > 0) results.push(...(await putAndVerify(cfg, retry, false)))
  return results
}

/** Второе проверочное чтение позиций, которые первое не решило: целевое число — применено, иначе — неизвестно. */
async function verifyAgain(cfg: WbStockWriterConfig, batch: Keyed[], putError: unknown, rejectedText: string, errorBody: unknown): Promise<SendResult[]> {
  await sleep(cfg.verifyRetryDelayMs ?? WB_VERIFY_RETRY_DELAY_MS)
  const describe = (x: Keyed, got: number | "?") =>
    putError === null
      ? `WB: после записи на складе ${got}, ожидалось ${x.op.after}`
      : `${rejectedText}; после ошибки на складе ${got} (было ${x.op.before}, ожидалось ${x.op.after})`
  let again: Map<string, number>
  try {
    again = await readAmounts(cfg, batch.map((x) => x.op.barcode))
  } catch (e) {
    return batch.map((x) => failed(x.op, `${describe(x, "?")}; второе проверочное чтение не удалось — ${errorText(e)}`, { uncertain: true, response: errorBody }))
  }
  return batch.map((x) => {
    const got = again.get(x.op.barcode) ?? 0
    if (got === x.op.after) return succeeded(x.op, { chrtId: x.chrtId, amount: got })
    return failed(x.op, describe(x, got), { uncertain: true, response: putError === null ? { chrtId: x.chrtId, amount: got } : errorBody })
  })
}
