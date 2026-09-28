import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import ordersFixture from "./fixtures/orders-sample.json" with { type: "json" }
import stocksFixture from "./fixtures/stocks-sample.json" with { type: "json" }
import type { SiteOrder, SiteStockItem } from "./client"
import { mapSiteOrders, mapSiteStocks } from "./mapper"

const wbIndex = buildWbCatalogIndex([
  { barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: 259678801, title: "Браслет", subject: "Браслеты" },
  { barcode: "2044473196868", vendorCode: "8797686554332", nmId: 1, title: "Подвеска", subject: "Подвески бижутерные" },
])
const orders = ordersFixture.orders as SiteOrder[]
const stocks = stocksFixture.items as SiteStockItem[]
const since = "2026-09-01T00:00:00.000Z"

describe("mapSiteStocks", () => {
  it("строка на каждый штрихкод сайта из каталога WB, нули включены; чужой — в пропуски", () => {
    expect(mapSiteStocks(stocks, wbIndex)).toEqual({
      stocks: [
        { barcode: "2041383032873", externalSku: null, quantity: 2, warehouse: null, raw: { barcode: "2041383032873", quantity: 2 } },
        { barcode: "2044473196868", externalSku: null, quantity: 0, warehouse: null, raw: { barcode: "2044473196868", quantity: 0 } },
      ],
      skippedNoWbBarcode: ["4600000000011"],
    })
  })
  it("остаток не ниже нуля и целый", () => {
    expect(mapSiteStocks([{ barcode: "2041383032873", quantity: -3 }], wbIndex).stocks[0]?.quantity).toBe(0)
    expect(mapSiteStocks([{ barcode: "2041383032873", quantity: 2.7 }], wbIndex).stocks[0]?.quantity).toBe(2)
  })
})

describe("mapSiteOrders", () => {
  it("позиция — строка; externalId — заказ:позиция; new → open, иное → returned", () => {
    expect(mapSiteOrders(orders, since, wbIndex).map((r) => [r.externalId, r.barcode, r.quantity, r.priceMinor, r.lifecycle])).toEqual([
      ["1001:5001", "2041383032873", 1, 189000, "open"],
      ["1001:5002", null, 2, 99000, "open"],
      ["1002:5003", "2044473196868", 1, 250000, "returned"],
      ["1003:5004", null, 1, 100000, "open"],
    ])
  })
  it("штрихкод сайта не из каталога WB — barcode null, исходный штрихкод в externalSku", () => {
    expect(mapSiteOrders(orders, since, wbIndex).find((r) => r.externalId === "1003:5004")).toMatchObject({
      barcode: null,
      externalSku: "4600000000011",
      occurredAt: "2026-09-27T10:00:00.000Z",
    })
  })
  it("заказы раньше since и с нечитаемой датой не попадают", () => {
    const broken = { ...orders[0]!, id: "999", createdAt: "вчера" }
    expect(mapSiteOrders([...orders, broken], "2026-09-27T00:00:00.000Z", wbIndex).map((r) => r.externalId)).toEqual(["1002:5003", "1003:5004"])
  })
  it("raw — только номер, статус, время и позиция", () => {
    expect(Object.keys(mapSiteOrders(orders, since, wbIndex)[0]!.raw as object).sort()).toEqual(["createdAt", "id", "item", "number", "status"])
  })
})
