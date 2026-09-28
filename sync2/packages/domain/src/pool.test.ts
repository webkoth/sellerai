import { describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import {
  reconcilePool,
  WB_SETTLE_MINUTES,
  type PoolItemState,
  type PoolOrder,
  type ReconcilePoolInput,
} from "./pool"

const NOW = "2026-09-04T12:00:00.000Z"
const OZON = 27
const YM = 28

function wb(barcode: string, quantity: number): NormalizedStock {
  return { barcode, externalSku: `art-${barcode}`, quantity, warehouse: null }
}

function order(patch: Partial<PoolOrder> = {}): PoolOrder {
  return {
    orderId: 1,
    channelId: OZON,
    barcode: "111",
    quantity: 1,
    cancelled: false,
    occurredAt: "2026-09-04T11:00:00.000Z",
    ...patch,
  }
}

function item(patch: Partial<PoolItemState> = {}): PoolItemState {
  return {
    barcode: "111",
    base: 3,
    wbExpected: 3,
    expectedAt: null,
    wbSnapshotAt: "2026-09-04T11:00:00.000Z",
    ...patch,
  }
}

function input(patch: Partial<ReconcilePoolInput> = {}): ReconcilePoolInput {
  return {
    now: NOW,
    items: [],
    // Снимок по умолчанию — тот, что item() уже принял (тот же takenAt):
    // тесты заказов и отмен не должны получать побочный сигнал WB. Первая
    // редакция плана ставила здесь 11:30, и пустой снимок читался как
    // «товар пропал с WB» — семь тестов падали на верной реализации.
    wbSnapshot: { takenAt: "2026-09-04T11:00:00.000Z", stocks: [] },
    orders: [],
    applied: new Set(),
    cancelledApplied: new Set(),
    settleMinutes: WB_SETTLE_MINUTES,
    ...patch,
  }
}

describe("reconcilePool — холодный старт", () => {
  it("база равна снимку WB, событие cold_start, ожидание равно базе", () => {
    const result = reconcilePool(input({ wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 2)] } }))
    expect(result.items).toEqual([
      { barcode: "111", base: 2, wbExpected: 2, expectedAt: null, wbSnapshotAt: "2026-09-04T11:30:00.000Z" },
    ])
    expect(result.events).toEqual([
      { barcode: "111", kind: "cold_start", delta: 2, baseBefore: 0, baseAfter: 2, channelId: null, orderId: null, snapshotAt: "2026-09-04T11:30:00.000Z", occurredAt: NOW, detail: null },
    ])
  })

  it("открытые заказы зеркал при холодном старте считаются учтёнными без вычитания", () => {
    // sai уже снял их с WB: вычесть второй раз — занизить базу.
    const result = reconcilePool(
      input({
        wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 2)] },
        orders: [order({ orderId: 10 }), order({ orderId: 11, channelId: YM })],
      }),
    )
    expect(result.items[0]?.base).toBe(2)
    const orderEvents = result.events.filter((e) => e.kind === "order")
    expect(orderEvents.map((e) => e.orderId)).toEqual([10, 11])
    expect(orderEvents.every((e) => e.delta === 0 && e.detail?.coldStart === true)).toBe(true)
  })

  it("отменённый заказ при холодном старте не помечается учтённым", () => {
    const result = reconcilePool(
      input({
        wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 2)] },
        orders: [order({ orderId: 10, cancelled: true })],
      }),
    )
    expect(result.events.filter((e) => e.kind === "order")).toEqual([])
    expect(result.events.filter((e) => e.kind === "cancel")).toEqual([])
  })

  it("заказ по баркоду, которого нет ни в состоянии, ни у WB, — пропуск и счётчик", () => {
    const result = reconcilePool(input({ orders: [order({ barcode: "999" })] }))
    expect(result.items).toEqual([])
    expect(result.events).toEqual([])
    expect(result.skipped.noBase).toBe(1)
  })
})

