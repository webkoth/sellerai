// Перенесено из finstock (27.09.2026): packages/platforms/src/ozon/mapper.test.ts.
// Ожидания `cancelled: true/false` заменены на `lifecycle: …` (через
// `ozonLifecycle`, см. lifecycle.test.ts); баркод — не собственный штрихкод
// Ozon (`firstBarcode`/`BarcodeByOffer` в чистом виде), а штрихкод WB через
// `resolveWbBarcode` поверх `WbCatalogIndex`, который передаётся отдельным
// аргументом; `skippedNoBarcode` (счётчик) заменён на `skippedNoWbBarcode`
// (список артикулов). Тесты остатков на контракт снимка (обнуление
// отрицательного результата, список пропусков) — новые, из плана, задача 4.
import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import postingsFixture from "./fixtures/postings-sample.json" with { type: "json" }
import stocksFixture from "./fixtures/stocks-sample.json" with { type: "json" }
import productInfoFixture from "./fixtures/product-info-sample.json" with { type: "json" }
import type { OzonPosting, OzonProductInfo, OzonStockItem } from "./client"
import { mapOzonOrders, mapOzonStocks } from "./mapper"

const postings = (postingsFixture as { postings: OzonPosting[] }).postings
const stockItems = (stocksFixture as { items: OzonStockItem[] }).items
const productInfo = (productInfoFixture as { items: OzonProductInfo[] }).items

/** Карта баркодов Ozon из живой фикстуры товаров — так, как её отдаёт fetchOzonBarcodes. */
const liveOzonBarcodes = new Map(productInfo.map((item) => [item.offer_id, item.barcodes ?? []]))

/**
 * Каталог WB для «живой» фикстуры остатков — синтетический, потому что
 * настоящего парного снимка каталога WB на момент снятия этих фикстур
 * (finstock, 03.09.2026) не существует: `stocks-sample.json` и
 * `product-info-sample.json` — один и тот же снимок Ozon (те же 4 offer_id),
 * а `postings-sample.json` снят отдельно и ни с одним из них не пересекается
 * по offer_id (проверено при переносе — ни один артикул отправлений не
 * встречается в остатках/товарах). Штрихкод Ozon из `product-info-sample`
 * подставлен сюда как штрихкод WB — не потому что это факт (собственный
 * штрихкод Ozon почти всегда отличается от штрихкода WB, см. `resolveWbBarcode`),
 * а чтобы «живая фикстура остатков» проверяла реальную форму ответа площадки,
 * а не только код скипа. Правило сопоставления (штрихкод / артикул) отдельно
 * проверяется на сконструированных данных ниже («mapOzonStocks — контракт
 * снимка»).
 */
const wbIndexFromLiveOzonCatalog = buildWbCatalogIndex(
  productInfo.map((item) => ({
    barcode: item.barcodes?.[0] ?? item.offer_id,
    vendorCode: item.offer_id,
    nmId: null,
    title: item.name,
    subject: null,
  })),
)

function posting(patch: Partial<OzonPosting> = {}): OzonPosting {
  return {
    posting_number: "0132112277-0101-1",
    order_id: 35566798085,
    order_number: "0132112277-0101",
    status: "awaiting_deliver",
    substatus: "posting_awaiting_registration",
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
    ...patch,
  }
}

