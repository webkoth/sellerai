import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadChannels } from "./channels"
import { seedChannels } from "./channels-seed"
import { drizzleRunStore } from "./run-store"
import { countFailedRunsSince, countStuckRunsSince, lastRunWithCounterAt, lastRunStatus, plannedWritesSince, sameStatusStreak } from "./runs-query"
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
      // Режим off — не план dry-run, в сводку не попадает.
      { channel: "ym", barcode: "A", field: "stock", before: 3, after: 2, mode: "off", applied: false, response: null, error: null },
    ])
    // Тот же баркод в следующем прогоне (план держится, пока зеркало не выровняли) — строк больше, баркодов столько же.
    const runId2 = "00000000-0000-4000-8000-0000000000f6"
    await insertRun(h.db, runId2)
    await drizzleWriteStore(h.db, runId2, ids)([
      { channel: "ozon", barcode: "A", field: "stock", before: 2, after: 1, mode: "dry-run", applied: false, response: null, error: null },
    ])
    const planned = await plannedWritesSince(h.db, "2026-09-01T00:00:00.000Z")
    expect(planned).toMatchObject({
      ozon: { barcodes: 2, rows: 3 },
      kit: { barcodes: 1, rows: 1 },
      ym: { barcodes: 0, rows: 0 },
      wb: { barcodes: 0, rows: 0 },
      site: { barcodes: 0, rows: 0 },
    })
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
  const run = async (job: string, id: string, at: string, status: "running" | "ok" | "partial" | "failed", counters: Record<string, number> = {}) => {
    const store = drizzleRunStore(h.db)
    const runId = `00000000-0000-4000-8000-${id.padStart(12, "0")}`
    await store.start({ runId, job, writeMode: "dry-run", startedAt: at })
    if (status !== "running") await store.finish(runId, { status, finishedAt: at, counters, error: null })
  }

  it("статус последнего запуска: из нескольких побеждает последний по времени, running пропускается", async () => {
    await run("streak", "a1", "2026-09-27T10:00:00.000Z", "ok")
    await run("streak", "a2", "2026-09-27T10:20:00.000Z", "failed")
    await run("streak", "a3", "2026-09-27T10:10:00.000Z", "partial")
    await run("streak", "a4", "2026-09-27T10:30:00.000Z", "running")
    expect(await lastRunStatus(h.db, "streak")).toBe("failed")
  })

  it("серия: завершённые прогоны подряд с тем же статусом, считая от последнего; partial и failed не смешиваются", async () => {
    expect(await sameStatusStreak(h.db, "нет-такой-джобы", "failed")).toBe(0)
    // a1 ok 10:00, a3 partial 10:10, a2 failed 10:20, a4 running 10:30 (не в счёт).
    expect(await sameStatusStreak(h.db, "streak", "failed")).toBe(1)
    await run("streak", "a5", "2026-09-27T10:40:00.000Z", "failed")
    expect(await sameStatusStreak(h.db, "streak", "failed")).toBe(2)
    // Качели: partial после failed — серия partial начинается заново, a3 не в счёт.
    await run("streak", "a6", "2026-09-27T10:50:00.000Z", "partial")
    expect(await sameStatusStreak(h.db, "streak", "partial")).toBe(1)
    await run("streak", "a7", "2026-09-27T11:00:00.000Z", "partial")
    expect(await sameStatusStreak(h.db, "streak", "partial")).toBe(2)
    // Последний прогон — не этого статуса: серии нет.
    expect(await sameStatusStreak(h.db, "streak", "failed")).toBe(0)
    // Другая джоба не мешает.
    await run("other", "a8", "2026-09-27T11:05:00.000Z", "partial")
    expect(await sameStatusStreak(h.db, "other", "partial")).toBe(1)
    expect(await sameStatusStreak(h.db, "streak", "partial")).toBe(2)
  })

  it("время последнего завершённого прогона с ключом счётчика: partial с events в счёт, partial с noFreshWb — нет", async () => {
    expect(await lastRunWithCounterAt(h.db, "pool", "events")).toBeNull()
    await run("pool", "c1", "2026-09-27T10:00:00.000Z", "ok", { events: 2 })
    // Пул пересчитан, но план упёрся в предохранитель — partial, events есть.
    await run("pool", "c2", "2026-09-27T10:10:00.000Z", "partial", { events: 0, aborted_to_zero: 25 })
    // Снимка WB нет — пул не пересчитан.
    await run("pool", "c3", "2026-09-27T10:20:00.000Z", "partial", { noFreshWb: 1 })
    // Упавший и открытый — не в счёт, даже с ключом.
    await run("pool", "c4", "2026-09-27T10:30:00.000Z", "failed", { events: 1 })
    await run("pool", "c5", "2026-09-27T11:45:00.000Z", "running")
    expect(await lastRunWithCounterAt(h.db, "pool", "events")).toBe("2026-09-27T10:10:00.000Z")
  })

  it("зависшие прогоны: running старше порога в окне; свежий running и закрытые — нет", async () => {
    await run("hang", "b1", "2026-09-27T09:00:00.000Z", "running")
    await run("hang", "b2", "2026-09-27T11:50:00.000Z", "running")
    await run("hang", "b3", "2026-09-26T09:00:00.000Z", "running")
    // Окно с 2026-09-27 00:00; зависшим считается running, начатый раньше 11:30.
    // a4 (streak, 10:30, running) — тоже зависший.
    expect(await countStuckRunsSince(h.db, "2026-09-27T00:00:00.000Z", "2026-09-27T11:30:00.000Z")).toBe(2)
  })
})
