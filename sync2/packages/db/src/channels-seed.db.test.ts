import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { CHANNELS } from "@sync2/shared"
import { seedChannels } from "./channels-seed"
import { channels } from "./schema"
import { TEST_DATABASE_URL, freshTestDb } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("seedChannels", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  it("заводит пять площадок с выключенной записью", async () => {
    await seedChannels(h.db)
    const rows = await h.db.select().from(channels)
    expect(rows.map((r) => r.code).sort()).toEqual([...CHANNELS].sort())
    expect(rows.every((r) => r.writeMode === "off")).toBe(true)
  })

  it("повторный сид не дублирует и не сбрасывает режим записи и склад", async () => {
    await seedChannels(h.db)
    await h.db
      .update(channels)
      .set({ writeMode: "apply", warehouseRef: "01a05cb0-214d-7c49-afc5-df8853f9d7e1" })
      .where(eq(channels.code, "kit"))
    await seedChannels(h.db)
    const rows = await h.db.select().from(channels)
    expect(rows).toHaveLength(5)
    const kit = rows.find((r) => r.code === "kit")
    expect(kit?.writeMode).toBe("apply")
    expect(kit?.warehouseRef).toBe("01a05cb0-214d-7c49-afc5-df8853f9d7e1")
  })
})
