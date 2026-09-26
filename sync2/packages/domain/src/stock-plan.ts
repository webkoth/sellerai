import type { Channel, NormalizedStock } from "@sync2/shared"
import type { PoolItemState } from "./pool"
import { aggregateStockByBarcode } from "./stock"

/** Предохранитель: столько изменений остатков за прогон — уже не норма, а сбой чтения (порог старого синка). */
export const MAX_STOCK_CHANGES_PER_RUN = 120

export interface ChannelStockSnapshot {
  channel: Channel
  stocks: NormalizedStock[]
}

export interface StockChange {
  channel: Channel
  barcode: string
  before: number
  after: number
  /** На площадке есть, в пуле нет: обнуляем, иначе площадка продаёт то, чего нет на складе. */
  orphan: boolean
}

export interface StockPlan {
  changes: StockChange[]
  /** Не null — изменений больше порога, писать нельзя ничего. */
  aborted: { count: number; max: number } | null
}

/**
 * Что писать на каждую площадку, чтобы её остаток сошёлся с пулом.
 * Площадка, которую синк не пишет (WB при чужой записи), сюда просто не
 * передаётся. Товар, которого на площадке нет, не пишется — карточки
 * заводит этап карточек. Сравнение — после суммирования складов площадки.
 */
export function planStockWrites(
  items: PoolItemState[],
  snapshots: ChannelStockSnapshot[],
  opts: { maxChanges: number },
): StockPlan {
  const base = new Map(items.map((i) => [i.barcode, Math.max(0, i.base)]))
  const changes: StockChange[] = []
  for (const snap of snapshots) {
    for (const [barcode, { quantity }] of aggregateStockByBarcode(snap.stocks)) {
      const target = base.get(barcode)
      if (target === undefined) {
        if (quantity > 0) changes.push({ channel: snap.channel, barcode, before: quantity, after: 0, orphan: true })
        continue
      }
      if (quantity !== target) changes.push({ channel: snap.channel, barcode, before: quantity, after: target, orphan: false })
    }
  }
  if (changes.length > opts.maxChanges) return { changes: [], aborted: { count: changes.length, max: opts.maxChanges } }
  return { changes, aborted: null }
}
