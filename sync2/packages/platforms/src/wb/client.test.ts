// Перенесено из finstock (27.09.2026): packages/platforms/src/wb/fbs-client.test.ts.
// Тесты fetchAllBarcodes убраны вместе с самой функцией (см. client.ts) —
// каталог теперь строится из fetchAllCards напрямую в cards-mapper.ts.
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  fetchAllCards,
  fetchFbsOrders,
  fetchFbsOrderStatuses,
  fetchFbsStocks,
  fetchFbsWarehouses,
  fetchNewFbsOrders,
  isCancelledStatus,
  type WbFbsOrder,
  type WbFbsOrderStatus,
  type WbFbsStock,
} from "./client"

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

function fbsOrder(patch: Partial<WbFbsOrder> = {}): WbFbsOrder {
  return {
    id: 1,
    rid: "f884001e44e511edb8780242ac120002",
    article: "one-ring-7548",
    skus: ["6665956397512"],
    price: 504600, convertedPrice: 504600,
    createdAt: "2022-05-04T07:56:29Z",
    warehouseId: 658434,
    ...patch,
  }
}

function fbsOrderStatus(patch: Partial<WbFbsOrderStatus> = {}): WbFbsOrderStatus {
  return {
    id: 1,
    supplierStatus: "new",
    wbStatus: "waiting",
    ...patch,
  }
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

function requestUrl(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): URL {
  const [url] = fetchMock.mock.calls[callIndex] as [string | URL]
  return new URL(String(url))
}

describe("fetchNewFbsOrders", () => {
  it("идёт методом GET ровно на https://marketplace-api.wildberries.ru/api/v3/orders/new, без параметров", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: [] }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchNewFbsOrders("token")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(url)).toBe("https://marketplace-api.wildberries.ru/api/v3/orders/new")
    expect(init.method).toBe("GET")
  })

  it("разворачивает ответ из обёртки orders", async () => {
    const orders = [fbsOrder({ id: 1 }), fbsOrder({ id: 2 })]
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchNewFbsOrders("token")

    expect(result).toEqual(orders)
  })

  it("ответ без обёртки orders ({}) даёт пустой массив, а не падение", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchNewFbsOrders("token")

    expect(result).toEqual([])
  })

  it("ответ null даёт пустой массив, а не падение", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchNewFbsOrders("token")

    expect(result).toEqual([])
  })
})

describe("fetchFbsOrders", () => {
  const ORDERS_PAGE_LIMIT = 1000

  it("уходит на .../api/v3/orders с dateFrom в query как ЦЕЛЫЕ СЕКУНДЫ (не миллисекунды)", async () => {
    const fromUnix = 1_780_272_000
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: [], next: null }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchFbsOrders("token", fromUnix)

    const url = requestUrl(fetchMock, 0)
    expect(url.origin + url.pathname).toBe("https://marketplace-api.wildberries.ru/api/v3/orders")
    expect(url.searchParams.get("dateFrom")).toBe("1780272000")
  })

  it("dateTo не отправляется вовсе — с ним площадка отвергает запрос", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: [], next: null }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchFbsOrders("token", 1_780_272_000)

    expect(requestUrl(fetchMock, 0).searchParams.has("dateTo")).toBe(false)
  })

  it("курсор next=0 в первом запросе", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: [], next: null }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchFbsOrders("token", 1_780_272_000)

    const url = requestUrl(fetchMock, 0)
    expect(url.searchParams.get("next")).toBe("0")
  })

  it("полная страница вызывает второй запрос с next из ответа", async () => {
    const fullPage = Array.from({ length: ORDERS_PAGE_LIMIT }, (_, i) => fbsOrder({ id: i }))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ orders: fullPage, next: 12345 }))
      .mockResolvedValueOnce(jsonResponse({ orders: [], next: null }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsOrders("token", 1_780_272_000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondUrl = requestUrl(fetchMock, 1)
    expect(secondUrl.searchParams.get("next")).toBe("12345")
    expect(result).toHaveLength(ORDERS_PAGE_LIMIT)
  })

  it("неполная страница не вызывает второй запрос", async () => {
    const partialPage = Array.from({ length: ORDERS_PAGE_LIMIT - 1 }, (_, i) => fbsOrder({ id: i }))
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: partialPage, next: 999 }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsOrders("token", 1_780_272_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(ORDERS_PAGE_LIMIT - 1)
  })

  it("полная страница, но next=0 в ответе — завершает цикл, а не переспрашивает", async () => {
    const fullPage = Array.from({ length: ORDERS_PAGE_LIMIT }, (_, i) => fbsOrder({ id: i }))
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: fullPage, next: 0 }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsOrders("token", 1_780_272_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(ORDERS_PAGE_LIMIT)
  })

  it("полная страница, но next=null в ответе — завершает цикл", async () => {
    const fullPage = Array.from({ length: ORDERS_PAGE_LIMIT }, (_, i) => fbsOrder({ id: i }))
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: fullPage, next: null }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsOrders("token", 1_780_272_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(ORDERS_PAGE_LIMIT)
  })

  it("полная страница, но поле next отсутствует в ответе вовсе — завершает цикл", async () => {
    const fullPage = Array.from({ length: ORDERS_PAGE_LIMIT }, (_, i) => fbsOrder({ id: i }))
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: fullPage }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsOrders("token", 1_780_272_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(ORDERS_PAGE_LIMIT)
  })

  it("страницы копятся в один массив и отдаются целиком", async () => {
    const page1 = Array.from({ length: ORDERS_PAGE_LIMIT }, (_, i) => fbsOrder({ id: i }))
    const page2 = [fbsOrder({ id: 9001 }), fbsOrder({ id: 9002 })]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ orders: page1, next: 500 }))
      .mockResolvedValueOnce(jsonResponse({ orders: page2, next: null }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsOrders("token", 1_780_272_000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual([...page1, ...page2])
  })
})

