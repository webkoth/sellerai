import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadChannels } from "./channels"
import { seedChannels } from "./channels-seed"
import { loadWbChrtIds, upsertProducts } from "./products"
import { writes } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"
import { drizzleWriteStore } from "./writes-store"

describe.skipIf(!TEST_DATABASE_URL)("хранилище этапа 1.4 — chrtId WB", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  it("chrtId из каталога пишется и читается картой штрихкод → chrtId; каталог без chrtId не затирает известный", async () => {
    await upsertProducts(h.db, [
      { barcode: "A", vendorCode: "R", nmId: 1, title: "", subject: null, chrtId: 440206878 },
      { barcode: "B", vendorCode: "S", nmId: 2, title: "", subject: null },
    ])
    await upsertProducts(h.db, [{ barcode: "A", vendorCode: "R", nmId: 1, title: "новое", subject: null }])
    expect(await loadWbChrtIds(h.db)).toEqual(new Map([["A", 440206878]]))
  })

  it("журнал записей хранит ключ площадки и «итог неизвестен» отдельно от отказа", async () => {
    await seedChannels(h.db)
    const runId = "00000000-0000-4000-8000-000000001401"
    await insertRun(h.db, runId)
    const record = drizzleWriteStore(h.db, runId, await loadChannels(h.db))
    const base = { field: "stock" as const, before: 3, after: 2, mode: "apply" as const, applied: false, response: null }
    await record([
      { ...base, channel: "wb", barcode: "A", externalSku: "440206878", error: "WB: после записи на складе 3, ожидалось 2", uncertain: true },
      { ...base, channel: "wb", barcode: "B", externalSku: "440206879", error: "WB: 409", uncertain: false },
      { ...base, channel: "site", barcode: "C", externalSku: null, error: null, applied: true, uncertain: false },
    ])
    const rows = await h.db.select().from(writes)
    const byBarcode = new Map(rows.map((r) => [r.barcode, r]))
    expect(byBarcode.get("A")).toMatchObject({ externalSku: "440206878", uncertain: true, applied: false })
    expect(byBarcode.get("B")).toMatchObject({ externalSku: "440206879", uncertain: false, applied: false })
    expect(byBarcode.get("C")).toMatchObject({ externalSku: null, uncertain: false, applied: true })
  })
})
