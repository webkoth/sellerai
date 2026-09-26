import { describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import { aggregateStockByBarcode } from "./stock"

const row = (barcode: string, quantity: number, patch: Partial<NormalizedStock> = {}): NormalizedStock => ({
  barcode,
  externalSku: null,
  quantity,
  warehouse: null,
  ...patch,
})

describe("aggregateStockByBarcode", () => {
  it("складывает строки одного баркода с разных складов", () => {
    const m = aggregateStockByBarcode([row("A", 1, { warehouse: "Краснодар" }), row("A", 2, { warehouse: "Москва" })])
    expect(m.get("A")?.quantity).toBe(3)
  })

  it("артикул — из первой строки, где он есть", () => {
    const m = aggregateStockByBarcode([row("A", 1), row("A", 1, { externalSku: "JW-0001" }), row("A", 1, { externalSku: "JW-XXXX" })])
    expect(m.get("A")?.vendorCode).toBe("JW-0001")
  })

  it("ноль и минус не отбрасываются — это решает вызывающий код", () => {
    const m = aggregateStockByBarcode([row("A", 0), row("B", -1)])
    expect(m.get("A")?.quantity).toBe(0)
    expect(m.get("B")?.quantity).toBe(-1)
  })

  it("пустой снимок — пустой результат", () => {
    expect(aggregateStockByBarcode([]).size).toBe(0)
  })
})
