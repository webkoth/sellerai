import { describe, expect, it } from "vitest"
import { checkApplyPreview } from "./apply-preview"

const now = new Date("2026-09-28T10:10:00.000Z")
const run = (patch: Partial<{ status: string; startedAt: string; counters: Record<string, unknown> }> = {}) => ({
  runId: "r",
  status: "ok",
  startedAt: "2026-09-28T10:06:00.000Z",
  counters: { events: 0 },
  ...patch,
})

describe("checkApplyPreview — можно ли включать apply площадки", () => {
  it("свежий пересчитанный пул без отказа предохранителя — можно", () => {
    expect(checkApplyPreview(run(), "kit", now)).toEqual({ ok: true })
  })
  it("pool не запускался, упал, пул не пересчитан, план старше 15 минут — нельзя", () => {
    expect(checkApplyPreview(null, "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("ещё не запускался") })
    expect(checkApplyPreview(run({ status: "failed" }), "kit", now)).toMatchObject({ ok: false })
    expect(checkApplyPreview(run({ counters: { noFreshWb: 1 } }), "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("не пересчитан") })
    expect(checkApplyPreview(run({ startedAt: "2026-09-28T09:50:00.000Z" }), "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("20 мин") })
  })
  it("план площадки отклонён предохранителем — нельзя; чужой отказ не мешает", () => {
    expect(checkApplyPreview(run({ counters: { events: 0, kitAborted_to_zero: 21 } }), "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("kitAborted_to_zero") })
    expect(checkApplyPreview(run({ counters: { events: 0, siteAborted_to_zero: 21 } }), "kit", now)).toEqual({ ok: true })
  })
})
