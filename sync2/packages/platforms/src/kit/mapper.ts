// Написано по образцу sync/src/kit.ts (старый синк, заплатка 27.09.2026,
// проверена на живом магазине kit42191) — не перенос из finstock: там
// площадки KIT не было вовсе.
import { rubToMinor, type ChannelOrder, type NormalizedStock } from "@sync2/shared"
import type { StockFetch } from "../adapter"
import type { KitOrder, KitVariant } from "./client"
import { kitLifecycle } from "./lifecycle"

/**
 * Остатки склада продаж в снимок синка — по строке на каждый вариант СО
 * ШТРИХКОДОМ (без него товар «сирота» — без ключа каталога синка, план,
 * «Контракт снимка остатков», п.2).
 *
 * В отличие от Ozon/ЯМ здесь нет `resolveWbBarcode`: варианты магазина
 * kit42191 заведены со штрихкодами WB напрямую, при первом импорте (память
 * «Яндекс KIT store») — штрихкод варианта УЖЕ штрихкод WB. Это предположение
 * синка, а не проверенный факт каждого варианта по отдельности; если
 * появится контрпример (штрихкод варианта не из каталога WB), решение
 * придётся пересмотреть в 1.3b на первом настоящем снимке.
 *
 * `quantity` — сумма `stocks[].quantity` ТОЛЬКО по складу продаж
 * `warehouseId` («Склад Краснодар» в конфиге кабинета), приведённая к
 * `Math.max(0, …)` (контракт снимка, п.3) — на живых данных отрицательных
 * значений не наблюдалось, но защита от чужой ошибки в теле ответа дешевле
 * последствий (тот же приём, что у WB/Ozon/ЯМ). Вариант без записи на своём
 * складе (пустой `stocks` или только чужие склады) даёт строку с нулём —
 * «выставлен и пуст», не пропуск.
 *
 * `externalSku` — id варианта: у KIT нет отдельного артикула продавца,
 * заказы ссылаются на товар через `product_variant_id`, то есть тот же id —
 * устойчивый идентификатор товара внутри площадки (симметрично с `mapKitOrders`,
 * где `barcodeById` строится по тому же id).
 */
export function mapKitStocks(variants: KitVariant[], warehouseId: string): StockFetch {
  const stocks: NormalizedStock[] = []
  const skippedNoWbBarcode: string[] = []

  for (const variant of variants) {
    const barcode = variant.barcode?.trim()
    if (!barcode) {
      skippedNoWbBarcode.push(variant.id)
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
      raw: variant,
    })
  }

  return { stocks, skippedNoWbBarcode }
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
 * variant.barcode`, собранную из того же списка вариантов, что и снимок
 * остатков (план, задача 6: «варианты — читаются один раз на экземпляр
 * адаптера»). Вариант не нашёлся или у него нет штрихкода — `barcode: null`,
 * строка заказа всё равно создаётся: заказ без баркода такое же событие,
 * которое нужно учесть, как и у Ozon/ЯМ (там же правило).
 *
 * `since` — окно чтения (план, интерфейс `ChannelAdapter`): заказы с
 * `created_at` раньше `since` отбрасываются здесь, а не в клиенте — тот
 * листает ВСЕ страницы без фильтра (как в sync/src/kit.ts, площадка не даёт
 * фильтр по дате).
 *
 * `priceMinor` — из `final_price` позиции (цена СО скидками, десятичная
 * строка рублей на живом ответе) через `rubToMinor`: план прямо называет эту
 * функцию, а не `decimalStringToMinor` — цена в заказах KIT справочная и в
 * пул не входит (план, «Контракт снимка остатков» касается только остатков).
 *
 * `raw` — весь заказ БЕЗ `client` (имя, телефон, e-mail покупателя): снимок
 * для разбора споров не должен нести персональные данные (план, задача 6,
 * шаг 1 — то же правило, что и для образцов ответов в фикстурах). Один и тот
 * же `rawOrder` (без `client`) переиспользуется для всех строк одного
 * заказа — он не завязан на конкретную позицию.
 */
export function mapKitOrders(orders: KitOrder[], variants: KitVariant[], since: string): ChannelOrder[] {
  const barcodeByVariantId = new Map(variants.map((v) => [v.id, v.barcode?.trim() || null] as const))
  const sinceMs = Date.parse(since)
  const result: ChannelOrder[] = []

  for (const order of orders) {
    if (Date.parse(order.created_at) < sinceMs) continue
    const lifecycle = kitLifecycle(order.status)
    const { client: _client, ...rawOrder } = order

    for (const chunk of order.delivery_chunks) {
      for (const item of chunk.items) {
        result.push({
          externalId: `${order.id}:${item.id}`,
          barcode: barcodeByVariantId.get(item.product_variant_id) ?? null,
          externalSku: item.product_variant_id,
          quantity: item.quantity,
          priceMinor: rubToMinor(Number(item.final_price)),
          lifecycle,
          occurredAt: new Date(order.created_at).toISOString(),
          raw: rawOrder,
        })
      }
    }
  }

  return result
}
