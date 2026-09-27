import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadChannels } from "./channels"
import { seedChannels } from "./channels-seed"
import { drizzleRunStore } from "./run-store"
import { countFailedRunsSince, lastRunStatus, nonOkStreak, plannedWritesSince } from "./runs-query"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"
import { drizzleWriteStore } from "./writes-store"

describe.skipIf(!TEST_DATABASE_URL)("runs-query: сводка compare-v1 и статус запуска", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => h?.close())

  it("упавшие запуски за период — считает только failed", async () => {
    const store = drizzleRunStore(h.db)
    for (const [id, status] of [
      ["00000000-0000-4000-8000-0000000000f1", "failed"],
      ["00000000-0000-4000-8000-0000000000f2", "ok"],
      ["00000000-0000-4000-8000-0000000000f3", "failed"],
    ] as const) {
      await store.start({ runId: id, job: "ingest", writeMode: "dry-run", startedAt: "2026-09-27T09:00:00.000Z" })
      await store.finish(id, { status, finishedAt: "2026-09-27T09:05:00.000Z", counters: {}, error: status === "failed" ? "бум" : null })
    }
    expect(await countFailedRunsSince(h.db, "2026-09-27T00:00:00.000Z")).toBe(2)
    expect(await countFailedRunsSince(h.db, "2026-09-28T00:00:00.000Z")).toBe(0)
  })

  it("запланированные записи за период — по площадкам, площадка без строк — 0", async () => {
    const runId = "00000000-0000-4000-8000-0000000000f4"
    await insertRun(h.db, runId)
    const ids = await loadChannels(h.db)
    const record = drizzleWriteStore(h.db, runId, ids)
    await record([
      { channel: "ozon", barcode: "A", field: "stock", before: 2, after: 1, mode: "dry-run", applied: false, response: null, error: null },
      { channel: "ozon", barcode: "B", field: "stock", before: 1, after: 0, mode: "dry-run", applied: false, response: null, error: null },
      { channel: "kit", barcode: "A", field: "stock", before: 3, after: 2, mode: "dry-run", applied: false, response: null, error: null },
    ])
    const planned = await plannedWritesSince(h.db, "2026-09-01T00:00:00.000Z")
    expect(planned).toMatchObject({ ozon: 2, kit: 1, ym: 0, wb: 0, site: 0 })
  })

  it("статус последнего завершённого запуска джобы; ни одного — null", async () => {
    expect(await lastRunStatus(h.db, "нет-такой-джобы")).toBeNull()
    const store = drizzleRunStore(h.db)
    const runId = "00000000-0000-4000-8000-0000000000f5"
    await store.start({ runId, job: "pool", writeMode: "dry-run", startedAt: "2026-09-27T09:10:00.000Z" })
    await store.finish(runId, { status: "partial", finishedAt: "2026-09-27T09:11:00.000Z", counters: {}, error: null })
    expect(await lastRunStatus(h.db, "pool")).toBe("partial")
  })

  /** Запуск джобы в журнале; status "running" — открыт и не закрыт (идёт или убит). */
  const run = async (job: string, id: string, at: string, status: "running" | "ok" | "partial" | "failed") => {
    const store = drizzleRunStore(h.db)
    const runId = `00000000-0000-4000-8000-${id.padStart(12, "0")}`
    await store.start({ runId, job, writeMode: "dry-run", startedAt: at })
    if (status !== "running") await store.finish(runId, { status, finishedAt: at, counters: {}, error: null })
  }

  it("статус последнего запуска: из нескольких побеждает последний по времени, running пропускается", async () => {
    await run("streak", "a1", "2026-09-27T10:00:00.000Z", "ok")
    await run("streak", "a2", "2026-09-27T10:20:00.000Z", "failed")
    await run("streak", "a3", "2026-09-27T10:10:00.000Z", "partial")
    await run("streak", "a4", "2026-09-27T10:30:00.000Z", "running")
    expect(await lastRunStatus(h.db, "streak")).toBe("failed")
  })

  it("серия не-ok: завершённые прогоны после последнего ok; running не считается; другие джобы — тоже", async () => {
    expect(await nonOkStreak(h.db, "нет-такой-джобы")).toBe(0)
    // После a1 (ok): a3 partial, a2 failed; a4 running не в счёт.
    expect(await nonOkStreak(h.db, "streak")).toBe(2)
    await run("streak", "a5", "2026-09-27T10:40:00.000Z", "ok")
    expect(await nonOkStreak(h.db, "streak")).toBe(0)
    await run("streak", "a6", "2026-09-27T10:50:00.000Z", "partial")
    await run("other", "a7", "2026-09-27T10:55:00.000Z", "failed")
    expect(await nonOkStreak(h.db, "streak")).toBe(1)
    // Ни одного ok — все не-ok подряд.
    expect(await nonOkStreak(h.db, "other")).toBe(1)
  })
})
