import { describe, expect, it } from "vitest"
import ordersFixture from "./fixtures/orders-sample.json" with { type: "json" }
import variantsFixture from "./fixtures/variants-sample.json" with { type: "json" }
import type { KitOrder, KitVariant } from "./client"
import { mapKitOrders, mapKitStocks } from "./mapper"

const WAREHOUSE_ID = "01980d4c-1b53-7aa1-ab23-1b7c23604704"
const variants = variantsFixture.variants as KitVariant[]
const orders = ordersFixture.orders as unknown as KitOrder[]

describe("mapKitStocks", () => {
  it("живой снимок: строка на каждый вариант со штрихкодом, склад продаж — по warehouseId", () => {
    const result = mapKitStocks(variants, WAREHOUSE_ID)

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

  it("штрихкода нет — вариант в skippedNoWbBarcode, строки не создаётся", () => {
    const result = mapKitStocks(
      [{ id: "no-barcode", barcode: null, stocks: [{ quantity: 5, warehouse_id: WAREHOUSE_ID }] } as KitVariant],
      WAREHOUSE_ID,
    )
    expect(result).toEqual({ stocks: [], skippedNoWbBarcode: ["no-barcode"] })
  })

  it("сумма остатка — только по своему складу, чужой склад не считается", () => {
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
    )
    expect(result.stocks).toEqual([expect.objectContaining({ barcode: "460000000001", quantity: 3 })])
  })

  it("остаток не ниже нуля", () => {
    const result = mapKitStocks(
      [{ id: "v1", barcode: "460000000001", stocks: [{ quantity: -4, warehouse_id: WAREHOUSE_ID }] } as KitVariant],
      WAREHOUSE_ID,
    )
    expect(result.stocks[0]?.quantity).toBe(0)
  })
})

describe("mapKitOrders", () => {
  it("живые заказы: 2 отменённых тестовых → 2 строки cancelled_before_ship со штрихкодом варианта", () => {
    const result = mapKitOrders(orders, variants, "2020-01-01T00:00:00.000Z")

    expect(result).toHaveLength(2)
    for (const row of result) {
      expect(row.barcode).toBe("2041383032873")
      expect(row.lifecycle).toBe("cancelled_before_ship")
      expect(row.quantity).toBe(1)
    }
  })

  it("externalId — «заказ:позиция», occurredAt — ISO, priceMinor — из final_price рублями", () => {
    const [row] = mapKitOrders(orders, variants, "2020-01-01T00:00:00.000Z")
    expect(row?.externalId).toBe("01a0b01b-a80a-71a8-82d7-ce1f4040111b:01a0b01b-a859-7f3e-9c70-b2fd667c0fbc")
    expect(row?.occurredAt).toBe(new Date("2026-09-17T19:03:17.639891+03:00").toISOString())
    expect(row?.priceMinor).toBe(24000)
  })

  it("raw не несёт client — снимок для разбора споров без персональных данных", () => {
    const orderWithClient: KitOrder = {
      id: "o1",
      status: "NEW",
      created_at: "2026-09-20T00:00:00.000Z",
      client: { first_name: "Тест", phone: "+79990000000" },
      delivery_chunks: [{ items: [{ id: "i1", product_variant_id: "v1", quantity: 1, final_price: "100" }] }],
    }
    const [row] = mapKitOrders([orderWithClient], [{ id: "v1", barcode: "460000000001", stocks: [] } as KitVariant], "2020-01-01T00:00:00.000Z")
    expect(row?.raw).not.toHaveProperty("client")
    expect(JSON.stringify(row?.raw)).not.toContain("+79990000000")
  })

  it("заказ раньше since — отбрасывается", () => {
    const result = mapKitOrders(orders, variants, "2026-09-20T00:00:00.000Z")
    expect(result).toHaveLength(0)
  })

  it("вариант позиции не нашёлся — barcode null, строка всё равно создаётся", () => {
    const order: KitOrder = {
      id: "o2",
      status: "NEW",
      created_at: "2026-09-20T00:00:00.000Z",
      delivery_chunks: [{ items: [{ id: "i1", product_variant_id: "нет-такого", quantity: 2, final_price: "50" }] }],
    }
    const [row] = mapKitOrders([order], variants, "2020-01-01T00:00:00.000Z")
    expect(row).toMatchObject({ barcode: null, externalSku: "нет-такого", quantity: 2, lifecycle: "open" })
  })
})
