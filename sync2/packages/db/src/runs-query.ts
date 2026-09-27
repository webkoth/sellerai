import { and, desc, eq, inArray } from "drizzle-orm"
import type { Db } from "./client"
import { runs } from "./schema"

/** Значение счётчика из последнего успешного (ok/partial) запуска джобы; нет — null. */
export async function lastCounter(db: Db, job: string, key: string): Promise<number | null> {
  const [row] = await db
    .select({ counters: runs.counters })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial"])))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  const v = (row?.counters as Record<string, unknown> | undefined)?.[key]
  return typeof v === "number" ? v : null
}
