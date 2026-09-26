import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PoolEvent, PoolItemState } from "@sync2/domain"
import { seedChannels } from "./channels-seed"
import { upsertOrders } from "./orders"
import { loadPoolState, savePoolRun } from "./pool-store"
import { channels, ordersRaw, poolItems } from "./schema"
import { TEST_DATABASE_URL, expectConstraint, freshTestDb, insertRun } from "./test-db"

const RUN1 = "00000000-0000-4000-8000-0000000000d1"
const RUN2 = "00000000-0000-4000-8000-0000000000d2"

const item: PoolItemState = {
  barcode: "A",
  base: 1,
  wbExpected: 1,
  expectedAt: "2026-09-26T10:00:00.000Z",
  wbSnapshotAt: "2026-09-26T09:55:00.000Z",
}

describe.skipIf(!TEST_DATABASE_URL)("хранилище пула", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ozon: number
  let orderId: number
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, RUN1)
    await insertRun(h.db, RUN2)
    ozon = (await h.db.select().from(channels)).find((c) => c.code === "ozon")!.id
    await upsertOrders(h.db, ozon, [
      { externalId: "OZ-1", line: 0, barcode: "A", quantity: 1, lifecycle: "open", occurredAt: "2026-09-26T10:00:00.000Z", raw: {} },
    ])
    orderId = (await h.db.select().from(ordersRaw))[0]!.id
  })
  afterAll(async () => h?.close())

  const orderEvent = (): PoolEvent => ({
    barcode: "A",
    kind: "order",
    delta: -1,
    baseBefore: 2,
    baseAfter: 1,
    channelId: ozon,
    orderId,
    snapshotAt: null,
    occurredAt: "2026-09-26T10:00:00.000Z",
    detail: null,
  })

  it("пустая база — пустое состояние", async () => {
    expect(await loadPoolState(h.db)).toEqual({ items: [], applied: new Set(), cancelledApplied: new Set() })
  })

  it("сохранение и чтение: состояние в ISO, учтённый заказ — числом в множестве", async () => {
    await savePoolRun(h.db, { runId: RUN1, items: [item], events: [orderEvent()] })
    const state = await loadPoolState(h.db)
    expect(state.items).toEqual([item])
    expect(state.applied.has(orderId)).toBe(true)
    expect(state.cancelledApplied.size).toBe(0)
  })

  it("повтор того же события — откат всего прогона, состояние не меняется", async () => {
    await expectConstraint(
      savePoolRun(h.db, { runId: RUN2, items: [{ ...item, base: 0, wbExpected: 0 }], events: [orderEvent()] }),
      "pool_events_order_kind_idx",
    )
    const [row] = await h.db.select().from(poolItems)
    expect(row!.base).toBe(1)
  })

  it("прогон без событий обновляет только состояние", async () => {
    await savePoolRun(h.db, { runId: RUN2, items: [{ ...item, base: 3, wbExpected: 3 }], events: [] })
    expect((await loadPoolState(h.db)).items[0]?.base).toBe(3)
  })
})
