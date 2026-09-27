// Перенесено из finstock (27.09.2026): признак cancelled из fbs-mapper.ts
// заменён жизненным циклом синка (см. «Правила жизненного цикла» плана).
import type { OrderLifecycle } from "@sync2/shared"
import { isCancelledStatus, type WbFbsOrderStatus } from "./client"

/**
 * Жизненный цикл сборочного задания WB (FBS) по его статусу
 * (`POST /api/v3/orders/status`).
 *
 * Возврат WB в этот жизненный цикл не попадает вовсе: возвраты приходят
 * отдельным сигналом снимка остатков (см. план, «Правила жизненного цикла»,
 * строка WB), а заказы WB в пул не идут — WB остаётся мастером остатка.
 *
 * Порядок проверок: отсутствие статуса — `open` (задание из `/orders/new`
 * ещё не дособрано, и статус для него просто не запрашивался или не пришёл);
 * отмена (`isCancelledStatus`) — `cancelled_before_ship`; `supplierStatus
 * === "complete"` — `shipped` (передано в доставку); всё остальное — `open`.
 */
export function wbLifecycle(status: WbFbsOrderStatus | undefined): OrderLifecycle {
  if (!status) return "open"
  if (isCancelledStatus(status)) return "cancelled_before_ship"
  if (status.supplierStatus === "complete") return "shipped"
  return "open"
}
