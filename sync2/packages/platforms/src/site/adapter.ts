import type { WbCatalogIndex } from "@sync2/shared"
import type { ChannelAdapter, StockFetch } from "../adapter"
import { fetchSiteOrders, fetchSiteStocks, type SiteCredentials, type SiteStockSource } from "./client"
import { mapSiteOrders, mapSiteStocks } from "./mapper"

export type SiteConfig = SiteCredentials

/** Снимок сайта плюс источник его остатка: `wb` в 1.3c, `pool` — после 1.4. */
export interface SiteStockFetch extends StockFetch {
  source: SiteStockSource
}

export interface SiteAdapter extends ChannelAdapter {
  fetchStocks(): Promise<SiteStockFetch>
}

/**
 * Адаптер сайта — пятой площадки (этап 1.3c). Только чтение; запись —
 * `putSiteStocks` (client.ts), подключается к executeWrites на этапе 1.4.
 */
export function createSiteAdapter(config: SiteConfig, wbIndex: WbCatalogIndex): SiteAdapter {
  return {
    channel: "site",
    async fetchOrders(since) {
      return mapSiteOrders(await fetchSiteOrders(config, since), since, wbIndex)
    },
    async fetchStocks() {
      const r = await fetchSiteStocks(config)
      return { ...mapSiteStocks(r.items, wbIndex), source: r.source }
    },
  }
}
