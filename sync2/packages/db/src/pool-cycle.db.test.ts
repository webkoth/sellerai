import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { MAX_STOCK_CHANGES_PER_RUN, WB_SETTLE_MINUTES, planStockWrites, reconcilePool, toPoolOrders } from "@sync2/domain"
import type { NormalizedStock } from "@sync2/shared"
import { seedChannels } from "./channels-seed"
import { loadOrdersSince, upsertOrders, type OrderUpsert } from "./orders"
import { loadPoolState, savePoolRun } from "./pool-store"
import { channels } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

const s = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse: null })
const order = (externalId: string, patch: Partial<OrderUpsert> = {}): OrderUpsert => ({
  externalId,
  line: 0,
  barcode: "A",
  quantity: 1,
  lifecycle: "open",
  occurredAt: "2026-09-26T10:00:00.000Z",
  raw: {},
  ...patch,
})

describe.skipIf(!TEST_DATABASE_URL)("сквозной цикл пула", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let id: (code: string) => number
  let n = 0

  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    const map = new Map((await h.db.select().from(channels)).map((c) => [c.code, c.id]))
    id = (code) => map.get(code)!
  })
  afterAll(async () => h?.close())

  /** Один прогон: чтение состояния и заказов → reconcilePool → сохранение. */
  async function tick(now: string, wb: { takenAt: string; stocks: NormalizedStock[] }) {
    const runId = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
    await insertRun(h.db, runId)
    const state = await loadPoolState(h.db)
    const { orders } = toPoolOrders(await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z"), id("wb"))
    const result = reconcilePool({ now, items: state.items, wbSnapshot: wb, orders, applied: state.applied, cancelledApplied: state.cancelledApplied, settleMinutes: WB_SETTLE_MINUTES })
    await savePoolRun(h.db, { runId, items: result.items, events: result.events })
    return result
  }
  const base = async () => (await loadPoolState(h.db)).items.find((i) => i.barcode === "A")?.base

  it("1. холодный старт: база = снимок WB", async () => {
    await tick("2026-09-26T10:00:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(await base()).toBe(3)
  })

  it("2. продажа на Ozon списывает единицу", async () => {
    await upsertOrders(h.db, id("ozon"), [order("OZ-1")])
    const r = await tick("2026-09-26T10:05:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(r.events.map((e) => e.kind)).toEqual(["order"])
    expect(await base()).toBe(2)
  })

  it("3. повтор без новых данных — ни событий, ни изменений", async () => {
    const r = await tick("2026-09-26T10:10:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(r.events).toEqual([])
    expect(await base()).toBe(2)
  })

  it("4. отмена до отправки возвращает единицу ровно один раз", async () => {
    await upsertOrders(h.db, id("ozon"), [order("OZ-1", { lifecycle: "cancelled_before_ship" })])
    await tick("2026-09-26T10:15:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    await tick("2026-09-26T10:16:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(await base()).toBe(3)
  })

  it("5. возврат после доставки единицу не возвращает", async () => {
    await upsertOrders(h.db, id("kit"), [order("KIT-1")])
    await tick("2026-09-26T10:20:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    await upsertOrders(h.db, id("kit"), [order("KIT-1", { lifecycle: "returned" })])
    await tick("2026-09-26T10:21:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(await base()).toBe(2)
  })

  it("6. заказ WB в пул не вычитается — продажа на WB приходит сигналом из снимка", async () => {
    await upsertOrders(h.db, id("wb"), [order("WB-1")])
    // Ожидание менялось в 10:20 (заказ KIT) — снимок через 20+ минут принимается.
    const r = await tick("2026-09-26T10:45:00.000Z", { takenAt: "2026-09-26T10:41:00.000Z", stocks: [s("A", 1)] })
    expect(r.events.map((e) => e.kind)).toEqual(["wb_signal"])
    expect(await base()).toBe(1)
  })

  it("7. план записей в KIT: остаток сводится к пулу, сирота обнуляется", async () => {
    const { items } = await loadPoolState(h.db)
    const plan = planStockWrites(items, [{ channel: "kit", stocks: [s("A", 3), s("Z", 1)] }], { maxChanges: MAX_STOCK_CHANGES_PER_RUN })
    expect(plan.aborted).toBeNull()
    expect(plan.changes).toEqual([
      { channel: "kit", barcode: "A", externalSku: null, before: 3, after: 1, orphan: false },
      { channel: "kit", barcode: "Z", externalSku: null, before: 1, after: 0, orphan: true },
    ])
  })
})
