// Перенесено из finstock (27.09.2026): packages/platforms/src/ozon/client.test.ts.
// Без изменений: клиент не содержит ничего финансового, тесты переносятся как есть.
import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchOzonBarcodes, fetchOzonPostings, fetchOzonStocks } from "./client"
import type { OzonPosting, OzonStockItem } from "./client"

afterEach(() => vi.restoreAllMocks())

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

function posting(patch: Partial<OzonPosting> = {}): OzonPosting {
  return {
    posting_number: "0132112277-0101-1",
    order_id: 35566798085,
    order_number: "0132112277-0101",
    status: "delivered",
    substatus: "posting_delivered",
    in_process_at: "2026-08-01T10:00:00Z",
    cancellation: {
      cancel_reason_id: 0,
      cancel_reason: "",
      cancellation_type: "",
      cancelled_after_ship: false,
      affect_cancellation_rating: false,
      cancellation_initiator: "",
    },
    products: [
      { offer_id: "SK-58", sku: 827098843, name: "Товар", quantity: 1, price: { amount: "1530.0000", currency: "RUB" } },
    ],
    ...patch,
  }
}

describe("авторизация Ozon", () => {
  it("посылает Client-Id и Api-Key, а не Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ postings: [], has_next: false }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchOzonPostings({ apiKey: "секрет", clientId: "12345" }, "2026-08-01T00:00:00Z")

    // Не заворачивать в нативный Headers: его конструктор требует ByteString
    // (только Latin1) для значений заголовков и падает на кириллице ещё
    // до какой-либо проверки нашей логики — это ограничение платформы,
    // не то, что здесь проверяется. Читаем объект заголовков как есть.
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined
    expect(headers?.["Client-Id"]).toBe("12345")
    expect(headers?.["Api-Key"]).toBe("секрет")
    expect(headers?.["Authorization"]).toBeUndefined()
  })

  it("шлёт POST на /v4/posting/fbs/list с телом filter.since, filter.to, limit — без cursor offset", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ postings: [], has_next: false }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchOzonPostings({ apiKey: "секрет", clientId: "12345" }, "2026-08-01T00:00:00Z")

    const [url, init] = fetchMock.mock.calls[0] ?? []
    // Не /v3: тот метод помечен в спецификации deprecated — см. комментарий в client.ts.
    expect(String(url)).toBe("https://api-seller.ozon.ru/v4/posting/fbs/list")
    expect(init?.method).toBe("POST")
    const body = JSON.parse(init?.body as string)
    expect(body.filter.since).toBe("2026-08-01T00:00:00Z")
    expect(typeof body.filter.to).toBe("string")
    expect(body.limit).toBe(100) // максимум /v4, а не 1000, как было у /v3
    expect(body.offset).toBeUndefined() // /v4 пагинирует курсором, offset не существует
    expect(body.cursor).toBeUndefined() // на первый запрос курсора ещё нет
  })
})

