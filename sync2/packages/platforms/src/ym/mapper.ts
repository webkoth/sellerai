// Перенесено из finstock (27.09.2026): packages/platforms/src/ym/mapper.ts.
// `cancelled: boolean` заменён жизненным циклом (`ymLifecycle`) — возврат по
// подстатусу отмены «после отправки» теперь returned, а не cancelled;
// `changedAt` убран вместе с денежным `unitPriceMinor` не тронутым (он остаётся
// справочной ценой, не финансовой строкой). Баркод — не первый штрихкод ЯМ, а
// штрихкод WB через `resolveWbBarcode` (площадка не мастер каталога, WB — мастер);
// `skippedNoBarcode` (счётчик) заменён на `skippedNoWbBarcode` (список артикулов,
// интерфейс `StockFetch` из `../adapter`). Остатки — только склады магазина из
// конфига (`warehouseIds`): у ЯМ FBS в ответе может быть и склад возвратов Маркета,
// а пул считает только собственный склад (план, «Контракт снимка остатков», п.4).
import { rubToMinor, resolveWbBarcode, type ChannelOrder, type NormalizedStock, type WbCatalogIndex } from "@sync2/shared"
import type { BarcodeByOffer } from "../barcodes"
import type { StockFetch } from "../adapter"
import { ymLifecycle } from "./lifecycle"
import type { YmOrder, YmOrderItem, YmStockEntry, YmWarehouseStocks } from "./client"

/**
 * Цена единицы товара в копейках из сумм строки заказа.
 *
 * По спецификации стоимость всех единиц складывается из `payment` и
 * `cashback`, `subsidy` — вознаграждение продавцу, суммы даны за все единицы
 * строки. Значит цена покупателя — платёж плюс баллы, без `subsidy`,
 * делённая на количество. Каждое слагаемое переводится в копейки отдельно:
 * сложение двух дробных рублей до перевода дало бы двоичный хвост. Деление
 * округляется; исходные суммы целиком остаются в `raw`.
 *
 * Цена в заказах справочная и в пул не входит (план, «Контракт снимка остатков»
 * касается только остатков; заказы синка не несут деньги в базу этого этапа).
 */
export function unitPriceMinor(prices: YmOrderItem["prices"], count: number): number {
  const payment = rubToMinor(prices?.payment?.value ?? 0)
  const cashback = rubToMinor(prices?.cashback?.value ?? 0)
  const units = count > 0 ? count : 1
  return Math.round((payment + cashback) / units)
}

/**
 * Заказы кабинета в заказы синка — по строке на каждый товар заказа,
 * `externalId` = «заказ:идентификатор строки заказа» (`items[].id`) — он
 * уникален внутри заказа по контракту площадки; артикул уникальным не
 * обязан быть (две строки одного товара в одном заказе). Артикул остаётся
 * в `externalSku` и в `raw`.
 *
 * Жизненный цикл — `ymLifecycle(order)` по таблице плана: `CANCELLED` с
 * подстатусом из списка «после отправки» — `returned` (товар уже уехал и
 * едет назад), любой другой подстатус — `cancelled_before_ship`; `RETURNED`/
 * `PARTIALLY_RETURNED` — всегда `returned`. Тестовые заказы (`fake`)
 * отбрасываются и здесь, хотя клиент их не запрашивает: попав в базу, такой
 * заказ снял бы с полки настоящий экземпляр.
 *
 * Баркод — штрихкод WB через `resolveWbBarcode`, не собственный штрихкод ЯМ:
 * `barcodes` — карта артикул→штрихкоды ЯМ (`fetchYmBarcodes`, sku = offerId),
 * `wbIndex` — каталог WB, строится WB-адаптером в том же прогоне.
 */
export function mapYmOrders(orders: YmOrder[], barcodes: BarcodeByOffer, wbIndex: WbCatalogIndex): ChannelOrder[] {
  const result: ChannelOrder[] = []
  for (const order of orders) {
    if (order.fake) continue
    const lifecycle = ymLifecycle(order)
    for (const item of order.items) {
      result.push({
        externalId: `${order.orderId}:${item.id}`,
        barcode: resolveWbBarcode(wbIndex, { barcodes: barcodes.get(item.offerId) ?? [], sku: item.offerId }),
        externalSku: item.offerId,
        quantity: item.count,
        priceMinor: unitPriceMinor(item.prices, item.count),
        lifecycle,
        occurredAt: order.creationDate,
        raw: {
          ...item,
          orderId: order.orderId,
          campaignId: order.campaignId,
          programType: order.programType,
          status: order.status,
          substatus: order.substatus,
          creationDate: order.creationDate,
          updateDate: order.updateDate,
        },
      })
    }
  }
  return result
}

