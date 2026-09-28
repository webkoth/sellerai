import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { writeWbStocks } from "./stock-writer"

const cfg = { token: "t", warehouseId: 1408913, retryDelaysMs: [0], verifyDelayMs: 0, verifyRetryDelayMs: 0 }
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
 * PUT — запись по chrtId. `putStatus` — ответ на PUT; `ignorePut` — 204 без записи (неверные имена полей);
 * `onPut` — свой ответ на PUT по номеру вызова (1…) с доступом к складу: частичное применение, 409 с data.
 */
type Store = Map<string, { chrtId: number; amount: number }>
type PutBody = { stocks: Array<{ chrtId: number; amount: number }> }
const applyPut = (store: Store, body: PutBody, skip: ReadonlySet<number> = new Set()) => {
  for (const s of body.stocks) {
    if (skip.has(s.chrtId)) continue
    for (const [sku, v] of store) if (v.chrtId === s.chrtId) store.set(sku, { ...v, amount: s.amount })
  }
}
function fakeWb(
  initial: Record<string, { chrtId: number; amount: number }>,
  opts: {
    putStatus?: number
    ignorePut?: boolean
    onPut?: (body: PutBody, store: Store, call: number) => Response
    /** Тело PUT применяется не сразу, а перед этим по счёту POST-чтением (запаздывание WB). */
    applyOnRead?: number
  } = {},
) {
  const store: Store = new Map(Object.entries(initial))
  const calls: Array<{ method: string; body: unknown }> = []
  let puts = 0
  let reads = 0
  let delayed: PutBody | null = null
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ method, body })
    if (url !== URL_STOCKS) throw new Error(`неожиданный адрес ${url}`)
    if (method === "POST") {
      reads++
      if (delayed && opts.applyOnRead !== undefined && reads >= opts.applyOnRead) {
        applyPut(store, delayed)
        delayed = null
      }
      const skus = (body as { skus: string[] }).skus
      const stocks = skus
        .filter((sku) => (store.get(sku)?.amount ?? 0) > 0)
        .map((sku) => ({ sku, chrtId: store.get(sku)!.chrtId, amount: store.get(sku)!.amount }))
      return new Response(JSON.stringify({ stocks }), { status: 200 })
    }
    puts++
    if (opts.applyOnRead !== undefined) delayed = body as PutBody
    if (opts.onPut) return opts.onPut(body as PutBody, store, puts)
    if (opts.putStatus !== undefined) return new Response(JSON.stringify([{ code: "NotFound", message: "not found" }]), { status: opts.putStatus })
    if (!opts.ignorePut && opts.applyOnRead === undefined) applyPut(store, body as PutBody)
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal("fetch", fetchMock)
  return { calls, fetchMock, store }
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

  it("WB ответил 204, а остаток не изменился и во втором чтении — итог неизвестен", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { ignorePut: true })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true, error: expect.stringContaining("после записи на складе 3, ожидалось 2") })
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "POST", "POST"])
  })

  it("WB применил запись не сразу — второе проверочное чтение: применено", async () => {
    fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { applyOnRead: 3 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: true, response: { chrtId: 7001, amount: 2 } })
  })

  it("409 — проверочное чтение: на складе прежнее число — отказ без неопределённости, тело ответа — в журнал", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { putStatus: 409 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: false, response: [{ code: "NotFound", message: "not found" }] })
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "POST"])
  })

  it("5xx после повторов, а на складе прежнее и во втором чтении — итог неизвестен: WB может применить позже", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { putStatus: 500 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true })
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "PUT", "POST", "POST"])
  })

  it("рост после 5xx: WB применил позже — не отказ (иначе фантом в пуле), а по второму чтению — применено", async () => {
    fakeWb(
      { "111": { chrtId: 7001, amount: 3 } },
      {
        applyOnRead: 3,
        onPut: () => new Response("oops", { status: 502 }),
      },
    )
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 5)])
    expect(r[0]).toMatchObject({ ok: true, response: { chrtId: 7001, amount: 5 } })
  })

  it("5xx, но запись применилась (ответ потерян) — проверочное чтение: применено", async () => {
    fakeWb(
      { "111": { chrtId: 7001, amount: 3 } },
      {
        onPut: (body, store) => {
          applyPut(store, body)
          return new Response("oops", { status: 502 })
        },
      },
    )
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: true, response: { chrtId: 7001, amount: 2 } })
  })

  it("ошибка записи, а на складе ни прежнее, ни целевое число — итог неизвестен", async () => {
    fakeWb(
      { "111": { chrtId: 7001, amount: 3 } },
      {
        onPut: (_body, store) => {
          store.set("111", { chrtId: 7001, amount: 1 }) // продажа на WB в то же время
          return new Response("oops", { status: 500 })
        },
      },
    )
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true, error: expect.stringContaining("на складе 1") })
  })

  it("ошибка записи и проверочное чтение не удалось — итог по самой ошибке", async () => {
    let posts = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          posts++
          if (posts === 1) return new Response(JSON.stringify({ stocks: [{ sku: "111", chrtId: 7001, amount: 3 }] }), { status: 200 })
          return new Response("bad", { status: 400 })
        }
        return new Response("oops", { status: 500 })
      }),
    )
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true, error: expect.stringContaining("проверочное чтение не удалось") })
  })

  it("429 без признаков доставки — отказ без проверочного чтения", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { putStatus: 429 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: false })
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "PUT"])
  })

  it("409 с data[]: названная позиция — отказ с кодом WB, остальные применены той же пачкой — применено", async () => {
    const wb = fakeWb(
      { "111": { chrtId: 7001, amount: 3 }, "222": { chrtId: 7002, amount: 1 } },
      {
        onPut: (body, store) => {
          applyPut(store, body, new Set([7002]))
          return new Response(JSON.stringify([{ code: "CargoWarehouseRestrictionMGT", message: "склад", data: [{ sku: "222", chrtId: 7002, amount: 0 }] }]), {
            status: 409,
          })
        },
      },
    )
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 1, 0)])
    expect(r.map((x) => [x.barcode, x.ok, x.uncertain ?? false])).toEqual([
      ["111", true, false],
      ["222", false, false],
    ])
    expect(r[1]!.error).toMatch(/WB: CargoWarehouseRestrictionMGT/)
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "POST"])
  })

  it("409 с data[], ничего не применено — названная позиция отказана, остальные — один повтор без неё", async () => {
    const wb = fakeWb(
      { "111": { chrtId: 7001, amount: 3 }, "222": { chrtId: 7002, amount: 1 } },
      {
        onPut: (body, store, call) => {
          if (call === 1) return new Response(JSON.stringify([{ code: "NotFound", message: "x", data: [{ sku: "", chrtId: 7002, amount: 0 }] }]), { status: 409 })
          applyPut(store, body)
          return new Response(null, { status: 204 })
        },
      },
    )
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 1, 0)])
    expect(r.map((x) => [x.barcode, x.ok])).toEqual([
      ["222", false],
      ["111", true],
    ])
    expect(wb.calls.filter((c) => c.method === "PUT").map((c) => c.body)).toEqual([
      { stocks: [{ chrtId: 7001, amount: 2 }, { chrtId: 7002, amount: 0 }] },
      { stocks: [{ chrtId: 7001, amount: 2 }] },
    ])
  })

  it("повтор после 409 — только один: второй 409 — отказ без нового повтора", async () => {
    const wb = fakeWb(
      { "111": { chrtId: 7001, amount: 3 }, "222": { chrtId: 7002, amount: 1 } },
      {
        onPut: (_body, _store, call) =>
          new Response(JSON.stringify([{ code: "NotFound", message: "x", data: [{ sku: call === 1 ? "222" : "111", amount: 0 }] }]), { status: 409 }),
      },
    )
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 1, 0)])
    expect(r.every((x) => !x.ok && !x.uncertain)).toBe(true)
    expect(wb.calls.filter((c) => c.method === "PUT")).toHaveLength(2)
  })

  it("409 без data[] — отказ пачке, без повтора", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 }, "222": { chrtId: 7002, amount: 1 } }, { putStatus: 409 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 1, 0)])
    expect(r.every((x) => !x.ok && !x.uncertain)).toBe(true)
    expect(wb.calls.filter((c) => c.method === "PUT")).toHaveLength(1)
  })

  it("chrtId в ответе чтения WB расходится с каталогом — отказ позиции до записи", async () => {
    const wb = fakeWb({ "111": { chrtId: 9999, amount: 3 }, "222": { chrtId: 7002, amount: 1 } })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 1, 0)])
    expect(r[0]).toMatchObject({ barcode: "111", ok: false, uncertain: false, error: expect.stringContaining("chrtId расходится с WB") })
    expect(r[1]).toMatchObject({ barcode: "222", ok: true })
    expect(wb.calls[1]!.body).toEqual({ stocks: [{ chrtId: 7002, amount: 0 }] })
  })

  it("без chrtId или с нечисловым — отказ до сети", async () => {
    const wb = fakeWb({})
    const r = await writeWbStocks(cfg, [op("111", null, 3, 2), op("222", "abc", 1, 0)])
    expect(r.map((x) => [x.barcode, x.ok])).toEqual([["111", false], ["222", false]])
    expect(wb.fetchMock).not.toHaveBeenCalled()
  })
})
