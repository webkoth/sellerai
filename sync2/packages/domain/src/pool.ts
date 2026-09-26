import type { NormalizedStock } from "@sync2/shared"
import { aggregateStockByBarcode } from "./stock"

// Перенесено из finstock/packages/domain/src/pool.ts (26.09.2026) с заменой cabinetId → channelId.
// Поведение не менять без правки тестов pool.test.ts — это перенос, а не переписывание.

/** Закрытый список видов событий пула — тот же, что ограничение в базе. */
export type PoolEventKind = "order" | "cancel" | "wb_signal" | "cold_start" | "manual"

/** Состояние пула на один баркод. Времена — ISO 8601. */
export interface PoolItemState {
  barcode: string
  /** Физический остаток по нашему счёту. */
  base: number
  /** Каким мы ожидаем увидеть остаток WB после того, как его выставит sai (позже — мы). */
  wbExpected: number
  /** Когда ожидание последний раз менялось заказом или отменой; null — ни разу. */
  expectedAt: string | null
  /** Момент последнего снимка WB, чья дельта принята; null — ни одного. */
  wbSnapshotAt: string | null
}

/** Заказ зеркала так, как его видит пул. Строки без баркода сюда не попадают. */
export interface PoolOrder {
  /** `orders_raw.id` */
  orderId: number
  channelId: number
  barcode: string
  quantity: number
  cancelled: boolean
  occurredAt: string
}

export interface PoolEvent {
  barcode: string
  kind: PoolEventKind
  delta: number
  baseBefore: number
  baseAfter: number
  /** Площадка заказа (channels.id); у сигнала WB и холодного старта null. */
  channelId: number | null
  /** `orders_raw.id`; обязателен у order и cancel. */
  orderId: number | null
  /**
   * Момент снимка WB (`takenAt`), породившего событие; обязателен у wb_signal
   * и cold_start, null у остальных. Вместе с баркодом и видом — ключ
   * уникальности в базе (`pool_events_snapshot_kind_idx`).
   */
  snapshotAt: string | null
  occurredAt: string
  detail: Record<string, unknown> | null
}

export interface ReconcilePoolInput {
  /** Момент прогона, ISO. Параметр, а не часы: функция чистая. */
  now: string
  items: PoolItemState[]
  /** Последний снимок площадки-мастера. */
  wbSnapshot: { takenAt: string; stocks: NormalizedStock[] }
  /** Заказы зеркал (не мастера) с баркодом. */
  orders: PoolOrder[]
  /** Заказы, у которых уже есть событие order. */
  applied: ReadonlySet<number>
  /** Заказы, у которых уже есть событие cancel. */
  cancelledApplied: ReadonlySet<number>
  settleMinutes: number
}

export interface ReconcilePoolResult {
  /** Состояние всех баркодов после прогона — и изменённых, и нет. */
  items: PoolItemState[]
  events: PoolEvent[]
  skipped: {
    /** Заказы по баркодам, которых нет ни в состоянии, ни у WB: базы нет. */
    noBase: number
  }
}

/**
 * Пока WB выставляет `sai`, снимок WB отражает наш заказ зеркала только после
 * его пуша — до 15 минут. Дельта из снимка, снятого раньше, прочиталась бы
 * как ложное пополнение, а через полчаса как ложная продажа. Когда писать
 * на площадки начнём мы сами, правило снимается.
 */
export const WB_SETTLE_MINUTES = 20

/**
 * Один прогон пула по модели `sai` (`sync/src/inventory.ts`), на каждый баркод
 * в этом порядке:
 *
 * 1. Холодный старт: баркода нет в состоянии, но есть у WB — база равна
 *    снимку, все неотменённые заказы зеркал считаются учтёнными БЕЗ вычитания
 *    (sai уже снял их с WB; вычесть второй раз — занизить базу).
 * 2. Сигнал WB: новый снимок, снятый не раньше чем через `settleMinutes`
 *    после последнего изменения ожидания, — дельта между снимком и
 *    ожиданием (продажа на WB, пополнение, ручная правка).
 * 3. Новые заказы зеркал — минус количество, один раз на заказ.
 * 4. Отмены учтённых заказов — плюс количество, один раз на заказ.
 * 5. База не ниже нуля; ожидание равно базе.
 *
 * Заказы WB отдельно не вычитаются — они уже в дельте WB (иначе двойной учёт).
 */
