import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { loadChannels } from "./channels"
import { writesOfRun } from "./journal"
import { upsertProducts } from "./products"
import { drizzleRunStore } from "./run-store"
import { latestRun } from "./runs-query"
import { writes } from "./schema"
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
})
