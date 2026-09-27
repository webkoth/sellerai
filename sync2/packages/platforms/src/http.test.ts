import { afterEach, describe, expect, it, vi } from "vitest"
import { PlatformApiError, RateLimitError } from "./errors"
import { requestJson, requestJsonOrNull } from "./http"

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function response(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

describe("requestJson", () => {
  it("обрыв соединения повторяется по тому же расписанию", async () => {
    // `fetch` бросает раньше, чем появится ответ, — до разбора кодов дело не
    // доходит. Без повтора одна оборванная TCP-сессия роняла весь прогон
    // джобы: так и случилось на живом прогоне тарифов 23.09.2026.
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("terminated"))
      .mockResolvedValue(response(200, { ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      requestJson("ym", "https://example.test", { token: "t", retryDelaysMs: [0] }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("обрыв на последней попытке падает понятной ошибкой, а не голым terminated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("terminated")))
    await expect(
      requestJson("ym", "https://example.test", { token: "t", retryDelaysMs: [] }),
    ).rejects.toThrow(PlatformApiError)
    await expect(
      requestJson("ym", "https://example.test", { token: "t", retryDelaysMs: [] }),
    ).rejects.toThrow(/сеть: terminated/)
  })

  it("возвращает разобранный ответ при успехе", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(200, { ok: true })),
    )
    await expect(requestJson("wb", "https://example.test", { token: "t" })).resolves.toEqual({
      ok: true,
    })
  })

  it("повторяет запрос после 429 и отдаёт результат", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429, { error: "too many" }, { "retry-after": "0" }))
      .mockResolvedValueOnce(response(200, { ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      requestJson("wb", "https://example.test", { token: "t", retryDelaysMs: [0, 0] }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("после исчерпания попыток бросает ошибку лимита с временем сброса", async () => {
    // Пустое расписание — попыток на повтор нет вовсе (attempt < delays.length
    // ложно уже на первой попытке), поэтому первый же 429 бросает ошибку
    // немедленно, не дожидаясь настоящих 42 секунд из заголовка.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(429, { error: "too many" }, { "retry-after": "42" })),
    )
    const promise = requestJson("wb", "https://example.test", { token: "t", retryDelaysMs: [] })
    await expect(promise).rejects.toBeInstanceOf(RateLimitError)
    await expect(promise).rejects.toMatchObject({ resetSeconds: 42 })
  })

  it("ждёт ровно столько, сколько указала площадка, даже если своё расписание короче", async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429, { error: "too many" }, { "retry-after": "5" }))
      .mockResolvedValueOnce(response(200, { ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    // Расписание намеренно короче заголовка — если бы оно побеждало,
    // повтор ушёл бы почти сразу, а не через 5 секунд.
    const promise = requestJson("wb", "https://example.test", {
      token: "t",
      retryDelaysMs: [0],
    })

    await vi.advanceTimersByTimeAsync(4999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("отвергает отрицательное значение retry-after, откатываясь на своё расписание", async () => {
    // JS трактует sleep(-N) как sleep(0) — если бы отрицательное значение
    // принималось как есть, повтор ушёл бы почти сразу вместо ожидания
    // положенных по расписанию 7 секунд.
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429, { error: "too many" }, { "retry-after": "-5" }))
      .mockResolvedValueOnce(response(200, { ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    const promise = requestJson("wb", "https://example.test", {
      token: "t",
      retryDelaysMs: [7_000],
    })

    await vi.advanceTimersByTimeAsync(6_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("retry-after больше потолка — бросает немедленно, не засыпая", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(429, { error: "too many" }, { "retry-after": "121" }))
    vi.stubGlobal("fetch", fetchMock)

    // Попытки в расписании ещё остались — потолок должен сработать раньше,
    // чем они закончатся сами по себе.
    const promise = requestJson("wb", "https://example.test", {
      token: "t",
      retryDelaysMs: [0, 0],
    })
    await expect(promise).rejects.toBeInstanceOf(RateLimitError)
    await expect(promise).rejects.toMatchObject({ resetSeconds: 121 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("кладёт разобранное JSON-тело ошибки в PlatformApiError.body", async () => {
    // Ozon отвечает на отчёт о реализации `404 {"code": 5}` — «ещё не
    // опубликован» — и это единственный способ отличить его от настоящего 404.
    // Без тела в ошибке клиенту пришлось бы разбирать усечённое сообщение.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(404, { code: 5, message: "Report was not found" })),
    )

    const promise = requestJson("ozon", "https://example.test", { token: "t" })
    await expect(promise).rejects.toBeInstanceOf(PlatformApiError)
    await expect(promise).rejects.toMatchObject({
      status: 404,
      body: { code: 5, message: "Report was not found" },
    })
  })

  it("не-JSON тело ошибки отдаёт строкой как есть, а не роняет разбор", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 })),
    )

    await expect(
      requestJson("wb", "https://example.test", { token: "t", retryDelaysMs: [] }),
    ).rejects.toMatchObject({ status: 502, body: "<html>bad gateway</html>" })
  })

  it("не повторяет запрос при 401 — токен не станет валиднее", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(401, { error: "unauthorized" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      requestJson("wb", "https://example.test", { token: "t", retryDelaysMs: [0, 0] }),
    ).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("возвращает null на 204 — тела нет, и .json() на нём бросает SyntaxError", async () => {
    // Новое финансовое API WB отвечает 204 без тела, когда данных для очередной
    // страницы больше нет. response.ok истинен и для 204 (диапазон 200–299),
    // поэтому без отдельной ветки requestJson попытался бы распарсить пустое
    // тело как JSON и упал бы ровно на последней странице каждого отчёта.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(requestJsonOrNull("wb", "https://example.test", { token: "t" })).resolves.toBeNull()
  })

  it("пустое тело 200 — null у requestJsonOrNull", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })))
    await expect(requestJsonOrNull("wb", "https://example.test", { token: "t" })).resolves.toBeNull()
  })

  it("requestJson не отдаёт null: 204 или пустое тело — PlatformApiError с кодом ответа", async () => {
    // Тип requestJson — T без null: Ozon/ЯМ/KIT разбирают тело без проверки, и
    // пустой ответ там — сбой площадки, а не «данных нет».
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })))
    await expect(requestJson("ozon", "https://example.test", { token: "t" })).rejects.toMatchObject({ status: 204, message: expect.stringMatching(/пуст/) })
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })))
    await expect(requestJson("ym", "https://example.test", { token: "t" })).rejects.toMatchObject({ status: 200 })
  })

  it("420 Яндекс.Маркета — лимит: пауза по своему расписанию, затем повтор и успех", async () => {
    // У ЯМ упор в лимит — не 429, а 420 (спецификация: «превышено
    // ограничение на доступ к ресурсу»). Без заголовка со сроком пауза
    // берётся из расписания, как у 429: если бы 420 считался обычной
    // четырёхсотой, повтора не было бы вовсе и первый же ответ упал бы.
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(420, { errors: [{ code: "LIMIT", message: "limit" }] }))
      .mockResolvedValueOnce(response(200, { ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    const promise = requestJson("ym", "https://example.test", {
      token: "t",
      authHeader: "Api-Key",
      retryDelaysMs: [7_000],
    })

    await vi.advanceTimersByTimeAsync(6_999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("420 после исчерпания попыток — RateLimitError с кодом 420 и сроком из x-ratelimit-resource-until", async () => {
    // Заголовок ЯМ несёт не число секунд, а момент конца окна HTTP-датой
    // (журнал разведки 09.09.2026). Срок — разница с текущим временем.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-09T15:17:31.000Z"))
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(420, { errors: [] }, { "x-ratelimit-resource-until": "Wed, 09 Sep 2026 15:18:00 GMT" }),
      ),
    )

    const promise = requestJson("ym", "https://example.test", { token: "t", retryDelaysMs: [] })
    await expect(promise).rejects.toBeInstanceOf(RateLimitError)
    await expect(promise).rejects.toMatchObject({ status: 420, resetSeconds: 29 })
  })

  it("420 без заголовка — resetSeconds 120: окно лимита ЯМ две минуты", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(420, { errors: [] })))

    const promise = requestJson("ym", "https://example.test", { token: "t", retryDelaysMs: [] })
    await expect(promise).rejects.toBeInstanceOf(RateLimitError)
    await expect(promise).rejects.toMatchObject({ status: 420, resetSeconds: 120 })
  })

  it("x-ratelimit-resource-until в прошлом — как отсутствие заголовка, не отрицательный срок", async () => {
    // Часы разошлись или ответ шёл долго: момент конца окна уже позади.
    // Отрицательный срок — мусор (см. retry-after), для 420 это значит 120.
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-09T15:18:05.000Z"))
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(420, { errors: [] }, { "x-ratelimit-resource-until": "Wed, 09 Sep 2026 15:18:00 GMT" }),
      ),
    )

    await expect(
      requestJson("ym", "https://example.test", { token: "t", retryDelaysMs: [] }),
    ).rejects.toMatchObject({ resetSeconds: 120 })
  })

  it("429 не трогает умолчание ЯМ: без заголовка resetSeconds остаётся null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(429, { error: "too many" })))

    await expect(
      requestJson("wb", "https://example.test", { token: "t", retryDelaysMs: [] }),
    ).rejects.toMatchObject({ status: 429, resetSeconds: null })
  })

  it("повторяет пятисотые", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(503, { error: "unavailable" }))
      .mockResolvedValueOnce(response(200, { ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      requestJson("wb", "https://example.test", { token: "t", retryDelaysMs: [0, 0] }),
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("зависший ответ обрывается по таймауту и повторяется как сетевой сбой", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    )
    vi.stubGlobal("fetch", fetchMock)
    await expect(
      requestJson("kit", "https://api.kit.yandex.net/v1/orders", { token: "t", timeoutMs: 20, retryDelaysMs: [0] }),
    ).rejects.toMatchObject({ status: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("тело ответа не дочиталось до таймаута — повтор, затем PlatformApiError со статусом 0", async () => {
    const bodyTimeout = () =>
      ({ ok: true, status: 200, headers: new Headers(), text: () => Promise.reject(new DOMException("t", "TimeoutError")) }) as unknown as Response
    const fetchMock = vi.fn(async () => bodyTimeout())
    vi.stubGlobal("fetch", fetchMock)
    await expect(requestJson("kit", "https://api.kit.yandex.net/v1/orders", { token: "t", retryDelaysMs: [0] })).rejects.toMatchObject({ status: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("обрыв сокета посреди тела (terminated) — сетевой сбой с повтором, а не падение прогона", async () => {
    // undici бросает TypeError("terminated") из чтения тела, когда площадка
    // оборвала соединение после заголовков: это не таймаут, но тот же сетевой сбой.
    const broken = { ok: true, status: 200, headers: new Headers(), text: () => Promise.reject(new TypeError("terminated")) } as unknown as Response
    const fetchMock = vi.fn().mockResolvedValueOnce(broken).mockResolvedValue(response(200, { ok: true }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(requestJson("ym", "https://example.test", { token: "t", retryDelaysMs: [0] })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("обрыв тела на последней попытке — PlatformApiError «сеть: terminated»", async () => {
    const broken = () => ({ ok: true, status: 200, headers: new Headers(), text: () => Promise.reject(new TypeError("terminated")) }) as unknown as Response
    vi.stubGlobal("fetch", vi.fn(async () => broken()))
    await expect(requestJson("ym", "https://example.test", { token: "t", retryDelaysMs: [] })).rejects.toMatchObject({
      status: 0,
      message: expect.stringMatching(/сеть: terminated/),
    })
  })

  it("битый JSON в теле 200 — не сетевой сбой: без повтора, ошибка разбора наружу", async () => {
    const fetchMock = vi.fn(async () => new Response("{не json", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(requestJson("wb", "https://example.test", { token: "t", retryDelaysMs: [0] })).rejects.toThrow(SyntaxError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
