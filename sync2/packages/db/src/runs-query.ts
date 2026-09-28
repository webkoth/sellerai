import { and, count, countDistinct, desc, eq, gte, inArray, lt, max, sql } from "drizzle-orm"
import { CHANNELS, isChannel, type Channel, type WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import { channels, runs, writes } from "./schema"
import { toIsoOrNull } from "./time"

/**
 * Значение счётчика из последнего успешного (ok/partial) запуска джобы, в счётчиках
 * которого этот ключ есть; нет такого — null. Запуски без ключа пропускаются: так
 * `wbCatalogAccepted` пишется только принятым каталогом, и отклонённый прогон не
 * становится эталоном для следующего.
 */
export async function lastCounter(db: Db, job: string, key: string): Promise<number | null> {
  const [row] = await db
    .select({ counters: runs.counters })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial"]), sql`${runs.counters} ->> ${key} is not null`))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  const v = (row?.counters as Record<string, unknown> | undefined)?.[key]
  return typeof v === "number" ? v : null
}

/**
 * Счётчики последнего завершённого (ok/partial) запуска джобы; ни одного — null. pool (этап 1.4)
 * читает из последнего ingest сбои заказов, отклонённый каталог и источник витрины сайта.
 */
export async function lastRunCounters(db: Db, job: string): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({ counters: runs.counters })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial"])))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  return (row?.counters as Record<string, unknown> | undefined) ?? null
}

/** Сколько последних прогонов просматривает counterStreak — с запасом больше суток при тике раз в 5 минут. */
const STREAK_SCAN_RUNS = 1000

/**
 * Серия: сколько последних завершённых (ok/partial) прогонов джобы подряд несут счётчик key > 0 —
 * от самого последнего назад до первого без него. failed (счётчиков нет — прогон упал) и running
 * серию не прерывают и не считаются. Для «запись площадки не проходит N тиков подряд» (этап 1.4).
 */
export async function counterStreak(db: Db, job: string, key: string): Promise<number> {
  const rows = await db
    .select({ counters: runs.counters })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial"])))
    .orderBy(desc(runs.startedAt))
    .limit(STREAK_SCAN_RUNS)
  let n = 0
  for (const r of rows) {
    const v = (r.counters as Record<string, unknown> | null)?.[key]
    if (typeof v !== "number" || v <= 0) break
    n++
  }
  return n
}

export interface RunInfo {
  runId: string
  status: string
  /** ISO 8601. */
  startedAt: string
  counters: Record<string, unknown>
}

/** Последний завершённый (ok/partial/failed) запуск джобы; ни одного — null. */
export async function latestRun(db: Db, job: string): Promise<RunInfo | null> {
  const [row] = await db
    .select({ runId: runs.runId, status: runs.status, startedAt: runs.startedAt, counters: runs.counters })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial", "failed"])))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  if (!row) return null
  return { runId: row.runId, status: row.status, startedAt: toIsoOrNull(row.startedAt)!, counters: (row.counters as Record<string, unknown> | null) ?? {} }
}

/** Статус последнего завершённого (ok/partial/failed) запуска джобы; ни одного — null. */
export async function lastRunStatus(db: Db, job: string): Promise<"ok" | "partial" | "failed" | null> {
  const [row] = await db
    .select({ status: runs.status })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial", "failed"])))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  return (row?.status as "ok" | "partial" | "failed" | undefined) ?? null
}

/**
 * Серия: сколько последних завершённых (ok/partial/failed) запусков джобы подряд
 * имеют статус status — от самого последнего назад до первого с другим статусом.
 * Последний запуск не этого статуса — 0. Открытые (`running`) не считаются и серию
 * не прерывают. partial и failed — разные серии: напоминание о затянувшемся сбое
 * (decideNotification в worker) считает прогоны одного и того же состояния.
 */
export async function sameStatusStreak(db: Db, job: string, status: "ok" | "partial" | "failed"): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(runs)
    .where(
      and(
        eq(runs.job, job),
        eq(runs.status, status),
        sql`${runs.startedAt} > coalesce((select max(r.started_at) from runs r where r.job = ${job} and r.status in ('ok', 'partial', 'failed') and r.status <> ${status}), '-infinity'::timestamptz)`,
      ),
    )
  return row?.n ?? 0
}

/** Число запусков со статусом failed начиная с sinceIso — для сводки compare-v1. */
export async function countFailedRunsSince(db: Db, sinceIso: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(runs)
    .where(and(eq(runs.status, "failed"), gte(runs.startedAt, sinceIso)))
  return row?.n ?? 0
}

/** План записей по площадке: разных баркодов и строк журнала `writes`. */
export interface PlannedWrites {
  barcodes: number
  rows: number
}

/**
 * План записей начиная с sinceIso, по площадкам; без строк — нули. По умолчанию
 * только dry-run; ["off"] — план площадок с выключенной записью (сайт в 1.3c):
 * это расхождение их остатка с пулом, а не записи. Главное число — разные
 * баркоды: пока площадку не выровняли, одна и та же запись планируется каждым
 * тиком, и строк за сутки в разы больше, чем изменений.
 */
export async function plannedWritesSince(
  db: Db,
  sinceIso: string,
  modes: readonly WriteMode[] = ["dry-run"],
): Promise<Record<Channel, PlannedWrites>> {
  const out = Object.fromEntries(CHANNELS.map((c) => [c, { barcodes: 0, rows: 0 }])) as Record<Channel, PlannedWrites>
  const rows = await db
    .select({ code: channels.code, barcodes: countDistinct(writes.barcode), rows: count() })
    .from(writes)
    .innerJoin(channels, eq(writes.channelId, channels.id))
    .where(and(gte(writes.createdAt, sinceIso), inArray(writes.mode, [...modes])))
    .groupBy(channels.code)
  for (const r of rows) if (isChannel(r.code)) out[r.code] = { barcodes: r.barcodes, rows: r.rows }
  return out
}

/**
 * Начало последнего завершённого (ok/partial) прогона джобы, в счётчиках которого
 * есть key (ISO); ни одного — null. Для pool ключ `events` значит «пул пересчитан»:
 * partial из-за предохранителя плана или ошибок записи пул пересчитал, а partial без
 * свежего снимка WB (`noFreshWb`) — нет.
 */
export async function lastRunWithCounterAt(db: Db, job: string, key: string): Promise<string | null> {
  const [row] = await db
    .select({ at: max(runs.startedAt) })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial"]), sql`${runs.counters} ->> ${key} is not null`))
  return toIsoOrNull(row?.at ?? null)
}

/**
 * «Зависшие» прогоны: начаты с sinceIso, но раньше startedBeforeIso и до сих пор
 * `running` — процесс убит (OOM-киллер, перезагрузка) и закрывающей записи не будет.
 */
export async function countStuckRunsSince(db: Db, sinceIso: string, startedBeforeIso: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(runs)
    .where(and(eq(runs.status, "running"), gte(runs.startedAt, sinceIso), lt(runs.startedAt, startedBeforeIso)))
  return row?.n ?? 0
}
