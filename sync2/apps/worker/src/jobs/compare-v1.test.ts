import { describe, expect, it } from "vitest"
import type { Db } from "@sync2/db"
import { comparePools, formatComparison, MAX_TELEGRAM_TEXT, runCompareV1, type SummaryExtra } from "./compare-v1"

describe("comparePools", () => {
  it("совпадения, расхождения и товары только в одном пуле", () => {
    const r = comparePools(
      [
        { barcode: "A", base: 2 },
        { barcode: "B", base: 1 },
        { barcode: "C", base: 0 },
      ],
      { items: { A: { base: 2 }, B: { base: 3 }, D: { base: 1 } } },
    )
    expect(r).toEqual({
      same: 1,
      diff: [{ barcode: "B", v1: 3, v2: 1 }],
      onlyV1: [{ barcode: "D", v1: 1 }],
      onlyV2: [],
    })
  })
  it("нулевой товар, которого нет у старого синка, — не расхождение", () => {
    expect(comparePools([{ barcode: "C", base: 0 }], { items: {} }).onlyV2).toEqual([])
  })
})

const now = new Date("2026-09-27T12:00:00.000Z")
const planned = { wb: { barcodes: 0, rows: 0 }, ozon: { barcodes: 2, rows: 30 }, ym: { barcodes: 0, rows: 0 }, kit: { barcodes: 1, rows: 4 }, site: { barcodes: 0, rows: 0 } }
const extra = (over: Partial<SummaryExtra> = {}): SummaryExtra => ({
  now,
  failedRuns: 0,
  stuckRuns: 0,
  planned,
  lastPoolRecalcAt: "2026-09-27T11:50:00.000Z",
  recentOrderBarcodes: new Set(),
  suspectedDoubleCounts: 0,
  ...over,
})

describe("formatComparison", () => {
  it("короткая сводка для Telegram", () => {
    const text = formatComparison({ same: 80, diff: [{ barcode: "B", v1: 3, v2: 1 }], onlyV1: [], onlyV2: [] }, extra())
    expect(text).toContain("совпадает 80 из 81")
    expect(text).toContain("B: старый 3, новый 1")
    expect(text).not.toContain("(заказ ≤40 мин)")
  })

  it("план записей — разные баркоды по площадке и рядом строки", () => {
    const text = formatComparison({ same: 1, diff: [], onlyV1: [], onlyV2: [] }, extra())
    expect(text).toContain("План записей за сутки (dry-run, баркодов/строк): Ozon 2/30, ЯМ 0/0, KIT 1/4")
  })

  it("строка diff с заказом/отменой зеркала за последние 40 мин помечена", () => {
    const text = formatComparison(
      { same: 0, diff: [{ barcode: "B", v1: 3, v2: 2 }, { barcode: "C", v1: 1, v2: 0 }], onlyV1: [], onlyV2: [] },
      extra({ recentOrderBarcodes: new Set(["B"]) }),
    )
    expect(text).toContain("B: старый 3, новый 2 (заказ ≤40 мин)")
    expect(text).toContain("C: старый 1, новый 0")
    expect(text).not.toContain("C: старый 1, новый 0 (заказ")
  })

  it("«только у старого/нового» обрезаются до 10 с «… (ещё N)», как diff", () => {
    const onlyV1 = Array.from({ length: 13 }, (_, i) => ({ barcode: `V1-${i}`, v1: 1 }))
    const onlyV2 = Array.from({ length: 11 }, (_, i) => ({ barcode: `V2-${i}`, v2: 2 }))
    const text = formatComparison({ same: 0, diff: [], onlyV1, onlyV2 }, extra())
    expect(text).toContain("V1-9 (1), … (ещё 3)")
    expect(text).not.toContain("V1-10")
    expect(text).toContain("V2-9 (2), … (ещё 1)")
    expect(text).not.toContain("V2-10")
  })

  it("пул, упавшие/зависшие прогоны, подозрение на двойной счёт", () => {
    const text = formatComparison(
      { same: 1, diff: [], onlyV1: [], onlyV2: [] },
      extra({ failedRuns: 2, stuckRuns: 1, suspectedDoubleCounts: 4 }),
    )
    expect(text).toContain("Пул пересчитан: 27.09 14:50 МСК")
    expect(text).not.toContain("не пересчитывался")
    expect(text).toContain("Упавших прогонов за сутки: 2, зависших (running > 30 мин): 1")
    expect(text).toContain("Подозрение на двойной счёт: 4")
  })

  it("пул давно не пересчитывался или ни разу — предупреждение", () => {
    const empty = { same: 0, diff: [], onlyV1: [], onlyV2: [] }
    expect(formatComparison(empty, extra({ lastPoolRecalcAt: "2026-09-27T09:30:00.000Z" }))).toContain("⚠️ пул не пересчитывался 2 ч")
    expect(formatComparison(empty, extra({ lastPoolRecalcAt: null }))).toContain("⚠️ пул ни разу не пересчитан")
  })

  it("длинные баркоды — текст всё равно не длиннее лимита Telegram, с пометкой об обрезке", () => {
    const long = "Ж".repeat(400)
    const diff = Array.from({ length: 10 }, (_, i) => ({ barcode: `${long}${i}`, v1: 1, v2: 2 }))
    const onlyV1 = Array.from({ length: 10 }, (_, i) => ({ barcode: `${long}a${i}`, v1: 1 }))
    const text = formatComparison({ same: 0, diff, onlyV1, onlyV2: [] }, extra())
    expect(MAX_TELEGRAM_TEXT).toBe(4000)
    expect(text.length).toBeLessThanOrEqual(4000)
    expect(text).toMatch(/сводка обрезана/)
  })
})

describe("runCompareV1", () => {
  it("леджер не читается — ошибка до единого обращения к базе, Telegram не вызван", async () => {
    // Любое обращение к базе (db.select, db.selectDistinct, …) записывается и бросает.
    const touched: string[] = []
    const db = new Proxy(
      {},
      {
        get: (_t, prop) => {
          touched.push(String(prop))
          throw new Error("к базе обратились")
        },
      },
    ) as unknown as Db
    const sent: string[] = []
    const notifier = { send: async (t: string) => (sent.push(t), true) }
    await expect(runCompareV1({ db, ledgerPath: "/нет/такого/inventory.json", notifier, now: () => now })).rejects.toThrow(/не читается/)
    expect(touched).toEqual([])
    expect(sent).toEqual([])
  })
})
