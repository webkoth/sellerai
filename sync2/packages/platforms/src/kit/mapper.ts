// Написано по образцу sync/src/kit.ts (старый синк, заплатка 27.09.2026,
// проверена на живом магазине kit42191) — не перенос из finstock: там
// площадки KIT не было вовсе.
import { resolveWbBarcode, rubToMinor, type ChannelOrder, type NormalizedStock, type WbCatalogIndex } from "@sync2/shared"
import type { StockFetch } from "../adapter"
import type { KitDeliveryChunk, KitOrder, KitOrderItem, KitVariant } from "./client"
import { kitLifecycle } from "./lifecycle"

/** Штрихкоды варианта для `resolveWbBarcode`: у KIT их всегда не больше одного. */
function variantBarcodes(variant: KitVariant): readonly string[] {
  return variant.barcode ? [variant.barcode] : []
}

/**
 * Остатки склада продаж в снимок синка — по строке на каждый вариант,
 * штрихкод которого разрешился до штрихкода WB (без него товар «сирота» —
 * без ключа каталога синка, план, «Контракт снимка остатков», п.2).
 *
 * Штрихкод варианта, по наблюдению, УЖЕ штрихкод WB (варианты магазина
 * kit42191 заведены с ним при первом импорте, память «Яндекс KIT store») —
 * но это наблюдение, не гарантия контракта площадки, и финальное ревью
 * 1.3a потребовало проверять его по каталогу WB так же, как у Ozon/ЯМ,
 * `resolveWbBarcode` (а не принимать штрихкод варианта на веру): `sku`
 * варианта — запасной ключ (offer_id = артикул WB), как штрихкод варианта,
 * так и запасной ключ пробуются ЧЕРЕЗ каталог, а не мимо него.
 *
 * Не сопоставилось — в `skippedNoWbBarcode` уходит `sku` (если есть) или
 * `id` варианта — то же самое, чем в заказах ссылаются на товар
 * (`product_variant_id`), а не голый штрихкод площадки: `sku` читается
 * глазами, `id` — резерв, когда и его нет.
 *
 * `quantity` — сумма `stocks[].quantity` ТОЛЬКО по складу продаж
 * `warehouseId` («Склад Краснодар» в конфиге кабинета), приведённая к
 * `Math.max(0, …)` (контракт снимка, п.3) — на живых данных отрицательных
 * значений не наблюдалось, но защита от чужой ошибки в теле ответа дешевле
 * последствий (тот же приём, что у WB/Ozon/ЯМ). Вариант без записи на своём
 * складе (пустой `stocks` или только чужие склады) даёт строку с нулём —
 * «выставлен и пуст», не пропуск.
 *
 * `externalSku` — id варианта: у KIT нет отдельного артикула продавца в
 * заказах (заказы ссылаются на товар через `product_variant_id`, то есть
 * тот же id), поэтому он остаётся устойчивым идентификатором товара внутри
 * площадки (симметрично с `mapKitOrders`, где карта штрихкодов строится по
 * тому же id).
 */
export function mapKitStocks(variants: KitVariant[], warehouseId: string, wbIndex: WbCatalogIndex): StockFetch {
  const stocks: NormalizedStock[] = []
  const skippedNoWbBarcode: string[] = []

  for (const variant of variants) {
    const barcode = resolveWbBarcode(wbIndex, { barcodes: variantBarcodes(variant), sku: variant.sku ?? null })
    if (!barcode) {
      skippedNoWbBarcode.push(variant.sku ?? variant.id)
      continue
    }
    const quantity = (variant.stocks ?? [])
      .filter((entry) => entry.warehouse_id === warehouseId)
      .reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0)
    stocks.push({
      barcode,
      externalSku: variant.id,
      quantity: Math.max(0, quantity),
      warehouse: warehouseId,
      // Только то, что нужно для разбора споров: вариант целиком (описания, картинки) раздувал
      // stock_snapshots_raw — 185 МБ снимков KIT за первые сутки (28.09), а тик теперь раз в 5 минут.
      raw: {
        id: variant.id,
        barcode: variant.barcode,
        sku: variant.sku ?? null,
        stocks: (variant.stocks ?? []).filter((entry) => entry.warehouse_id === warehouseId),
      },
    })
  }

  return { stocks, skippedNoWbBarcode }
}

/**
 * Цена позиции в копейках из `final_price` (десятичная строка рублей,
 * живой ответ). Площадка теоретически может прислать не число (пустую
 * строку, мусор) — `rubToMinor` в этом случае БРОСАЕТ (`Number.isFinite`),
 * а цена заказа KIT справочная и в пул не входит (план, «Контракт снимка
 * остатков» — только про остатки): ронять чтение всего канала из-за одной
 * непонятной цены неверно, поэтому она подстраховывается нулём, а не
 * пробрасывает исключение наверх (найдено финальным ревью 1.3a).
 */
