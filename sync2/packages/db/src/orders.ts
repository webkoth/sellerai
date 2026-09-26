import { gte, sql } from "drizzle-orm"
import type { OrderRowForPool } from "@sync2/domain"
import type { OrderLifecycle } from "@sync2/shared"
import type { Db } from "./client"
import { ordersRaw } from "./schema"
import { toIso } from "./time"

/** Строка заказа от адаптера площадки: статус уже переведён в жизненный цикл синка. */
export interface OrderUpsert {
  externalId: string
  line: number
  barcode: string | null
  quantity: number
  lifecycle: OrderLifecycle
  occurredAt: string
  raw: unknown
}

/**
 * Идемпотентная запись заказов площадки: новая строка вставляется, известная —
 * обновляет статус, баркод, количество и сырьё. updated_at ставится явно:
 * defaultNow() работает только на вставке.
 *
 * Внутри одной пачки строки с одинаковым `(externalId, line)` схлопываются в
 * последнюю: постранично пересекающиеся выдачи площадки иначе дают дубль
 * ключа в одном INSERT, и Postgres роняет весь запрос ("ON CONFLICT DO UPDATE
 * command cannot affect row a second time" — конфликтовать со строкой можно
 * только один раз за команду).
 */
export async function upsertOrders(db: Db, channelId: number, rows: OrderUpsert[]): Promise<number> {
  if (rows.length === 0) return 0
  const dedup = new Map<string, OrderUpsert>()
  for (const r of rows) dedup.set(`${r.externalId}\u0000${r.line}`, r)
  const values = [...dedup.values()]
  await db
    .insert(ordersRaw)
    .values(values.map((r) => ({ ...r, channelId })))
    .onConflictDoUpdate({
      target: [ordersRaw.channelId, ordersRaw.externalId, ordersRaw.line],
      set: {
        lifecycle: sql`excluded.lifecycle`,
        barcode: sql`excluded.barcode`,
        quantity: sql`excluded.quantity`,
        raw: sql`excluded.raw`,
        updatedAt: sql`now()`,
      },
    })
  return values.length
}

/**
 * Заказы всех площадок с момента `since` (ISO) — вход для toPoolOrders.
 *
 * `since` — щедрое скользящее окно, а не «с прошлого прогона»: обновление
 * жизненного цикла сохраняет исходный `occurredAt` заказа, поэтому поздняя
 * отмена старого заказа видна, только пока сам заказ ещё внутри окна. План —
 * не короче 60 дней (см. «Контракт адаптеров для плана 1.3»).
 */
export async function loadOrdersSince(db: Db, since: string): Promise<OrderRowForPool[]> {
  const rows = await db
    .select({
      id: ordersRaw.id,
      channelId: ordersRaw.channelId,
      barcode: ordersRaw.barcode,
      quantity: ordersRaw.quantity,
      lifecycle: ordersRaw.lifecycle,
      occurredAt: ordersRaw.occurredAt,
    })
    .from(ordersRaw)
    .where(gte(ordersRaw.occurredAt, since))
    .orderBy(ordersRaw.id)
  return rows.map((r) => ({ ...r, lifecycle: r.lifecycle as OrderLifecycle, occurredAt: toIso(r.occurredAt) }))
}
