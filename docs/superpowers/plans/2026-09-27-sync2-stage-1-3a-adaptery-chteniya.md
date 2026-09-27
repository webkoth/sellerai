# Синк v2 · этап 1.3a — адаптеры чтения WB, Ozon, ЯМ, KIT

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать `sync2` чтение заказов и остатков четырёх площадок (WB, Ozon, ЯМ, KIT) в едином виде, который ждёт домен пула: жизненный цикл заказа (`open | shipped | cancelled_before_ship | returned`), снимок остатков с **нулевыми строками** по существующим карточкам и ключом — **штрихкодом WB**. Приёмка — живое чтение всех четырёх площадок командой `sync2 probe`, без единой записи.

**Architecture:** Адаптеры WB, Ozon и ЯМ **переносятся из finstock** (`finstock/packages/platforms/src`) вместе с живыми образцами ответов и тестами — они проверены на этих же кабинетах. Из них убирается всё финансовое; признак `cancelled: boolean` заменяется жизненным циклом, который считает чистая функция площадки по сырому статусу. Адаптер KIT пишется по образцу `sync/src/kit.ts` (старый синк, заплатка 27.09). Сопоставление со штрихкодом WB — отдельная чистая функция `resolveWbBarcode` поверх каталога WB. Сеть — только в `packages/platforms`; запись на площадки в этом плане отсутствует.

