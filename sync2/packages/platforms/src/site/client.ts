// Служебный API сайта kotelnikovartifact.ru (репозиторий kotelnikovartifact,
// этап 1.3c синка v2): GET /api/internal/orders, GET/PUT /api/internal/stocks
// за `Authorization: Bearer <INTERNAL_API_TOKEN сайта>` (здесь — SITE_API_TOKEN).
// requestJson (../http.ts) — как у остальных площадок: повтор на 5xx и сетевых
// сбоях, 401/400 не повторяются.
import { requestJson, type RequestOptions } from "../http"

export interface SiteCredentials {
  /** Корень сайта без завершающего слэша, например https://kotelnikovartifact.ru. */
  baseUrl: string
  token: string
}

/** Откуда витрина сайта сейчас берёт остаток (STOCK_SOURCE сайта). */
export type SiteStockSource = "wb" | "pool"

export interface SiteOrderItem {
  lineId: string
  /** Штрихкод WB позиции; null — сайт не свёл позицию к размеру однозначно. */
  barcode: string | null
  quantity: number
  priceKopecks: number
}

export interface SiteOrder {
  id: string
  number: string
  /** У сайта один статус — `new`; см. lifecycle.ts. */
  status: string
  /** ISO UTC с «Z». */
  createdAt: string
  items: SiteOrderItem[]
}

interface SiteOrdersResponse {
  orders?: SiteOrder[] | null
  truncated?: boolean
}

export interface SiteStockItem {
  barcode: string
  quantity: number
}

export interface SiteStocksResponse {
  source: SiteStockSource
  items: SiteStockItem[]
}

export interface SitePutResult {
  updated: number
  unknown: string[]
}

/** Позиций в одном PUT — предел схемы на стороне сайта (app/api/internal/stocks). */
export const SITE_PUT_MAX_ITEMS = 5000

/**
 * Без `authHeader` requestJson кладёт токен голым в `Authorization` — префикс
 * `Bearer` добавляется в значение, как у KIT (../kit/client.ts).
 */
function siteAuth(credentials: SiteCredentials) {
  return { token: `Bearer ${credentials.token}`, authHeader: "Authorization" }
}

export function siteRequest<T = unknown>(
  credentials: SiteCredentials,
  path: string,
  options: Omit<RequestOptions, "token" | "authHeader"> = {},
): Promise<T> {
  return requestJson<T>("site", `${credentials.baseUrl}${path}`, { ...siteAuth(credentials), ...options })
}

/**
 * Заказы сайта с `since`. `truncated` — ошибка, а не частичный список:
 * неполный список синк не отличил бы от полного, а при окне 60 дней и
 * единицах заказов в неделю предел ответа (1000) — признак сбоя, не нормы.
 */
export async function fetchSiteOrders(credentials: SiteCredentials, since: string): Promise<SiteOrder[]> {
  const body = await siteRequest<SiteOrdersResponse>(credentials, `/api/internal/orders?since=${encodeURIComponent(since)}`)
  if (!Array.isArray(body.orders)) throw new Error("сайт: ответ заказов без списка orders")
  if (body.truncated) throw new Error(`сайт: заказов с ${since} больше предела ответа — список неполный`)
  return body.orders
}

export async function fetchSiteStocks(credentials: SiteCredentials): Promise<SiteStocksResponse> {
  const body = await siteRequest<Partial<SiteStocksResponse>>(credentials, "/api/internal/stocks")
  if (body.source !== "wb" && body.source !== "pool") {
    throw new Error(`сайт: неизвестный источник остатка «${String(body.source)}»`)
  }
  if (!Array.isArray(body.items)) throw new Error("сайт: ответ остатков без списка items")
  return { source: body.source, items: body.items }
}

/**
 * Запись абсолютных остатков пула на сайт (`PUT /api/internal/stocks`), пачками
 * по SITE_PUT_MAX_ITEMS. Повтор безопасен — значения абсолютные. Этап 1.4:
 * в 1.3c к pool не подключается (отправитель — noSender).
 */
export async function putSiteStocks(credentials: SiteCredentials, items: SiteStockItem[]): Promise<SitePutResult> {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.barcode)) throw new Error(`сайт: дубль штрихкода в записи остатков: ${item.barcode}`)
    seen.add(item.barcode)
  }
  const result: SitePutResult = { updated: 0, unknown: [] }
  for (let start = 0; start < items.length; start += SITE_PUT_MAX_ITEMS) {
    const chunk = items.slice(start, start + SITE_PUT_MAX_ITEMS)
    const r = await siteRequest<SitePutResult>(credentials, "/api/internal/stocks", { method: "PUT", body: { items: chunk } })
    result.updated += r.updated
    result.unknown.push(...r.unknown)
  }
  return result
}
