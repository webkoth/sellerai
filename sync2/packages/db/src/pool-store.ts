import { inArray, sql } from "drizzle-orm"
import type { PoolEvent, PoolItemState } from "@sync2/domain"
import type { Db } from "./client"
import { poolEvents, poolItems } from "./schema"
import { toIsoOrNull } from "./time"

export interface PoolState {
  items: PoolItemState[]
  /** Заказы, по которым уже есть событие order. */
  applied: Set<number>
  /** Заказы, по которым уже есть событие cancel. */
  cancelledApplied: Set<number>
}

/**
 * Состояние пула для reconcilePool. Множества строятся конструктором запросов:
 * он отдаёт order_id числом (режим number), а сырой SQL — строкой, и тогда
 * Set.has(number) всегда false — заказы списались бы повторно.
 */
export async function loadPoolState(db: Db): Promise<PoolState> {
  const rows = await db.select().from(poolItems).orderBy(poolItems.barcode)
  const items = rows.map((r) => ({
    barcode: r.barcode,
    base: r.base,
    wbExpected: r.wbExpected,
    expectedAt: toIsoOrNull(r.expectedAt),
    wbSnapshotAt: toIsoOrNull(r.wbSnapshotAt),
  }))
  const events = await db
    .select({ orderId: poolEvents.orderId, kind: poolEvents.kind })
    .from(poolEvents)
    .where(inArray(poolEvents.kind, ["order", "cancel"]))
  const applied = new Set<number>()
  const cancelledApplied = new Set<number>()
  for (const e of events) {
    if (e.orderId === null) continue
    if (e.kind === "order") applied.add(e.orderId)
    else cancelledApplied.add(e.orderId)
  }
  return { items, applied, cancelledApplied }
}

/**
 * Итог прогона пула — одной транзакцией: состояние и события вместе или ничего.
 * Повтор события (второй прогон с теми же заказами) отсекает уникальный индекс,
 * и откатывается весь прогон — состояние не разъедется с журналом.
 */
export async function savePoolRun(
  db: Db,
  run: { runId: string; items: PoolItemState[]; events: PoolEvent[] },
): Promise<void> {
  await db.transaction(async (tx) => {
    if (run.items.length > 0) {
      await tx
        .insert(poolItems)
        .values(run.items)
        .onConflictDoUpdate({
          target: poolItems.barcode,
          set: {
            base: sql`excluded.base`,
            wbExpected: sql`excluded.wb_expected`,
            expectedAt: sql`excluded.expected_at`,
            wbSnapshotAt: sql`excluded.wb_snapshot_at`,
            updatedAt: sql`now()`,
          },
        })
    }
    if (run.events.length > 0) {
      await tx.insert(poolEvents).values(run.events.map((e) => ({ ...e, runId: run.runId })))
    }
  })
}
