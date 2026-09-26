import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { drizzleRunStore } from "./run-store"
import { runs } from "./schema"
import { TEST_DATABASE_URL, freshTestDb } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("drizzleRunStore", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  const runId = "00000000-0000-4000-8000-0000000000b1"

  it("start пишет running, finish закрывает", async () => {
    const store = drizzleRunStore(h.db)
    await store.start({ runId, job: "ping", writeMode: "off", startedAt: "2026-09-26T10:00:00.000Z" })
    let [row] = await h.db.select().from(runs).where(eq(runs.runId, runId))
    expect(row).toMatchObject({ job: "ping", status: "running", writeMode: "off", finishedAt: null })

    await store.finish(runId, {
      status: "partial",
      finishedAt: "2026-09-26T10:00:05.000Z",
      counters: { read: 3, skipped: 1 },
      error: null,
    })
    ;[row] = await h.db.select().from(runs).where(eq(runs.runId, runId))
    expect(row).toMatchObject({ status: "partial", counters: { read: 3, skipped: 1 }, error: null })
    expect(row!.finishedAt).not.toBeNull()
  })

  it("finish по несуществующему запуску — ошибка, а не тихий ноль строк", async () => {
    const store = drizzleRunStore(h.db)
    await expect(
      store.finish("00000000-0000-4000-8000-0000000000ff", {
        status: "ok",
        finishedAt: "2026-09-26T10:00:05.000Z",
        counters: {},
        error: null,
      }),
    ).rejects.toThrow(/не найден/)
  })
})
