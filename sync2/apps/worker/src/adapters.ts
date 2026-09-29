import {
  createKitAdapter,
  createOzonAdapter,
  createSiteAdapter,
  createWbAdapter,
  createYmAdapter,
  type ChannelAdapter,
} from "@sync2/platforms"
import type { WbCatalogEntry, WbCatalogIndex } from "@sync2/shared"
import type { ChannelsConfig } from "./channels-config"

export interface Adapters {
  /** `fresh` — перечитать каталог мимо кэша адаптера (повтор ворот каталога в ingest). */
  wb: ChannelAdapter & { fetchCatalog(opts?: { fresh?: boolean }): Promise<WbCatalogEntry[]> }
  /** Зеркала строятся от индекса каталога WB этого же прогона. */
  mirrors(index: WbCatalogIndex): ChannelAdapter[]
  /** Необязательные площадки, пропущенные из-за битого конфига, — текстом; ingest уходит в partial. Нет — ошибок нет. */
  configErrors?: string[]
}

/** Новые экземпляры на каждый прогон: кэш каталога и вариантов держит и отказы. */
export function buildAdapters(cfg: ChannelsConfig): Adapters {
  return {
    wb: createWbAdapter(cfg.wb.token),
    mirrors: (index) => [
      createOzonAdapter(cfg.ozon, index),
      createYmAdapter(cfg.ym, index, cfg.ym.warehouseIds),
      createKitAdapter(cfg.kit, index),
      // Сайт — пятая площадка (этап 1.3c), только при заданном SITE_API_TOKEN.
      ...(cfg.site ? [createSiteAdapter(cfg.site, index)] : []),
    ],
    configErrors: cfg.siteError ? [`сайт пропущен: ${cfg.siteError}`] : [],
  }
}
