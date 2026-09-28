import { and, asc, desc, eq, gt, gte, inArray, lt, notInArray } from "drizzle-orm"
import { CHANNELS, isChannel, parseWriteMode, type Channel, type WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import { channels, products, stockSnapshotsRaw, writes } from "./schema"

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

/** Записи apply одной площадки за период. */
export interface WriteStats {
  applied: number
  failed: number
  /** Разных штрихкодов среди записей. */
  barcodes: number
  /** Штрихкоды, применённые не меньше REPEATED_WRITES_MIN раз, — запись «не держится». */
  repeated: Array<{ barcode: string; times: number }>
}

export const REPEATED_WRITES_MIN = 3

/** Статистика записей apply с sinceIso по площадкам — для суточной сводки drift. */
export async function writeStatsSince(db: Db, sinceIso: string): Promise<Record<Channel, WriteStats>> {
  const empty = (): WriteStats => ({ applied: 0, failed: 0, barcodes: 0, repeated: [] })
  const out = Object.fromEntries(CHANNELS.map((c) => [c, empty()])) as Record<Channel, WriteStats>
  const rows = await db
    .select({ code: channels.code, barcode: writes.barcode, applied: writes.applied })
    .from(writes)
    .innerJoin(channels, eq(writes.channelId, channels.id))
    .where(and(eq(writes.mode, "apply"), gte(writes.createdAt, sinceIso)))
  const seen = new Map<Channel, Set<string>>()
  const appliedTimes = new Map<Channel, Map<string, number>>()
  for (const r of rows) {
    if (!isChannel(r.code)) continue
    const stats = out[r.code]
    const set = seen.get(r.code) ?? new Set<string>()
    set.add(r.barcode)
    seen.set(r.code, set)
    if (!r.applied) {
      stats.failed++
      continue
    }
    stats.applied++
    const times = appliedTimes.get(r.code) ?? new Map<string, number>()
    times.set(r.barcode, (times.get(r.barcode) ?? 0) + 1)
    appliedTimes.set(r.code, times)
  }
  for (const [c, set] of seen) out[c].barcodes = set.size
  for (const [c, times] of appliedTimes) {
    out[c].repeated = [...times]
      .filter(([, n]) => n >= REPEATED_WRITES_MIN)
      .map(([barcode, n]) => ({ barcode, times: n }))
      .sort((a, b) => b.times - a.times || (a.barcode < b.barcode ? -1 : 1))
  }
  return out
}

/** Штрихкоды площадки, применённые после момента sinceIso: запись «в пути» — снимок её ещё не видел. */
export async function barcodesAppliedSince(db: Db, channelId: number, sinceIso: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ barcode: writes.barcode })
    .from(writes)
    .where(and(eq(writes.channelId, channelId), eq(writes.mode, "apply"), eq(writes.applied, true), gt(writes.createdAt, sinceIso)))
  return new Set(rows.map((r) => r.barcode))
}

/** Строки плана (off/dry-run) — пишутся каждым тиком, пока площадка не выровнена. */
export const WRITES_KEEP_PLAN_DAYS = 14
/** Настоящие записи — дольше: разбор споров с площадкой. */
export const WRITES_KEEP_APPLY_DAYS = 90
/** Снимки остатков: нужен только последний; неделя — для разбора. */
export const SNAPSHOTS_KEEP_DAYS = 7

/**
 * Ретенция журнала (решение 5 плана 1.4). Последний снимок каждой площадки не удаляется никогда,
 * даже старый: по нему pool и drift видят площадку. Прогоны (`runs`) не удаляются — на них ссылаются
 * события пула и заказы.
 */
export async function pruneJournal(db: Db, nowIso: string): Promise<{ writesPlan: number; writesApply: number; snapshots: number }> {
  const before = (days: number) => new Date(Date.parse(nowIso) - days * 86_400_000).toISOString()
  const plan = await db
    .delete(writes)
    .where(and(inArray(writes.mode, ["off", "dry-run"]), lt(writes.createdAt, before(WRITES_KEEP_PLAN_DAYS))))
    .returning({ id: writes.id })
  const apply = await db
    .delete(writes)
    .where(and(eq(writes.mode, "apply"), lt(writes.createdAt, before(WRITES_KEEP_APPLY_DAYS))))
    .returning({ id: writes.id })
  const latest = db
    .selectDistinctOn([stockSnapshotsRaw.channelId], { id: stockSnapshotsRaw.id })
    .from(stockSnapshotsRaw)
    .orderBy(stockSnapshotsRaw.channelId, desc(stockSnapshotsRaw.takenAt))
  const snaps = await db
    .delete(stockSnapshotsRaw)
    .where(and(lt(stockSnapshotsRaw.takenAt, before(SNAPSHOTS_KEEP_DAYS)), notInArray(stockSnapshotsRaw.id, latest)))
    .returning({ id: stockSnapshotsRaw.id })
  return { writesPlan: plan.length, writesApply: apply.length, snapshots: snaps.length }
}
