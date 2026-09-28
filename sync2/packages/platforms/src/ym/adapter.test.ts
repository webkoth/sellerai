// Перенесено из finstock (27.09.2026): packages/platforms/src/ym/adapter.test.ts,
// приведено к ChannelAdapter. Блок про fetchRealization/keepNettingRow и весь
// денежный мок платформы (united-netting) убраны вместе с самими методами —
// у sync2-адаптера их нет. Штрихкод теперь резолвится через каталог WB
// (`wbIndex`), передаваемый в createYmAdapter, а не берётся первым штрихкодом
// ЯМ; счётчик skippedNoBarcode заменён списком skippedNoWbBarcode; остатки
// фильтруются по складам магазина (`warehouseIds`, третий аргумент).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import { createYmAdapter } from "./adapter"

// Время зафиксировано: клиент режет период заказов на окна по 30 дней от
// `since` до сегодня, и без фиксации число вызовов зависело бы от даты прогона.
// 2026-08-20 при since 2026-08-01 — одно окно, один вызов заказов.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-08-20T12:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const CREDS = { apiKey: "секрет", businessId: "111", campaignId: "222" }

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

function routeFetch(routes: Record<string, (body: unknown) => unknown>) {
  const calls: Array<{ path: string; body: unknown }> = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname
    const body = init.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path, body })
    const handler = routes[path]
    if (!handler) throw new Error(`нет маршрута для ${path}`)
    return response(handler(body))
  })
  vi.stubGlobal("fetch", fetchMock)
  return calls
}

const ymOrder = {
  orderId: 1,
  campaignId: 222,
  programType: "FBS",
  status: "PROCESSING",
  substatus: "STARTED",
  creationDate: "2026-08-01T10:00:00+03:00",
  updateDate: "2026-08-01T10:05:00+03:00",
  fake: false,
  items: [{ id: 1, offerId: "A", offerName: "а", count: 1, prices: { payment: { value: 1500 } } }],
}

describe("createYmAdapter", () => {
  it("канал — ym", () => {
    const adapter = createYmAdapter(CREDS, buildWbCatalogIndex([]), [])
    expect(adapter.channel).toBe("ym")
  })

  it("fetchOrders: заказы → штрихкоды ЯМ по их артикулам одним вызовом → штрихкод WB через каталог", async () => {
    const calls = routeFetch({
      "/v1/businesses/111/orders": () => ({ status: "OK", orders: [ymOrder], paging: {} }),
      "/v2/businesses/111/offer-mappings": () => ({
        status: "OK",
        result: { paging: {}, offerMappings: [{ offer: { offerId: "A", barcodes: ["460000000001"] }, mapping: {} }] },
      }),
    })
    const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "A", nmId: null, title: "", subject: null }])

    const orders = await createYmAdapter(CREDS, wbIndex, []).fetchOrders("2026-08-01T00:00:00.000Z")

    expect(orders).toHaveLength(1)
    expect(orders[0]?.barcode).toBe("2051508626795")
    expect(orders[0]?.lifecycle).toBe("open")
    expect(calls.filter((c) => c.path === "/v1/businesses/111/orders")).toHaveLength(1)
    const mappingCalls = calls.filter((c) => c.path === "/v2/businesses/111/offer-mappings")
    expect(mappingCalls).toHaveLength(1)
    expect(mappingCalls[0]?.body).toEqual({ offerIds: ["A"] })
  })

  it("fetchOrders без заказов не ходит в каталог", async () => {
    const calls = routeFetch({
      "/v1/businesses/111/orders": () => ({ status: "OK", orders: [], paging: {} }),
    })

    expect(await createYmAdapter(CREDS, buildWbCatalogIndex([]), []).fetchOrders("2026-08-01")).toEqual([])
    expect(calls.some((c) => c.path === "/v2/businesses/111/offer-mappings")).toBe(false)
  })

  it("fetchStocks: остатки → каталог по всем артикулам → строки со штрихкодом WB своих складов и список пропусков", async () => {
    routeFetch({
      "/v2/campaigns/222/offers/stocks": () => ({
        status: "OK",
        result: {
          paging: {},
          warehouses: [
            { warehouseId: 7, offers: [
              { offerId: "A", stocks: [{ type: "AVAILABLE", count: 1 }] },
              { offerId: "NO-BC", stocks: [{ type: "AVAILABLE", count: 1 }] },
            ] },
            // Склад не из конфига магазина — целиком не должен попасть в снимок.
            { warehouseId: 999, offers: [{ offerId: "A", stocks: [{ type: "AVAILABLE", count: 5 }] }] },
          ],
        },
      }),
      "/v2/businesses/111/offer-mappings": () => ({
        status: "OK",
        result: { paging: {}, offerMappings: [
          { offer: { offerId: "A", barcodes: ["460000000001"] }, mapping: {} },
          { offer: { offerId: "NO-BC", barcodes: [] }, mapping: {} },
        ] },
      }),
      "/v2/campaigns/222/offers": () => ({ status: "OK", result: { paging: {}, offers: [{ offerId: "A" }, { offerId: "NO-BC" }] } }),
    })
    const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "A", nmId: null, title: "", subject: null }])

    const { stocks, skippedNoWbBarcode } = await createYmAdapter(CREDS, wbIndex, [7]).fetchStocks()

    expect(stocks).toEqual([expect.objectContaining({ barcode: "2051508626795", externalSku: "A", quantity: 1, warehouse: "7" })])
    expect(skippedNoWbBarcode).toEqual(["NO-BC"])
  })

  it("fetchStocks: оффер магазина без записи остатка (NO_STOCKS) — нулевая строка на складе магазина", async () => {
    routeFetch({
      "/v2/campaigns/222/offers/stocks": () => ({ status: "OK", result: { paging: {}, warehouses: [] } }),
      "/v2/campaigns/222/offers": () => ({ status: "OK", result: { paging: {}, offers: [{ offerId: "A" }] } }),
      "/v2/businesses/111/offer-mappings": () => ({
        status: "OK",
        result: { paging: {}, offerMappings: [{ offer: { offerId: "A", barcodes: ["2051508626795"] } }] },
      }),
    })
    const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "A", nmId: null, title: "", subject: null }])
    const { stocks } = await createYmAdapter(CREDS, wbIndex, [7]).fetchStocks()
    expect(stocks).toEqual([expect.objectContaining({ barcode: "2051508626795", externalSku: "A", quantity: 0, warehouse: "7" })])
  })
})
