import { createKitAdapter, createOzonAdapter, createWbAdapter, createYmAdapter, type ChannelAdapter } from "@sync2/platforms"
import type { WbCatalogEntry, WbCatalogIndex } from "@sync2/shared"
import type { ChannelsConfig } from "./channels-config"

export interface Adapters {
  wb: ChannelAdapter & { fetchCatalog(): Promise<WbCatalogEntry[]> }
  /** Зеркала строятся от индекса каталога WB этого же прогона. */
  mirrors(index: WbCatalogIndex): ChannelAdapter[]
}

/** Новые экземпляры на каждый прогон: кэш каталога и вариантов держит и отказы. */
export function buildAdapters(cfg: ChannelsConfig): Adapters {
  return {
    wb: createWbAdapter(cfg.wb.token),
    mirrors: (index) => [
      createOzonAdapter(cfg.ozon, index),
      createYmAdapter(cfg.ym, index, cfg.ym.warehouseIds),
      createKitAdapter(cfg.kit, index),
    ],
  }
}
