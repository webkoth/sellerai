import type { Channel, ChannelOrder, NormalizedStock } from "@sync2/shared"

export interface StockFetch {
  stocks: NormalizedStock[]
  /** Товары площадки, для которых не нашёлся штрихкод WB, — в снимок не попадают. */
  skippedNoWbBarcode: string[]
}

/** Чтение площадки. Запись — только через executeWrites, не здесь. */
export interface ChannelAdapter {
  readonly channel: Channel
  /** Заказы, созданные не раньше `since` (ISO 8601), — окно, а не курсор. */
  fetchOrders(since: string): Promise<ChannelOrder[]>
  fetchStocks(): Promise<StockFetch>
}
