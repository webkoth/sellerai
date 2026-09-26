import { parseWriteMode, type WriteMode } from "./channels"

export interface Config {
  databaseUrl: string
  /** Глобальный режим записи. Действующий режим площадки — меньший из этого и её собственного. */
  writeMode: WriteMode
  logLevel: string
}

/** Окружение передаётся параметром, а не читается из process.env: функция чистая и тестируется. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const databaseUrl = env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error("DATABASE_URL не задан — см. sync2/.env.example")
  return {
    databaseUrl,
    writeMode: parseWriteMode(env.SYNC_WRITE_MODE, "off"),
    logLevel: env.LOG_LEVEL?.trim() || "info",
  }
}
