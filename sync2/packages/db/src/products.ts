import { count, isNotNull, sql } from "drizzle-orm"
import type { WbCatalogEntry } from "@sync2/shared"
import type { Db } from "./client"
import { products } from "./schema"

/**
 * Каталог WB → справочник товаров. Дубли штрихкода в одном каталоге схлопываются (побеждает последний).
 * chrtId: каталог без него (не карточки WB) не затирает уже известный — coalesce.
 */
export async function upsertProducts(db: Db, entries: WbCatalogEntry[]): Promise<number> {
  const byBarcode = new Map(entries.map((e) => [e.barcode, e]))
  if (byBarcode.size === 0) return 0
  await db
    .insert(products)
    .values(
      [...byBarcode.values()].map((e) => ({
        barcode: e.barcode,
        vendorCode: e.vendorCode,
        nmId: e.nmId,
        title: e.title,
        wbSubject: e.subject,
        wbChrtId: e.chrtId ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: products.barcode,
      set: {
        vendorCode: sql`excluded.vendor_code`,
        nmId: sql`excluded.nm_id`,
        title: sql`excluded.title`,
        wbSubject: sql`excluded.wb_subject`,
        wbChrtId: sql`coalesce(excluded.wb_chrt_id, products.wb_chrt_id)`,
        updatedAt: sql`now()`,
      },
    })
  return byBarcode.size
}

export async function countProducts(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(products)
  return row?.n ?? 0
}

/** Штрихкод WB → chrtId размера: ключ записи остатка WB (pool.ts, этап 1.4). Без chrtId — не в карте. */
export async function loadWbChrtIds(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ barcode: products.barcode, chrtId: products.wbChrtId }).from(products).where(isNotNull(products.wbChrtId))
  const out = new Map<string, number>()
  for (const r of rows) if (r.chrtId !== null) out.set(r.barcode, r.chrtId)
  return out
}
