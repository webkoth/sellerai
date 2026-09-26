import type { NormalizedStock } from "@sync2/shared"

/** Остаток по баркоду после агрегации нескольких строк снимка. */
export interface AggregatedStock {
  vendorCode: string | null
  quantity: number
}

/**
 * Складывает строки снимка остатков в остаток по баркоду: несколько строк
 * одного баркода на разных складах площадки — обычное дело. Артикул берётся
 * из первой строки, где он не null. Ноль и минус не отфильтровываются —
 * «лежит на складе» решает вызывающий код. Перенесено из finstock
 * (packages/domain/src/warehouse.ts) без изменений поведения.
 */
export function aggregateStockByBarcode(stocks: NormalizedStock[]): Map<string, AggregatedStock> {
  const byBarcode = new Map<string, AggregatedStock>()
  for (const stock of stocks) {
    const existing = byBarcode.get(stock.barcode)
    if (existing) {
      existing.quantity += stock.quantity
      if (existing.vendorCode === null) existing.vendorCode = stock.externalSku
    } else {
      byBarcode.set(stock.barcode, { vendorCode: stock.externalSku, quantity: stock.quantity })
    }
  }
  return byBarcode
}
