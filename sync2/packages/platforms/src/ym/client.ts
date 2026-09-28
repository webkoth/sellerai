// Перенесено из finstock (27.09.2026): packages/platforms/src/ym/client.ts.
// Финансовое убрано целиком: `payoutFrequency`/`YmPayoutFrequency`/
// `PAYOUT_PARAMETERS` (график выплат — только для калькулятора услуг,
// finance-client.ts/tariff-client.ts в sync2 не переносятся). `moscowDate` и
// `shiftDays` были в `@finstock/domain` — в sync2 их нет, здесь перенесён
// только нужный этому клиенту минимум (packages/domain/src/dates.ts).
import { requestJson } from "../http"

export const BASE = "https://api.partner.market.yandex.ru"

/**
 * Учётные данные Яндекс.Маркета. Ключ — в заголовке `Api-Key` (через
 * `authHeader` в `requestJson`), идентификаторы бизнеса и кампании — из
 * `config` кабинета: заказы и каталог живут на уровне бизнеса, остатки —
 * на уровне кампании (магазина).
 */
export interface YmCredentials {
  apiKey: string
  businessId: string
  campaignId: string
}

/** Авторизация для `requestJson`. */
export function ymAuth(credentials: YmCredentials) {
  return { token: credentials.apiKey, authHeader: "Api-Key" }
}

/** Потолок числа страниц — на патологию, не рабочий лимит (как в ozon/client.ts). */
const MAX_PAGES = 1000

/**
 * У площадки нет отдельного признака «есть ещё» — только `paging.nextPageToken`.
 * Пустая страница (без заказов/складов/сопоставлений) или страница без токена
 * останавливает цикл ниже, в `fetchYmOrders`, `fetchYmStocks` и
 * `fetchYmBarcodes`.
 *
 * Известная особенность площадки: `limit`/`pageToken` уходят ТОЛЬКО в строку
 * запроса, а не в тело — `pagedUrl` собирает их отдельно от POST-тела.
 */

function pagedUrl(path: string, limit: number, pageToken: string | undefined): string {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set("limit", String(limit))
  if (pageToken) url.searchParams.set("pageToken", pageToken)
  return url.toString()
}

// ── Даты (минимальный перенос packages/domain/src/dates.ts) ────────────────

const MOSCOW_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function partValue(parts: Intl.DateTimeFormatPart[], type: string): string {
  const part = parts.find((p) => p.type === type)
  if (!part) throw new Error(`форматтер дат не вернул часть "${type}"`)
  return part.value
}

/** Момент времени → московская дата `ГГГГ-ММ-ДД`: бизнес и площадка живут по Москве. */
function moscowDate(at: Date = new Date()): string {
  const parts = MOSCOW_FORMATTER.formatToParts(at)
  return `${partValue(parts, "year")}-${partValue(parts, "month")}-${partValue(parts, "day")}`
}

