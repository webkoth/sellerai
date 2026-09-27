import { count, sql } from "drizzle-orm"
import type { WbCatalogEntry } from "@sync2/shared"
import type { Db } from "./client"
import { products } from "./schema"

/** Каталог WB → справочник товаров. Дубли штрихкода в одном каталоге схлопываются (побеждает последний). */
export async function upsertProducts(db: Db, entries: WbCatalogEntry[]): Promise<number> {
  const byBarcode = new Map(entries.map((e) => [e.barcode, e]))
  if (byBarcode.size === 0) return 0
  await db
    .insert(products)
    .values([...byBarcode.values()].map((e) => ({ barcode: e.barcode, vendorCode: e.vendorCode, nmId: e.nmId, title: e.title, wbSubject: e.subject })))
    .onConflictDoUpdate({
      target: products.barcode,
      set: {
        vendorCode: sql`excluded.vendor_code`,
        nmId: sql`excluded.nm_id`,
        title: sql`excluded.title`,
        wbSubject: sql`excluded.wb_subject`,
        updatedAt: sql`now()`,
      },
    })
  return byBarcode.size
}

export async function countProducts(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(products)
  return row?.n ?? 0
}