**Tech Stack:** как в 1.1–1.2. Тесты адаптеров — `vi.stubGlobal("fetch", …)` и JSON-образцы из finstock (без msw/nock).

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md` §5. **Контракт адаптеров** — конец `docs/superpowers/plans/2026-09-26-sync2-stage-1-2-domen-pula.md`.
**Источник переноса:** `/Users/minas/projects/finstock/packages/platforms/src/{http,barcodes,types}.ts`, `wb/{adapter,fbs-client,fbs-mapper,cards-mapper}.ts`, `ozon/{adapter,client,mapper}.ts`, `ym/{adapter,client,mapper}.ts`, их `*.test.ts` и `fixtures/{wb,ozon,ym}/*`. finstock только читать.

**Этап 1.3 целиком:** 1.3a адаптеры (этот план) → 1.3b джобы `ingest`/`pool`, журнал записей в базе, выкладка на VPS, `dry-run` параллельно со старым `sync/` и отчёт расхождений → 1.3c служебный API сайта (отдельный репозиторий `kotelnikovartifact`). Переключение — 1.4.

---

## Правила жизненного цикла (прочитать до кода)

| Площадка | `cancelled_before_ship` | `returned` | `shipped` | `open` |
|---|---|---|---|---|
| WB (FBS) | `isCancelledStatus(status)` из finstock | — (возвраты WB приходят сигналом снимка; в пул заказы WB не идут) | `supplierStatus = "complete"` | остальное |
| Ozon | `status = "cancelled"` и `cancellation.cancelled_after_ship` ≠ true | `status = "cancelled"` и `cancelled_after_ship = true` | `delivering`, `driver_pickup`, `delivered`, `sent_by_seller`, `arbitration`, `client_arbitration` | остальное |
| ЯМ | `CANCELLED`, подстатус **не** из списка «после отправки» | `RETURNED`, `PARTIALLY_RETURNED`; `CANCELLED` с подстатусом из списка «после отправки» | `DELIVERY`, `PICKUP`, `DELIVERED` | остальное |
| KIT | `CANCELLED`, `DELIVERY_CANCELLED` | `FULL_REFUND`, `PARTIAL_REFUND` | `WAIT_FOR_DELIVERY`, `DELIVERED`, `COMPLETED` | остальное |

Подстатусы ЯМ «после отправки» (товар уже уехал и едет назад — единица возвращается владельцем через WB после осмотра):
`USER_REFUSED_PRODUCT`, `USER_REFUSED_QUALITY`, `PICKUP_EXPIRED`, `DELIVERY_SERVICE_UNDELIVERED`, `COURIER_RETURNS_ORDER`, `COURIER_RETURNED_ORDER`, `COURIER_NOT_DELIVER_ORDER`, `FULL_NOT_RANSOM`, `WRONG_ITEM_DELIVERED`, `DAMAGED_BOX`, `USER_HAS_NO_TIME_TO_PICKUP_ORDER`, `DELIVERY_SERVICE_LOST`, `SORTING_CENTER_LOST`, `DROPOFF_LOST`, `LOST`, `BROKEN_ITEM`, `WRONG_ITEM`, `MISSING_ITEM`.

Правило выбора: при сомнении — `returned`, а не `cancelled_before_ship`. Ошибка в эту сторону даёт недосчёт одной единицы (владелец вернёт её через WB), в обратную — продажу несуществующей.

## Контракт снимка остатков (из 1.2, обязателен)

1. Строки по **всем** существующим карточкам площадки, включая нулевые.
2. `barcode` — штрихкод WB. Площадочный штрихкод, которого нет в каталоге WB, сопоставляется через артикул (offer_id = артикул WB); не сопоставилось — строка не попадает в снимок и считается в `skippedNoWbBarcode`.
3. `quantity ≥ 0` (Ozon `present − reserved` бывает минус).
4. Склады суммируются в домене — адаптер отдаёт строку на склад; для ЯМ берутся только склады магазина из конфига.

---

## Карта файлов

```
sync2/
  packages/shared/src/
    orders.ts                 + ChannelOrder
    catalog.ts                WbCatalogEntry, WbCatalogIndex, buildWbCatalogIndex, resolveWbBarcode (+test)
    money.ts                  rubToMinor, decimalStringToMinor (+test) — перенос из finstock domain
    index.ts
  packages/platforms/src/
    http.ts (+test)           перенос requestJson + таймаут
    errors.ts                 PlatformApiError, RateLimitError
    barcodes.ts (+test)       перенос firstBarcode
    adapter.ts                ChannelAdapter, StockFetch
    wb/  client.ts mapper.ts adapter.ts lifecycle.ts (+tests) fixtures/
    ozon/ client.ts mapper.ts adapter.ts lifecycle.ts (+tests) fixtures/
    ym/  client.ts mapper.ts adapter.ts lifecycle.ts (+tests) fixtures/
    kit/ client.ts mapper.ts adapter.ts lifecycle.ts (+tests) fixtures/
    index.ts
  apps/worker/src/
    channels-config.ts        чтение ключей и складов из окружения
    cli.ts                    + команда probe
```

## Правила переноса из finstock (для задач 3–5)

- Копировать файл целиком, затем: `@finstock/shared` → `@sync2/shared`; `@finstock/domain` → локальные функции из `@sync2/shared` (`rubToMinor`, `decimalStringToMinor`); `Platform` → `Channel`.
- Удалять целиком: `fetchRealization*`, `fetchTariffs*`, `fetchCatalog` у всех, кроме WB, и их импорты (`finance-*`, `tariff-*`, `async-report`, `zip`, `line-id`, `tochka`). Если после удаления тип/импорт не используется — удалить и его.
- Тесты переносятся вместе с файлом; тесты удалённых функций удаляются вместе с ними. Остальные тесты **не ослаблять** — меняется только ожидание `cancelled: …` на `lifecycle: …` по таблице выше.
- JSON-образцы копируются в `packages/platforms/src/<площадка>/fixtures/` и импортируются как `import x from "./fixtures/…json" with { type: "json" }`.
- Прочие ссылки на finstock в комментариях заменить на «перенесено из finstock (27.09.2026)».

---

### Task 1: Общие типы — заказ площадки, деньги, каталог WB

**Files:**
- Modify: `sync2/packages/shared/src/orders.ts`
- Create: `sync2/packages/shared/src/money.ts`, `money.test.ts`
- Create: `sync2/packages/shared/src/catalog.ts`, `catalog.test.ts`
- Modify: `sync2/packages/shared/src/index.ts`

- [ ] **Step 1: Заказ площадки** — дописать в конец `sync2/packages/shared/src/orders.ts`:
```ts
/** Строка заказа площадки в едином виде: одна позиция заказа — одна строка. */
export interface ChannelOrder {
  /** Уникален в пределах площадки: номер заказа и позиция, как их отдаёт адаптер. */
  externalId: string
  /** Штрихкод WB; null — площадка не дала штрихкод и артикул не сопоставился. */
  barcode: string | null
  externalSku: string | null
  quantity: number
  priceMinor: number
  lifecycle: OrderLifecycle
  /** Время события на площадке, ISO 8601. */
  occurredAt: string
  /** Сырой ответ площадки — для разбора споров. */
  raw: unknown
}
```

- [ ] **Step 2: Деньги — падающий тест** `sync2/packages/shared/src/money.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { decimalStringToMinor, rubToMinor } from "./money"

describe("деньги в копейках", () => {
  it("рубли числом → копейки", () => {
    expect(rubToMinor(12.34)).toBe(1234)
    expect(rubToMinor(0)).toBe(0)
  })
  it("не число — ошибка", () => {
    expect(() => rubToMinor(Number.NaN)).toThrow()
  })
  it("десятичная строка → копейки с усечением третьего знака", () => {
    expect(decimalStringToMinor("12.345")).toBe(1234)
    expect(decimalStringToMinor("-7.5")).toBe(-750)
    expect(decimalStringToMinor("")).toBe(0)
  })
  it("мусор в строке — ошибка", () => {
    expect(() => decimalStringToMinor("12,5")).toThrow()
  })
})
```
Run: `cd sync2 && npx vitest run packages/shared/src/money.test.ts` → FAIL (нет модуля).

- [ ] **Step 3: Деньги — реализация.** Скопировать из `/Users/minas/projects/finstock/packages/domain/src/money.ts` функции `rubToMinor` и `decimalStringToMinor` вместе с их комментариями в `sync2/packages/shared/src/money.ts` (остальное из файла не брать). Run → 4 passed.

- [ ] **Step 4: Каталог WB — падающий тест** `sync2/packages/shared/src/catalog.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex, resolveWbBarcode } from "./catalog"

