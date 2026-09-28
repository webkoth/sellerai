import { desc, eq, gte } from "drizzle-orm"
import { isChannel, type Channel, type NormalizedStock } from "@sync2/shared"
import type { Db } from "./client"
import { channels, stockSnapshotsRaw } from "./schema"
import { toIso } from "./time"

export interface StockSnapshotInput {
  channelId: number
  runId: string
  takenAt: string
  stocks: NormalizedStock[]
}

/** Снимок только дописывается; повтор с тем же моментом отсечёт уникальный индекс. */
export async function insertStockSnapshot(db: Db, snap: StockSnapshotInput): Promise<void> {
  await db.insert(stockSnapshotsRaw).values(snap)
}

/** Последний снимок каждой площадки: channelId → { takenAt (ISO), stocks }. */
export async function latestStockSnapshots(db: Db): Promise<Map<number, { takenAt: string; stocks: NormalizedStock[] }>> {
  const rows = await db
    .selectDistinctOn([stockSnapshotsRaw.channelId], {
      channelId: stockSnapshotsRaw.channelId,
      takenAt: stockSnapshotsRaw.takenAt,
      stocks: stockSnapshotsRaw.stocks,
    })
    .from(stockSnapshotsRaw)
    .orderBy(stockSnapshotsRaw.channelId, desc(stockSnapshotsRaw.takenAt))
  return new Map(rows.map((r) => [r.channelId, { takenAt: toIso(r.takenAt), stocks: r.stocks }]))
}

/** Площадки, у которых есть снимок не раньше sinceIso, — по коду (сводка: подключён ли сайт). */
export async function channelsWithSnapshotSince(db: Db, sinceIso: string): Promise<Set<Channel>> {
  const rows = await db
    .selectDistinct({ code: channels.code })
    .from(stockSnapshotsRaw)
    .innerJoin(channels, eq(stockSnapshotsRaw.channelId, channels.id))
    .where(gte(stockSnapshotsRaw.takenAt, sinceIso))
  return new Set(rows.map((r) => r.code).filter(isChannel))
}
