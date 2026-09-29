import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { loadChannels, seedChannels, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import { eq } from "drizzle-orm"
import { runYmCheck } from "./ym-check"

const CFG = { apiKey: "k", businessId: "111", campaignId: "222", warehouseId: 2369574 }
const NOW = new Date("2026-09-28T15:00:00.000Z")
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

/** ЯМ в памяти: чтение остатков (фильтр offerIds), каталог штрихкодов, запись. `putResponse` — ответ на PUT. */
/**
 * `store` — свободный остаток оффера. `reserve` — резерв под заказы: у такого оффера ЯМ отдаёт, как на
 * проде 29.09, FIT = свободный + резерв и FREEZE = резерв, без AVAILABLE; PUT пишет свободный остаток.
 */
function fakeYm(
  initial: Record<string, number>,
  opts: { putResponse?: () => Response; afterPut?: (store: Map<string, number>) => void; reserve?: Record<string, number> } = {},
) {
  const store = new Map(Object.entries(initial))
  const puts: unknown[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : null
    if (path === "/v2/campaigns/222/offers/stocks" && init?.method === "POST") {
      const ids = (body as { offerIds: string[] }).offerIds
      const offers = ids
        .filter((id) => store.has(id))
        .map((offerId) => {
          const free = store.get(offerId)!
          const frozen = opts.reserve?.[offerId]
          const stocks =
            frozen === undefined
              ? [{ type: "FIT", count: free }, { type: "AVAILABLE", count: free }]
              : [{ type: "FIT", count: free + frozen }, { type: "FREEZE", count: frozen }]
          return { offerId, stocks }
        })
      return json({ status: "OK", result: { warehouses: [{ warehouseId: 2369574, offers }] } })
    }
    if (path === "/v2/businesses/111/offer-mappings") {
      return json({ status: "OK", result: { paging: {}, offerMappings: [{ offer: { offerId: "JW-A", barcodes: ["2042353656495"] } }] } })
    }
    if (path === "/v2/campaigns/222/offers/stocks" && init?.method === "PUT") {
      puts.push(body)
      opts.afterPut?.(store)
      return opts.putResponse ? opts.putResponse() : json({ status: "OK" })
    }
    throw new Error(`нет маршрута ${init?.method} ${path}`)
  })
  vi.stubGlobal("fetch", fetchMock)
  return { puts }
}

describe.skipIf(!TEST_DATABASE_URL)("runYmCheck — живая проверка тела записи ЯМ на одном оффере", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let n = 0
  const runId = async () => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
    await insertRun(h.db, id)
    return id
  }
  const check = async (offerId: string, confirm: boolean) => {
    const lines: string[] = []
    const id = await runId()
    const r = await runYmCheck({ db: h.db, runId: id, globalMode: "apply", now: () => NOW, cfg: { ...CFG, retryDelaysMs: [0] }, offerId, confirm, print: (l) => lines.push(l) })
    return { r, lines, id }
  }
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => {
    vi.unstubAllGlobals()
    await h?.close()
  })

  it("без --confirm: печатает текущий остаток и тело запроса, в сеть не пишет, журнала writes нет", async () => {
    const ym = fakeYm({ "JW-A": 2 })
    const { r, lines, id } = await check("JW-A", false)
    expect(r).toMatchObject({ code: 0, counters: { current: 2 } })
    expect(ym.puts).toEqual([])
    const body = JSON.parse(lines.find((l) => l.startsWith("{"))!)
    expect(body).toEqual({ skus: [{ sku: "JW-A", warehouseId: 2369574, items: [{ count: 2, type: "FIT", updatedAt: "2026-09-28T15:00:00.000Z" }] }] })
    expect(await h.db.select().from(writes).where(eq(writes.runId, id))).toEqual([])
  })

  it("с --confirm: пишет тот же остаток тем же телом, читает обратно — status OK и число не изменилось, код 0; строка writes apply", async () => {
    const ym = fakeYm({ "JW-A": 2 })
    const { r, lines, id } = await check("JW-A", true)
    expect(r).toMatchObject({ code: 0, status: "ok", counters: { current: 2, readBack: 2, applied: 1 } })
    const printed = JSON.parse(lines.find((l) => l.startsWith("{"))!)
    expect(ym.puts).toEqual([printed])
    expect(lines.join("\n")).toMatch(/status OK, прочитано 2/)
    const rows = await h.db.select().from(writes).where(eq(writes.runId, id))
    const ymId = (await loadChannels(h.db)).get("ym")!.id
    expect(rows.map((w) => [w.channelId, w.barcode, w.externalSku, w.before, w.after, w.mode, w.applied])).toEqual([[ymId, "2042353656495", "JW-A", 2, 2, "apply", true]])
  })

  it("резерв (FIT 1, FREEZE 1, без AVAILABLE): текущий — свободный 0, пишется 0, а не FIT 1 (иначе +1 к витрине)", async () => {
    const ym = fakeYm({ "JW-A": 0 }, { reserve: { "JW-A": 1 } })
    const { r, lines } = await check("JW-A", true)
    expect(r).toMatchObject({ code: 0, status: "ok", counters: { current: 0, readBack: 0, applied: 1 } })
    expect(ym.puts).toEqual([{ skus: [{ sku: "JW-A", warehouseId: 2369574, items: [{ count: 0, type: "FIT", updatedAt: "2026-09-28T15:00:00.000Z" }] }] }])
    expect(lines.join("\n")).toMatch(/остаток сейчас 0 \(резерв 1\)/)
  })

  it("прочитанное после записи число изменилось — код 1", async () => {
    fakeYm({ "JW-A": 2 }, { afterPut: (store) => store.set("JW-A", 5) })
    const { r } = await check("JW-A", true)
    expect(r).toMatchObject({ code: 1, status: "partial" })
    expect(r.error).toMatch(/прочитано 5, ожидалось 2/)
  })

  it("ответ не status OK — код 1", async () => {
    fakeYm({ "JW-A": 2 }, { putResponse: () => json({ status: "ERROR" }) })
    expect((await check("JW-A", true)).r).toMatchObject({ code: 1 })
  })

  it("оффера нет на складе записи — код 2, записи нет", async () => {
    const ym = fakeYm({})
    const { r } = await check("JW-Z", true)
    expect(r).toMatchObject({ code: 2, error: expect.stringMatching(/JW-Z/) })
    expect(ym.puts).toEqual([])
  })

  it("глобально не apply — запись не делается, код 1", async () => {
    const ym = fakeYm({ "JW-A": 2 })
    const lines: string[] = []
    const r = await runYmCheck({ db: h.db, runId: await runId(), globalMode: "dry-run", now: () => NOW, cfg: CFG, offerId: "JW-A", confirm: true, print: (l) => lines.push(l) })
    expect(r).toMatchObject({ code: 1, error: expect.stringContaining("SYNC_WRITE_MODE=dry-run") })
    expect(ym.puts).toEqual([])
  })
})
