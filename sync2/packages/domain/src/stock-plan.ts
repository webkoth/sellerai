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

/**
 * Отдельный, более строгий предохранитель именно для обнуления: столько
 * РАЗНЫХ баркодов уходит в 0 (сироты считаются тоже) — уже подозрение на
 * частичный снимок площадки-мастера, а не реальный уход товара со склада.
 * Частичный снимок WB (сеть моргнула, отдал половину каталога) иначе
 * превращается в массовое обнуление на каждом зеркале — это и есть отказ,
 * который здесь ловится. Порог того же порядка, что MAX_TO_ZERO в старом
 * скрипте KIT. Первому запуску с законной массой сирот (пока не всё
 * заведено в WB) нужен свой, более высокий предел — вызывающий код передаёт
 * его явно через `opts.maxToZero`.
 */
export const MAX_STOCK_TO_ZERO_PER_RUN = 20

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
  /** Не null — сработал один из предохранителей (см. `reason`), писать нельзя ничего. */
  aborted: { reason: "changes" | "to_zero"; count: number; max: number } | null
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
 * Два предохранителя проверяются независимо: сначала по всем изменениям
 * (`opts.maxChanges`), потом отдельно по обнулениям (`opts.maxToZero`,
 * умалчивается `MAX_STOCK_TO_ZERO_PER_RUN`). Любой сработавший — план пуст.
 *
 * Результат отсортирован по площадке, затем по баркоду — детерминированный
 * порядок для логов и тестов, план не зависит от порядка снимков на входе.
 */
export function planStockWrites(
  items: PoolItemState[],
  snapshots: ChannelStockSnapshot[],
  opts: { maxChanges: number; maxToZero?: number; hold?: ReadonlyMap<Channel, ReadonlySet<string>> },
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
  // Сравнение простыми `<`/`>`, а не localeCompare: детерминированный порядок
  // по кодовым точкам, без зависимости от локали окружения, где выполняется код.
  changes.sort((a, b) => {
    if (a.channel !== b.channel) return a.channel < b.channel ? -1 : 1
    if (a.barcode !== b.barcode) return a.barcode < b.barcode ? -1 : 1
    return 0
  })

  const distinctBarcodes = new Set(changes.map((c) => c.barcode)).size
  if (distinctBarcodes > opts.maxChanges) return { changes: [], aborted: { reason: "changes", count: distinctBarcodes, max: opts.maxChanges } }

  const maxToZero = opts.maxToZero ?? MAX_STOCK_TO_ZERO_PER_RUN
  const toZeroBarcodes = new Set(changes.filter((c) => c.before > 0 && c.after === 0).map((c) => c.barcode))
  if (toZeroBarcodes.size > maxToZero) return { changes: [], aborted: { reason: "to_zero", count: toZeroBarcodes.size, max: maxToZero } }

  return { changes, aborted: null }
}
