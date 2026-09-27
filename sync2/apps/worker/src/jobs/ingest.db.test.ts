import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { countProducts, drizzleRunStore, lastCounter, latestStockSnapshots, loadChannels, loadOrdersSince, seedChannels } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb } from "@sync2/db/test-db"
import type { ChannelAdapter } from "@sync2/platforms"
import type { ChannelOrder, WbCatalogEntry } from "@sync2/shared"
import { createLogger } from "../log"
import { withRun } from "../run"
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
  const warnings: string[] = []
  const log = createLogger("warn", { write: (s: string) => void warnings.push(s) })
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => h?.close())

  /**
   * Один прогон ingest, как в cli: внутри withRun, с журналом runs — эталон каталога
   * берётся из прошлых прогонов в базе. У каждого прогона своя минута: снимок уникален
   * по паре «площадка + момент».
   */
  const ingest = (catalog: WbCatalogEntry[], opts: { mirrorsFail?: boolean; acceptCatalog?: boolean } = {}) => {
    const at = new Date(Date.parse("2026-09-27T10:00:00.000Z") + ++n * 60_000)
    return withRun("ingest", { store: drizzleRunStore(h.db), log, writeMode: "dry-run", now: () => at }, async (ctx) => {
      const r = await runIngest({
        db: h.db,
        now: () => at,
        runId: ctx.runId,
        log: ctx.log,
        acceptCatalog: opts.acceptCatalog ?? false,
        adapters: {
          wb: { ...fake("wb", [order("W1")]), fetchCatalog: async () => catalog },
          mirrors: () => [fake("ozon", [order("O1"), order("O0", 0)], opts.mirrorsFail), fake("kit", [order("K1")])],
        },
      })
      return { status: r.status, counters: r.counters, error: r.errors.length ? r.errors.join("; ") : undefined }
    })
  }
  const accepted = () => lastCounter(h.db, "ingest", "wbCatalogAccepted")

  it("пишет товары, заказы и снимки; строки с количеством 0 отбрасываются; первый каталог принят", async () => {
    const r = await ingest(cat(10))
    expect(r.status).toBe("ok")
    expect(await countProducts(h.db)).toBe(10)
    const orders = await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")
    expect(orders.map((o) => o.quantity)).toEqual([1, 1, 1])
    const channels = await loadChannels(h.db)
    expect((await latestStockSnapshots(h.db)).has(channels.get("kit")!.id)).toBe(true)
    expect(r.counters).toMatchObject({ wbCatalog: 10, wbCatalogAccepted: 10, ozonOrders: 1, kitOrders: 1 })
    expect(await accepted()).toBe(10)
  })

  it("сбой площадки — partial, остальные площадки записаны, каталог принят", async () => {
    const r = await ingest(cat(10), { mirrorsFail: true })
    expect(r.status).toBe("partial")
    expect(r.error).toContain("ozon")
    expect(r.counters).toMatchObject({ wbCatalogAccepted: 10 })
  })

  it("каталог WB короче 90% принятого — ни заказов зеркал, ни снимков, partial с подсказкой", async () => {
    const before = (await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")).length
    const r = await ingest(cat(8))
    expect(r).toMatchObject({ status: "partial", counters: { wbCatalog: 8, catalogRejected: 1 } })
    expect(r.counters).not.toHaveProperty("wbCatalogAccepted")
    expect(r.error).toMatch(/--accept-catalog/)
    expect((await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")).length).toBe(before)
    // Отклонённый прогон не сдвигает эталон.
    expect(await accepted()).toBe(10)
  })

  it("второй тик с тем же коротким каталогом — снова отклонён: эталон не стал 8", async () => {
    const r = await ingest(cat(8))
    expect(r).toMatchObject({ status: "partial", counters: { catalogRejected: 1 } })
    expect(await accepted()).toBe(10)
  })

  it("--accept-catalog: короткий каталог принят без проверки доли, эталон обновлён, в логе warn", async () => {
    warnings.length = 0
    const r = await ingest(cat(8), { acceptCatalog: true })
    expect(r.status).toBe("ok")
    expect(r.counters).toMatchObject({ wbCatalogAccepted: 8, catalogForced: 1 })
    expect(r.counters).not.toHaveProperty("catalogRejected")
    expect(await accepted()).toBe(8)
    expect(warnings.map((w) => JSON.parse(w).msg).join("\n")).toMatch(/без проверки/)
    // Следующий обычный тик сравнивает уже с 8.
    expect((await ingest(cat(8))).status).toBe("ok")
  })
})
