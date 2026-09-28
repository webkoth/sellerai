import { afterEach, describe, expect, it, vi } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { createSiteAdapter } from "./adapter"
import { SITE_PUT_MAX_ITEMS, putSiteStocks } from "./client"
import ordersFixture from "./fixtures/orders-sample.json" with { type: "json" }
import stocksFixture from "./fixtures/stocks-sample.json" with { type: "json" }

const config = { baseUrl: "https://kotelnikovartifact.ru", token: "t".repeat(64) }
const wbIndex = buildWbCatalogIndex([
  { barcode: "2041383032873", vendorCode: "v1", nmId: null, title: "", subject: null },
  { barcode: "2044473196868", vendorCode: "v2", nmId: null, title: "", subject: null },
])
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("createSiteAdapter", () => {
  it("канал — site", () => {
    expect(createSiteAdapter(config, wbIndex).channel).toBe("site")
  })

  it("заказы: GET /api/internal/orders?since=… с Bearer-токеном", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(ordersFixture))
    vi.stubGlobal("fetch", fetchMock)
    const rows = await createSiteAdapter(config, wbIndex).fetchOrders("2026-09-01T00:00:00.000Z")
    expect(rows).toHaveLength(4)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://kotelnikovartifact.ru/api/internal/orders?since=2026-09-01T00%3A00%3A00.000Z")
    expect(init?.method).toBe("GET")
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${config.token}`)
    // Bearer не должен уйти за переадресацией на другой хост: 30x — ошибка, а не переход.
    expect(init?.redirect).toBe("manual")
  })

  it("неполный список заказов (truncated) — ошибка, а не молча урезанные заказы", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ orders: [], truncated: true })))
    await expect(createSiteAdapter(config, wbIndex).fetchOrders("2026-09-01T00:00:00.000Z")).rejects.toThrow(/неполный/)
  })

  it("неверный токен — PlatformApiError 401 без повторов", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }))
    vi.stubGlobal("fetch", fetchMock)
    const err = await createSiteAdapter(config, wbIndex)
      .fetchOrders("2026-09-01T00:00:00.000Z")
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PlatformApiError)
    expect(err).toMatchObject({ platform: "site", status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("остатки: снимок по каталогу WB и источник остатка витрины", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(stocksFixture)))
    const r = await createSiteAdapter(config, wbIndex).fetchStocks()
    expect(r.source).toBe("wb")
    expect(r.stocks.map((s) => [s.barcode, s.quantity])).toEqual([
      ["2041383032873", 2],
      ["2044473196868", 0],
    ])
    expect(r.skippedNoWbBarcode).toEqual(["4600000000011"])
  })

  it("неизвестный источник остатка — ошибка", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ source: "что-то", items: [] })))
    await expect(createSiteAdapter(config, wbIndex).fetchStocks()).rejects.toThrow(/источник остатка/)
  })
})

describe("putSiteStocks", () => {
  it("PUT абсолютных остатков пачками не больше лимита сайта; итоги суммируются", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const n = (JSON.parse(String(init?.body)) as { items: unknown[] }).items.length
      return json({ updated: n, unknown: n === 1 ? ["X"] : [], source: "wb" })
    })
    vi.stubGlobal("fetch", fetchMock)
    const items = Array.from({ length: SITE_PUT_MAX_ITEMS + 1 }, (_, i) => ({ barcode: `B${i}`, quantity: i % 3 }))
    await expect(putSiteStocks(config, items)).resolves.toEqual({ updated: SITE_PUT_MAX_ITEMS + 1, unknown: ["X"] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://kotelnikovartifact.ru/api/internal/stocks")
    expect(init?.method).toBe("PUT")
  })

  it("дубль штрихкода — ошибка до сети", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(putSiteStocks(config, [{ barcode: "A", quantity: 1 }, { barcode: "A", quantity: 2 }])).rejects.toThrow(/дубль/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("пустой список — ни одного запроса", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(putSiteStocks(config, [])).resolves.toEqual({ updated: 0, unknown: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
