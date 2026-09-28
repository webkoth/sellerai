import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { loadChannels } from "./channels"
import { barcodesAppliedSince, pruneJournal, writeStatsSince, writesOfRun } from "./journal"
import { upsertProducts } from "./products"
import { drizzleRunStore } from "./run-store"
import { latestRun } from "./runs-query"
import { stockSnapshotsRaw, writes } from "./schema"
import { insertStockSnapshot } from "./stock-snapshots"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("журнал записей — этап 1.4", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Awaited<ReturnType<typeof loadChannels>>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ids = await loadChannels(h.db)
  })
  afterAll(async () => h?.close())

  it("последний завершённый прогон джобы — id, статус, время ISO, счётчики", async () => {
    const store = drizzleRunStore(h.db)
    for (const [id, at] of [["00000000-0000-4000-8000-0000000000a1", "2026-09-28T10:00:00.000Z"], ["00000000-0000-4000-8000-0000000000a2", "2026-09-28T10:05:00.000Z"]] as const) {
      await store.start({ runId: id, job: "pool", writeMode: "dry-run", startedAt: at })
      await store.finish(id, { status: "ok", finishedAt: at, counters: { events: 1 }, error: null })
    }
    expect(await latestRun(h.db, "pool")).toEqual({
      runId: "00000000-0000-4000-8000-0000000000a2",
      status: "ok",
      startedAt: "2026-09-28T10:05:00.000Z",
      counters: { events: 1 },
    })
    expect(await latestRun(h.db, "нет-такой")).toBeNull()
  })

  it("строки плана прогона — с артикулом и названием из products, по площадке и штрихкоду", async () => {
    const runId = "00000000-0000-4000-8000-0000000000b1"
    await insertRun(h.db, runId)
    await upsertProducts(h.db, [{ barcode: "A", vendorCode: "JW-A", nmId: 1, title: "Браслет", subject: null }])
    await h.db.insert(writes).values([
      { runId, channelId: ids.get("ozon")!.id, barcode: "Z", field: "stock", before: 1, after: 0, mode: "dry-run", applied: false, response: null, error: null, externalSku: "JW-Z" },
      { runId, channelId: ids.get("kit")!.id, barcode: "A", field: "stock", before: 2, after: 3, mode: "apply", applied: false, response: null, error: "таймаут", uncertain: true },
    ])
    expect(await writesOfRun(h.db, runId)).toEqual([
      { channel: "kit", barcode: "A", vendorCode: "JW-A", title: "Браслет", externalSku: null, before: 2, after: 3, mode: "apply", applied: false, uncertain: true, error: "таймаут" },
      { channel: "ozon", barcode: "Z", vendorCode: null, title: null, externalSku: "JW-Z", before: 1, after: 0, mode: "dry-run", applied: false, uncertain: false, error: null },
    ])
  })

  it("статистика записей apply за период по площадкам и повторные записи одного баркода", async () => {
    const runId = "00000000-0000-4000-8000-0000000000d1"
    await insertRun(h.db, runId)
    await insertRun(h.db, "00000000-0000-4000-8000-0000000000c9")
    const ozon = ids.get("ozon")!.id
    const at = (m: number) => `2026-09-20T10:0${m}:00.000Z`
    await h.db.insert(writes).values([
      { runId, channelId: ozon, barcode: "R", field: "stock", before: 1, after: 2, mode: "apply", applied: true, response: null, error: null, createdAt: at(1) },
      { runId: "00000000-0000-4000-8000-0000000000b1", channelId: ozon, barcode: "R", field: "stock", before: 1, after: 2, mode: "apply", applied: true, response: null, error: null, createdAt: at(2) },
      { runId: "00000000-0000-4000-8000-0000000000c9", channelId: ozon, barcode: "R", field: "stock", before: 1, after: 2, mode: "apply", applied: true, response: null, error: null, createdAt: at(3) },
      { runId, channelId: ozon, barcode: "E", field: "stock", before: 1, after: 0, mode: "apply", applied: false, response: null, error: "409", createdAt: at(4) },
      { runId, channelId: ozon, barcode: "D", field: "stock", before: 1, after: 0, mode: "dry-run", applied: false, response: null, error: null, createdAt: at(5) },
    ])
    const stats = await writeStatsSince(h.db, "2026-09-20T00:00:00.000Z")
    expect(stats.ozon).toEqual({ applied: 3, failed: 1, barcodes: 2, repeated: [{ barcode: "R", times: 3 }] })
    expect(stats.wb).toEqual({ applied: 0, failed: 0, barcodes: 0, repeated: [] })
    expect(await barcodesAppliedSince(h.db, ozon, at(2))).toEqual(new Set(["R"]))
  })

  it("ретенция: план (off/dry-run) — 14 дней, apply — 90, снимки — 7, последний снимок площадки остаётся всегда", async () => {
    const runId = "00000000-0000-4000-8000-0000000000e1"
    await insertRun(h.db, runId)
    const kit = ids.get("kit")!.id
    const wb = ids.get("wb")!.id
    const row = (barcode: string, mode: "dry-run" | "apply", createdAt: string) => ({ runId, channelId: kit, barcode, field: "stock", before: 0, after: 1, mode, applied: false, response: null, error: null, createdAt })
    await h.db.insert(writes).values([row("P1", "dry-run", "2026-09-10T00:00:00.000Z"), row("P2", "dry-run", "2026-09-20T00:00:00.000Z"), row("P3", "apply", "2026-06-20T00:00:00.000Z"), row("P4", "apply", "2026-09-01T00:00:00.000Z")])
    for (const at of ["2026-09-10T00:00:00.000Z", "2026-09-15T00:00:00.000Z", "2026-09-27T00:00:00.000Z"]) await insertStockSnapshot(h.db, { channelId: kit, runId, takenAt: at, stocks: [] })
    await insertStockSnapshot(h.db, { channelId: wb, runId, takenAt: "2026-09-10T00:00:00.000Z", stocks: [] })
    expect(await pruneJournal(h.db, "2026-09-28T00:00:00.000Z")).toEqual({ writesPlan: 1, writesApply: 1, snapshots: 2 })
    const left = (await h.db.select({ barcode: writes.barcode }).from(writes).where(eq(writes.runId, runId))).map((r) => r.barcode).sort()
    expect(left).toEqual(["P2", "P4"])
    expect((await h.db.select().from(stockSnapshotsRaw)).map((s) => [s.channelId, s.takenAt.slice(0, 10)]).sort()).toEqual(
      [
        [wb, "2026-09-10"],
        [kit, "2026-09-27"],
      ].sort(),
    )
  })
})