const index = buildWbCatalogIndex([
  { barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: 259678801, title: "Браслет", subject: "Браслеты" },
  { barcode: "2044473196868", vendorCode: "8797686554332", nmId: 1, title: "Подвеска", subject: "Подвески бижутерные" },
])

describe("resolveWbBarcode", () => {
  it("штрихкод площадки есть в каталоге WB — он и есть ключ", () => {
    expect(resolveWbBarcode(index, { barcodes: ["2041383032873"], sku: "что-угодно" })).toBe("2041383032873")
  })
  it("из нескольких штрихкодов площадки берётся тот, что есть у WB", () => {
    expect(resolveWbBarcode(index, { barcodes: ["460000000001", "2044473196868"], sku: null })).toBe("2044473196868")
  })
  it("штрихкода WB нет — сопоставление по артикулу (offer_id = артикул WB)", () => {
    expect(resolveWbBarcode(index, { barcodes: ["460000000001"], sku: "JW-NB-AGT-M-0002" })).toBe("2041383032873")
  })
  it("артикул равен штрихкоду WB — тоже годится", () => {
    expect(resolveWbBarcode(index, { barcodes: [], sku: "2044473196868" })).toBe("2044473196868")
  })
  it("ничего не сопоставилось — null, а не чужой штрихкод", () => {
    expect(resolveWbBarcode(index, { barcodes: ["460000000001"], sku: "НЕТ" })).toBeNull()
  })
})
```
Run → FAIL.

- [ ] **Step 5: Каталог WB — реализация** `sync2/packages/shared/src/catalog.ts`:
```ts
/** Карточка WB — мастер-каталог: штрихкод WB — ключ товара во всём синке. */
export interface WbCatalogEntry {
  barcode: string
  vendorCode: string
  nmId: number | null
  title: string
  subject: string | null
}

export interface WbCatalogIndex {
  barcodes: ReadonlySet<string>
  byVendorCode: ReadonlyMap<string, string>
}

export function buildWbCatalogIndex(entries: WbCatalogEntry[]): WbCatalogIndex {
  const byVendorCode = new Map<string, string>()
  for (const e of entries) if (e.vendorCode && !byVendorCode.has(e.vendorCode)) byVendorCode.set(e.vendorCode, e.barcode)
  return { barcodes: new Set(entries.map((e) => e.barcode)), byVendorCode }
}

/**
 * Штрихкод WB для товара другой площадки. Порядок: штрихкод площадки, который есть у WB;
 * артикул площадки как артикул WB (offer_id Ozon/ЯМ = артикул WB); артикул как штрихкод WB.
 * Не сопоставилось — null: подставить чужой штрихкод значит сделать товар «сиротой» и обнулить его.
 */
