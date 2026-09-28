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

/**
 * Штрихкоды, которые в снимке площадки стоят на нескольких РАЗНЫХ ключах площадки (offer_id Ozon,
 * offerId ЯМ, id варианта KIT): штрихкод → ключи по порядку снимка. aggregateStockByBarcode берёт ключ
 * первой строки, и запись ушла бы только в первый товар, а второй сохранил бы свой остаток — площадка
 * продавала бы больше пула, и запись «не сходилась» бы каждый тик (ревью ядра 1.4, I3).
 */
export function barcodesWithSeveralKeys(stocks: NormalizedStock[]): Map<string, string[]> {
  const keys = new Map<string, string[]>()
  for (const s of stocks) {
    if (s.externalSku === null) continue
    const list = keys.get(s.barcode) ?? []
    if (!list.includes(s.externalSku)) list.push(s.externalSku)
    keys.set(s.barcode, list)
  }
  return new Map([...keys].filter(([, list]) => list.length > 1))
}
