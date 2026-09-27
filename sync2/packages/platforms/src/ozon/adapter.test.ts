// Перенесено из finstock (27.09.2026): packages/platforms/src/ozon/adapter.test.ts,
// приведено к ChannelAdapter. Тесты fetchRealization/fetchRealizationTotals
// (и весь блок «платформа — ozon, отчёт о реализации...») убраны вместе
// с самими методами — у sync2-адаптера их нет. Штрихкод теперь резолвится
// через каталог WB (`wbIndex`), передаваемый в createOzonAdapter, а не берётся
// первым штрихкодом Ozon; счётчик skippedNoBarcode заменён списком skippedNoWbBarcode.
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import { createOzonAdapter } from "./adapter"

afterEach(() => vi.restoreAllMocks())

const CREDS = { apiKey: "секрет", clientId: "12345" }

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

/** Мок fetch, отвечающий по хвосту адреса — адаптер ходит в три метода. */
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

const posting = {
  posting_number: "0132112277-0101-1",
  order_id: 1,
  order_number: "0132112277-0101",
  status: "awaiting_deliver",
  substatus: "",
  in_process_at: "2026-08-01T10:00:00Z",
  cancellation: {
    cancel_reason_id: 0,
    cancel_reason: "",
    cancellation_type: "",
    cancelled_after_ship: false,
    affect_cancellation_rating: false,
    cancellation_initiator: "",
  },
  products: [
    { offer_id: "SK-58", sku: 827098843, name: "Товар", quantity: 1, price: { amount: "1530.0000", currency: "RUB" } },
  ],
}

describe("createOzonAdapter", () => {
  it("канал — ozon", () => {
    const adapter = createOzonAdapter(CREDS, buildWbCatalogIndex([]))
    expect(adapter.channel).toBe("ozon")
  })

  it("fetchOrders: отправления → штрихкоды Ozon по их артикулам одним вызовом → штрихкод WB через каталог", async () => {
    const calls = routeFetch({
      "/v4/posting/fbs/list": () => ({ cursor: "", has_next: false, postings: [posting] }),
      "/v3/product/info/list": () => ({
        items: [{ id: 1, offer_id: "SK-58", sku: 827098843, name: "Товар", barcodes: ["2051508626795"] }],
      }),
    })
    const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "SK-58", nmId: null, title: "", subject: null }])

    const orders = await createOzonAdapter(CREDS, wbIndex).fetchOrders("2026-08-01T00:00:00Z")

    expect(orders).toHaveLength(1)
    expect(orders[0]?.barcode).toBe("2051508626795")
    expect(orders[0]?.lifecycle).toBe("open")
    const infoCalls = calls.filter((c) => c.path === "/v3/product/info/list")
    expect(infoCalls).toHaveLength(1)
    expect(infoCalls[0]?.body).toEqual({ offer_id: ["SK-58"] })
  })

  it("fetchOrders без отправлений не ходит за штрихкодами", async () => {
    const calls = routeFetch({
      "/v4/posting/fbs/list": () => ({ cursor: "", has_next: false, postings: [] }),
    })

    const orders = await createOzonAdapter(CREDS, buildWbCatalogIndex([])).fetchOrders("2026-08-01T00:00:00Z")

    expect(orders).toEqual([])
    expect(calls.some((c) => c.path === "/v3/product/info/list")).toBe(false)
  })

  it("fetchStocks: остатки → штрихкоды Ozon по всем артикулам → строки со штрихкодом WB и список пропусков", async () => {
    routeFetch({
      "/v4/product/info/stocks": () => ({
        cursor: "",
        total: 2,
        items: [
          { offer_id: "SK-58", product_id: 1, stocks: [{ type: "fbs", present: 2, reserved: 1 }] },
          { offer_id: "NO-BC", product_id: 2, stocks: [{ type: "fbs", present: 1, reserved: 0 }] },
        ],
      }),
      "/v3/product/info/list": () => ({
        items: [
          { id: 1, offer_id: "SK-58", sku: 1, name: "а", barcodes: ["2051508626795"] },
          { id: 2, offer_id: "NO-BC", sku: 2, name: "б", barcodes: [] },
        ],
      }),
    })
    const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "SK-58", nmId: null, title: "", subject: null }])

    const { stocks, skippedNoWbBarcode } = await createOzonAdapter(CREDS, wbIndex).fetchStocks()

    expect(stocks).toEqual([
      expect.objectContaining({ barcode: "2051508626795", externalSku: "SK-58", quantity: 1, warehouse: "fbs" }),
    ])
    expect(skippedNoWbBarcode).toEqual(["NO-BC"])
  })
})
