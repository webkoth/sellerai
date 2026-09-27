// Перенесено из finstock (27.09.2026): packages/platforms/src/ym/client.test.ts.
// Без изменений логики: клиент не содержит ничего финансового, тесты
// переносятся как есть (график выплат в тестах и не участвовал).
import { afterEach, describe, expect, it, vi } from "vitest"
import { creationWindows, fetchYmBarcodes, fetchYmOrders, fetchYmStocks } from "./client"
import type { YmOrder } from "./client"

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const CREDS = { apiKey: "секрет", businessId: "111", campaignId: "222" }

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

function order(patch: Partial<YmOrder> = {}): YmOrder {
  return {
    orderId: 1,
    campaignId: 222,
    programType: "FBS",
    status: "PROCESSING",
    substatus: "STARTED",
    creationDate: "2026-08-01T10:00:00+03:00",
    updateDate: "2026-08-01T10:05:00+03:00",
    fake: false,
    items: [{ id: 1, offerId: "A", offerName: "а", count: 1, prices: { payment: { value: 1500 }, cashback: { value: 0 }, subsidy: { value: 0 } } }],
    ...patch,
  }
}

describe("creationWindows — окна не длиннее 30 дней", () => {
  it("режет период на окна по 30 дней включительно, последнее короче", () => {
    expect(creationWindows("2026-06-01", "2026-08-05")).toEqual([
      { from: "2026-06-01", to: "2026-06-30" },
      { from: "2026-07-01", to: "2026-07-30" },
      { from: "2026-07-31", to: "2026-08-05" },
    ])
  })

  it("период внутри 30 дней — одно окно", () => {
    expect(creationWindows("2026-08-01", "2026-08-05")).toEqual([{ from: "2026-08-01", to: "2026-08-05" }])
  })

  it("начало позже конца — одно окно из конечной даты, а не пустота и не падение", () => {
    expect(creationWindows("2026-09-09", "2026-09-03")).toEqual([{ from: "2026-09-03", to: "2026-09-03" }])
  })
})