describe("fetchFbsOrderStatuses", () => {
  it("отправляет POST на .../api/v3/orders/status с телом { orders: [...] }", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ orders: [fbsOrderStatus({ id: 1 })] }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchFbsOrderStatuses("token", [1])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(url)).toBe("https://marketplace-api.wildberries.ru/api/v3/orders/status")
    expect(init.method).toBe("POST")
    expect(requestBody(fetchMock, 0)).toEqual({ orders: [1] })
  })

  it("1001 идентификатор режется на два запроса — 1000 и 1, результаты склеиваются без потерь", async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => i + 1)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ orders: ids.slice(0, 1000).map((id) => fbsOrderStatus({ id })) }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ orders: ids.slice(1000).map((id) => fbsOrderStatus({ id })) }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsOrderStatuses("token", ids)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstBody = requestBody(fetchMock, 0)
    const secondBody = requestBody(fetchMock, 1)
    expect(firstBody.orders).toHaveLength(1000)
    expect(secondBody.orders).toHaveLength(1)

    const sentIds = [...(firstBody.orders as number[]), ...(secondBody.orders as number[])]
    expect(sentIds.sort((a, b) => a - b)).toEqual(ids)

    expect(result).toHaveLength(1001)
    expect(result.map((s) => s.id).sort((a, b) => a - b)).toEqual(ids)
  })

  it("пустой список идентификаторов не делает запроса вовсе и возвращает пустой массив", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsOrderStatuses("token", [])

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})

describe("isCancelledStatus", () => {
  it.each([
    ["supplierStatus", "cancel"],
    ["supplierStatus", "cancel_carrier"],
    ["wbStatus", "canceled"],
    ["wbStatus", "canceled_by_client"],
    ["wbStatus", "declined_by_client"],
    ["wbStatus", "defect"],
    ["wbStatus", "canceled_by_carrier"],
  ] as const)("%s = %s распознаётся как отмена", (field, value) => {
    const status = fbsOrderStatus({ [field]: value } as Partial<WbFbsOrderStatus>)
    expect(isCancelledStatus(status)).toBe(true)
  })

  it.each([
    ["supplierStatus", "new"],
    ["supplierStatus", "confirm"],
    ["supplierStatus", "complete"],
    ["wbStatus", "waiting"],
    ["wbStatus", "sorted"],
    ["wbStatus", "sold"],
    ["wbStatus", "ready_for_pickup"],
  ] as const)("%s = %s НЕ распознаётся как отмена", (field, value) => {
    const status = fbsOrderStatus({ [field]: value } as Partial<WbFbsOrderStatus>)
    expect(isCancelledStatus(status)).toBe(false)
  })
})

function fbsStock(patch: Partial<WbFbsStock> = {}): WbFbsStock {
  return {
    sku: "2041941855531",
    chrtId: 440206878,
    amount: 2,
    ...patch,
  }
}

interface WbCardFixture {
  nmID: number | null
  vendorCode?: string | null
  sizes?: Array<{ skus?: string[] | null }> | null
}

function wbCard(patch: Partial<WbCardFixture> = {}): WbCardFixture {
  return {
    nmID: 183804172,
    vendorCode: "one-ring-7548",
    sizes: [{ skus: ["2041941855531"] }],
    ...patch,
  }
}

describe("fetchFbsWarehouses", () => {
  it("идёт методом GET ровно на https://marketplace-api.wildberries.ru/api/v3/warehouses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal("fetch", fetchMock)

    await fetchFbsWarehouses("token")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(url)).toBe("https://marketplace-api.wildberries.ru/api/v3/warehouses")
    expect(init.method).toBe("GET")
  })

  it("пустой ответ ([]) даёт пустой массив", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsWarehouses("token")

    expect(result).toEqual([])
  })

  it("ответ null даёт пустой массив, а не падение", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsWarehouses("token")

    expect(result).toEqual([])
  })

  it("разворачивает голый массив складов как есть", async () => {
    const warehouses = [{ id: 1408913, name: "Мой склад Краснодар", officeId: 123 }]
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(warehouses))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsWarehouses("token")

    expect(result).toEqual(warehouses)
  })
})