export function resolveWbBarcode(index: WbCatalogIndex, item: { barcodes: readonly string[]; sku: string | null }): string | null {
  for (const b of item.barcodes) if (b && index.barcodes.has(b)) return b
  if (item.sku) {
    const byVc = index.byVendorCode.get(item.sku)
    if (byVc) return byVc
    if (index.barcodes.has(item.sku)) return item.sku
  }
  return null
}
```
`sync2/packages/shared/src/index.ts` — добавить `export * from "./money"` и `export * from "./catalog"`.
Run → 5 passed; `npm run typecheck` чист.

- [ ] **Step 6: Commit**
```bash
git add sync2/packages/shared/src
git commit -m "sync2: заказ площадки, деньги в копейках, сопоставление со штрихкодом WB"
```

---

### Task 2: Сетевой слой — перенос `requestJson` с таймаутом

**Files:**
- Create: `sync2/packages/platforms/src/http.ts`, `http.test.ts`, `errors.ts`, `barcodes.ts`, `barcodes.test.ts`, `adapter.ts`
- Modify: `sync2/packages/platforms/src/index.ts`

- [ ] **Step 1: Перенос.** Скопировать `finstock/packages/platforms/src/http.ts`, `http.test.ts`, `barcodes.ts`, `barcodes.test.ts`. Классы `PlatformApiError` и `RateLimitError` перенести из `finstock/.../types.ts:47-88` в `sync2/packages/platforms/src/errors.ts`; тип источника — `export type ApiSource = Channel` (без `tochka`). Убрать из `http.ts` всё, что связано с `dispatcher`/`undici` (оно было только для банка Точка), и соответствующие тесты.

- [ ] **Step 2: Таймаут — падающий тест.** Дописать в `http.test.ts`:
```ts
it("зависший ответ обрывается по таймауту и повторяется как сетевой сбой", async () => {
  const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
  )
  vi.stubGlobal("fetch", fetchMock)
  await expect(
    requestJson("kit", "https://api.kit.yandex.net/v1/orders", { token: "t", timeoutMs: 20, retryDelaysMs: [0] }),
  ).rejects.toMatchObject({ status: 0 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
```
Run → FAIL (нет `timeoutMs`).

- [ ] **Step 3: Таймаут — реализация.** В `RequestOptions` добавить `timeoutMs?: number` (по умолчанию `60_000`); каждый вызов `fetch` получает `signal: AbortSignal.timeout(timeoutMs)`; `AbortError`/`TimeoutError` обрабатывается как сетевой сбой (status 0, повтор по `retryDelaysMs`). Комментарий: «без таймаута зависший ответ площадки держал бы прогон и блокировку до следующего крона».

- [ ] **Step 4: Интерфейс адаптера** `sync2/packages/platforms/src/adapter.ts`:
```ts
import type { Channel, ChannelOrder, NormalizedStock } from "@sync2/shared"

export interface StockFetch {
  stocks: NormalizedStock[]
  /** Товары площадки, для которых не нашёлся штрихкод WB, — в снимок не попадают. */
  skippedNoWbBarcode: string[]
}

/** Чтение площадки. Запись — только через executeWrites, не здесь. */
export interface ChannelAdapter {
  readonly channel: Channel
  /** Заказы, созданные не раньше `since` (ISO 8601), — окно, а не курсор. */
  fetchOrders(since: string): Promise<ChannelOrder[]>
  fetchStocks(): Promise<StockFetch>
}
```
`sync2/packages/platforms/src/index.ts`:
```ts
export * from "./writer"
export * from "./errors"
export * from "./http"
export * from "./adapter"
```

- [ ] **Step 5: Проверки и коммит.** `npx vitest run packages/platforms` — все зелёные (перенесённые тесты http и barcodes + тест таймаута + прежние writer); `npm run typecheck` чист.
```bash
git add sync2/packages/platforms/src
git commit -m "sync2: сетевой слой из finstock с таймаутом, интерфейс адаптера"
```

---

### Task 3: WB — каталог, заказы, остатки с нулями

**Files:** `sync2/packages/platforms/src/wb/{client,mapper,cards-mapper,adapter,lifecycle}.ts` + тесты + `fixtures/` (перенос `fbs-client.ts` → `client.ts`, `fbs-mapper.ts` → `mapper.ts`).

- [ ] **Step 1: Перенос** по «Правилам переноса». Адаптер `createWbAdapter(token)` возвращает `ChannelAdapter & { fetchCatalog(): Promise<WbCatalogEntry[]> }`: каталог строится из `fetchAllCards` (штрихкод из `sizes[].skus`, `vendorCode`, `nmID`, `title`, `subjectName`).

- [ ] **Step 2: Жизненный цикл — падающий тест** `wb/lifecycle.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { wbLifecycle } from "./lifecycle"

describe("wbLifecycle", () => {
  it("нет статуса — open", () => expect(wbLifecycle(undefined)).toBe("open"))
  it("отмена продавцом или покупателем — cancelled_before_ship", () => {
    expect(wbLifecycle({ id: 1, supplierStatus: "cancel", wbStatus: "waiting" })).toBe("cancelled_before_ship")
    expect(wbLifecycle({ id: 1, supplierStatus: "confirm", wbStatus: "canceled_by_client" })).toBe("cancelled_before_ship")
  })
  it("передан в доставку — shipped", () => expect(wbLifecycle({ id: 1, supplierStatus: "complete", wbStatus: "sorted" })).toBe("shipped"))
  it("на сборке — open", () => expect(wbLifecycle({ id: 1, supplierStatus: "confirm", wbStatus: "waiting" })).toBe("open"))
})
```
Реализация `wb/lifecycle.ts`: `import type { WbFbsOrderStatus } from "./client"`; `isCancelledStatus(s)` → `cancelled_before_ship`; `s.supplierStatus === "complete"` → `shipped`; иначе `open`. (Поля статуса — как в `WbFbsOrderStatus` finstock; если имена отличаются, взять оттуда.)

- [ ] **Step 3: Маппер заказов.** `mapFbsOrders` сохраняет статус в `raw` вместе с заказом (`raw: { order, status }`) и ставит `lifecycle: wbLifecycle(status)` вместо `cancelled`. Перенесённые тесты: ожидание `cancelled: true/false` → `lifecycle: "cancelled_before_ship"/"open"` (или `"shipped"`, если в образце `supplierStatus = complete`).

- [ ] **Step 4: Остатки с нулями — падающий тест** в `wb/mapper.test.ts`:
```ts
it("штрихкод из каталога без строки в ответе остатков — нулевая строка", () => {
  const r = mapFbsStocks(
    [{ sku: "2041383032873", amount: 2 }],
    [
      { barcode: "2041383032873", vendorCode: "JW-0002" },
      { barcode: "2044473196868", vendorCode: "JW-0100" },
    ],
  )
  expect(r.stocks.find((s) => s.barcode === "2044473196868")).toMatchObject({ quantity: 0, externalSku: "JW-0100" })
  expect(r.stocks.find((s) => s.barcode === "2041383032873")?.quantity).toBe(2)
})
```
Сигнатуру `mapFbsStocks` привести к `(stocks: WbFbsStock[], cards: Array<{ barcode: string; vendorCode: string }>)` — вторым аргументом каталог; каждому штрихкоду каталога без строки остатка — `quantity: 0` (WB опускает нули в ответе, а домен читает отсутствие строки как «карточки нет»). `quantity` приводится к `Math.max(0, …)`. Комментарий об этом — у функции.

- [ ] **Step 5: Тест адаптера** (из finstock `wb/adapter.test.ts`, приведённый к `ChannelAdapter`): `fetchOrders(since)` зовёт `/api/v3/orders/new`, `/api/v3/orders` (без `dateTo`) и `/api/v3/orders/status`; `fetchStocks()` — склады, каталог, остатки по складам. Проверить: `skippedNoWbBarcode` пуст (у WB штрихкод свой).

- [ ] **Step 6:** `npx vitest run packages/platforms/src/wb`, `npm run typecheck` → зелёные.
```bash
git add sync2/packages/platforms/src/wb
git commit -m "sync2: адаптер WB — каталог, заказы с жизненным циклом, остатки с нулевыми строками"
```

---

### Task 4: Ozon — заказы с отменой до и после отправки, остатки по штрихкоду WB

**Files:** `sync2/packages/platforms/src/ozon/{client,mapper,adapter,lifecycle}.ts` + тесты + `fixtures/`.

- [ ] **Step 1: Перенос** по правилам. `createOzonAdapter(credentials, wbIndex: WbCatalogIndex)`: индекс каталога WB передаётся извне (его строит WB-адаптер в том же прогоне).

- [ ] **Step 2: Жизненный цикл — падающий тест** `ozon/lifecycle.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { ozonLifecycle } from "./lifecycle"

const p = (status: string, cancelled_after_ship?: boolean) =>
  ({ status, cancellation: cancelled_after_ship === undefined ? undefined : { cancelled_after_ship } }) as never

describe("ozonLifecycle", () => {
  it("отмена до отгрузки — cancelled_before_ship", () => expect(ozonLifecycle(p("cancelled", false))).toBe("cancelled_before_ship"))
  it("отмена без данных об отгрузке — до отгрузки", () => expect(ozonLifecycle(p("cancelled"))).toBe("cancelled_before_ship"))
  it("отмена после отгрузки — returned: товар едет назад", () => expect(ozonLifecycle(p("cancelled", true))).toBe("returned"))
  it("в доставке и доставлен — shipped", () => {
    for (const s of ["delivering", "driver_pickup", "delivered", "sent_by_seller", "arbitration", "client_arbitration"]) {
      expect(ozonLifecycle(p(s))).toBe("shipped")
    }
  })
  it("ждёт сборки — open", () => expect(ozonLifecycle(p("awaiting_packaging"))).toBe("open"))
})
```
Реализация `ozon/lifecycle.ts` по таблице «Правила жизненного цикла»; тип аргумента — `Pick<OzonPosting, "status" | "cancellation">` из `./client`.

- [ ] **Step 3: Маппер заказов:** `lifecycle: ozonLifecycle(posting)` вместо `cancelled`; `barcode: resolveWbBarcode(wbIndex, { barcodes: ozonBarcodes.get(offer_id) ?? [], sku: offer_id })`.

- [ ] **Step 4: Остатки — падающие тесты** в `ozon/mapper.test.ts`:
```ts
it("остаток не ниже нуля: present − reserved бывает минус", () => {
  const r = mapOzonStocks(
    [{ offer_id: "JW-NB-AGT-M-0002", stocks: [{ type: "fbs", present: 0, reserved: 1 }] }] as never,
    new Map([["JW-NB-AGT-M-0002", ["460000000001"]]]),
    buildWbCatalogIndex([{ barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: null, title: "", subject: null }]),
  )
  expect(r.stocks).toEqual([expect.objectContaining({ barcode: "2041383032873", quantity: 0 })])
})
it("не сопоставилось со штрихкодом WB — в снимок не попадает, offer_id в списке пропусков", () => {
  const r = mapOzonStocks(
    [{ offer_id: "НЕТ", stocks: [{ type: "fbs", present: 1, reserved: 0 }] }] as never,
    new Map([["НЕТ", ["460000000001"]]]),
    buildWbCatalogIndex([]),
  )
  expect(r).toEqual({ stocks: [], skippedNoWbBarcode: ["НЕТ"] })
})
```
Сигнатура `mapOzonStocks(items, barcodes, wbIndex): StockFetch`; ключ — `resolveWbBarcode`; `quantity = Math.max(0, Σ(present − reserved) по fbs)`; товар без fbs-записи — строка с 0 (как в finstock).

- [ ] **Step 5:** перенесённые тесты адаптера/клиента/маппера — зелёные с новыми ожиданиями; `npm run typecheck`.
```bash
git add sync2/packages/platforms/src/ozon
git commit -m "sync2: адаптер Ozon — отмена до и после отгрузки, остатки по штрихкоду WB"
```

---

### Task 5: ЯМ — подстатусы «после отправки», только склады магазина

**Files:** `sync2/packages/platforms/src/ym/{client,mapper,adapter,lifecycle}.ts` + тесты + `fixtures/`.

- [ ] **Step 1: Перенос** по правилам. `createYmAdapter(credentials, wbIndex, warehouseIds: number[])`: `payoutFrequency` и всё про взаимозачёт/тарифы удаляется.

- [ ] **Step 2: Жизненный цикл — падающий тест** `ym/lifecycle.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { YM_AFTER_SHIP_SUBSTATUSES, ymLifecycle } from "./lifecycle"

describe("ymLifecycle", () => {
  it("отмена до отправки — cancelled_before_ship", () => {
    expect(ymLifecycle({ status: "CANCELLED", substatus: "USER_CHANGED_MIND" })).toBe("cancelled_before_ship")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "PROCESSING_EXPIRED" })).toBe("cancelled_before_ship")
  })
  it("отмена после отправки — returned: товар едет назад", () => {
    expect(ymLifecycle({ status: "CANCELLED", substatus: "USER_REFUSED_PRODUCT" })).toBe("returned")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "PICKUP_EXPIRED" })).toBe("returned")
  })
  it("возврат — returned", () => {
    expect(ymLifecycle({ status: "RETURNED" })).toBe("returned")
    expect(ymLifecycle({ status: "PARTIALLY_RETURNED" })).toBe("returned")
  })
  it("в доставке — shipped; в обработке — open", () => {
    expect(ymLifecycle({ status: "DELIVERY" })).toBe("shipped")
    expect(ymLifecycle({ status: "DELIVERED" })).toBe("shipped")
    expect(ymLifecycle({ status: "PROCESSING", substatus: "STARTED" })).toBe("open")
  })
  it("список «после отправки» — 18 подстатусов из плана", () => {
    expect(YM_AFTER_SHIP_SUBSTATUSES.size).toBe(18)
  })
})
```
Реализация `ym/lifecycle.ts`: экспорт `YM_AFTER_SHIP_SUBSTATUSES = new Set([...])` со списком из раздела «Правила жизненного цикла» и `ymLifecycle({ status, substatus? })` по таблице; комментарий «при сомнении — returned».

- [ ] **Step 3: Маппер заказов:** `lifecycle: ymLifecycle(order)`; `barcode` через `resolveWbBarcode` (штрихкоды из offer-mappings, sku = offerId); заказы `fake` по-прежнему отбрасываются.

- [ ] **Step 4: Остатки — падающий тест** в `ym/mapper.test.ts`:
```ts
it("склад не из конфига магазина — не попадает в снимок", () => {
  const r = mapYmStocks(
    [
      { warehouseId: 2369574, offers: [{ offerId: "JW-NB-AGT-M-0002", stocks: [{ type: "AVAILABLE", count: 1 }] }] },
      { warehouseId: 1872191, offers: [{ offerId: "JW-NB-AGT-M-0002", stocks: [{ type: "AVAILABLE", count: 5 }] }] },
    ] as never,
    new Map([["JW-NB-AGT-M-0002", []]]),
    buildWbCatalogIndex([{ barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: null, title: "", subject: null }]),
    [2369574],
  )
  expect(r.stocks).toEqual([expect.objectContaining({ barcode: "2041383032873", quantity: 1, warehouse: "2369574" })])
})
```
Сигнатура `mapYmStocks(warehouses, barcodes, wbIndex, warehouseIds)`; ключ через `resolveWbBarcode`; `quantity ≥ 0`.

- [ ] **Step 5:** все тесты ЯМ зелёные; `npm run typecheck`.
```bash
git add sync2/packages/platforms/src/ym
git commit -m "sync2: адаптер ЯМ — возвраты по подстатусу отмены, только склад магазина"
```

---

### Task 6: KIT — варианты, заказы по частям доставки, склад продаж

Образец поведения — `sync/src/kit.ts` (старый синк, проверен на живом магазине 27.09).

**Files:**
- Create: `sync2/packages/platforms/src/kit/{client,mapper,adapter,lifecycle}.ts` + тесты + `fixtures/variants-sample.json`, `fixtures/orders-sample.json`

- [ ] **Step 1: Образцы ответов (только чтение).** Снять и обезличить (убрать `client`, телефоны, адреса):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
TOKEN=$(grep '^YAKIT_API_TOKEN=' .env | cut -d= -f2- | tr -d '"')
curl -s -H "Authorization: Bearer $TOKEN" 'https://api.kit.yandex.net/v1/variants?per_page=3&page=1' > /tmp/kit-variants.json
sleep 2
curl -s -H "Authorization: Bearer $TOKEN" 'https://api.kit.yandex.net/v1/orders?per_page=100&page=1' > /tmp/kit-orders.json
```
Сохранить в `kit/fixtures/` с удалёнными персональными полями (`jq 'del(.orders[].client)'`). В заказах KIT на 27.09 — два отменённых тестовых.

