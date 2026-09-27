import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))

// Пакеты воркспейса лежат в node_modules симлинком, а node_modules Vitest не
// преобразует. Псевдонимы прямо на исходники снимают вопрос целиком (как в finstock).
// "@sync2/db/test-db" — ДО "@sync2/db": более короткий псевдоним перехватывает подпуть (урок finstock).
const alias = {
  "@sync2/db/test-db": fileURLToPath(new URL("./packages/db/src/test-db.ts", import.meta.url)),
  "@sync2/shared": pkg("shared"),
  "@sync2/db": pkg("db"),
  "@sync2/domain": pkg("domain"),
  "@sync2/platforms": pkg("platforms"),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
          exclude: ["**/*.db.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["packages/**/src/**/*.db.test.ts", "apps/**/src/**/*.db.test.ts"],
          environment: "node",
          // Тесты базы делят одну тестовую базу — параллельно нельзя.
          fileParallelism: false,
        },
      },
    ],
  },
})
