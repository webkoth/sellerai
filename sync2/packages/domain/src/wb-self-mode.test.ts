import { describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import type { PoolEvent, PoolItemState, PoolOrder } from "./pool"
import { reconcilePool } from "./pool"
import { planStockWrites, type StockChange } from "./stock-plan"
import { WB_SETTLE_MINUTES_SELF, applyWbWriteOutcomes, wbWriteGate } from "./wb-expectation"

/**
 * Многопрогонная симуляция режима «WB пишет sync2» без базы и сети: state —
 * пул, applied/cancelledApplied — журнал заказов между прогонами (как в
 * жизни хранится в базе), orders — сырые строки заказов зеркал (мутируются
 * при отмене, как upsert в хранилище). Тест сам ведёт `realWb` (что реально
 * стоит на WB) и `physical` (истинный остаток склада) — назначение сценариев
 * в том, чтобы `base` в конце каждого сошёлся с `physical`.
 */
class SelfModeHarness {
  items: PoolItemState[] = []
  private applied = new Set<number>()
  private cancelledApplied = new Set<number>()
  private orders = new Map<number, PoolOrder>()
  private nextOrderId = 1

  addOrder(barcode: string, channelId: number, quantity: number): number {
    const id = this.nextOrderId++
    this.orders.set(id, { orderId: id, channelId, barcode, quantity, cancelled: false, occurredAt: "н/д" })
    return id
  }

  cancelOrder(orderId: number): void {
    const order = this.orders.get(orderId)
    if (order) this.orders.set(orderId, { ...order, cancelled: true })
  }

  /** Один прогон: снимок WB → reconcilePool → шлюз WB → план записи WB → «отправка» → applyWbWriteOutcomes. */
  run(now: string, wbSnapshot: { takenAt: string; stocks: NormalizedStock[] }): { events: PoolEvent[]; changes: StockChange[] } {
    const prevItems = this.items
    const gate = wbWriteGate(prevItems, wbSnapshot, WB_SETTLE_MINUTES_SELF)

    const reconciled = reconcilePool({
      now,
      items: prevItems,
      wbSnapshot,
      orders: [...this.orders.values()],
      applied: this.applied,
      cancelledApplied: this.cancelledApplied,
      settleMinutes: WB_SETTLE_MINUTES_SELF,
    })
    for (const event of reconciled.events) {
      if (event.kind === "order" && event.orderId !== null) this.applied.add(event.orderId)
      if (event.kind === "cancel" && event.orderId !== null) this.cancelledApplied.add(event.orderId)
    }

    const plan = planStockWrites(reconciled.items, [{ channel: "wb", stocks: wbSnapshot.stocks }], {
      maxChanges: 120,
      hold: gate.hold,
    })

    const wbActual = new Map<string, number>()
    for (const s of wbSnapshot.stocks) wbActual.set(s.barcode, (wbActual.get(s.barcode) ?? 0) + s.quantity)

    // В этих сценариях любая запланированная запись на WB считается успешной —
    // отказы и таймауты уже разобраны юнит-тестами applyWbWriteOutcomes.
    const results = new Map(plan.changes.map((c) => [c.barcode, "applied" as const]))

    this.items = applyWbWriteOutcomes(reconciled.items, prevItems, gate.accepted, wbActual, results, now)

    return { events: reconciled.events, changes: plan.changes }
  }

  item(barcode: string): PoolItemState | undefined {
    return this.items.find((i) => i.barcode === barcode)
  }
}

const stock = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse: null })
const OZON = 2
const BARCODE = "A"

/** Применяет изменения плана к карте физического остатка WB — то, что реально было бы записано. */
function applyToRealWb(realWb: Map<string, number>, changes: StockChange[]): void {
  for (const c of changes) if (c.channel === "wb") realWb.set(c.barcode, c.after)
}

