import pino, { type DestinationStream, type Logger } from "pino"

export type { Logger }

/** JSON-лог. У каждого запуска — child с run_id и job (см. withRun). */
export function createLogger(level: string, dest?: DestinationStream): Logger {
  const opts = { level, base: { app: "sync2" }, timestamp: pino.stdTimeFunctions.isoTime }
  return dest ? pino(opts, dest) : pino(opts)
}
