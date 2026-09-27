// Перенесено из finstock (27.09.2026): packages/platforms/src/wb/fbs-client.ts.
// Финансовая детализация, тарифы и всё, что к ним относится (`fetchAllBarcodes`,
// фото карточек, `subjectID` для сопоставления с комиссиями), убраны — этому
// плану они не нужны: каталог строится из `fetchAllCards` прямо в cards-mapper.ts.
import { requestJson } from "../http"

const MARKETPLACE = "https://marketplace-api.wildberries.ru"
const CONTENT = "https://content-api.wildberries.ru"

/** Сборочное задание FBS. Одно задание — одна единица товара. */
export interface WbFbsOrder {
  /** ID сборочного задания. */
  id: number
  /** Идентификатор задания на площадке (для разбора споров). */
  rid: string
  /** Артикул продавца. */
  article: string | null
  /** Список баркодов. Для товара с одним размером — один элемент. */
  skus: string[] | null
  /**
   * Цена продавца в копейках.
   *
   * ОСТОРОЖНО. Спецификация называет это поле `salePrice`. В настоящем ответе
   * такого поля НЕТ — проверено живым прогоном 01.09.2026, там `price`
   * и `convertedPrice` (для внутренних заказов равны, различаются только
   * на трансграничных).
   *
   * Не пропускать через rubToMinor: получится в сто раз больше.
   */
  price: number | null
  /** То же в валюте продавца. На внутренних заказах совпадает с `price`. */
  convertedPrice: number | null
  /** Дата создания задания, RFC3339. */
  createdAt: string
  warehouseId: number | null
}

/** Статус задания из /api/v3/orders/status. */
export interface WbFbsOrderStatus {
  id: number
  supplierStatus: string | null
  wbStatus: string | null
}

/**
 * `supplierStatus`, означающие отмену. Из описания метода
 * POST /api/v3/orders/status в спецификации WB (03-orders-fbs.yaml):
 * `cancel` — отменено продавцом, `cancel_carrier` — отменено перевозчиком
 * (только трансграничные поставки).
 */
const CANCELLED_SUPPLIER_STATUSES = new Set(["cancel", "cancel_carrier"])

/**
 * `wbStatus`, означающие отмену. Из описания метода
 * POST /api/v3/orders/status в спецификации WB (03-orders-fbs.yaml):
 * `canceled`, `canceled_by_client`, `declined_by_client`, `defect`,
 * `canceled_by_carrier`.
 */
const CANCELLED_WB_STATUSES = new Set([
  "canceled",
  "canceled_by_client",
  "declined_by_client",
  "defect",
  "canceled_by_carrier",
])

/**
 * Отмена опознаётся по любому из двух полей — продавец мог отменить сам
 * (`supplierStatus`), либо задание отменилось со стороны WB/покупателя/
 * перевозчика (`wbStatus`). Пропуск хотя бы одного значения из множеств
 * выше молча превращает вернувшийся экземпляр в «проданный» для приложения.
 */
export function isCancelledStatus(status: WbFbsOrderStatus): boolean {
  return (
    (status.supplierStatus != null && CANCELLED_SUPPLIER_STATUSES.has(status.supplierStatus)) ||
    (status.wbStatus != null && CANCELLED_WB_STATUSES.has(status.wbStatus))
  )
}

/**
 * Новые сборочные задания, `GET /api/v3/orders/new`. Без параметров.
 *
 * Отдаёт задания, находящиеся в статусе «новое» НА МОМЕНТ ЗАПРОСА — собранные
 * и отгруженные из ответа исчезают. Это не история, а снимок текущего
 * состояния, поэтому метод 2 (`fetchFbsOrders`) остаётся обязательной
 * подстраховкой: задание, собранное между двумя опросами этого метода,
 * здесь не появится никогда.
 */
export async function fetchNewFbsOrders(token: string): Promise<WbFbsOrder[]> {
  const response = await requestJson<{ orders: WbFbsOrder[] } | null>(
    "wb",
    `${MARKETPLACE}/api/v3/orders/new`,
    { token },
  )
  return response?.orders ?? []
}

