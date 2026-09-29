// Перенесено из finstock (27.09.2026): packages/platforms/src/ym/mapper.test.ts.
// Ожидания `cancelled: true/false` заменены на `lifecycle: …` (через
// `ymLifecycle`, см. lifecycle.test.ts); баркод — не собственный штрихкод ЯМ
// (`firstBarcode`/`BarcodeByOffer` в чистом виде), а штрихкод WB через
// `resolveWbBarcode` поверх `WbCatalogIndex`, передаваемого отдельным
// аргументом; `skippedNoBarcode` (счётчик) заменён на `skippedNoWbBarcode`
// (список артикулов); остатки берутся только со складов магазина
// (`warehouseIds`, четвёртый аргумент mapYmStocks). Тест «склад не из конфига
// магазина» и обнуление отрицательного количества — новые, из плана, задача 5.
import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import ordersFixture from "./fixtures/orders-sample.json" with { type: "json" }
import stocksFixture from "./fixtures/stocks-sample.json" with { type: "json" }
import mappingsFixture from "./fixtures/offer-mappings-sample.json" with { type: "json" }
import type { YmOrder, YmWarehouseStocks } from "./client"
import { mapYmOrders, mapYmStocks, reservedCount, stockCount, unitPriceMinor, withOffersWithoutStock } from "./mapper"
import { ymLifecycle } from "./lifecycle"

const orders = (ordersFixture as { orders: YmOrder[] }).orders
const warehouses = (stocksFixture as { result: { warehouses: YmWarehouseStocks[] } }).result.warehouses
const mappings = (
  mappingsFixture as {
    result: { offerMappings: Array<{ offer: { offerId: string; barcodes?: string[] | null; vendorCode?: string } }> }
  }
).result.offerMappings

/** Карта баркодов ЯМ из живой фикстуры каталога — так, как её отдаёт fetchYmBarcodes. */
const liveBarcodes = new Map(mappings.map((m) => [m.offer.offerId, m.offer.barcodes ?? []]))

/**
 * Каталог WB для живой фикстуры остатков — здесь он НЕ синтетический (в
 * отличие от Ozon, где парного снимка каталога WB на момент снятия фикстур
 * не было): у этого магазина `offerId` = артикул WB, а штрихкод в
 * `offer-mappings-sample.json` — уже настоящий штрихкод WB (проверено при
 * переносе, 27.09.2026: все 4 offerId фикстуры остатков совпадают с
 * offerId этой фикстуры каталога, у каждого один непустой штрихкод формата
 * WB). Заказы (`orders-sample.json`) сняты отдельно и своим offerId
 * (`375485732833861`) с этими четырьмя не пересекаются — на них штрихкод WB
 * этот индекс не даст, что и проверяется отдельно.
 */
const wbIndexFromLiveYmCatalog = buildWbCatalogIndex(
  mappings.map((m) => ({
    barcode: m.offer.barcodes?.[0] ?? m.offer.offerId,
    vendorCode: m.offer.vendorCode ?? m.offer.offerId,
    nmId: null,
    title: "",
    subject: null,
  })),
)

const OWN_WAREHOUSE_ID = 2369574

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
    items: [{ id: 1, offerId: "A", offerName: "а", count: 1, prices: { payment: { value: 1500.5 }, cashback: { value: 0 }, subsidy: { value: 100 } } }],
    ...patch,
  }
}

const emptyIndex = buildWbCatalogIndex([])

describe("mapYmOrders — живая фикстура", () => {
  it("даёт по строке на каждый товар каждого заказа с целыми копейками и временем ISO", () => {
    const itemCount = orders.reduce((n, o) => n + o.items.length, 0)
    // Штрихкод здесь не проверяется намеренно: offerId заказов фикстуры
    // (снятой отдельно) не пересекается с каталогом (см. комментарий у
    // wbIndexFromLiveYmCatalog) — только форма остальных полей.
    const rows = mapYmOrders(orders, liveBarcodes, wbIndexFromLiveYmCatalog)

    expect(rows).toHaveLength(itemCount)
    for (const row of rows) {
      expect(row.externalId).toMatch(/^\d+:.+$/)
      expect(Number.isInteger(row.priceMinor)).toBe(true)
      expect(Date.parse(row.occurredAt)).not.toBeNaN()
      expect(row.externalSku).not.toBeNull()
    }
  })

  it("жизненный цикл каждой строки фикстуры совпадает с ymLifecycle её заказа", () => {
    for (const row of mapYmOrders(orders, liveBarcodes, wbIndexFromLiveYmCatalog)) {
      const source = orders.find((o) => String(o.orderId) === row.externalId.split(":")[0])
      expect(row.lifecycle).toBe(ymLifecycle({ status: source!.status, substatus: source!.substatus }))
    }
  })
})

