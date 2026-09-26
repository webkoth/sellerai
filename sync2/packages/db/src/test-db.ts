import { fileURLToPath } from "node:url"
import { sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { createDb } from "./client"

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url))

/**
 * Чистая тестовая база: схема public стирается целиком и накатывается миграциями.
 * Защита от ошибки конфигурации: имя базы обязано заканчиваться на _test.
 */
export async function freshTestDb() {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL не задан")
  const name = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "")
  if (!name.endsWith("_test")) throw new Error(`тестовая база должна оканчиваться на _test, а не "${name}"`)
  const handle = createDb(TEST_DATABASE_URL, { max: 1 })
  await handle.db.execute(sql`drop schema if exists public cascade`)
  await handle.db.execute(sql`drop schema if exists drizzle cascade`)
  await handle.db.execute(sql`create schema public`)
  await migrate(handle.db, { migrationsFolder })
  return handle
}

/**
 * Ждёт, что запрос нарушит ограничение `name`. Drizzle 0.44+ оборачивает ошибку базы
 * в DrizzleQueryError («Failed query: …»), а исходная ошибка postgres.js — в `cause`,
 * с полем `constraint_name`. Поэтому `.rejects.toThrow(/имя/)` здесь не работает.
 * Сравнение с `constraint_name` — точное, а не по вхождению: иначе будущее ограничение
 * `orders_raw_lifecycle_check_v2` молча пройдёт проверку, рассчитанную на `..._check`.
 * На вхождение в `message` откатываемся только тогда, когда `constraint_name` в ошибке нет.
 */
export async function expectConstraint(query: PromiseLike<unknown>, name: string): Promise<void> {
  const err = await Promise.resolve(query).then(
    () => null,
    (e: unknown) => e,
  )
  if (err === null) throw new Error(`ожидалось нарушение ${name}, но запрос прошёл`)
  const cause = ((err as { cause?: unknown }).cause ?? err) as { constraint_name?: string; message?: string }
  const matched = cause.constraint_name !== undefined ? cause.constraint_name === name : (cause.message ?? "").includes(name)
  if (!matched) {
    throw new Error(
      `ожидалось нарушение ${name}, получено: constraint_name="${cause.constraint_name ?? ""}" message="${cause.message ?? ""}"`,
    )
  }
}
