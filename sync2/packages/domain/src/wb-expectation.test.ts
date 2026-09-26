import { describe, expect, it } from "vitest"
import type { PoolItemState } from "./pool"
import { WB_SETTLE_MINUTES } from "./pool"
import { WB_SETTLE_MINUTES_SELF, applyWbWriteOutcomes } from "./wb-expectation"

const item = (barcode: string, base: number): PoolItemState => ({
  barcode,
  base,
  wbExpected: base,
  expectedAt: "2026-09-26T10:00:00.000Z",
  wbSnapshotAt: "2026-09-26T09:55:00.000Z",
})

describe("applyWbWriteOutcomes", () => {
  it("запись на WB применилась — ожидание равно базе", () => {
    const [a] = applyWbWriteOutcomes([item("A", 1)], new Map([["A", 2]]), new Set(["A"]))
    expect(a?.wbExpected).toBe(1)
  })

  it("запись не применилась — ожидание равно тому, что реально стоит на WB", () => {
    // Иначе следующий снимок WB (всё ещё 2) прочитается как пополнение на +1.
    const [a] = applyWbWriteOutcomes([item("A", 1)], new Map([["A", 2]]), new Set())
    expect(a?.wbExpected).toBe(2)
  })

  it("баркода нет в снимке WB — на WB ноль", () => {
    const [a] = applyWbWriteOutcomes([item("A", 1)], new Map(), new Set())
    expect(a?.wbExpected).toBe(0)
  })

  it("база и прочие поля не меняются, вход не мутируется", () => {
    const input = [item("A", 1)]
    const [a] = applyWbWriteOutcomes(input, new Map([["A", 2]]), new Set())
    expect(a).toMatchObject({ barcode: "A", base: 1, expectedAt: "2026-09-26T10:00:00.000Z", wbSnapshotAt: "2026-09-26T09:55:00.000Z" })
    expect(input[0]?.wbExpected).toBe(1)
  })

  it("задержка приёма сигнала в режиме self короче, чем при чужой записи", () => {
    expect(WB_SETTLE_MINUTES_SELF).toBeLessThan(WB_SETTLE_MINUTES)
  })
})
