import { describe, expect, it } from "vitest"
import { firstBarcode } from "./barcodes"

describe("firstBarcode", () => {
  it("берёт первый штрихкод из списка каталога", () => {
    const map = new Map([["A", ["111", "222"]]])
    expect(firstBarcode(map, "A")).toBe("111")
  })

  it("пропускает пустые строки и берёт первый непустой", () => {
    const map = new Map([["A", ["", "  ", "333"]]])
    expect(firstBarcode(map, "A")).toBe("333")
  })

  it("null, если артикула нет в каталоге или штрихкодов нет", () => {
    const map = new Map([["A", [] as string[]]])
    expect(firstBarcode(map, "A")).toBeNull()
    expect(firstBarcode(map, "B")).toBeNull()
  })
})
