// Общее для писателей остатка (<площадка>/stock-writer.ts, этап 1.4 синка v2).
import { PlatformApiError, RateLimitError } from "./errors"
import type { SendResult, WriteOp } from "./writer"

/**
 * Повторы и таймаут запроса записи остатка (WB, Ozon, ЯМ): короткие. Пока запрос висит, на площадке
 * может пройти продажа, и наше абсолютное число, принятое через минуту, затёрло бы её; длинные паузы
 * чтения (http.ts, до минуты) здесь опаснее отказа — отказ повторит следующий тик.
 */
export const WRITE_RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000]
export const WRITE_TIMEOUT_MS = 20_000
/** Потолок паузы по Retry-After площадки для записи — не дольше последней паузы WRITE_RETRY_DELAYS_MS (http.ts). */
export const WRITE_MAX_RETRY_AFTER_MS = 5_000

/** Пачки по size, порядок сохраняется. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError(`размер пачки: ${size}`)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function succeeded(op: WriteOp, response?: unknown): SendResult {
  return { barcode: op.barcode, field: op.field, ok: true, response }
}

export function failed(op: WriteOp, error: string, opts: { uncertain?: boolean; response?: unknown } = {}): SendResult {
  return { barcode: op.barcode, field: op.field, ok: false, error, uncertain: opts.uncertain ?? false, response: opts.response }
}

/**
 * Могла ли запись дойти, если запрос кончился ошибкой. Смотрим на ВСЕ попытки запроса, не только
 * на последнюю: http.ts повторяет сам, и первая попытка, оборвавшаяся сетью/таймаутом/5xx, могла
 * примениться, даже если повтор получил 429 или 4xx (`mayHaveBeenDelivered`).
 * - сеть (статус 0) и 5xx — могла: площадка могла принять тело и не успеть ответить;
 * - 2xx, брошенный как ошибка (requestJson: пустое тело 200/204), — могла: площадка ответила успехом;
 * - лимит (429/420) и прочие 4xx на всех попытках — нет: площадка отказала до применения;
 * - не PlatformApiError (битое тело 2xx — SyntaxError, ошибка кода) — считаем, что могла (безопаснее).
 */
export function isUncertain(e: unknown): boolean {
  if (e instanceof PlatformApiError) {
    if (e.mayHaveBeenDelivered) return true
    if (e instanceof RateLimitError) return false
    return e.status === 0 || (e.status >= 200 && e.status < 300) || e.status >= 500
  }
  return true
}

/**
 * Разбор позиций по ключу площадки до сети. Без ключа — отказ. Один ключ у нескольких штрихкодов —
 * отказ всем: два разных остатка в один товар площадки, и какой из них верный, не угадываем
 * (проверено 28.09: сейчас таких нет ни на одной площадке).
 */
export function splitByKey(
  ops: readonly WriteOp[],
  keyOf: (op: WriteOp) => string | null,
): { valid: Array<{ op: WriteOp; key: string }>; rejected: SendResult[] } {
  const byKey = new Map<string, WriteOp[]>()
  const rejected: SendResult[] = []
  for (const op of ops) {
    const key = keyOf(op)
    if (!key) {
      rejected.push(failed(op, "нет ключа товара на площадке — запись невозможна"))
      continue
    }
    byKey.set(key, [...(byKey.get(key) ?? []), op])
  }
  const valid: Array<{ op: WriteOp; key: string }> = []
  for (const [key, group] of byKey) {
    if (group.length > 1) {
      const barcodes = group.map((o) => o.barcode).join(", ")
      for (const op of group) rejected.push(failed(op, `ключ площадки ${key} у нескольких штрихкодов (${barcodes}) — запись не делается`))
      continue
    }
    valid.push({ op: group[0]!, key })
  }
  return { valid, rejected }
}
