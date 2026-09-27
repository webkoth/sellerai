// Перенесено из finstock (27.09.2026): packages/platforms/src/ozon/client.ts.
// Без изменений логики: клиент не содержит ничего финансового (отчёт о
// реализации и выписка живут в отдельных finance-client.ts/tariff-client.ts
// finstock, которые в sync2 не переносятся вовсе).
import { requestJson } from "../http"

export const BASE = "https://api-seller.ozon.ru"

/**
 * Учётные данные Ozon. Авторизация — два заголовка, `Authorization` не
 * используется вовсе (см. `requestJson` в ../http.ts: `token` уходит под
 * именем `authHeader`, второй заголовок передаётся через `headers`).
 */
export interface OzonCredentials {
  clientId: string
  apiKey: string
}

/**
 * Параметры `requestJson` для авторизации Ozon: ключ уходит под именем
 * `Api-Key`, идентификатор продавца — отдельным заголовком. Один хелпер на
 * все вызовы, чтобы новый метод не смог случайно уйти без `Client-Id`.
 */
export function ozonAuth(credentials: OzonCredentials) {
  return {
    token: credentials.apiKey,
    authHeader: "Api-Key",
    headers: { "Client-Id": credentials.clientId },
  }
}

/**
 * Дата для фильтров Ozon — RFC 3339 без миллисекунд, как в примерах
 * спецификации (`2019-08-24T14:15:22Z`). Курсор синка приходит либо датой
 * `ГГГГ-ММ-ДД`, либо ISO с миллисекундами — оба приводятся сюда.
 */
export function toRfc3339(value: string): string {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z")
}

/**
 * Цена товара в отправлении. Спецификация описывает `price` строкой; живой
 * ответ (фикстура `fixtures/postings-sample.json`, снята 03.09.2026) отдаёт
 * объект: `amount` — десятичная строка без валюты, `currency` — код.
 * Переводить в копейки нужно разбором строки `amount`
 * (`decimalStringToMinor`), не проходя через число с плавающей точкой.
 * Здесь, в клиенте, цена остаётся как есть — разбор не его забота.
 */
export interface OzonPostingPrice {
  amount: string
  currency: string
}

export interface OzonPostingProduct {
  offer_id: string
  sku: number
  name: string
  quantity: number
  price: OzonPostingPrice
}

/** Причина и обстоятельства отмены — присутствует всегда, пустая при отсутствии отмены. */
export interface OzonCancellation {
  cancel_reason_id: number
  cancel_reason: string
  cancellation_type: string
  cancelled_after_ship: boolean
  affect_cancellation_rating: boolean
  cancellation_initiator: string
}

/**
 * Отправление (posting) — единица заказа Ozon. Подмножество полей ответа
 * `/v4/posting/fbs/list`, которое понадобится мапперу. Баркода здесь нет —
 * только `offer_id` и `sku`; штрихкод WB достаётся через `resolveWbBarcode`
 * (см. mapper.ts).
 */
export interface OzonPosting {
  posting_number: string
  order_id: number
  order_number: string
  status: string
  substatus: string
  in_process_at: string
  cancellation: OzonCancellation
  products: OzonPostingProduct[]
}

/**
 * Ответ `/v4/posting/fbs/list` — без обёртки `result`, в отличие от `/v3`
 * (см. ниже, почему `/v3` не используется вовсе). `cursor` и `has_next` лежат
 * на верхнем уровне рядом с `postings`.
 */
interface OzonPostingListResponse {
  cursor: string
  has_next: boolean
  postings: OzonPosting[]
}

/**
 * Верхний предел числа страниц пагинации — последний рубеж, а не рабочий
 * лимит. Обычное завершение цикла — `has_next: false`, пустая страница или
 * незавершённый курсор (см. комментарий к `fetchOzonPostings`). Этот потолок
 * ловит только патологию: площадку, которая исправно продвигает курсор и
 * шлёт данные бесконечно. 1000 страниц по лимиту 100 — это уже 100 000
 * отправлений за один синк, а для остатков (`fetchOzonStocks`, лимит 1000)
 * — миллион товаров; кабинет такого размера не ожидается.
 */
const MAX_PAGES = 1000

/**
 * Строк на страницу. Максимум для `/v4/posting/fbs/list` — 100 (у снятого
 * `/v3/posting/fbs/list` было 1000 — значения не совпадают, при переходе
 * с v3 на v4 лимит нужно было проверить отдельно, а не перенести как есть).
 */
const PAGE_LIMIT = 100

/**
 * Заказы (отправления) за период через `POST /v4/posting/fbs/list`.
 *
 * НЕ `/v3/posting/fbs/list`. Спецификация (`sai_kotelnikovartifact/docs/
 * api-reference/openapi/ozon/swagger_ozon.json`) помечает его
 * `"deprecated": true` с прямым текстом: «С 1 июня 2026 года метод будет
 * отключён. Переключитесь на /v4/posting/fbs/list» — дата отключения уже
 * прошла к моменту написания этого клиента в finstock (1 сентября 2026).
 *
 * ПАГИНАЦИЯ — КУРСОР, НЕ СМЕЩЕНИЕ. `/v3` пагинировал `offset`; `/v4` этого
 * поля не принимает вовсе — вместо него `cursor`, непрозрачная строка,
 * которую площадка выдаёт в ответе и ожидает обратно в следующем запросе.
 *
 * Итоговые гварды, от внутреннего к внешнему:
 * 1. Пустая страница — `postings.length === 0` — останавливает цикл
 *    независимо от `has_next`.
 * 2. `has_next: false` — обычное, ожидаемое завершение.
 * 3. Курсор не продвинулся — либо площадка не прислала новый курсор
 *    (`!body.cursor`), либо прислала тот же, что был отправлен.
 * 4. `MAX_PAGES` — потолок сверху на случай площадки, которая исправно
 *    продвигает курсор, но никогда не говорит `has_next: false`.
 */