describe("reconcilePool — заказы и отмены", () => {
  it("новый заказ на Ozon вычитается один раз и двигает ожидание", () => {
    const result = reconcilePool(input({ items: [item()], orders: [order({ orderId: 10 })] }))
    expect(result.items[0]).toMatchObject({ base: 2, wbExpected: 2, expectedAt: NOW })
    expect(result.events).toEqual([
      { barcode: "111", kind: "order", delta: -1, baseBefore: 3, baseAfter: 2, channelId: OZON, orderId: 10, snapshotAt: null, occurredAt: NOW, detail: null },
    ])
  })

  it("уже учтённый заказ не вычитается второй раз", () => {
    const result = reconcilePool(input({ items: [item()], orders: [order({ orderId: 10 })], applied: new Set([10]) }))
    expect(result.items[0]?.base).toBe(3)
    expect(result.events).toEqual([])
  })

  it("заказы на Ozon и ЯМ по одному баркоду вычитаются оба", () => {
    const result = reconcilePool(
      input({ items: [item()], orders: [order({ orderId: 10, quantity: 1 }), order({ orderId: 11, channelId: YM, quantity: 2 })] }),
    )
    expect(result.items[0]?.base).toBe(0)
    expect(result.events.map((e) => e.delta)).toEqual([-1, -2])
  })

  it("отмена учтённого заказа возвращает единицу", () => {
    const result = reconcilePool(
      input({ items: [item({ base: 2, wbExpected: 2 })], orders: [order({ orderId: 10, cancelled: true })], applied: new Set([10]) }),
    )
    expect(result.items[0]).toMatchObject({ base: 3, wbExpected: 3, expectedAt: NOW })
    expect(result.events).toEqual([
      { barcode: "111", kind: "cancel", delta: 1, baseBefore: 2, baseAfter: 3, channelId: OZON, orderId: 10, snapshotAt: null, occurredAt: NOW, detail: null },
    ])
  })

  it("отмена неучтённого заказа ничего не меняет", () => {
    const result = reconcilePool(input({ items: [item()], orders: [order({ orderId: 10, cancelled: true })] }))
    expect(result.items[0]?.base).toBe(3)
    expect(result.events).toEqual([])
  })

  it("отмена, уже записанная, не возвращается второй раз", () => {
    const result = reconcilePool(
      input({
        items: [item()],
        orders: [order({ orderId: 10, cancelled: true })],
        applied: new Set([10]),
        cancelledApplied: new Set([10]),
      }),
    )
    expect(result.events).toEqual([])
  })

  it("новый заказ и отмена прежнего по одному баркоду в одном прогоне идут цепочкой", () => {
    // Добавлен по ревью качества: ловит вынос baseBefore из цикла заказов —
    // тогда оба события получили бы baseBefore 3.
    const result = reconcilePool(
      input({
        items: [item()],
        orders: [order({ orderId: 20, quantity: 1 }), order({ orderId: 21, cancelled: true })],
        applied: new Set([21]),
      }),
    )
    expect(result.events).toEqual([
      { barcode: "111", kind: "order", delta: -1, baseBefore: 3, baseAfter: 2, channelId: OZON, orderId: 20, snapshotAt: null, occurredAt: NOW, detail: null },
      { barcode: "111", kind: "cancel", delta: 1, baseBefore: 2, baseAfter: 3, channelId: OZON, orderId: 21, snapshotAt: null, occurredAt: NOW, detail: null },
    ])
    expect(result.items[0]).toMatchObject({ base: 3, wbExpected: 3, expectedAt: NOW })
  })

  it("база не уходит ниже нуля", () => {
    const result = reconcilePool(input({ items: [item({ base: 1, wbExpected: 1 })], orders: [order({ orderId: 10, quantity: 3 })] }))
    expect(result.items[0]?.base).toBe(0)
    expect(result.events[0]).toMatchObject({ delta: -3, baseBefore: 1, baseAfter: 0 })
  })
})

