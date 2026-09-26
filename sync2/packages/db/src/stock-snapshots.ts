import { desc } from "drizzle-orm"
import type { NormalizedStock } from "@sync2/shared"
import type { Db } from "./client"
import { stockSnapshotsRaw } from "./schema"
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
  return new Map(rows.map((r) => [r.channelId, { takenAt: toIso(r.takenAt), stocks: r.stocks as NormalizedStock[] }]))
}
