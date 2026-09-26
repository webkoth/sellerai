import type { OrderLifecycle } from "@sync2/shared"
import type { PoolOrder } from "./pool"

/** Строка заказа из хранилища — то, что нужно пулу. Время — ISO 8601. */
export interface OrderRowForPool {
  /** orders_raw.id */
  id: number
  channelId: number
  barcode: string | null
  quantity: number
  lifecycle: OrderLifecycle
  occurredAt: string
}

export interface ToPoolOrdersResult {
  orders: PoolOrder[]
  skipped: {
    /** Заказы площадки-мастера: они уже видны в её снимке, вычесть их ещё раз — двойной учёт. */
    master: number
    /** Строки без баркода: пулу не к чему их привязать. */
    noBarcode: number
  }
}

/**
 * Строки заказов → заказы пула. Отменой для пула считается только отмена до
 * отправки: возврат после доставки единицу не возвращает — товар едет назад,
 * и владелец добавит его на WB после осмотра (решение 25.09.2026, п. 6).
 */
export function toPoolOrders(rows: OrderRowForPool[], masterChannelId: number): ToPoolOrdersResult {
  const orders: PoolOrder[] = []
  const skipped = { master: 0, noBarcode: 0 }
  for (const r of rows) {
    if (r.channelId === masterChannelId) {
      skipped.master += 1
      continue
    }
    if (r.barcode === null) {
      skipped.noBarcode += 1
      continue
    }
    orders.push({
      orderId: r.id,
      channelId: r.channelId,
      barcode: r.barcode,
      quantity: r.quantity,
      cancelled: r.lifecycle === "cancelled_before_ship",
      occurredAt: r.occurredAt,
    })
  }
  return { orders, skipped }
}
