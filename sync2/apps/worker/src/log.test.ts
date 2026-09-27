import { describe, expect, it } from "vitest"
import { createLogger } from "./log"

function capture() {
  const lines: string[] = []
  return { lines, dest: { write: (s: string) => void lines.push(s) } }
}

describe("createLogger", () => {
  it("пишет JSON с приложением, run_id, сообщением и ISO-временем", () => {
    const { lines, dest } = capture()
    createLogger("info", dest).child({ run_id: "r-1", job: "ping" }).info({ written: 3 }, "готово")
    const rec = JSON.parse(lines[0]!)
    expect(rec).toMatchObject({ app: "sync2", run_id: "r-1", job: "ping", written: 3, msg: "готово", level: 30 })
    expect(rec.time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("уровень отсекает мелкие записи", () => {
    const { lines, dest } = capture()
    const log = createLogger("warn", dest)
    log.info("не должно попасть")
    log.warn("должно")
    expect(lines).toHaveLength(1)
  })

  it("секреты в лог не попадают", () => {
    const { lines, dest } = capture()
    createLogger("info", dest).info({ token: "SECRET1", cfg: { apiKey: "SECRET2", token: "SECRET3" }, headers: { Authorization: "Bearer SECRET4" } }, "x")
    expect(lines[0]).not.toMatch(/SECRET/)
  })

  it("секреты глубже второго уровня, пароли и заголовки Ozon/строчные — тоже скрыты; Client-Id не секрет", () => {
    const { lines, dest } = capture()
    createLogger("info", dest).info(
      {
        password: "SECRET0",
        cfg: { ozon: { apiKey: "SECRET1", token: "SECRET2", password: "SECRET3" }, db: { password: "SECRET4" } },
        headers: { "Api-Key": "SECRET5", "Client-Id": "12345", authorization: "Bearer SECRET6" },
        req: { headers: { "api-key": "SECRET7", authorization: "SECRET8", Authorization: "SECRET9" } },
      },
      "x",
    )
    expect(lines[0]).not.toMatch(/SECRET/)
    expect(JSON.parse(lines[0]!).headers["Client-Id"]).toBe("12345")
  })
})
