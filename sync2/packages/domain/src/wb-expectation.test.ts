import { describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import type { PoolItemState } from "./pool"
import { reconcilePool, WB_SETTLE_MINUTES } from "./pool"
import { WB_SETTLE_MINUTES_SELF, acceptedWbBarcodes, applyWbWriteOutcomes, wbSignalAccepted, wbWriteGate } from "./wb-expectation"

const item = (barcode: string, patch: Partial<PoolItemState> = {}): PoolItemState => ({
  barcode,
  base: 1,
  wbExpected: 1,
  expectedAt: null,
  wbSnapshotAt: null,
  ...patch,
})

const stock = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse: null })

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

  it("согласуется с reconcilePool: принятые баркоды — ровно те, чей wbSnapshotAt после прогона стал новым снимком", () => {
    const prevItems: PoolItemState[] = [
      item("ACCEPTED", { wbSnapshotAt: "2026-09-26T09:00:00.000Z", expectedAt: null }),
      item("UNSETTLED", { wbSnapshotAt: "2026-09-26T09:00:00.000Z", expectedAt: "2026-09-26T09:59:00.000Z" }),
    ]
    const wbSnapshot = {
      takenAt: "2026-09-26T10:00:00.000Z",
      stocks: [stock("ACCEPTED", 5), stock("UNSETTLED", 5), stock("COLD", 3)],
    }
    const settleMinutes = 2

    const reconciled = reconcilePool({
      now: "2026-09-26T10:00:30.000Z",
      items: prevItems,
      wbSnapshot,
      orders: [],
      applied: new Set(),
      cancelledApplied: new Set(),
      settleMinutes,
    })
    const acceptedByReconcile = new Set(reconciled.items.filter((i) => i.wbSnapshotAt === wbSnapshot.takenAt).map((i) => i.barcode))

    const accepted = acceptedWbBarcodes(
      prevItems,
      wbSnapshot.stocks.map((s) => s.barcode),
      wbSnapshot.takenAt,
      settleMinutes,
    )
    expect(accepted).toEqual(acceptedByReconcile)
    expect(accepted).toEqual(new Set(["ACCEPTED", "COLD"]))
  })
})

describe("wbWriteGate", () => {
  it("возвращает принятые баркоды и держит на площадке wb непринятые", () => {
    const prevItems = [
      item("ACCEPTED", { wbSnapshotAt: "2026-09-26T09:00:00.000Z", expectedAt: null }),
      item("UNSETTLED", { wbSnapshotAt: "2026-09-26T09:00:00.000Z", expectedAt: "2026-09-26T09:59:00.000Z" }),
    ]
    const wbSnapshot = {
      takenAt: "2026-09-26T10:00:00.000Z",
      stocks: [stock("ACCEPTED", 5), stock("UNSETTLED", 5), stock("COLD", 3)],
    }

    const gate = wbWriteGate(prevItems, wbSnapshot, 2)

    expect(gate.accepted).toEqual(new Set(["ACCEPTED", "COLD"]))
    expect(gate.hold.get("wb")).toEqual(new Set(["UNSETTLED"]))
  })
})

