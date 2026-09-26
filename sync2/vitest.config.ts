import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))

// Пакеты воркспейса лежат в node_modules симлинком, а node_modules Vitest не
// преобразует. Псевдонимы прямо на исходники снимают вопрос целиком (как в finstock).
const alias = {
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
          include: ["packages/**/src/**/*.db.test.ts"],
          environment: "node",
          // Тесты базы делят одну тестовую базу — параллельно нельзя.
          fileParallelism: false,
        },
      },
    ],
  },
})