describe("unitPriceMinor — цена единицы из сумм за строку", () => {
  it("платёж плюс баллы, каждое слагаемое в копейки отдельно", () => {
    expect(unitPriceMinor({ payment: { value: 100.1 }, cashback: { value: 0.2 } }, 1)).toBe(10030)
  })

  it("subsidy — вознаграждение продавцу, в цену покупателя не входит", () => {
    expect(unitPriceMinor({ payment: { value: 1000 }, subsidy: { value: 300 } }, 1)).toBe(100000)
  })

  it("суммы даны за все единицы — делится на count с округлением", () => {
    expect(unitPriceMinor({ payment: { value: 3001 } }, 2)).toBe(150050)
  })

  it("без цен — ноль, count меньше единицы не делит на ноль", () => {
    expect(unitPriceMinor(undefined, 1)).toBe(0)
    expect(unitPriceMinor({ payment: { value: 500 } }, 0)).toBe(50000)
  })
})

describe("mapYmOrders — правила", () => {
  it("идентификатор — заказ:id строки, две строки на два товара", () => {
    const [a, b] = mapYmOrders(
      [order({ items: [
        { id: 1, offerId: "A", count: 1, prices: { payment: { value: 10 } } },
        { id: 2, offerId: "B", count: 3, prices: { payment: { value: 60 } } },
      ] })],
      new Map(),
      emptyIndex,
    )
    expect(a?.externalId).toBe("1:1")
    expect(b?.externalId).toBe("1:2")
    expect(b?.quantity).toBe(3)
    expect(b?.priceMinor).toBe(2000)
  })

  it("две строки одного артикула в одном заказе не сливаются", () => {
    const [a, b] = mapYmOrders(
      [order({ items: [
        { id: 5, offerId: "A", count: 1, prices: { payment: { value: 10 } } },
        { id: 6, offerId: "A", count: 1, prices: { payment: { value: 10 } } },
      ] })],
      new Map(),
      emptyIndex,
    )
    expect(a?.externalId).toBe("1:5")
    expect(b?.externalId).toBe("1:6")
    expect(a?.externalSku).toBe("A")
    expect(b?.externalSku).toBe("A")
  })

  it("заказ без товаров даёт ноль строк", () => {
    expect(mapYmOrders([order({ items: [] })], new Map(), emptyIndex)).toEqual([])
  })

  it("жизненный цикл берётся из ymLifecycle по статусу и подстатусу, а не считается заново", () => {
    const [cancelledBeforeShip] = mapYmOrders([order({ status: "CANCELLED", substatus: "USER_CHANGED_MIND" })], new Map(), emptyIndex)
    const [cancelledAfterShip] = mapYmOrders([order({ status: "CANCELLED", substatus: "USER_REFUSED_PRODUCT" })], new Map(), emptyIndex)
    const [returned] = mapYmOrders([order({ status: "RETURNED" })], new Map(), emptyIndex)
    const [delivered] = mapYmOrders([order({ status: "DELIVERED" })], new Map(), emptyIndex)
    expect(cancelledBeforeShip?.lifecycle).toBe("cancelled_before_ship")
    expect(cancelledAfterShip?.lifecycle).toBe("returned")
    expect(returned?.lifecycle).toBe("returned")
    expect(delivered?.lifecycle).toBe("shipped")
  })

  it("тестовые заказы Маркета отбрасываются, даже если клиент их пропустил", () => {
    expect(mapYmOrders([order({ fake: true })], new Map(), emptyIndex)).toEqual([])
  })

  it("время события — дата оформления", () => {
    const [row] = mapYmOrders([order()], new Map(), emptyIndex)
    expect(row?.occurredAt).toBe("2026-08-01T10:00:00+03:00")
  })

  it("штрихкод — через resolveWbBarcode (каталог WB), не собственный штрихкод ЯМ; не сопоставилось — null, строка не теряется", () => {
    const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "A", nmId: null, title: "", subject: null }])
    const [withBarcode] = mapYmOrders([order()], new Map([["A", ["2051508626795"]]]), wbIndex)
    const [withoutMatch] = mapYmOrders([order()], new Map(), emptyIndex)
    expect(withBarcode?.barcode).toBe("2051508626795")
    expect(withoutMatch?.barcode).toBeNull()
    expect(withoutMatch?.externalSku).toBe("A")
  })

  it("raw несёт товар и поля заказа, по которым строка опознаётся", () => {
    const [row] = mapYmOrders([order()], new Map(), emptyIndex)
    expect(row?.raw).toMatchObject({ offerId: "A", orderId: 1, status: "PROCESSING", programType: "FBS" })
  })
})

