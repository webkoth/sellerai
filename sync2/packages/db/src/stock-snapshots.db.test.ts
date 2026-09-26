import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import { seedChannels } from "./channels-seed"
import { channels } from "./schema"
import { insertStockSnapshot, latestStockSnapshots } from "./stock-snapshots"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

const RUN = "00000000-0000-4000-8000-0000000000c1"
const s = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse: null })

describe.skipIf(!TEST_DATABASE_URL)("снимки остатков", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Map<string, number>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, RUN)
    ids = new Map((await h.db.select().from(channels)).map((c) => [c.code, c.id]))
  })
  afterAll(async () => h?.close())

  it("последний снимок каждой площадки, время в ISO", async () => {
    const wb = ids.get("wb")!
    const kit = ids.get("kit")!
    await insertStockSnapshot(h.db, { channelId: wb, runId: RUN, takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 1)] })
    await insertStockSnapshot(h.db, { channelId: wb, runId: RUN, takenAt: "2026-09-26T10:30:00.000Z", stocks: [s("A", 2)] })
    await insertStockSnapshot(h.db, { channelId: kit, runId: RUN, takenAt: "2026-09-26T10:05:00.000Z", stocks: [] })

    const latest = await latestStockSnapshots(h.db)
    expect(latest.get(wb)).toEqual({ takenAt: "2026-09-26T10:30:00.000Z", stocks: [s("A", 2)] })
    expect(latest.get(kit)).toEqual({ takenAt: "2026-09-26T10:05:00.000Z", stocks: [] })
    expect(latest.has(ids.get("ozon")!)).toBe(false)
  })
})