/** Ставим всегда — максимум, разрешённый площадкой для одной страницы. */
const ORDERS_PAGE_LIMIT = 1000

/**
 * Задания за период, `GET /api/v3/orders`. Подстраховка к `fetchNewFbsOrders`:
 * задание, собранное между двумя опросами первого метода, в `/orders/new`
 * не появится вовсе — без второго прохода оно потерялось бы молча.
 *
 * `fromUnix` — Unix timestamp В ЦЕЛЫХ СЕКУНДАХ, часовой пояс UTC.
 * Не строки, не миллисекунды: ошибка в тысячу раз даёт запрос за период,
 * начинающийся в 55-м тысячелетии, — площадка честно отдаст пусто, и без
 * точной проверки в тесте это осталось бы незамеченным.
 *
 * Пагинация курсором: `next=0` в первом запросе, дальше — `next` из ответа.
 * Условие продолжения — полная страница (её длина равна лимиту) И курсор
 * из ответа не `0`/`null`/отсутствует: неполная страница всегда означает
 * конец перечня, а полная страница с пустым курсором — редкий, но законный
 * случай (последняя страница ровно кратна лимиту).
 *
 * `dateTo` намеренно НЕ передаётся. Спецификация описывает его как обычный
 * необязательный параметр, но живой разбор отказа 01.09.2026 показал другое:
 * с `dateTo` площадка отвечает 400 IncorrectParameter на любой период длиннее
 * примерно недели, а без него тот же запрос за 90 дней отдаёт 200 и все
 * задания до текущего момента.
 */
export async function fetchFbsOrders(token: string, fromUnix: number): Promise<WbFbsOrder[]> {
  const all: WbFbsOrder[] = []
  let next = 0

  for (;;) {
    const url = new URL(`${MARKETPLACE}/api/v3/orders`)
    url.searchParams.set("limit", String(ORDERS_PAGE_LIMIT))
    url.searchParams.set("next", String(next))
    url.searchParams.set("dateFrom", String(fromUnix))

    const page = await requestJson<{ orders: WbFbsOrder[]; next: number | null } | null>(
      "wb",
      url.toString(),
      { token },
    )
    const orders = page?.orders ?? []
    all.push(...orders)

    const cursor = page?.next
    if (orders.length < ORDERS_PAGE_LIMIT || cursor == null || cursor === 0) break
    next = cursor
  }

  return all
}

/** Ограничение спецификации (`maxItems: 1000`) на тело /api/v3/orders/status. */
const STATUS_BATCH_SIZE = 1000

/**
 * Статусы сборочных заданий, `POST /api/v3/orders/status`.
 *
 * Не более 1000 идентификаторов в одном запросе — режем на пачки и склеиваем
 * результат. Пустой список идентификаторов не делает запроса вовсе: пустой
 * запрос — это `4XX`, а по спецификации такой ответ стоит десяти запросов
 * квоты в 300/мин.
 */
export async function fetchFbsOrderStatuses(
  token: string,
  ids: number[],
): Promise<WbFbsOrderStatus[]> {
  if (ids.length === 0) return []

  const all: WbFbsOrderStatus[] = []

  for (let i = 0; i < ids.length; i += STATUS_BATCH_SIZE) {
    const batch = ids.slice(i, i + STATUS_BATCH_SIZE)
    const page = await requestJson<{ orders: WbFbsOrderStatus[] } | null>(
      "wb",
      `${MARKETPLACE}/api/v3/orders/status`,
      { token, method: "POST", body: { orders: batch } },
    )
    all.push(...(page?.orders ?? []))
  }

  return all
}

/** Склад продавца, одна строка ответа `GET /api/v3/warehouses`. */
export interface WbFbsWarehouse {
  id: number
  name: string
  officeId: number | null
}

