// Перенесено из finstock (27.09.2026): packages/platforms/src/wb/adapter.test.ts,
// приведено к ChannelAdapter. Тесты fetchRealization/fetchRealizationTotals
// убраны вместе с самими методами — их у sync2-адаптера нет. Тест «остаток
// со второго склада» переписан: контракт снимка 1.3a отдаёт сумму по складам
// домену (aggregateStockByBarcode), а не адаптеру, — здесь теперь проверяется,
// что склад не теряется, а не что адаптер сам всё сложил в одну строку.
import { afterEach, describe, expect, it, vi } from "vitest"
import { createWbAdapter } from "./adapter"
import type { WbFbsOrder } from "./client"

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

/**
 * Разводит мок fetch по методу площадки, а не по подстроке URL: `/orders`,
 * `/orders/new` и `/orders/status` — три РАЗНЫХ пути одного хоста, и
 * подстрочный поиск "/orders" совпал бы со всеми тремя сразу.
 */
function routeOrdersByPath(handlers: {
  new?: () => unknown
  period?: () => unknown
  status?: () => unknown
}): ReturnType<typeof vi.fn> {
  return vi.fn((input: string | URL) => {
    const { pathname } = new URL(String(input))
    if (pathname === "/api/v3/orders/new") {
      return Promise.resolve(jsonResponse(handlers.new?.() ?? { orders: [] }))
    }
    if (pathname === "/api/v3/orders/status") {
      return Promise.resolve(jsonResponse(handlers.status?.() ?? { orders: [] }))
    }
    if (pathname === "/api/v3/orders") {
      return Promise.resolve(jsonResponse(handlers.period?.() ?? { orders: [], next: null }))
    }
    throw new Error(`неожиданный URL в тесте: ${pathname}`)
  })
}

