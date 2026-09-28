// Перенесено из finstock (27.09.2026): packages/platforms/src/http.ts.
import { PlatformApiError, RateLimitError, type ApiSource } from "./errors"

/**
 * Паузы между повторами. Лимиты площадок жёсткие: у WB отчёт о реализации
 * отдаётся примерно раз в минуту, поэтому ждать имеет смысл долго, а не
 * долбить в цикле.
 */
const DEFAULT_RETRY_DELAYS_MS = [10_000, 30_000, 60_000, 60_000]

/**
 * Потолок ожидания, которое мы готовы честно проспать по указанию площадки
 * (заголовок retry-after). Без потолка площадка, ответившая, скажем,
 * retry-after: 3600, усыпит джобу синка на час внутри одного HTTP-запроса —
 * планировщик не увидит зависшую джобу и не сможет её перезапустить.
 * 120 секунд — с запасом больше цикла лимита WB на отчёт о реализации
 * (примерно раз в минуту), но достаточно мало, чтобы джоба не зависала.
 * Если площадка просит больше — не спим вовсе, бросаем ошибку лимита сразу
 * с этим временем в resetSeconds, и решение — ждать или отступить — остаётся
 * за планировщиком синка, а не за одним HTTP-запросом.
 */
const RETRY_AFTER_CAP_MS = 120_000

/**
 * Чем считать лимит Яндекс.Маркета, если он не сказал, когда снимется.
 * Площадка отвечает на упор в лимит не 429, а 420, и по наблюдению разведки
 * (09.09.2026) окно генерации отчёта — две минуты, выровненные по чётной
 * минуте часов. Значение уходит только в `resetSeconds` брошенной ошибки:
 * решение о паузе перед повтором без заголовка принимает своё расписание,
 * как и у 429.
 */
const YM_LIMIT_DEFAULT_RESET_SECONDS = 120

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Секунды до сброса лимита из заголовков ответа. null — площадка не сказала
 * или прислала мусор.
 *
 * Порядок: retry-after — стандартный HTTP-заголовок. Дальше x-ratelimit-retry
 * перед x-ratelimit-reset — по примеру в документации WB это разные величины
 * (2 против 29): retry — секунды до разрешённого повтора, reset — секунды до
 * полного пополнения корзины лимита, что обычно намного дольше. Источник
 * подтвердить не удалось (страница лимитов WB не открылась), поэтому это
 * предположение, а не факт — проверить на реальном 429 в задаче 14. Порядок
 * безопасен в любом случае: если заголовка нет, проверяется следующий
 * по списку, а если нет и retry, остаётся прежнее поведение — только reset.
 *
 * Последним — x-ratelimit-resource-until Яндекс.Маркета. Это не число, а
 * МОМЕНТ конца окна лимита HTTP-датой (`Wed, 09 Sep 2026 15:18:00 GMT`,
 * журнал разведки 09.09.2026), поэтому переводится в секунды вычитанием
 * текущего времени. Момент в прошлом (часы разошлись, ответ шёл долго)
 * даёт отрицательное значение — оно отвергается ниже наравне с мусором.
 *
 * Отрицательное значение отвергается: JS трактует sleep(-N) как sleep(0),
 * то есть немедленный повтор вместо отката — площадка не могла иметь это
 * в виду, это мусор, и его нужно приравнять к отсутствию заголовка, чтобы
 * решение перешло к собственному расписанию.
 */
function parseRetryAfter(headers: Headers): number | null {
  const value =
    headers.get("retry-after") ??
    headers.get("x-ratelimit-retry") ??
    headers.get("x-ratelimit-reset")
  if (value) {
    const seconds = Number(value)
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
  }
  const until = headers.get("x-ratelimit-resource-until")
  if (!until) return null
  const untilMs = Date.parse(until)
  if (Number.isNaN(untilMs)) return null
  const seconds = Math.ceil((untilMs - Date.now()) / 1000)
  return seconds >= 0 ? seconds : null
}

