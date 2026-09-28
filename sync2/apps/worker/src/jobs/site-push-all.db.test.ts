import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { drizzleRunStore, loadChannels, savePoolRun, seedChannels, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import { SITE_UNKNOWN_BARCODE, type SendResult, type WriteOp } from "@sync2/platforms"
import type { Channel } from "@sync2/shared"
import { eq } from "drizzle-orm"
import { runSitePushAll } from "./site-push-all"

describe.skipIf(!TEST_DATABASE_URL)("runSitePushAll", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    const rid = "00000000-0000-4000-8000-0000000000c1"
    await insertRun(h.db, rid)
    const item = (barcode: string, base: number) => ({ barcode, base, wbExpected: base, expectedAt: null, wbSnapshotAt: null })
    await savePoolRun(h.db, { runId: rid, items: [item("A", 2), item("B", 0)], events: [] })
    const store = drizzleRunStore(h.db)
    const pid = "00000000-0000-4000-8000-0000000000c2"
    await store.start({ runId: pid, job: "pool", writeMode: "dry-run", startedAt: "2026-09-28T10:01:00.000Z" })
    await store.finish(pid, { status: "ok", finishedAt: "2026-09-28T10:01:01.000Z", counters: { events: 0 }, error: null })
  })
  afterAll(async () => h?.close())

  it("весь пул на сайт — и нули; неизвестные сайту штрихкоды — отдельный счётчик, не ошибка", async () => {
    const send = vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> =>
      ops.map((o) => (o.barcode === "B" ? { barcode: "B", field: "stock", ok: false, error: `${SITE_UNKNOWN_BARCODE} B` } : { barcode: o.barcode, field: "stock", ok: true })),
    )
    const runId = "00000000-0000-4000-8000-0000000000c3"
    await insertRun(h.db, runId)
    const r = await runSitePushAll({ db: h.db, now: () => new Date("2026-09-28T10:05:00.000Z"), runId, globalMode: "apply", send })
    expect(send).toHaveBeenCalledWith("site", [
      { channel: "site", barcode: "A", field: "stock", before: null, after: 2, externalSku: "A" },
      { channel: "site", barcode: "B", field: "stock", before: null, after: 0, externalSku: "B" },
    ])
    expect(r).toEqual({ status: "ok", counters: { sent: 2, applied: 1, siteUnknown: 1, failed: 0 } })
    const site = (await loadChannels(h.db)).get("site")!.id
    expect((await h.db.select().from(writes).where(eq(writes.runId, runId))).every((w) => w.channelId === site && w.mode === "apply")).toBe(true)
  })

  it("глобально не apply — запись не делается, partial с причиной", async () => {
    const send = vi.fn()
    const runId = "00000000-0000-4000-8000-0000000000c5"
    await insertRun(h.db, runId)
    const r = await runSitePushAll({ db: h.db, now: () => new Date("2026-09-28T10:05:00.000Z"), runId, globalMode: "dry-run", send })
    expect(send).not.toHaveBeenCalled()
    expect(r).toMatchObject({ status: "partial", error: expect.stringContaining("SYNC_WRITE_MODE=dry-run") })
  })

  it("пул старше 15 минут — ошибка до записи", async () => {
    const send = vi.fn()
    await expect(
      runSitePushAll({ db: h.db, now: () => new Date("2026-09-28T10:30:00.000Z"), runId: "00000000-0000-4000-8000-0000000000c4", globalMode: "apply", send }),
    ).rejects.toThrow(/пул не пересчитывался последние 15 мин/)
    expect(send).not.toHaveBeenCalled()
  })
})
