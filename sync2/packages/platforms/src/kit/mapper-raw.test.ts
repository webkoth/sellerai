import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import type { KitVariant } from "./client"
import { mapKitStocks } from "./mapper"

const WH = "01980d4c-1b53-7aa1-ab23-1b7c23604704"
const wbIndex = buildWbCatalogIndex([{ barcode: "2041383032873", vendorCode: "JW-0002", nmId: 1, title: "", subject: null }])

describe("mapKitStocks — raw снимка", () => {
  it("только id, штрихкод, артикул и записи своего склада: вариант целиком раздувал базу (185 МБ снимков KIT за сутки 27–28.09)", () => {
    const variant = {
      id: "v1",
      barcode: "2041383032873",
      sku: "JW-0002",
      stocks: [
        { quantity: 2, reserved: 1, warehouse_id: WH },
        { quantity: 9, warehouse_id: "other" },
      ],
      name: "Браслет",
      description: "длинный текст",
      images: ["https://example.invalid/1.jpg"],
    } as KitVariant
    expect(mapKitStocks([variant], WH, wbIndex).stocks[0]?.raw).toEqual({
      id: "v1",
      barcode: "2041383032873",
      sku: "JW-0002",
      stocks: [{ quantity: 2, reserved: 1, warehouse_id: WH }],
    })
  })
})