export async function fetchOzonPostings(
  credentials: OzonCredentials,
  since: string,
): Promise<OzonPosting[]> {
  const to = toRfc3339(new Date().toISOString())
  const all: OzonPosting[] = []
  let cursor: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<OzonPostingListResponse>("ozon", `${BASE}/v4/posting/fbs/list`, {
      ...ozonAuth(credentials),
      method: "POST",
      body: {
        sort_dir: "ASC",
        filter: { since: toRfc3339(since), to },
        limit: PAGE_LIMIT,
        ...(cursor !== undefined ? { cursor } : {}),
      },
    })

    const postings = body.postings
    if (postings.length === 0) break // гвард 1: пустая страница

    all.push(...postings)

    if (!body.has_next) break // гвард 2: площадка сказала, что дальше ничего нет

    if (!body.cursor || body.cursor === cursor) break // гвард 3: курсор не продвинулся
    cursor = body.cursor
  }

  return all
}

/** Одна запись остатка: тип склада (`fbs`, `rfbs`, `fbo`, `fbp`), на складе и в резерве. */
export interface OzonStockEntry {
  type: string
  present: number
  reserved: number
  sku?: number
  shipment_type?: string
  warehouse_ids?: number[]
}

/** Товар с остатками по типам складов — элемент `items[]` ответа `/v4/product/info/stocks`. */
export interface OzonStockItem {
  offer_id: string
  product_id: number
  stocks: OzonStockEntry[]
}

interface OzonStocksResponse {
  cursor: string
  items: OzonStockItem[] | null
  /**
   * «Количество уникальных товаров, для которых выводится информация».
   * Сознательно НЕ используется как признак конца выдачи: по одной живой
   * странице не различить, это всего товаров или товаров на странице.
   */
  total: number
}

/** Максимум спецификации для `/v4/product/info/stocks`. */
const STOCKS_PAGE_LIMIT = 1000

/**
 * Остатки всех товаров кабинета, `POST /v4/product/info/stocks`, постранично
 * по курсору. `visibility: "ALL"` — нужны и скрытые, и с нулём: товар с нулём
 * это «выставлен и пуст», для сравнения зеркал это значение, а не пропуск.
 *
 * Признака «есть ещё» у метода нет; конец — неполная страница. Курсор,
 * который не продвинулся, тоже останавливает цикл (та же логика, что в
 * `fetchOzonPostings`), а `MAX_PAGES` — потолок на патологию.
 */
export async function fetchOzonStocks(credentials: OzonCredentials): Promise<OzonStockItem[]> {
  const all: OzonStockItem[] = []
  let cursor: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<OzonStocksResponse>("ozon", `${BASE}/v4/product/info/stocks`, {
      ...ozonAuth(credentials),
      method: "POST",
      body: {
        filter: { visibility: "ALL" },
        limit: STOCKS_PAGE_LIMIT,
        ...(cursor !== undefined ? { cursor } : {}),
      },
    })

    const items = body.items ?? []
    if (items.length === 0) break
    all.push(...items)
    if (items.length < STOCKS_PAGE_LIMIT) break
    if (!body.cursor || body.cursor === cursor) break
    cursor = body.cursor
  }

  return all
}

/** Товар из `/v3/product/info/list` — подмножество полей, которое нужно для баркода. */
export interface OzonProductInfo {
  id: number
  offer_id: string
  sku: number
  name: string
  /** «Все штрихкоды товара». Бывает `null`. */
  barcodes: string[] | null
}

/** Ограничение спецификации: не больше 1000 идентификаторов за вызов, по всем полям в сумме. */
const PRODUCT_INFO_BATCH_SIZE = 1000

/**
 * Штрихкоды по артикулам, `POST /v3/product/info/list`. Ни отправления, ни
 * остатки Ozon баркод не несут — только артикул продавца; баркод живёт в
 * карточке товара. Тот же приём, что у WB с `content/v2/get/cards/list`.
 *
 * Пустой список не делает запроса. Повторы схлопываются до одного запроса.
 * Товар без штрихкодов кладётся в карту с пустым списком: «спросили, ответа
 * нет» отличается от «не спрашивали».
 */
export async function fetchOzonBarcodes(
  credentials: OzonCredentials,
  offerIds: string[],
): Promise<Map<string, string[]>> {
  const unique = [...new Set(offerIds)]
  const result = new Map<string, string[]>()

  for (let i = 0; i < unique.length; i += PRODUCT_INFO_BATCH_SIZE) {
    const batch = unique.slice(i, i + PRODUCT_INFO_BATCH_SIZE)
    const body = await requestJson<{ items: OzonProductInfo[] | null }>(
      "ozon",
      `${BASE}/v3/product/info/list`,
      { ...ozonAuth(credentials), method: "POST", body: { offer_id: batch } },
    )
    for (const item of body.items ?? []) {
      result.set(item.offer_id, item.barcodes ?? [])
    }
  }

  return result
}
