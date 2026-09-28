import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { OZON_STOCKS_BATCH, writeOzonStocks } from "./stock-writer"

const cfg = { clientId: "5332036", apiKey: "k", warehouseId: 1020005023618600, retryDelaysMs: [0] }
const op = (barcode: string, offer: string, after: number): WriteOp => ({ channel: "ozon", barcode, field: "stock", before: 0, after, externalSku: offer })
type Body = { stocks: Array<{ offer_id: string; stock: number; warehouse_id: number }> }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const updated = (b: Body) => json({ result: b.stocks.map((s) => ({ offer_id: s.offer_id, warehouse_id: s.warehouse_id, product_id: 1, updated: true, errors: [] })) })

function stub(handler: (body: Body) => Response) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => handler(JSON.parse(String(init?.body)) as Body))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeOzonStocks", () => {
  it("по offer_id на склад FBS абсолютным числом, с Client-Id; итог — по строке result", async () => {
    const fetchMock = stub(updated)
    const r = await writeOzonStocks(cfg, [op("A", "JW-A", 2)])
    expect(r).toEqual([
      { barcode: "A", field: "stock", ok: true, response: { offer_id: "JW-A", warehouse_id: 1020005023618600, product_id: 1, updated: true, errors: [] } },
    ])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://api-seller.ozon.ru/v2/products/stocks")
    expect((init?.headers as Record<string, string>)["Client-Id"]).toBe("5332036")
    expect(JSON.parse(String(init?.body))).toEqual({ stocks: [{ offer_id: "JW-A", stock: 2, warehouse_id: 1020005023618600 }] })
  })

  it("отказ позиции — коды Ozon без неопределённости; нет строки итога — неизвестно", async () => {
    stub(() =>
      json({ result: [{ offer_id: "JW-A", updated: false, errors: [{ code: "TOO_MANY_REQUESTS", message: "wait" }] }] }),
    )
    const r = await writeOzonStocks(cfg, [op("A", "JW-A", 2), op("B", "JW-B", 1)])
    expect(r[0]).toMatchObject({ barcode: "A", ok: false, uncertain: false, error: "Ozon: TOO_MANY_REQUESTS" })
    expect(r[1]).toMatchObject({ barcode: "B", ok: false, uncertain: true })
  })

  it("больше 100 позиций — пачки по 100", async () => {
    const fetchMock = stub(updated)
    const ops = Array.from({ length: OZON_STOCKS_BATCH + 1 }, (_, i) => op(`B${i}`, `JW-${i}`, 1))
    const r = await writeOzonStocks(cfg, ops)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(r.every((x) => x.ok)).toBe(true)
  })

  it("5xx после повторов — итог неизвестен у всей пачки", async () => {
    stub(() => json({ message: "internal" }, 500))
    const r = await writeOzonStocks(cfg, [op("A", "JW-A", 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true })
  })

  it("TOO_MANY_REQUESTS после повтора, который мог дойти (5xx на первой попытке), — итог неизвестен", async () => {
    let calls = 0
    stub(() => {
      calls++
      if (calls === 1) return json({ message: "gateway" }, 502)
      return json({ result: [{ offer_id: "JW-A", updated: false, errors: [{ code: "TOO_MANY_REQUESTS", message: "wait" }] }] })
    })
    const r = await writeOzonStocks(cfg, [op("A", "JW-A", 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true, error: expect.stringContaining("TOO_MANY_REQUESTS") })
  })

  it("по умолчанию — короткие повторы записи (2 с), а не минутные паузы чтения", async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      stub((b) => {
        calls++
        return calls === 1 ? json({ message: "gateway" }, 502) : updated(b)
      })
      const { retryDelaysMs: _omit, ...noRetry } = cfg
      const promise = writeOzonStocks(noRetry, [op("A", "JW-A", 2)])
      await vi.advanceTimersByTimeAsync(2_000)
      await expect(promise).resolves.toEqual([expect.objectContaining({ ok: true })])
    } finally {
      vi.useRealTimers()
    }
  })

  it("429 с Retry-After дольше потолка записи — сразу отказ, без минутного ожидания", async () => {
    vi.useFakeTimers()
    try {
      const fetchMock = stub(() => new Response(JSON.stringify({ message: "limit" }), { status: 429, headers: { "retry-after": "60" } }))
      const promise = writeOzonStocks(cfg, [op("A", "JW-A", 2)])
      await vi.advanceTimersByTimeAsync(0)
      await expect(promise).resolves.toEqual([expect.objectContaining({ ok: false, uncertain: false })])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
