// Написано по образцу sync/src/kit.ts (старый синк, заплатка 27.09.2026,
// проверена на живом магазине kit42191) — не перенос из finstock: там
// площадки KIT не было вовсе.
import type { OrderLifecycle } from "@sync2/shared"

/** Отмена до передачи покупателю — единица физически не уезжала, возвращается в пул целиком. */
const CANCELLED_BEFORE_SHIP = new Set(["CANCELLED", "DELIVERY_CANCELLED"])

/**
 * Возврат денег ПОСЛЕ покупки (частичный или полный) — товар уже был
 * передан покупателю; при сомнении, что он едет назад, не списываем его
 * сами (план, «Правила жизненного цикла», правило выбора).
 */
const RETURNED = new Set(["FULL_REFUND", "PARTIAL_REFUND"])

/** Передан в доставку и дальше (включая финал) — единица покинула пул. */
const SHIPPED = new Set(["WAIT_FOR_DELIVERY", "DELIVERED", "COMPLETED"])

/**
 * Жизненный цикл заказа KIT по его статусу (план, «Правила жизненного
 * цикла», строка KIT).
 *
 * Всё, что не входит ни в один из трёх списков — `NEW`, `PENDING_PAYMENT`,
 * `CANCELLATION_IN_PROGRESS` и любой незнакомый статус, который площадка
 * добавит позже, — `open`: единица держится в пуле до финала, а не
 * списывается заранее по промежуточному статусу оплаты или отмены.
 */
export function kitLifecycle(status: string): OrderLifecycle {
  if (CANCELLED_BEFORE_SHIP.has(status)) return "cancelled_before_ship"
  if (RETURNED.has(status)) return "returned"
  if (SHIPPED.has(status)) return "shipped"
  return "open"
}