describe("applyWbWriteOutcomes", () => {
  const now = "2026-09-26T10:10:00.000Z"

  it("баркод не принят — состояние reconcile не трогаем: следующий свежий снимок сам разберётся", () => {
    const post = item("A", { base: 1, wbExpected: 1, expectedAt: "2026-09-26T10:05:00.000Z", wbSnapshotAt: "2026-09-26T10:00:00.000Z" })
    const [a] = applyWbWriteOutcomes([post], [], new Set(), new Map([["A", 9]]), new Map(), now)
    expect(a).toEqual(post)
  })

  it("C1: баркод не принят, а reconcile уже форсировал wbExpected по новой базе — возвращаем ПРЕЖНЕЕ ожидание, момент правки из reconcile сохраняем", () => {
    const prev = item("A", { base: 4, wbExpected: 4, expectedAt: "2026-09-26T09:50:00.000Z", wbSnapshotAt: "2026-09-26T09:00:00.000Z" })
    // В этом прогоне пришёл заказ зеркала и списал единицу: reconcilePool
    // форсирует wbExpected = 3, хотя на WB это не писали (баркод held).
    const post = item("A", { base: 3, wbExpected: 3, expectedAt: "2026-09-26T10:05:00.000Z", wbSnapshotAt: "2026-09-26T09:00:00.000Z" })
    const [a] = applyWbWriteOutcomes([post], [prev], new Set(), new Map([["A", 4]]), new Map(), now)
    expect(a?.wbExpected).toBe(4) // прежнее ожидание, а не форсированная база
    expect(a?.expectedAt).toBe("2026-09-26T10:05:00.000Z") // момент из reconcile не трогаем
    expect(a?.base).toBe(3) // база — не поле этой функции
  })

  it("нет предыдущего состояния (холодный старт) и баркод не принят — берём базу после reconcile", () => {
    const post = item("A", { base: 5 })
    const [a] = applyWbWriteOutcomes([post], [], new Set(), new Map(), new Map(), now)
    expect(a?.wbExpected).toBe(5)
  })

  it("M2: итог записи по непринятому баркоду — шлюз обойдён, это ошибка кода, а не данных", () => {
    const post = item("A", { base: 3 })
    expect(() => applyWbWriteOutcomes([post], [post], new Set(), new Map(), new Map([["A", "applied"]]), now)).toThrow(
      /запись WB по неподтверждённому баркоду: A/,
    )
  })

  it("запись применилась — ожидание равно базе, момент — сейчас: окно устаканивания должно накрыть задержку распространения на самом WB", () => {
    const post = item("A", { base: 2 })
    const [a] = applyWbWriteOutcomes([post], [], new Set(["A"]), new Map([["A", 5]]), new Map([["A", "applied"]]), now)
    expect(a?.wbExpected).toBe(2)
    expect(a?.expectedAt).toBe(now)
  })

  it("итог неизвестен (таймаут), факт на WB больше базы — берём факт: не создавать фантомный остаток", () => {
    const post = item("A", { base: 2 })
    const [a] = applyWbWriteOutcomes([post], [], new Set(["A"]), new Map([["A", 5]]), new Map([["A", "unknown"]]), now)
    expect(a?.wbExpected).toBe(5)
    expect(a?.expectedAt).toBe(now)
  })

  it("итог неизвестен, факт на WB меньше базы — берём базу: потеря здесь не восстановится сама и нужна ручная правка, но это всё равно безопаснее фантомной продажи", () => {
    const post = item("A", { base: 5 })
    const [a] = applyWbWriteOutcomes([post], [], new Set(["A"]), new Map([["A", 2]]), new Map([["A", "unknown"]]), now)
    expect(a?.wbExpected).toBe(5)
    expect(a?.expectedAt).toBe(now)
  })

  it("запись не применилась — ожидание равно факту, момент ожидания не двигаем", () => {
    const post = item("A", { base: 2, expectedAt: "2026-09-26T09:00:00.000Z" })
    const [a] = applyWbWriteOutcomes([post], [], new Set(["A"]), new Map([["A", 7]]), new Map([["A", "failed"]]), now)
    expect(a?.wbExpected).toBe(7)
    expect(a?.expectedAt).toBe("2026-09-26T09:00:00.000Z")
  })

  it("итог отсутствует (запись не отправлялась) — как отказ: ожидание равно факту", () => {
    const post = item("A", { base: 2, expectedAt: "2026-09-26T09:00:00.000Z" })
    const [a] = applyWbWriteOutcomes([post], [], new Set(["A"]), new Map([["A", 7]]), new Map(), now)
    expect(a?.wbExpected).toBe(7)
    expect(a?.expectedAt).toBe("2026-09-26T09:00:00.000Z")
  })

  it("баркода нет в снимке WB — факт считается нулём", () => {
    const post = item("A", { base: 2 })
    const [a] = applyWbWriteOutcomes([post], [], new Set(["A"]), new Map(), new Map(), now)
    expect(a?.wbExpected).toBe(0)
  })

  it("вход не мутируется", () => {
    const post = item("A", { base: 2 })
    const input = [post]
    applyWbWriteOutcomes(input, [], new Set(["A"]), new Map([["A", 9]]), new Map([["A", "applied"]]), now)
    expect(input[0]?.wbExpected).toBe(1)
  })
})

describe("WB_SETTLE_MINUTES_SELF", () => {
  it("задержка приёма сигнала в режиме self короче, чем при чужой записи", () => {
    expect(WB_SETTLE_MINUTES_SELF).toBeLessThan(WB_SETTLE_MINUTES)
  })
})

describe("applyWbWriteOutcomes — отрицательный остаток в снимке", () => {
  it("ожидание WB не ниже нуля: иначе база отклонит сохранение, и пул встанет навсегда", () => {
    const post = { barcode: "A", base: 0, wbExpected: 0, expectedAt: null, wbSnapshotAt: "2026-09-26T10:00:00.000Z" }
    const [a] = applyWbWriteOutcomes([post], [], new Set(["A"]), new Map([["A", -1]]), new Map(), "2026-09-26T10:05:00.000Z")
    expect(a?.wbExpected).toBe(0)
  })
})
