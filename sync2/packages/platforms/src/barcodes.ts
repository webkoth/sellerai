// Перенесено из finstock (27.09.2026): packages/platforms/src/barcodes.ts.

/**
 * Карта «артикул продавца → штрихкоды», снятая с каталога площадки
 * (`/v3/product/info/list` у Ozon, `offer-mappings` у Яндекс.Маркета).
 * Заказы и остатки этих площадок баркод не несут — только артикул; баркод,
 * канонический ключ проекта, достаётся отсюда.
 */
export type BarcodeByOffer = ReadonlyMap<string, readonly string[]>

/**
 * Один баркод для строки заказа или остатка. Правило: первый непустой из
 * списка каталога. Оно простое и детерминированное; правильность выбора при
 * нескольких штрихкодах проверяется на живом прогоне сравнением с картой
 * соответствий `sai` (спека, раздел «Решения»), а не угадывается здесь.
 */
export function firstBarcode(barcodes: BarcodeByOffer, offerId: string): string | null {
  const list = barcodes.get(offerId)
  if (!list) return null
  const first = list.find((barcode) => barcode.trim() !== "")
  return first ?? null
}
