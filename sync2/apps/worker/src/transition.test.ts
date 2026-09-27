import { describe, expect, it } from "vitest"
import { decideNotification, describeOutcome, REMIND_EVERY_RUNS } from "./transition"

const cur = (status: "ok" | "partial" | "failed", detail = "ozon остатки: 500") => ({ status, detail })

describe("decideNotification", () => {
  it.each([
    ["null → ok: первый прогон, молчим", null, cur("ok"), 0, null],
    ["null → failed: сразу предупреждение", null, cur("failed", "бум"), 1, "⚠️ sync2 ingest: failed — бум"],
    ["null → partial: сразу предупреждение", null, cur("partial"), 1, "⚠️ sync2 ingest: partial — ozon остатки: 500"],
    ["ok → partial", "ok", cur("partial"), 1, "⚠️ sync2 ingest: partial — ozon остатки: 500"],
    ["partial → failed: смена не-ok статуса тоже переход", "partial", cur("failed", "бум"), 5, "⚠️ sync2 ingest: failed — бум"],
    ["failed → partial", "failed", cur("partial"), 5, "⚠️ sync2 ingest: partial — ozon остатки: 500"],
    ["failed → ok", "failed", cur("ok"), 0, "✅ sync2 ingest снова в норме"],
    ["partial → ok", "partial", cur("ok"), 0, "✅ sync2 ingest снова в норме"],
    ["ok → ok", "ok", cur("ok"), 0, null],
    ["partial → partial, серия 2: молчим", "partial", cur("partial"), 2, null],
  ] as const)("%s", (_name, prev, c, streak, expected) => {
    expect(decideNotification({ job: "ingest", prev, cur: c, streak })).toBe(expected)
  })

  it("partial → partial, серия кратна 36 (≈6 ч при тике 10 мин): напоминание", () => {
    expect(REMIND_EVERY_RUNS).toBe(36)
    for (const streak of [36, 72]) {
      const text = decideNotification({ job: "pool", prev: "partial", cur: cur("partial"), streak })
      expect(text).toBe(`⚠️ sync2 pool: всё ещё partial (${streak} прогонов подряд) — ozon остатки: 500`)
    }
    expect(decideNotification({ job: "pool", prev: "partial", cur: cur("partial"), streak: 37 })).toBeNull()
  })
})

describe("describeOutcome", () => {
  it("ошибка — как есть; без ошибки — счётчики; пусто — «без деталей»", () => {
    expect(describeOutcome({ error: "бум", counters: { a: 1 } })).toBe("бум")
    expect(describeOutcome({ error: null, counters: { noFreshWb: 1, events: 0 } })).toBe("noFreshWb=1, events=0")
    expect(describeOutcome({ error: null, counters: {} })).toBe("без деталей")
  })
})
