import { asc, eq } from "drizzle-orm"
import { isChannel, parseWriteMode, type Channel, type WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import { channels, products, writes } from "./schema"

/** Строка плана/записи прогона — для `plan` и предпросмотра `write-mode … apply` (этап 1.4). */
export interface WriteRow {
  channel: Channel
  barcode: string
  vendorCode: string | null
  title: string | null
  /** Ключ товара на площадке, по которому шла (или пошла бы) запись. */
  externalSku: string | null
  before: number | null
  after: number
  mode: WriteMode
  applied: boolean
  /** Итог записи неизвестен (запись могла примениться). */
  uncertain: boolean
  error: string | null
}

/** Все записи прогона по площадке и штрихкоду, с артикулом и названием товара (для глаз владельца). */
export async function writesOfRun(db: Db, runId: string): Promise<WriteRow[]> {
  const rows = await db
    .select({
      code: channels.code,
      barcode: writes.barcode,
      vendorCode: products.vendorCode,
      title: products.title,
      externalSku: writes.externalSku,
      before: writes.before,
      after: writes.after,
      mode: writes.mode,
      applied: writes.applied,
      uncertain: writes.uncertain,
      error: writes.error,
    })
    .from(writes)
    .innerJoin(channels, eq(writes.channelId, channels.id))
    .leftJoin(products, eq(products.barcode, writes.barcode))
    .where(eq(writes.runId, runId))
    .orderBy(asc(channels.code), asc(writes.barcode))
  const out: WriteRow[] = []
  for (const r of rows) {
    if (!isChannel(r.code)) continue
    out.push({
      channel: r.code,
      barcode: r.barcode,
      vendorCode: r.vendorCode,
      title: r.title,
      externalSku: r.externalSku,
      before: r.before,
      after: r.after,
      mode: parseWriteMode(r.mode, "off"),
      applied: r.applied,
      uncertain: r.uncertain,
      error: r.error,
    })
  }
  return out
}
