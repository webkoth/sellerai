import { describe, expect, it } from "vitest"
import { planStockWrites, type PoolItemState } from "@sync2/domain"
import { mapYmStocks } from "@sync2/platforms"
import { buildWbCatalogIndex } from "@sync2/shared"
import { channelDrift } from "./drift"

// Живой случай 29.09: ЯМ, оффер 38259864653534 (штрихкод 2049405532066), склад 2369574 — FIT 1, FREEZE 1,
// AVAILABLE нет; единица под заказом 62411188290 в доставке. Свободно 0 — план и drift должны видеть 0.
const OFFER = "38259864653534"
const BARCODE = "2049405532066"
const WAREHOUSE = 2369574
const wbIndex = buildWbCatalogIndex([{ barcode: BARCODE, vendorCode: OFFER, nmId: null, title: "", subject: null }])
const snapshot = (fit: number, freeze: number) =>
  mapYmStocks(
    [{ warehouseId: WAREHOUSE, offers: [{ offerId: OFFER, stocks: [{ type: "FIT", count: fit }, { type: "FREEZE", count: freeze }] }] }],
    new Map([[OFFER, [BARCODE]]]),
    wbIndex,
    [WAREHOUSE],
  ).stocks
const item = (base: number): PoolItemState => ({ barcode: BARCODE, base, wbExpected: base, expectedAt: null, wbSnapshotAt: null })

describe("ЯМ: резерв FREEZE не считается остатком площадки", () => {
  it("FIT 1, FREEZE 1, пул 0 — доступно 0, плана нет", () => {
    const plan = planStockWrites([item(0)], [{ channel: "ym", stocks: snapshot(1, 1) }], { maxChanges: 120 })
    expect(plan).toEqual({ changes: [], aborted: null })
  })

  it("FIT 3, FREEZE 1, пул 3 — план 2 → 3: пишется цель пула, count = свободный остаток без резерва", () => {
    const plan = planStockWrites([item(3)], [{ channel: "ym", stocks: snapshot(3, 1) }], { maxChanges: 120 })
    expect(plan.changes).toEqual([{ channel: "ym", barcode: BARCODE, before: 2, after: 3, orphan: false, externalSku: OFFER }])
  })

  it("drift ЯМ — по доступному: FIT 1, FREEZE 1 при пуле 0 не расхождение", () => {
    const d = channelDrift("ym", "2026-09-29T10:00:00.000Z", new Map([[BARCODE, 0]]), snapshot(1, 1), new Set())
    expect(d).toMatchObject({ compared: 1, mismatches: [] })
  })
})
