import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { channels, drizzleRunStore, insertStockSnapshot, loadChannels, loadPoolState, seedChannels, upsertOrders, upsertProducts, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { SendResult, Sender, WriteOp } from "@sync2/platforms"
import type { Channel, NormalizedStock } from "@sync2/shared"
import { and, eq } from "drizzle-orm"
import { runPool } from "./pool"

const WH = "1408913"
const w = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse: WH })
const k = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: `var-${barcode}`, quantity, warehouse: null })
const okSend = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true })))

/**
 * Итоги записи WB фиксируются в пуле сразу после записи WB — до зеркал и независимо от журнала
 * (ревью ядра 1.4, I2): журнал упал или процесс убит — следующий тик не списывает заказы дважды
 * и не принимает нашу запись за продажу/поступление на WB.
 */
describe.skipIf(!TEST_DATABASE_URL)("runPool — фиксация итогов WB при сбое журнала и между фиксациями", () => {
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
  const snap = async (c: Channel, at: string, stocks: NormalizedStock[]) => insertStockSnapshot(h.db, { channelId: ids.get(c)!.id, runId: await runId(), takenAt: at, stocks })
  const order = (id: string, barcode: string, at: string) =>
    upsertOrders(h.db, ids.get("ozon")!.id, [{ externalId: id, line: 0, barcode, quantity: 1, lifecycle: "open", occurredAt: at, raw: {} }])
  const pool = async (at: string, send: Sender) => {
    const pid = await runId()
    return { pid, r: await runPool({ db: h.db, now: () => new Date(at), runId: pid, globalMode: "apply", send, wbWarehouseId: 1408913 }) }
  }
  const item = async (barcode: string) => (await loadPoolState(h.db)).items.find((i) => i.barcode === barcode)
  const tick = async (m: string, wbA: number, wbB: number, send: Sender) => {
    await ingestRun(`2026-09-28T14:${m}:00.000Z`)
    await snap("wb", `2026-09-28T14:${m}:00.000Z`, [w("A", wbA), w("B", wbB)])
    await snap("kit", `2026-09-28T14:${m}:00.000Z`, [k("A", 3), k("B", 3)])
    return pool(`2026-09-28T14:${m}:30.000Z`, send)
  }

  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ids = await loadChannels(h.db)
    for (const c of ["wb", "kit"] as const) await h.db.update(channels).set({ writeMode: "apply" }).where(eq(channels.code, c))
    await upsertProducts(h.db, [
      { barcode: "A", vendorCode: "JW-A", nmId: 1, title: "", subject: null, chrtId: 7001 },
      { barcode: "B", vendorCode: "JW-B", nmId: 2, title: "", subject: null, chrtId: 7002 },
    ])
    await tick("00", 3, 3, okSend())
  })
  afterAll(async () => h?.close())

  it("журнал WB не записался после записи WB — итог WB зафиксирован в пуле, зеркала пишутся, partial; следующий тик не списывает дважды", async () => {
    await order("O1", "A", "2026-09-28T14:02:00.000Z")
    // Тело ответа с BigInt не сериализуется в jsonb — вставка журнала WB падает ПОСЛЕ записи на WB.
    const send = vi.fn(async (c: Channel, ops: WriteOp[]): Promise<SendResult[]> =>
      ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true, response: c === "wb" ? { big: 1n } : null })),
    )
    const { pid, r } = await tick("05", 3, 3, send)
    expect(send.mock.calls.map((c) => c[0])).toEqual(["wb", "kit"])
    expect(r).toMatchObject({ status: "partial", counters: { journalErrors: 1, wbApplied: 1, kitApplied: 1 } })
    expect(r.error).toMatch(/журнал записей WB не сохранён/)
    expect(await item("A")).toMatchObject({ base: 2, wbExpected: 2, expectedAt: "2026-09-28T14:05:30.000Z" })
    // Журнал — по площадке сразу после её записи: KIT записан, WB — нет.
    const logged = await h.db.select().from(writes).where(eq(writes.runId, pid))
    expect(logged.map((x) => x.channelId)).toEqual([ids.get("kit")!.id])

    // Следующий тик: WB показывает нашу запись (2) — ни сигнала, ни повторной записи, база та же.
    const next = okSend()
    const n2 = await tick("10", 2, 3, next)
    expect(next.mock.calls.filter((c) => c[0] === "wb")).toEqual([])
    expect(n2.r.counters).toMatchObject({ events: 0 })
    expect(await item("A")).toMatchObject({ base: 2 })
  })

  it("процесс убит между фиксациями (итог «неизвестно» до сети) — следующий тик: запись не дошла — повторяется, пул верен", async () => {
    await order("O2", "B", "2026-09-28T14:12:00.000Z")
    let during: unknown
    // Состояние пула в момент отправки — то, что осталось бы, если бы процесс убили во время записи.
    const send = vi.fn(async (c: Channel, ops: WriteOp[]): Promise<SendResult[]> => {
      if (c === "wb") during = await item("B")
      return ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: false, uncertain: true, error: "killed" }))
    })
    await tick("15", 2, 3, send)
    expect(during).toMatchObject({ base: 2, wbExpected: 3, expectedAt: "2026-09-28T14:15:30.000Z" })
    expect(await item("B")).toEqual(during)

    // WB по-прежнему 3 (запись не дошла): сигнала нет, запись 3 → 2 повторяется.
    const next = okSend()
    await tick("20", 2, 3, next)
    expect(next.mock.calls.find((c) => c[0] === "wb")?.[1].map((o) => [o.barcode, o.before, o.after])).toEqual([["B", 3, 2]])
    expect(await item("B")).toMatchObject({ base: 2, wbExpected: 2 })
  })

  it("без отправителя — отказ позиций, а не «неизвестно»: ожидание WB — факт", async () => {
    await order("O3", "A", "2026-09-28T14:22:00.000Z")
    await ingestRun("2026-09-28T14:25:00.000Z")
    await snap("wb", "2026-09-28T14:25:00.000Z", [w("A", 2), w("B", 2)])
    const pid = await runId()
    const r = await runPool({ db: h.db, now: () => new Date("2026-09-28T14:25:30.000Z"), runId: pid, globalMode: "apply", wbWarehouseId: 1408913 })
    const rows = await h.db.select().from(writes).where(and(eq(writes.runId, pid), eq(writes.channelId, ids.get("wb")!.id)))
    expect(rows.map((x) => [x.barcode, x.applied, x.uncertain])).toEqual([["A", false, false]])
    expect(r.counters).toMatchObject({ wbWriteUnknown: 0 })
    expect(await item("A")).toMatchObject({ base: 1, wbExpected: 2 })
  })
})
