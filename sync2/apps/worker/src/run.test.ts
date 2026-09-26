import { describe, expect, it } from "vitest"
import type { RunFinish, RunStart, RunStore } from "@sync2/shared"
import { createLogger } from "./log"
import { withRun } from "./run"

function memoryStore(opts: { failFinish?: boolean } = {}) {
  const started: RunStart[] = []
  const finished: Array<{ runId: string } & RunFinish> = []
  const store: RunStore = {
    start: async (r) => void started.push(r),
    finish: async (runId, r) => {
      if (opts.failFinish) throw new Error("соединение с базой потеряно")
      finished.push({ runId, ...r })
    },
  }
  return { store, started, finished }
}

const lines: string[] = []
const log = createLogger("debug", { write: (s: string) => void lines.push(s) })
const deps = (store: RunStore) => ({
  store,
  log,
  writeMode: "dry-run" as const,
  now: () => new Date("2026-09-26T10:00:00Z"),
  newId: () => "00000000-0000-4000-8000-00000000000a",
})

describe("withRun", () => {
  it("успех: start, затем finish ok со счётчиками", async () => {
    const m = memoryStore()
    const r = await withRun("ping", deps(m.store), async () => ({ counters: { read: 5 } }))
    expect(r).toEqual({ runId: "00000000-0000-4000-8000-00000000000a", status: "ok", counters: { read: 5 }, error: null })
    expect(m.started[0]).toMatchObject({ job: "ping", writeMode: "dry-run", startedAt: "2026-09-26T10:00:00.000Z" })
    expect(m.finished[0]).toMatchObject({ status: "ok", counters: { read: 5 }, error: null })
  })

  it("джоба сама говорит partial — так и записывается", async () => {
    const m = memoryStore()
    const r = await withRun("stocks", deps(m.store), async () => ({ status: "partial", counters: { skipped: 2 } }))
    expect(r.status).toBe("partial")
    expect(m.finished[0]!.status).toBe("partial")
  })

  it("джоба упала — failed с текстом, исключение наружу не летит", async () => {
    const m = memoryStore()
    const r = await withRun("orders", deps(m.store), async () => {
      throw new Error("429 от Ozon")
    })
    expect(r).toMatchObject({ status: "failed", error: "429 от Ozon" })
    expect(m.finished[0]).toMatchObject({ status: "failed", error: "429 от Ozon", counters: {} })
  })

  it("сбой закрывающей записи не превращает успех в провал", async () => {
    const m = memoryStore({ failFinish: true })
    const r = await withRun("ping", deps(m.store), async () => ({ counters: { read: 1 } }))
    expect(r.status).toBe("ok")
    expect(lines.some((l) => l.includes("не удалось закрыть запись журнала"))).toBe(true)
  })

  it("контекст джобы несёт run_id и лог с run_id", async () => {
    const m = memoryStore()
    let seen = ""
    await withRun("ping", deps(m.store), async (ctx) => {
      seen = ctx.runId
      ctx.log.info("внутри")
      return { counters: {} }
    })
    expect(seen).toBe("00000000-0000-4000-8000-00000000000a")
    const inner = lines.map((l) => JSON.parse(l)).find((x) => x.msg === "внутри")
    expect(inner).toMatchObject({ run_id: seen, job: "ping" })
  })

  it("ошибка журнала записей — итоги по позициям попадают в лог", async () => {
    const m = memoryStore()
    const outcomes = [{ barcode: "A", applied: true }]
    const err = Object.assign(new Error("журнал записей не сохранён"), { outcomes })
    const r = await withRun("writes-journal", deps(m.store), async () => {
      throw err
    })
    expect(r.status).toBe("failed")
    const entry = lines.map((l) => JSON.parse(l)).find((x) => x.msg === "джоба упала" && x.job === "writes-journal")
    expect(entry?.outcomes?.[0]?.barcode).toBe("A")
  })
})
