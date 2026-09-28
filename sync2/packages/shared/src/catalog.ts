/** Карточка WB — мастер-каталог: штрихкод WB — ключ товара во всём синке. */
export interface WbCatalogEntry {
  barcode: string
  vendorCode: string
  nmId: number | null
  title: string
  subject: string | null
  /**
   * chrtId размера WB — ключ записи остатка (`PUT /api/v3/stocks/{warehouseId}`, этап 1.4). Необязателен:
   * его нет у записей, собранных не из карточек WB (тесты, сверки).
   */
  chrtId?: number | null
}

export interface WbCatalogIndex {
  barcodes: ReadonlySet<string>
  byVendorCode: ReadonlyMap<string, string>
}

export function buildWbCatalogIndex(entries: WbCatalogEntry[]): WbCatalogIndex {
  const byVendorCode = new Map<string, string>()
  for (const e of entries) if (e.vendorCode && !byVendorCode.has(e.vendorCode)) byVendorCode.set(e.vendorCode, e.barcode)
  return { barcodes: new Set(entries.map((e) => e.barcode)), byVendorCode }
}

/**
 * Штрихкод WB для товара другой площадки. Порядок: штрихкод площадки, который есть у WB;
 * артикул площадки как артикул WB (offer_id Ozon/ЯМ = артикул WB); артикул как штрихкод WB.
 * Не сопоставилось — null: подставить чужой штрихкод значит сделать товар «сиротой» и обнулить его.
 */
export function resolveWbBarcode(index: WbCatalogIndex, item: { barcodes: readonly string[]; sku: string | null }): string | null {
  for (const b of item.barcodes) if (b && index.barcodes.has(b)) return b
  if (item.sku) {
    const byVc = index.byVendorCode.get(item.sku)
    if (byVc) return byVc
    if (index.barcodes.has(item.sku)) return item.sku
  }
  return null
}
