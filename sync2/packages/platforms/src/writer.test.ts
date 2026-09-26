import { describe, expect, it, vi } from "vitest"
import { WRITE_MODES, type Channel, type WriteMode } from "@sync2/shared"
import { effectiveMode, executeWrites, WriteJournalError, type SendResult, type WriteOp, type WriteOutcome } from "./writer"

const allModes = (mode: WriteMode): Record<Channel, WriteMode> => ({
  wb: mode,
  ozon: mode,
  ym: mode,
  kit: mode,
  site: mode,
})

const op = (channel: Channel, barcode: string, after: number): WriteOp => ({
  channel,
  barcode,
  field: "stock",
  before: 0,
  after,
})

const okSender = () =>
  vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> =>
    ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true, response: { accepted: true } })),
  )

async function run(ops: WriteOp[], globalMode: WriteMode, channelModes: Record<Channel, WriteMode>, send = okSender()) {
  const recorded: WriteOutcome[] = []
  const outcomes = await executeWrites(ops, {
    globalMode,
    channelModes,
    send,
    record: async (o) => {
      recorded.push(...o)
    },
  })
  return { outcomes, recorded, send }
}

describe("effectiveMode", () => {
  it("берётся меньший из глобального и площадки", () => {
    expect(effectiveMode("apply", "off")).toBe("off")
    expect(effectiveMode("off", "apply")).toBe("off")
    expect(effectiveMode("apply", "dry-run")).toBe("dry-run")
    expect(effectiveMode("apply", "apply")).toBe("apply")
  })
})

describe("executeWrites", () => {
  it("off: ни одного сетевого вызова, всё записано как неприменённое", async () => {
    const { outcomes, recorded, send } = await run([op("kit", "A", 1)], "off", allModes("apply"))
    expect(send).not.toHaveBeenCalled()
    expect(outcomes).toEqual(recorded)
    expect(outcomes[0]).toMatchObject({ mode: "off", applied: false, error: null })
  })

  it("dry-run: ни одного сетевого вызова, режим dry-run в журнале", async () => {
    const { outcomes, send } = await run([op("kit", "A", 1)], "dry-run", allModes("apply"))
    expect(send).not.toHaveBeenCalled()
    expect(outcomes[0]).toMatchObject({ mode: "dry-run", applied: false })
  })

  it("apply глобально, но площадка off — эта площадка не трогается", async () => {
    const modes = { ...allModes("apply"), ozon: "off" as const }
    const { outcomes, send } = await run([op("kit", "A", 1), op("ozon", "A", 1)], "apply", modes)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toBe("kit")
    expect(outcomes.find((o) => o.channel === "ozon")).toMatchObject({ mode: "off", applied: false })
    expect(outcomes.find((o) => o.channel === "kit")).toMatchObject({ mode: "apply", applied: true })
  })

  it("apply: один вызов на площадку со всеми её операциями", async () => {
    const { send } = await run([op("kit", "A", 1), op("kit", "B", 2), op("site", "A", 1)], "apply", allModes("apply"))
    expect(send).toHaveBeenCalledTimes(2)
    const kitCall = send.mock.calls.find((c) => c[0] === "kit")!
    expect(kitCall[1].map((o) => o.barcode)).toEqual(["A", "B"])
  })

  it("площадка ответила отказом по позиции — applied=false с текстом ошибки", async () => {
    const send = vi.fn(async (): Promise<SendResult[]> => [
      { barcode: "A", field: "stock", ok: false, error: "товар на модерации" },
    ])
    const { outcomes } = await run([op("kit", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes[0]).toMatchObject({ applied: false, error: "товар на модерации" })
  })

  it("площадка не вернула результат по позиции — это ошибка, а не успех", async () => {
    const send = vi.fn(async (): Promise<SendResult[]> => [])
    const { outcomes } = await run([op("kit", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes[0]).toMatchObject({ applied: false, error: "площадка не вернула результат по позиции" })
  })

  it("вызов площадки упал — все её позиции с ошибкой, другие площадки пишутся", async () => {
    const send = vi.fn(async (channel: Channel, ops: WriteOp[]): Promise<SendResult[]> => {
      if (channel === "kit") throw new Error("ECONNRESET")
      return ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true }))
    })
    const { outcomes } = await run([op("kit", "A", 1), op("site", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes.find((o) => o.channel === "kit")).toMatchObject({ applied: false, error: "ECONNRESET" })
    expect(outcomes.find((o) => o.channel === "site")).toMatchObject({ applied: true })
  })

  it("запись ушла, журнал упал — ошибка несёт итоги по позициям", async () => {
    const send = okSender()
    let caught: unknown
    try {
      await executeWrites([op("kit", "A", 1)], {
        globalMode: "apply",
        channelModes: allModes("apply"),
        send,
        record: async () => {
          throw new Error("ETIMEDOUT")
        },
      })
    } catch (e) {
      caught = e
    }
    expect(send).toHaveBeenCalledTimes(1)
    expect(caught).toBeInstanceOf(WriteJournalError)
    const err = caught as WriteJournalError
    expect(err.message).toBe("журнал записей не сохранён: ETIMEDOUT")
    expect(err.outcomes[0]).toMatchObject({ applied: true })
  })

  it("площадка вернула не список — ошибка по её позициям, другие пишутся", async () => {
    const send = vi.fn(async (channel: Channel): Promise<SendResult[]> => {
      if (channel === "kit") return null as unknown as SendResult[]
      return [{ barcode: "A", field: "stock", ok: true }]
    })
    const { outcomes } = await run([op("kit", "A", 1), op("site", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes.find((o) => o.channel === "kit")).toMatchObject({
      applied: false,
      error: "площадка вернула ответ не списком",
    })
    expect(outcomes.find((o) => o.channel === "site")).toMatchObject({ applied: true })
  })

  it("дубль операции — ошибка до любой отправки", async () => {
    const send = okSender()
    const record = vi.fn(async () => {})
    const dupOps = [op("kit", "A", 1), op("kit", "A", 2)]
    await expect(
      executeWrites(dupOps, { globalMode: "apply", channelModes: allModes("apply"), send, record }),
    ).rejects.toThrow("дубль операции записи: kit/A/stock")
    expect(send).not.toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
  })

  it("площадки нет в channelModes — off, отправки нет, режим в журнале валиден", async () => {
    const { wb, ozon, ym, site } = allModes("apply")
    const modes = { wb, ozon, ym, site } as Record<Channel, WriteMode> // kit намеренно отсутствует
    const { outcomes, send } = await run([op("kit", "A", 1)], "apply", modes)
    expect(send).not.toHaveBeenCalled()
    expect(outcomes[0]).toMatchObject({ mode: "off", applied: false })
    expect(WRITE_MODES).toContain(outcomes[0]!.mode)
  })

  it("неизвестная площадка в операции — не отправляется", async () => {
    const send = okSender()
    const unknownChannel = "foo" as Channel
    const modes = { ...allModes("apply"), [unknownChannel]: "apply" } as Record<Channel, WriteMode>
    const { outcomes } = await run([op(unknownChannel, "A", 1)], "apply", modes, send)
    expect(send).not.toHaveBeenCalled()
    expect(outcomes[0]).toMatchObject({ mode: "off", applied: false })
  })

  it("ошибка не-Error: объект превращается в JSON", async () => {
    const send = vi.fn(async (): Promise<SendResult[]> => {
      throw { code: 429 }
    })
    const { outcomes } = await run([op("kit", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes[0]).toMatchObject({ applied: false, error: '{"code":429}' })
  })
})
