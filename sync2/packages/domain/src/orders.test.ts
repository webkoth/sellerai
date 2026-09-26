import { describe, expect, it } from "vitest"
import { toPoolOrders, type OrderRowForPool } from "./orders"

const WB = 1
const OZON = 2
const KIT = 4

const row = (patch: Partial<OrderRowForPool>): OrderRowForPool => ({
  id: 10,
  channelId: OZON,
  barcode: "A",
  quantity: 1,
  lifecycle: "open",
  occurredAt: "2026-09-26T10:00:00.000Z",
  ...patch,
})

describe("toPoolOrders", () => {
  it("открытый и отправленный заказ зеркала — списание, не отмена", () => {
    const { orders } = toPoolOrders([row({ id: 1 }), row({ id: 2, lifecycle: "shipped", channelId: KIT })], WB)
    expect(orders).toEqual([
      { orderId: 1, channelId: OZON, barcode: "A", quantity: 1, cancelled: false, occurredAt: "2026-09-26T10:00:00.000Z" },
      { orderId: 2, channelId: KIT, barcode: "A", quantity: 1, cancelled: false, occurredAt: "2026-09-26T10:00:00.000Z" },
    ])
  })

  it("отмена до отправки — cancelled: единица вернётся в пул", () => {
    const { orders } = toPoolOrders([row({ lifecycle: "cancelled_before_ship" })], WB)
    expect(orders[0]?.cancelled).toBe(true)
  })

  it("возврат после доставки — НЕ отмена: товар в пути, вернёт его владелец через WB", () => {
    const { orders } = toPoolOrders([row({ lifecycle: "returned" })], WB)
    expect(orders[0]?.cancelled).toBe(false)
  })

  it("заказы WB в пул не идут — они уже в снимке WB", () => {
    const { orders, skipped } = toPoolOrders([row({ channelId: WB })], WB)
    expect(orders).toEqual([])
    expect(skipped.master).toBe(1)
  })

  it("строка без баркода пропускается и считается", () => {
    const { orders, skipped } = toPoolOrders([row({ barcode: null })], WB)
    expect(orders).toEqual([])
    expect(skipped.noBarcode).toBe(1)
  })
})
