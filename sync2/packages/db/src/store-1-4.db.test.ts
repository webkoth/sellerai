import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadWbChrtIds, upsertProducts } from "./products"
import { TEST_DATABASE_URL, freshTestDb } from "./test-db"

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
})