describe("stockCount — какой тип остатка считать количеством", () => {
  it("AVAILABLE, если он есть", () => {
    expect(stockCount([{ type: "FIT", count: 3 }, { type: "AVAILABLE", count: 2 }])).toBe(2)
  })

  it("иначе FIT без резерва: FIT — «доступен для продажи или уже зарезервирован», FREEZE — резерв", () => {
    expect(stockCount([{ type: "FIT", count: 3 }, { type: "DEFECT", count: 1 }])).toBe(3)
    expect(stockCount([{ type: "FIT", count: 3 }, { type: "FREEZE", count: 1 }])).toBe(2)
  })

  it("живой случай 29.09 (оффер 38259864653534, заказ 62411188290 в доставке): FIT 1, FREEZE 1 — доступно 0", () => {
    expect(stockCount([{ type: "FIT", count: 1 }, { type: "FREEZE", count: 1 }])).toBe(0)
  })

  it("резерв больше FIT — не ниже нуля; AVAILABLE главнее разности", () => {
    expect(stockCount([{ type: "FIT", count: 1 }, { type: "FREEZE", count: 2 }])).toBe(0)
    expect(stockCount([{ type: "FIT", count: 3 }, { type: "FREEZE", count: 1 }, { type: "AVAILABLE", count: 1 }])).toBe(1)
  })

  it("ни того, ни другого — ноль", () => {
    expect(stockCount([{ type: "DEFECT", count: 1 }])).toBe(0)
    expect(stockCount([])).toBe(0)
    expect(stockCount(null)).toBe(0)
  })
})

describe("reservedCount — резерв под заказы (FREEZE)", () => {
  it("FREEZE, если есть, иначе 0", () => {
    expect(reservedCount([{ type: "FIT", count: 1 }, { type: "FREEZE", count: 1 }])).toBe(1)
    expect(reservedCount([{ type: "FIT", count: 1 }])).toBe(0)
    expect(reservedCount(null)).toBe(0)
  })
})

describe("mapYmStocks — живая фикстура", () => {
  it("каждый товар со штрихкодом WB своего склада становится строкой, остальные — в пропуски (здесь: все 4 сопоставляются)", () => {
    const offerCount = warehouses.reduce((n, w) => n + w.offers.length, 0)
    const { stocks, skippedNoWbBarcode } = mapYmStocks(warehouses, liveBarcodes, wbIndexFromLiveYmCatalog, [OWN_WAREHOUSE_ID])
    expect(stocks.length + skippedNoWbBarcode.length).toBe(offerCount)
    expect(skippedNoWbBarcode).toEqual([])
    for (const stock of stocks) {
      expect(stock.barcode).not.toBe("")
      expect(stock.warehouse).toMatch(/^\d+$/)
      expect(Number.isInteger(stock.quantity)).toBe(true)
      expect(stock.raw).toBeDefined()
    }
  })

  it("склад фикстуры не в списке складов магазина — ни одной строки", () => {
    const { stocks, skippedNoWbBarcode } = mapYmStocks(warehouses, liveBarcodes, wbIndexFromLiveYmCatalog, [999999])
    expect(stocks).toEqual([])
    expect(skippedNoWbBarcode).toEqual([])
  })
})

