import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { resetKitPaceForTests } from "./client"
import { writeKitStocks } from "./stock-writer"

const WH = "01980d4c-1b53-7aa1-ab23-1b7c23604704"
const cfg = { token: "t", warehouseId: WH, retryDelaysMs: [0] }
const op = (barcode: string, variant: string, after: number): WriteOp => ({ channel: "kit", barcode, field: "stock", before: 0, after, externalSku: variant })
type Item = { variant_id: string; warehouse_id: string; quantity: number }

function stub(handler: (items: Item[]) => Response) {
  const bodies: Item[][] = []
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const items = (JSON.parse(String(init?.body)) as { items: Item[] }).items
    bodies.push(items)
    return handler(items)
  })
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock, bodies }
}

beforeEach(() => {
  resetKitPaceForTests()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeKitStocks", () => {
  it("bulk_update на склад продаж абсолютным числом, только quantity (reserved не трогаем); 204 без тела — применено", async () => {
    const { fetchMock, bodies } = stub(() => new Response(null, { status: 204 }))
    const r = await writeKitStocks(cfg, [op("A", "v-A", 2)])
    expect(r).toEqual([{ barcode: "A", field: "stock", ok: true, response: { variant_id: "v-A", quantity: 2 } }])
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.kit.yandex.net/v1/variants/stocks/bulk_update")
    expect(bodies[0]).toEqual([{ variant_id: "v-A", warehouse_id: WH, quantity: 2 }])
  })

  it("пустое тело 200 — тоже применено", async () => {
    stub(() => new Response("", { status: 200 }))
    expect((await writeKitStocks(cfg, [op("A", "v-A", 2)]))[0]).toMatchObject({ ok: true })
  })

  it("400 с ошибками элементов — батч атомарен: битые — отказ, остальные — один повтор без них", async () => {
    const { bodies } = stub((items) =>
      items.some((i) => i.variant_id === "v-bad")
        ? new Response(
            JSON.stringify({ code: "VALIDATION_ERROR", message: "bad", trace_id: "0", errors: [{ variant_id: "v-bad", warehouse_id: WH, code: "VARIANT_ARCHIVED", message: "archived" }] }),
            { status: 400 },
          )
        : new Response(null, { status: 204 }),
    )
    const r = await writeKitStocks(cfg, [op("A", "v-A", 2), op("B", "v-bad", 0)])
    expect(r.map((x) => [x.barcode, x.ok, x.error ?? null])).toEqual([
      ["B", false, "KIT: VARIANT_ARCHIVED"],
      ["A", true, null],
    ])
    expect(bodies.map((b) => b.map((i) => i.variant_id))).toEqual([["v-A", "v-bad"], ["v-A"]])
  })

  it("5xx после повторов — итог неизвестен", async () => {
    stub(() => new Response(JSON.stringify({ code: "INTERNAL", message: "x", trace_id: "0" }), { status: 500 }))
    expect((await writeKitStocks(cfg, [op("A", "v-A", 2)]))[0]).toMatchObject({ ok: false, uncertain: true })
  })

  it("по умолчанию — короткие повторы записи (2 с), а не минутные паузы чтения", async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      stub(() => (++calls === 1 ? new Response("oops", { status: 502 }) : new Response(null, { status: 204 })))
      const promise = writeKitStocks({ token: "t", warehouseId: WH }, [op("A", "v-A", 2)])
      await vi.advanceTimersByTimeAsync(2_000)
      await expect(promise).resolves.toEqual([expect.objectContaining({ ok: true })])
    } finally {
      vi.useRealTimers()
    }
  })
})
