/**
 * Строка снимка остатков площадки, уже нормализованная адаптером.
 * Форма совпадает с NormalizedStock в finstock (packages/shared/src/realization.ts):
 * при переносе sync2 в finstock тип не меняется.
 */
export interface NormalizedStock {
  barcode: string
  /** Артикул продавца на площадке (offer_id, vendorCode), если площадка его отдаёт. */
  externalSku: string | null
  quantity: number
  /** Склад площадки; несколько строк одного баркода на разных складах суммируются в домене. */
  warehouse: string | null
  /** Исходная строка ответа площадки — для разбора споров, домен её не читает. */
  raw?: unknown
}
