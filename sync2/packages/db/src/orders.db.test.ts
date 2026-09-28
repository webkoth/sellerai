import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { ingestChannelOrders, loadOrdersSince, upsertOrders, type OrderUpsert } from "./orders"
import { drizzleRunStore } from "./run-store"
import { channels, ordersRaw } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

const o = (externalId: string, patch: Partial<OrderUpsert> = {}): OrderUpsert => ({
  externalId,
  line: 0,
  barcode: "A",
  quantity: 1,
  lifecycle: "open",
  occurredAt: "2026-09-26T10:00:00.000Z",
  raw: { id: externalId },
  ...patch,
})

describe.skipIf(!TEST_DATABASE_URL)("хранилище заказов", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ozon: number
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ozon = (await h.db.select().from(channels).where(eq(channels.code, "ozon")))[0]!.id
  })
  afterAll(async () => h?.close())

  it("повторная запись заказа обновляет статус, а не дублирует строку", async () => {
    await upsertOrders(h.db, ozon, [o("OZ-1")])
    await upsertOrders(h.db, ozon, [o("OZ-1", { lifecycle: "cancelled_before_ship" })])
    const rows = await h.db.select().from(ordersRaw).where(eq(ordersRaw.externalId, "OZ-1"))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.lifecycle).toBe("cancelled_before_ship")
    expect(Date.parse(rows[0]!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(rows[0]!.firstSeenAt))
  })

  it("пустой список — без запроса и без ошибки", async () => {
    expect(await upsertOrders(h.db, ozon, [])).toBe(0)
  })

  it("чтение с даты: id числом, время в ISO", async () => {
    await upsertOrders(h.db, ozon, [o("OZ-OLD", { occurredAt: "2026-08-01T00:00:00.000Z" })])
    const rows = await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")
    expect(rows.map((r) => r.lifecycle)).toEqual(["cancelled_before_ship"])
    expect(typeof rows[0]!.id).toBe("number")
    expect(rows[0]).toMatchObject({ channelId: ozon, barcode: "A", quantity: 1, occurredAt: "2026-09-26T10:00:00.000Z" })
  })

  it("дубль ключа в одной пачке — берётся последняя строка, без ошибки", async () => {
    const n = await upsertOrders(h.db, ozon, [
      o("OZ-DUP", { occurredAt: "2026-01-01T00:00:00.000Z" }),
      o("OZ-DUP", { occurredAt: "2026-01-01T00:00:00.000Z", lifecycle: "cancelled_before_ship" }),
    ])
    expect(n).toBe(1)
    const rows = await h.db.select().from(ordersRaw).where(eq(ordersRaw.externalId, "OZ-DUP"))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.lifecycle).toBe("cancelled_before_ship")
  })
})

describe.skipIf(!TEST_DATABASE_URL)("базовая точка заказов площадки (этап 1.3c)", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Map<string, number>
  let n = 0
  const run = async () => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
    await insertRun(h.db, id)
    return id
  }
  const baseline = async (code: string) =>
    (await h.db.select({ b: channels.ordersBaselineRunId }).from(channels).where(eq(channels.code, code)))[0]!.b
  const cold = async (code: string) =>
    Object.fromEntries(
      (await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z"))
        .filter((r) => r.channelId === ids.get(code))
        .map((r) => [r.id, r.channelColdStart ?? false]),
    )
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ids = new Map((await h.db.select().from(channels)).map((c) => [c.code, c.id]))
  })
  afterAll(async () => h?.close())

  it("первое чтение площадки — базовая точка на этот прогон, его заказы — холодный старт по площадке, следующие — нет", async () => {
    const r1 = await run()
    expect(await ingestChannelOrders(h.db, { channelId: ids.get("site")!, code: "site", runId: r1, rows: [o("S1"), o("S2")] })).toEqual({
      written: 2,
      baselineSet: true,
    })
    expect(await baseline("site")).toBe(r1)
    const r2 = await run()
    // S1 повторно (статус обновился) — остаётся холодным; S3 — новый, хотя создан раньше S1: лаг площадки.
    expect(
      await ingestChannelOrders(h.db, {
        channelId: ids.get("site")!,
        code: "site",
        runId: r2,
        rows: [o("S1", { lifecycle: "shipped" }), o("S3", { occurredAt: "2026-09-02T00:00:00.000Z" })],
      }),
    ).toEqual({ written: 2, baselineSet: false })
    expect(await baseline("site")).toBe(r1)
    const rows = await h.db.select().from(ordersRaw).where(eq(ordersRaw.channelId, ids.get("site")!))
    expect(Object.fromEntries(rows.map((r) => [r.externalId, r.firstRunId]))).toEqual({ S1: r1, S2: r1, S3: r2 })
    const byExt = Object.fromEntries(rows.map((r) => [r.id, r.externalId]))
    const flags = await cold("site")
    expect(Object.fromEntries(Object.entries(flags).map(([id, f]) => [byExt[Number(id)], f]))).toEqual({ S1: true, S2: true, S3: false })
  })

  it("у площадки уже есть заказы (живая до 1.3c) — базовая точка задним числом не ставится", async () => {
    await upsertOrders(h.db, ids.get("kit")!, [o("K1")])
    const r = await run()
    expect(await ingestChannelOrders(h.db, { channelId: ids.get("kit")!, code: "kit", runId: r, rows: [o("K1"), o("K2")] })).toEqual({
      written: 2,
      baselineSet: false,
    })
    expect(await baseline("kit")).toBeNull()
    expect(Object.values(await cold("kit"))).toEqual([false, false])
  })

  it("площадка читалась раньше без единого заказа (счётчик ymOrders в ingest) — базовая точка не ставится, первый заказ новый", async () => {
    const store = drizzleRunStore(h.db)
    const old = "00000000-0000-4000-8000-0000000000a1"
    await store.start({ runId: old, job: "ingest", writeMode: "dry-run", startedAt: "2026-09-20T10:00:00.000Z" })
    await store.finish(old, { status: "ok", finishedAt: "2026-09-20T10:01:00.000Z", counters: { ymOrders: 0 }, error: null })
    const r = await run()
    expect(await ingestChannelOrders(h.db, { channelId: ids.get("ym")!, code: "ym", runId: r, rows: [o("Y1")] })).toEqual({
      written: 1,
      baselineSet: false,
    })
    expect(await baseline("ym")).toBeNull()
    expect(Object.values(await cold("ym"))).toEqual([false])
  })

  it("первое чтение без заказов — базовая точка ставится: следующий заказ уже новый", async () => {
    const r1 = await run()
    expect(await ingestChannelOrders(h.db, { channelId: ids.get("ozon")!, code: "ozon", runId: r1, rows: [] })).toEqual({
      written: 0,
      baselineSet: true,
    })
    const r2 = await run()
    await ingestChannelOrders(h.db, { channelId: ids.get("ozon")!, code: "ozon", runId: r2, rows: [o("OZ-9")] })
    expect(await baseline("ozon")).toBe(r1)
    expect(Object.values(await cold("ozon"))).toEqual([false])
  })
})
