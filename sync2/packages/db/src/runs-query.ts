import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm"
import { CHANNELS, isChannel, type Channel } from "@sync2/shared"
import type { Db } from "./client"
import { channels, runs, writes } from "./schema"

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
 * Число завершённых не-ok (partial/failed) запусков джобы после её последнего ok
 * (ok ни разу не было — все её не-ok). Открытые (`running`) не считаются.
 * Для напоминаний о затянувшемся сбое — см. decideNotification в worker.
 */
export async function nonOkStreak(db: Db, job: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(runs)
    .where(
      and(
        eq(runs.job, job),
        inArray(runs.status, ["partial", "failed"]),
        sql`${runs.startedAt} > coalesce((select max(r.started_at) from runs r where r.job = ${job} and r.status = 'ok'), '-infinity'::timestamptz)`,
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

/** Число запланированных записей (строк `writes`) начиная с sinceIso, по площадкам; без строк — 0. */
export async function plannedWritesSince(db: Db, sinceIso: string): Promise<Record<Channel, number>> {
  const out = Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<Channel, number>
  const rows = await db
    .select({ code: channels.code, n: count() })
    .from(writes)
    .innerJoin(channels, eq(writes.channelId, channels.id))
    .where(gte(writes.createdAt, sinceIso))
    .groupBy(channels.code)
  for (const r of rows) if (isChannel(r.code)) out[r.code] = r.n
  return out
}
