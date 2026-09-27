// Перенесено из finstock (27.09.2026): packages/platforms/src/wb/fbs-mapper.ts.
import type { ChannelOrder, NormalizedStock } from "@sync2/shared"
import type { StockFetch } from "../adapter"
import type { WbFbsOrder, WbFbsOrderStatus, WbFbsStock } from "./client"
import { wbLifecycle } from "./lifecycle"

/**
 * Сборочные задания в единый заказ синка. Статус проставляется отдельно —
 * /api/v3/orders/new и /api/v3/orders статусов не отдают, их приносит
 * /api/v3/orders/status.
 *
 * Заказ, для которого статуса не пришло, получает жизненный цикл `open`
 * (см. `wbLifecycle`): `/orders/new` по определению отдаёт только новые,
 * и трактовать молчание как отмену значило бы вернуть в пул остатков
 * экземпляр, который на самом деле продан.
 */
export function mapFbsOrders(orders: WbFbsOrder[], statuses?: WbFbsOrderStatus[]): ChannelOrder[] {
  const statusById = new Map<number, WbFbsOrderStatus>()
  for (const status of statuses ?? []) {
    statusById.set(status.id, status)
  }

  return orders.map((order) => {
    const status = statusById.get(order.id)
    const barcode = order.skus?.[0] ?? null

    return {
      externalId: String(order.id),
      barcode,
      externalSku: order.article ?? null,
      // Одно сборочное задание — одна единица товара, независимо от того,
      // что несёт исходная строка.
      quantity: 1,
      // price уже в копейках (см. комментарий в client.ts) —
      // rubToMinor/decimalStringToMinor здесь не применяются вовсе.
      priceMinor: order.price ?? order.convertedPrice ?? 0,
      lifecycle: wbLifecycle(status),
      occurredAt: order.createdAt,
      raw: { order, status: status ?? null },
    }
  })
}

/**
 * Остатки склада продавца, приведённые к контракту снимка (план 1.2/1.3a,
 * «Контракт снимка остатков»): строка на каждый штрихкод КАТАЛОГА, включая
 * нулевые — WB опускает в ответе штрихкоды с нулевым остатком, а не отдаёт
 * их явной строкой с `amount: 0`, и без синтеза нулевой строки домен читал
 * бы отсутствие строки как «карточки нет вовсе», а не «остаток исчерпан».
 *
 * `stocks` — ответ ОДНОГО склада (`POST /api/v3/stocks/{warehouseId}`).
 * Функция ничего не знает про склад и не суммирует несколько складов между
 * собой — по контракту снимка это делает домен (`aggregateStockByBarcode`);
 * адаптер вызывает эту функцию на каждый склад отдельно и сам подписывает
 * результат именем склада (см. adapter.ts).
 *
 * `cards` — весь каталог WB (штрихкод + артикул), а не только то, что
 * вернулось в `stocks`: список запрашиваемых штрихкодов сам приходит из
 * каталога (см. adapter.ts), поэтому здесь он снова нужен только для
 * порядка строк результата и артикула — сопоставление 1:1 по штрихкоду.
 *
 * `quantity` приводится к `Math.max(0, …)`: контракт снимка требует
 * `quantity ≥ 0`, а WB отрицательных чисел не отдаёт, но защита от чужой
 * ошибки в теле ответа дешевле её последствий.
 *
 * У WB штрихкод свой собственный (это и есть штрихкод WB), поэтому
 * `skippedNoWbBarcode` всегда пуст — сопоставлять WB не с чем, площадка сама
 * мастер-каталог.
 */
export function mapFbsStocks(
  stocks: WbFbsStock[],
  cards: Array<{ barcode: string; vendorCode: string }>,
): StockFetch {
  const stockByBarcode = new Map<string, WbFbsStock>()
  for (const stock of stocks) {
    if (stock.sku) stockByBarcode.set(stock.sku, stock)
  }

  const result: NormalizedStock[] = cards.map((card) => {
    const stock = stockByBarcode.get(card.barcode) ?? null
    return {
      barcode: card.barcode,
      externalSku: card.vendorCode,
      quantity: Math.max(0, stock?.amount ?? 0),
      warehouse: null,
      raw: stock,
    }
  })

  return { stocks: result, skippedNoWbBarcode: [] }
}
