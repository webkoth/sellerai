import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import { buildAdapters } from "./adapters"
import { loadChannelsConfig } from "./channels-config"

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
const channels = (e: Record<string, string>) =>
  buildAdapters(loadChannelsConfig(e))
    .mirrors(buildWbCatalogIndex([]))
    .map((a) => a.channel)

describe("buildAdapters", () => {
  it("без токена сайта — зеркала Ozon, ЯМ, KIT", () => {
    expect(channels(env)).toEqual(["ozon", "ym", "kit"])
  })
  it("с токеном сайта — сайт пятой площадкой", () => {
    expect(channels({ ...env, SITE_API_TOKEN: "s".repeat(64) })).toEqual(["ozon", "ym", "kit", "site"])
    expect(buildAdapters(loadChannelsConfig({ ...env, SITE_API_TOKEN: "s".repeat(64) })).configErrors).toEqual([])
  })
  it("битый конфиг сайта — сайт пропущен, ошибка в configErrors, зеркала на месте", () => {
    const e = { ...env, SITE_API_TOKEN: "short" }
    expect(channels(e)).toEqual(["ozon", "ym", "kit"])
    expect(buildAdapters(loadChannelsConfig(e)).configErrors).toEqual([expect.stringMatching(/^сайт пропущен: SITE_API_TOKEN/)])
  })
})