describe("fetchYmOrders", () => {
  it("шлёт Api-Key, POST по кабинету, фильтр по дате оформления, fake: false и свою кампанию", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ status: "OK", orders: [], paging: {} }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchYmOrders(CREDS, "2026-08-20T00:00:00.000Z", "2026-08-25")

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.partner.market.yandex.ru/v1/businesses/111/orders?limit=50")
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers["Api-Key"]).toBe("секрет")
    expect(headers["Authorization"]).toBeUndefined()
    expect(JSON.parse(init.body as string)).toEqual({
      // creationDateTo у площадки — исключающая граница (справка и
      // спецификация): конец окна "25", а в теле следующий день "26".
      dates: { creationDateFrom: "2026-08-20", creationDateTo: "2026-08-26" },
      fake: false,
      campaignIds: [222],
    })
  })

  it("листает страницы по pageToken внутри окна и копит все заказы", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ status: "OK", orders: [order({ orderId: 1 })], paging: { nextPageToken: "p2" } }))
      .mockResolvedValueOnce(response({ status: "OK", orders: [order({ orderId: 2 })], paging: {} }))
    vi.stubGlobal("fetch", fetchMock)

    const orders = await fetchYmOrders(CREDS, "2026-08-20", "2026-08-25")

    expect(orders.map((o) => o.orderId)).toEqual([1, 2])
    expect(new URL(fetchMock.mock.calls[1]?.[0] as string).searchParams.get("pageToken")).toBe("p2")
  })

  it("период длиннее 30 дней — по запросу на каждое окно", async () => {
    // mockImplementation, а не mockResolvedValue: тело Response читается один
    // раз, и один объект на несколько вызовов fetch падает на второй странице.
    const fetchMock = vi.fn().mockImplementation(async () => response({ status: "OK", orders: [], paging: {} }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchYmOrders(CREDS, "2026-06-01", "2026-08-05")

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const bodies = fetchMock.mock.calls.map(
      (c) =>
        JSON.parse((c[1] as RequestInit).body as string) as {
          dates: { creationDateFrom: string; creationDateTo: string }
        },
    )
    expect(bodies.map((b) => b.dates.creationDateFrom)).toEqual(["2026-06-01", "2026-07-01", "2026-07-31"])
    // Окна стыкуются встык: исключающая верхняя граница одного окна равна
    // включающей нижней границе следующего — ни разрыва, ни наложения.
    for (let i = 0; i < bodies.length - 1; i++) {
      expect(bodies[i]?.dates.creationDateTo).toBe(bodies[i + 1]?.dates.creationDateFrom)
    }
    expect(bodies[bodies.length - 1]?.dates.creationDateTo).toBe("2026-08-06")
  })

  it("по умолчанию until — сегодняшняя дата по Москве, верхняя граница — завтра", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-31T22:30:00.000Z")) // 2026-09-01 01:30 МСК
    const fetchMock = vi.fn().mockResolvedValue(response({ status: "OK", orders: [], paging: {} }))
    vi.stubGlobal("fetch", fetchMock)

    // since тоже за полночь по UTC, но уже "завтра" по Москве.
    await fetchYmOrders(CREDS, "2026-08-31T22:00:00.000Z") // 2026-09-01 01:00 МСК

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({
      dates: { creationDateFrom: "2026-09-01", creationDateTo: "2026-09-02" },
    })
  })

  it("тот же pageToken второй раз подряд останавливает цикл", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => response({ status: "OK", orders: [order()], paging: { nextPageToken: "same" } }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchYmOrders(CREDS, "2026-08-20", "2026-08-25")

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("fetchYmStocks", () => {
  it("POST по кампании, limit=200, страницы по pageToken, склады всех страниц вместе", async () => {
    const page = (id: number, next?: string) =>
      response({ status: "OK", result: { paging: next ? { nextPageToken: next } : {}, warehouses: [{ warehouseId: id, offers: [{ offerId: `O-${id}`, stocks: [{ type: "FIT", count: 1 }] }] }] } })
    const fetchMock = vi.fn().mockResolvedValueOnce(page(1, "p2")).mockResolvedValueOnce(page(2))
    vi.stubGlobal("fetch", fetchMock)

    const warehouses = await fetchYmStocks(CREDS)

    expect(warehouses.map((w) => w.warehouseId)).toEqual([1, 2])
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.partner.market.yandex.ru/v2/campaigns/222/offers/stocks?limit=200")
    expect(init.method).toBe("POST")
    expect(new URL(fetchMock.mock.calls[1]?.[0] as string).searchParams.get("pageToken")).toBe("p2")
  })

  it("ответ без складов даёт пустой массив", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ status: "OK", result: { paging: {}, warehouses: [] } })))
    expect(await fetchYmStocks(CREDS)).toEqual([])
  })
})

describe("fetchYmBarcodes", () => {
  it("режет на пачки по 100, склеивает карту артикул → штрихкоды", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { offerIds: string[] }
      return response({
        status: "OK",
        result: { paging: {}, offerMappings: body.offerIds.map((offerId) => ({ offer: { offerId, barcodes: [`bc-${offerId}`] }, mapping: {} })) },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const ids = Array.from({ length: 101 }, (_, i) => `O-${i}`)
    const map = await fetchYmBarcodes(CREDS, ids)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(map.size).toBe(101)
    expect(map.get("O-100")).toEqual(["bc-O-100"])
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("https://api.partner.market.yandex.ru/v2/businesses/111/offer-mappings?limit=100")
  })

  it("на пустом списке не делает запроса; повторы схлопывает", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ status: "OK", result: { paging: {}, offerMappings: [] } }))
    vi.stubGlobal("fetch", fetchMock)

    expect((await fetchYmBarcodes(CREDS, [])).size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()

    await fetchYmBarcodes(CREDS, ["A", "A"])
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({ offerIds: ["A"] })
  })

  it("товар без штрихкодов — пустой список, а не отсутствие ключа", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ status: "OK", result: { paging: {}, offerMappings: [{ offer: { offerId: "A" }, mapping: {} }] } })))
    expect((await fetchYmBarcodes(CREDS, ["A"])).get("A")).toEqual([])
  })
})
