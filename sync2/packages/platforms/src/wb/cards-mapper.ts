// Перенесено из finstock (27.09.2026): packages/platforms/src/wb/cards-mapper.ts,
// приведено к WbCatalogEntry sync2. Фото убрано — каталогу синка картинка
// не нужна (её не было и в WbCatalogEntry).
import type { WbCatalogEntry } from "@sync2/shared"
import type { WbCardListItem } from "./client"

/** chrtId размера — целое положительное; иначе это не ключ записи. */
const isChrtId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0

/**
 * Перечень карточек площадки → плоский список по штрихкодам — мастер-каталог
 * WB для всего синка (`buildWbCatalogIndex`/`resolveWbBarcode` в
 * `@sync2/shared`).
 *
 * Строка — штрихкод, а не карточка: остаток и заказ считаются по штрихкоду,
 * карточка с несколькими размерами даёт несколько строк.
 *
 * Пустое название заменяется артикулом: оператору нужно чем-то опознать
 * строку, а `vendorCode` у карточки в живом ответе есть всегда. ПУСТОЙ
 * `vendorCode` при этом пропускается наружу как есть, а не заменяется
 * и не отбрасывается: артикул — дело вызывающей стороны, а маппер не имеет
 * права молча выдумывать за неё ключ.
 *
 * Пустой штрихкод (пустая строка или пробелы) строку не даёт вовсе: штрихкод
 * — канонический ключ каталога, строка без него непригодна и превратилась
 * бы в неопознаваемый мусор.
 */
export function mapCards(items: WbCardListItem[]): WbCatalogEntry[] {
  const result: WbCatalogEntry[] = []

  for (const card of items) {
    const vendorCode = card.vendorCode?.trim() ?? ""
    const title = card.title?.trim() || vendorCode
    const subject = card.subjectName?.trim() || null

    for (const size of card.sizes ?? []) {
      for (const barcode of size.skus ?? []) {
        const trimmed = barcode?.trim()
        if (!trimmed) continue
        result.push({
          nmId: card.nmID ?? null,
          barcode: trimmed,
          vendorCode,
          title,
          subject,
          // chrtId размера — ключ записи остатка WB (этап 1.4); у всех штрихкодов размера один.
          // Только целое положительное: иначе поле не ставим — ключ записи не выдумываем.
          ...(isChrtId(size.chrtID) ? { chrtId: size.chrtID } : {}),
        })
      }
    }
  }

  return result
}
