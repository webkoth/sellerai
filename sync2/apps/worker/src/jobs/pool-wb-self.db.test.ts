import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { channels, drizzleRunStore, insertStockSnapshot, loadChannels, loadPoolState, seedChannels, upsertOrders, upsertProducts, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { SendResult, Sender, WriteOp } from "@sync2/platforms"
import type { Channel, NormalizedStock } from "@sync2/shared"
import { and, eq } from "drizzle-orm"
import { runPool } from "./pool"

const WH = "1408913"
const w = (barcode: string, quantity: number, warehouse = WH): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse })
const okSend = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true })))

/**
 * Сквозная история режима «WB пишет sync2» на живой базе. Снимки WB задаются руками так, как их
 * отдал бы WB после наших записей (фальшивый отправитель склад не меняет). Баркоды разведены по
 * сценариям: A — запись по заказу, B — итог неизвестен, C — неустоявшийся снимок, D — чужой склад,
 * E — нет chrtId в каталоге.
 */
describe.skipIf(!TEST_DATABASE_URL)("runPool — WB пишет sync2 (режим self)", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Awaited<ReturnType<typeof loadChannels>>
  let n = 0
  const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  const runId = async () => {
    const id = nextId()
    await insertRun(h.db, id)
    return id
  }
  const ingestRun = async (at: string) => {
    const store = drizzleRunStore(h.db)
    const id = nextId()
    await store.start({ runId: id, job: "ingest", writeMode: "apply", startedAt: at })
    await store.finish(id, { status: "ok", finishedAt: at, counters: {}, error: null })
  }
  const snapWb = async (at: string, stocks: NormalizedStock[]) => insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: await runId(), takenAt: at, stocks })
  const order = (c: Channel, id: string, barcode: string, at: string) =>
    upsertOrders(h.db, ids.get(c)!.id, [{ externalId: id, line: 0, barcode, quantity: 1, lifecycle: "open", occurredAt: at, raw: {} }])
  const poolRun = async (at: string, send: Sender, wbWarehouseId: number | null = 1408913) => {
    const pid = await runId()
    const r = await runPool({ db: h.db, now: () => new Date(at), runId: pid, globalMode: "apply", send, wbWarehouseId })
    return { pid, r }
  }
  const pool = async (at: string, send: Sender) => (await poolRun(at, send)).r
  const item = async (barcode: string) => (await loadPoolState(h.db)).items.find((i) => i.barcode === barcode)

  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ids = await loadChannels(h.db)
    await h.db.update(channels).set({ writeMode: "apply" }).where(eq(channels.code, "wb"))
    await upsertProducts(h.db, [
      { barcode: "A", vendorCode: "JW-A", nmId: 1, title: "", subject: null, chrtId: 7001 },
      { barcode: "B", vendorCode: "JW-B", nmId: 2, title: "", subject: null, chrtId: 7002 },
      { barcode: "C", vendorCode: "JW-C", nmId: 3, title: "", subject: null, chrtId: 7003 },
      { barcode: "D", vendorCode: "JW-D", nmId: 4, title: "", subject: null, chrtId: 7004 },
      // E — карточка без chrtId: каталог WB размер не дал.
      { barcode: "E", vendorCode: "JW-E", nmId: 5, title: "", subject: null },
    ])
  })
  afterAll(async () => h?.close())

  it("холодный старт в self — WB совпадает с пулом, записей нет", async () => {
    await ingestRun("2026-09-28T10:00:00.000Z")
    await snapWb("2026-09-28T10:00:00.000Z", [w("A", 3), w("B", 2), w("C", 2), w("D", 2)])
    const send = okSend()
    const r = await pool("2026-09-28T10:00:30.000Z", send)
    expect(r).toMatchObject({ status: "ok", counters: { wbSelf: 1, wbPlanned: 0, wbWriteUnknown: 0 } })
    expect(send).not.toHaveBeenCalled()
  })

  it("заказ Ozon — sync2 пишет WB по chrtId, первым; ожидание WB = база, момент записи", async () => {
    await order("ozon", "O1", "A", "2026-09-28T10:02:00.000Z")
    await ingestRun("2026-09-28T10:05:00.000Z")
    await snapWb("2026-09-28T10:05:00.000Z", [w("A", 3), w("B", 2), w("C", 2), w("D", 2)])
    const send = okSend()
    const r = await pool("2026-09-28T10:05:30.000Z", send)
    expect(r.status).toBe("ok")
    expect(send.mock.calls[0]).toEqual(["wb", [{ channel: "wb", barcode: "A", field: "stock", before: 3, after: 2, externalSku: "7001" }]])
    expect(await item("A")).toMatchObject({ base: 2, wbExpected: 2, expectedAt: "2026-09-28T10:05:30.000Z" })
  })

  it("итог записи WB неизвестен — ожидание max(база, факт) и момент записи; зафиксировано ещё до сети", async () => {
    await order("kit", "K1", "B", "2026-09-28T10:12:00.000Z")
    await ingestRun("2026-09-28T10:15:00.000Z")
    await snapWb("2026-09-28T10:15:00.000Z", [w("A", 2), w("B", 2), w("C", 2), w("D", 2)])
    let duringSend: unknown
    const send = vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => {
      duringSend = await item("B")
      return ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: false, uncertain: true, error: "сеть: terminated" }))
    })
    const r = await pool("2026-09-28T10:15:30.000Z", send)
    expect(duringSend).toMatchObject({ base: 1, wbExpected: 2, expectedAt: "2026-09-28T10:15:30.000Z" })
    expect(await item("B")).toMatchObject({ base: 1, wbExpected: 2 })
    expect(r).toMatchObject({ status: "partial", counters: { wbWriteUnknown: 1, writeErrors: 1 } })
  })

  it("снимок WB не устоялся после записи — баркод не пишется, ожидание прежнее; следующий устоявшийся — пишется", async () => {
    await order("ozon", "O2", "C", "2026-09-28T10:19:00.000Z")
    await ingestRun("2026-09-28T10:20:00.000Z")
    await snapWb("2026-09-28T10:20:00.000Z", [w("A", 2), w("B", 2), w("C", 2), w("D", 2)])
    const first = okSend()
    await pool("2026-09-28T10:20:30.000Z", first)
    // B повторяется: прошлая запись с неизвестным итогом, на WB по-прежнему 2.
    expect(first.mock.calls[0]?.[1].map((o) => [o.barcode, o.before, o.after])).toEqual([
      ["B", 2, 1],
      ["C", 2, 1],
    ])

    await order("kit", "K2", "C", "2026-09-28T10:21:00.000Z")
    await ingestRun("2026-09-28T10:21:00.000Z")
    await snapWb("2026-09-28T10:21:00.000Z", [w("A", 2), w("B", 1), w("C", 1), w("D", 2)])
    const second = okSend()
    await pool("2026-09-28T10:21:30.000Z", second)
    expect(second).not.toHaveBeenCalled()
    expect(await item("C")).toMatchObject({ base: 0, wbExpected: 1 })

    await ingestRun("2026-09-28T10:25:00.000Z")
    await snapWb("2026-09-28T10:25:00.000Z", [w("A", 2), w("B", 1), w("C", 1), w("D", 2)])
    const third = okSend()
    await pool("2026-09-28T10:25:30.000Z", third)
    expect(third.mock.calls[0]).toEqual(["wb", [{ channel: "wb", barcode: "C", field: "stock", before: 1, after: 0, externalSku: "7003" }]])
  })

  it("в снимке WB второй склад — запись WB не делается: остаток — сумма складов, а пишем в один", async () => {
    await order("ozon", "O3", "D", "2026-09-28T10:29:00.000Z")
    await ingestRun("2026-09-28T10:30:00.000Z")
    await snapWb("2026-09-28T10:30:00.000Z", [w("A", 2), w("B", 1), w("C", 0), w("D", 2), w("A", 0, "777"), w("D", 0, "777")])
    const send = okSend()
    const r = await pool("2026-09-28T10:30:30.000Z", send)
    expect(send).not.toHaveBeenCalled()
    expect(r).toMatchObject({ status: "partial", counters: { wbForeignWarehouse: 1 } })
    expect(r.error).toMatch(/WB: в снимке склады 777 помимо склада записи 1408913/)
  })

  it("склад записи WB не задан — запись WB не делается, понятная причина", async () => {
    await ingestRun("2026-09-28T10:33:00.000Z")
    await snapWb("2026-09-28T10:33:00.000Z", [w("A", 2), w("B", 1), w("C", 0), w("D", 2)])
    const send = okSend()
    const { r } = await poolRun("2026-09-28T10:33:30.000Z", send, null)
    expect(send).not.toHaveBeenCalled()
    expect(r).toMatchObject({ status: "partial", counters: { wbForeignWarehouse: 1 } })
    expect(r.error).toMatch(/WB: не задан WB_WAREHOUSE_ID/)
  })

  it("штрихкод без chrtId в каталоге — не уходит в сеть, отказ с причиной в журнале; остальные пишутся, прогон не падает", async () => {
    await ingestRun("2026-09-28T10:35:00.000Z")
    // D: база 1 (заказ O3), на WB 2 — пишется; E: холодный старт, база 2.
    await snapWb("2026-09-28T10:35:00.000Z", [w("A", 2), w("B", 1), w("C", 0), w("D", 2), w("E", 2)])
    const first = okSend()
    await pool("2026-09-28T10:35:30.000Z", first)
    expect(first.mock.calls.map((c) => [c[0], c[1].map((o) => o.barcode)])).toEqual([["wb", ["D"]]])

    await order("ozon", "O4", "E", "2026-09-28T10:36:00.000Z")
    await order("ozon", "O5", "A", "2026-09-28T10:36:00.000Z")
    await ingestRun("2026-09-28T10:40:00.000Z")
    await snapWb("2026-09-28T10:40:00.000Z", [w("A", 2), w("B", 1), w("C", 0), w("D", 1), w("E", 2)])
    const send = okSend()
    const { pid, r } = await poolRun("2026-09-28T10:40:30.000Z", send)
    // В сеть — только A (с chrtId); E отказан до сети.
    expect(send.mock.calls.map((c) => [c[0], c[1].map((o) => o.barcode)])).toEqual([["wb", ["A"]]])
    const rows = await h.db.select().from(writes).where(and(eq(writes.runId, pid), eq(writes.channelId, ids.get("wb")!.id)))
    const e = rows.find((x) => x.barcode === "E")
    expect(e).toMatchObject({ mode: "apply", applied: false, uncertain: false, externalSku: null })
    expect(e?.error).toMatch(/нет chrtId размера/)
    expect(r).toMatchObject({ status: "partial", counters: { wbNoChrtId: 1, wbApplied: 1, writeErrors: 1 } })
    // Отказ, а не «неизвестно»: ожидание WB — факт, база — по заказу.
    expect(await item("E")).toMatchObject({ base: 1, wbExpected: 2 })
  })
})
