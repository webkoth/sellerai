// Перенесено из finstock (27.09.2026): packages/platforms/src/wb/adapter.ts,
// приведено к ChannelAdapter — реализация, тарифы и финансы убраны, остаток
// раскладывается на строки по складам (сумма — дело домена, см. mapper.ts).
import type { ChannelOrder, NormalizedStock, WbCatalogEntry } from "@sync2/shared"
import type { ChannelAdapter, StockFetch } from "../adapter"
import {
  fetchAllCards,
  fetchFbsOrders,
  fetchFbsOrderStatuses,
  fetchFbsStocks,
  fetchFbsWarehouses,
  fetchNewFbsOrders,
  type WbFbsOrder,
} from "./client"
import { mapCards } from "./cards-mapper"
import { mapFbsOrders, mapFbsStocks } from "./mapper"

export function createWbAdapter(
  token: string,
): ChannelAdapter & { fetchCatalog(): Promise<WbCatalogEntry[]> } {
  // Каталог кэшируется на экземпляр адаптера: `fetchStocks` нужны штрихкоды
  // каталога, чтобы синтезировать нулевые строки, а внутри одного прогона
  // `probe` каталог и так запрашивается один раз через `fetchCatalog` — второй
  // поход за теми же карточками был бы лишним расходом лимита «Контента».
  let catalogPromise: Promise<WbCatalogEntry[]> | null = null

  function loadCatalog(): Promise<WbCatalogEntry[]> {
    catalogPromise ??= fetchAllCards(token).then(mapCards)
    return catalogPromise
  }

  /**
   * Сборочные задания FBS из ДВУХ источников категории «Маркетплейс»,
   * объединённые по `id`, плюс статусы одним отдельным запросом.
   *
   * ПОЧЕМУ ДВА ИСТОЧНИКА, А НЕ ОДИН. `/api/v3/orders/new` отдаёт снимок
   * заданий, находящихся в статусе «новое» РОВНО НА МОМЕНТ ЗАПРОСА —
   * собранное и отгруженное между двумя опросами этого метода из ответа
   * исчезает без следа. Значит задание, целиком прожившее путь «создано →
   * собрано» между двумя тиками синка, `/orders/new` не покажет НИКОГДА —
   * это была бы тихая, необратимая потеря заказа. `/api/v3/orders` за период
   * (`since` … сейчас) эту дыру закрывает: он отдаёт все задания периода
   * независимо от текущего статуса. Оба метода пересекаются на новых
   * заданиях — это ожидаемо и снимается дедупом по `id`.
   *
   * Статус (в частности признак отмены) ни один из двух методов не несёт —
   * его приносит только `POST /api/v3/orders/status`, отдельным вызовом на
   * весь объединённый набор идентификаторов сразу.
   */
  async function fetchOrders(since: string): Promise<ChannelOrder[]> {
    const newOrders = await fetchNewFbsOrders(token)

    // Верхней границы периода нет: /api/v3/orders отвечает отказом, если
    // передать dateTo на периоде длиннее недели (см. комментарий в client.ts).
    const fromUnix = Math.floor(Date.parse(since) / 1000)
    const periodOrders = await fetchFbsOrders(token, fromUnix)

    // Дедуп по id — задание, оказавшееся сразу в обоих ответах (обычный
    // случай для нового задания), не должно попасть в результат дважды.
    const orderById = new Map<number, WbFbsOrder>()
    for (const order of newOrders) orderById.set(order.id, order)
    for (const order of periodOrders) orderById.set(order.id, order)
    const merged = [...orderById.values()]

    const statuses = await fetchFbsOrderStatuses(
      token,
      merged.map((order) => order.id),
    )

    return mapFbsOrders(merged, statuses)
  }

  /**
   * Остатки по ВСЕМ складам продавца, а не только по первому — остаток по
   * неверному складу это неверный пул, а при глубине запаса в одну единицу
   * именно он решает, будет ли двойная продажа.
   *
   * Строки не суммируются между складами здесь: контракт снимка (план 1.2/
   * 1.3a) отдаёт эту сумму домену (`aggregateStockByBarcode`) — адаптер
   * вызывает `mapFbsStocks` на каждый склад отдельно и подписывает результат
   * именем склада.
   */
  async function fetchStocks(): Promise<StockFetch> {
    const warehouses = await fetchFbsWarehouses(token)
    if (warehouses.length === 0) return { stocks: [], skippedNoWbBarcode: [] }

    // Штрихкоды — из каталога, а не из истории заказов: метод остатков
    // отвечает только про то, о чём его спросили, и новый, ещё не проданный
    // товар без запроса про его штрихкод остался бы невидимым.
    const catalog = await loadCatalog()
    const skus = catalog.map((entry) => entry.barcode)
    const cardsForMapper = catalog.map((entry) => ({ barcode: entry.barcode, vendorCode: entry.vendorCode }))

    const stocks: NormalizedStock[] = []
    for (const warehouse of warehouses) {
      const warehouseStocks = await fetchFbsStocks(token, warehouse.id, skus)
      const { stocks: mapped } = mapFbsStocks(warehouseStocks, cardsForMapper)
      for (const row of mapped) stocks.push({ ...row, warehouse: warehouse.name })
    }

    return { stocks, skippedNoWbBarcode: [] }
  }

  /**
   * Каталог продавца — по одной строке на штрихкод. `fetchAllCards` отдаёт
   * все страницы одним массивом, а `mapCards` — чистое пораздельное
   * разворачивание карточки в её штрихкоды.
   */
  async function fetchCatalog(): Promise<WbCatalogEntry[]> {
    return loadCatalog()
  }

  return { channel: "wb", fetchOrders, fetchStocks, fetchCatalog }
}
