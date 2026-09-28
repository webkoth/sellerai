// Запись остатка KIT (этап 1.4 синка v2): POST /v1/variants/stocks/bulk_update —
// образец sync/src/kit.ts (writeKitStock) и kit-swagger.openapi.json.
import { errorText } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { kitRequestOrNull, type KitCredentials } from "./client"

/** Пар товар-склад в одном запросе. */
export const KIT_BULK_MAX = 5000

export interface KitStockWriterConfig extends KitCredentials {
  /** Склад продаж «Склад Краснодар» (KIT_WAREHOUSE_ID). */
  warehouseId: string
  /** Только для тестов. */
  retryDelaysMs?: number[]
}

/** variant_id → код ошибки из тела 400 (BulkOperationError.errors). */
function itemErrors(body: unknown): Map<string, string> {
  const out = new Map<string, string>()
  const errors = (body as { errors?: Array<{ variant_id?: string; code?: string; message?: string }> } | null)?.errors
  if (Array.isArray(errors)) for (const e of errors) if (e.variant_id) out.set(String(e.variant_id), e.code ?? e.message ?? "ошибка элемента")
  return out
}

type Keyed = { op: WriteOp; key: string }

async function sendBatch(cfg: KitStockWriterConfig, batch: Keyed[], retryWithoutInvalid: boolean): Promise<SendResult[]> {
  if (batch.length === 0) return []
  try {
    await kitRequestOrNull(cfg, "/v1/variants/stocks/bulk_update", {
      method: "POST",
      body: { items: batch.map(({ op, key }) => ({ variant_id: key, warehouse_id: cfg.warehouseId, quantity: op.after })) },
      // Короткие повторы записи (stock-write.ts). Повторы идут внутри одного места в очереди KIT
      // (kitRequestOrNull): пауза 2 с и больше темпа 1,1 с, запросы не пересекаются.
      retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
      timeoutMs: WRITE_TIMEOUT_MS,
      maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS,
    })
    return batch.map(({ op, key }) => succeeded(op, { variant_id: key, quantity: op.after }))
  } catch (e) {
    // 400 с ошибками элементов — батч отклонён целиком (атомарно), значит и прошлые попытки
    // этого же тела ничего не применили: отказ битых пар — известный, без неопределённости.
    const invalid = e instanceof PlatformApiError && e.status === 400 ? itemErrors(e.body) : new Map<string, string>()
    if (retryWithoutInvalid && invalid.size > 0) {
      const bad = batch.filter(({ key }) => invalid.has(key))
      const good = batch.filter(({ key }) => !invalid.has(key))
      return [...bad.map(({ op, key }) => failed(op, `KIT: ${invalid.get(key)}`)), ...(await sendBatch(cfg, good, false))]
    }
    return batch.map(({ op }) => failed(op, `KIT: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
  }
}

/**
 * Остаток KIT абсолютным числом (`quantity`) на склад продаж, до 5000 пар. Запрос атомарный: одна
 * битая пара (товар не найден, архивирован, дубль) — 400 со списком errors и не применено НИЧЕГО.
 * Поэтому битые пары — отказ, остальные — один повтор без них. `reserved` площадка не трогает, и мы
 * его не шлём (решение владельца 28.09, п. 5).
 */
export async function writeKitStocks(cfg: KitStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  for (const batch of chunk(valid, KIT_BULK_MAX)) results.push(...(await sendBatch(cfg, batch, true)))
  return results
}
