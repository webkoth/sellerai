import pino, { type DestinationStream, type Logger } from "pino"

export type { Logger }

/** Поля-секреты: на первом уровне, на втором (`*.`) и на третьем (`*.*.`, например cfg.ozon.apiKey). */
const SECRET_KEYS = ["token", "apiKey", "password"]
/** Заголовки с секретом: WB/ЯМ/KIT — Authorization (fetch пишет и строчным), Ozon — Api-Key. Client-Id не секрет. */
const SECRET_HEADERS = ['["Authorization"]', '["authorization"]', '["Api-Key"]', '["api-key"]']

/**
 * Пути, которые pino маскирует в любом объекте лога — токены, пароли и
 * заголовки авторизации площадок не должны попасть в лог-файл, который может
 * уйти в чат или в support.
 */
const REDACT_PATHS = [
  ...SECRET_KEYS.flatMap((k) => [k, `*.${k}`, `*.*.${k}`]),
  ...SECRET_HEADERS.flatMap((h) => [`headers${h}`, `*.headers${h}`]),
  "err.config.headers",
]

/** JSON-лог. У каждого запуска — child с run_id и job (см. withRun). */
export function createLogger(level: string, dest?: DestinationStream): Logger {
  const opts = {
    level,
    base: { app: "sync2" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[скрыто]" },
  }
  return dest ? pino(opts, dest) : pino(opts)
}
