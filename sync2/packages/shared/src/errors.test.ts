import { describe, expect, it } from "vitest"
import { errorText } from "./errors"

describe("errorText", () => {
  it("Error с cause — сообщение и причина через двоеточие", () => {
    const err = new Error("внешняя", { cause: new Error("внутренняя") })
    expect(errorText(err)).toBe("внешняя: внутренняя")
  })

  it("Error с пустым сообщением — имя класса", () => {
    expect(errorText(new Error(""))).toBe("Error")
  })

  it("обычный объект — JSON", () => {
    expect(errorText({ code: 429 })).toBe('{"code":429}')
  })

  it("null — строка \"null\"", () => {
    expect(errorText(null)).toBe("null")
  })

  it("циклический объект — не падает", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => errorText(circular)).not.toThrow()
    expect(typeof errorText(circular)).toBe("string")
  })
})