describe("mapOzonOrders — живая фикстура", () => {
  it("даёт по строке на каждый товар каждого отправления, с целой ценой в копейках", () => {
    const productCount = postings.reduce((n, p) => n + p.products.length, 0)
    // Штрихкоды отправлений этой фикстуры не пересекаются ни с одним каталогом
    // WB, реальным или синтетическим (см. комментарий у wbIndexFromLiveOzonCatalog) —
    // штрихкод не проверяется здесь намеренно, только форма остальных полей.
    const orders = mapOzonOrders(postings, liveOzonBarcodes, wbIndexFromLiveOzonCatalog)

    expect(orders).toHaveLength(productCount)
    for (const order of orders) {
      expect(order.externalId).toMatch(/^[\d-]+:\d+$/)
      expect(Number.isInteger(order.priceMinor)).toBe(true)
      expect(order.priceMinor).toBeGreaterThan(0)
      expect(order.externalSku).not.toBeNull()
      expect(Date.parse(order.occurredAt)).not.toBeNaN()
    }
  })

  it("отменённое отправление фикстуры несёт cancelled_after_ship: true — его lifecycle: returned, а не cancelled_before_ship", () => {
    // Факт фикстуры (проверено при переносе, 27.09.2026): ровно одно
    // отменённое отправление, `cancellation.cancelled_after_ship: true` —
    // товар успел уехать и едет назад, по таблице «Правила жизненного цикла»
    // плана это returned, а не отмена до отгрузки.
    const cancelledInFixture = postings.filter((p) => p.status === "cancelled")
    expect(cancelledInFixture).toHaveLength(1)
    expect(cancelledInFixture[0]?.cancellation.cancelled_after_ship).toBe(true)

    const orders = mapOzonOrders(cancelledInFixture, liveOzonBarcodes, wbIndexFromLiveOzonCatalog)
    for (const order of orders) expect(order.lifecycle).toBe("returned")
  })
})

describe("mapOzonOrders — правила", () => {
  const emptyIndex = buildWbCatalogIndex([])

  it("цена из строки price.amount без прохода через число: «1530.0000» → 153000", () => {
    const [order] = mapOzonOrders([posting()], new Map(), emptyIndex)
    expect(order?.priceMinor).toBe(153000)
  })

  it("два товара в отправлении — две строки с разными идентификаторами", () => {
    const [a, b] = mapOzonOrders(
      [
        posting({
          products: [
            { offer_id: "A", sku: 1, name: "а", quantity: 1, price: { amount: "10.00", currency: "RUB" } },
            { offer_id: "B", sku: 2, name: "б", quantity: 2, price: { amount: "20.50", currency: "RUB" } },
          ],
        }),
      ],
      new Map(),
      emptyIndex,
    )
    expect(a?.externalId).toBe("0132112277-0101-1:1")
    expect(b?.externalId).toBe("0132112277-0101-1:2")
    expect(b?.quantity).toBe(2)
    expect(b?.priceMinor).toBe(2050)
  })

  it("жизненный цикл берётся из ozonLifecycle по статусу и cancellation, а не считается заново", () => {
    const [cancelled] = mapOzonOrders([posting({ status: "cancelled" })], new Map(), emptyIndex)
    const [delivered] = mapOzonOrders([posting({ status: "delivered" })], new Map(), emptyIndex)
    const [open] = mapOzonOrders([posting({ status: "awaiting_packaging" })], new Map(), emptyIndex)
    expect(cancelled?.lifecycle).toBe("cancelled_before_ship")
    expect(delivered?.lifecycle).toBe("shipped")
    expect(open?.lifecycle).toBe("open")
  })

  it("штрихкод — через resolveWbBarcode (каталог WB), не собственный штрихкод Ozon; не сопоставилось — null, строка не теряется", () => {
    const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "SK-58", nmId: null, title: "", subject: null }])
    const [withBarcode] = mapOzonOrders([posting()], new Map([["SK-58", ["2051508626795"]]]), wbIndex)
    const [withoutMatch] = mapOzonOrders([posting()], new Map(), emptyIndex)
    expect(withBarcode?.barcode).toBe("2051508626795")
    expect(withoutMatch?.barcode).toBeNull()
    expect(withoutMatch?.externalSku).toBe("SK-58")
  })

  it("время события — начало обработки, другого метод не даёт", () => {
    const [order] = mapOzonOrders([posting()], new Map(), emptyIndex)
    expect(order?.occurredAt).toBe("2026-08-01T10:00:00Z")
  })

  it("raw несёт товар и поля отправления, по которым строка опознаётся", () => {
    const [order] = mapOzonOrders([posting()], new Map(), emptyIndex)
    expect(order?.raw).toMatchObject({ offer_id: "SK-58", posting_number: "0132112277-0101-1", status: "awaiting_deliver" })
  })
})

function stockItem(patch: Partial<OzonStockItem> = {}): OzonStockItem {
  return { offer_id: "SK-58", product_id: 1, stocks: [{ type: "fbs", present: 1, reserved: 0 }], ...patch }
}

