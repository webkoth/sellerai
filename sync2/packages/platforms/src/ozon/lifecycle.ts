// Перенесено из finstock (27.09.2026): признак cancelled из mapper.ts заменён
// жизненным циклом синка (см. «Правила жизненного цикла» плана).
import type { OrderLifecycle } from "@sync2/shared"
import type { OzonPosting } from "./client"

/**
 * Статусы, при которых отправление уже уехало (или доехало) до покупателя —
 * `shipped` по таблице «Правила жизненного цикла» плана.
 */
const SHIPPED_STATUSES = new Set([
  "delivering",
  "driver_pickup",
  "delivered",
  "sent_by_seller",
  "arbitration",
  "client_arbitration",
])

/**
 * Жизненный цикл отправления Ozon по его статусу и признаку `cancellation.
 * cancelled_after_ship`.
 *
 * Отмена (`status === "cancelled"`) различается по тому, успел ли товар уехать.
 * До отгрузки — только когда Ozon прямо говорит `cancelled_after_ship: false`:
 * тогда единица на полке и возвращается в пул. Во всех остальных случаях
 * (`true` или признака нет) — `returned`: товар мог уехать и едет назад, владелец
 * добавит его через WB после осмотра. Правило плана «при сомнении — returned»:
 * ошибка в эту сторону — недосчёт одной единицы, в обратную — продажа несуществующей.
 *
 * `cancelled_from_split_pending` — Ozon разделил отправление на новые. Новые
 * отправления приходят отдельными заказами и списывают единицу сами; если
 * держать исходное открытым, единица спишется дважды. Поэтому — отмена до отгрузки.
 *
 * `SHIPPED_STATUSES` — отправление уже в пути или у покупателя, включая арбитраж.
 * Всё остальное — `open`.
 */
export function ozonLifecycle(posting: Pick<OzonPosting, "status" | "cancellation">): OrderLifecycle {
  if (posting.status === "cancelled_from_split_pending") return "cancelled_before_ship"
  if (posting.status === "cancelled") {
    return posting.cancellation?.cancelled_after_ship === false ? "cancelled_before_ship" : "returned"
  }
  if (SHIPPED_STATUSES.has(posting.status)) return "shipped"
  return "open"
}
