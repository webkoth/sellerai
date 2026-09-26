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
 */
export async function upsertOrders(db: Db, channelId: number, rows: OrderUpsert[]): Promise<number> {
  if (rows.length === 0) return 0
  await db
    .insert(ordersRaw)
    .values(rows.map((r) => ({ ...r, channelId })))
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
  return rows.length
}

/** Заказы всех площадок с момента `since` (ISO) — вход для toPoolOrders. */
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