describe("пагинация fetchOzonPostings — курсор, а не смещение", () => {
  it("копит все страницы, передаёт курсор дальше и останавливается на has_next: false", async () => {
    const page1 = [posting({ posting_number: "1" })]
    // Вторая страница НЕПУСТАЯ: если бы цикл останавливался только на пустой
    // странице (гвард 1), а не на has_next: false (гвард 2), он бы запросил
    // и третью страницу.
    const page2 = [posting({ posting_number: "2" })]

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ postings: page1, has_next: true, cursor: "cursor-1" }))
      .mockResolvedValueOnce(response({ postings: page2, has_next: false, cursor: "cursor-2" }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchOzonPostings({ apiKey: "k", clientId: "1" }, "2026-08-01T00:00:00Z")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual([...page1, ...page2])

    // Второй запрос обязан вернуть курсор, полученный из первого ответа —
    // это и есть пагинация курсором, а не смещением.
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)
    expect(secondBody.cursor).toBe("cursor-1")
  })

  it("гвард 1 (пустая страница): останавливается на пустой странице, даже если курсор новый и has_next: true", async () => {
    const page1 = [posting({ posting_number: "1" })]

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ postings: page1, has_next: true, cursor: "cursor-1" }))
      // Курсор честно продвинулся (cursor-2 ≠ cursor-1), has_next всё ещё
      // true — единственная причина остановиться здесь это пустой postings.
      .mockResolvedValueOnce(response({ postings: [], has_next: true, cursor: "cursor-2" }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchOzonPostings({ apiKey: "k", clientId: "1" }, "2026-08-01T00:00:00Z")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual(page1)
  })

  it("гвард 3а (курсор не пришёл): останавливается, если has_next: true, но нового курсора нет", async () => {
    const page1 = [posting({ posting_number: "1" })]

    const fetchMock = vi.fn().mockResolvedValueOnce(
      // has_next лжёт про продолжение, но курсора, по которому его получить,
      // нет — без гварда 3 следующий запрос ушёл бы вовсе без курсора.
      response({ postings: page1, has_next: true, cursor: "" }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchOzonPostings({ apiKey: "k", clientId: "1" }, "2026-08-01T00:00:00Z")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toEqual(page1)
  })

  it("гвард 3б (курсор не продвинулся): останавливается, если площадка вернула тот же курсор, что получила", async () => {
    const page1 = [posting({ posting_number: "1" })]
    const page2 = [posting({ posting_number: "2" })]

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ postings: page1, has_next: true, cursor: "cursor-1" }))
      // Второй ответ несёт ТОТ ЖЕ курсор, который был отправлен во втором
      // запросе ("cursor-1") — без гварда цикл переспросил бы то же самое
      // бесконечно.
      .mockResolvedValueOnce(response({ postings: page2, has_next: true, cursor: "cursor-1" }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchOzonPostings({ apiKey: "k", clientId: "1" }, "2026-08-01T00:00:00Z")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual([...page1, ...page2])

    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)
    expect(secondBody.cursor).toBe("cursor-1")
  })

  it("гвард 4 (потолок MAX_PAGES): не крутится дольше потолка, даже если площадка честно продвигает курсор", async () => {
    let call = 0
    const fetchMock = vi.fn(() => {
      call += 1
      return Promise.resolve(
        response({
          postings: [posting({ posting_number: String(call) })],
          has_next: true,
          cursor: `cursor-${call}`,
        }),
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchOzonPostings({ apiKey: "k", clientId: "1" }, "2026-08-01T00:00:00Z")

    // Ни has_next, ни курсор здесь никогда не останавливают цикл сами —
    // единственная причина остановки такого честного, но бесконечного
    // источника — потолок MAX_PAGES (1000 в client.ts).
    expect(fetchMock).toHaveBeenCalledTimes(1000)
    expect(result).toHaveLength(1000)
  })
})

const CREDS = { apiKey: "секрет", clientId: "12345" }

function stockItem(patch: Partial<OzonStockItem> = {}): OzonStockItem {
  return {
    offer_id: "SK-58",
    product_id: 1,
    stocks: [{ type: "fbs", present: 1, reserved: 0 }],
    ...patch,
  }
}

describe("fetchOzonStocks — все товары постранично", () => {
  it("копит страницы по курсору и останавливается на неполной странице", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => stockItem({ offer_id: `A-${i}`, product_id: i }))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ cursor: "c1", total: 1003, items: full }))
      .mockResolvedValueOnce(response({ cursor: "c2", total: 1003, items: full.slice(0, 3) }))
    vi.stubGlobal("fetch", fetchMock)

    const items = await fetchOzonStocks(CREDS)

    expect(items).toHaveLength(1003)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as { cursor?: string; limit: number }
    expect(secondBody.cursor).toBe("c1")
    expect(secondBody.limit).toBe(1000)
  })

  it("останавливается, если курсор не продвинулся, даже на полной странице", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => stockItem({ offer_id: `A-${i}` }))
    // mockResolvedValue отдавал бы один и тот же объект Response на оба
    // вызова — второе чтение .json() того же объекта падает нативной
    // ошибкой "Body has already been read", не относящейся к тому, что здесь
    // проверяется. mockImplementation создаёт свежий Response на каждый вызов.
    const fetchMock = vi.fn().mockImplementation(async () => response({ cursor: "same", total: 5000, items: full }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchOzonStocks(CREDS)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("пустой ответ даёт пустой массив без падения", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ cursor: "", total: 0, items: [] })))
    expect(await fetchOzonStocks(CREDS)).toEqual([])
  })
})

describe("fetchOzonBarcodes — штрихкоды по артикулам", () => {
  it("режет на пачки по 1000 и склеивает карту артикул → штрихкоды", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { offer_id: string[] }
      return response({
        items: body.offer_id.map((offerId, i) => ({ id: i, offer_id: offerId, sku: i, name: "т", barcodes: [`bc-${offerId}`] })),
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const ids = Array.from({ length: 1001 }, (_, i) => `O-${i}`)
    const map = await fetchOzonBarcodes(CREDS, ids)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(map.size).toBe(1001)
    expect(map.get("O-1000")).toEqual(["bc-O-1000"])
  })

  it("повторяющиеся артикулы спрашивает один раз", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ items: [] }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchOzonBarcodes(CREDS, ["A", "A", "B"])

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { offer_id: string[] }
    expect(body.offer_id).toEqual(["A", "B"])
  })

  it("на пустом списке не делает запроса вовсе", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    expect((await fetchOzonBarcodes(CREDS, [])).size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("товар без штрихкодов даёт пустой список, а не отсутствие ключа", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ items: [{ id: 1, offer_id: "A", sku: 1, name: "т", barcodes: null }] })))
    const map = await fetchOzonBarcodes(CREDS, ["A"])
    expect(map.get("A")).toEqual([])
  })
})

describe("fetchOzonPostings — формат дат", () => {
  it("режет миллисекунды: площадка ждёт ГГГГ-ММ-ДДTЧЧ:ММ:ССZ", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ postings: [], has_next: false }))
    vi.stubGlobal("fetch", fetchMock)

    await fetchOzonPostings(CREDS, "2026-08-01T00:00:00.000Z")

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as { filter: { since: string; to: string } }
    expect(body.filter.since).toBe("2026-08-01T00:00:00Z")
    expect(body.filter.to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })
})