export function reconcilePool(input: ReconcilePoolInput): ReconcilePoolResult {
  const { now, wbSnapshot, settleMinutes } = input
  const wbQuantity = new Map<string, number>()
  for (const [barcode, { quantity }] of aggregateStockByBarcode(wbSnapshot.stocks)) {
    wbQuantity.set(barcode, quantity)
  }

  const ordersByBarcode = new Map<string, PoolOrder[]>()
  for (const order of input.orders) {
    const list = ordersByBarcode.get(order.barcode) ?? []
    list.push(order)
    ordersByBarcode.set(order.barcode, list)
  }

  const state = new Map<string, PoolItemState>()
  for (const item of input.items) state.set(item.barcode, { ...item })

  const events: PoolEvent[] = []
  const appliedNow = new Set<number>()
  const cancelledNow = new Set<number>()
  const coldStarted = new Set<string>()
  const snapshotAt = Date.parse(wbSnapshot.takenAt)
  const settleMs = settleMinutes * 60_000

  // 1. Холодный старт
  for (const [barcode, quantity] of wbQuantity) {
    if (state.has(barcode)) continue
    state.set(barcode, {
      barcode,
      base: quantity,
      wbExpected: quantity,
      expectedAt: null,
      wbSnapshotAt: wbSnapshot.takenAt,
    })
    coldStarted.add(barcode)
    events.push({
      barcode,
      kind: "cold_start",
      delta: quantity,
      baseBefore: 0,
      baseAfter: quantity,
      channelId: null,
      orderId: null,
      snapshotAt: wbSnapshot.takenAt,
      occurredAt: now,
      detail: null,
    })
    for (const order of ordersByBarcode.get(barcode) ?? []) {
      if (order.cancelled || input.applied.has(order.orderId)) continue
      appliedNow.add(order.orderId)
      events.push({
        barcode,
        kind: "order",
        delta: 0,
        baseBefore: quantity,
        baseAfter: quantity,
        channelId: order.channelId,
        orderId: order.orderId,
        snapshotAt: null,
        occurredAt: now,
        detail: { coldStart: true },
      })
    }
  }

  let noBase = 0
  for (const [barcode, list] of ordersByBarcode) {
    if (!state.has(barcode)) noBase += list.length
  }

  for (const item of state.values()) {
    // 2. Сигнал WB
    if (!coldStarted.has(item.barcode)) {
      const isNewSnapshot = item.wbSnapshotAt === null || Date.parse(item.wbSnapshotAt) < snapshotAt
      const settled = item.expectedAt === null || snapshotAt >= Date.parse(item.expectedAt) + settleMs
      if (isNewSnapshot && settled) {
        const actual = wbQuantity.get(item.barcode) ?? 0
        const delta = actual - item.wbExpected
        if (delta !== 0) {
          const baseBefore = item.base
          item.base += delta
          events.push({
            barcode: item.barcode,
            kind: "wb_signal",
            delta,
            baseBefore,
            baseAfter: item.base,
            channelId: null,
            orderId: null,
            snapshotAt: wbSnapshot.takenAt,
            occurredAt: now,
            detail: { wbActual: actual, wbExpected: item.wbExpected },
          })
        }
        item.wbSnapshotAt = wbSnapshot.takenAt
      }
    }

    // 3–4. Заказы и отмены зеркал
    let expectationChanged = false
    for (const order of ordersByBarcode.get(item.barcode) ?? []) {
      const isApplied = input.applied.has(order.orderId) || appliedNow.has(order.orderId)
      if (!order.cancelled && !isApplied) {
        const baseBefore = item.base
        item.base = Math.max(0, item.base - order.quantity)
        appliedNow.add(order.orderId)
        expectationChanged = true
        events.push({
          barcode: item.barcode,
          kind: "order",
          delta: -order.quantity,
          baseBefore,
          baseAfter: item.base,
          channelId: order.channelId,
          orderId: order.orderId,
          snapshotAt: null,
          occurredAt: now,
          detail: null,
        })
        continue
      }
      const isCancelled = input.cancelledApplied.has(order.orderId) || cancelledNow.has(order.orderId)
      if (order.cancelled && isApplied && !isCancelled) {
        const baseBefore = item.base
        item.base += order.quantity
        cancelledNow.add(order.orderId)
        expectationChanged = true
        events.push({
          barcode: item.barcode,
          kind: "cancel",
          delta: order.quantity,
          baseBefore,
          baseAfter: item.base,
          channelId: order.channelId,
          orderId: order.orderId,
          snapshotAt: null,
          occurredAt: now,
          detail: null,
        })
      }
    }

    // 5. Инварианты
    item.base = Math.max(0, item.base)
    item.wbExpected = item.base
    if (expectationChanged) item.expectedAt = now
  }

  return { items: [...state.values()], events, skipped: { noBase } }
}
