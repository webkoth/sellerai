import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchKitOrders, fetchKitVariants, kitRequest, resetKitPaceForTests } from "./client"

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

beforeEach(() => {
  // Темп запросов — состояние модуля (как в sync/src/kit.ts), а не аргумент:
  // без сброса между тестами прошлый тест оставил бы своё «время последнего
  // запроса» следующему и испортил бы ему ожидание паузы.
  resetKitPaceForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("kitRequest", () => {
  it("шлёт токен как Bearer в Authorization, а не голым", async () => {
    // requestJson без authHeader кладёt token как есть под именем
    // Authorization (../http.ts) — префикс Bearer добавляет сам kitRequest.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    await kitRequest({ token: "секрет" }, "/v1/variants?per_page=1&page=1")

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer секрет")
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.kit.yandex.net/v1/variants?per_page=1&page=1")
  })

  it("два запроса подряд — второй старт не раньше 1100 мс после первого", async () => {
    // KIT рвёt соединение при параллельных запросах (заплатка 27.09.2026,
    // sync/src/kit.ts) — очередь общая на модуль, поэтому проверяем именно
    // МОМЕНТ старта второго fetch, а не порядок разрешения промисов.
    vi.useFakeTimers()
    // mockImplementation, а не mockResolvedValue: тело Response читается
    // один раз (requestJson зовёт .json()) — общий объект на все вызовы
    // упал бы со второго на "Body has already been read".
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })))
    vi.stubGlobal("fetch", fetchMock)

    const p1 = kitRequest({ token: "t" }, "/v1/a")
    const p2 = kitRequest({ token: "t" }, "/v1/b")

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1099)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await Promise.all([p1, p2])
  })

  it("три запроса подряд держат темп ≥1100 мс между КАЖДЫМ стартом, а не только первой парой", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })))
    vi.stubGlobal("fetch", fetchMock)

    const calls = [
      kitRequest({ token: "t" }, "/v1/a"),
      kitRequest({ token: "t" }, "/v1/b"),
      kitRequest({ token: "t" }, "/v1/c"),
    ]

    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1100)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1099)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await Promise.all(calls)
  })
})

describe("fetchKitVariants", () => {
  it("листает до неполной страницы", async () => {
    vi.useFakeTimers()
    const page1 = { variants: Array.from({ length: 100 }, (_, i) => ({ id: String(i), barcode: null, stocks: [] })), total_count: 101 }
    const page2 = { variants: [{ id: "100", barcode: null, stocks: [] }], total_count: 101 }
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2))
    vi.stubGlobal("fetch", fetchMock)

    const resultPromise = fetchKitVariants({ token: "t" })
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toContain("page=1")
    expect(fetchMock.mock.calls[1]?.[0]).toContain("page=2")
  })

  it("одна неполная страница — без второго запроса", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ variants: [{ id: "1", barcode: "2041383032873", stocks: [] }], total_count: 1 }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchKitVariants({ token: "t" })

    expect(result).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("fetchKitOrders", () => {
  it("листает до неполной страницы", async () => {
    vi.useFakeTimers()
    const page1 = { orders: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })), total_count: 101 }
    const page2 = { orders: [{ id: "100" }], total_count: 101 }
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2))
    vi.stubGlobal("fetch", fetchMock)

    const resultPromise = fetchKitOrders({ token: "t" })
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
