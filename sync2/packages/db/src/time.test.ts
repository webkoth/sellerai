import { describe, expect, it } from "vitest"
import { toIso, toIsoOrNull } from "./time"

describe("toIso", () => {
  it("текст Postgres в UTC — ISO с Z", () => {
    expect(toIso("2026-09-26 11:15:54.405+00")).toBe("2026-09-26T11:15:54.405Z")
  })

  it("смещение переводится в UTC", () => {
    expect(toIso("2026-09-26 14:15:54.405+03")).toBe("2026-09-26T11:15:54.405Z")
  })

  it("уже ISO — без изменений", () => {
    expect(toIso("2026-09-26T11:15:54.405Z")).toBe("2026-09-26T11:15:54.405Z")
  })

  it("мусор — ошибка, а не Invalid Date дальше по коду", () => {
    expect(() => toIso("вчера")).toThrow(/время/)
  })

  it("null остаётся null", () => {
    expect(toIsoOrNull(null)).toBeNull()
  })
})
