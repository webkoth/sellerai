// Написано по образцу sync/src/kit.ts (старый синк, заплатка 27.09.2026,
// проверена на живом магазине kit42191) — не перенос из finstock: там
// площадки KIT не было вовсе. requestJson (../http.ts) взят как есть —
// откат при лимитах и сетевых сбоях у KIT тот же, что у остальных площадок.
import { requestJson, type RequestOptions } from "../http"

export const BASE = "https://api.kit.yandex.net"

/** Учётные данные KIT — один Bearer-токен (`YAKIT_API_TOKEN`). */
export interface KitCredentials {
  token: string
}

/**
 * Авторизация для `requestJson`: без `authHeader` токен уходит голым под
 * именем `Authorization` (см. ../http.ts) — префикс `Bearer`, который ждёт
 * KIT, добавляется здесь, в значение токена.
 */
function kitAuth(credentials: KitCredentials) {
  return { token: `Bearer ${credentials.token}`, authHeader: "Authorization" }
}

/**
 * Минимальный интервал между СТАРТАМИ двух запросов к KIT, мс. При
 * параллельных запросах площадка рвёт соединение — наблюдение старого
 * синка (sync/src/kit.ts, `PACE_MS = 1100`), не документированный лимит
 * площадки. 1100, а не 1000: запас на дрожание таймера сна.
 */
const PACE_MS = 1100

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Очередь пауз — общая на МОДУЛЬ, а не на вызов: гарантирует строгую
 * последовательность стартов запросов, даже если вызывающий код запустит
 * несколько fetchKit* «параллельно» (`Promise.all`, как в kit/adapter.ts
 * при первом заходе за вариантами и заказами сразу) — второй старт всё
 * равно встанет в очередь и подождёт своих 1100 мс, а не рванёт вместе
 * с первым.
 */
let queue: Promise<void> = Promise.resolve()
let lastCallAt = 0

async function waitTurn(): Promise<void> {
  const turn = queue.then(async () => {
    const wait = lastCallAt + PACE_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastCallAt = Date.now()
  })
  // Не даём одному сбою в очереди развалить её для всех последующих
  // ожидающих — каждый вызывающий видит СВОЙ `turn`, а не общий `queue`.
  queue = turn.catch(() => {})
  return turn
}

/**
 * Сброс очереди пауз — только для тестов: без него состояние модуля
 * («когда был последний запрос») переживало бы конец одного теста и портило
 * ожидание паузы в следующем.
 */
export function resetKitPaceForTests(): void {
  queue = Promise.resolve()
  lastCallAt = 0
}

/**
 * Запрос к KIT поверх `requestJson`, с паузой не короче `PACE_MS` от старта
 * предыдущего запроса (см. `waitTurn`) — единственный вход в сеть у этого
 * клиента, чтобы темп не смог случайно нарушиться в новом методе.
 */
export async function kitRequest<T = unknown>(
  credentials: KitCredentials,
  path: string,
  options: Omit<RequestOptions, "token" | "authHeader"> = {},
): Promise<T> {
  await waitTurn()
  return requestJson<T>("kit", `${BASE}${path}`, { ...kitAuth(credentials), ...options })
}

// ── Варианты (каталог продавца в KIT) ───────────────────────────────────────

export interface KitStockEntry {
  quantity: number
  reserved?: number
  warehouse_id: string
}

/**
 * Вариант товара KIT. `barcode` — штрихкод WB напрямую: варианты магазина
 * kit42191 заведены со штрихкодами WB при первом импорте (память «Яндекс KIT
 * store»), поэтому в отличие от Ozon/ЯМ здесь нет отдельного разрешения через
 * `resolveWbBarcode` (см. kit/mapper.ts).
 */
export interface KitVariant {
  id: string
  barcode: string | null
  stocks?: KitStockEntry[] | null
}

interface KitVariantsResponse {
  variants?: KitVariant[] | null
  total_count?: number
}

const PAGE_SIZE = 100
/** Потолок числа страниц — на патологию, не рабочий лимит (как в ozon/client.ts). */
const MAX_PAGES = 1000

/**
 * Все варианты магазина, `GET /v1/variants`. У ответа нет признака «есть
 * ещё» (в отличие от `total_count`, который был неточным на живом прогоне
 * старого синка) — листаем, как в sync/src/kit.ts, до страницы короче
 * `PAGE_SIZE`.
 */
export async function fetchKitVariants(credentials: KitCredentials): Promise<KitVariant[]> {
  const all: KitVariant[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await kitRequest<KitVariantsResponse>(credentials, `/v1/variants?per_page=${PAGE_SIZE}&page=${page}`)
    const got = body.variants ?? []
    all.push(...got)
    if (got.length < PAGE_SIZE) break
  }
  return all
}

// ── Заказы ───────────────────────────────────────────────────────────────

export interface KitOrderItem {
  id: string
  product_variant_id: string
  quantity: number
  /** Цена позиции СО СКИДКАМИ, рубли десятичной строкой (живой ответ, фикстура `orders-sample.json`). */
  final_price: string
}

export interface KitDeliveryChunk {
  items: KitOrderItem[]
}

/**
 * Заказ KIT. `client` — персональные данные покупателя (имя, телефон,
 * e-mail) — типизирован как есть, чтобы маппер (`mapKitOrders`) мог
 * типобезопасно вырезать его из `raw` перед тем, как строка заказа уйдёт
 * в базу синка: снимок для разбора споров не должен нести личные данные
 * (план, задача 6, шаг 1 — то же правило, что и для образцов ответов).
 */
export interface KitOrder {
  id: string
  status: string
  created_at: string
  delivery_chunks: KitDeliveryChunk[]
  client?: unknown
}

interface KitOrdersResponse {
  orders?: KitOrder[] | null
  total_count?: number
}

/**
 * Все заказы магазина, `GET /v1/orders`. Без фильтра по дате — площадка его
 * не даёт (как в sync/src/kit.ts); окно `since` применяет `mapKitOrders`,
 * не клиент.
 */
export async function fetchKitOrders(credentials: KitCredentials): Promise<KitOrder[]> {
  const all: KitOrder[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await kitRequest<KitOrdersResponse>(credentials, `/v1/orders?per_page=${PAGE_SIZE}&page=${page}`)
    const got = body.orders ?? []
    all.push(...got)
    if (got.length < PAGE_SIZE) break
  }
  return all
}