function toUtc(iso: string): Date {
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || toIso(date) !== iso) throw new RangeError(`не дата: ${iso}`)
  return date
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Сдвиг даты на целое число суток, через UTC-полночь — без перехода на летнее время. */
function shiftDays(iso: string, days: number): string {
  const date = toUtc(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIso(date)
}

// ── Заказы ───────────────────────────────────────────────────────────────

export interface YmMoney {
  value: number
  currencyId?: string
}

export interface YmOrderItem {
  id: number
  offerId: string
  offerName?: string
  count: number
  /** Суммы за ВСЕ единицы товара в строке (спецификация: «возвращается суммарное значение»). */
  prices?: { payment?: YmMoney; subsidy?: YmMoney; cashback?: YmMoney }
}

export interface YmOrder {
  orderId: number
  campaignId: number
  programType: string
  status: string
  substatus?: string
  /** ISO 8601 со смещением. */
  creationDate: string
  updateDate?: string
  fake: boolean
  items: YmOrderItem[]
}

/**
 * Ответ `/v1/businesses/{businessId}/orders`: `orders` и `paging` на верхнем
 * уровне, без `result`. Поле `status`, которое спецификация обещает, в живом
 * ответе отсутствует (фикстура `orders-sample.json`) — поэтому необязательное
 * и ни на что не влияет.
 */
interface YmOrdersResponse {
  status?: string | null
  orders?: YmOrder[] | null
  paging?: { nextPageToken?: string | null } | null
}

const ORDERS_PAGE_LIMIT = 50

/** Ограничение спецификации: между `creationDateFrom` и `creationDateTo` не больше 30 дней. */
const ORDERS_WINDOW_DAYS = 30

/**
 * Режет период по дате оформления на окна не длиннее 30 дней, границы
 * включительно — это внутренняя модель окон (день `from` и день `to`
 * входят оба), а не то, что уходит в HTTP-тело: у площадки `creationDateTo`
 * исключающая граница, перевод в неё сделан в `fetchYmOrders`, там же, где
 * строится тело запроса. Начало позже конца даёт одно окно из конечной
 * даты: курсор не может быть в будущем, но если что-то пошло не так, запрос
 * всё равно должен быть корректным.
 */
export function creationWindows(fromDate: string, toDate: string): Array<{ from: string; to: string }> {
  const windows: Array<{ from: string; to: string }> = []
  let from = fromDate > toDate ? toDate : fromDate
  while (from <= toDate) {
    const to = shiftDays(from, ORDERS_WINDOW_DAYS - 1)
    windows.push({ from, to: to < toDate ? to : toDate })
    from = shiftDays(to, 1)
  }
  return windows
}

/**
 * Заказы кабинета с даты оформления `since` по `until` (по умолчанию —
 * сегодня по Москве), `POST /v1/businesses/{businessId}/orders`.
 *
 * НЕ `GET /v2/campaigns/{campaignId}/orders`: он помечен в спецификации
 * устаревшим. Метод по кабинету — тот, которым работает `sai`.
 *
 * Фильтр — по дате оформления окнами по 30 дней (ограничение спецификации),
 * `fake: false` отсекает тестовые заказы Маркета, `campaignIds` — только
 * свой магазин. `since` может прийти ISO-временем с миллисекундами (курсор)
 * — берётся московская дата, не UTC: бизнес и площадка живут по Москве, а
 * момент между 00:00 и 03:00 по Москве по UTC-дате — это ещё «вчера» (МСК
 * на три часа впереди UTC), и окно сдвинулось бы на сутки раньше нужного;
 * то же самое верно для `until` по умолчанию. `creationDateFrom`
 * включительно, `creationDateTo` НЕ включительно (справка и спецификация
 * площадки), поэтому в тело уходит следующий день после конца окна.
 */
export async function fetchYmOrders(
  credentials: YmCredentials,
  since: string,
  until: string = moscowDate(),
): Promise<YmOrder[]> {
  const all: YmOrder[] = []

  for (const window of creationWindows(moscowDate(new Date(since)), until)) {
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await requestJson<YmOrdersResponse>(
        "ym",
        pagedUrl(`/v1/businesses/${credentials.businessId}/orders`, ORDERS_PAGE_LIMIT, pageToken),
        {
          ...ymAuth(credentials),
          method: "POST",
          body: {
            dates: { creationDateFrom: window.from, creationDateTo: shiftDays(window.to, 1) },
            fake: false,
            campaignIds: [Number(credentials.campaignId)],
          },
        },
      )
      const orders = body.orders ?? []
      all.push(...orders)
      const next = body.paging?.nextPageToken ?? undefined
      if (!next || next === pageToken || orders.length === 0) break
      pageToken = next
    }
  }

  return all
}

// ── Остатки ──────────────────────────────────────────────────────────────

export interface YmStockEntry {
  /** FIT | FREEZE | AVAILABLE | QUARANTINE | UTILIZATION | DEFECT | EXPIRED */
  type: string
  count: number
}

export interface YmWarehouseOffer {
  offerId: string
  stocks?: YmStockEntry[] | null
  updatedAt?: string
}

export interface YmWarehouseStocks {
  warehouseId: number
  offers: YmWarehouseOffer[]
}

interface YmStocksResponse {
  status: string
  result?: {
    paging?: { nextPageToken?: string | null } | null
    warehouses?: YmWarehouseStocks[] | null
  } | null
}

const STOCKS_PAGE_LIMIT = 200

/**
 * Остатки магазина по складам, `POST /v2/campaigns/{campaignId}/offers/stocks`.
 * Для FBS в ответе партнёрский склад и, возможно, склад возвратов Маркета
 * (спецификация) — возвращаются все, только склады из конфига магазина
 * отбирает маппер (`mapYmStocks`), не клиент. Страницы склеиваются списком
 * складов как есть: один склад может встретиться на двух страницах с
 * разными товарами.
 */
