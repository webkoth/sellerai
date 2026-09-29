import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { YM_STOCKS_BATCH, ymStocksBody, writeYmStocks } from "./stock-writer"

const cfg = {
  apiKey: "k",
  businessId: "191766894",
  campaignId: "149197829",
  warehouseId: 2369574,
  now: () => new Date("2026-09-28T10:00:00.000Z"),
  retryDelaysMs: [0],
}
const op = (barcode: string, offer: string, after: number): WriteOp => ({ channel: "ym", barcode, field: "stock", before: 0, after, externalSku: offer })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function stub(handler: () => Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => handler())
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeYmStocks", () => {
  it("PUT на кампанию: тело как у старого синка (проверено на проде с 19.07), ключ API-Key", async () => {
    const fetchMock = stub(() => json({ status: "OK" }))
    const r = await writeYmStocks(cfg, [op("A", "JW-A", 2)])
    expect(r).toEqual([{ barcode: "A", field: "stock", ok: true, response: { status: "OK" } }])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://api.partner.market.yandex.ru/v2/campaigns/149197829/offers/stocks")
    expect(init?.method).toBe("PUT")
    expect((init?.headers as Record<string, string>)["Api-Key"]).toBe("k")
    expect(JSON.parse(String(init?.body))).toEqual({
      skus: [{ sku: "JW-A", warehouseId: 2369574, items: [{ count: 2, type: "FIT", updatedAt: "2026-09-28T10:00:00.000Z" }] }],
    })
  })

  it("тело для живой проверки одного оффера (решение владельца п. 6) — то же, что уходит в сеть", async () => {
    const fetchMock = stub(() => json({ status: "OK" }))
    await writeYmStocks(cfg, [op("A", "JW-A", 3)])
    const sentBody: unknown = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))
    expect(ymStocksBody([{ offerId: "JW-A", count: 3 }], cfg.warehouseId, "2026-09-28T10:00:00.000Z")).toEqual(sentBody)
  })

  it("count — цель пула как есть, без резерва: пул 2 при FREEZE 1 — count 2 (документация: «Количество доступного товара»)", async () => {
    const fetchMock = stub(() => json({ status: "OK" }))
    await writeYmStocks(cfg, [{ ...op("A", "JW-A", 2), before: 1 }])
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body)).skus[0].items[0].count).toBe(2)
  })

  it("notUpdatedOfferIds — отказ этих позиций", async () => {
    stub(() => json({ status: "OK", result: { notUpdatedOfferIds: ["JW-B"] } }))
    const r = await writeYmStocks(cfg, [op("A", "JW-A", 2), op("B", "JW-B", 1)])
    expect(r.map((x) => [x.barcode, x.ok])).toEqual([["A", true], ["B", false]])
  })

  it("больше 200 позиций — пачки по 200", async () => {
    const fetchMock = stub(() => json({ status: "OK" }))
    await writeYmStocks(cfg, Array.from({ length: YM_STOCKS_BATCH + 1 }, (_, i) => op(`B${i}`, `JW-${i}`, 1)))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("5xx после повторов — неизвестно; 400 — отказ", async () => {
    stub(() => json({ status: "ERROR" }, 503))
    expect((await writeYmStocks(cfg, [op("A", "JW-A", 2)]))[0]).toMatchObject({ ok: false, uncertain: true })
    stub(() => json({ status: "ERROR", errors: [{ code: "BAD_REQUEST" }] }, 400))
    expect((await writeYmStocks(cfg, [op("A", "JW-A", 2)]))[0]).toMatchObject({ ok: false, uncertain: false })
  })

  it("200 без status OK — итог неизвестен", async () => {
    stub(() => json({ status: "ERROR" }))
    expect((await writeYmStocks(cfg, [op("A", "JW-A", 2)]))[0]).toMatchObject({ ok: false, uncertain: true })
  })

  it("400, называющий оффер, — ему отказ, остальные — один повтор без него", async () => {
    const bodies: unknown[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return bodies.length === 1
        ? json({ status: "ERROR", errors: [{ code: "BAD_REQUEST", message: "Offer 'JW-B' not found" }] }, 400)
        : json({ status: "OK" })
    })
    vi.stubGlobal("fetch", fetchMock)
    const r = await writeYmStocks(cfg, [op("A", "JW-A", 2), op("B", "JW-B", 1)])
    expect(r.map((x) => [x.barcode, x.ok, x.uncertain ?? false])).toEqual([
      ["B", false, false],
      ["A", true, false],
    ])
    expect(r[0]!.error).toMatch(/BAD_REQUEST/)
    expect(bodies.map((b) => (b as { skus: Array<{ sku: string }> }).skus.map((x) => x.sku))).toEqual([["JW-A", "JW-B"], ["JW-A"]])
  })

  it("400 без названных офферов — отказ пачке, повтора нет; «JW-1» не путается с «JW-12»", async () => {
    const fetchMock = stub(() => json({ status: "ERROR", errors: [{ code: "BAD_REQUEST", message: "Offer JW-12 not found" }] }, 400))
    const r = await writeYmStocks(cfg, [op("A", "JW-1", 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("по умолчанию — короткие повторы записи (2 с), а не минутные паузы чтения", async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      stub(() => (++calls === 1 ? json({ status: "ERROR" }, 502) : json({ status: "OK" })))
      const { retryDelaysMs: _omit, ...noRetry } = cfg
      const promise = writeYmStocks(noRetry, [op("A", "JW-A", 2)])
      await vi.advanceTimersByTimeAsync(2_000)
      await expect(promise).resolves.toEqual([expect.objectContaining({ ok: true })])
    } finally {
      vi.useRealTimers()
    }
  })
})
