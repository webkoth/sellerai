import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { countProducts, latestStockSnapshots, loadChannels, loadOrdersSince, seedChannels } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { ChannelAdapter } from "@sync2/platforms"
import type { ChannelOrder, WbCatalogEntry } from "@sync2/shared"
import { runIngest } from "./ingest"

const cat = (n: number): WbCatalogEntry[] =>
  Array.from({ length: n }, (_, i) => ({ barcode: `B${i}`, vendorCode: `V${i}`, nmId: i, title: "", subject: null }))
const order = (id: string, q = 1): ChannelOrder => ({ externalId: id, barcode: "B0", externalSku: null, quantity: q, priceMinor: 0, lifecycle: "open", occurredAt: "2026-09-27T09:00:00.000Z", raw: {} })
const fake = (channel: ChannelAdapter["channel"], orders: ChannelOrder[], fail = false): ChannelAdapter => ({
  channel,
  fetchOrders: async () => (fail ? Promise.reject(new Error(`${channel} упал`)) : orders),
  fetchStocks: async () => ({ stocks: [{ barcode: "B0", externalSku: null, quantity: 1, warehouse: null }], skippedNoWbBarcode: [] }),
})

describe.skipIf(!TEST_DATABASE_URL)("runIngest", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let n = 0
  const runId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => h?.close())

  // У каждого прогона своё время: снимок уникален по паре «площадка + момент».
  const deps = (catalog: WbCatalogEntry[], mirrorsFail = false, at = `2026-09-27T10:0${n}:00.000Z`) => ({
    db: h.db,
    now: () => new Date(at),
    adapters: {
      wb: { ...fake("wb", [order("W1")]), fetchCatalog: async () => catalog },
      mirrors: () => [fake("ozon", [order("O1"), order("O0", 0)], mirrorsFail), fake("kit", [order("K1")])],
    },
  })

  it("пишет товары, заказы и снимки; строки с количеством 0 отбрасываются", async () => {
    const id = runId()
    await insertRun(h.db, id)
    const r = await runIngest({ ...deps(cat(10)), runId: id, previousCatalog: null })
    expect(r.status).toBe("ok")
    expect(await countProducts(h.db)).toBe(10)
    const orders = await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")
    expect(orders.map((o) => o.quantity)).toEqual([1, 1, 1])
    const channels = await loadChannels(h.db)
    expect((await latestStockSnapshots(h.db)).has(channels.get("kit")!.id)).toBe(true)
    expect(r.counters).toMatchObject({ wbCatalog: 10, ozonOrders: 1, kitOrders: 1 })
  })

  it("сбой площадки — partial, остальные площадки записаны", async () => {
    const id = runId()
    await insertRun(h.db, id)
    const r = await runIngest({ ...deps(cat(10), true), runId: id, previousCatalog: 10 })
    expect(r.status).toBe("partial")
    expect(r.errors).toEqual([expect.stringContaining("ozon")])
  })

  it("каталог WB короче 90% прошлого — ни заказов зеркал, ни снимков, partial", async () => {
    const id = runId()
    await insertRun(h.db, id)
    const before = (await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")).length
    const r = await runIngest({ ...deps(cat(8)), runId: id, previousCatalog: 10 })
    expect(r).toMatchObject({ status: "partial", counters: { catalogRejected: 1 } })
    expect((await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")).length).toBe(before)
  })
})
