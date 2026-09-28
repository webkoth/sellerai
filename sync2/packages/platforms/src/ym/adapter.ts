// Перенесено из finstock (27.09.2026): packages/platforms/src/ym/adapter.ts,
// приведено к ChannelAdapter — финансовые методы (fetchRealization) и
// каталожные методы тарифов убраны вместе с их клиентами (finance-client.ts,
// finance-mapper.ts, tariff-client.ts, tariff-mapper.ts не переносятся;
// `keepNettingRow` был их вспомогательной функцией и тоже не переносится).
import type { ChannelOrder, WbCatalogIndex } from "@sync2/shared"
import type { ChannelAdapter, StockFetch } from "../adapter"
import { fetchYmBarcodes, fetchYmCampaignOfferIds, fetchYmOrders, fetchYmStocks, type YmCredentials } from "./client"
import { mapYmOrders, mapYmStocks, withOffersWithoutStock } from "./mapper"

/**
 * Адаптер Яндекс.Маркета: заказы и остатки.
 *
 * Штрихкод заказов и остатков — штрихкод WB (не собственный штрихкод ЯМ):
 * `wbIndex` строит WB-адаптер в том же прогоне (`fetchCatalog`) и передаёт
 * снаружи — план, «Правила жизненного цикла»/«Контракт снимка остатков».
 *
 * `warehouseIds` — склады магазина из конфига кабинета (план, «Контракт
 * снимка остатков», п.4): у ЯМ FBS в ответе остатков может быть и склад
 * возвратов Маркета, который в пул не входит — фильтр применяет маппер
 * (`mapYmStocks`), сюда список приходит как есть.
 *
 * Штрихкоды ЯМ по артикулам разрешаются одним проходом на весь набор
 * артикулов, а не по одному на строку: и квота, и время (как в finstock,
 * как у Ozon).
 */
export function createYmAdapter(credentials: YmCredentials, wbIndex: WbCatalogIndex, warehouseIds: number[]): ChannelAdapter {
  async function fetchOrders(since: string): Promise<ChannelOrder[]> {
    const orders = await fetchYmOrders(credentials, since)
    const offerIds = orders.flatMap((order) => order.items.map((item) => item.offerId))
    const barcodes = await fetchYmBarcodes(credentials, offerIds)
    return mapYmOrders(orders, barcodes, wbIndex)
  }

  async function fetchStocks(): Promise<StockFetch> {
    // Офферы без записи остатка (NO_STOCKS) в /offers/stocks не приходят — добираем списком офферов магазина.
    const warehouses = withOffersWithoutStock(await fetchYmStocks(credentials), await fetchYmCampaignOfferIds(credentials), warehouseIds)
    const offerIds = warehouses.flatMap((w) => w.offers.map((offer) => offer.offerId))
    const barcodes = await fetchYmBarcodes(credentials, offerIds)
    return mapYmStocks(warehouses, barcodes, wbIndex, warehouseIds)
  }

  return { channel: "ym", fetchOrders, fetchStocks }
}