describe("mapOzonStocks — живая фикстура", () => {
  it("каждый товар со штрихкодом WB становится строкой, остальные — в пропуски (здесь: все 4 сопоставляются)", () => {
    const { stocks, skippedNoWbBarcode } = mapOzonStocks(stockItems, liveOzonBarcodes, wbIndexFromLiveOzonCatalog)
    expect(stocks.length + skippedNoWbBarcode.length).toBe(stockItems.length)
    expect(skippedNoWbBarcode).toEqual([])
    for (const stock of stocks) {
      expect(stock.barcode).not.toBe("")
      expect(Number.isInteger(stock.quantity)).toBe(true)
      expect(stock.warehouse).toBe("fbs")
      expect(stock.raw).toBeDefined()
    }
  })
})

describe("mapOzonStocks — правила", () => {
  const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "SK-58", nmId: null, title: "", subject: null }])
  const barcodes = new Map([["SK-58", ["2051508626795"]]])

  it("количество — present минус reserved по складу fbs", () => {
    const { stocks } = mapOzonStocks([stockItem({ stocks: [{ type: "fbs", present: 3, reserved: 1 }] })], barcodes, wbIndex)
    expect(stocks[0]?.quantity).toBe(2)
  })

  it("отрицательный результат обнуляется — контракт снимка требует quantity ≥ 0 (в отличие от finstock, где это был сигнал расхождения)", () => {
    const { stocks } = mapOzonStocks([stockItem({ stocks: [{ type: "fbs", present: 0, reserved: 1 }] })], barcodes, wbIndex)
    expect(stocks[0]?.quantity).toBe(0)
  })

  it("склады других типов в количество не входят", () => {
    const { stocks } = mapOzonStocks(
      [stockItem({ stocks: [{ type: "fbo", present: 5, reserved: 0 }, { type: "fbs", present: 1, reserved: 0 }] })],
      barcodes,
      wbIndex,
    )
    expect(stocks[0]?.quantity).toBe(1)
  })

  it("товар без записи fbs даёт строку с нулём, а не пропадает", () => {
    const { stocks, skippedNoWbBarcode } = mapOzonStocks([stockItem({ stocks: [] })], barcodes, wbIndex)
    expect(stocks[0]?.quantity).toBe(0)
    expect(skippedNoWbBarcode).toEqual([])
  })

  it("товар, для которого не нашёлся штрихкод WB — в skippedNoWbBarcode, не в строки", () => {
    const { stocks, skippedNoWbBarcode } = mapOzonStocks([stockItem()], new Map(), buildWbCatalogIndex([]))
    expect(stocks).toHaveLength(0)
    expect(skippedNoWbBarcode).toEqual(["SK-58"])
  })

  it("артикул продавца в externalSku, исходный товар в raw", () => {
    const { stocks } = mapOzonStocks([stockItem()], barcodes, wbIndex)
    expect(stocks[0]?.externalSku).toBe("SK-58")
    expect(stocks[0]?.raw).toMatchObject({ offer_id: "SK-58", product_id: 1 })
  })
})

// План 2026-09-27, задача 4, шаг 4 — тесты приведены как в плане.
describe("mapOzonStocks — контракт снимка (план, задача 4)", () => {
  it("остаток не ниже нуля: present − reserved бывает минус", () => {
    const r = mapOzonStocks(
      [{ offer_id: "JW-NB-AGT-M-0002", stocks: [{ type: "fbs", present: 0, reserved: 1 }] }] as never,
      new Map([["JW-NB-AGT-M-0002", ["460000000001"]]]),
      buildWbCatalogIndex([{ barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: null, title: "", subject: null }]),
    )
    expect(r.stocks).toEqual([expect.objectContaining({ barcode: "2041383032873", quantity: 0 })])
  })

  it("не сопоставилось со штрихкодом WB — в снимок не попадает, offer_id в списке пропусков", () => {
    const r = mapOzonStocks(
      [{ offer_id: "НЕТ", stocks: [{ type: "fbs", present: 1, reserved: 0 }] }] as never,
      new Map([["НЕТ", ["460000000001"]]]),
      buildWbCatalogIndex([]),
    )
    expect(r).toEqual({ stocks: [], skippedNoWbBarcode: ["НЕТ"] })
  })
})