export async function fetchYmStocks(credentials: YmCredentials): Promise<YmWarehouseStocks[]> {
  const all: YmWarehouseStocks[] = []
  let pageToken: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<YmStocksResponse>(
      "ym",
      pagedUrl(`/v2/campaigns/${credentials.campaignId}/offers/stocks`, STOCKS_PAGE_LIMIT, pageToken),
      { ...ymAuth(credentials), method: "POST", body: {} },
    )
    const warehouses = body.result?.warehouses ?? []
    all.push(...warehouses)
    const next = body.result?.paging?.nextPageToken ?? undefined
    if (!next || next === pageToken || warehouses.length === 0) break
    pageToken = next
  }

  return all
}

interface YmCampaignOffersResponse {
  status: string
  result?: {
    paging?: { nextPageToken?: string | null } | null
    offers?: Array<{ offerId?: string | null }> | null
  } | null
}

const CAMPAIGN_OFFERS_PAGE_LIMIT = 200

/**
 * Все офферы магазина, `POST /v2/campaigns/{campaignId}/offers`. Нужны снимку: оффер, которому остаток
 * ни разу не выставляли (статус NO_STOCKS), в `/offers/stocks` не приходит вовсе — без него синк не
 * узнал бы о карточке и никогда не выставил бы ей остаток (урок старого синка 04.09.2026: 11 живых
 * офферов с ценами «потерялись» так же).
 */
export async function fetchYmCampaignOfferIds(credentials: YmCredentials): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<YmCampaignOffersResponse>(
      "ym",
      pagedUrl(`/v2/campaigns/${credentials.campaignId}/offers`, CAMPAIGN_OFFERS_PAGE_LIMIT, pageToken),
      { ...ymAuth(credentials), method: "POST", body: {} },
    )
    const offers = body.result?.offers ?? []
    for (const o of offers) if (o.offerId) ids.push(o.offerId)
    const next = body.result?.paging?.nextPageToken ?? undefined
    if (!next || next === pageToken || offers.length === 0) break
    pageToken = next
  }
  return ids
}

// ── Каталог: штрихкоды ───────────────────────────────────────────────────

interface YmOfferMapping {
  offer?: { offerId: string; barcodes?: string[] | null; vendorCode?: string; name?: string } | null
}

interface YmOfferMappingsResponse {
  status: string
  result?: {
    paging?: { nextPageToken?: string | null } | null
    offerMappings?: YmOfferMapping[] | null
  } | null
}

/** Ограничение спецификации: `offerIds` до 100 за вызов, страница до 100. */
const MAPPINGS_BATCH_SIZE = 100

/**
 * Штрихкоды по артикулам, `POST /v2/businesses/{businessId}/offer-mappings`.
 * Ни заказы, ни остатки ЯМ баркод не несут — только артикул продавца; баркод
 * живёт в каталоге. Пустой список не делает запроса, повторы схлопываются,
 * товар без штрихкодов кладётся с пустым списком (см. fetchOzonBarcodes).
 * Страницы внутри пачки листаются на всякий случай: при `offerIds` до 100
 * и странице в 100 их одна.
 *
 * Сопоставление без `offer.offerId` в карту не попадает вовсе — вызывающий
 * увидит `undefined` для этого артикула через `map.get`, а не пустой список;
 * это отличается от товара с пустым `barcodes`, который даёт `[]`.
 */
export async function fetchYmBarcodes(
  credentials: YmCredentials,
  offerIds: string[],
): Promise<Map<string, string[]>> {
  const unique = [...new Set(offerIds)]
  const result = new Map<string, string[]>()

  for (let i = 0; i < unique.length; i += MAPPINGS_BATCH_SIZE) {
    const batch = unique.slice(i, i + MAPPINGS_BATCH_SIZE)
    let pageToken: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await requestJson<YmOfferMappingsResponse>(
        "ym",
        pagedUrl(`/v2/businesses/${credentials.businessId}/offer-mappings`, MAPPINGS_BATCH_SIZE, pageToken),
        { ...ymAuth(credentials), method: "POST", body: { offerIds: batch } },
      )
      const mappings = body.result?.offerMappings ?? []
      for (const mapping of mappings) {
        if (mapping.offer?.offerId) result.set(mapping.offer.offerId, mapping.offer.barcodes ?? [])
      }
      const next = body.result?.paging?.nextPageToken ?? undefined
      if (!next || next === pageToken || mappings.length === 0) break
      pageToken = next
    }
  }

  return result
}