describe("reconcilePool — сигнал WB", () => {
  it("продажа на WB: дельта минус, база уменьшается, ожидание следует за базой", () => {
    const result = reconcilePool(
      input({ items: [item()], wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 2)] } }),
    )
    expect(result.items[0]).toMatchObject({ base: 2, wbExpected: 2, wbSnapshotAt: "2026-09-04T11:30:00.000Z", expectedAt: null })
    expect(result.events).toEqual([
      { barcode: "111", kind: "wb_signal", delta: -1, baseBefore: 3, baseAfter: 2, channelId: null, orderId: null, snapshotAt: "2026-09-04T11:30:00.000Z", occurredAt: NOW, detail: { wbActual: 2, wbExpected: 3 } },
    ])
  })

  it("пополнение на WB: дельта плюс", () => {
    const result = reconcilePool(
      input({ items: [item()], wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 5)] } }),
    )
    expect(result.items[0]?.base).toBe(5)
    expect(result.events[0]).toMatchObject({ kind: "wb_signal", delta: 2 })
  })

  it("снимок совпадает с ожиданием — события нет, момент снимка принят", () => {
    const result = reconcilePool(
      input({ items: [item()], wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 3)] } }),
    )
    expect(result.events).toEqual([])
    expect(result.items[0]?.wbSnapshotAt).toBe("2026-09-04T11:30:00.000Z")
  })

  it("снимок в окне 20 минут после заказа не принимается: sai ещё не выставил WB", () => {
    const result = reconcilePool(
      input({
        items: [item({ base: 2, wbExpected: 2, expectedAt: "2026-09-04T11:20:00.000Z" })],
        wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 3)] },
      }),
    )
    expect(result.events).toEqual([])
    expect(result.items[0]).toMatchObject({ base: 2, wbSnapshotAt: "2026-09-04T11:00:00.000Z" })
  })

  it("снимок через 20 минут после заказа принимается", () => {
    const result = reconcilePool(
      input({
        items: [item({ base: 2, wbExpected: 2, expectedAt: "2026-09-04T11:10:00.000Z" })],
        wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 2)] },
      }),
    )
    expect(result.events).toEqual([])
    expect(result.items[0]?.wbSnapshotAt).toBe("2026-09-04T11:30:00.000Z")
  })

  it("тот же снимок второй раз не принимается", () => {
    const result = reconcilePool(
      input({
        items: [item({ base: 2, wbExpected: 2, wbSnapshotAt: "2026-09-04T11:30:00.000Z" })],
        wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 3)] },
      }),
    )
    expect(result.events).toEqual([])
    expect(result.items[0]?.base).toBe(2)
  })

  it("товар пропал из снимка WB — считается нулём", () => {
    const result = reconcilePool(
      input({ items: [item()], wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [] } }),
    )
    expect(result.items[0]?.base).toBe(0)
    expect(result.events[0]).toMatchObject({ kind: "wb_signal", delta: -3 })
  })

  it("сигнал WB применяется раньше заказов того же прогона", () => {
    const result = reconcilePool(
      input({
        items: [item()],
        wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 2)] },
        orders: [order({ orderId: 10 })],
      }),
    )
    expect(result.events.map((e) => e.kind)).toEqual(["wb_signal", "order"])
    expect(result.items[0]).toMatchObject({ base: 1, wbExpected: 1, expectedAt: NOW })
  })

  it("несколько складов WB по одному баркоду складываются", () => {
    const result = reconcilePool(
      input({
        items: [item()],
        wbSnapshot: { takenAt: "2026-09-04T11:30:00.000Z", stocks: [wb("111", 1), { ...wb("111", 2), warehouse: "B" }] },
      }),
    )
    expect(result.events).toEqual([])
    expect(result.items[0]?.base).toBe(3)
  })
})

describe("reconcilePool — холодный старт по площадке (этап 1.3c)", () => {
  it("заказ базового прогона новой площадки — учтён без вычитания: delta 0, coldStart channel, ожидание не трогается", () => {
    const r = reconcilePool(input({ items: [item()], orders: [order({ quantity: 2, channelColdStart: true })] }))
    expect(r.items).toEqual([item()])
    expect(r.events).toEqual([
      {
        barcode: "111",
        kind: "order",
        delta: 0,
        baseBefore: 3,
        baseAfter: 3,
        channelId: OZON,
        orderId: 1,
        snapshotAt: null,
        occurredAt: NOW,
        detail: { coldStart: "channel" },
      },
    ])
  })

  it("уже учтённый заказ базового прогона — ни события, ни изменения", () => {
    const r = reconcilePool(input({ items: [item()], orders: [order({ channelColdStart: true })], applied: new Set([1]) }))
    expect(r.events).toEqual([])
    expect(r.items).toEqual([item()])
  })

  it("отменённый до отправки заказ базового прогона не учитывается вовсе — и отмена его не вернёт", () => {
    const r = reconcilePool(input({ items: [item()], orders: [order({ cancelled: true, channelColdStart: true })] }))
    expect(r.events).toEqual([])
    expect(r.items).toEqual([item()])
  })

  it("отмена учтённого холодным стартом заказа возвращает единицу, как у общего холодного старта", () => {
    const r = reconcilePool(input({ items: [item()], orders: [order({ cancelled: true, channelColdStart: true })], applied: new Set([1]) }))
    expect(r.events.map((e) => [e.kind, e.delta])).toEqual([["cancel", 1]])
    expect(r.items[0]?.base).toBe(4)
  })

  it("обычный заказ рядом — списывается как прежде", () => {
    const r = reconcilePool(
      input({ items: [item()], orders: [order({ channelColdStart: true }), order({ orderId: 2, channelId: YM, quantity: 1 })] }),
    )
    expect(r.events.map((e) => [e.orderId, e.delta])).toEqual([
      [1, 0],
      [2, -1],
    ])
    expect(r.items[0]?.base).toBe(2)
  })
})
