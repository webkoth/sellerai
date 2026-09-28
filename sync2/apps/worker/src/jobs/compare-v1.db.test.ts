import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { drizzleWriteStore, insertStockSnapshot, loadChannels, poolItems, seedChannels } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
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
    // Снимков сайта нет — сайт не подключён.
    expect(sent[0]).toContain("Сайт ↔ пул за сутки: не подключён")
  })

  it("сайт подключён — строка «Сайт ↔ пул» считает план сайта в off и dry-run (в 1.4 сайт уйдёт в dry-run)", async () => {
    const runId = "00000000-0000-4000-8000-0000000000e1"
    await insertRun(h.db, runId)
    const ids = await loadChannels(h.db)
    await insertStockSnapshot(h.db, { channelId: ids.get("site")!.id, runId, takenAt: "2026-09-27T11:50:00.000Z", stocks: [] })
    await drizzleWriteStore(h.db, runId, ids)([
      { channel: "site", barcode: "A", field: "stock", before: 3, after: 2, mode: "off", applied: false, response: null, error: null },
      { channel: "site", barcode: "B", field: "stock", before: 1, after: 0, mode: "dry-run", applied: false, response: null, error: null },
    ])
    const sent: string[] = []
    await runCompareV1({ db: h.db, ledgerPath, notifier: { send: async (t: string) => (sent.push(t), true) }, now })
    expect(sent[0]).toContain("Сайт ↔ пул за сутки (витрина не меняется, записи off/dry-run; баркодов/строк): 2/2")
  })

  it("Telegram не принял сводку — джоба падает, а не молча ok", async () => {
    const notifier = { send: async () => false }
    await expect(runCompareV1({ db: h.db, ledgerPath, notifier, now })).rejects.toThrow(/не доставлена/)
  })
})
