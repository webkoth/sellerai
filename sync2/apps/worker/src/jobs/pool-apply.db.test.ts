import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { channels, drizzleRunStore, insertStockSnapshot, loadChannels, runs as runsTable, seedChannels, upsertOrders, upsertProducts, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { SendResult, WriteOp } from "@sync2/platforms"
import type { Channel, NormalizedStock, WriteMode } from "@sync2/shared"
import { and, eq } from "drizzle-orm"
import { runPool } from "./pool"

const s = (barcode: string, quantity: number, externalSku: string | null = null, warehouse: string | null = null): NormalizedStock => ({
  barcode,
  externalSku,
  quantity,
  warehouse,
})
const okSend = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true })))

/** Общая обвязка: своя чистая база на describe, журнал runs, снимки и режимы площадок. */
function harness() {
  const ctx = {} as {
    h: Awaited<ReturnType<typeof freshTestDb>>
    ids: Awaited<ReturnType<typeof loadChannels>>
  }
  let n = 0
  const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  const runId = async () => {
    const id = nextId()
    await insertRun(ctx.h.db, id)
    return id
  }
  /** Завершённый ingest со счётчиками: pool читает из него сбои заказов, каталог и источник витрины сайта. */
  const ingestRun = async (at: string, counters: Record<string, number> = {}) => {
    const store = drizzleRunStore(ctx.h.db)
    const id = nextId()
    await store.start({ runId: id, job: "ingest", writeMode: "apply", startedAt: at })
    await store.finish(id, { status: Object.keys(counters).some((k) => k.endsWith("OrdersFailed")) ? "partial" : "ok", finishedAt: at, counters, error: null })
  }
  const snap = async (c: Channel, at: string, stocks: NormalizedStock[]) =>
    insertStockSnapshot(ctx.h.db, { channelId: ctx.ids.get(c)!.id, runId: await runId(), takenAt: at, stocks })
  const mode = (c: Channel, m: WriteMode) => ctx.h.db.update(channels).set({ writeMode: m }).where(eq(channels.code, c))
  const logged = async (pid: string, c: Channel) =>
    (await ctx.h.db.select().from(writes).where(and(eq(writes.runId, pid), eq(writes.channelId, ctx.ids.get(c)!.id)))).map((w) => [
      w.barcode,
      w.before,
      w.after,
      w.mode,
      w.applied,
    ])
  const pool = async (at: string, send: ReturnType<typeof okSend>, warehouses: { wbWarehouseId?: number; ymWarehouseId?: number; ozonWarehouseId?: number } = {}) => {
    const pid = await runId()
    const r = await runPool({ db: ctx.h.db, now: () => new Date(at), runId: pid, globalMode: "apply", send, ...warehouses })
    return { pid, r }
  }
  const setup = async () => {
    ctx.h = await freshTestDb()
    await seedChannels(ctx.h.db)
    ctx.ids = await loadChannels(ctx.h.db)
  }
  return { ctx, runId, ingestRun, snap, mode, logged, pool, setup }
}

