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
 * Отмена (`status === "cancelled"`) различается по тому, успел ли товар
 * уехать: `cancelled_after_ship: true` — единица уже была отгружена и едет
 * назад, это `returned` (владелец увидит её через WB после осмотра);
 * `false` или отсутствие поля (документация Ozon не гарантирует его
 * наличие на всех статусах) — отмена до отгрузки, `cancelled_before_ship`.
 * Правило выбора при сомнении (план, «Правила жизненного цикла»): при любой
 * неопределённости — `returned`, а не `cancelled_before_ship`, ошибка в эту
 * сторону даёт лишь недосчёт одной единицы, а не продажу несуществующей —
 * поэтому строгое равенство `=== true`, а не «всё, что не false».
 *
 * `SHIPPED_STATUSES` — статусы, при которых отправление уже в пути или у
 * покупателя, включая арбитраж (спор об уже отгруженном товаре — товар всё
 * ещё физически не в пуле продавца). Всё остальное — `open`.
 */
export function ozonLifecycle(posting: Pick<OzonPosting, "status" | "cancellation">): OrderLifecycle {
  if (posting.status === "cancelled") {
    return posting.cancellation?.cancelled_after_ship === true ? "returned" : "cancelled_before_ship"
  }
  if (SHIPPED_STATUSES.has(posting.status)) return "shipped"
  return "open"
}