/**
 * Количество из записей остатка одного товара на одном складе.
 * `AVAILABLE` — доступно к заказу; если его нет, `FIT` — годный к продаже.
 * У товаров FBS оба типа присутствуют одновременно с равным количеством.
 * Прочие типы (брак, карантин, утилизация) к продаже не относятся.
 */
export function stockCount(entries: YmStockEntry[] | null | undefined): number {
  const list = entries ?? []
  const available = list.find((entry) => entry.type === "AVAILABLE")
  if (available) return available.count
  const fit = list.find((entry) => entry.type === "FIT")
  return fit ? fit.count : 0
}

/**
 * Остатки по складам в снимок синка — по строке на товар со штрихкодом WB
 * на каждом СВОЁМ складе. `warehouseIds` — склады магазина из конфига
 * (план, «Контракт снимка остатков», п.4): у ЯМ FBS в ответе может быть и
 * склад возвратов Маркета, который в пул не входит, — склад не из списка
 * пропускается целиком, до разрешения штрихкода.
 *
 * Ключ — `resolveWbBarcode` (sku = offerId), не собственный штрихкод ЯМ.
 * Не сопоставилось — артикул в `skippedNoWbBarcode` (список, дедуплицируется
 * по offerId — один товар может встретиться на нескольких складах магазина),
 * строка не создаётся: без ключа каталога товар стал бы «сиротой». Товар со
 * штрихкодом, но без записей остатка на складе, даёт строку с нулём —
 * «выставлен и пуст», не пропуск. `quantity` приводится к `Math.max(0, …)`
 * (контракт снимка, п.3), хотя у ЯМ отрицательных значений не наблюдалось.
 */
export function mapYmStocks(
  warehouses: YmWarehouseStocks[],
  barcodes: BarcodeByOffer,
  wbIndex: WbCatalogIndex,
  warehouseIds: readonly number[],
): StockFetch {
  const stocks: NormalizedStock[] = []
  const skippedNoWbBarcode: string[] = []
  const seenSkipped = new Set<string>()
  const own = new Set(warehouseIds)

  for (const warehouse of warehouses) {
    if (!own.has(warehouse.warehouseId)) continue
    for (const offer of warehouse.offers) {
      const barcode = resolveWbBarcode(wbIndex, { barcodes: barcodes.get(offer.offerId) ?? [], sku: offer.offerId })
      if (!barcode) {
        if (!seenSkipped.has(offer.offerId)) {
          seenSkipped.add(offer.offerId)
          skippedNoWbBarcode.push(offer.offerId)
        }
        continue
      }
      stocks.push({
        barcode,
        externalSku: offer.offerId,
        quantity: Math.max(0, stockCount(offer.stocks)),
        warehouse: String(warehouse.warehouseId),
        raw: { warehouseId: warehouse.warehouseId, ...offer },
      })
    }
  }

  return { stocks, skippedNoWbBarcode }
}

/**
 * Офферы магазина без записи остатка (NO_STOCKS) — пустой строкой на первом складе магазина из
 * конфига: mapYmStocks даст им нулевую строку снимка («выставлен и пуст»), и план выставит остаток
 * пула. Оффер, который уже есть на любом своём складе, не дублируется.
 */
export function withOffersWithoutStock(
  warehouses: YmWarehouseStocks[],
  campaignOfferIds: readonly string[],
  warehouseIds: readonly number[],
): YmWarehouseStocks[] {
  const target = warehouseIds[0]
  if (target === undefined) return warehouses
  const own = new Set(warehouseIds)
  const seen = new Set<string>()
  for (const w of warehouses) if (own.has(w.warehouseId)) for (const o of w.offers) seen.add(o.offerId)
  const missing = [...new Set(campaignOfferIds)].filter((id) => !seen.has(id))
  if (missing.length === 0) return warehouses
  return [...warehouses, { warehouseId: target, offers: missing.map((offerId) => ({ offerId, stocks: [] })) }]
}