describe.skipIf(!TEST_DATABASE_URL)("runPool — запись на площадки (этап 1.4)", () => {
  const { ctx, ingestRun, snap, mode, logged, pool, setup } = harness()

  beforeAll(async () => {
    await setup()
    await mode("kit", "apply")
    await mode("ozon", "dry-run")
  })
  afterAll(async () => ctx.h?.close())

  it("площадка в apply — отправитель получает только её позиции с ключом площадки; в журнале apply/applied", async () => {
    await ingestRun("2026-09-28T10:04:00.000Z")
    await snap("wb", "2026-09-28T10:05:00.000Z", [s("A", 3), s("B", 1)])
    await snap("kit", "2026-09-28T10:05:00.000Z", [s("A", 2, "var-A"), s("B", 1, "var-B")])
    await snap("ozon", "2026-09-28T10:05:00.000Z", [s("A", 3, "JW-A"), s("B", 0, "JW-B")])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T10:06:00.000Z", send)
    expect(r.status).toBe("ok")
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith("kit", [{ channel: "kit", barcode: "A", field: "stock", before: 2, after: 3, externalSku: "var-A" }])
    expect(await logged(pid, "kit")).toEqual([["A", 2, 3, "apply", true]])
    expect(await logged(pid, "ozon")).toEqual([["B", 0, 1, "dry-run", false]])
    expect(r.counters).toMatchObject({ kitPlanned: 1, kitApplied: 1, ozonPlanned: 1, wbSelf: 0 })
    expect(r.counters).not.toHaveProperty("wbPlanned")
  })

  it("сбой чтения заказов зеркала в последнем ingest — запись НЕ блокируется (решение владельца 28.09, п. 1): только счётчик", async () => {
    await ingestRun("2026-09-28T10:09:00.000Z", { ozonOrdersFailed: 1 })
    await snap("wb", "2026-09-28T10:10:00.000Z", [s("A", 3), s("B", 1)])
    await snap("kit", "2026-09-28T10:10:00.000Z", [s("A", 1, "var-A"), s("B", 1, "var-B")])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T10:11:00.000Z", send)
    expect(send).toHaveBeenCalledWith("kit", [expect.objectContaining({ barcode: "A", before: 1, after: 3 })])
    expect(await logged(pid, "kit")).toEqual([["A", 1, 3, "apply", true]])
    expect(r).toMatchObject({ status: "ok", counters: { mirrorOrdersFailed: 1, kitApplied: 1 } })
    expect(r.counters).not.toHaveProperty("writesBlockedOrders")
  })

  it("каталог WB отклонён в последнем ingest — запись не делается", async () => {
    await ingestRun("2026-09-28T10:12:00.000Z", { catalogRejected: 1 })
    await snap("kit", "2026-09-28T10:12:00.000Z", [s("A", 1, "var-A"), s("B", 1, "var-B")])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T10:13:00.000Z", send)
    expect(send).not.toHaveBeenCalled()
    expect(await logged(pid, "kit")).toEqual([["A", 1, 3, "dry-run", false]])
    expect(r).toMatchObject({ status: "partial", counters: { writesBlockedCatalog: 1 } })
    expect(r.error).toMatch(/каталог WB отклонён/)
  })

  it("сайт в apply, а витрина не на пуле — запись сайта не делается, остальные пишутся", async () => {
    await mode("site", "apply")
    await ingestRun("2026-09-28T10:14:00.000Z", { siteSourcePool: 0 })
    await snap("wb", "2026-09-28T10:15:00.000Z", [s("A", 3), s("B", 1)])
    await snap("site", "2026-09-28T10:15:00.000Z", [s("A", 5), s("B", 1)])
    await snap("kit", "2026-09-28T10:15:00.000Z", [s("A", 1, "var-A"), s("B", 1, "var-B")])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T10:16:00.000Z", send)
    expect(send.mock.calls.map((c) => c[0])).toEqual(["kit"])
    expect(await logged(pid, "site")).toEqual([["A", 5, 3, "dry-run", false]])
    expect(r).toMatchObject({ status: "partial", counters: { siteWriteBlocked: 1 } })
    expect(r.error).toMatch(/сайт: витрина берёт остаток не из пула/)
    await mode("site", "off")
  })

  it("сайт в apply, а снимок витрины не прочитан (нет siteSourcePool) — запись сайта не делается, причина — «не прочитан»", async () => {
    await mode("site", "apply")
    await ingestRun("2026-09-28T10:16:30.000Z")
    await snap("wb", "2026-09-28T10:16:30.000Z", [s("A", 3), s("B", 1)])
    const { r } = await pool("2026-09-28T10:16:40.000Z", okSend())
    expect(r).toMatchObject({ status: "partial", counters: { siteWriteBlocked: 1 } })
    expect(r.error).toMatch(/сайт: снимок витрины не прочитан/)
    await mode("site", "off")
  })

  it("сайт в apply и витрина на пуле — пишется по штрихкоду", async () => {
    await mode("site", "apply")
    await ingestRun("2026-09-28T10:17:00.000Z", { siteSourcePool: 1 })
    await snap("wb", "2026-09-28T10:17:00.000Z", [s("A", 3), s("B", 1)])
    await snap("site", "2026-09-28T10:17:00.000Z", [s("A", 5), s("B", 1)])
    await snap("kit", "2026-09-28T10:17:00.000Z", [s("A", 3, "var-A"), s("B", 1, "var-B")])
    const send = okSend()
    const { r } = await pool("2026-09-28T10:18:00.000Z", send)
    expect(send).toHaveBeenCalledWith("site", [{ channel: "site", barcode: "A", field: "stock", before: 5, after: 3, externalSku: "A" }])
    expect(r).toMatchObject({ status: "ok", counters: { siteApplied: 1 } })
    await mode("site", "off")
  })

  it("предохранитель одной площадки не останавливает другую", async () => {
    await mode("ozon", "apply")
    await ingestRun("2026-09-28T10:19:00.000Z")
    await snap("wb", "2026-09-28T10:20:00.000Z", [s("A", 3), s("B", 1)])
    // 21 сирота KIT с остатком — 21 «в ноль» при пределе 20; Ozon — обычное расхождение.
    await snap("kit", "2026-09-28T10:20:00.000Z", Array.from({ length: 21 }, (_, i) => s(`Z${i}`, 1, `var-Z${i}`)))
    await snap("ozon", "2026-09-28T10:20:00.000Z", [s("A", 2, "JW-A"), s("B", 1, "JW-B")])
    const send = okSend()
    const { r } = await pool("2026-09-28T10:21:00.000Z", send, { ozonWarehouseId: 1020005023618600 })
    expect(send.mock.calls.map((c) => c[0])).toEqual(["ozon"])
    expect(r.counters).toMatchObject({ kitAborted_to_zero: 21, kitPlanned: 0, ozonApplied: 1 })
    expect(r.error).toMatch(/KIT: план отклонён предохранителем \(to_zero: 21 при пределе 20\)/)
    await mode("ozon", "dry-run")
  })

  it("ЯМ: остаток в снимке не только на складе записи — запись ЯМ не делается, остальные пишутся", async () => {
    await mode("ym", "apply")
    await ingestRun("2026-09-28T10:21:30.000Z")
    await snap("wb", "2026-09-28T10:21:30.000Z", [s("A", 3), s("B", 1)])
    await snap("kit", "2026-09-28T10:21:30.000Z", [s("A", 2, "var-A"), s("B", 1, "var-B")])
    // Два склада магазина в YM_WAREHOUSE_IDS: снимок суммирует оба, а пишем мы в первый.
    await snap("ym", "2026-09-28T10:21:30.000Z", [s("A", 1, "JW-A", "2369574"), s("A", 1, "JW-A", "1872191"), s("B", 0, "JW-B", "2369574")])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T10:21:45.000Z", send, { ymWarehouseId: 2369574 })
    expect(send.mock.calls.map((c) => c[0])).toEqual(["kit"])
    expect(await logged(pid, "ym")).toEqual([
      ["A", 2, 3, "dry-run", false],
      ["B", 0, 1, "dry-run", false],
    ])
    expect(r).toMatchObject({ status: "partial", counters: { ymForeignWarehouse: 1 } })
    expect(r.error).toMatch(/ЯМ: в снимке склады 1872191 помимо склада записи 2369574/)

    // Склад записи ЯМ не передан — тоже блок с понятной причиной.
    const again = await pool("2026-09-28T10:21:50.000Z", okSend())
    expect(again.r.error).toMatch(/ЯМ: не задан склад записи/)
    await mode("ym", "off")
  })

  it("Ozon: остаток на втором FBS-складе — запись Ozon не делается; склад записи не передан — тоже", async () => {
    await mode("ozon", "apply")
    await ingestRun("2026-09-28T10:21:52.000Z")
    await snap("wb", "2026-09-28T10:21:52.000Z", [s("A", 3), s("B", 1)])
    await snap("kit", "2026-09-28T10:21:52.000Z", [s("A", 2, "var-A"), s("B", 1, "var-B")])
    await snap("ozon", "2026-09-28T10:21:52.000Z", [s("A", 2, "JW-A", "fbs:22,1020005023618600"), s("B", 0, "JW-B", "fbs")])
    const send = okSend()
    const { r } = await pool("2026-09-28T10:21:53.000Z", send, { ozonWarehouseId: 1020005023618600 })
    expect(send.mock.calls.map((c) => c[0])).toEqual(["kit"])
    expect(r).toMatchObject({ status: "partial", counters: { ozonForeignWarehouse: 1 } })
    expect(r.error).toMatch(/Ozon: в снимке склады FBS 22 помимо склада записи 1020005023618600/)
    const again = await pool("2026-09-28T10:21:54.000Z", okSend())
    expect(again.r.error).toMatch(/Ozon: не задан OZON_WAREHOUSE_ID/)
    await mode("ozon", "dry-run")
  })

  it("штрихкод на двух товарах KIT — запись этого штрихкода не планируется, счётчик и текст; остальные пишутся", async () => {
    await ingestRun("2026-09-28T10:21:55.000Z")
    await snap("wb", "2026-09-28T10:21:55.000Z", [s("A", 3), s("B", 1)])
    await snap("kit", "2026-09-28T10:21:55.000Z", [s("A", 1, "var-A"), s("A", 0, "var-A2"), s("B", 0, "var-B")])
    const send = okSend()
    const { r } = await pool("2026-09-28T10:21:58.000Z", send)
    expect(send).toHaveBeenCalledWith("kit", [{ channel: "kit", barcode: "B", field: "stock", before: 0, after: 1, externalSku: "var-B" }])
    expect(r).toMatchObject({ status: "partial", counters: { kitDupKey: 1 } })
    expect(r.error).toMatch(/KIT: штрихкод на нескольких товарах площадки — запись не делается: A \(var-A, var-A2\)/)
  })

  it("итог «неизвестно» и ключ площадки — в журнал writes отдельно от отказа", async () => {
    await ingestRun("2026-09-28T10:22:00.000Z")
    await snap("wb", "2026-09-28T10:22:00.000Z", [s("A", 3), s("B", 1)])
    await snap("kit", "2026-09-28T10:22:00.000Z", [s("A", 1, "var-A"), s("B", 2, "var-B")])
    const send = vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> =>
      ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: false, error: o.barcode === "A" ? "таймаут" : "409", uncertain: o.barcode === "A" })),
    )
    const { pid, r } = await pool("2026-09-28T10:23:00.000Z", send)
    const rows = await ctx.h.db.select().from(writes).where(and(eq(writes.runId, pid), eq(writes.channelId, ctx.ids.get("kit")!.id)))
    expect(rows.map((w) => [w.barcode, w.externalSku, w.applied, w.uncertain]).sort()).toEqual([
      ["A", "var-A", false, true],
      ["B", "var-B", false, false],
    ])
    expect(r).toMatchObject({ status: "partial", counters: { writeErrors: 2 } })
  })
})

