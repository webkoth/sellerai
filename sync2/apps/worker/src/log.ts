import pino, { type DestinationStream, type Logger } from "pino"

export type { Logger }

/**
 * Пути, которые pino маскирует в любом объекте лога (и на первом уровне, и
 * вложенно через `*.`) — токены и заголовок авторизации площадок не должны
 * попасть в лог-файл, который может уйти в чат или в support.
 */
const REDACT_PATHS = ["token", "apiKey", "*.token", "*.apiKey", "headers.Authorization", "*.headers.Authorization", "err.config.headers"]

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
