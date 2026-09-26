import { eq } from "drizzle-orm"
import type { RunStore } from "@sync2/shared"
import type { Db } from "./client"
import { runs } from "./schema"

export function drizzleRunStore(db: Db): RunStore {
  return {
    async start(r) {
      await db.insert(runs).values({ ...r, status: "running" })
    },
    async finish(runId, r) {
      const updated = await db.update(runs).set(r).where(eq(runs.runId, runId)).returning({ runId: runs.runId })
      if (updated.length === 0) throw new Error(`запуск ${runId} не найден в журнале`)
    },
  }
}
