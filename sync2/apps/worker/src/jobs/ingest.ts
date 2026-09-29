import {
  ingestChannelOrders,
  insertStockSnapshot,
  lastCounter,
  latestStockSnapshots,
  loadChannels,
  upsertProducts,
  type Db,
  type OrderUpsert,
} from "@sync2/db"
import { aggregateStockByBarcode } from "@sync2/domain"
import { buildWbCatalogIndex, errorText, type ChannelOrder, type NormalizedStock, type WbCatalogEntry } from "@sync2/shared"
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

/** Сколько пропавших штрихкодов перечислять в тексте отказа — остальные числом. */
const MISSING_LIST_LIMIT = 10

export interface CatalogVerdict {
  /** Причины отказа; пусто — каталог прошёл ворота. */
  reasons: string[]
  /** Штрихкоды с остатком > 0 в последнем снимке WB, которых нет в каталоге. */
  missingInStock: string[]
}

/**
 * Ворота каталога WB. Отказ, если каталог: пуст (у живого магазина это сбой чтения,
 * принять его — обнулить эталон и все зеркала); короче MIN_CATALOG_SHARE прошлого
 * принятого; или потерял хотя бы один штрихкод, у которого в последнем снимке WB
 * остаток > 0 (сумма по складам). Последнее — инцидент 29.09: 386 из 421 прошло долю
 * (91,7 %), а снимок WB строится по каталогу, и 35 пропавших штрихкодов прочитались
 * бы как 0 на всех зеркалах. Пропажа штрихкода с нулевым остатком ничего не обнуляет —
 * её судит только доля.
 */
export function checkCatalog(p: {
  catalog: WbCatalogEntry[]
  previousAccepted: number | null
  lastWbStocks: NormalizedStock[] | null
}): CatalogVerdict {
  const { catalog, previousAccepted } = p
  if (catalog.length === 0) return { reasons: ["каталог WB пуст"], missingInStock: [] }
  const reasons: string[] = []
  const present = new Set(catalog.map((e) => e.barcode))
  const missingInStock = [...aggregateStockByBarcode(p.lastWbStocks ?? [])]
    .filter(([barcode, s]) => s.quantity > 0 && !present.has(barcode))
    .map(([barcode]) => barcode)
    .sort()
  if (missingInStock.length > 0) {
    const shown = missingInStock.slice(0, MISSING_LIST_LIMIT).join(", ")
    const more = missingInStock.length > MISSING_LIST_LIMIT ? ` и ещё ${missingInStock.length - MISSING_LIST_LIMIT}` : ""
    reasons.push(`из каталога WB пропали штрихкоды с остатком > 0 в последнем снимке WB — ${missingInStock.length} шт.: ${shown}${more}`)
  }
  if (previousAccepted !== null && catalog.length < previousAccepted * MIN_CATALOG_SHARE) {
    reasons.push(`каталог WB ${catalog.length} при прошлом принятом ${previousAccepted} (меньше ${MIN_CATALOG_SHARE * 100}%)`)
  }
  return { reasons, missingInStock }
}

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
 * (без индекса остатки зеркал не сопоставить); не прошёл `checkCatalog` — пишутся только
 * товары, снимки и заказы зеркал пропускаются. Настоящую усадку каталога принимает
 * `acceptCatalog` (`--accept-catalog` в cli) — без ворот, с предупреждением в лог.
 * Сбой отдельной площадки не роняет остальные.
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

  // Эталон остатка — последний снимок WB: его пишет только прогон с принятым каталогом.
  const wbChannel = channels.get("wb")
  const lastWbStocks = wbChannel ? ((await latestStockSnapshots(db)).get(wbChannel.id)?.stocks ?? null) : null

  const catalog = await deps.adapters.wb.fetchCatalog()
  counters.wbCatalog = catalog.length
  await upsertProducts(db, catalog)
  const verdict = checkCatalog({ catalog, previousAccepted: previous, lastWbStocks })
  const rejected = verdict.reasons.length > 0
  if (verdict.missingInStock.length > 0) counters.catalogMissingInStock = verdict.missingInStock.length
  if (rejected && !deps.acceptCatalog) {
    counters.catalogRejected = 1
    const why = verdict.reasons.join("; ")
    return { status: "partial", counters, errors: [`${why} — снимки и заказы зеркал пропущены; если это правда: ${ACCEPT_CATALOG_HINT}`] }
  }
  if (deps.acceptCatalog) {
    deps.log.warn(
      { wbCatalog: catalog.length, previousAccepted: previous, missingInStock: verdict.missingInStock.length },
      "каталог WB принят без проверки ворот (--accept-catalog)",
    )
    if (rejected) counters.catalogForced = 1
  }
  counters[CATALOG_ACCEPTED_KEY] = catalog.length

  // Битый конфиг необязательной площадки (сайта) — она пропущена, остальные читаются.
  errors.push(...(deps.adapters.configErrors ?? []))
  const all: ChannelAdapter[] = [deps.adapters.wb, ...deps.adapters.mirrors(buildWbCatalogIndex(catalog))]
  for (const a of all) {
    const ch = channels.get(a.channel)
    if (!ch) {
      errors.push(`${a.channel}: нет в таблице channels`)
      continue
    }
    try {
      const rows = (await a.fetchOrders(since)).filter((o) => o.quantity > 0).map(toUpsert)
      // Первое чтение площадки ставит её базовую точку: заказы этого прогона пул примет
      // холодным стартом по площадке (ingestChannelOrders, этап 1.3c).
      const r = await ingestChannelOrders(db, { channelId: ch.id, code: a.channel, runId, rows })
      counters[`${a.channel}Orders`] = r.written
      if (r.baselineSet) counters[`${a.channel}OrdersBaseline`] = 1
    } catch (e) {
      // Только сигнал: запись остатков этот счётчик НЕ блокирует (решение владельца 28.09, п. 1) —
      // pool пишет по последним известным заказам из базы; переход ingest в partial шлёт уведомление.
      counters[`${a.channel}OrdersFailed`] = 1
      errors.push(`${a.channel} заказы: ${errorText(e)}`)
    }
    try {
      const s = await a.fetchStocks()
      await insertStockSnapshot(db, { channelId: ch.id, runId, takenAt: deps.now().toISOString(), stocks: s.stocks })
      counters[`${a.channel}Stock`] = s.stocks.length
      counters[`${a.channel}Skipped`] = s.skippedNoWbBarcode.length
      // Источник остатка витрины сайта: pool пишет сайт только при pool (этап 1.4, pool.ts).
      if (a.channel === "site" && "source" in s) counters.siteSourcePool = s.source === "pool" ? 1 : 0
    } catch (e) {
      errors.push(`${a.channel} остатки: ${errorText(e)}`)
    }
  }
  return { status: errors.length ? "partial" : "ok", counters, errors }
}
