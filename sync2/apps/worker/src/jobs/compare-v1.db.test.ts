import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { poolItems, seedChannels } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb } from "@sync2/db/test-db"
import { runCompareV1 } from "./compare-v1"

describe.skipIf(!TEST_DATABASE_URL)("runCompareV1", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  const ledgerPath = join(mkdtempSync(join(tmpdir(), "sync2-compare-")), "inventory.json")
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await h.db.insert(poolItems).values({ barcode: "A", base: 2, wbExpected: 2 })
    writeFileSync(ledgerPath, JSON.stringify({ items: { A: { base: 2 } } }))
  })
  afterAll(async () => h?.close())

  const now = () => new Date("2026-09-27T12:00:00.000Z")

  it("сводка ушла — итоги сверки", async () => {
    const sent: string[] = []
    const notifier = { send: async (t: string) => (sent.push(t), true) }
    const r = await runCompareV1({ db: h.db, ledgerPath, notifier, now })
    expect(r).toMatchObject({ same: 1, diff: 0, onlyV1: 0, onlyV2: 0, suspectedDoubleCounts: 0, stuckRuns: 0 })
    expect(sent[0]).toContain("совпадает 1 из 1")
  })

  it("Telegram не принял сводку — джоба падает, а не молча ok", async () => {
    const notifier = { send: async () => false }
    await expect(runCompareV1({ db: h.db, ledgerPath, notifier, now })).rejects.toThrow(/не доставлена/)
  })
})
