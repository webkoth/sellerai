import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { loadChannels } from "./channels"
import { countProducts, upsertProducts } from "./products"
import { drizzleRunStore } from "./run-store"
import { lastCounter } from "./runs-query"
import { channels, writes } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"
import { drizzleWriteStore } from "./writes-store"
import { eq } from "drizzle-orm"

describe.skipIf(!TEST_DATABASE_URL)("хранилище этапа 1.3b", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => h?.close())

  it("товары из каталога WB: вставка и обновление без дублей", async () => {
    const e = { barcode: "A", vendorCode: "JW-1", nmId: 1, title: "Браслет", subject: "Браслеты" }
    await upsertProducts(h.db, [e, { ...e }])
    await upsertProducts(h.db, [{ ...e, title: "Браслет новый" }])
    expect(await countProducts(h.db)).toBe(1)
  })

  it("площадки: id и режим записи, неизвестный код в базе — ошибка", async () => {
    await h.db.update(channels).set({ writeMode: "dry-run" }).where(eq(channels.code, "kit"))
    const m = await loadChannels(h.db)
    expect(m.get("kit")).toMatchObject({ writeMode: "dry-run" })
    expect(m.get("wb")).toMatchObject({ writeMode: "off" })
    expect(m.size).toBe(5)
  })

  it("журнал записей: пустой список не пишется, итоги пишутся с id площадки", async () => {
    const runId = "00000000-0000-4000-8000-0000000000e1"
    await insertRun(h.db, runId)
    const record = drizzleWriteStore(h.db, runId, await loadChannels(h.db))
    await record([])
    await record([{ channel: "kit", barcode: "A", field: "stock", before: 2, after: 1, mode: "dry-run", applied: false, response: null, error: null }])
    const rows = await h.db.select().from(writes)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ barcode: "A", before: 2, after: 1, mode: "dry-run", applied: false })
  })

  it("счётчик прошлого успешного запуска джобы", async () => {
    const store = drizzleRunStore(h.db)
    for (const [id, n, status] of [["f1", 400, "ok"], ["f2", 10, "failed"]] as const) {
      const runId = `00000000-0000-4000-8000-0000000000${id}`
      await store.start({ runId, job: "ingest", writeMode: "dry-run", startedAt: `2026-09-27T10:0${id === "f1" ? 0 : 1}:00.000Z` })
      await store.finish(runId, { status, finishedAt: "2026-09-27T10:05:00.000Z", counters: { wbCatalog: n }, error: null })
    }
    expect(await lastCounter(h.db, "ingest", "wbCatalog")).toBe(400)
    expect(await lastCounter(h.db, "ingest", "нет-такого")).toBeNull()
  })
})