- [ ] **Step 2: Жизненный цикл — падающий тест** `kit/lifecycle.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { kitLifecycle } from "./lifecycle"

describe("kitLifecycle", () => {
  it("отмена до передачи — cancelled_before_ship", () => {
    expect(kitLifecycle("CANCELLED")).toBe("cancelled_before_ship")
    expect(kitLifecycle("DELIVERY_CANCELLED")).toBe("cancelled_before_ship")
  })
  it("возврат денег после покупки — returned", () => {
    expect(kitLifecycle("FULL_REFUND")).toBe("returned")
    expect(kitLifecycle("PARTIAL_REFUND")).toBe("returned")
  })
  it("передан в доставку и дальше — shipped", () => {
    for (const s of ["WAIT_FOR_DELIVERY", "DELIVERED", "COMPLETED"]) expect(kitLifecycle(s)).toBe("shipped")
  })
  it("новый, ждёт оплаты, отменяется — open: единица держится до финала", () => {
    for (const s of ["NEW", "PENDING_PAYMENT", "CANCELLATION_IN_PROGRESS"]) expect(kitLifecycle(s)).toBe("open")
  })
})
```

- [ ] **Step 3: Реализация.**
  - `kit/client.ts`: `kitRequest` поверх `requestJson("kit", …)` с заголовком `Authorization: Bearer`; **не чаще 1 запроса в секунду** (последовательная очередь с паузой 1100 мс — при параллельных запросах KIT рвёт соединение); `fetchKitVariants()` — листать `/v1/variants?per_page=100&page=N` до неполной страницы; `fetchKitOrders()` — `/v1/orders?per_page=100&page=N` до неполной страницы.
  - `kit/lifecycle.ts` — по таблице.
  - `kit/mapper.ts`: `mapKitStocks(variants, warehouseId)` — строка на каждый вариант со штрихкодом: `quantity = max(0, Σ stocks[].quantity на складе warehouseId)`, `externalSku = variant.id`; `mapKitOrders(orders, variants, since)` — позиции из `delivery_chunks[].items[]`, штрихкод через `product_variant_id → variant.barcode`, `externalId = "<order.id>:<item.id>"`, заказы с `created_at < since` отбрасываются, позиция без штрихкода — `barcode: null`.
  - `kit/adapter.ts`: `createKitAdapter({ token, warehouseId })`; `fetchOrders` и `fetchStocks` читают варианты один раз на экземпляр адаптера (кэш на прогон).
