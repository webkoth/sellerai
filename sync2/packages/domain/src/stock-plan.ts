import type { Channel, NormalizedStock } from "@sync2/shared"
import type { PoolItemState } from "./pool"
import { aggregateStockByBarcode } from "./stock"

/**
 * Предохранитель: столько РАЗНЫХ баркодов с изменением остатка за прогон —
 * уже не норма, а сбой чтения (порог старого синка). Считаем баркоды, а не
 * строки изменений: один и тот же restock на 4 площадках — это один баркод,
 * а не четыре (иначе обычная реалистичная поставка 30 SKU на 4 площадки
 * упёрлась бы в порог 120 без всякого сбоя).
 */
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
  /** Артикул площадки (offer_id/vendorCode) — нужен writer'ам Ozon/YM, которые пишут по нему, а не по баркоду. */
  externalSku: string | null
}

export interface StockPlan {
  changes: StockChange[]
  /** Не null — разных баркодов с изменением больше порога, писать нельзя ничего. */
  aborted: { count: number; max: number } | null
}

/**
 * Что писать на каждую площадку, чтобы её остаток сошёлся с пулом.
 * Площадка, которую синк не пишет (WB при чужой записи), сюда просто не
 * передаётся. Товар, которого на площадке нет, не пишется — карточки
 * заводит этап карточек. Сравнение — после суммирования складов площадки.
 *
 * `opts.hold` — баркоды площадки, которые в этом прогоне писать нельзя (для
 * WB в режиме self — баркоды, чей сигнал ещё не принят: писать по неполному
 * представлению о факте на WB — рискованно). Удержанный баркод не даёт
 * изменения, даже если он сирота.
 *
 * Результат отсортирован по площадке, затем по баркоду — детерминированный
 * порядок для логов и тестов, план не зависит от порядка снимков на входе.
 */
export function planStockWrites(
  items: PoolItemState[],
  snapshots: ChannelStockSnapshot[],
  opts: { maxChanges: number; hold?: ReadonlyMap<Channel, ReadonlySet<string>> },
): StockPlan {
  const base = new Map(items.map((i) => [i.barcode, Math.max(0, i.base)]))
  const changes: StockChange[] = []
  for (const snap of snapshots) {
    const held = opts.hold?.get(snap.channel)
    for (const [barcode, { quantity, vendorCode }] of aggregateStockByBarcode(snap.stocks)) {
      if (held?.has(barcode)) continue
      const target = base.get(barcode)
      if (target === undefined) {
        if (quantity > 0) changes.push({ channel: snap.channel, barcode, before: quantity, after: 0, orphan: true, externalSku: vendorCode })
        continue
      }
      if (quantity !== target) {
        changes.push({ channel: snap.channel, barcode, before: quantity, after: target, orphan: false, externalSku: vendorCode })
      }
    }
  }
  changes.sort((a, b) => (a.channel === b.channel ? a.barcode.localeCompare(b.barcode) : a.channel.localeCompare(b.channel)))

  const distinctBarcodes = new Set(changes.map((c) => c.barcode)).size
  if (distinctBarcodes > opts.maxChanges) return { changes: [], aborted: { count: distinctBarcodes, max: opts.maxChanges } }
  return { changes, aborted: null }
}
