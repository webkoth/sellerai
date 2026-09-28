import type { OrderLifecycle } from "@sync2/shared"

/**
 * Жизненный цикл заказа сайта. У сайта один статус — `new`: заказ принят,
 * его обрабатывает владелец вручную, а отмену он возвращает остатком через WB
 * (решение владельца, 1.3c). Любой другой статус, который появится позже, —
 * `returned`: правило «при сомнении — returned» (план 1.3a) — ошибка в эту
 * сторону даёт недосчёт одной единицы, в обратную — продажу несуществующей.
 */
export function siteLifecycle(status: string): OrderLifecycle {
  return status === "new" ? "open" : "returned"
}