- Тесты маппера на образцах: 2 отменённых заказа → 2 строки `cancelled_before_ship` со штрихкодом `2041383032873`; варианты → строки на склад `01980d4c-1b53-7aa1-ab23-1b7c23604704`.

- [ ] **Step 4:** тесты KIT зелёные; `npm run typecheck`.
```bash
git add sync2/packages/platforms/src/kit
git commit -m "sync2: адаптер KIT — варианты, заказы по частям доставки, склад продаж"
```

---

### Task 7: Конфиг площадок и живая приёмка `sync2 probe`

**Files:**
- Create: `sync2/apps/worker/src/channels-config.ts`, `channels-config.test.ts`
- Modify: `sync2/apps/worker/src/cli.ts`, `sync2/.env.example`, `sync2/README.md`

- [ ] **Step 1: Конфиг — падающий тест** `channels-config.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { loadChannelsConfig } from "./channels-config"

const env = {
  WB_API_TOKEN: "wb",
  OZON_CLIENT_ID: "5332036",
  OZON_API_TOKEN: "oz",
  YM_API_TOKEN: "ym",
  YM_BUSINESS_ID: "191766894",
  YM_CAMPAIGN_ID: "149197829",
  YM_WAREHOUSE_IDS: "2369574",
  YAKIT_API_TOKEN: "kit",
  KIT_WAREHOUSE_ID: "01980d4c-1b53-7aa1-ab23-1b7c23604704",
}

describe("loadChannelsConfig", () => {
  it("собирает ключи и склады четырёх площадок", () => {
    expect(loadChannelsConfig(env)).toEqual({
      wb: { token: "wb" },
      ozon: { clientId: "5332036", apiKey: "oz" },
      ym: { apiKey: "ym", businessId: 191766894, campaignId: 149197829, warehouseIds: [2369574] },
      kit: { token: "kit", warehouseId: "01980d4c-1b53-7aa1-ab23-1b7c23604704" },
    })
  })
  it("не хватает ключа — ошибка с именем переменной", () => {
    expect(() => loadChannelsConfig({ ...env, YAKIT_API_TOKEN: "" })).toThrow(/YAKIT_API_TOKEN/)
  })
})
```
Реализация: чистая функция от `env`, числа через `Number`, списки через запятую, пустое — ошибка «<ИМЯ> не задан».

