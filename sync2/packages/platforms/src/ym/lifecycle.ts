// Перенесено из finstock (27.09.2026): признак cancelled из mapper.ts заменён
// жизненным циклом синка (см. «Правила жизненного цикла» плана).
import type { OrderLifecycle } from "@sync2/shared"

/**
 * Подстатусы отмены ЯМ, при которых товар точно не покидал склад продавца:
 * покупатель не оплатил или передумал до сборки, магазин не собрал, курьер
 * не приехал забрать, резерв или проверка не прошли. Только они возвращают
 * единицу в пул.
 *
 * Список разрешающий, а не запрещающий: у большинства подстатусов ЯМ в
 * документации нет описания, и новый или неизвестный подстатус должен считаться
 * возвратом (товар мог уехать) — правило плана «при сомнении — returned».
 * Ошибка в эту сторону — недосчёт одной единицы, владелец вернёт её через WB.
 */
export const YM_BEFORE_SHIP_SUBSTATUSES: ReadonlySet<string> = new Set([
  "RESERVATION_EXPIRED",
  "RESERVATION_FAILED",
  "USER_NOT_PAID",
  "USER_UNREACHABLE",
  "USER_CHANGED_MIND",
  "USER_REFUSED_DELIVERY",
  "USER_PLACED_OTHER_ORDER",
  "USER_BOUGHT_CHEAPER",
  "USER_FRAUD",
  "USER_WANTED_ANOTHER_PAYMENT_METHOD",
  "USER_RECEIVED_TECHNICAL_ERROR",
  "USER_FORGOT_TO_USE_BONUS",
  "SHOP_FAILED",
  "SHOP_PENDING_CANCELLED",
  "PENDING_CANCELLED",
  "PENDING_EXPIRED",
  "PROCESSING_EXPIRED",
  "REPLACING_ORDER",
  "ANTIFRAUD",
  "WAREHOUSE_FAILED_TO_SHIP",
  "COURIER_NOT_FOUND",
  "CANCELLED_COURIER_NOT_FOUND",
  "COURIER_NOT_COME_FOR_ORDER",
  "BANK_REJECT_CREDIT_OFFER",
  "CUSTOMER_REJECT_CREDIT_OFFER",
  "CREDIT_OFFER_FAILED",
  "POSTPAID_BUDGET_RESERVATION_FAILED",
  "DELIVERY_NOT_MANAGED_REGION",
  "INCOMPLETE_CONTACT_INFORMATION",
  "INCOMPLETE_MULTI_ORDER",
  "INAPPROPRIATE_WEIGHT_SIZE",
  "INCORRECT_PERSONAL_DATA",
  "NO_PERSONAL_DATA_EXPIRED",
  "LEGAL_INFO_CHANGED",
])

/** Статусы, при которых заказ уже в пути к покупателю или у него — `shipped`. */
const SHIPPED_STATUSES = new Set(["DELIVERY", "PICKUP", "DELIVERED"])

/**
 * Жизненный цикл заказа ЯМ по статусу и подстатусу.
 *
 * `CANCELLED` — отмена до отправки только с подстатусом из
 * `YM_BEFORE_SHIP_SUBSTATUSES`; любой другой, неизвестный или пустой — `returned`.
 * `RETURNED` и `PARTIALLY_RETURNED` — всегда `returned` (у частичного возврата
 * ЯМ не говорит, какие позиции вернулись, — все строки заказа считаются возвратом).
 */
export function ymLifecycle(order: { status: string; substatus?: string | undefined }): OrderLifecycle {
  if (order.status === "CANCELLED") {
    return order.substatus && YM_BEFORE_SHIP_SUBSTATUSES.has(order.substatus) ? "cancelled_before_ship" : "returned"
  }
  if (order.status === "RETURNED" || order.status === "PARTIALLY_RETURNED") return "returned"
  if (SHIPPED_STATUSES.has(order.status)) return "shipped"
  return "open"
}
