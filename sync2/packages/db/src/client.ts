import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/** Соединение передаётся явно: воркер берёт URL из loadConfig, тесты — из TEST_DATABASE_URL. */
export function createDb(url: string, opts: { max?: number } = {}) {
  const client = postgres(url, { max: opts.max ?? 5, onnotice: () => {} })
  return { db: drizzle(client, { schema }), close: () => client.end() }
}

export type Db = ReturnType<typeof createDb>["db"]
