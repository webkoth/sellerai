// Перенесено из finstock (27.09.2026): packages/platforms/src/types.ts:47-88.
import type { Channel } from "@sync2/shared"

/** Кто именно ответил. В sync2 источник запроса — всегда площадка синка. */
export type ApiSource = Channel

/**
 * Ошибка чужого API с кодом — по нему синк решает, что делать дальше.
 *
 * `body` — тело ответа: разобранный JSON, если площадка прислала JSON, иначе
 * сырой текст (пустая строка, если тела нет). Нужно там, где один и тот же
 * HTTP-код значит разное: у Ozon `404 {"code": 5}` на отчёте о реализации —
 * «ещё не опубликован», а `404` с другим кодом — настоящая ошибка. Параметр
 * необязательный, чтобы существующие места создания ошибки не менялись.
 */
export class PlatformApiError extends Error {
  constructor(
    readonly platform: ApiSource,
    readonly status: number,
    message: string,
    readonly body: unknown = undefined,
  ) {
    super(message)
    this.name = "PlatformApiError"
  }
}

/**
 * Упор в лимит. resetSeconds — через сколько можно повторить, null — неизвестно.
 * `status` — HTTP-код, которым площадка это сказала: 429 у всех, кроме
 * Яндекс.Маркета, у которого 420. По умолчанию 429, чтобы существующие
 * места создания ошибки не менялись.
 */
export class RateLimitError extends PlatformApiError {
  constructor(
    platform: ApiSource,
    readonly resetSeconds: number | null,
    message: string,
    body: unknown = undefined,
    status: number = 429,
  ) {
    super(platform, status, message, body)
    this.name = "RateLimitError"
  }
}