describe("createWbAdapter — fetchOrders", () => {
  it("заказ, попавший ТОЛЬКО в выдачу /orders за период (не в /orders/new), не должен теряться", async () => {
    // Задание, собранное между двумя тиками синка, /orders/new уже не
    // покажет — снимок текущего «нового» на него не попадает, — а /orders
    // за период обязан его поймать. /orders/new намеренно возвращает ПУСТО.
    const periodOnlyOrder = fbsOrder({ id: 777 })
    const fetchMock = routeOrdersByPath({
      new: () => ({ orders: [] }),
      period: () => ({ orders: [periodOnlyOrder], next: null }),
      status: () => ({ orders: [{ id: 777, supplierStatus: "new", wbStatus: "waiting" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createWbAdapter("token")
    const result = await adapter.fetchOrders("2026-08-01T00:00:00.000Z")

    expect(result.map((order) => order.externalId)).toContain("777")
  })

  it("заказ, вернувшийся в ОБОИХ источниках (/orders/new и /orders), не задваивается", async () => {
    const sharedOrder = fbsOrder({ id: 42 })
    const fetchMock = routeOrdersByPath({
      new: () => ({ orders: [sharedOrder] }),
      period: () => ({ orders: [sharedOrder], next: null }),
      status: () => ({ orders: [{ id: 42, supplierStatus: "new", wbStatus: "waiting" }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createWbAdapter("token")
    const result = await adapter.fetchOrders("2026-08-01T00:00:00.000Z")

    expect(result.filter((order) => order.externalId === "42")).toHaveLength(1)
  })

  it("отменённый по статусу заказ получает lifecycle: cancelled_before_ship — статус обязателен, а не только сами задания", async () => {
    // Ни /orders/new, ни /orders статуса не несут — без отдельного вызова
    // /orders/status отмена не видна никак, и отменённый заказ выглядел бы
    // проданным (lifecycle: open).
    const order = fbsOrder({ id: 5 })
    const fetchMock = routeOrdersByPath({
      new: () => ({ orders: [order] }),
      period: () => ({ orders: [], next: null }),
      status: () => ({ orders: [{ id: 5, supplierStatus: "cancel", wbStatus: null }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createWbAdapter("token")
    const result = await adapter.fetchOrders("2026-08-01T00:00:00.000Z")

    expect(result[0]?.lifecycle).toBe("cancelled_before_ship")
  })
})

describe("createWbAdapter — fetchStocks", () => {
  it("остаток со ВТОРОГО склада не должен теряться — обходятся ВСЕ склады; каждый склад — своя строка, сумма — дело домена", async () => {
    const warehouses = [
      { id: 1408913, name: "Мой склад Краснодар", officeId: null },
      { id: 2000000, name: "Второй склад", officeId: null },
    ]
    const fetchMock = vi.fn((input: string | URL) => {
      const { pathname } = new URL(String(input))
      if (pathname === "/api/v3/warehouses") return Promise.resolve(jsonResponse(warehouses))
      if (pathname === "/content/v2/get/cards/list") {
        return Promise.resolve(
          jsonResponse({
            cards: [{ nmID: 1, vendorCode: "v", sizes: [{ skus: ["111"] }] }],
            cursor: { total: 1 },
          }),
        )
      }
      if (pathname === "/api/v3/stocks/1408913") {
        return Promise.resolve(jsonResponse({ stocks: [{ sku: "111", chrtId: 1, amount: 2 }] }))
      }
      if (pathname === "/api/v3/stocks/2000000") {
        return Promise.resolve(jsonResponse({ stocks: [{ sku: "111", chrtId: 1, amount: 3 }] }))
      }
      throw new Error(`неожиданный URL в тесте: ${pathname}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createWbAdapter("token")
    const result = await adapter.fetchStocks()

    // Раньше (finstock) склады суммировались внутри адаптера в одну строку.
    // Контракт снимка 1.3a отдаёт эту сумму домену (aggregateStockByBarcode,
    // packages/domain/src/stock.test.ts) — здесь по штрихкоду должно быть
    // ДВЕ строки, по одной на склад, а их сумма всё равно 5: второй склад
    // не потерян, только не свёрнут заранее.
    //
    // `warehouse` — id склада (строкой), а не имя: имя продавец может
    // переименовать в личном кабинете в любой момент, а id — устойчивый ключ
    // склада (ревью 1.3a).
    const rowsForBarcode = result.stocks.filter((s) => s.barcode === "111")
    expect(rowsForBarcode).toHaveLength(2)
    expect(rowsForBarcode.map((s) => s.warehouse).sort()).toEqual(["1408913", "2000000"])
    const total = rowsForBarcode.reduce((sum, s) => sum + s.quantity, 0)
    expect(total).toBe(5)
    expect(total).not.toBe(2)
    expect(total).not.toBe(3)
    expect(result.skippedNoWbBarcode).toEqual([])
  })

  it("штрихкод каталога без остатка на складе — нулевая строка, а не пропуск (контракт снимка, п.1)", async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const { pathname } = new URL(String(input))
      if (pathname === "/api/v3/warehouses") {
        return Promise.resolve(jsonResponse([{ id: 1408913, name: "Мой склад Краснодар", officeId: null }]))
      }
      if (pathname === "/content/v2/get/cards/list") {
        return Promise.resolve(
          jsonResponse({
            cards: [
              { nmID: 1, vendorCode: "v1", sizes: [{ skus: ["111"] }] },
              { nmID: 2, vendorCode: "v2", sizes: [{ skus: ["222"] }] },
            ],
            cursor: { total: 2 },
          }),
        )
      }
      if (pathname === "/api/v3/stocks/1408913") {
        // Площадка отдаёт строку только по «111» — «222» опущен, потому что
        // его остаток равен нулю (см. комментарий у mapFbsStocks).
        return Promise.resolve(jsonResponse({ stocks: [{ sku: "111", chrtId: 1, amount: 4 }] }))
      }
      throw new Error(`неожиданный URL в тесте: ${pathname}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createWbAdapter("token")
    const result = await adapter.fetchStocks()

    expect(result.stocks).toHaveLength(2)
    expect(result.stocks.find((s) => s.barcode === "222")).toMatchObject({ quantity: 0, externalSku: "v2" })
    expect(result.stocks.find((s) => s.barcode === "111")).toMatchObject({ quantity: 4, externalSku: "v1" })
  })

  it("складов у продавца нет вовсе — возвращает пустой StockFetch, а не падает", async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const { pathname } = new URL(String(input))
      if (pathname === "/api/v3/warehouses") return Promise.resolve(jsonResponse([]))
      throw new Error(`неожиданный URL в тесте: ${pathname} — за каталогом/остатками ходить не должны`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createWbAdapter("token")
    const result = await adapter.fetchStocks()

    expect(result).toEqual({ stocks: [], skippedNoWbBarcode: [] })
  })

  it("каталог запрашивается один раз на экземпляр адаптера — fetchCatalog и fetchStocks делят кэш", async () => {
    let cardsListCalls = 0
    const fetchMock = vi.fn((input: string | URL) => {
      const { pathname } = new URL(String(input))
      if (pathname === "/api/v3/warehouses") {
        return Promise.resolve(jsonResponse([{ id: 1408913, name: "Склад", officeId: null }]))
      }
      if (pathname === "/content/v2/get/cards/list") {
        cardsListCalls += 1
        return Promise.resolve(
          jsonResponse({ cards: [{ nmID: 1, vendorCode: "v", sizes: [{ skus: ["111"] }] }], cursor: { total: 1 } }),
        )
      }
      if (pathname === "/api/v3/stocks/1408913") {
        return Promise.resolve(jsonResponse({ stocks: [{ sku: "111", chrtId: 1, amount: 1 }] }))
      }
      throw new Error(`неожиданный URL в тесте: ${pathname}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createWbAdapter("token")
    const catalog = await adapter.fetchCatalog()
    await adapter.fetchStocks()

    expect(cardsListCalls).toBe(1)
    expect(catalog).toEqual([{ nmId: 1, barcode: "111", vendorCode: "v", title: "v", subject: null }])
  })

  it("fetchCatalog({ fresh: true }) читает каталог заново, и fetchStocks спрашивает остатки уже по новому (повтор ворот ingest)", async () => {
    const reads = [
      [{ nmID: 1, vendorCode: "v", sizes: [{ skus: ["111"] }] }],
      [{ nmID: 1, vendorCode: "v", sizes: [{ skus: ["111"] }] }, { nmID: 2, vendorCode: "w", sizes: [{ skus: ["222"] }] }],
    ]
    let cardsListCalls = 0
    const stockBodies: unknown[] = []
    const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
      const { pathname } = new URL(String(input))
      if (pathname === "/api/v3/warehouses") {
        return Promise.resolve(jsonResponse([{ id: 1408913, name: "Склад", officeId: null }]))
      }
      if (pathname === "/content/v2/get/cards/list") {
        const cards = reads[Math.min(cardsListCalls++, reads.length - 1)]
        return Promise.resolve(jsonResponse({ cards, cursor: { total: cards!.length } }))
      }
      if (pathname === "/api/v3/stocks/1408913") {
        stockBodies.push(JSON.parse(String(init?.body)))
        return Promise.resolve(jsonResponse({ stocks: [] }))
      }
      throw new Error(`неожиданный URL в тесте: ${pathname}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const adapter = createWbAdapter("token")
    expect(await adapter.fetchCatalog()).toHaveLength(1)
    expect(await adapter.fetchCatalog({ fresh: true })).toHaveLength(2)
    await adapter.fetchStocks()

    expect(cardsListCalls).toBe(2)
    expect(stockBodies).toEqual([{ skus: ["111", "222"] }])
  })
})
