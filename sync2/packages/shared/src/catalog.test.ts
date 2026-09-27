import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex, resolveWbBarcode } from "./catalog"

const index = buildWbCatalogIndex([
  { barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: 259678801, title: "Браслет", subject: "Браслеты" },
  { barcode: "2044473196868", vendorCode: "8797686554332", nmId: 1, title: "Подвеска", subject: "Подвески бижутерные" },
])

describe("resolveWbBarcode", () => {
  it("штрихкод площадки есть в каталоге WB — он и есть ключ", () => {
    expect(resolveWbBarcode(index, { barcodes: ["2041383032873"], sku: "что-угодно" })).toBe("2041383032873")
  })
  it("из нескольких штрихкодов площадки берётся тот, что есть у WB", () => {
    expect(resolveWbBarcode(index, { barcodes: ["460000000001", "2044473196868"], sku: null })).toBe("2044473196868")
  })
  it("штрихкода WB нет — сопоставление по артикулу (offer_id = артикул WB)", () => {
    expect(resolveWbBarcode(index, { barcodes: ["460000000001"], sku: "JW-NB-AGT-M-0002" })).toBe("2041383032873")
  })
  it("артикул равен штрихкоду WB — тоже годится", () => {
    expect(resolveWbBarcode(index, { barcodes: [], sku: "2044473196868" })).toBe("2044473196868")
  })
  it("ничего не сопоставилось — null, а не чужой штрихкод", () => {
    expect(resolveWbBarcode(index, { barcodes: ["460000000001"], sku: "НЕТ" })).toBeNull()
  })
})