describe("режим self: полный цикл прогонов без гонок", () => {
  it("S2: заказ зеркала пишется на WB в этом же прогоне, later-продажа на WB ловится сигналом", () => {
    const h = new SelfModeHarness()
    h.items = [{ barcode: BARCODE, base: 10, wbExpected: 10, expectedAt: null, wbSnapshotAt: "2026-09-26T09:00:00.000Z" }]
    const realWb = new Map([[BARCODE, 10]])
    let physical = 10

    // Прогон 1: заказ Ozon на 1 шт, свежий снимок WB (ещё без нашей записи).
    h.addOrder(BARCODE, OZON, 1)
    const run1 = h.run("2026-09-26T10:00:00.000Z", { takenAt: "2026-09-26T09:55:00.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })
    applyToRealWb(realWb, run1.changes)
    physical -= 1 // заказ зарезервировал единицу

    expect(run1.changes).toEqual([{ channel: "wb", barcode: BARCODE, before: 10, after: 9, orphan: false, externalSku: null }])
    expect(h.item(BARCODE)).toMatchObject({ base: 9, wbExpected: 9 })
    expect(realWb.get(BARCODE)).toBe(9)

    // Между прогонами — настоящая продажа на самой WB.
    realWb.set(BARCODE, realWb.get(BARCODE)! - 1)
    physical -= 1

    // Прогон 2: снимок свежий и устоявшийся — сигнал WB принят, дельта поймана.
    const run2 = h.run("2026-09-26T10:04:00.000Z", { takenAt: "2026-09-26T10:03:30.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })

    expect(run2.changes).toEqual([]) // совпало с пулом — писать нечего
    expect(h.item(BARCODE)?.base).toBe(physical)
    expect(realWb.get(BARCODE)).toBe(h.item(BARCODE)?.base)
  })

  it("S3a: продажа на WB в неустоявшемся прогоне не затирается, ловится следующим свежим прогоном", () => {
    const h = new SelfModeHarness()
    h.items = [{ barcode: BARCODE, base: 10, wbExpected: 10, expectedAt: null, wbSnapshotAt: "2026-09-26T09:00:00.000Z" }]
    const realWb = new Map([[BARCODE, 10]])
    let physical = 10

    // Прогон 1: заказ Ozon на 1 шт, пишем на WB.
    h.addOrder(BARCODE, OZON, 1)
    const run1 = h.run("2026-09-26T10:00:00.000Z", { takenAt: "2026-09-26T09:55:00.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })
    applyToRealWb(realWb, run1.changes)
    physical -= 1
    expect(realWb.get(BARCODE)).toBe(9)

    // Сразу после — продажа на WB (физически realWb/physical падают на 1).
    realWb.set(BARCODE, realWb.get(BARCODE)! - 1)
    physical -= 1 // physical = 8

    // Прогон 2: снимок снят через 30с — до конца окна устаканивания (2 мин).
    // Он УЖЕ видит продажу (realWb=8), но сигнал принять нельзя.
    const run2 = h.run("2026-09-26T10:00:30.000Z", { takenAt: "2026-09-26T10:00:20.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })

    expect(run2.changes).toEqual([]) // held — ничего не пишем
    expect(h.item(BARCODE)).toMatchObject({ base: 9, wbExpected: 9 }) // прежнее ожидание сохранено, продажа не потеряна и не затёрта

    // Прогон 3: снимок свежий и спустя окно устаканивания — сигнал принят.
    const run3 = h.run("2026-09-26T10:03:00.000Z", { takenAt: "2026-09-26T10:02:30.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })
    applyToRealWb(realWb, run3.changes)

    expect(h.item(BARCODE)?.base).toBe(physical)
    expect(realWb.get(BARCODE)).toBe(h.item(BARCODE)?.base)
  })

  it("S3b: неустоявшийся прогон + новый заказ Ozon → следующий свежий прогон сводит base, physical и realWb", () => {
    const h = new SelfModeHarness()
    h.items = [{ barcode: BARCODE, base: 10, wbExpected: 10, expectedAt: null, wbSnapshotAt: "2026-09-26T09:00:00.000Z" }]
    const realWb = new Map([[BARCODE, 10]])
    let physical = 10

    // Прогон 1: заказ O1 (Ozon, 1 шт), пишем на WB.
    h.addOrder(BARCODE, OZON, 1)
    const run1 = h.run("2026-09-26T10:00:00.000Z", { takenAt: "2026-09-26T09:55:00.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })
    applyToRealWb(realWb, run1.changes)
    physical -= 1
    expect(realWb.get(BARCODE)).toBe(9)

    // Прогон 2 (неустоявшийся, +30с): второй заказ O2 (Ozon, 1 шт). WB снимок
    // не отражает никакой новой продажи на WB — просто окно ещё не истекло.
    h.addOrder(BARCODE, OZON, 1)
    const run2 = h.run("2026-09-26T10:00:30.000Z", { takenAt: "2026-09-26T10:00:20.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })
    physical -= 1 // physical = 8, заказ зарезервировал единицу независимо от WB

    expect(run2.changes).toEqual([]) // held — WB не пишем в этом прогоне
    expect(h.item(BARCODE)?.base).toBe(8) // база уже учла заказ
    expect(h.item(BARCODE)?.wbExpected).toBe(9) // но ожидание — прежнее (C1), а не форсированные 8
    expect(realWb.get(BARCODE)).toBe(9) // на WB пока по-прежнему 9 — запись отложена

    // Прогон 3 (свежий, спустя окно устаканивания): наконец пишем недостающую единицу.
    const run3 = h.run("2026-09-26T10:03:00.000Z", { takenAt: "2026-09-26T10:02:30.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })
    applyToRealWb(realWb, run3.changes)

    expect(h.item(BARCODE)?.base).toBe(physical)
    expect(realWb.get(BARCODE)).toBe(h.item(BARCODE)?.base)
  })

  it("S3c: переиспользованный снимок + отмена заказа → следующий свежий прогон сводит base и physical", () => {
    const h = new SelfModeHarness()
    h.items = [{ barcode: BARCODE, base: 5, wbExpected: 5, expectedAt: null, wbSnapshotAt: "2026-09-26T09:00:00.000Z" }]
    const realWb = new Map([[BARCODE, 5]])
    let physical = 5

    // Прогон 1: заказ O1 (Ozon, 2 шт), пишем на WB.
    const o1 = h.addOrder(BARCODE, OZON, 2)
    const snapshot1 = { takenAt: "2026-09-26T09:55:00.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] }
    const run1 = h.run("2026-09-26T10:00:00.000Z", snapshot1)
    applyToRealWb(realWb, run1.changes)
    physical -= 2 // physical = 3
    expect(realWb.get(BARCODE)).toBe(3)

    // Прогон 2: заказ O1 отменяется до отправки, но снимок WB ПЕРЕИСПОЛЬЗУЕТСЯ
    // (тот же takenAt, что и в прогоне 1, — например, повторный запуск после
    // сбоя без повторного чтения WB).
    h.cancelOrder(o1)
    physical += 2 // physical = 5, единица вернулась
    const run2 = h.run("2026-09-26T10:00:10.000Z", snapshot1)

    expect(run2.changes).toEqual([]) // held — переиспользованный снимок не новый, не пишем
    expect(h.item(BARCODE)?.base).toBe(5) // отмена учтена независимо от WB
    expect(h.item(BARCODE)?.wbExpected).toBe(3) // ожидание — прежнее (C1), не форсированные 5
    expect(realWb.get(BARCODE)).toBe(3) // WB пока не в курсе отмены

    // Прогон 3: свежий снимок, спустя окно устаканивания — пишем недостающие 2 шт.
    const run3 = h.run("2026-09-26T10:03:00.000Z", { takenAt: "2026-09-26T10:02:30.000Z", stocks: [stock(BARCODE, realWb.get(BARCODE)!)] })
    applyToRealWb(realWb, run3.changes)

    expect(h.item(BARCODE)?.base).toBe(physical)
    expect(realWb.get(BARCODE)).toBe(h.item(BARCODE)?.base)
  })
})
