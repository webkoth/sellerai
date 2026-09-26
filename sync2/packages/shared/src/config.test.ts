import { describe, expect, it } from "vitest"
import { loadConfig } from "./config"

const base = { DATABASE_URL: "postgres://localhost:5432/sync2" }

describe("loadConfig", () => {
  it("по умолчанию запись выключена, лог info", () => {
    expect(loadConfig(base)).toEqual({
      databaseUrl: "postgres://localhost:5432/sync2",
      writeMode: "off",
      logLevel: "info",
    })
  })

  it("берёт режим записи и уровень лога из окружения", () => {
    const c = loadConfig({ ...base, SYNC_WRITE_MODE: "dry-run", LOG_LEVEL: "debug" })
    expect(c.writeMode).toBe("dry-run")
    expect(c.logLevel).toBe("debug")
  })

  it("без DATABASE_URL — ошибка с понятным текстом", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/)
  })

  it("опечатка в режиме записи — ошибка", () => {
    expect(() => loadConfig({ ...base, SYNC_WRITE_MODE: "yes" })).toThrow(/режим записи/)
  })
})
