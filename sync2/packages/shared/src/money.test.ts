import { describe, expect, it } from "vitest"
import { decimalStringToMinor, rubToMinor } from "./money"

describe("деньги в копейках", () => {
  it("рубли числом → копейки", () => {
    expect(rubToMinor(12.34)).toBe(1234)
    expect(rubToMinor(0)).toBe(0)
  })
  it("не число — ошибка", () => {
    expect(() => rubToMinor(Number.NaN)).toThrow()
  })
  it("десятичная строка → копейки с усечением третьего знака", () => {
    expect(decimalStringToMinor("12.345")).toBe(1234)
    expect(decimalStringToMinor("-7.5")).toBe(-750)
    expect(decimalStringToMinor("")).toBe(0)
  })
  it("мусор в строке — ошибка", () => {
    expect(() => decimalStringToMinor("12,5")).toThrow()
  })
})
