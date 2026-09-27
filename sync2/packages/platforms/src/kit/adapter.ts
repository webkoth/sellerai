// Написано по образцу sync/src/kit.ts, приведено к ChannelAdapter (план,
// задача 6) — в отличие от WB/Ozon/ЯМ, KIT не переносится из finstock: там
// этой площадки не было вовсе.
import type { ChannelOrder, WbCatalogIndex } from "@sync2/shared"
import type { ChannelAdapter, StockFetch } from "../adapter"
import { fetchKitOrders, fetchKitVariants, type KitCredentials, type KitVariant } from "./client"
import { mapKitOrders, mapKitStocks } from "./mapper"

export interface KitConfig extends KitCredentials {
  /** Склад продаж KIT («Склад Краснодар», `KIT_WAREHOUSE_ID`) — единственный склад, который считает пул. */
  warehouseId: string
}

/**
 * Адаптер KIT: заказы и остатки.
 *
 * Варианты — каталог KIT (штрихкод, id, остатки по складам) — читаются один
 * раз на экземпляр адаптера и кэшируются промисом: и заказы (штрихкод
 * позиции через `product_variant_id`), и остатки строятся из одного и того
 * же списка, а площадка не даёт признака «есть ли изменения» — перечитывать
 * его на каждый вызов значило бы вдвое больше запросов там, где темп и так
 * не быстрее одного запроса в секунду (`kitRequest`, см. ../kit/client.ts).
 * Кэш промисом, а не значением: параллельный вызов `fetchOrders`/`fetchStocks`
 * до разрешения первого запроса не запустит второй список вариантов —
 * оба дождутся ОДНОГО и того же промиса.
 *
 * `wbIndex` — каталог WB (строит WB-адаптер в том же прогоне), как у
 * Ozon/ЯМ: штрихкод варианта KIT, по наблюдению, уже штрихкод WB, но
 * проверяется через `resolveWbBarcode`, а не принимается на веру (см.
 * `mapper.ts`, найдено финальным ревью 1.3a).
 */
export function createKitAdapter(config: KitConfig, wbIndex: WbCatalogIndex): ChannelAdapter {
  let variantsPromise: Promise<KitVariant[]> | undefined

  function variants(): Promise<KitVariant[]> {
    if (!variantsPromise) variantsPromise = fetchKitVariants(config)
    return variantsPromise
  }

  async function fetchOrders(since: string): Promise<ChannelOrder[]> {
    const orders = await fetchKitOrders(config)
    const v = await variants()
    return mapKitOrders(orders, v, since, wbIndex)
  }

  async function fetchStocks(): Promise<StockFetch> {
    const v = await variants()
    return mapKitStocks(v, config.warehouseId, wbIndex)
  }

  return { channel: "kit", fetchOrders, fetchStocks }
}
