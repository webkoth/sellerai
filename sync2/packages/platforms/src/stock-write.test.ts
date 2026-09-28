import { describe, expect, it } from "vitest"
import { PlatformApiError, RateLimitError } from "./errors"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "./stock-write"
import type { WriteOp } from "./writer"

const op = (barcode: string, externalSku: string | null): WriteOp => ({ channel: "ozon", barcode, field: "stock", before: 0, after: 1, externalSku })

describe("chunk", () => {
  it("пачки по размеру, порядок сохраняется; пустой список — ни одной пачки", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 100)).toEqual([])
  })
  it("размер не целый положительный — ошибка", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError)
  })
})

describe("splitByKey", () => {
  it("без ключа — отказ до сети; один ключ у нескольких штрихкодов — отказ всем, не угадываем", () => {
    const r = splitByKey([op("A", "JW-1"), op("B", null), op("C", "JW-2"), op("D", "JW-2")], (o) => o.externalSku)
    expect(r.valid.map((v) => [v.op.barcode, v.key])).toEqual([["A", "JW-1"]])
    expect(r.rejected.map((x) => [x.barcode, x.ok, x.uncertain])).toEqual([
      ["B", false, false],
      ["C", false, false],
      ["D", false, false],
    ])
    expect(r.rejected[0]?.error).toMatch(/нет ключа товара на площадке/)
    expect(r.rejected[1]?.error).toMatch(/JW-2 у нескольких штрихкодов \(C, D\)/)
  })
})

describe("итог позиции", () => {
  it("succeeded и failed — форма SendResult", () => {
    expect(succeeded(op("A", "k"), { x: 1 })).toEqual({ barcode: "A", field: "stock", ok: true, response: { x: 1 } })
    expect(failed(op("A", "k"), "нет", { uncertain: true })).toMatchObject({ barcode: "A", ok: false, error: "нет", uncertain: true })
  })
})

describe("isUncertain — могла ли запись дойти", () => {
  it("сеть и 5xx — могла; лимит и прочие 4xx — нет; ошибка кода — считаем, что могла", () => {
    expect(isUncertain(new PlatformApiError("wb", 0, "сеть"))).toBe(true)
    expect(isUncertain(new PlatformApiError("wb", 502, "bad gateway"))).toBe(true)
    expect(isUncertain(new RateLimitError("wb", 8, "429"))).toBe(false)
    expect(isUncertain(new PlatformApiError("wb", 409, "conflict"))).toBe(false)
    expect(isUncertain(new TypeError("x is undefined"))).toBe(true)
  })
})
