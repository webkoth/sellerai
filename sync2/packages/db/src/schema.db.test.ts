import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { channels, ordersRaw, poolEvents, poolItems, products, stockSnapshotsRaw, writes } from "./schema"
import { TEST_DATABASE_URL, expectConstraint, freshTestDb, insertRun } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("ограничения схемы на живой базе", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let kitId: number

  beforeAll(async () => {
    h = await freshTestDb()
    const [kit] = await h.db.insert(channels).values({ code: "kit", title: "Яндекс KIT" }).returning()
    kitId = kit!.id
    await h.db.insert(products).values({ barcode: "2041383032873", title: "Браслет" })
    for (const id of ["01", "02", "03", "04", "05"]) await insertRun(h.db, `00000000-0000-4000-8000-0000000000${id}`)
  })
  afterAll(async () => h?.close())

  const order = (externalId: string) => ({
    channelId: kitId,
    externalId,
    barcode: "2041383032873",
    quantity: 1,
    lifecycle: "open",
    occurredAt: "2026-09-26T10:00:00Z",
    raw: {},
  })

  it("неизвестная площадка не проходит check", async () => {
    await expectConstraint(h.db.insert(channels).values({ code: "avito", title: "Авито" }), "channels_code_check")
  })

  it("неизвестный режим записи не проходит check", async () => {
    await expectConstraint(
      h.db.insert(channels).values({ code: "ym", title: "ЯМ", writeMode: "yes" }),
      "channels_write_mode_check",
    )
  })

  it("одна и та же строка заказа не записывается дважды", async () => {
    await h.db.insert(ordersRaw).values(order("KIT-1"))
    await expectConstraint(h.db.insert(ordersRaw).values(order("KIT-1")), "orders_raw_channel_ext_line_idx")
  })

  it("неизвестный статус заказа не проходит check", async () => {
    await expectConstraint(
      h.db.insert(ordersRaw).values({ ...order("KIT-2"), lifecycle: "lost" }),
      "orders_raw_lifecycle_check",
    )
  })

  it("заказ списывается из пула ровно один раз", async () => {
    const [o] = await h.db.insert(ordersRaw).values(order("KIT-3")).returning()
    const ev = {
      barcode: "2041383032873",
      kind: "order",
      delta: -1,
      baseBefore: 2,
      baseAfter: 1,
      channelId: kitId,
      orderId: o!.id,
      occurredAt: "2026-09-26T10:00:00Z",
      runId: "00000000-0000-4000-8000-000000000001",
    }
    await h.db.insert(poolEvents).values(ev)
    await expectConstraint(h.db.insert(poolEvents).values(ev), "pool_events_order_kind_idx")
  })

  it("событие заказа без номера заказа не проходит — иначе дубль обошёл бы индекс", async () => {
    await expectConstraint(
      h.db.insert(poolEvents).values({
        barcode: "2041383032873",
        kind: "order",
        delta: -1,
        baseBefore: 1,
        baseAfter: 0,
        occurredAt: "2026-09-26T10:00:00Z",
        runId: "00000000-0000-4000-8000-000000000003",
      }),
      "pool_events_order_ref_check",
    )
  })

  it("ручные события без заказа не упираются в индекс заказа", async () => {
    const manual = {
      barcode: "2041383032873",
      kind: "manual",
      delta: 1,
      baseBefore: 1,
      baseAfter: 2,
      occurredAt: "2026-09-26T11:00:00Z",
      runId: "00000000-0000-4000-8000-000000000002",
    }
    await h.db.insert(poolEvents).values(manual)
    await h.db.insert(poolEvents).values(manual)
  })

  const RUN = "00000000-0000-4000-8000-000000000004"

  it("один снимок WB даёт не больше одного сигнала на баркод", async () => {
    const sig = {
      barcode: "2041383032873",
      kind: "wb_signal",
      delta: -1,
      baseBefore: 2,
      baseAfter: 1,
      snapshotAt: "2026-09-26T10:00:00Z",
      occurredAt: "2026-09-26T10:01:00Z",
      runId: RUN,
    }
    await h.db.insert(poolEvents).values(sig)
    await expectConstraint(h.db.insert(poolEvents).values(sig), "pool_events_snapshot_kind_idx")
  })

  it("сигнал WB без момента снимка не проходит", async () => {
    await expectConstraint(
      h.db.insert(poolEvents).values({
        barcode: "2041383032873",
        kind: "wb_signal",
        delta: -1,
        baseBefore: 2,
        baseAfter: 1,
        occurredAt: "2026-09-26T10:01:00Z",
        runId: RUN,
      }),
      "pool_events_snapshot_ref_check",
    )
  })

  it("событие пула без запуска в журнале не проходит", async () => {
    await expectConstraint(
      h.db.insert(poolEvents).values({
        barcode: "2041383032873",
        kind: "manual",
        delta: 1,
        baseBefore: 0,
        baseAfter: 1,
        occurredAt: "2026-09-26T10:01:00Z",
        runId: "00000000-0000-4000-8000-0000000000ee",
      }),
      "pool_events_run_id_runs_run_id_fk",
    )
  })

  it("два снимка одной площадки с одним моментом не проходят", async () => {
    const snap = { channelId: kitId, takenAt: "2026-09-26T10:00:00Z", runId: RUN, stocks: [] }
    await h.db.insert(stockSnapshotsRaw).values(snap)
    await expectConstraint(h.db.insert(stockSnapshotsRaw).values(snap), "stock_snapshots_channel_taken_idx")
  })

  it("одно поле товара дважды в одном запуске записей не проходит", async () => {
    const w = { runId: RUN, channelId: kitId, barcode: "2041383032873", field: "stock", before: 2, after: 1, mode: "dry-run", applied: false }
    await h.db.insert(writes).values(w)
    await expectConstraint(h.db.insert(writes).values(w), "writes_run_channel_barcode_field_idx")
  })

  it("неизвестное поле записи не проходит", async () => {
    await expectConstraint(
      h.db.insert(writes).values({ runId: RUN, channelId: kitId, barcode: "X", field: "title", after: 1, mode: "off", applied: false }),
      "writes_field_check",
    )
  })

  it("отрицательная база пула не проходит", async () => {
    await expectConstraint(h.db.insert(poolItems).values({ barcode: "NEG", base: -1, wbExpected: 0 }), "pool_items_base_check")
  })
})
