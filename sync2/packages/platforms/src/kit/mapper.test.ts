import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex, type WbCatalogIndex } from "@sync2/shared"
import ordersFixture from "./fixtures/orders-sample.json" with { type: "json" }
import variantsFixture from "./fixtures/variants-sample.json" with { type: "json" }
import type { KitOrder, KitVariant } from "./client"
import { mapKitOrders, mapKitStocks } from "./mapper"

const WAREHOUSE_ID = "01980d4c-1b53-7aa1-ab23-1b7c23604704"
const variants = variantsFixture.variants as KitVariant[]
const orders = ordersFixture.orders as unknown as KitOrder[]

/** Каталог WB, в котором есть штрихкоды всех трёх вариантов фикстуры — счастливый путь. */
const wbIndex: WbCatalogIndex = buildWbCatalogIndex(
  variants.map((v) => ({ barcode: v.barcode as string, vendorCode: v.sku as string, nmId: null, title: "", subject: null })),
)

describe("mapKitStocks", () => {
  it("живой снимок: строка на каждый вариант со штрихкодом, сопоставленным по каталогу WB", () => {
    const result = mapKitStocks(variants, WAREHOUSE_ID, wbIndex)

    expect(result.skippedNoWbBarcode).toEqual([])
    expect(result.stocks).toHaveLength(3)
    expect(result.stocks.find((s) => s.barcode === "2041383032873")).toMatchObject({
      quantity: 2,
      externalSku: "01a05c9d-589e-7dfd-909d-cead74ed2bb1",
      warehouse: WAREHOUSE_ID,
    })
    // Вариант без записей остатка вовсе (пустой stocks[]) — строка с нулём,
    // а не пропуск: у него есть штрихкод, просто на складе продаж пусто.
    expect(result.stocks.find((s) => s.barcode === "2046353568161")).toMatchObject({ quantity: 0 })
  })

  it("штрихкод варианта не сопоставился с каталогом WB (ни сам штрихкод, ни sku) — вариант в skippedNoWbBarcode по sku, строки не создаётся", () => {
    const result = mapKitStocks(
      [{ id: "internal-id", barcode: "460000000001", sku: "НЕТ-В-WB", stocks: [{ quantity: 5, warehouse_id: WAREHOUSE_ID }] } as KitVariant],
      WAREHOUSE_ID,
      buildWbCatalogIndex([]),
    )
    expect(result).toEqual({ stocks: [], skippedNoWbBarcode: ["НЕТ-В-WB"] })
  })

  it("skippedNoWbBarcode — id варианта, если sku не задан", () => {
    const result = mapKitStocks(
      [{ id: "internal-id", barcode: null, stocks: [] } as KitVariant],
      WAREHOUSE_ID,
      buildWbCatalogIndex([]),
    )
    expect(result).toEqual({ stocks: [], skippedNoWbBarcode: ["internal-id"] })
  })

  it("штрихкода у варианта нет, но sku сопоставился с каталогом WB (offer_id = артикул WB) — строка создаётся", () => {
    const index = buildWbCatalogIndex([{ barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: null, title: "", subject: null }])
    const result = mapKitStocks(
      [{ id: "v1", barcode: null, sku: "JW-NB-AGT-M-0002", stocks: [{ quantity: 3, warehouse_id: WAREHOUSE_ID }] } as KitVariant],
      WAREHOUSE_ID,
      index,
    )
    expect(result.stocks).toEqual([expect.objectContaining({ barcode: "2041383032873", quantity: 3 })])
  })

  it("сумма остатка — только по своему складу, чужой склад не считается", () => {
    const index = buildWbCatalogIndex([{ barcode: "460000000001", vendorCode: "v1", nmId: null, title: "", subject: null }])
    const result = mapKitStocks(
      [
        {
          id: "v1",
          barcode: "460000000001",
          stocks: [
            { quantity: 3, warehouse_id: WAREHOUSE_ID },
            { quantity: 100, warehouse_id: "чужой-склад" },
          ],
        } as KitVariant,
      ],
      WAREHOUSE_ID,
      index,
    )
    expect(result.stocks).toEqual([expect.objectContaining({ barcode: "460000000001", quantity: 3 })])
  })

  it("остаток не ниже нуля", () => {
    const index = buildWbCatalogIndex([{ barcode: "460000000001", vendorCode: "v1", nmId: null, title: "", subject: null }])
    const result = mapKitStocks(
      [{ id: "v1", barcode: "460000000001", stocks: [{ quantity: -4, warehouse_id: WAREHOUSE_ID }] } as KitVariant],
      WAREHOUSE_ID,
      index,
    )
    expect(result.stocks[0]?.quantity).toBe(0)
  })
})

