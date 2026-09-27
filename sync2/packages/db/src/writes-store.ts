import type { Channel, WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import type { ChannelRow } from "./channels"
import { writes } from "./schema"

/** Итог записи по позиции — структурно совместим с WriteOutcome из @sync2/platforms (db от platforms не зависит). */
export interface WriteRecord {
  channel: Channel
  barcode: string
  field: "stock" | "price"
  before: number | null
  after: number
  mode: WriteMode
  applied: boolean
  response: unknown
  error: string | null
}

/** record для executeWrites: пишет журнал writes; пустой список не вставляется (drizzle бросает на .values([])). */
export function drizzleWriteStore(db: Db, runId: string, channelRows: ReadonlyMap<Channel, ChannelRow>) {
  return async (outcomes: WriteRecord[]): Promise<void> => {
    if (outcomes.length === 0) return
    await db.insert(writes).values(
      outcomes.map((o) => {
        const ch = channelRows.get(o.channel)
        if (!ch) throw new Error(`площадки ${o.channel} нет в таблице channels`)
        return { runId, channelId: ch.id, barcode: o.barcode, field: o.field, before: o.before, after: o.after, mode: o.mode, applied: o.applied, response: o.response ?? null, error: o.error }
      }),
    )
  }
}