/** Тело ответа с ошибкой: JSON — разобранным, иначе исходный текст. */
function parseErrorBody(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export interface RequestOptions {
  token: string
  method?: string
  body?: unknown
  headers?: Record<string, string>
  /** Заголовок авторизации. У WB — голый токен, у Ozon свои заголовки. */
  authHeader?: string
  retryDelaysMs?: number[]
  /**
   * Таймаут одного сетевого вызова, мс (по умолчанию 60 секунд). Без таймаута
   * зависший ответ площадки держал бы прогон и блокировку до следующего
   * крона.
   */
  timeoutMs?: number
  /**
   * Режим переадресации fetch; не задан — поведение fetch по умолчанию (follow).
   * "manual" — 30x не выполняется и становится PlatformApiError с кодом 30x без
   * повторов: токен в заголовке не уйдёт за переадресацией на другой хост (сайт).
   * Не "error": его отказ fetch бросает как сетевой сбой, и он повторялся бы по
   * расписанию пауз (минуты) ради заведомо того же ответа.
   */
  redirect?: RequestInit["redirect"]
}

const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Запрос к API площадки, для которого пустой ответ — законное «данных нет»:
 * 204 или пустое тело 200 дают null (так WB сообщает конец пагинации).
 * Тип результата это отражает — вызывающий обязан обработать null.
 */
export async function requestJsonOrNull<T = unknown>(
  platform: ApiSource,
  url: string,
  options: RequestOptions,
): Promise<T | null> {
  return (await request<T>(platform, url, options)).body
}

/**
 * Запрос к API площадки, который обязан вернуть JSON. Пустой ответ (204,
 * пустое тело, литерал null) — PlatformApiError с кодом ответа, а не null,
 * который вызывающий разобрал бы как объект и упал бы на чтении поля.
 */
export async function requestJson<T = unknown>(
  platform: ApiSource,
  url: string,
  options: RequestOptions,
): Promise<T> {
  const { status, body } = await request<T>(platform, url, options)
  if (body === null) throw new PlatformApiError(platform, status, `${platform}: пустой ответ ${status} — ожидался JSON`, null)
  return body
}

/**
 * Запрос к API площадки с откатом при лимитах и пятисотых.
 * Четырёхсотые, кроме 429 и 420, не повторяются: неверный токен или неверный
 * запрос не станут верными от повторения. 420 — это тот же упор в лимит, но
 * в исполнении Яндекс.Маркета (спецификация: «превышено ограничение на
 * доступ к ресурсу»), и обращение с ним то же, что с 429.
 */
async function request<T>(
  platform: ApiSource,
  url: string,
  options: RequestOptions,
): Promise<{ status: number; body: T | null }> {
  const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          [options.authHeader ?? "Authorization"]: options.token,
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        ...(options.redirect ? { redirect: options.redirect } : {}),
      })
    } catch (error: unknown) {
      // Обрыв соединения — не ответ площадки, а сеть: `fetch` бросает, и до
      // разбора кодов дело не доходит вовсе. Без этой ветки одна оборванная
      // TCP-сессия роняла весь прогон джобы — поймано живым прогоном тарифов
      // 23.09.2026 (`terminated` у Яндекс.Маркета, при том что тот же запрос
      // через секунду проходил). Таймаут (`AbortError`/`TimeoutError` от
      // `AbortSignal.timeout`) — тот же случай: площадка не ответила за
      // отведённое время, и это сетевой сбой, а не код ответа: без таймаута
      // зависший ответ площадки держал бы прогон и блокировку до следующего
      // крона старого синка.
      //
      // Расписание пауз то же, что у 429 и пятисотых: повторяем столько же
      // раз и с теми же задержками. Кончились попытки — падаем с понятным
      // текстом, а не с голым `terminated`.
      if (attempt < delays.length) {
        await sleep(delays[attempt] ?? 0)
        continue
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new PlatformApiError(platform, 0, `сеть: ${message}`, null)
    }

    // 204 — «нет данных». Тела у такого ответа нет, и .json() на нём бросает
    // SyntaxError. Новое финансовое API WB именно так сообщает конец
    // пагинации, то есть без этой ветки клиент падал бы на последней
    // странице каждого отчёта.
    if (response.status === 204) return { status: 204, body: null }
    if (response.ok) {
      // Тело читается через .text(), а не response.json(), и в отдельном try:
      // любое отклонение чтения — сетевой сбой, как и обрыв самого fetch.
      // Площадка ответила заголовками, но не дослала тело: таймаут
      // `AbortSignal.timeout` на чтении или обрыв сокета посреди тела
      // (`TypeError: terminated` у undici). Та же задержка из retryDelaysMs,
      // тот же PlatformApiError со статусом 0 по исчерпании попыток.
      // JSON.parse — снаружи: битое тело не станет целым от повтора.
      let text: string
      try {
        text = await response.text()
      } catch (error: unknown) {
        if (attempt < delays.length) {
          await sleep(delays[attempt] ?? 0)
          continue
        }
        const message = error instanceof Error ? error.message : String(error)
        throw new PlatformApiError(platform, 0, `сеть: ${message}`, null)
      }
      return { status: response.status, body: text.length > 0 ? (JSON.parse(text) as T | null) : null }
    }

    // Число попыток всегда ограничено своим расписанием (delays.length) — это
    // не меняется независимо от того, откуда взята пауза. Внутри этого лимита
    // пауза берётся из заголовка площадки, если он есть и укладывается
    // в потолок: WB прямо говорит, когда лимит снимется, и это надёжнее
    // собственного расписания. Заголовок без числа или молчание площадки —
    // используем своё расписание. Заголовок больше потолка — не спим вовсе,
    // сразу бросаем ошибку ниже с этим временем в resetSeconds.
    const rateLimited = response.status === 429 || response.status === 420
    const retryable = rateLimited || response.status >= 500
    // Заголовок читается один раз на ответ — и для решения о паузе, и (если
    // до этого дойдёт) для resetSeconds в брошенной ошибке ниже. Нужен он
    // только retryable-ответам: у остальных решение о паузе не принимается,
    // а RateLimitError бросается только при лимите, который retryable всегда.
    const retryAfterSeconds = retryable ? parseRetryAfter(response.headers) : null

    // Повтор POST/PUT записи (этап 1.4) безопасен только потому, что все писатели остатка шлют
    // АБСОЛЮТНЫЕ значения: повтор принятого тела ставит то же число. Писатель с дельтами (+1/−1)
    // через этот повтор пускать нельзя — обрыв после применения удвоил бы изменение.
    if (retryable && attempt < delays.length) {
      if (retryAfterSeconds === null) {
        await sleep(delays[attempt] ?? 0)
        continue
      }
      const retryAfterMs = retryAfterSeconds * 1000
      if (retryAfterMs <= RETRY_AFTER_CAP_MS) {
        await sleep(retryAfterMs)
        continue
      }
      // retryAfterMs > потолка: не спим — падаем на throw ниже,
      // resetSeconds в RateLimitError понесёт исходное значение заголовка.
    }

    const text = await response.text().catch(() => "")
    // Тело ошибки уходит в исключение разобранным: по нему клиент площадки
    // различает случаи с одинаковым HTTP-кодом (у Ozon `404 {"code": 5}` —
    // «отчёт ещё не опубликован», любой другой 404 — ошибка). Не-JSON
    // остаётся строкой как есть — площадки отвечают и HTML-заглушками.
    const body = parseErrorBody(text)
    if (rateLimited) {
      // 420 без заголовка — не «неизвестно», а окно в две минуты: у ЯМ
      // это единственный наблюдавшийся ритм лимита, и планировщику синка
      // лучше знать срок, чем гадать (см. YM_LIMIT_DEFAULT_RESET_SECONDS).
      const resetSeconds =
        retryAfterSeconds ?? (response.status === 420 ? YM_LIMIT_DEFAULT_RESET_SECONDS : null)
      throw new RateLimitError(
        platform,
        resetSeconds,
        `${platform}: упёрлись в лимит — ${text.slice(0, 200)}`,
        body,
        response.status,
      )
    }
    throw new PlatformApiError(
      platform,
      response.status,
      `${platform}: ${response.status} — ${text.slice(0, 200)}`,
      body,
    )
  }
}