function safeFinalPriceMinor(finalPrice: string): number {
  const rub = Number(finalPrice)
  return Number.isFinite(rub) ? rubToMinor(rub) : 0
}

/**
 * Неперсональная запись о заказе для `raw` — allowlist полей, а не
 * «весь заказ минус `client`»: у части доставки (`delivery_chunks[].
 * delivery_info`) есть `address` — адрес получателя, персональные данные,
 * которые вычитание одного `client` оставляло бы в `raw` нетронутыми
 * (найдено финальным ревью 1.3a, до записи в базу в 1.3b). Здесь явно
 * перечислено только то, что нужно для разбора споров и не несёт личных
 * данных: id и номер заказа, статус, время, сама позиция (все её поля —
 * скидки, цена, флаг удаления варианта — товарные, не персональные) и
 * способ/статус/склад доставки БЕЗ адреса.
 */
function buildOrderRaw(order: KitOrder, chunk: KitDeliveryChunk, item: KitOrderItem): unknown {
  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    created_at: order.created_at,
    item,
    chunk: {
      id: chunk.id,
      delivery_info: {
        method: chunk.delivery_info.method,
        raw_status: chunk.delivery_info.raw_status,
        warehouse_id: chunk.delivery_info.warehouse_id,
      },
    },
  }
}

/**
 * Заказы KIT в заказы синка — по строке на каждую позицию КАЖДОЙ части
 * доставки (`delivery_chunks[].items[]`): один заказ может уехать несколькими
 * посылками (частями доставки), и позиция — минимальная единица товара, не
 * заказ и не часть доставки целиком.
 *
 * `externalId` = «id заказа:id позиции» — оба уникальны по контракту площадки
 * (`items[].id` — отдельный UUID позиции, не количество и не индекс).
 *
 * Штрихкод — через `product_variant_id` позиции в карту `variant.id →
 * resolveWbBarcode(...)`, построенную из того же списка вариантов, что и
 * снимок остатков (план, задача 6: «варианты — читаются один раз на
 * экземпляр адаптера»), тем же способом, что и в `mapKitStocks` (каталог
 * WB, а не штрихкод площадки напрямую). Вариант не нашёлся, у него нет
 * штрихкода, или штрихкод не сопоставился с каталогом WB — `barcode: null`,
 * строка заказа всё равно создаётся: заказ без баркода такое же событие,
 * которое нужно учесть, как и у Ozon/ЯМ (там же правило).
 *
 * `since` — окно чтения (план, интерфейс `ChannelAdapter`): заказы с
 * `created_at` раньше `since` отбрасываются здесь, а не в клиенте — тот
 * листает ВСЕ страницы без фильтра (как в sync/src/kit.ts, площадка не даёт
 * фильтр по дате). `created_at`, который не разобрался в дату
 * (`Number.isNaN`), — заказ целиком пропускается, а не превращается в
 * `since` или падает на `.toISOString()` — одна кривая дата не должна
 * ронять чтение всего канала (найдено финальным ревью 1.3a).
 *
 * `priceMinor` — из `final_price` позиции через `safeFinalPriceMinor`
 * (см. выше): план прямо называет `rubToMinor`, а не `decimalStringToMinor`
 * — цена в заказах KIT справочная и в пул не входит.
 *
 * `raw` — allowlist полей заказа БЕЗ персональных данных (`buildOrderRaw`).
 */
export function mapKitOrders(orders: KitOrder[], variants: KitVariant[], since: string, wbIndex: WbCatalogIndex): ChannelOrder[] {
  const barcodeByVariantId = new Map(
    variants.map((v) => [v.id, resolveWbBarcode(wbIndex, { barcodes: variantBarcodes(v), sku: v.sku ?? null })] as const),
  )
  const sinceMs = Date.parse(since)
  const result: ChannelOrder[] = []

  for (const order of orders) {
    const createdAtMs = Date.parse(order.created_at)
    // Дата не разобралась вовсе — заказ пропускается целиком: не считать
    // его новым (`since`) и не пытаться отформатировать невалидную дату.
    if (Number.isNaN(createdAtMs)) continue
    if (createdAtMs < sinceMs) continue

    const lifecycle = kitLifecycle(order.status)
    const occurredAt = new Date(createdAtMs).toISOString()

    for (const chunk of order.delivery_chunks) {
      for (const item of chunk.items) {
        result.push({
          externalId: `${order.id}:${item.id}`,
          barcode: barcodeByVariantId.get(item.product_variant_id) ?? null,
          externalSku: item.product_variant_id,
          quantity: item.quantity,
          priceMinor: safeFinalPriceMinor(item.final_price),
          lifecycle,
          occurredAt,
          raw: buildOrderRaw(order, chunk, item),
        })
      }
    }
  }

  return result
}
