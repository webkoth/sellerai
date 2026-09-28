import { describe, expect, it } from "vitest"
import { decideNotification, describeOutcome, REMIND_EVERY_RUNS, WRITE_FAIL_ALERT_RUNS, writeFailureAlerts } from "./transition"

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

  it("partial → partial, серия кратна 72 (≈6 ч при тике раз в 5 минут): напоминание", () => {
    expect(REMIND_EVERY_RUNS).toBe(72)
    for (const streak of [72, 144]) {
      const text = decideNotification({ job: "pool", prev: "partial", cur: cur("partial"), streak })
      expect(text).toBe(`⚠️ sync2 pool: всё ещё partial (${streak} прогонов подряд) — ozon остатки: 500`)
    }
    expect(decideNotification({ job: "pool", prev: "partial", cur: cur("partial"), streak: 36 })).toBeNull()
  })
})

describe("describeOutcome", () => {
  it("ошибка — как есть; без ошибки — счётчики; пусто — «без деталей»", () => {
    expect(describeOutcome({ error: "бум", counters: { a: 1 } })).toBe("бум")
    expect(describeOutcome({ error: null, counters: { noFreshWb: 1, events: 0 } })).toBe("noFreshWb=1, events=0")
    expect(describeOutcome({ error: null, counters: {} })).toBe("без деталей")
  })
})

describe("writeFailureAlerts — запись площадки не проходит N тиков подряд", () => {
  it("серия дошла до порога — предупреждение; дальше — напоминание раз в REMIND_EVERY_RUNS; между — молчим", () => {
    expect(WRITE_FAIL_ALERT_RUNS).toBe(3)
    expect(writeFailureAlerts({ kitWriteFailedRuns: 2 }, { kitWriteFailed: 1, kitWriteFailedRuns: 3 })).toEqual([
      "⚠️ sync2 pool: площадка KIT — запись не проходит 3 тика подряд (ошибок в последнем прогоне: 1); подробности — plan kit",
    ])
    expect(writeFailureAlerts({}, { ozonWriteFailed: 1, ozonWriteFailedRuns: 2 })).toEqual([])
    expect(writeFailureAlerts({}, { ozonWriteFailed: 1, ozonWriteFailedRuns: 4 })).toEqual([])
    expect(writeFailureAlerts({}, { wbWriteFailed: 2, wbWriteFailedRuns: REMIND_EVERY_RUNS })).toEqual([
      `⚠️ sync2 pool: площадка WB — запись не проходит ${REMIND_EVERY_RUNS} тика подряд (ошибок в последнем прогоне: 2); подробности — plan wb`,
    ])
  })

  it("после серии от порога запись прошла — «снова проходит»; короткая серия — молча", () => {
    expect(writeFailureAlerts({ ymWriteFailedRuns: 5 }, { ymApplied: 3 })).toEqual(["✅ sync2 pool: площадка ЯМ — запись снова проходит (серия ошибок была 5 тиков)"])
    expect(writeFailureAlerts({ ymWriteFailedRuns: 2 }, {})).toEqual([])
    expect(writeFailureAlerts(null, {})).toEqual([])
  })
})
