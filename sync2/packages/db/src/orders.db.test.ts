import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { createDb, type Db } from "./client"
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

describe.skipIf(!TEST_DATABASE_URL)("базовая точка: два параллельных первых ingest одной площадки", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let other: ReturnType<typeof createDb>
  let locker: ReturnType<typeof createDb>
  let site: number
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    other = createDb(TEST_DATABASE_URL!, { max: 1 })
    locker = createDb(TEST_DATABASE_URL!, { max: 1 })
    await other.db.execute(sql`select 1`)
    site = (await h.db.select().from(channels).where(eq(channels.code, "site")))[0]!.id
  })
  afterAll(async () => {
    await other?.close()
    await locker?.close()
    await h?.close()
  })

  /** Ждёт, пока столько-то соединений встанут в ожидание блокировки: гонка разыгрывается детерминированно. */
  const waitForLockWaiters = async (q: Pick<Db, "execute">, n: number) => {
    for (let i = 0; i < 200; i++) {
      const [row] = await q.execute<{ n: number }>(
        sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
      )
      if ((row?.n ?? 0) >= n) return
      await new Promise((r) => setTimeout(r, 10))
    }
    throw new Error(`не дождались ${n} ожидающих блокировку`)
  }

  it("точка — тот прогон, чей first_run_id у строк: второй ждёт блокировку строки площадки и видит точку", async () => {
    const a = "00000000-0000-4000-8000-0000000000d1"
    const b = "00000000-0000-4000-8000-0000000000d2"
    await insertRun(h.db, a)
    await insertRun(h.db, b)
    const rows = [o("S1"), o("S2"), o("S3")]
    // Два соединения — две транзакции одновременно, как два тика без общей блокировки. Третье
    // держит orders_raw от вставки: обе транзакции проходят проверки и встают — без блокировки
    // строки площадки обе увидели бы «точки нет», и вторая перезаписала бы точку своим прогоном.
    let started: Promise<Array<{ written: number; baselineSet: boolean }>> | undefined
    await locker.db.transaction(async (tx) => {
      await tx.execute(sql`lock table orders_raw in share row exclusive mode`)
      started = Promise.all([
        ingestChannelOrders(h.db, { channelId: site, code: "site", runId: a, rows }),
        ingestChannelOrders(other.db, { channelId: site, code: "site", runId: b, rows }),
      ])
      // Запрос — через ту же транзакцию: у h.db одно соединение, и его держит первая транзакция.
      await waitForLockWaiters(tx, 2)
    })
    const results = await started!
    expect(results.filter((r) => r.baselineSet)).toHaveLength(1)
    const [ch] = await h.db.select({ b: channels.ordersBaselineRunId }).from(channels).where(eq(channels.id, site))
    const firstRuns = new Set((await h.db.select().from(ordersRaw).where(eq(ordersRaw.channelId, site))).map((r) => r.firstRunId))
    expect(firstRuns.size).toBe(1)
    expect(ch!.b).toBe([...firstRuns][0])
  })
})