describe("fetchFbsStocks", () => {
  it("отправляет POST на .../api/v3/stocks/{warehouseId} с телом { skus: [...] }, а НЕ { chrtIds }", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ stocks: [fbsStock()] }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchFbsStocks("token", 1408913, ["2041941855531"])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(url)).toBe("https://marketplace-api.wildberries.ru/api/v3/stocks/1408913")
    expect(init.method).toBe("POST")

    const body = requestBody(fetchMock, 0)
    expect(body).toHaveProperty("skus")
    expect(body).not.toHaveProperty("chrtIds")
    expect(body).toEqual({ skus: ["2041941855531"] })
  })

  it("разворачивает stocks из ответа как есть (sku, chrtId, amount)", async () => {
    const stock = fbsStock({ sku: "2041941855531", chrtId: 440206878, amount: 2 })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ stocks: [stock] }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsStocks("token", 1408913, ["2041941855531"])

    expect(result).toEqual([stock])
  })

  it("1001 баркод режется на два запроса — 1000 и 1, ни один не потерян", async () => {
    const skus = Array.from({ length: 1001 }, (_, i) => String(i + 1))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ stocks: skus.slice(0, 1000).map((sku) => fbsStock({ sku })) }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ stocks: skus.slice(1000).map((sku) => fbsStock({ sku })) }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsStocks("token", 1408913, skus)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstBody = requestBody(fetchMock, 0)
    const secondBody = requestBody(fetchMock, 1)
    expect((firstBody.skus as string[]).length).toBe(1000)
    expect((secondBody.skus as string[]).length).toBe(1)

    const sentSkus = [...(firstBody.skus as string[]), ...(secondBody.skus as string[])].sort()
    expect(sentSkus).toEqual([...skus].sort())
    expect(result).toHaveLength(1001)
  })

  it("пустой список баркодов не делает запроса вовсе", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsStocks("token", 1408913, [])

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it("ответ без обёртки stocks ({}) даёт пустой массив, а не падение", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsStocks("token", 1408913, ["111"])

    expect(result).toEqual([])
  })

  it("ответ null даёт пустой массив, а не падение", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchFbsStocks("token", 1408913, ["111"])

    expect(result).toEqual([])
  })
})

describe("fetchAllCards", () => {
  it("отправляет POST на content-api с телом settings.cursor.limit=100 и filter.withPhoto=-1", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ cards: [], cursor: { total: 0 } }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchAllCards("token")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit]
    expect(String(url)).toBe("https://content-api.wildberries.ru/content/v2/get/cards/list")
    expect(init.method).toBe("POST")
    expect(requestBody(fetchMock, 0)).toEqual({
      settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } },
    })
  })

  it("карточка с одним размером — одна карточка в результате", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ cards: [wbCard()], cursor: { total: 1 } }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchAllCards("token")

    expect(result).toEqual([wbCard()])
  })

  it("cursor.total равный limit вызывает второй запрос с cursor.updatedAt и cursor.nmID из ответа", async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) =>
      wbCard({ nmID: i, sizes: [{ skus: [String(i)] }] }),
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          cards: fullPage,
          cursor: { total: 100, updatedAt: "2026-08-01T10:00:00Z", nmID: 99 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ cards: [], cursor: { total: 0 } }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchAllCards("token")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(requestBody(fetchMock, 1)).toEqual({
      settings: {
        cursor: { limit: 100, updatedAt: "2026-08-01T10:00:00Z", nmID: 99 },
        filter: { withPhoto: -1 },
      },
    })
    expect(result).toHaveLength(100)
  })

  it("cursor.total меньше limit НЕ вызывает второй запрос", async () => {
    const partialPage = Array.from({ length: 5 }, (_, i) =>
      wbCard({ nmID: i, sizes: [{ skus: [String(i)] }] }),
    )
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        cards: partialPage,
        cursor: { total: 5, updatedAt: "2026-08-01T10:00:00Z", nmID: 4 },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchAllCards("token")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(5)
  })

  it("ответ null даёт пустой массив, а не падение", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchAllCards("token")

    expect(result).toEqual([])
  })

  it("непродвинувшийся курсор обрывает цикл, а не зацикливает его", async () => {
    // Полная страница (total === limit) означает «есть ещё», но курсор в ответе
    // тот же, что был отправлен. Без гварда это вечное повторение одного и того
    // же запроса: страница всегда полная, курсор всегда прежний.
    const fullPage = Array.from({ length: 100 }, (_, i) =>
      wbCard({ nmID: i, sizes: [{ skus: [String(i)] }] }),
    )
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          cards: fullPage,
          cursor: { total: 100, updatedAt: "2026-08-01T10:00:00Z", nmID: 99 },
        }),
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchAllCards("token")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(200)
  })

  it("потолок страниц: не крутится дольше него, даже если площадка честно продвигает курсор", async () => {
    let call = 0
    const fetchMock = vi.fn(() => {
      call += 1
      return Promise.resolve(
        jsonResponse({
          cards: [wbCard({ nmID: call, sizes: [{ skus: [String(call)] }] })],
          cursor: { total: 100, updatedAt: `2026-08-01T10:00:${String(call % 60).padStart(2, "0")}Z`, nmID: call },
        }),
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchAllCards("token")

    expect(fetchMock).toHaveBeenCalledTimes(1000)
    expect(result).toHaveLength(1000)
  })
})