describe("mapYmStocks — правила", () => {
  const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "A", nmId: null, title: "", subject: null }])
  const barcodes = new Map([["A", ["2051508626795"]]])

  it("склад — идентификатор строкой, товар без записей остатка даёт ноль", () => {
    const { stocks } = mapYmStocks([{ warehouseId: 77, offers: [{ offerId: "A", stocks: [] }] }], barcodes, wbIndex, [77])
    expect(stocks).toEqual([expect.objectContaining({ barcode: "2051508626795", externalSku: "A", quantity: 0, warehouse: "77" })])
  })

  it("два склада магазина — две строки, не сумма: складывать будет домен", () => {
    const { stocks } = mapYmStocks(
      [
        { warehouseId: 1, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }] }] },
        { warehouseId: 2, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }] }] },
      ],
      barcodes,
      wbIndex,
      [1, 2],
    )
    expect(stocks.map((s) => s.warehouse)).toEqual(["1", "2"])
  })

  it("склад не из конфига магазина — не попадает в снимок", () => {
    const r = mapYmStocks(
      [
        { warehouseId: 2369574, offers: [{ offerId: "JW-NB-AGT-M-0002", stocks: [{ type: "AVAILABLE", count: 1 }] }] },
        { warehouseId: 1872191, offers: [{ offerId: "JW-NB-AGT-M-0002", stocks: [{ type: "AVAILABLE", count: 5 }] }] },
      ] as never,
      new Map([["JW-NB-AGT-M-0002", []]]),
      buildWbCatalogIndex([{ barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: null, title: "", subject: null }]),
      [2369574],
    )
    expect(r.stocks).toEqual([expect.objectContaining({ barcode: "2041383032873", quantity: 1, warehouse: "2369574" })])
  })

  it("товар без баркода в каталоге — в skippedNoWbBarcode (список, не счётчик)", () => {
    const { stocks, skippedNoWbBarcode } = mapYmStocks([{ warehouseId: 1, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }] }] }], new Map(), buildWbCatalogIndex([]), [1])
    expect(stocks).toHaveLength(0)
    expect(skippedNoWbBarcode).toEqual(["A"])
  })

  it("товар без штрихкода WB на нескольких складах магазина — один раз в skippedNoWbBarcode", () => {
    const { skippedNoWbBarcode } = mapYmStocks(
      [
        { warehouseId: 1, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }] }] },
        { warehouseId: 2, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }] }] },
      ],
      new Map(),
      buildWbCatalogIndex([]),
      [1, 2],
    )
    expect(skippedNoWbBarcode).toEqual(["A"])
  })

  it("количество не ниже нуля", () => {
    const { stocks } = mapYmStocks([{ warehouseId: 1, offers: [{ offerId: "A", stocks: [{ type: "AVAILABLE", count: -1 }] }] }], barcodes, wbIndex, [1])
    expect(stocks[0]?.quantity).toBe(0)
  })

  it("FIT 1, FREEZE 1 — строка снимка с доступным 0, резерв 1 в raw.reserved", () => {
    const { stocks } = mapYmStocks(
      [{ warehouseId: 1, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }, { type: "FREEZE", count: 1 }] }] }],
      barcodes,
      wbIndex,
      [1],
    )
    expect(stocks).toEqual([expect.objectContaining({ barcode: "2051508626795", quantity: 0 })])
    expect(stocks[0]?.raw).toMatchObject({ reserved: 1, offerId: "A" })
  })

  it("raw несёт товар и идентификатор склада", () => {
    const { stocks } = mapYmStocks([{ warehouseId: 1, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }] }] }], barcodes, wbIndex, [1])
    expect(stocks[0]?.raw).toMatchObject({ warehouseId: 1, offerId: "A" })
  })
})

describe("withOffersWithoutStock", () => {
  it("оффер магазина без записи остатка — пустой строкой на первом складе магазина; уже известный — не дублируется", () => {
    const warehouses = [{ warehouseId: 7, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }] }] }]
    expect(withOffersWithoutStock(warehouses, ["A", "NEW", "NEW"], [7, 8])).toEqual([
      ...warehouses,
      { warehouseId: 7, offers: [{ offerId: "NEW", stocks: [] }] },
    ])
  })
  it("все офферы уже в остатках или складов в конфиге нет — без изменений", () => {
    const warehouses = [{ warehouseId: 7, offers: [{ offerId: "A", stocks: [] }] }]
    expect(withOffersWithoutStock(warehouses, ["A"], [7])).toBe(warehouses)
    expect(withOffersWithoutStock(warehouses, ["B"], [])).toBe(warehouses)
  })
})
