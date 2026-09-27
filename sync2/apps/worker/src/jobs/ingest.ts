import { insertStockSnapshot, lastCounter, loadChannels, upsertOrders, upsertProducts, type Db, type OrderUpsert } from "@sync2/db"
import { buildWbCatalogIndex, errorText, type ChannelOrder } from "@sync2/shared"
import type { ChannelAdapter } from "@sync2/platforms"
import type { Adapters } from "../adapters"
import type { Logger } from "../log"

/** Окно чтения заказов — не короче срока поздней отмены (заметки к 1.3b: 60 дней). */
export const ORDERS_WINDOW_DAYS = 60
/** Каталог WB короче этой доли прошлого принятого — прогон не пишет снимки и заказы зеркал. */
export const MIN_CATALOG_SHARE = 0.9
/**
 * Счётчик принятого каталога — эталон для ворот следующего прогона. Пишется только
 * принятым каталогом: отклонённый прогон тоже пишет `wbCatalog`, и бери эталон оттуда —
 * короткий каталог стал бы эталоном уже на следующем тике.
 */
export const CATALOG_ACCEPTED_KEY = "wbCatalogAccepted"
/**
 * Ручное принятие каталога на VPS — под той же блокировкой, что и крон: иначе ingest
 * руками и tick крона пишут в базу одновременно.
 */
export const ACCEPT_CATALOG_HINT =
  "cd /opt/sync2 && flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts ingest --accept-catalog"

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
 * (без индекса остатки зеркал не сопоставить); пуст или короче MIN_CATALOG_SHARE
 * последнего принятого — пишутся только товары, снимки и заказы зеркал пропускаются. Настоящую
 * усадку каталога принимает `acceptCatalog` (`--accept-catalog` в cli) — без проверки
 * доли, с предупреждением в лог. Сбой отдельной площадки не роняет остальные.
 */
export async function runIngest(deps: {
  db: Db
  now: () => Date
  runId: string
  adapters: Adapters
  acceptCatalog: boolean
  log: Logger
}): Promise<IngestResult> {
  const { db, runId } = deps
  const counters: Record<string, number> = {}
  const errors: string[] = []
  const since = new Date(deps.now().getTime() - ORDERS_WINDOW_DAYS * 86_400_000).toISOString()
  const channels = await loadChannels(db)
  const previous = await lastCounter(db, "ingest", CATALOG_ACCEPTED_KEY)

  const catalog = await deps.adapters.wb.fetchCatalog()
  counters.wbCatalog = catalog.length
  await upsertProducts(db, catalog)
  // Пустой каталог отклоняется всегда, даже без эталона: у живого магазина это сбой
  // чтения WB, и принять его значит обнулить эталон и все зеркала.
  const empty = catalog.length === 0
  const shrunk = empty || (previous !== null && catalog.length < previous * MIN_CATALOG_SHARE)
  if (shrunk && !deps.acceptCatalog) {
    counters.catalogRejected = 1
    const why = empty
      ? "каталог WB пуст"
      : `каталог WB ${catalog.length} при прошлом принятом ${previous} (меньше ${MIN_CATALOG_SHARE * 100}%)`
    return { status: "partial", counters, errors: [`${why} — снимки и заказы зеркал пропущены; если это правда: ${ACCEPT_CATALOG_HINT}`] }
  }
  if (deps.acceptCatalog) {
    deps.log.warn({ wbCatalog: catalog.length, previousAccepted: previous }, "каталог WB принят без проверки доли (--accept-catalog)")
    if (shrunk) counters.catalogForced = 1
  }
  counters[CATALOG_ACCEPTED_KEY] = catalog.length

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
