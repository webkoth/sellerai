import { afterEach, describe, expect, it, vi } from "vitest"
import { PlatformApiError, RateLimitError } from "./errors"
import { requestJson } from "./http"
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

describe("isUncertain — по всем попыткам запроса, а не только по последней (http.ts повторяет сам)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Ошибка, которой кончился запрос записи с заданной последовательностью ответов. */
  async function failureOf(...steps: Array<Response | Error>): Promise<unknown> {
    const fetchMock = vi.fn()
    for (const step of steps) {
      if (step instanceof Error) fetchMock.mockRejectedValueOnce(step)
      else fetchMock.mockResolvedValueOnce(step)
    }
    vi.stubGlobal("fetch", fetchMock)
    const delays = steps.slice(1).map(() => 0)
    return requestJson("wb", "https://example.test/write", { token: "t", method: "PUT", body: { x: 1 }, retryDelaysMs: delays }).then(
      () => {
        throw new Error("ожидалась ошибка")
      },
      (e: unknown) => e,
    )
  }

  it("502, затем 429 — первая попытка могла примениться: итог неизвестен", async () => {
    const e = await failureOf(new Response("oops", { status: 502 }), new Response("limit", { status: 429 }))
    expect(e).toBeInstanceOf(RateLimitError)
    expect(isUncertain(e)).toBe(true)
  })

  it("таймаут, затем 400 — первая попытка могла примениться: итог неизвестен", async () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError")
    const e = await failureOf(timeout as unknown as Error, new Response("bad", { status: 400 }))
    expect(e).toMatchObject({ status: 400 })
    expect(isUncertain(e)).toBe(true)
  })

  it("400 с первой попытки — отказ, итог известен", async () => {
    const e = await failureOf(new Response("bad", { status: 400 }))
    expect(isUncertain(e)).toBe(false)
  })

  it("429 с первой попытки и после повтора — лимит, итог известен", async () => {
    const e = await failureOf(new Response("limit", { status: 429 }), new Response("limit", { status: 429 }))
    expect(isUncertain(e)).toBe(false)
  })

  it("пустой 200 — площадка ответила успехом, а тела нет: итог неизвестен", async () => {
    const e = await failureOf(new Response("", { status: 200 }))
    expect(e).toMatchObject({ status: 200 })
    expect(isUncertain(e)).toBe(true)
  })

  it("битое тело 200 — итог неизвестен", async () => {
    const e = await failureOf(new Response("{не json", { status: 200 }))
    expect(isUncertain(e)).toBe(true)
  })
})
