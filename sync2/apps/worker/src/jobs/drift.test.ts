import { describe, expect, it } from "vitest"
import type { WriteStats } from "@sync2/db"
import { CHANNELS, type Channel } from "@sync2/shared"
import { channelDrift, formatDrift } from "./drift"

const s = (barcode: string, quantity: number) => ({ barcode, externalSku: null, quantity, warehouse: null })
const pool = new Map([["A", 2], ["B", 0], ["C", 1]])
const empty = (): WriteStats => ({ applied: 0, failed: 0, barcodes: 0, repeated: [] })
const noStats = Object.fromEntries(CHANNELS.map((c) => [c, empty()])) as Record<Channel, WriteStats>

describe("channelDrift", () => {
  it("совпадения, расхождения, сирота с остатком; записанное после снимка — «в пути», не расхождение", () => {
    const d = channelDrift("ozon", "2026-09-28T09:00:00.000Z", pool, [s("A", 1), s("B", 0), s("C", 3), s("Z", 1), s("Y", 0)], new Set(["C"]))
    expect(d).toEqual({
      channel: "ozon",
      takenAt: "2026-09-28T09:00:00.000Z",
      compared: 5,
      inFlight: 1,
      mismatches: [
        { barcode: "A", pool: 2, actual: 1 },
        { barcode: "Z", pool: 0, actual: 1 },
      ],
    })
  })
})

describe("formatDrift", () => {
  it("строка на площадку, записи за сутки, повторные записи", () => {
    const text = formatDrift(
      [
        channelDrift("wb", "2026-09-28T09:58:00.000Z", pool, [s("A", 2), s("B", 0), s("C", 1)], new Set()),
        channelDrift("ozon", "2026-09-28T09:58:00.000Z", pool, [s("A", 1)], new Set()),
      ],
      { ...noStats, ozon: { applied: 5, failed: 1, barcodes: 4, repeated: [{ barcode: "A", times: 5 }] } },
      { now: new Date("2026-09-28T10:00:00.000Z"), lastPoolRecalcAt: "2026-09-28T09:56:00.000Z", failedRuns: 0, stuckRuns: 0 },
    )
    expect(text).toContain("WB: расходится 0 из 3 (снимок 2 мин, в пути 0)")
    expect(text).toContain("Ozon: расходится 1 из 1 (снимок 2 мин, в пути 0) — A: пул 2, на площадке 1")
    expect(text).toContain("Ozon 5/1/4")
    expect(text).toContain("Повторные записи (≥3 за сутки): Ozon A ×5")
  })

  it("длинный список расхождений — обрезается до предела Telegram", () => {
    const many = Array.from({ length: 2000 }, (_, i) => s(`Z${String(i).padStart(13, "0")}`, 1))
    const text = formatDrift([channelDrift("kit", "2026-09-28T09:58:00.000Z", pool, many, new Set())], noStats, {
      now: new Date("2026-09-28T10:00:00.000Z"),
      lastPoolRecalcAt: null,
      failedRuns: 1,
      stuckRuns: 0,
    })
    expect(text.length).toBeLessThanOrEqual(4000)
    expect(text).toContain("… (ещё 1990)")
    expect(text).toContain("Пул: ⚠️ ни разу не пересчитан")
  })
})
