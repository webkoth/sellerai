import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadChannels } from "./channels"
import { seedChannels } from "./channels-seed"
import { countSuspectedDoubleCounts, DOUBLE_COUNT_WINDOW_MINUTES, mirrorOrderBarcodesSince } from "./compare-query"
import { upsertOrders } from "./orders"
import { ordersRaw, poolEvents } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

const RUN = "00000000-0000-4000-8000-0000000000c1"

describe.skipIf(!TEST_DATABASE_URL)("compare-query: шум двойного счёта в сверке", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let orderIds: number[]
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, RUN)
    const ozon = (await loadChannels(h.db)).get("ozon")!.id
    await upsertOrders(
      h.db,
      ozon,
      ["O1", "O2", "O3", "O4", "O5", "O6"].map((externalId) => ({ externalId, line: 0, barcode: "X", quantity: 1, lifecycle: "open" as const, occurredAt: "2026-09-27T08:00:00.000Z", raw: {} })),
    )
    orderIds = (await h.db.select({ id: ordersRaw.id }).from(ordersRaw).orderBy(ordersRaw.id)).map((r) => r.id)
    const ev = (barcode: string, kind: "order" | "cancel" | "wb_signal", occurredAt: string, orderId: number | null = null, delta = kind === "order" ? -1 : 1) => ({
      barcode,
      kind,
      delta,
      baseBefore: 1,
      baseAfter: 1,
      channelId: null,
      orderId,
      snapshotAt: kind === "wb_signal" ? occurredAt : null,
      occurredAt,
      runId: RUN,
      detail: null,
    })
    await h.db.insert(poolEvents).values([
      // A: заказ 10:00, сигнал WB 10:20 — в пределах окна: подозрение.
      ev("A", "order", "2026-09-27T10:00:00.000Z", orderIds[0]),
      ev("A", "wb_signal", "2026-09-27T10:20:00.000Z"),
      // F: заказ 10:00, сигнал 10:35 — типичный случай: settle 20 мин + два тика. Раньше окно 30 мин его резало.
      ev("F", "order", "2026-09-27T10:00:00.000Z", orderIds[4]),
      ev("F", "wb_signal", "2026-09-27T10:35:00.000Z"),
      // B: заказ 10:00, сигнал WB 10:45 — дальше 40 мин: не подозрение.
      ev("B", "order", "2026-09-27T10:00:00.000Z", orderIds[1]),
      ev("B", "wb_signal", "2026-09-27T10:45:00.000Z"),
      // C: сигнал WB в том же прогоне, что и отмена (одно время) — заказ не предшествовал.
      ev("C", "cancel", "2026-09-27T11:00:00.000Z", orderIds[2]),
      ev("C", "wb_signal", "2026-09-27T11:00:00.000Z"),
      // D: отмена 11:30, сигнал 11:50 — отмена тоже в счёт.
      ev("D", "cancel", "2026-09-27T11:30:00.000Z", orderIds[3]),
      ev("D", "wb_signal", "2026-09-27T11:50:00.000Z"),
      // E: заказ по другому баркоду рядом — не в счёт.
      ev("E", "wb_signal", "2026-09-27T10:10:00.000Z"),
      // G: заказ холодного старта (delta 0 — учтён без вычитания), сигнал через 10 мин — не в счёт.
      ev("G", "order", "2026-09-27T12:00:00.000Z", orderIds[5], 0),
      ev("G", "wb_signal", "2026-09-27T12:10:00.000Z"),
    ])
  })
  afterAll(async () => h?.close())

  it("подозрение на двойной счёт: сигнал WB, которому за ≤40 мин предшествовал заказ/отмена зеркала по тому же баркоду", async () => {
    expect(DOUBLE_COUNT_WINDOW_MINUTES).toBe(40)
    // A, F (35 мин), D; не B (45 мин), C (тот же прогон), E (заказа нет), G (холодный старт).
    expect(await countSuspectedDoubleCounts(h.db, "2026-09-27T00:00:00.000Z")).toBe(3)
    // Окно суток: сигналы раньше since не считаются.
    expect(await countSuspectedDoubleCounts(h.db, "2026-09-27T11:40:00.000Z")).toBe(1)
  })

  it("баркоды с заказом/отменой зеркала с момента since; заказ холодного старта (delta 0) — нет", async () => {
    expect([...(await mirrorOrderBarcodesSince(h.db, "2026-09-27T11:00:00.000Z"))].sort()).toEqual(["C", "D"])
    expect(await mirrorOrderBarcodesSince(h.db, "2026-09-27T12:00:00.000Z")).toEqual(new Set())
  })
})