/**
 * Решение владельца 28.09, п. 1 — сквозной сценарий: сбой чтения заказов ВСЕХ зеркал в последнем
 * ingest; все пять площадок в apply (WB — режим self) — план и запись каждой площадки идут.
 */
describe.skipIf(!TEST_DATABASE_URL)("runPool — сбой заказов зеркал не блокирует ни одну площадку", () => {
  const { ctx, ingestRun, snap, mode, logged, pool, setup } = harness()
  const WH = "1408913"

  beforeAll(async () => {
    await setup()
    for (const c of ["wb", "ozon", "ym", "kit", "site"] as const) await mode(c, "apply")
    await upsertProducts(ctx.h.db, [{ barcode: "A", vendorCode: "JW-A", nmId: 1, title: "", subject: null, chrtId: 7001 }])
  })
  afterAll(async () => ctx.h?.close())

  it("холодный старт, затем заказ Ozon при сбое заказов всех зеркал — пишутся WB, Ozon, ЯМ, KIT, сайт", async () => {
    await ingestRun("2026-09-28T11:00:00.000Z", { siteSourcePool: 1 })
    await snap("wb", "2026-09-28T11:00:00.000Z", [s("A", 3, "JW-A", WH)])
    const cold = await pool("2026-09-28T11:00:30.000Z", okSend(), { wbWarehouseId: 1408913, ymWarehouseId: 2369574, ozonWarehouseId: 1020005023618600 })
    expect(cold.r.status).toBe("ok")

    await upsertOrders(ctx.h.db, ctx.ids.get("ozon")!.id, [
      { externalId: "O1", line: 0, barcode: "A", quantity: 1, lifecycle: "open", occurredAt: "2026-09-28T11:02:00.000Z", raw: {} },
    ])
    await ingestRun("2026-09-28T11:05:00.000Z", { siteSourcePool: 1, ozonOrdersFailed: 1, ymOrdersFailed: 1, kitOrdersFailed: 1, siteOrdersFailed: 1 })
    await snap("wb", "2026-09-28T11:05:00.000Z", [s("A", 3, "JW-A", WH)])
    await snap("ozon", "2026-09-28T11:05:00.000Z", [s("A", 3, "JW-A")])
    await snap("ym", "2026-09-28T11:05:00.000Z", [s("A", 3, "JW-A", "2369574")])
    await snap("kit", "2026-09-28T11:05:00.000Z", [s("A", 3, "var-A")])
    await snap("site", "2026-09-28T11:05:00.000Z", [s("A", 3)])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T11:05:30.000Z", send, { wbWarehouseId: 1408913, ymWarehouseId: 2369574, ozonWarehouseId: 1020005023618600 })
    // WB — первым: окно между перечитыванием остатка WB и записью короче.
    expect(send.mock.calls.map((c) => [c[0], c[1].map((o) => [o.barcode, o.before, o.after, o.externalSku])])).toEqual([
      ["wb", [["A", 3, 2, "7001"]]],
      ["ozon", [["A", 3, 2, "JW-A"]]],
      ["ym", [["A", 3, 2, "JW-A"]]],
      ["kit", [["A", 3, 2, "var-A"]]],
      ["site", [["A", 3, 2, "A"]]],
    ])
    expect(r).toMatchObject({ status: "ok", counters: { wbSelf: 1, mirrorOrdersFailed: 4, wbApplied: 1, ozonApplied: 1, ymApplied: 1, kitApplied: 1, siteApplied: 1 } })
    expect(await logged(pid, "wb")).toEqual([["A", 3, 2, "apply", true]])
  })
})

