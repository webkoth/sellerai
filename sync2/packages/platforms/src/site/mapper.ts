import { resolveWbBarcode, type ChannelOrder, type NormalizedStock, type WbCatalogIndex } from "@sync2/shared"
import type { StockFetch } from "../adapter"
import type { SiteOrder, SiteStockItem } from "./client"
import { siteLifecycle } from "./lifecycle"

/**
 * Штрихкод сайта → штрихкод WB. У сайта это уже штрихкод WB (каталог сайта —
 * копия WB), но, как у KIT, проверяется по каталогу WB этого прогона, а не
 * принимается на веру: чужой штрихкод сделал бы товар «сиротой».
 */
function toWbBarcode(wbIndex: WbCatalogIndex, barcode: string | null): string | null {
  return barcode ? resolveWbBarcode(wbIndex, { barcodes: [barcode], sku: null }) : null
}

/**
 * Снимок остатка витрины: строка на каждый штрихкод каталога сайта, нули
 * включены (контракт снимка, план 1.3a). Штрихкод не из каталога WB — в
 * пропуски. Остаток — целый и не ниже нуля.
 */
export function mapSiteStocks(items: SiteStockItem[], wbIndex: WbCatalogIndex): StockFetch {
  const stocks: NormalizedStock[] = []
  const skippedNoWbBarcode: string[] = []
  for (const item of items) {
    const barcode = toWbBarcode(wbIndex, item.barcode)
    if (!barcode) {
      skippedNoWbBarcode.push(item.barcode)
      continue
    }
    const quantity = Number(item.quantity)
    stocks.push({
      barcode,
      externalSku: null,
      quantity: Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0,
      warehouse: null,
      raw: item,
    })
  }
  return { stocks, skippedNoWbBarcode }
}

/**
 * Заказы сайта в заказы синка — строка на позицию. `externalId` — «id
 * заказа:id позиции» (оба — id строк базы сайта). Позиция без штрихкода или
 * со штрихкодом не из каталога WB — `barcode: null` (домен считает её в
 * ordersNoBarcode), исходный штрихкод остаётся в `externalSku`. Заказы раньше
 * `since` и с нечитаемой датой пропускаются. `raw` — номер, статус, время и
 * позиция: персональных данных сайт в ленту не отдаёт.
 */
export function mapSiteOrders(orders: SiteOrder[], since: string, wbIndex: WbCatalogIndex): ChannelOrder[] {
  const sinceMs = Date.parse(since)
  const result: ChannelOrder[] = []
  for (const order of orders) {
    const createdAtMs = Date.parse(order.createdAt)
    if (Number.isNaN(createdAtMs) || createdAtMs < sinceMs) continue
    const lifecycle = siteLifecycle(order.status)
    const occurredAt = new Date(createdAtMs).toISOString()
    for (const item of order.items) {
      result.push({
        externalId: `${order.id}:${item.lineId}`,
        barcode: toWbBarcode(wbIndex, item.barcode),
        externalSku: item.barcode,
        quantity: item.quantity,
        priceMinor: item.priceKopecks,
        lifecycle,
        occurredAt,
        raw: { id: order.id, number: order.number, status: order.status, createdAt: order.createdAt, item },
      })
    }
  }
  return result
}