/**
 * Склады продавца, `GET /api/v3/warehouses`. Без параметров, ответ — голый
 * массив (не обёрнут в объект `{ ... }`, в отличие от большинства методов
 * Маркетплейса выше).
 *
 * Проверено живым запросом 01.09.2026: у продавца сейчас один склад —
 * `1408913 «Мой склад Краснодар»`. Это не гарантия на будущее: складов
 * может стать больше, и вызывающая сторона (адаптер) обязана обойти ВСЕ,
 * а не взять первый молча — остаток по неверному складу это неверный пул,
 * а при глубине запаса в одну штуку именно он решает, будет ли двойная продажа.
 */
export async function fetchFbsWarehouses(token: string): Promise<WbFbsWarehouse[]> {
  const response = await requestJson<WbFbsWarehouse[] | null>(
    "wb",
    `${MARKETPLACE}/api/v3/warehouses`,
    { token },
  )
  return response ?? []
}

/**
 * Одна строка ответа `POST /api/v3/stocks/{warehouseId}`.
 *
 * ВНИМАНИЕ: спецификация здесь неполна и вводит в заблуждение. Она
 * описывает тело запроса как `{ chrtIds: [числа] }`, а ответ как
 * `{ stocks: [{ chrtId, amount }] }`. Живой запрос 01.09.2026 показал
 * другое — площадка принимает `skus` (строки-баркоды) и возвращает
 * И `sku`, И `chrtId`, И `amount` в каждой строке:
 *
 * ```
 * POST /api/v3/stocks/1408913   {"skus":["2041941855531","2042285696378"]}
 * → {"stocks":[{"sku":"2041941855531","chrtId":440206878,"amount":2},
 *              {"sku":"2042285696378","chrtId":461327525,"amount":2}]}
 * ```
 *
 * Код здесь и в `fetchFbsStocks` пишется по этому живому образцу, а не по
 * спецификации — тест на тело запроса (`skus`, не `chrtIds`) стоит именно
 * затем, чтобы будущее «исправление» по документации не тихо сломало то,
 * что реально работает.
 */
export interface WbFbsStock {
  sku: string | null
  chrtId: number | null
  amount: number | null
}

/** Ограничение спецификации (`maxItems: 1000`) на тело /api/v3/stocks/{warehouseId}. */
const STOCKS_BATCH_SIZE = 1000

/**
 * Остатки по баркодам на ОДНОМ складе, `POST /api/v3/stocks/{warehouseId}`.
 * Тело — `{ skus: [...] }` (см. комментарий к `WbFbsStock` про расхождение
 * со спецификацией).
 *
 * Не более 1000 баркодов за запрос — режем на пачки и склеиваем результат,
 * как в `fetchFbsOrderStatuses`.
 *
 * Пустой список баркодов не делает запроса вовсе: у методов «Маркетплейса»
 * запрос с кодом ответа `4XX` (а пустое тело — именно такой) по спецификации
 * учитывается как 10 запросов квоты.
 */
export async function fetchFbsStocks(
  token: string,
  warehouseId: number,
  skus: string[],
): Promise<WbFbsStock[]> {
  if (skus.length === 0) return []

  const all: WbFbsStock[] = []

  for (let i = 0; i < skus.length; i += STOCKS_BATCH_SIZE) {
    const batch = skus.slice(i, i + STOCKS_BATCH_SIZE)
    const page = await requestJson<{ stocks: WbFbsStock[] } | null>(
      "wb",
      `${MARKETPLACE}/api/v3/stocks/${warehouseId}`,
      { token, method: "POST", body: { skus: batch } },
    )
    all.push(...(page?.stocks ?? []))
  }

  return all
}

/**
 * Одна карточка перечня, `POST .../content/v2/get/cards/list`. Только поля,
 * нужные каталогу WB (штрихкод, артикул, название, предмет) — фото
 * и `subjectID` (нужен был только для сопоставления с тарифами) убраны.
 */
export interface WbCardListItem {
  nmID: number | null
  vendorCode?: string | null
  /** Наименование товара. В ответе именно `title`, проверено фикстурой. */
  title?: string | null
  /** Предмет (категория) — `subjectName`, проверено фикстурой. */
  subjectName?: string | null
  sizes?: Array<{ skus?: string[] | null }> | null
}

interface WbCardsListCursor {
  updatedAt?: string | null
  nmID?: number | null
  total: number
}

