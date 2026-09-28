// Перенесено из finstock (27.09.2026): packages/platforms/src/ozon/mapper.ts.
// `cancelled: boolean` заменён жизненным циклом (`ozonLifecycle`); баркод —
// не первый штрихкод Ozon, а штрихкод WB через `resolveWbBarcode` (площадка
// не мастер каталога, WB — мастер); отрицательный остаток обнуляется, а не
// проходит наружу как сигнал (контракт снимка 1.2/1.3a требует quantity ≥ 0);
// `skippedNoBarcode` (счётчик) заменён на `skippedNoWbBarcode` (список
// артикулов, интерфейс `StockFetch` из `../adapter`).
import { decimalStringToMinor, resolveWbBarcode, type ChannelOrder, type NormalizedStock, type WbCatalogIndex } from "@sync2/shared"
import type { BarcodeByOffer } from "../barcodes"
import type { StockFetch } from "../adapter"
import { ozonLifecycle } from "./lifecycle"
import type { OzonPosting, OzonStockItem } from "./client"

/**
 * Отправления в заказы синка — по строке на КАЖДЫЙ товар отправления.
 * Строка заказа у нас на один баркод, а отправление Ozon может нести
 * несколько товаров, поэтому `externalId` = «номер отправления:sku»:
 * уникален в кабинете и читается глазами.
 *
 * Цена приходит объектом `{ amount, currency }`, где `amount` — десятичная
 * строка (живая фикстура, спецификация описывала строку); разбирается
 * `decimalStringToMinor`, не через `Number` и `rubToMinor`: строковый разбор
 * не проходит через двоичную дробь (см. money.ts).
 *
 * Баркод — штрихкод WB, а не собственный штрихкод Ozon: ключ товара во всём
 * синке один, и это каталог WB (план, «Контракт снимка остатков», п.2).
 * `barcodes` — карта артикул→штрихкоды Ozon (`fetchOzonBarcodes`), `wbIndex`
 * — каталог WB, строится WB-адаптером в том же прогоне и передаётся снаружи.
 * Не сопоставилось — `barcode: null`, строка заказа всё равно создаётся
 * (в отличие от остатков — заказ без баркода это тоже событие, которое нужно
 * учесть, а не молча выбросить).
 *
 * Время события и изменения — `in_process_at`: другого времени список
 * отправлений не отдаёт.
 */
export function mapOzonOrders(postings: OzonPosting[], barcodes: BarcodeByOffer, wbIndex: WbCatalogIndex): ChannelOrder[] {
  const result: ChannelOrder[] = []
  for (const posting of postings) {
    const lifecycle = ozonLifecycle(posting)
    for (const product of posting.products) {
      result.push({
        externalId: `${posting.posting_number}:${product.sku}`,
        barcode: resolveWbBarcode(wbIndex, { barcodes: barcodes.get(product.offer_id) ?? [], sku: product.offer_id }),
        externalSku: product.offer_id,
        quantity: product.quantity,
        priceMinor: decimalStringToMinor(product.price.amount),
        lifecycle,
        occurredAt: posting.in_process_at,
        raw: {
          ...product,
          posting_number: posting.posting_number,
          order_id: posting.order_id,
          order_number: posting.order_number,
          status: posting.status,
          substatus: posting.substatus,
          in_process_at: posting.in_process_at,
          cancellation: posting.cancellation,
        },
      })
    }
  }
  return result
}

/** Склад продавца с доставкой силами Ozon — модель этого магазина (см. `delivery_schema: "FBS"` в транзакциях). */
const FBS_WAREHOUSE_TYPE = "fbs"

/**
 * Остатки в снимок синка, по строке на товар с найденным штрихкодом WB.
 *
 * `quantity` = `Math.max(0, present − reserved)` по складу `fbs`. WB и ЯМ
 * уменьшают остаток при заказе сами, Ozon держит заказанное в резерве до
 * отгрузки — без вычитания три зеркала несравнимы. В finstock отрицательный
 * результат не обнулялся (сигнал расхождения); контракт снимка синка
 * (план, «Контракт снимка остатков», п.3) требует `quantity ≥ 0` — здесь он
 * приводится к нулю, как и у WB (`mapFbsStocks`).
 *
 * Товар без записи `fbs` даёт строку с нулём: «выставлен и пуст» — значение,
 * а не пропуск (то же правило, что в finstock). Товар, для которого не
 * нашёлся штрихкод WB (ни свой штрихкод Ozon, ни артикул не сопоставились
 * через `resolveWbBarcode`), в снимок не попадает вовсе — его артикул уходит
 * в `skippedNoWbBarcode`: строка без ключа каталога сделала бы товар
 * невидимым «сиротой», а не отражала бы правду о его остатке.
 *
 * `warehouse` — склады FBS, где лежит товар (`warehouse_ids` записей fbs): «fbs:<id,…>» по возрастанию;
 * площадка их не дала — «fbs». Остаток — сумма по всем FBS-складам, а sync2 пишет в один
 * (OZON_WAREHOUSE_ID): pool по этому полю видит второй склад и не пишет Ozon (этап 1.4).
 */
export function mapOzonStocks(items: OzonStockItem[], barcodes: BarcodeByOffer, wbIndex: WbCatalogIndex): StockFetch {
  const stocks: NormalizedStock[] = []
  const skippedNoWbBarcode: string[] = []

  for (const item of items) {
    const barcode = resolveWbBarcode(wbIndex, { barcodes: barcodes.get(item.offer_id) ?? [], sku: item.offer_id })
    if (!barcode) {
      skippedNoWbBarcode.push(item.offer_id)
      continue
    }
    const fbs = item.stocks.filter((entry) => entry.type === FBS_WAREHOUSE_TYPE)
    const balance = fbs.reduce((sum, entry) => sum + (entry.present - entry.reserved), 0)
    const warehouseIds = [...new Set(fbs.flatMap((entry) => entry.warehouse_ids ?? []))].sort((a, b) => a - b)
    stocks.push({
      barcode,
      externalSku: item.offer_id,
      quantity: Math.max(0, balance),
      warehouse: warehouseIds.length > 0 ? `${FBS_WAREHOUSE_TYPE}:${warehouseIds.join(",")}` : FBS_WAREHOUSE_TYPE,
      raw: item,
    })
  }

  return { stocks, skippedNoWbBarcode }
}
