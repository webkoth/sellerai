import { describe, expect, it } from "vitest"
import { comparePools, formatComparison } from "./compare-v1"

describe("comparePools", () => {
  it("совпадения, расхождения и товары только в одном пуле", () => {
    const r = comparePools(
      [
        { barcode: "A", base: 2 },
        { barcode: "B", base: 1 },
        { barcode: "C", base: 0 },
      ],
      { items: { A: { base: 2 }, B: { base: 3 }, D: { base: 1 } } },
    )
    expect(r).toEqual({
      same: 1,
      diff: [{ barcode: "B", v1: 3, v2: 1 }],
      onlyV1: [{ barcode: "D", v1: 1 }],
      onlyV2: [],
    })
  })
  it("нулевой товар, которого нет у старого синка, — не расхождение", () => {
    expect(comparePools([{ barcode: "C", base: 0 }], { items: {} }).onlyV2).toEqual([])
  })
})

describe("formatComparison", () => {
  it("короткая сводка для Telegram", () => {
    const text = formatComparison(
      { same: 80, diff: [{ barcode: "B", v1: 3, v2: 1 }], onlyV1: [], onlyV2: [] },
      { failedRuns: 0, planned: { wb: 0, ozon: 2, ym: 0, kit: 1, site: 0 } },
    )
    expect(text).toContain("совпадает 80 из 81")
    expect(text).toContain("B: старый 3, новый 1")
  })
})
