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

function noop(): void {}

/**
 * Пауза перед СТАРТОМ следующего запроса, отмеряется от старта предыдущего.
 */
let lastCallAt = 0

async function pace(): Promise<void> {
  const wait = lastCallAt + PACE_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastCallAt = Date.now()
}

/**
 * Очередь запросов — общая на МОДУЛЬ, а не на вызов, и держит в себе ВЕСЬ
 * запрос (паузу темпа плюс сам `requestJson`), а не только паузу.
 *
 * Раньше очередь разносила только СТАРТЫ (`waitTurn` ждал 1100 мс и сразу
 * освобождал место следующему), и это не защищало от главного: если ответ
 * первого запроса шёл дольше 1100 мс, второй стартовал ПОКА ПЕРВЫЙ ЕЩЁ БЫЛ
 * В ПОЛЁТЕ — то самое пересечение, из-за которого площадка рвёт соединение
 * (sync/src/kit.ts). Здесь `run` — пауза И запрос вместе, а `queue`
 * продвигается только когда `run` СЕТТЛИТСЯ (успехом или ошибкой) — значит
 * следующий вызов не может начать свою паузу, пока предыдущий запрос не
 * закончился целиком, независимо от того, сколько параллельных вызовов
 * (`Promise.all` или просто гонка двух `await`) пришло почти одновременно.
 *
 * `queue = run.then(noop, noop)`, а не `run` напрямую: ошибка одного запроса
 * не должна распространяться на цепочку и блокировать следующий вызов —
 * `noop` на обоих путях (успех/отказ) превращает любой исход в разрешённый
 * `undefined`, и следующий `.then(pace)` в очереди всё равно запускается.
 */
let queue: Promise<unknown> = Promise.resolve()

/**
 * Сброс очереди — только для тестов: без него состояние модуля («когда был
 * последний запрос», «что сейчас в очереди») переживало бы конец одного
 * теста и портило бы следующий.
 */
export function resetKitPaceForTests(): void {
  queue = Promise.resolve()
  lastCallAt = 0
}

/**
 * Запрос к KIT поверх `requestJson` — единственный вход в сеть у этого
 * клиента, чтобы темп и последовательность не смогли случайно нарушиться
 * в новом методе. См. комментарий у `queue`: следующий вызов ждёт не только
 * паузу темпа, но и ЗАВЕРШЕНИЯ этого запроса целиком.
 */
export function kitRequest<T = unknown>(
  credentials: KitCredentials,
  path: string,
  options: Omit<RequestOptions, "token" | "authHeader"> = {},
): Promise<T> {
  const run = queue.then(pace).then(() => requestJson<T>("kit", `${BASE}${path}`, { ...kitAuth(credentials), ...options }))
  queue = run.then(noop, noop)
  return run
}

// ── Варианты (каталог продавца в KIT) ───────────────────────────────────────

export interface KitStockEntry {
  quantity: number
  reserved?: number
  warehouse_id: string
}

/**
 * Вариант товара KIT. `barcode`, по наблюдению, УЖЕ штрихкод WB (варианты
 * магазина kit42191 заведены с ним при первом импорте, память «Яндекс KIT
 * store») — тем не менее ключ товара во всём синке разрешается через
 * `resolveWbBarcode` по каталогу WB (`mapper.ts`), как у Ozon/ЯМ, а не
 * принимается на веру: `sku` — артикул продавца (второй, запасной ключ
 * сопоставления — offer_id = артикул WB).
 */
export interface KitVariant {
  id: string
  barcode: string | null
  sku?: string | null
  stocks?: KitStockEntry[] | null
}

interface KitVariantsResponse {
  variants?: KitVariant[] | null
  total_count?: number
}

const PAGE_SIZE = 100
/**
 * Потолок числа страниц — последний рубеж на патологию (площадка, которая
 * никогда не отдаёт короткую страницу), не рабочий лимит (как в
 * ozon/client.ts). Обычное завершение цикла — страница короче `PAGE_SIZE`.
 * Если потолок всё же достигнут, функция БРОСАЕТ, а не молча отдаёт то, что
 * успела собрать: частичный список каталога или заказов синк не отличил бы
 * от полного, а неполный каталог WB как раз запрещено принимать без
 * разбора (план, «Поправки при исполнении», пункт про 1.3b) — то же самое
 * верно и для KIT.
 */
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
    if (got.length < PAGE_SIZE) return all
  }
  throw new Error(`KIT: варианты не кончились за ${MAX_PAGES} страниц — похоже на зацикливание пагинации`)
}

// ── Заказы ───────────────────────────────────────────────────────────────

export interface KitOrderItem {
  id: string
  product_variant_id: string
  quantity: number
  /** Цена позиции СО СКИДКАМИ, рубли десятичной строкой (живой ответ, фикстура `orders-sample.json`). */
  final_price: string
}

/**
 * Неперсональная часть доставки части заказа — то немногое из
 * `delivery_info`, что маппер (`mapKitOrders`) кладёт в `raw`: способ и
 * статус доставки, склад отгрузки. НЕ включает `address` — адрес получателя
 * (домашний для курьерской доставки) — персональные данные, которых в
 * снимке для разбора споров быть не должно (см. `mapKitOrders`, allow-list
 * `raw`).
 */
export interface KitDeliveryInfo {
  method: string
  raw_status: string
  warehouse_id: string
}

export interface KitDeliveryChunk {
  id: number
  delivery_info: KitDeliveryInfo
  items: KitOrderItem[]
}

/**
 * Заказ KIT. `client` (имя, телефон, e-mail покупателя) и адрес доставки
 * внутри `delivery_chunks[].delivery_info.address` — персональные данные
 * площадки; маппер (`mapKitOrders`) строит `raw` через ЯВНЫЙ allow-list
 * полей (id, order_number, status, created_at, позиция, часть доставки без
 * адреса), а не вычитанием `client` из копии заказа — вычитание одного поля
 * оставляло бы адрес получателя в `raw` нетронутым (найдено финальным
 * ревью 1.3a).
 */
export interface KitOrder {
  id: string
  order_number: number
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
    if (got.length < PAGE_SIZE) return all
  }
  throw new Error(`KIT: заказы не кончились за ${MAX_PAGES} страниц — похоже на зацикливание пагинации`)
}
