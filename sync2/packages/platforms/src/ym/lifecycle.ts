// Перенесено из finstock (27.09.2026): признак cancelled из mapper.ts заменён
// жизненным циклом синка (см. «Правила жизненного цикла» плана).
import type { OrderLifecycle } from "@sync2/shared"

/**
 * Подстатусы отмены ЯМ «после отправки» — товар уже уехал и едет назад,
 * единицу возвращает владелец через WB после осмотра (план, «Правила
 * жизненного цикла»). Отмена с любым другим подстатусом — до отправки,
 * товар физически не покидал пул.
 */
export const YM_AFTER_SHIP_SUBSTATUSES: ReadonlySet<string> = new Set([
  "USER_REFUSED_PRODUCT",
  "USER_REFUSED_QUALITY",
  "PICKUP_EXPIRED",
  "DELIVERY_SERVICE_UNDELIVERED",
  "COURIER_RETURNS_ORDER",
  "COURIER_RETURNED_ORDER",
  "COURIER_NOT_DELIVER_ORDER",
  "FULL_NOT_RANSOM",
  "WRONG_ITEM_DELIVERED",
  "DAMAGED_BOX",
  "USER_HAS_NO_TIME_TO_PICKUP_ORDER",
  "DELIVERY_SERVICE_LOST",
  "SORTING_CENTER_LOST",
  "DROPOFF_LOST",
  "LOST",
  "BROKEN_ITEM",
  "WRONG_ITEM",
  "MISSING_ITEM",
])

/** Статусы, при которых заказ уже в пути к покупателю или у него — `shipped`. */
const SHIPPED_STATUSES = new Set(["DELIVERY", "PICKUP", "DELIVERED"])

/**
 * Жизненный цикл заказа ЯМ по статусу и подстатусу.
 *
 * `CANCELLED` с подстатусом из `YM_AFTER_SHIP_SUBSTATUSES` — товар уже уехал
 * и едет назад, это `returned`, а не отмена до отправки; любой другой
 * подстатус (или его отсутствие) — `cancelled_before_ship`. `RETURNED` и
 * `PARTIALLY_RETURNED` — возврат после получения, всегда `returned`.
 * Правило выбора при сомнении (план): при любой неопределённости —
 * `returned`, а не `cancelled_before_ship` — ошибка в эту сторону даёт лишь
 * недосчёт одной единицы, а не продажу несуществующей.
 */
export function ymLifecycle(order: { status: string; substatus?: string | undefined }): OrderLifecycle {
  if (order.status === "CANCELLED") {
    return order.substatus && YM_AFTER_SHIP_SUBSTATUSES.has(order.substatus) ? "returned" : "cancelled_before_ship"
  }
  if (order.status === "RETURNED" || order.status === "PARTIALLY_RETURNED") return "returned"
  if (SHIPPED_STATUSES.has(order.status)) return "shipped"
  return "open"
}
