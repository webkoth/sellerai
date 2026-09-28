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
  const ingest = (catalog: WbCatalogEntry[] | Error, opts: { mirrorsFail?: boolean; acceptCatalog?: boolean; configErrors?: string[]; site?: "wb" | "pool" } = {}) => {
    const at = new Date(Date.parse("2026-09-27T10:00:00.000Z") + ++n * 60_000)
    return withRun("ingest", { store: drizzleRunStore(h.db), log, writeMode: "dry-run", now: () => at }, async (ctx) => {
      const r = await runIngest({
        db: h.db,
        now: () => at,
        runId: ctx.runId,
        log: ctx.log,
        acceptCatalog: opts.acceptCatalog ?? false,
        adapters: {
          wb: { ...fake("wb", [order("W1")]), fetchCatalog: async () => (catalog instanceof Error ? Promise.reject(catalog) : catalog) },
          mirrors: () => [
            fake("ozon", [order("O1"), order("O0", 0)], opts.mirrorsFail),
            fake("kit", [order("K1")]),
            ...(opts.site
              ? [{ ...fake("site", []), fetchStocks: async () => ({ stocks: [], skippedNoWbBarcode: [], source: opts.site! }) }]
              : []),
          ],
          ...(opts.configErrors ? { configErrors: opts.configErrors } : {}),
        },
      })
      return { status: r.status, counters: r.counters, error: r.errors.length ? r.errors.join("; ") : undefined }
    })
  }
  const accepted = () => lastCounter(h.db, "ingest", "wbCatalogAccepted")

  it("каталог WB не получен — failed: без индекса остатки зеркал не сопоставить", async () => {
    const r = await ingest(new Error("wb: 500 — боль"))
    expect(r).toMatchObject({ status: "failed", counters: {} })
    expect(r.error).toContain("wb: 500")
    expect(await countProducts(h.db)).toBe(0)
  })

  it("пустой каталог WB отклоняется даже без эталона: пустой ответ — сбой чтения, а не магазин без товаров", async () => {
    const r = await ingest([])
    expect(r).toMatchObject({ status: "partial", counters: { wbCatalog: 0, catalogRejected: 1 } })
    expect(r.counters).not.toHaveProperty("wbCatalogAccepted")
    expect(r.error).toMatch(/каталог WB пуст/)
    expect(r.error).toContain("flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts ingest --accept-catalog")
    expect(await accepted()).toBeNull()
    expect(await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")).toEqual([])
  })

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
    expect(r.error).toMatch(/каталог WB 8 при прошлом принятом 10/)
    expect(r.error).toContain("flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts ingest --accept-catalog")
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

  it("пустой каталог при эталоне — отклонён; с --accept-catalog — принят", async () => {
    expect(await ingest([])).toMatchObject({ status: "partial", counters: { catalogRejected: 1 } })
    expect(await accepted()).toBe(8)
    const r = await ingest([], { acceptCatalog: true })
    expect(r).toMatchObject({ status: "ok", counters: { wbCatalogAccepted: 0, catalogForced: 1 } })
    expect(await accepted()).toBe(0)
  })

  it("битый конфиг сайта — partial с текстом, обязательные площадки записаны", async () => {
    const r = await ingest(cat(10), { configErrors: ["сайт пропущен: SITE_API_TOKEN короче 32 символов"] })
    expect(r.status).toBe("partial")
    expect(r.error).toContain("сайт пропущен: SITE_API_TOKEN")
    expect(r.counters).toMatchObject({ wbCatalogAccepted: 10, ozonOrders: 1, kitOrders: 1, kitStock: 1 })
  })

  it("сбой заказов площадки — <площадка>OrdersFailed; источник витрины сайта — siteSourcePool", async () => {
    const r = await ingest(cat(10), { mirrorsFail: true, site: "pool", acceptCatalog: true })
    expect(r.counters).toMatchObject({ ozonOrdersFailed: 1, siteSourcePool: 1 })
    expect(r.counters).not.toHaveProperty("kitOrdersFailed")
    const w = await ingest(cat(10), { site: "wb", acceptCatalog: true })
    expect(w.counters).toMatchObject({ siteSourcePool: 0 })
  })
})