- [ ] **Step 2: `.env.example`** — дописать переменные из теста с комментарием «те же ключи, что у старого синка (`/opt/sellerai-sync/.env`); YM_WAREHOUSE_IDS — склад магазина ИП 2369574; KIT_WAREHOUSE_ID — склад продаж «Склад Краснодар»».

- [ ] **Step 3: Команда `probe`** в `cli.ts` — только чтение, без базы:
```
sync2 probe   прочитать четыре площадки: заказы за 60 дней и остатки, напечатать сводку
```
Порядок: WB `fetchCatalog` → индекс → WB/Ozon/ЯМ/KIT `fetchOrders(now − 60 дней)` и `fetchStocks()` **последовательно** (не параллельно: общие лимиты с работающим старым синком). По каждой площадке печатается строка: `канал | заказов | по жизненному циклу {open,shipped,cancelled_before_ship,returned} | строк остатков | штук | в наличии (>0) | пропусков без штрихкода WB`. Сбой площадки — строка `канал | ОШИБКА <errorText>` и код выхода 1, остальные площадки всё равно читаются.

- [ ] **Step 4: Живая приёмка — на VPS** (с Mac прямого доступа к API площадок РФ может не быть; старый синк живёт на VPS по той же причине). Postgres для `probe` не нужен. ssh/scp на `root@147.45.171.40` разрешены владельцем.
```bash
cd /Users/minas/projects/sai_kotelnikovartifact   # или корень worktree
ssh root@147.45.171.40 'mkdir -p /opt/sync2-probe'
tar --exclude node_modules --exclude .env -czf /tmp/sync2-probe.tgz -C sync2 .
scp /tmp/sync2-probe.tgz root@147.45.171.40:/opt/sync2-probe/
ssh root@147.45.171.40 'cd /opt/sync2-probe && tar xzf sync2-probe.tgz && find . -name "._*" -delete && npm ci --silent && \
  set -a && . /opt/sellerai-sync/.env && set +a && \
  YM_WAREHOUSE_IDS=2369574 KIT_WAREHOUSE_ID=01980d4c-1b53-7aa1-ab23-1b7c23604704 npx tsx apps/worker/src/cli.ts probe'
```
Не запускать в минуты крона старого синка (`:03 :08 … :58` заказы, `:00 :30` сверка): лимиты площадок общие на аккаунт. `/opt/sync2-probe` — временная папка, в 1.3b её заменит выкладка.
Expected (сверить с последним прогоном старого синка на VPS: `tail -40 /opt/sellerai-sync/logs/cron-stocks.log`):
- WB: строк остатков = число штрихкодов каталога (сотни), в наличии ≈ 80 (как «WB-товаров 80» у старого синка);
- Ozon: около 81 строки, пропусков без штрихкода WB — единицы (перечислить их в отчёте);
- ЯМ: строки только склада 2369574;
- KIT: 393 строки, в наличии около 70; 2 заказа `cancelled_before_ship`.
Расхождение с ожиданием — не править тесты, а разобраться и описать в отчёте.

