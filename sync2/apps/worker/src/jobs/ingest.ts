import { insertStockSnapshot, loadChannels, upsertOrders, upsertProducts, type Db, type OrderUpsert } from "@sync2/db"
import { buildWbCatalogIndex, errorText, type ChannelOrder } from "@sync2/shared"
import type { ChannelAdapter } from "@sync2/platforms"
import type { Adapters } from "../adapters"

/** Окно чтения заказов — не короче срока поздней отмены (заметки к 1.3b: 60 дней). */
export const ORDERS_WINDOW_DAYS = 60
/** Каталог WB короче этой доли прошлого принятого — прогон не пишет снимки и заказы зеркал. */
export const MIN_CATALOG_SHARE = 0.9

export interface IngestResult {
  status: "ok" | "partial"
  counters: Record<string, number>
  errors: string[]
}

const toUpsert = (o: ChannelOrder): OrderUpsert => ({
  externalId: o.externalId,
  line: 0,
  barcode: o.barcode,
  quantity: o.quantity,
  lifecycle: o.lifecycle,
  occurredAt: o.occurredAt,
  raw: o.raw,
})

/**
 * Заказы и остатки всех площадок в базу. Каталог WB — ворота: не получен — джоба падает
 * (без индекса остатки зеркал не сопоставить); заметно короче прошлого — пишутся только
 * товары, снимки и заказы зеркал пропускаются. Сбой отдельной площадки не роняет остальные.
 */
export async function runIngest(deps: {
  db: Db
  now: () => Date
  runId: string
  adapters: Adapters
  previousCatalog: number | null
}): Promise<IngestResult> {
  const { db, runId } = deps
  const counters: Record<string, number> = {}
  const errors: string[] = []
  const since = new Date(deps.now().getTime() - ORDERS_WINDOW_DAYS * 86_400_000).toISOString()
  const channels = await loadChannels(db)

  const catalog = await deps.adapters.wb.fetchCatalog()
  counters.wbCatalog = catalog.length
  await upsertProducts(db, catalog)
  if (deps.previousCatalog !== null && catalog.length < deps.previousCatalog * MIN_CATALOG_SHARE) {
    counters.catalogRejected = 1
    return { status: "partial", counters, errors: [`каталог WB ${catalog.length} при прошлом ${deps.previousCatalog}`] }
  }

  const all: ChannelAdapter[] = [deps.adapters.wb, ...deps.adapters.mirrors(buildWbCatalogIndex(catalog))]
  for (const a of all) {
    const ch = channels.get(a.channel)
    if (!ch) {
      errors.push(`${a.channel}: нет в таблице channels`)
      continue
    }
    try {
      const rows = (await a.fetchOrders(since)).filter((o) => o.quantity > 0).map(toUpsert)
      counters[`${a.channel}Orders`] = await upsertOrders(db, ch.id, rows)
    } catch (e) {
      errors.push(`${a.channel} заказы: ${errorText(e)}`)
    }
    try {
      const s = await a.fetchStocks()
      await insertStockSnapshot(db, { channelId: ch.id, runId, takenAt: deps.now().toISOString(), stocks: s.stocks })
      counters[`${a.channel}Stock`] = s.stocks.length
      counters[`${a.channel}Skipped`] = s.skippedNoWbBarcode.length
    } catch (e) {
      errors.push(`${a.channel} остатки: ${errorText(e)}`)
    }
  }
  return { status: errors.length ? "partial" : "ok", counters, errors }
}
