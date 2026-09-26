import { describe, expect, it } from "vitest"
import type { PoolItemState } from "./pool"
import { WB_SETTLE_MINUTES } from "./pool"
import { WB_SETTLE_MINUTES_SELF, acceptedWbBarcodes, applyWbWriteOutcomes, wbSignalAccepted } from "./wb-expectation"

const item = (barcode: string, patch: Partial<PoolItemState> = {}): PoolItemState => ({
  barcode,
  base: 1,
  wbExpected: 1,
  expectedAt: null,
  wbSnapshotAt: null,
  ...patch,
})

describe("wbSignalAccepted", () => {
  it("нет состояния — холодный старт, сигнал принят", () => {
    expect(wbSignalAccepted(undefined, "2026-09-26T10:00:00.000Z", 2)).toBe(true)
  })

  it("снимок совпадает с уже принятым — не новый, не принят", () => {
    const prev = item("A", { wbSnapshotAt: "2026-09-26T10:00:00.000Z" })
    expect(wbSignalAccepted(prev, "2026-09-26T10:00:00.000Z", 2)).toBe(false)
  })

  it("снимок новый, но окно устаканивания после последней правки ожидания не прошло", () => {
    const prev = item("A", { wbSnapshotAt: "2026-09-26T09:55:00.000Z", expectedAt: "2026-09-26T10:01:00.000Z" })
    expect(wbSignalAccepted(prev, "2026-09-26T10:02:00.000Z", 2)).toBe(false)
  })

  it("снимок новый и окно устаканивания прошло — принят", () => {
    const prev = item("A", { wbSnapshotAt: "2026-09-26T09:55:00.000Z", expectedAt: "2026-09-26T10:01:00.000Z" })
    expect(wbSignalAccepted(prev, "2026-09-26T10:03:00.000Z", 2)).toBe(true)
  })
})

describe("acceptedWbBarcodes", () => {
  it("объединяет баркоды состояния до прогона и снимка", () => {
    const prev = [item("A", { wbSnapshotAt: "2026-09-26T09:00:00.000Z" })]
    const accepted = acceptedWbBarcodes(prev, ["B"], "2026-09-26T10:00:00.000Z", 2)
    expect(accepted).toEqual(new Set(["A", "B"]))
  })

  it("отложенная продажа на WB не затирается нашей записью", () => {
    // Ожидание сдвинули в 10:01 (наш заказ/отмена), снимок пришёл в 10:02 — до
    // конца окна устаканивания (10:03). Продажа, случившаяся на WB в эти
    // минуты, ещё не считается сигналом: писать по ней сейчас — затереть её.
    const prev = [
      item("A", { base: 4, wbExpected: 4, expectedAt: "2026-09-26T10:01:00.000Z", wbSnapshotAt: "2026-09-26T09:55:00.000Z" }),
    ]
    const accepted = acceptedWbBarcodes(prev, ["A"], "2026-09-26T10:02:00.000Z", 2)
    expect(accepted.has("A")).toBe(false)
  })
})

describe("applyWbWriteOutcomes", () => {
  const now = "2026-09-26T10:10:00.000Z"

  it("баркод не принят в этом прогоне — состояние reconcile не трогаем: следующий свежий снимок сам разберётся", () => {
    const post = item("A", { base: 1, wbExpected: 1, expectedAt: "2026-09-26T10:05:00.000Z", wbSnapshotAt: "2026-09-26T10:00:00.000Z" })
    const [a] = applyWbWriteOutcomes([post], new Set(), new Map([["A", 9]]), new Map([["A", "applied"]]), now)
    expect(a).toEqual(post)
  })

  it("запись применилась — ожидание равно базе, момент — сейчас: окно устаканивания должно накрыть задержку распространения на самом WB", () => {
    const post = item("A", { base: 2 })
    const [a] = applyWbWriteOutcomes([post], new Set(["A"]), new Map([["A", 5]]), new Map([["A", "applied"]]), now)
    expect(a?.wbExpected).toBe(2)
    expect(a?.expectedAt).toBe(now)
  })

  it("итог неизвестен (таймаут), факт на WB больше базы — берём факт: не создавать фантомный остаток", () => {
    const post = item("A", { base: 2 })
    const [a] = applyWbWriteOutcomes([post], new Set(["A"]), new Map([["A", 5]]), new Map([["A", "unknown"]]), now)
    expect(a?.wbExpected).toBe(5)
    expect(a?.expectedAt).toBe(now)
  })

  it("итог неизвестен, факт на WB меньше базы — берём базу: хуже — ложное списание, не фантомная продажа", () => {
    const post = item("A", { base: 5 })
    const [a] = applyWbWriteOutcomes([post], new Set(["A"]), new Map([["A", 2]]), new Map([["A", "unknown"]]), now)
    expect(a?.wbExpected).toBe(5)
    expect(a?.expectedAt).toBe(now)
  })

  it("запись не применилась — ожидание равно факту, момент ожидания не двигаем (устаканивание уже отсчитывается с прежней правки)", () => {
    const post = item("A", { base: 2, expectedAt: "2026-09-26T09:00:00.000Z" })
    const [a] = applyWbWriteOutcomes([post], new Set(["A"]), new Map([["A", 7]]), new Map([["A", "failed"]]), now)
    expect(a?.wbExpected).toBe(7)
    expect(a?.expectedAt).toBe("2026-09-26T09:00:00.000Z")
  })

  it("итог отсутствует (запись не отправлялась) — как отказ: ожидание равно факту", () => {
    const post = item("A", { base: 2, expectedAt: "2026-09-26T09:00:00.000Z" })
    const [a] = applyWbWriteOutcomes([post], new Set(["A"]), new Map([["A", 7]]), new Map(), now)
    expect(a?.wbExpected).toBe(7)
    expect(a?.expectedAt).toBe("2026-09-26T09:00:00.000Z")
  })

  it("баркода нет в снимке WB — факт считается нулём", () => {
    const post = item("A", { base: 2 })
    const [a] = applyWbWriteOutcomes([post], new Set(["A"]), new Map(), new Map(), now)
    expect(a?.wbExpected).toBe(0)
  })

  it("вход не мутируется", () => {
    const post = item("A", { base: 2 })
    const input = [post]
    applyWbWriteOutcomes(input, new Set(["A"]), new Map([["A", 9]]), new Map([["A", "applied"]]), now)
    expect(input[0]?.wbExpected).toBe(1)
  })
})

describe("WB_SETTLE_MINUTES_SELF", () => {
  it("задержка приёма сигнала в режиме self короче, чем при чужой записи", () => {
    expect(WB_SETTLE_MINUTES_SELF).toBeLessThan(WB_SETTLE_MINUTES)
  })
})
