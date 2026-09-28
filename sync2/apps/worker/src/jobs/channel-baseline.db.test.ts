import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { channels, drizzleRunStore, loadChannels, loadPoolState, mirrorOrderBarcodesSince, poolEvents, seedChannels } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb } from "@sync2/db/test-db"
import type { ChannelAdapter } from "@sync2/platforms"
import type { Channel, ChannelOrder, WbCatalogEntry } from "@sync2/shared"
import { eq, inArray } from "drizzle-orm"
import { createLogger } from "../log"
import { withRun } from "../run"
import { runIngest } from "./ingest"
import { runPool } from "./pool"

// Подключение новой площадки (сайт, этап 1.3c) к уже живому пулу: её заказы за окно
// ingest уже сняты с WB — пул принимает их холодным стартом по площадке, а не списывает.
const catalog: WbCatalogEntry[] = ["A", "B", "C"].map((b) => ({ barcode: b, vendorCode: `V${b}`, nmId: null, title: "", subject: null }))
const order = (id: string, barcode: string, quantity = 1, occurredAt = "2026-09-27T09:00:00.000Z"): ChannelOrder => ({
  externalId: id,
  barcode,
  externalSku: null,
  quantity,
  priceMinor: 0,
  lifecycle: "open",
  occurredAt,
  raw: {},
})
const adapter = (channel: Channel, orders: ChannelOrder[]): ChannelAdapter => ({
  channel,
  fetchOrders: async () => orders,
  fetchStocks: async () => ({ stocks: catalog.map((c) => ({ barcode: c.barcode, externalSku: null, quantity: 5, warehouse: null })), skippedNoWbBarcode: [] }),
})

describe.skipIf(!TEST_DATABASE_URL)("холодный старт по площадке: новая площадка у живого пула", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  const log = createLogger("warn", { write: () => {} })
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => h?.close())

  const tick = async (at: string, mirrors: ChannelAdapter[]) => {
    const now = () => new Date(at)
    const deps = { store: drizzleRunStore(h.db), log, writeMode: "dry-run" as const, now }
    const ingest = await withRun("ingest", deps, async (ctx) => {
      const r = await runIngest({
        db: h.db,
        now,
        runId: ctx.runId,
        log: ctx.log,
        acceptCatalog: false,
        adapters: { wb: { ...adapter("wb", []), fetchCatalog: async () => catalog }, mirrors: () => mirrors },
      })
      return { status: r.status, counters: r.counters, error: r.errors.length ? r.errors.join("; ") : undefined }
    })
    const poolAt = () => new Date(Date.parse(at) + 60_000)
    const pool = await withRun("pool", { ...deps, now: poolAt }, async (ctx) => {
      const r = await runPool({ db: h.db, now: poolAt, runId: ctx.runId, globalMode: "dry-run" })
      return { status: r.status, counters: r.counters, error: r.error }
    })
    return { ingest, pool }
  }
  const bases = async () => Object.fromEntries((await loadPoolState(h.db)).items.map((i) => [i.barcode, i.base]))
  const orderEvents = async (runId: string) =>
    (await h.db.select().from(poolEvents).where(eq(poolEvents.runId, runId)))
      .filter((e) => e.kind === "order")
      .map((e) => [e.barcode, e.delta, e.detail])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[1]) - Number(b[1]))

  it("пул живёт с 1.3b: общий холодный старт, базовые точки площадок сняты, как после миграции на живой базе", async () => {
    const t = await tick("2026-09-27T10:00:00.000Z", [adapter("kit", [order("K1", "A")]), adapter("ym", [])])
    expect(t.pool.status).toBe("ok")
    expect(await bases()).toEqual({ A: 5, B: 5, C: 5 })
    await h.db.update(channels).set({ ordersBaselineRunId: null })
  })

  let siteBaselineRun = ""
  it("сайт подключён: 3 открытых заказа первого ingest — база не меняется, события delta 0 с coldStart channel; KIT и ЯМ списываются как прежде", async () => {
    const t = await tick("2026-09-27T10:10:00.000Z", [
      adapter("kit", [order("K1", "A"), order("K2", "A")]),
      // ЯМ читался в первом тике без заказов (счётчик ymOrders) — живая площадка, первый заказ списывается.
      adapter("ym", [order("Y1", "B")]),
      adapter("site", [order("S1", "A"), order("S2", "A"), order("S3", "C", 2)]),
    ])
    expect(t.ingest.status).toBe("ok")
    expect(t.ingest.counters).toMatchObject({ siteOrdersBaseline: 1 })
    expect(t.ingest.counters).not.toHaveProperty("kitOrdersBaseline")
    expect(t.ingest.counters).not.toHaveProperty("ymOrdersBaseline")
    siteBaselineRun = t.ingest.runId
    const ch = await loadChannels(h.db)
    const baselines = await h.db
      .select({ code: channels.code, b: channels.ordersBaselineRunId })
      .from(channels)
      .where(inArray(channels.id, [ch.get("site")!.id, ch.get("kit")!.id, ch.get("ym")!.id]))
    expect(Object.fromEntries(baselines.map((r) => [r.code, r.b]))).toEqual({ site: siteBaselineRun, kit: null, ym: null })

    expect(t.pool.status).toBe("ok")
    expect(await orderEvents(t.pool.runId)).toEqual([
      ["A", -1, null],
      ["A", 0, { coldStart: "channel" }],
      ["A", 0, { coldStart: "channel" }],
      ["B", -1, null],
      ["C", 0, { coldStart: "channel" }],
    ])
    expect(await bases()).toEqual({ A: 4, B: 4, C: 5 })
    // Метрики сводки compare-v1 («заказ ≤40 мин», двойной счёт) видят только сдвиги базы — холодный старт по площадке туда не попадает.
    expect([...(await mirrorOrderBarcodesSince(h.db, "2026-09-27T10:00:00.000Z"))].sort()).toEqual(["A", "B"])
  })

  it("заказ сайта, появившийся в следующем ingest, — списывается, даже если создан раньше подключения (лаг площадки)", async () => {
    const t = await tick("2026-09-27T10:12:00.000Z", [
      adapter("kit", [order("K1", "A"), order("K2", "A")]),
      adapter("ym", [order("Y1", "B")]),
      adapter("site", [order("S1", "A"), order("S2", "A"), order("S3", "C", 2), order("S4", "C", 1, "2026-09-20T09:00:00.000Z")]),
    ])
    expect(t.ingest.counters).not.toHaveProperty("siteOrdersBaseline")
    expect(await orderEvents(t.pool.runId)).toEqual([["C", -1, null]])
    expect(await bases()).toEqual({ A: 4, B: 4, C: 4 })
  })
})
