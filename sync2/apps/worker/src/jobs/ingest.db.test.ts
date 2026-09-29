import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { countProducts, drizzleRunStore, lastCounter, latestStockSnapshots, loadChannels, loadOrdersSince, seedChannels } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb } from "@sync2/db/test-db"
import type { ChannelAdapter } from "@sync2/platforms"
import type { ChannelOrder, NormalizedStock, WbCatalogEntry } from "@sync2/shared"
import { createLogger } from "../log"
import { withRun } from "../run"
import { CATALOG_RETRY_DELAY_MS, runIngest } from "./ingest"

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
        sleep: async () => undefined,
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

/**
 * Ворота каталога по остатку (инцидент 29.09, 13:51 UTC): каталог 386 из 421 прошёл
 * проверку доли (91,7 %), и снимок WB, построенный по каталогу, прочитал 35 пропавших
 * штрихкодов как 0. Эталон остатка — последний снимок WB в базе: его пишет только
 * прогон с принятым каталогом.
 */
describe.skipIf(!TEST_DATABASE_URL)("runIngest: пропажа штрихкодов с остатком", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let n = 0
  const log = createLogger("error", { write: () => undefined })
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => h?.close())

  // Остаток WB: B0 — 2, B1 — 0, B2 — 1 на втором складе из двух (сумма по складам > 0).
  const wbStocks: NormalizedStock[] = [
    { barcode: "B0", externalSku: "V0", quantity: 2, warehouse: "1" },
    { barcode: "B1", externalSku: "V1", quantity: 0, warehouse: "1" },
    { barcode: "B2", externalSku: "V2", quantity: 0, warehouse: "1" },
    { barcode: "B2", externalSku: "V2", quantity: 1, warehouse: "2" },
  ]
  const without = (...barcodes: string[]) => cat(20).filter((e) => !barcodes.includes(e.barcode))

  /** reads — ответы fetchCatalog по порядку; последний повторяется на все дальнейшие чтения. */
  const ingest = async (reads: Array<WbCatalogEntry[] | Error>, opts: { acceptCatalog?: boolean } = {}) => {
    const at = new Date(Date.parse("2026-09-29T13:00:00.000Z") + ++n * 60_000)
    let call = 0
    const fresh: boolean[] = []
    const sleeps: number[] = []
    const fetchCatalog = async (o?: { fresh?: boolean }) => {
      fresh.push(o?.fresh ?? false)
      const r = reads[Math.min(call++, reads.length - 1)]!
      return r instanceof Error ? Promise.reject(r) : r
    }
    const outcome = await withRun("ingest", { store: drizzleRunStore(h.db), log, writeMode: "dry-run", now: () => at }, async (ctx) => {
      const r = await runIngest({
        db: h.db,
        now: () => at,
        runId: ctx.runId,
        log: ctx.log,
        acceptCatalog: opts.acceptCatalog ?? false,
        sleep: async (ms: number) => void sleeps.push(ms),
        adapters: {
          wb: { ...fake("wb", []), fetchStocks: async () => ({ stocks: wbStocks, skippedNoWbBarcode: [] }), fetchCatalog },
          mirrors: () => [fake("ozon", [])],
        },
      })
      return { status: r.status, counters: r.counters, error: r.errors.length ? r.errors.join("; ") : undefined }
    })
    return { ...outcome, fresh, sleeps }
  }
  const accepted = () => lastCounter(h.db, "ingest", "wbCatalogAccepted")

  it("первый каталог принят: снимка WB ещё нет — сравнивать не с чем", async () => {
    expect(await ingest([cat(20)])).toMatchObject({ status: "ok", counters: { wbCatalogAccepted: 20 } })
  })

  it("нет одного штрихкода с остатком > 0 при доле 95% — отклонено, снимки не пишутся, подсказка про --accept-catalog", async () => {
    const snapshotsBefore = await latestStockSnapshots(h.db)
    const r = await ingest([without("B2")])
    expect(r).toMatchObject({ status: "partial", counters: { wbCatalog: 19, catalogRejected: 1, catalogMissingInStock: 1 } })
    expect(r.counters).not.toHaveProperty("wbCatalogAccepted")
    expect(r.error).toMatch(/пропали штрихкоды с остатком > 0 в последнем снимке WB — 1 шт\.: B2; /)
    expect(r.error).toContain("ingest --accept-catalog")
    // Повтор чтения не исправил: одно ожидание, второе чтение — мимо кэша адаптера.
    expect(r.error).toMatch(/повтор чтения каталога не помог/)
    expect(r.counters).toMatchObject({ catalogRetried: 1 })
    expect(r.fresh).toEqual([false, true])
    expect(r.sleeps).toEqual([CATALOG_RETRY_DELAY_MS])
    expect(await accepted()).toBe(20)
    // Снимок WB не перезаписан коротким каталогом.
    expect(await latestStockSnapshots(h.db)).toEqual(snapshotsBefore)
  })

  it("нет штрихкода с остатком 0 при доле > 90% — принято", async () => {
    const r = await ingest([without("B1")])
    expect(r).toMatchObject({ status: "ok", counters: { wbCatalog: 19, wbCatalogAccepted: 19 } })
    expect(r.counters).not.toHaveProperty("catalogRejected")
    // Прошёл с первого чтения — повтора нет.
    expect(r.counters).not.toHaveProperty("catalogRetried")
    expect(r.fresh).toEqual([false])
    expect(r.sleeps).toEqual([])
  })

  it("повтор чтения исправил — принято по каталогу повтора, снимки пишутся", async () => {
    const r = await ingest([without("B2"), cat(20)])
    expect(r).toMatchObject({ status: "ok", counters: { wbCatalog: 20, wbCatalogAccepted: 20, catalogRetried: 1 } })
    expect(r.counters).not.toHaveProperty("catalogRejected")
    expect(r.counters).not.toHaveProperty("catalogMissingInStock")
    expect(r.fresh).toEqual([false, true])
    expect(r.counters).toMatchObject({ wbStock: 4, ozonStock: 1 })
    expect(await accepted()).toBe(20)
  })

  it("пустой каталог, повтор вернул полный — принято", async () => {
    const r = await ingest([[], cat(20)])
    expect(r).toMatchObject({ status: "ok", counters: { wbCatalogAccepted: 20, catalogRetried: 1 } })
  })

  it("повтор чтения упал — отклонено (partial), а не failed: пулу нужен catalogRejected", async () => {
    const r = await ingest([without("B2"), new Error("wb: 429")])
    expect(r).toMatchObject({ status: "partial", counters: { catalogRejected: 1, catalogRetried: 1, wbCatalog: 19 } })
    expect(r.error).toMatch(/повтор чтения каталога упал: wb: 429/)
    expect(r.error).toContain("ingest --accept-catalog")
    expect(await accepted()).toBe(20)
  })

  it("--accept-catalog: пропажа штрихкода с остатком принята без повтора, catalogForced", async () => {
    const r = await ingest([without("B1", "B2"), cat(20)], { acceptCatalog: true })
    expect(r).toMatchObject({ status: "ok", counters: { wbCatalogAccepted: 18, catalogForced: 1 } })
    expect(r.counters).not.toHaveProperty("catalogRejected")
    expect(r.counters).not.toHaveProperty("catalogRetried")
    expect(r.fresh).toEqual([false])
    expect(await accepted()).toBe(18)
  })
})