/**
 * Совместимость с кроном 1.3b–1.3c на VPS: глобально dry-run, WB и сайт off, зеркала dry-run.
 * Новые счётчики ingest (сбой заказов, каталог, витрина сайта) не блокируют и не меняют статус —
 * блокировки действуют только на площадки в apply; сеть не трогается.
 */
describe.skipIf(!TEST_DATABASE_URL)("runPool — dry-run как на VPS до переключения", () => {
  const { ctx, ingestRun, snap, mode, logged, setup, runId } = harness()

  beforeAll(async () => {
    await setup()
    for (const c of ["ozon", "ym", "kit"] as const) await mode(c, "dry-run")
  })
  afterAll(async () => ctx.h?.close())

  it("план зеркал и сайта в журнале dry-run/off, WB не планируется, статус ok, отправитель не вызывается", async () => {
    await ingestRun("2026-09-28T12:00:00.000Z", { siteSourcePool: 0 })
    await snap("wb", "2026-09-28T12:00:00.000Z", [s("A", 3), s("B", 1)])
    const cold = await runPool({ db: ctx.h.db, now: () => new Date("2026-09-28T12:00:30.000Z"), runId: await runId(), globalMode: "dry-run" })
    expect(cold.status).toBe("ok")

    await ingestRun("2026-09-28T12:05:00.000Z", { ozonOrdersFailed: 1, siteSourcePool: 0, catalogRejected: 1 })
    await snap("wb", "2026-09-28T12:05:00.000Z", [s("A", 3), s("B", 1)])
    await snap("ozon", "2026-09-28T12:05:00.000Z", [s("A", 2, "JW-A"), s("B", 1, "JW-B")])
    await snap("site", "2026-09-28T12:05:00.000Z", [s("A", 5), s("B", 1)])
    const send = okSend()
    const pid = await runId()
    // Склады записи — как их передаёт CLI (writeTargets).
    const r = await runPool({
      db: ctx.h.db,
      now: () => new Date("2026-09-28T12:05:30.000Z"),
      runId: pid,
      globalMode: "dry-run",
      send,
      wbWarehouseId: 1408913,
      ozonWarehouseId: 1020005023618600,
      ymWarehouseId: 2369574,
    })
    expect(send).not.toHaveBeenCalled()
    expect(r.status).toBe("ok")
    expect(r.error).toBeUndefined()
    expect(Object.keys(r.counters).sort()).toEqual(
      ["events", "kitPlanned", "mirrorOrdersFailed", "noBase", "ordersNoBarcode", "ozonPlanned", "sitePlanned", "staleSnapshots", "wbSelf", "wbSnapshotAgeMin", "ymPlanned"].sort(),
    )
    expect(r.counters).toMatchObject({ wbSelf: 0, ozonPlanned: 1, sitePlanned: 1, staleSnapshots: 2 })
    expect(await logged(pid, "ozon")).toEqual([["A", 2, 3, "dry-run", false]])
    expect(await logged(pid, "site")).toEqual([["A", 5, 3, "off", false]])
    expect(await logged(pid, "wb")).toEqual([])
  })

  it("чужой склад и не заданный склад записи в dry-run — только счётчик (видно до шага B), без текста и partial", async () => {
    await mode("wb", "dry-run")
    await ingestRun("2026-09-28T12:10:00.000Z")
    await snap("wb", "2026-09-28T12:10:00.000Z", [s("A", 3, null, "1408913"), s("A", 0, null, "777"), s("B", 1, null, "1408913")])
    await snap("ozon", "2026-09-28T12:10:00.000Z", [s("A", 3, "JW-A", "fbs:22,1020005023618600"), s("B", 1, "JW-B", "fbs")])
    const r = await runPool({
      db: ctx.h.db,
      now: () => new Date("2026-09-28T12:10:30.000Z"),
      runId: await runId(),
      globalMode: "dry-run",
      wbWarehouseId: 1408913,
      ozonWarehouseId: 1020005023618600,
    })
    expect(r).toMatchObject({ status: "ok", counters: { wbForeignWarehouse: 1, ozonForeignWarehouse: 1 } })
    expect(r.error).toBeUndefined()
    const noWh = await runPool({ db: ctx.h.db, now: () => new Date("2026-09-28T12:10:40.000Z"), runId: await runId(), globalMode: "dry-run" })
    expect(noWh).toMatchObject({ status: "ok", counters: { wbForeignWarehouse: 1, ozonForeignWarehouse: 1 } })
    await mode("wb", "off")
  })
})

