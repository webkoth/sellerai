/**
 * Жизненный цикл строки заказа в синке — общий для всех площадок; адаптер
 * переводит статусы площадки в эти четыре.
 * open — принят, не отправлен; shipped — отправлен; cancelled_before_ship —
 * отменён до отправки (товар не уезжал); returned — возврат после доставки.
 */
export const ORDER_LIFECYCLES = ["open", "shipped", "cancelled_before_ship", "returned"] as const
export type OrderLifecycle = (typeof ORDER_LIFECYCLES)[number]

/** Строка заказа площадки в едином виде: одна позиция заказа — одна строка. */
export interface ChannelOrder {
  /** Уникален в пределах площадки: номер заказа и позиция, как их отдаёт адаптер. */
  externalId: string
  /** Штрихкод WB; null — площадка не дала штрихкод и артикул не сопоставился. */
  barcode: string | null
  externalSku: string | null
  quantity: number
  priceMinor: number
  lifecycle: OrderLifecycle
  /** Время события на площадке, ISO 8601. */
  occurredAt: string
  /** Сырой ответ площадки — для разбора споров. */
  raw: unknown
}
