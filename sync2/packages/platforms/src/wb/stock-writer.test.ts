import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { writeWbStocks } from "./stock-writer"

const cfg = { token: "t", warehouseId: 1408913, retryDelaysMs: [0] }
const URL_STOCKS = "https://marketplace-api.wildberries.ru/api/v3/stocks/1408913"
const op = (barcode: string, chrtId: string | null, before: number, after: number): WriteOp => ({
  channel: "wb",
  barcode,
  field: "stock",
  before,
  after,
  externalSku: chrtId,
})

/**
 * Склад WB в памяти: POST — чтение остатков по штрихкодам (строки с нулём WB не отдаёт, как на проде),
 * PUT — запись по chrtId. `putStatus` — ответ на PUT; `ignorePut` — 204 без записи (неверные имена полей).
 */
function fakeWb(initial: Record<string, { chrtId: number; amount: number }>, opts: { putStatus?: number; ignorePut?: boolean } = {}) {
  const store = new Map(Object.entries(initial))
  const calls: Array<{ method: string; body: unknown }> = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ method, body })
    if (url !== URL_STOCKS) throw new Error(`неожиданный адрес ${url}`)
    if (method === "POST") {
      const skus = (body as { skus: string[] }).skus
      const stocks = skus
        .filter((sku) => (store.get(sku)?.amount ?? 0) > 0)
        .map((sku) => ({ sku, chrtId: store.get(sku)!.chrtId, amount: store.get(sku)!.amount }))
      return new Response(JSON.stringify({ stocks }), { status: 200 })
    }
    if (opts.putStatus !== undefined) return new Response(JSON.stringify([{ code: "NotFound", message: "not found" }]), { status: opts.putStatus })
    if (!opts.ignorePut) {
      for (const s of (body as { stocks: Array<{ chrtId: number; amount: number }> }).stocks) {
        for (const [sku, v] of store) if (v.chrtId === s.chrtId) store.set(sku, { ...v, amount: s.amount })
      }
    }
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal("fetch", fetchMock)
  return { calls, fetchMock }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeWbStocks", () => {
  it("перечитывает остаток, пишет chrtId абсолютным числом, проверяет чтением — применено", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 }, "222": { chrtId: 7002, amount: 0 } })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 0, 1)])
    expect(r).toEqual([
      { barcode: "111", field: "stock", ok: true, response: { chrtId: 7001, amount: 2 } },
      { barcode: "222", field: "stock", ok: true, response: { chrtId: 7002, amount: 1 } },
    ])
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "POST"])
    expect(wb.calls[1]!.body).toEqual({ stocks: [{ chrtId: 7001, amount: 2 }, { chrtId: 7002, amount: 1 }] })
  })

  it("остаток изменился после снимка (продажа на WB) — позиция не пишется, остальные пишутся", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 2 }, "222": { chrtId: 7002, amount: 5 } })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 5, 4)])
    expect(r[0]).toMatchObject({ barcode: "111", ok: false, uncertain: false, error: expect.stringContaining("изменился после снимка") })
    expect(r[1]).toMatchObject({ barcode: "222", ok: true })
    expect(wb.calls[1]!.body).toEqual({ stocks: [{ chrtId: 7002, amount: 4 }] })
  })

  it("WB ответил 204, а остаток не изменился — итог неизвестен", async () => {
    fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { ignorePut: true })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true, error: expect.stringContaining("после записи на складе 3, ожидалось 2") })
  })

  it("409 — отказ без неопределённости, тело ответа — в журнал; проверочного чтения нет", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { putStatus: 409 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: false, response: [{ code: "NotFound", message: "not found" }] })
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT"])
  })

  it("5xx после повторов — итог неизвестен", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { putStatus: 500 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true })
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "PUT"])
  })

  it("без chrtId или с нечисловым — отказ до сети", async () => {
    const wb = fakeWb({})
    const r = await writeWbStocks(cfg, [op("111", null, 3, 2), op("222", "abc", 1, 0)])
    expect(r.map((x) => [x.barcode, x.ok])).toEqual([["111", false], ["222", false]])
    expect(wb.fetchMock).not.toHaveBeenCalled()
  })
})
