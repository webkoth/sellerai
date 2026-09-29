import { describe, expect, it } from "vitest"
import type { NormalizedStock, WbCatalogEntry } from "@sync2/shared"
import { checkCatalog } from "./ingest"

const entry = (barcode: string): WbCatalogEntry => ({ barcode, vendorCode: barcode, nmId: null, title: "", subject: null })
const stock = (barcode: string, quantity: number, warehouse = "1"): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse })

describe("checkCatalog", () => {
  it("остаток суммируется по складам: 0 на одном и 1 на другом — штрихкод в наличии", () => {
    const v = checkCatalog({ catalog: [entry("A")], previousAccepted: 2, lastWbStocks: [stock("B", 0, "1"), stock("B", 1, "2")] })
    expect(v.missingInStock).toEqual(["B"])
  })

  it("снимка WB нет — судит только доля", () => {
    expect(checkCatalog({ catalog: [entry("A")], previousAccepted: 1, lastWbStocks: null }).reasons).toEqual([])
  })

  it("текст перечисляет первые 10 пропавших, остальные — числом; доля в той же строке причин", () => {
    const lost = Array.from({ length: 12 }, (_, i) => `L${String(i).padStart(2, "0")}`)
    const v = checkCatalog({ catalog: [entry("A")], previousAccepted: 13, lastWbStocks: lost.map((b) => stock(b, 1)) })
    expect(v.missingInStock).toHaveLength(12)
    expect(v.reasons[0]).toMatch(/12 шт\.: L00, .*L09 и ещё 2$/)
    expect(v.reasons[1]).toMatch(/каталог WB 1 при прошлом принятом 13/)
  })
})
