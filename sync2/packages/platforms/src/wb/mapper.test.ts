// Перенесено из finstock (27.09.2026): packages/platforms/src/wb/fbs-mapper.test.ts.
// Ожидания `cancelled: true/false` заменены на `lifecycle: …` по таблице
// плана; `mapFbsStocks` переписан под контракт снимка (строка на каждый
// штрихкод каталога, включая нулевые, без суммирования складов — см.
// комментарий у функции в mapper.ts), поэтому его тесты — новые.
import fixture from "./fixtures/fbs-orders-sample.json" with { type: "json" }
import { describe, expect, it } from "vitest"
import type { WbFbsOrder, WbFbsOrderStatus, WbFbsStock } from "./client"
import { mapFbsOrders, mapFbsStocks } from "./mapper"

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

describe("mapFbsOrders — деньги", () => {
  it("price уже в копейках — переносится как есть, без умножения", () => {
    const [order] = mapFbsOrders([fbsOrder({ price: 504600, convertedPrice: 504600 })])
    expect(order?.priceMinor).toBe(504600)
    // Отдельное утверждение против машинального rubToMinor: 5046 ₽ вместо
    // 504 600 ₽ на экране магазина метеоритов выглядят одинаково правдоподобно,
    // и ошибка нашлась бы только при сверке с выплатой.
    expect(order?.priceMinor).not.toBe(50460000)
  })

  it("price: null, convertedPrice: null даёт priceMinor: 0", () => {
    const [order] = mapFbsOrders([fbsOrder({ price: null, convertedPrice: null })])
    expect(order?.priceMinor).toBe(0)
  })
})

describe("mapFbsOrders — баркод", () => {
  it("берёт первый элемент skus", () => {
    const [order] = mapFbsOrders([fbsOrder({ skus: ["111", "222"] })])
    expect(order?.barcode).toBe("111")
  })

  it("skus: null даёт barcode: null, а не падение", () => {
    const [order] = mapFbsOrders([fbsOrder({ skus: null })])
    expect(order?.barcode).toBeNull()
  })

  it("skus: [] даёт barcode: null, а не падение", () => {
    const [order] = mapFbsOrders([fbsOrder({ skus: [] })])
    expect(order?.barcode).toBeNull()
  })
})

describe("mapFbsOrders — остальные поля", () => {
  it("quantity всегда 1", () => {
    const [order] = mapFbsOrders([fbsOrder()])
    expect(order?.quantity).toBe(1)
  })

  it("article: null даёт externalSku: null", () => {
    const [order] = mapFbsOrders([fbsOrder({ article: null })])
    expect(order?.externalSku).toBeNull()
  })

  it("externalId — String(id)", () => {
    const [order] = mapFbsOrders([fbsOrder({ id: 42 })])
    expect(order?.externalId).toBe("42")
  })

  it("occurredAt берётся из createdAt", () => {
    const [order] = mapFbsOrders([fbsOrder({ createdAt: "2026-01-02T03:04:05Z" })])
    expect(order?.occurredAt).toBe("2026-01-02T03:04:05Z")
  })

  it("raw содержит исходную строку заказа и статус", () => {
    const row = fbsOrder()
    const status = fbsOrderStatus({ id: row.id })
    const [order] = mapFbsOrders([row], [status])
    expect(order?.raw).toEqual({ order: row, status })
  })

  it("raw.status: null, если статус не пришёл", () => {
    const row = fbsOrder()
    const [order] = mapFbsOrders([row])
    expect(order?.raw).toEqual({ order: row, status: null })
  })

  it("пустой массив даёт пустой массив", () => {
    expect(mapFbsOrders([])).toEqual([])
  })
})

