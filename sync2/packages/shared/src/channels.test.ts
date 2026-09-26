import { describe, expect, it } from "vitest"
import { CHANNELS, CHANNEL_TITLES, WRITE_MODES, isChannel, parseWriteMode } from "./channels"

describe("площадки", () => {
  it("пять площадок, WB первым — он мастер", () => {
    expect(CHANNELS).toEqual(["wb", "ozon", "ym", "kit", "site"])
  })

  it("у каждой площадки есть название", () => {
    for (const c of CHANNELS) expect(CHANNEL_TITLES[c]).toMatch(/\S/)
  })

  it("isChannel отличает площадку от произвольной строки", () => {
    expect(isChannel("kit")).toBe(true)
    expect(isChannel("avito")).toBe(false)
  })
})

describe("режим записи", () => {
  it("три режима по возрастанию опасности", () => {
    expect(WRITE_MODES).toEqual(["off", "dry-run", "apply"])
  })

  it("пусто или undefined — берётся запасной режим", () => {
    expect(parseWriteMode(undefined, "off")).toBe("off")
    expect(parseWriteMode("", "dry-run")).toBe("dry-run")
  })

  it("регистр и пробелы не важны", () => {
    expect(parseWriteMode("  APPLY ", "off")).toBe("apply")
  })

  it("опечатка — ошибка, а не тихий off", () => {
    expect(() => parseWriteMode("aply", "off")).toThrow(/режим записи/)
  })
})
