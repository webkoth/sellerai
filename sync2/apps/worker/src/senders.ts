import { writeKitStocks, writeOzonStocks, writeSiteStocks, writeWbStocks, writeYmStocks, type Sender } from "@sync2/platforms"
import type { ChannelsConfig } from "./channels-config"

/**
 * Отправитель для executeWrites (этап 1.4): площадка → её писатель остатка
 * (packages/platforms/src/<площадка>/stock-writer.ts). Нет склада записи или токена сайта —
 * ошибка на всю пачку площадки: executeWrites запишет её в журнал по каждой позиции.
 */
export function buildSender(cfg: ChannelsConfig): Sender {
  return async (channel, ops) => {
    switch (channel) {
      case "wb":
        if (cfg.wb.warehouseId === null) throw new Error("WB_WAREHOUSE_ID не задан — запись WB невозможна")
        return writeWbStocks({ token: cfg.wb.token, warehouseId: cfg.wb.warehouseId }, ops)
      case "ozon":
        if (cfg.ozon.warehouseId === null) throw new Error("OZON_WAREHOUSE_ID не задан — запись Ozon невозможна")
        return writeOzonStocks({ clientId: cfg.ozon.clientId, apiKey: cfg.ozon.apiKey, warehouseId: cfg.ozon.warehouseId }, ops)
      case "ym": {
        const warehouseId = cfg.ym.warehouseIds[0]
        if (warehouseId === undefined) throw new Error("YM_WAREHOUSE_IDS пуст — запись ЯМ невозможна")
        return writeYmStocks({ apiKey: cfg.ym.apiKey, businessId: cfg.ym.businessId, campaignId: cfg.ym.campaignId, warehouseId }, ops)
      }
      case "kit":
        return writeKitStocks({ token: cfg.kit.token, warehouseId: cfg.kit.warehouseId }, ops)
      case "site":
        if (!cfg.site) throw new Error(`SITE_API_TOKEN не задан${cfg.siteError ? ` (${cfg.siteError})` : ""} — запись сайта невозможна`)
        return writeSiteStocks(cfg.site, ops)
    }
  }
}