describe("mapFbsOrders — статусы и жизненный цикл", () => {
  it("отменённый статус ставит lifecycle: cancelled_before_ship", () => {
    const [order] = mapFbsOrders(
      [fbsOrder({ id: 1 })],
      [fbsOrderStatus({ id: 1, supplierStatus: "cancel", wbStatus: null })],
    )
    expect(order?.lifecycle).toBe("cancelled_before_ship")
  })

  it("supplierStatus complete ставит lifecycle: shipped", () => {
    const [order] = mapFbsOrders(
      [fbsOrder({ id: 1 })],
      [fbsOrderStatus({ id: 1, supplierStatus: "complete", wbStatus: "sorted" })],
    )
    expect(order?.lifecycle).toBe("shipped")
  })

  it("рабочий статус на сборке ставит lifecycle: open", () => {
    const [order] = mapFbsOrders(
      [fbsOrder({ id: 1 })],
      [fbsOrderStatus({ id: 1, supplierStatus: "new", wbStatus: "waiting" })],
    )
    expect(order?.lifecycle).toBe("open")
  })

  it("отсутствие статуса даёт lifecycle: open — /orders/new отдаёт только новые, молчание не значит отмену", () => {
    const [order] = mapFbsOrders([fbsOrder({ id: 1 })])
    expect(order?.lifecycle).toBe("open")
  })

  it("statuses не переданы вовсе (аргумент опущен) — тоже lifecycle: open", () => {
    const [order] = mapFbsOrders([fbsOrder({ id: 1 })], undefined)
    expect(order?.lifecycle).toBe("open")
  })

  it("статус, пришедший для чужого id, ни на кого не влияет", () => {
    const [order] = mapFbsOrders(
      [fbsOrder({ id: 1 })],
      [fbsOrderStatus({ id: 999, supplierStatus: "cancel", wbStatus: null })],
    )
    expect(order?.lifecycle).toBe("open")
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

describe("mapFbsStocks", () => {
  it("пустой каталог даёт пустой результат без пропусков", () => {
    expect(mapFbsStocks([], [])).toEqual({ stocks: [], skippedNoWbBarcode: [] })
  })

  it("штрихкод из каталога без строки в ответе остатков — нулевая строка", () => {
    const r = mapFbsStocks(
      [{ sku: "2041383032873", chrtId: null, amount: 2 }],
      [
        { barcode: "2041383032873", vendorCode: "JW-0002" },
        { barcode: "2044473196868", vendorCode: "JW-0100" },
      ],
    )
    expect(r.stocks.find((s) => s.barcode === "2044473196868")).toMatchObject({ quantity: 0, externalSku: "JW-0100" })
    expect(r.stocks.find((s) => s.barcode === "2041383032873")?.quantity).toBe(2)
  })

  it("строка на каждый штрихкод каталога — ни больше, ни меньше", () => {
    const r = mapFbsStocks(
      [fbsStock({ sku: "111", amount: 5 })],
      [
        { barcode: "111", vendorCode: "v1" },
        { barcode: "222", vendorCode: "v2" },
        { barcode: "333", vendorCode: "v3" },
      ],
    )
    expect(r.stocks).toHaveLength(3)
    expect(r.stocks.map((s) => s.barcode).sort()).toEqual(["111", "222", "333"])
  })

  it("остаток по штрихкоду не из каталога не даёт строки — каталог решает, какие штрихкоды существуют", () => {
    const r = mapFbsStocks([fbsStock({ sku: "999", amount: 10 })], [{ barcode: "111", vendorCode: "v1" }])
    expect(r.stocks).toEqual([{ barcode: "111", externalSku: "v1", quantity: 0, warehouse: null, raw: null }])
  })

  it("externalSku берётся из каталога (артикул продавца, не nmId)", () => {
    const r = mapFbsStocks([fbsStock({ sku: "111" })], [{ barcode: "111", vendorCode: "one-ring-7548" }])
    expect(r.stocks[0]?.externalSku).toBe("one-ring-7548")
  })

  it("amount: null считается как 0, а не отбрасывает строку", () => {
    const r = mapFbsStocks([fbsStock({ sku: "111", amount: null })], [{ barcode: "111", vendorCode: "v" }])
    expect(r.stocks).toHaveLength(1)
    expect(r.stocks[0]?.quantity).toBe(0)
  })

  it("отрицательный amount приводится к нулю — контракт снимка требует quantity ≥ 0", () => {
    const r = mapFbsStocks([fbsStock({ sku: "111", amount: -3 })], [{ barcode: "111", vendorCode: "v" }])
    expect(r.stocks[0]?.quantity).toBe(0)
  })

  it("warehouse не проставляется здесь — это дело адаптера (одна строка на один вызов = один склад)", () => {
    const r = mapFbsStocks([fbsStock({ sku: "111", amount: 2 })], [{ barcode: "111", vendorCode: "v" }])
    expect(r.stocks[0]?.warehouse).toBeNull()
  })

  it("raw хранит исходную строку остатка; для синтезированной нулевой строки — null", () => {
    const stock = fbsStock({ sku: "111", amount: 2 })
    const r = mapFbsStocks([stock], [{ barcode: "111", vendorCode: "v" }, { barcode: "222", vendorCode: "v2" }])
    expect(r.stocks.find((s) => s.barcode === "111")?.raw).toEqual(stock)
    expect(r.stocks.find((s) => s.barcode === "222")?.raw).toBeNull()
  })

  it("skippedNoWbBarcode всегда пуст — у WB штрихкод свой собственный", () => {
    const r = mapFbsStocks([fbsStock({ sku: "999" })], [{ barcode: "111", vendorCode: "v" }])
    expect(r.skippedNoWbBarcode).toEqual([])
  })
})

describe("mapFbsOrders на фикстуре, снятой с площадки", () => {
  // Фикстура — три строки настоящего ответа /api/v3/orders от 01.09.2026,
  // а не выдумка по спецификации. Разница принципиальна: спецификация
  // называет поле цены `salePrice`, в действительности его нет вовсе,
  // и пока маппер читал его, КАЖДЫЙ заказ записывался с нулевой ценой.
  // Тесты на выдуманной фикстуре этого не ловили и поймать не могли —
  // они проверяли согласованность маппера со спекой, а не с площадкой.
  const rows = fixture as unknown as WbFbsOrder[]

  it("цена не нулевая ни у одной строки", () => {
    const mapped = mapFbsOrders(rows)
    expect(mapped).toHaveLength(3)
    for (const order of mapped) {
      expect(order.priceMinor).toBeGreaterThan(0)
    }
  })

  it("цена совпадает с полем price сырой строки, копейка в копейку", () => {
    const mapped = mapFbsOrders(rows)
    expect(mapped.map((o) => o.priceMinor)).toEqual(rows.map((r) => r.price))
  })

  it("баркод, артикул и время заказа разобраны", () => {
    const [first] = mapFbsOrders(rows)
    expect(first?.barcode).toBe(rows[0]?.skus?.[0])
    expect(first?.externalSku).toBe(rows[0]?.article)
    expect(first?.occurredAt).toBe(rows[0]?.createdAt)
  })

  it("без статусов все три строки получают lifecycle: open", () => {
    const mapped = mapFbsOrders(rows)
    expect(mapped.map((o) => o.lifecycle)).toEqual(["open", "open", "open"])
  })
})
