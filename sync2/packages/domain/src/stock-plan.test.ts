import { describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import type { PoolItemState } from "./pool"
import { MAX_STOCK_CHANGES_PER_RUN, planStockWrites } from "./stock-plan"

const item = (barcode: string, base: number): PoolItemState => ({
  barcode,
  base,
  wbExpected: base,
  expectedAt: null,
  wbSnapshotAt: null,
})
const s = (barcode: string, quantity: number, patch: Partial<NormalizedStock> = {}): NormalizedStock => ({
  barcode,
  externalSku: null,
  quantity,
  warehouse: null,
  ...patch,
})

describe("planStockWrites", () => {
  it("совпадает с пулом — писать нечего", () => {
    const r = planStockWrites([item("A", 2)], [{ channel: "kit", stocks: [s("A", 2)] }], { maxChanges: 120 })
    expect(r).toEqual({ changes: [], aborted: null })
  })

  it("расходится — запись было → станет", () => {
    const r = planStockWrites([item("A", 1)], [{ channel: "kit", stocks: [s("A", 2)] }], { maxChanges: 120 })
    expect(r.changes).toEqual([{ channel: "kit", barcode: "A", before: 2, after: 1, orphan: false, externalSku: null }])
  })

  it("товара на площадке нет — не пишем: карточки заводит другой этап", () => {
    const r = planStockWrites([item("A", 1)], [{ channel: "ozon", stocks: [] }], { maxChanges: 120 })
    expect(r.changes).toEqual([])
  })

  it("несколько складов площадки суммируются перед сравнением", () => {
    const r = planStockWrites(
      [item("A", 2)],
      [{ channel: "ozon", stocks: [s("A", 1), { ...s("A", 1), warehouse: "другой" }] }],
      { maxChanges: 120 },
    )
    expect(r.changes).toEqual([])
  })

  it("сирота: на площадке есть, в пуле нет — обнулить", () => {
    const r = planStockWrites([], [{ channel: "ym", stocks: [s("Z", 1)] }], { maxChanges: 120 })
    expect(r.changes).toEqual([{ channel: "ym", barcode: "Z", before: 1, after: 0, orphan: true, externalSku: null }])
  })

  it("сирота с нулём — писать нечего", () => {
    const r = planStockWrites([], [{ channel: "ym", stocks: [s("Z", 0)] }], { maxChanges: 120 })
    expect(r.changes).toEqual([])
  })

  it("отрицательная база пишется нулём", () => {
    const r = planStockWrites([item("A", -1)], [{ channel: "kit", stocks: [s("A", 1)] }], { maxChanges: 120 })
    expect(r.changes[0]?.after).toBe(0)
  })

  it("изменений больше порога — не писать ничего; счётчик — 3 РАЗНЫХ баркода", () => {
    const items = [item("A", 0), item("B", 0), item("C", 0)]
    const r = planStockWrites(items, [{ channel: "kit", stocks: [s("A", 1), s("B", 1), s("C", 1)] }], { maxChanges: 2 })
    expect(r.changes).toEqual([])
    expect(r.aborted).toEqual({ count: 3, max: 2 })
  })

  it("порог считает разные баркоды, а не строки изменений: один баркод на трёх площадках — не абort", () => {
    const r = planStockWrites(
      [item("A", 0)],
      [
        { channel: "kit", stocks: [s("A", 1)] },
        { channel: "ozon", stocks: [s("A", 1)] },
        { channel: "ym", stocks: [s("A", 1)] },
      ],
      { maxChanges: 2 },
    )
    expect(r.aborted).toBeNull()
    expect(r.changes).toHaveLength(3)
  })

  it("порог по умолчанию — 120, как в старом синке", () => {
    expect(MAX_STOCK_CHANGES_PER_RUN).toBe(120)
  })

  it("удержание пропускает баркод только на указанной площадке", () => {
    const r = planStockWrites(
      [item("A", 1)],
      [
        { channel: "kit", stocks: [s("A", 2)] },
        { channel: "ozon", stocks: [s("A", 2)] },
      ],
      { maxChanges: 120, hold: new Map([["kit", new Set(["A"])]]) },
    )
    expect(r.changes).toEqual([{ channel: "ozon", barcode: "A", before: 2, after: 1, orphan: false, externalSku: null }])
  })

  it("удержание распространяется и на сирот", () => {
    const r = planStockWrites([], [{ channel: "wb", stocks: [s("Z", 1)] }], {
      maxChanges: 120,
      hold: new Map([["wb", new Set(["Z"])]]),
    })
    expect(r.changes).toEqual([])
  })

  it("артикул площадки идёт в изменение — из первой строки снимка, где он есть", () => {
    const r = planStockWrites([item("A", 1)], [{ channel: "kit", stocks: [s("A", 2, { externalSku: "JW-0001" })] }], { maxChanges: 120 })
    expect(r.changes[0]?.externalSku).toBe("JW-0001")
  })

  it("артикул сироты — тоже из снимка", () => {
    const r = planStockWrites([], [{ channel: "ym", stocks: [s("Z", 1, { externalSku: "JW-Z" })] }], { maxChanges: 120 })
    expect(r.changes[0]?.externalSku).toBe("JW-Z")
  })

  it("результат отсортирован по площадке, затем по баркоду", () => {
    const r = planStockWrites(
      [item("B", 1), item("A", 1)],
      [
        { channel: "ozon", stocks: [s("B", 2)] },
        { channel: "kit", stocks: [s("B", 2), s("A", 2)] },
      ],
      { maxChanges: 120 },
    )
    expect(r.changes.map((c) => `${c.channel}:${c.barcode}`)).toEqual(["kit:A", "kit:B", "ozon:B"])
  })
})
