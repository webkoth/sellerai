import { describe, expect, it } from "vitest"
import { loadChannelsConfig } from "./channels-config"

// businessId/campaignId — строки: YmCredentials (@sync2/platforms/ym/client.ts)
// принимает их строками, а не числами, как в исходном тексте плана
// («Поправки при исполнении», 27.09.2026).
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

describe("loadChannelsConfig", () => {
  it("собирает ключи и склады четырёх площадок", () => {
    expect(loadChannelsConfig(env)).toEqual({
      wb: { token: "wb" },
      ozon: { clientId: "5332036", apiKey: "oz" },
      ym: { apiKey: "ym", businessId: "191766894", campaignId: "149197829", warehouseIds: [2369574] },
      kit: { token: "kit", warehouseId: "01980d4c-1b53-7aa1-ab23-1b7c23604704" },
      site: null,
    })
  })
  it("несколько складов ЯМ через запятую", () => {
    expect(loadChannelsConfig({ ...env, YM_WAREHOUSE_IDS: "2369574,1872191" }).ym.warehouseIds).toEqual([
      2369574, 1872191,
    ])
  })
  it("не хватает ключа — ошибка с именем переменной", () => {
    expect(() => loadChannelsConfig({ ...env, YAKIT_API_TOKEN: "" })).toThrow(/YAKIT_API_TOKEN/)
  })

  describe("YM_WAREHOUSE_IDS — непустой список положительных целых", () => {
    it("только запятая — пустой список после разбора — ошибка с именем переменной", () => {
      expect(() => loadChannelsConfig({ ...env, YM_WAREHOUSE_IDS: "," })).toThrow(/YM_WAREHOUSE_IDS/)
    })
    it("не число — ошибка с именем переменной", () => {
      expect(() => loadChannelsConfig({ ...env, YM_WAREHOUSE_IDS: "abc" })).toThrow(/YM_WAREHOUSE_IDS/)
    })
    it("ноль — не положительное число — ошибка с именем переменной", () => {
      expect(() => loadChannelsConfig({ ...env, YM_WAREHOUSE_IDS: "0" })).toThrow(/YM_WAREHOUSE_IDS/)
    })
    it("отрицательное число — ошибка с именем переменной", () => {
      expect(() => loadChannelsConfig({ ...env, YM_WAREHOUSE_IDS: "-5" })).toThrow(/YM_WAREHOUSE_IDS/)
    })
    it("дробное число — ошибка с именем переменной", () => {
      expect(() => loadChannelsConfig({ ...env, YM_WAREHOUSE_IDS: "2369574.5" })).toThrow(/YM_WAREHOUSE_IDS/)
    })
    it("один из списка не число — ошибка целиком, а не частичный список", () => {
      expect(() => loadChannelsConfig({ ...env, YM_WAREHOUSE_IDS: "2369574,abc" })).toThrow(/YM_WAREHOUSE_IDS/)
    })
  })

  describe("сайт — только при заданном SITE_API_TOKEN", () => {
    const token = "s".repeat(64)
    it("токена нет — сайт не подключается", () => {
      expect(loadChannelsConfig(env).site).toBeNull()
    })
    it("токен есть — адрес по умолчанию", () => {
      expect(loadChannelsConfig({ ...env, SITE_API_TOKEN: token }).site).toEqual({ baseUrl: "https://kotelnikovartifact.ru", token })
    })
    it("свой адрес — без завершающего слэша", () => {
      expect(loadChannelsConfig({ ...env, SITE_API_TOKEN: token, SITE_API_URL: "https://staging.example.ru/" }).site?.baseUrl).toBe("https://staging.example.ru")
    })
    it("http — только для localhost: токен уходит в заголовке", () => {
      expect(() => loadChannelsConfig({ ...env, SITE_API_TOKEN: token, SITE_API_URL: "http://kotelnikovartifact.ru" })).toThrow(/SITE_API_URL/)
      expect(loadChannelsConfig({ ...env, SITE_API_TOKEN: token, SITE_API_URL: "http://localhost:3050" }).site?.baseUrl).toBe("http://localhost:3050")
    })
    it("не URL — ошибка с именем переменной", () => {
      expect(() => loadChannelsConfig({ ...env, SITE_API_TOKEN: token, SITE_API_URL: "kotelnikovartifact" })).toThrow(/SITE_API_URL/)
    })
    it("токен короче 32 символов — ошибка", () => {
      expect(() => loadChannelsConfig({ ...env, SITE_API_TOKEN: "short" })).toThrow(/SITE_API_TOKEN/)
    })
  })
})
