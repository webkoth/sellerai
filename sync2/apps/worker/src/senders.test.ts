import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "@sync2/platforms"
import { loadChannelsConfig } from "./channels-config"
import { buildSender } from "./senders"

const env = {
  WB_API_TOKEN: "wb",
  OZON_CLIENT_ID: "5332036",
  OZON_API_TOKEN: "oz",
  YM_API_TOKEN: "ym",
  YM_BUSINESS_ID: "191766894",
  YM_CAMPAIGN_ID: "149197829",
  YM_WAREHOUSE_IDS: "2369574",
  YAKIT_API_TOKEN: "kit",
  KIT_WAREHOUSE_ID: "01980d4c-1b53-7aa1-ab23-1b7c23604704",
}
const op = (channel: WriteOp["channel"]): WriteOp => ({ channel, barcode: "A", field: "stock", before: 1, after: 2, externalSku: "JW-A" })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("buildSender", () => {
  it("склад WB, склад Ozon или токен сайта не заданы — ошибка до сети", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const send = buildSender(loadChannelsConfig(env))
    await expect(send("wb", [op("wb")])).rejects.toThrow(/WB_WAREHOUSE_ID/)
    await expect(send("ozon", [op("ozon")])).rejects.toThrow(/OZON_WAREHOUSE_ID/)
    await expect(send("site", [op("site")])).rejects.toThrow(/SITE_API_TOKEN/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ЯМ — на кампанию и первый склад из YM_WAREHOUSE_IDS", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ status: "OK" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const r = await buildSender(loadChannelsConfig(env))("ym", [op("ym")])
    expect(r).toEqual([{ barcode: "A", field: "stock", ok: true, response: { status: "OK" } }])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://api.partner.market.yandex.ru/v2/campaigns/149197829/offers/stocks")
    expect((JSON.parse(String(init?.body)) as { skus: unknown[] }).skus[0]).toMatchObject({ sku: "JW-A", warehouseId: 2369574, items: [{ count: 2, type: "FIT" }] })
  })
})
