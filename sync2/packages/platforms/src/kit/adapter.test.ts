import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import { resetKitPaceForTests } from "./client"
import { createKitAdapter } from "./adapter"

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

const WAREHOUSE_ID = "01980d4c-1b53-7aa1-ab23-1b7c23604704"
const wbIndex = buildWbCatalogIndex([{ barcode: "2041383032873", vendorCode: "v1", nmId: null, title: "", subject: null }])

function routeKit(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/v1/variants")) {
      return Promise.resolve(
        jsonResponse({
          variants: [{ id: "v1", barcode: "2041383032873", stocks: [{ quantity: 3, warehouse_id: WAREHOUSE_ID }] }],
          total_count: 1,
        }),
      )
    }
    if (url.includes("/v1/orders")) {
      return Promise.resolve(
        jsonResponse({
          orders: [
            {
              id: "o1",
              order_number: 1,
              status: "NEW",
              created_at: new Date().toISOString(),
              delivery_chunks: [
                {
                  id: 0,
                  delivery_info: { method: "COURIER", raw_status: "NEW", warehouse_id: WAREHOUSE_ID },
                  items: [{ id: "i1", product_variant_id: "v1", quantity: 1, final_price: "100" }],
                },
              ],
            },
          ],
          total_count: 1,
        }),
      )
    }
    throw new Error(`неожиданный URL: ${url}`)
  })
}

beforeEach(() => {
  resetKitPaceForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("createKitAdapter", () => {
  it("канал — kit", () => {
    expect(createKitAdapter({ token: "t", warehouseId: WAREHOUSE_ID }, wbIndex).channel).toBe("kit")
  })

  it("fetchStocks отдаёт снимок по складу продаж из конфига, штрихкод — через каталог WB", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    routeKit(fetchMock)
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createKitAdapter({ token: "t", warehouseId: WAREHOUSE_ID }, wbIndex)
    const resultPromise = adapter.fetchStocks()
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.stocks).toEqual([expect.objectContaining({ barcode: "2041383032873", quantity: 3, warehouse: WAREHOUSE_ID })])
  })

  it("fetchOrders разрешает штрихкод позиции через каталог WB", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    routeKit(fetchMock)
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createKitAdapter({ token: "t", warehouseId: WAREHOUSE_ID }, wbIndex)
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const resultPromise = adapter.fetchOrders(since)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toEqual([expect.objectContaining({ barcode: "2041383032873" })])
  })

  it("варианты читаются один раз на экземпляр адаптера и переиспользуются fetchOrders и fetchStocks", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
    routeKit(fetchMock)
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createKitAdapter({ token: "t", warehouseId: WAREHOUSE_ID }, wbIndex)
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const ordersPromise = adapter.fetchOrders(since)
    await vi.runAllTimersAsync()
    await ordersPromise

    const variantsCallsAfterOrders = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/v1/variants")).length
    expect(variantsCallsAfterOrders).toBe(1)

    const stocksPromise = adapter.fetchStocks()
    await vi.runAllTimersAsync()
    await stocksPromise

    const variantsCallsAfterStocks = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/v1/variants")).length
    expect(variantsCallsAfterStocks).toBe(1)
  })
})