- [ ] **Step 5: README** — раздел «Адаптеры чтения (этап 1.3a)»: интерфейс `ChannelAdapter`, таблица жизненного цикла, контракт снимка, команда `probe`.

- [ ] **Step 6:** `npm run typecheck`, `npm test`, `npm run test:db` → зелёные.
```bash
git add sync2/apps/worker sync2/.env.example sync2/README.md
git commit -m "sync2: конфиг площадок и живая проверка чтения — probe"
```

---

## Готово, когда

- Все тесты зелёные; перенесённые тесты finstock не ослаблены (изменены только ожидания жизненного цикла).
- `sync2 probe` читает четыре площадки вживую, цифры сходятся со старым синком, отчёт с пропусками приложен.
- В `packages/platforms` нет ни одного пишущего запроса (grep по `PUT|PATCH|DELETE|bulk_update|import/prices|offers/stocks.*PUT` — пусто, кроме `writer.ts`).

## Следующий план

1.3b: джоба `ingest` (каталог WB → `products`, заказы → `upsertOrders`, снимки → `insertStockSnapshot`, по площадке с отдельной ошибкой), джоба `pool` (режим WB `external`, `planStockWrites` → `executeWrites` в `dry-run` → журнал `writes` в базе, пустой массив не вставлять), advisory lock в Postgres, `redact` в pino, выкладка на VPS (Postgres, `npm ci`, миграции, крон со сдвигом от старого синка), джоба `compare-v1` (пул sync2 против леджера `/opt/sellerai-sync/data/state/inventory.json`, сводка в Telegram раз в сутки), приёмка — 3 суток без необъяснённых расхождений.