describe("mapKitOrders", () => {
  it("живые заказы: 2 отменённых тестовых → 2 строки cancelled_before_ship со штрихкодом варианта, сопоставленным по каталогу WB", () => {
    const result = mapKitOrders(orders, variants, "2020-01-01T00:00:00.000Z", wbIndex)

    expect(result).toHaveLength(2)
    for (const row of result) {
      expect(row.barcode).toBe("2041383032873")
      expect(row.lifecycle).toBe("cancelled_before_ship")
      expect(row.quantity).toBe(1)
    }
  })

  it("externalId — «заказ:позиция», occurredAt — ISO, priceMinor — из final_price рублями", () => {
    const [row] = mapKitOrders(orders, variants, "2020-01-01T00:00:00.000Z", wbIndex)
    expect(row?.externalId).toBe("01a0b01b-a80a-71a8-82d7-ce1f4040111b:01a0b01b-a859-7f3e-9c70-b2fd667c0fbc")
    expect(row?.occurredAt).toBe(new Date("2026-09-17T19:03:17.639891+03:00").toISOString())
    expect(row?.priceMinor).toBe(24000)
  })

  it("raw — allowlist полей заказа: без client, без адреса доставки, без прочих полей delivery_info", () => {
    const orderWithPii: KitOrder = {
      id: "o1",
      order_number: 12345,
      status: "NEW",
      created_at: "2026-09-20T00:00:00.000Z",
      client: { first_name: "Тест", phone: "+79990000000", email: "test@example.com" },
      delivery_chunks: [
        {
          id: 0,
          delivery_info: {
            method: "COURIER",
            raw_status: "NEW",
            warehouse_id: WAREHOUSE_ID,
            // @ts-expect-error — поле площадки, которого нет в типе KitDeliveryInfo (намеренно личное, для теста утечки).
            address: { address: "ул. Персональная, 1", locality: "Город" },
          },
          items: [{ id: "i1", product_variant_id: "v1", quantity: 1, final_price: "100" }],
        },
      ],
    }
    const index = buildWbCatalogIndex([{ barcode: "460000000001", vendorCode: "v1", nmId: null, title: "", subject: null }])
    const [row] = mapKitOrders(
      [orderWithPii],
      [{ id: "v1", barcode: "460000000001", stocks: [] } as KitVariant],
      "2020-01-01T00:00:00.000Z",
      index,
    )

    expect(row?.raw).toEqual({
      id: "o1",
      order_number: 12345,
      status: "NEW",
      created_at: "2026-09-20T00:00:00.000Z",
      item: { id: "i1", product_variant_id: "v1", quantity: 1, final_price: "100" },
      chunk: { id: 0, delivery_info: { method: "COURIER", raw_status: "NEW", warehouse_id: WAREHOUSE_ID } },
    })
    // Глубокая проверка по всей строке заказа, не только по raw: ни client,
    // ни адрес (ни ключ, ни значение), ни телефон/e-mail не должны
    // просочиться никаким путём.
    const serialized = JSON.stringify(row)
    expect(serialized).not.toContain("client")
    expect(serialized).not.toContain("address")
    expect(serialized).not.toContain("+79990000000")
    expect(serialized).not.toContain("Персональная")
    expect(serialized).not.toContain("test@example.com")
  })

  it("заказ раньше since — отбрасывается", () => {
    const result = mapKitOrders(orders, variants, "2026-09-20T00:00:00.000Z", wbIndex)
    expect(result).toHaveLength(0)
  })

  it("вариант позиции не нашёлся — barcode null, строка всё равно создаётся", () => {
    const order: KitOrder = {
      id: "o2",
      order_number: 1,
      status: "NEW",
      created_at: "2026-09-20T00:00:00.000Z",
      delivery_chunks: [
        {
          id: 0,
          delivery_info: { method: "COURIER", raw_status: "NEW", warehouse_id: WAREHOUSE_ID },
          items: [{ id: "i1", product_variant_id: "нет-такого", quantity: 2, final_price: "50" }],
        },
      ],
    }
    const [row] = mapKitOrders([order], variants, "2020-01-01T00:00:00.000Z", wbIndex)
    expect(row).toMatchObject({ barcode: null, externalSku: "нет-такого", quantity: 2, lifecycle: "open" })
  })

  it("штрихкод варианта позиции есть, но не сопоставился с каталогом WB — barcode null", () => {
    const order: KitOrder = {
      id: "o3",
      order_number: 1,
      status: "NEW",
      created_at: "2026-09-20T00:00:00.000Z",
      delivery_chunks: [
        {
          id: 0,
          delivery_info: { method: "COURIER", raw_status: "NEW", warehouse_id: WAREHOUSE_ID },
          items: [{ id: "i1", product_variant_id: "v1", quantity: 1, final_price: "50" }],
        },
      ],
    }
    const [row] = mapKitOrders(
      [order],
      [{ id: "v1", barcode: "460000000001", sku: "НЕ-В-WB", stocks: [] } as KitVariant],
      "2020-01-01T00:00:00.000Z",
      buildWbCatalogIndex([]),
    )
    expect(row?.barcode).toBeNull()
  })

  it("нечисловая final_price — priceMinor 0, строка не падает и не пропускается", () => {
    const order: KitOrder = {
      id: "o4",
      order_number: 1,
      status: "NEW",
      created_at: "2026-09-20T00:00:00.000Z",
      delivery_chunks: [
        {
          id: 0,
          delivery_info: { method: "COURIER", raw_status: "NEW", warehouse_id: WAREHOUSE_ID },
          items: [{ id: "i1", product_variant_id: "v1", quantity: 1, final_price: "не число" }],
        },
      ],
    }
    const index = buildWbCatalogIndex([{ barcode: "460000000001", vendorCode: "v1", nmId: null, title: "", subject: null }])
    const [row] = mapKitOrders(
      [order],
      [{ id: "v1", barcode: "460000000001", stocks: [] } as KitVariant],
      "2020-01-01T00:00:00.000Z",
      index,
    )
    expect(row?.priceMinor).toBe(0)
  })

  it("неразбираемая created_at — заказ пропускается целиком, остальные заказы читаются", () => {
    const badOrder: KitOrder = {
      id: "bad",
      order_number: 1,
      status: "NEW",
      created_at: "не дата вовсе",
      delivery_chunks: [
        {
          id: 0,
          delivery_info: { method: "COURIER", raw_status: "NEW", warehouse_id: WAREHOUSE_ID },
          items: [{ id: "i1", product_variant_id: "v1", quantity: 1, final_price: "10" }],
        },
      ],
    }
    const goodOrder: KitOrder = {
      id: "good",
      order_number: 2,
      status: "NEW",
      created_at: "2026-09-20T00:00:00.000Z",
      delivery_chunks: [
        {
          id: 0,
          delivery_info: { method: "COURIER", raw_status: "NEW", warehouse_id: WAREHOUSE_ID },
          items: [{ id: "i2", product_variant_id: "v1", quantity: 1, final_price: "10" }],
        },
      ],
    }
    const index = buildWbCatalogIndex([{ barcode: "460000000001", vendorCode: "v1", nmId: null, title: "", subject: null }])
    const result = mapKitOrders(
      [badOrder, goodOrder],
      [{ id: "v1", barcode: "460000000001", stocks: [] } as KitVariant],
      "2020-01-01T00:00:00.000Z",
      index,
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.externalId).toBe("good:i2")
  })
})
