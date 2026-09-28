import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { SITE_UNKNOWN_BARCODE, writeSiteStocks } from "./stock-writer"

const cfg = { baseUrl: "https://kotelnikovartifact.ru", token: "t".repeat(64) }
const op = (barcode: string, after: number): WriteOp => ({ channel: "site", barcode, field: "stock", before: 0, after, externalSku: null })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeSiteStocks", () => {
  it("PUT абсолютных остатков по штрихкоду; неизвестный сайту штрихкод — отказ позиции", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ updated: 1, unknown: ["B"], source: "pool" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const r = await writeSiteStocks(cfg, [op("A", 2), op("B", 0)])
    expect(r[0]).toEqual({ barcode: "A", field: "stock", ok: true, response: { source: "pool" } })
    expect(r[1]).toMatchObject({ barcode: "B", ok: false, uncertain: false, error: `${SITE_UNKNOWN_BARCODE} B` })
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
      items: [
        { barcode: "A", quantity: 2 },
        { barcode: "B", quantity: 0 },
      ],
    })
  })

  it("400 — отказ всей пачки без неопределённости", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "validation" }), { status: 400 })))
    expect((await writeSiteStocks(cfg, [op("A", 2)]))[0]).toMatchObject({ ok: false, uncertain: false })
  })

  it("по умолчанию — короткие повторы записи (2 с), а не минутные паузы чтения", async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => (++calls === 1 ? new Response("oops", { status: 502 }) : new Response(JSON.stringify({ updated: 1, unknown: [], source: "pool" }), { status: 200 }))),
      )
      const promise = writeSiteStocks(cfg, [op("A", 2)])
      await vi.advanceTimersByTimeAsync(2_000)
      await expect(promise).resolves.toEqual([expect.objectContaining({ ok: true })])
    } finally {
      vi.useRealTimers()
    }
  })
})
