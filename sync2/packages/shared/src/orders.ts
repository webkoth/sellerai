/**
 * Жизненный цикл строки заказа в синке — общий для всех площадок; адаптер
 * переводит статусы площадки в эти четыре.
 * open — принят, не отправлен; shipped — отправлен; cancelled_before_ship —
 * отменён до отправки (товар не уезжал); returned — возврат после доставки.
 */
export const ORDER_LIFECYCLES = ["open", "shipped", "cancelled_before_ship", "returned"] as const
export type OrderLifecycle = (typeof ORDER_LIFECYCLES)[number]
