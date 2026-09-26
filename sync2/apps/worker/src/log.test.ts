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
})