export interface WbCardsListResponse {
  cards: WbCardListItem[] | null
  cursor: WbCardsListCursor | null
}

/** Размер страницы перечня карточек — запрашиваем всегда его. */
const CARDS_LIST_PAGE_LIMIT = 100

interface CardsListCursorState {
  updatedAt: string
  nmID: number
}

/**
 * Одна страница перечня карточек,
 * `POST https://content-api.wildberries.ru/content/v2/get/cards/list`
 * (лимит категории «Контент» — 100 запросов в минуту; здесь отдельно не
 * регулируется, requestJson откатывается на 429 общим механизмом).
 *
 * `cursor` — из предыдущего ответа либо null для первой страницы.
 */
export async function fetchCardsPage(
  token: string,
  cursor: CardsListCursorState | null,
): Promise<WbCardsListResponse | null> {
  const body: {
    settings: {
      cursor: { limit: number; updatedAt?: string; nmID?: number }
      filter: { withPhoto: number }
    }
  } = {
    settings: {
      cursor: cursor
        ? { limit: CARDS_LIST_PAGE_LIMIT, updatedAt: cursor.updatedAt, nmID: cursor.nmID }
        : { limit: CARDS_LIST_PAGE_LIMIT },
      filter: { withPhoto: -1 },
    },
  }

  return requestJson<WbCardsListResponse | null>(
    "wb",
    `${CONTENT}/content/v2/get/cards/list`,
    { token, method: "POST", body },
  )
}

/**
 * Верхний предел числа страниц — последний рубеж, а не рабочий лимит.
 * Обычное завершение цикла — неполная страница или непродвинувшийся курсор;
 * потолок ловит только патологию: площадку, которая исправно продвигает
 * курсор и шлёт данные бесконечно. 1000 страниц по 100 карточек — сто тысяч
 * карточек, кабинета такого размера здесь не ожидается.
 */
const CARDS_LIST_MAX_PAGES = 1000

/**
 * Все карточки продавца, все страницы.
 *
 * Пагинация курсором по (`updatedAt`, `nmID`): `cursor.total`, РАВНЫЙ
 * запрошенному `limit`, означает «есть ещё» — следующий запрос повторяет то
 * же тело плюс `updatedAt`/`nmID` из ответа. `total` меньше `limit` —
 * последняя страница.
 *
 * Гварды, от внутреннего к внешнему:
 * 1. Неполная страница (`total !== limit`) либо курсор без `updatedAt`/`nmID`
 *    — обычное, ожидаемое завершение.
 * 2. Курсор не продвинулся: площадка прислала ту же пару (`updatedAt`,
 *    `nmID`), что была отправлена. При полной странице это означало бы
 *    вечное повторение одного и того же запроса — ловится до следующей
 *    итерации, а не потолком страниц.
 * 3. `CARDS_LIST_MAX_PAGES` — потолок на случай площадки, которая курсор
 *    честно продвигает, но перечень не заканчивает никогда.
 */
export async function fetchAllCards(token: string): Promise<WbCardListItem[]> {
  const all: WbCardListItem[] = []
  let cursor: CardsListCursorState | null = null

  for (let page = 0; page < CARDS_LIST_MAX_PAGES; page++) {
    const response: WbCardsListResponse | null = await fetchCardsPage(token, cursor)
    all.push(...(response?.cards ?? []))

    const total: number = response?.cursor?.total ?? 0
    const nextUpdatedAt: string | null | undefined = response?.cursor?.updatedAt
    const nextNmID: number | null | undefined = response?.cursor?.nmID

    // гвард 1: неполная страница или курсор без пары (updatedAt, nmID)
    if (total !== CARDS_LIST_PAGE_LIMIT || nextUpdatedAt == null || nextNmID == null) break

    // гвард 2: курсор не продвинулся — следующий запрос был бы тем же самым
    if (cursor && cursor.updatedAt === nextUpdatedAt && cursor.nmID === nextNmID) break

    cursor = { updatedAt: nextUpdatedAt, nmID: nextNmID }
  }

  return all
}
