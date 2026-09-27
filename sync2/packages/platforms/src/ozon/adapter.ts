// Перенесено из finstock (27.09.2026): packages/platforms/src/ozon/adapter.ts,
// приведено к ChannelAdapter — финансовые методы (fetchRealization,
// fetchRealizationTotals, fetchTariffs) убраны вместе с их клиентами
// (finance-client.ts, tariff-client.ts не переносятся).
import type { ChannelOrder, WbCatalogIndex } from "@sync2/shared"
import type { ChannelAdapter, StockFetch } from "../adapter"
import { fetchOzonBarcodes, fetchOzonPostings, fetchOzonStocks, type OzonCredentials } from "./client"
import { mapOzonOrders, mapOzonStocks } from "./mapper"

/**
 * Адаптер Ozon: заказы и остатки.
 *
 * Штрихкод заказов и остатков — штрихкод WB (не собственный штрихкод Ozon):
 * `wbIndex` строит WB-адаптер в том же прогоне (`fetchCatalog`) и передаёт
 * снаружи — план, «Правила жизненного цикла»/«Контракт снимка остатков».
 *
 * Штрихкоды Ozon по артикулам разрешаются одним проходом на весь набор
 * артикулов, а не по одному на строку: и квота, и время (как в finstock).
 */
export function createOzonAdapter(credentials: OzonCredentials, wbIndex: WbCatalogIndex): ChannelAdapter {
  async function fetchOrders(since: string): Promise<ChannelOrder[]> {
    const postings = await fetchOzonPostings(credentials, since)
    const offerIds = postings.flatMap((posting) => posting.products.map((p) => p.offer_id))
    const barcodes = await fetchOzonBarcodes(credentials, offerIds)
    return mapOzonOrders(postings, barcodes, wbIndex)
  }

  async function fetchStocks(): Promise<StockFetch> {
    const items = await fetchOzonStocks(credentials)
    const barcodes = await fetchOzonBarcodes(credentials, items.map((item) => item.offer_id))
    return mapOzonStocks(items, barcodes, wbIndex)
  }

  return { channel: "ozon", fetchOrders, fetchStocks }
}