/** Серия прогонов, где запись площадки не проходит (ревью 3–6, I2): счётчики для уведомления. */
describe.skipIf(!TEST_DATABASE_URL)("runPool — серия неудачных записей площадки", () => {
  const { ctx, ingestRun, snap, mode, setup, runId } = harness()

  beforeAll(async () => {
    await setup()
    await mode("kit", "apply")
  })
  afterAll(async () => ctx.h?.close())

  /** Прогон pool в журнале runs, как в CLI: счётчики серии считаются по прошлым прогонам. */
  const poolRun = async (at: string, send: ReturnType<typeof okSend>) => {
    const id = await runId()
    const r = await runPool({ db: ctx.h.db, now: () => new Date(at), runId: id, globalMode: "apply", send })
    // runId уже заведён insertRun как job "test" — отметим его прогоном pool с итогом.
    await ctx.h.db.update(runsTable).set({ job: "pool", status: r.status, counters: r.counters, startedAt: at, finishedAt: at }).where(eq(runsTable.runId, id))
    return r
  }
  const failing = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: false, error: "409" })))

  it("счётчик прогонов подряд с ошибками записи площадки; запись прошла — серии нет", async () => {
    await ingestRun("2026-09-28T13:00:00.000Z")
    const tick = async (m: string, send: ReturnType<typeof okSend>) => {
      await snap("wb", `2026-09-28T13:${m}:00.000Z`, [s("A", 3)])
      await snap("kit", `2026-09-28T13:${m}:00.000Z`, [s("A", 1, "var-A")])
      return poolRun(`2026-09-28T13:${m}:30.000Z`, send)
    }
    expect((await tick("00", failing())).counters).toMatchObject({ kitWriteFailed: 1, kitWriteFailedRuns: 1 })
    expect((await tick("05", failing())).counters).toMatchObject({ kitWriteFailed: 1, kitWriteFailedRuns: 2 })
    expect((await tick("10", failing())).counters).toMatchObject({ kitWriteFailedRuns: 3 })
    const ok = await tick("15", okSend())
    expect(ok.counters).not.toHaveProperty("kitWriteFailed")
    expect(ok.counters).not.toHaveProperty("kitWriteFailedRuns")
  })
})
