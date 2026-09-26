# Синк v2 · этап 1.2 — домен пула и его хранилище

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести в `sync2` логику пула остатков из finstock (заказ на любой площадке списывается со всех, отмена до отправки возвращается, WB — мастер), дописать то, чего в finstock нет (жизненный цикл заказа, запись WB самим синком, план записей на площадки), и положить состояние пула в базу — так, чтобы полный цикл «снимок WB → заказы → пул → план записей» проходил на живой базе без единого обращения к площадкам.

**Architecture:** Новый пакет `packages/domain` — только чистые функции с тестами рядом (ни базы, ни сети, из `@sync2/shared` — только `import type`). Ядро `reconcilePool` переносится из `finstock/packages/domain/src/pool.ts` копированием с переименованием `cabinetId → channelId`, его 21 тест — тоже. Вокруг ядра — три новые чистые функции: `toPoolOrders` (строки заказов → заказы пула), `applyWbWriteOutcomes` (ожидание WB по итогам нашей записи), `planStockWrites` (что и куда писать, с порогом-предохранителем). Хранилище — в `packages/db`: снимки, заказы, состояние пула; время из базы нормализуется в ISO, множества учтённых заказов строятся конструктором запросов (не сырым SQL). Миграция 0001 закрывает замечания проверки 1.1.

**Tech Stack:** как в 1.1 — TypeScript 5 strict, Vitest 4 (проекты `unit`/`db`), Drizzle 0.45 + postgres.js, PostgreSQL 18 локально.

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md`, раздел 5.
**Источник переноса:** `/Users/minas/projects/finstock/packages/domain/src/pool.ts`, `pool.test.ts`, `warehouse.ts` (`aggregateStockByBarcode`), `/Users/minas/projects/finstock/packages/shared/src/realization.ts` (`NormalizedStock`).
**Заметки из 1.1:** конец `docs/superpowers/plans/2026-09-26-sync2-stage-1-1-karkas.md`.

**Вне плана:** адаптеры площадок, джобы и крон (1.3–1.4), VPS, запись на площадки.

---

## Ключевые правила домена (прочитать до кода)

1. **WB — мастер.** Заказы WB в пул не вычитаются: они уже видны как уменьшение остатка в снимке WB («сигнал WB»). Вычесть их ещё раз — двойной учёт.
2. **Холодный старт.** Баркода нет в пуле, но он есть в снимке WB → база = снимок; открытые заказы зеркал считаются учтёнными **без** вычитания (их уже снял со WB старый синк).
3. **Отмена возвращает единицу только до отправки.** `cancelled_before_ship` → +1 один раз. `returned` (возврат после доставки) не возвращает ничего: товар едет назад, владелец добавит его на WB после осмотра — это придёт сигналом WB.
4. **Кто пишет WB — два режима.**
   - `external` — пока WB пишет старый `sync/` (этапы 1.3 и сверка 1.4). Семантика finstock без изменений: ожидание WB = база, сигнал WB принимается только из снимка, снятого через `WB_SETTLE_MINUTES = 20` после последнего изменения ожидания.
   - `self` — когда WB пишет sync2 (после переключения в 1.4). Ожидание WB = то, что реально стоит на WB после нашей записи: запись применилась → база; не применилась или не отправлялась → фактический остаток из снимка. Задержка приёма сигнала — `WB_SETTLE_MINUTES_SELF = 2`. Без этого неудачная запись WB выглядела бы в следующем снимке как пополнение, и мы продали бы несуществующую единицу.
5. **Предохранитель.** Больше `MAX_STOCK_CHANGES_PER_RUN = 120` изменений остатков за прогон — не писать ничего (спека §5; порог из `sync-config.json` старого синка).
6. **Сироты.** Баркод есть на площадке с остатком > 0, но его нет в пуле (WB его не знает) → цель 0: иначе площадка продаёт то, чего нет на складе.

---

## Карта файлов

```
sync2/
  vitest.config.ts                          + псевдоним @sync2/domain
  packages/shared/src/
    stocks.ts                               NormalizedStock — форма как в finstock
    orders.ts                               ORDER_LIFECYCLES, OrderLifecycle
    index.ts                                + экспорт
  packages/domain/                          НОВЫЙ пакет
    package.json, tsconfig.json
    src/stock.ts (+test)                    aggregateStockByBarcode
    src/pool.ts (+test)                     reconcilePool — перенос из finstock
    src/orders.ts (+test)                   toPoolOrders
    src/wb-expectation.ts (+test)           applyWbWriteOutcomes, WB_SETTLE_MINUTES_SELF
    src/stock-plan.ts (+test)               planStockWrites, MAX_STOCK_CHANGES_PER_RUN
    src/index.ts
  packages/db/
    package.json                            + зависимость @sync2/domain
    src/schema.ts                           ORDER_LIFECYCLES из shared; FK run_id; check base ≥ 0
    migrations/0001_*.sql                   генерирует drizzle-kit
    src/test-db.ts                          + insertRun
    src/schema.db.test.ts                   + недостающие проверки ограничений
    src/time.ts (+test)                     toIso, toIsoOrNull
    src/stock-snapshots.ts (+db test)       insertStockSnapshot, latestStockSnapshots
    src/orders.ts (+db test)                upsertOrders, loadOrdersSince
    src/pool-store.ts (+db test)            loadPoolState, savePoolRun
    src/pool-cycle.db.test.ts               сквозной цикл на живой базе — приёмка плана
    src/index.ts                            + экспорт
```

Правило пакетов: `domain` импортирует из `@sync2/shared` только типы (`import type`); `db` может импортировать `domain` (как в finstock); `domain` не импортирует ни `db`, ни `platforms`.

---

### Task 1: Пакет `domain` и тип снимка остатков

**Files:**
- Create: `sync2/packages/shared/src/stocks.ts`
- Modify: `sync2/packages/shared/src/index.ts`
- Create: `sync2/packages/domain/package.json`, `sync2/packages/domain/tsconfig.json`, `sync2/packages/domain/src/index.ts`
- Modify: `sync2/vitest.config.ts`

- [ ] **Step 1: Тип снимка — тот же, что в finstock**

`sync2/packages/shared/src/stocks.ts`:
```ts
/**
 * Строка снимка остатков площадки, уже нормализованная адаптером.
 * Форма совпадает с NormalizedStock в finstock (packages/shared/src/realization.ts):
 * при переносе sync2 в finstock тип не меняется.
 */
export interface NormalizedStock {
  barcode: string
  /** Артикул продавца на площадке (offer_id, vendorCode), если площадка его отдаёт. */
  externalSku: string | null
  quantity: number
  /** Склад площадки; несколько строк одного баркода на разных складах суммируются в домене. */
  warehouse: string | null
  /** Исходная строка ответа площадки — для разбора споров, домен её не читает. */
  raw?: unknown
}
```

`sync2/packages/shared/src/index.ts` — добавить строку:
```ts
export * from "./stocks"
```

- [ ] **Step 2: Пакет**

`sync2/packages/domain/package.json`:
```json
{
  "name": "@sync2/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@sync2/shared": "*" }
}
```

`sync2/packages/domain/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`sync2/packages/domain/src/index.ts`:
```ts
export {}
```

- [ ] **Step 3: Псевдоним в Vitest**

В `sync2/vitest.config.ts` в объект `alias` добавить строку (рядом с остальными):
```ts
  "@sync2/domain": pkg("domain"),
```

- [ ] **Step 4: Установить и проверить**

Run (из `sync2/`):
```bash
npm install
ls -la node_modules/@sync2/domain
npm run typecheck
npm test
```
Expected: симлинк `node_modules/@sync2/domain → ../../packages/domain`; typecheck чист; unit 40 passed (без изменений).

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/shared/src sync2/packages/domain sync2/vitest.config.ts sync2/package-lock.json
git commit -m "sync2: пакет domain и тип снимка остатков как в finstock"
```

---

### Task 2: Агрегация снимка по баркоду

**Files:**
- Create: `sync2/packages/domain/src/stock.ts`
- Test: `sync2/packages/domain/src/stock.test.ts`
- Modify: `sync2/packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/domain/src/stock.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import { aggregateStockByBarcode } from "./stock"

const row = (barcode: string, quantity: number, patch: Partial<NormalizedStock> = {}): NormalizedStock => ({
  barcode,
  externalSku: null,
  quantity,
  warehouse: null,
  ...patch,
})

describe("aggregateStockByBarcode", () => {
  it("складывает строки одного баркода с разных складов", () => {
    const m = aggregateStockByBarcode([row("A", 1, { warehouse: "Краснодар" }), row("A", 2, { warehouse: "Москва" })])
    expect(m.get("A")?.quantity).toBe(3)
  })

  it("артикул — из первой строки, где он есть", () => {
    const m = aggregateStockByBarcode([row("A", 1), row("A", 1, { externalSku: "JW-0001" }), row("A", 1, { externalSku: "JW-XXXX" })])
    expect(m.get("A")?.vendorCode).toBe("JW-0001")
  })

  it("ноль и минус не отбрасываются — это решает вызывающий код", () => {
    const m = aggregateStockByBarcode([row("A", 0), row("B", -1)])
    expect(m.get("A")?.quantity).toBe(0)
    expect(m.get("B")?.quantity).toBe(-1)
  })

  it("пустой снимок — пустой результат", () => {
    expect(aggregateStockByBarcode([]).size).toBe(0)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run packages/domain/src/stock.test.ts`
Expected: FAIL — `Cannot find module './stock'`.

- [ ] **Step 3: Реализация — перенос из finstock/packages/domain/src/warehouse.ts**

`sync2/packages/domain/src/stock.ts`:
```ts
import type { NormalizedStock } from "@sync2/shared"

/** Остаток по баркоду после агрегации нескольких строк снимка. */
export interface AggregatedStock {
  vendorCode: string | null
  quantity: number
}

/**
 * Складывает строки снимка остатков в остаток по баркоду: несколько строк
 * одного баркода на разных складах площадки — обычное дело. Артикул берётся
 * из первой строки, где он не null. Ноль и минус не отфильтровываются —
 * «лежит на складе» решает вызывающий код. Перенесено из finstock
 * (packages/domain/src/warehouse.ts) без изменений поведения.
 */
export function aggregateStockByBarcode(stocks: NormalizedStock[]): Map<string, AggregatedStock> {
  const byBarcode = new Map<string, AggregatedStock>()
  for (const stock of stocks) {
    const existing = byBarcode.get(stock.barcode)
    if (existing) {
      existing.quantity += stock.quantity
      if (existing.vendorCode === null) existing.vendorCode = stock.externalSku
    } else {
      byBarcode.set(stock.barcode, { vendorCode: stock.externalSku, quantity: stock.quantity })
    }
  }
  return byBarcode
}
```

`sync2/packages/domain/src/index.ts`:
```ts
export * from "./stock"
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run packages/domain`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/domain/src
git commit -m "sync2: агрегация снимка остатков по баркоду"
```

---

### Task 3: Перенос `reconcilePool` из finstock

Ядро переносится копированием, а не пересказом: у него 21 тест, и они — главная гарантия, что перенос не изменил поведение.

**Files:**
- Create: `sync2/packages/domain/src/pool.ts` (копия `finstock/packages/domain/src/pool.ts`)
- Test: `sync2/packages/domain/src/pool.test.ts` (копия `finstock/packages/domain/src/pool.test.ts`)
- Modify: `sync2/packages/domain/src/index.ts`

- [ ] **Step 1: Скопировать тест и адаптировать**

Run (из корня репо):
```bash
cp /Users/minas/projects/finstock/packages/domain/src/pool.test.ts sync2/packages/domain/src/pool.test.ts
sed -i '' -e 's/cabinetId/channelId/g' -e 's#@finstock/shared#@sync2/shared#g' sync2/packages/domain/src/pool.test.ts
grep -n "cabinet\|finstock" sync2/packages/domain/src/pool.test.ts
```
Expected: `grep` ничего не находит.

- [ ] **Step 2: Запустить — падает**

Run: `cd sync2 && npx vitest run packages/domain/src/pool.test.ts`
Expected: FAIL — `Cannot find module './pool'`.

- [ ] **Step 3: Скопировать ядро и адаптировать**

Run (из корня репо):
```bash
cp /Users/minas/projects/finstock/packages/domain/src/pool.ts sync2/packages/domain/src/pool.ts
sed -i '' \
  -e 's/cabinetId/channelId/g' \
  -e 's#@finstock/shared#@sync2/shared#g' \
  -e 's#from "./warehouse"#from "./stock"#g' \
  -e 's/Кабинет заказа/Площадка заказа (channels.id)/g' \
  sync2/packages/domain/src/pool.ts
grep -n "cabinet\|Кабинет\|finstock\|warehouse" sync2/packages/domain/src/pool.ts
```
Expected: `grep` ничего не находит — ни `cabinet`, ни `Кабинет`, ни `@finstock`, ни `./warehouse`.

Затем в начало файла, сразу после импортов, добавить комментарий о происхождении:
```ts
// Перенесено из finstock/packages/domain/src/pool.ts (26.09.2026) с заменой cabinetId → channelId.
// Поведение не менять без правки тестов pool.test.ts — это перенос, а не переписывание.
```

`sync2/packages/domain/src/index.ts`:
```ts
export * from "./stock"
export * from "./pool"
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run packages/domain`
Expected: 25 passed (4 + 21). Если хоть один из 21 падает — это ошибка переноса (sed задел лишнее), а не повод править тест: сравнить `diff <(sed 's/cabinetId/channelId/g' /Users/minas/projects/finstock/packages/domain/src/pool.ts) sync2/packages/domain/src/pool.ts`.

Run: `npm run typecheck`
Expected: чисто.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/domain/src
git commit -m "sync2: пул остатков перенесён из finstock вместе с тестами"
```

---

### Task 4: Жизненный цикл заказа → заказы пула

**Files:**
- Create: `sync2/packages/shared/src/orders.ts`
- Modify: `sync2/packages/shared/src/index.ts`
- Modify: `sync2/packages/db/src/schema.ts` (ORDER_LIFECYCLES — из shared)
- Create: `sync2/packages/domain/src/orders.ts`
- Test: `sync2/packages/domain/src/orders.test.ts`
- Modify: `sync2/packages/domain/src/index.ts`

- [ ] **Step 1: Список статусов — в shared, единый источник для схемы и домена**

`sync2/packages/shared/src/orders.ts`:
```ts
/**
 * Жизненный цикл строки заказа в синке — общий для всех площадок; адаптер
 * переводит статусы площадки в эти четыре.
 * open — принят, не отправлен; shipped — отправлен; cancelled_before_ship —
 * отменён до отправки (товар не уезжал); returned — возврат после доставки.
 */
export const ORDER_LIFECYCLES = ["open", "shipped", "cancelled_before_ship", "returned"] as const
export type OrderLifecycle = (typeof ORDER_LIFECYCLES)[number]
```

`sync2/packages/shared/src/index.ts` — добавить:
```ts
export * from "./orders"
```

В `sync2/packages/db/src/schema.ts`:
- удалить строку `export const ORDER_LIFECYCLES = ["open", "shipped", "cancelled_before_ship", "returned"] as const`;
- в импорт из `@sync2/shared` добавить `ORDER_LIFECYCLES`: `import { CHANNELS, ORDER_LIFECYCLES, WRITE_MODES } from "@sync2/shared"`;
- после импортов добавить реэкспорт, чтобы прежние импорты из `@sync2/db` не сломались: `export { ORDER_LIFECYCLES }`.

Run: `npm run db:generate`
Expected: `No schema changes, nothing to migrate` — список тот же, SQL не меняется.

- [ ] **Step 2: Падающий тест**

`sync2/packages/domain/src/orders.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { toPoolOrders, type OrderRowForPool } from "./orders"

const WB = 1
const OZON = 2
const KIT = 4

const row = (patch: Partial<OrderRowForPool>): OrderRowForPool => ({
  id: 10,
  channelId: OZON,
  barcode: "A",
  quantity: 1,
  lifecycle: "open",
  occurredAt: "2026-09-26T10:00:00.000Z",
  ...patch,
})

describe("toPoolOrders", () => {
  it("открытый и отправленный заказ зеркала — списание, не отмена", () => {
    const { orders } = toPoolOrders([row({ id: 1 }), row({ id: 2, lifecycle: "shipped", channelId: KIT })], WB)
    expect(orders).toEqual([
      { orderId: 1, channelId: OZON, barcode: "A", quantity: 1, cancelled: false, occurredAt: "2026-09-26T10:00:00.000Z" },
      { orderId: 2, channelId: KIT, barcode: "A", quantity: 1, cancelled: false, occurredAt: "2026-09-26T10:00:00.000Z" },
    ])
  })

  it("отмена до отправки — cancelled: единица вернётся в пул", () => {
    const { orders } = toPoolOrders([row({ lifecycle: "cancelled_before_ship" })], WB)
    expect(orders[0]?.cancelled).toBe(true)
  })

  it("возврат после доставки — НЕ отмена: товар в пути, вернёт его владелец через WB", () => {
    const { orders } = toPoolOrders([row({ lifecycle: "returned" })], WB)
    expect(orders[0]?.cancelled).toBe(false)
  })

  it("заказы WB в пул не идут — они уже в снимке WB", () => {
    const { orders, skipped } = toPoolOrders([row({ channelId: WB })], WB)
    expect(orders).toEqual([])
    expect(skipped.master).toBe(1)
  })

  it("строка без баркода пропускается и считается", () => {
    const { orders, skipped } = toPoolOrders([row({ barcode: null })], WB)
    expect(orders).toEqual([])
    expect(skipped.noBarcode).toBe(1)
  })
})
```

- [ ] **Step 3: Запустить — падает**

Run: `npx vitest run packages/domain/src/orders.test.ts`
Expected: FAIL — `Cannot find module './orders'`.

- [ ] **Step 4: Реализация**

`sync2/packages/domain/src/orders.ts`:
```ts
import type { OrderLifecycle } from "@sync2/shared"
import type { PoolOrder } from "./pool"

/** Строка заказа из хранилища — то, что нужно пулу. Время — ISO 8601. */
export interface OrderRowForPool {
  /** orders_raw.id */
  id: number
  channelId: number
  barcode: string | null
  quantity: number
  lifecycle: OrderLifecycle
  occurredAt: string
}

export interface ToPoolOrdersResult {
  orders: PoolOrder[]
  skipped: {
    /** Заказы площадки-мастера: они уже видны в её снимке, вычесть их ещё раз — двойной учёт. */
    master: number
    /** Строки без баркода: пулу не к чему их привязать. */
    noBarcode: number
  }
}

/**
 * Строки заказов → заказы пула. Отменой для пула считается только отмена до
 * отправки: возврат после доставки единицу не возвращает — товар едет назад,
 * и владелец добавит его на WB после осмотра (решение 25.09.2026, п. 6).
 */
export function toPoolOrders(rows: OrderRowForPool[], masterChannelId: number): ToPoolOrdersResult {
  const orders: PoolOrder[] = []
  const skipped = { master: 0, noBarcode: 0 }
  for (const r of rows) {
    if (r.channelId === masterChannelId) {
      skipped.master += 1
      continue
    }
    if (r.barcode === null) {
      skipped.noBarcode += 1
      continue
    }
    orders.push({
      orderId: r.id,
      channelId: r.channelId,
      barcode: r.barcode,
      quantity: r.quantity,
      cancelled: r.lifecycle === "cancelled_before_ship",
      occurredAt: r.occurredAt,
    })
  }
  return { orders, skipped }
}
```

`sync2/packages/domain/src/index.ts` — добавить `export * from "./orders"`.

- [ ] **Step 5: Запустить — проходит**

Run: `npx vitest run packages/domain && npm run typecheck && npm run test:db`
Expected: domain 30 passed (25 + 5); typecheck чист; db 11 passed (схема не менялась).

- [ ] **Step 6: Commit**

```bash
git add sync2/packages/shared/src sync2/packages/domain/src sync2/packages/db/src/schema.ts
git commit -m "sync2: заказы пула из жизненного цикла, возврат не возвращает единицу"
```

---

### Task 5: Ожидание WB, когда WB пишет сам синк

**Files:**
- Create: `sync2/packages/domain/src/wb-expectation.ts`
- Test: `sync2/packages/domain/src/wb-expectation.test.ts`
- Modify: `sync2/packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/domain/src/wb-expectation.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { PoolItemState } from "./pool"
import { WB_SETTLE_MINUTES } from "./pool"
import { WB_SETTLE_MINUTES_SELF, applyWbWriteOutcomes } from "./wb-expectation"

const item = (barcode: string, base: number): PoolItemState => ({
  barcode,
  base,
  wbExpected: base,
  expectedAt: "2026-09-26T10:00:00.000Z",
  wbSnapshotAt: "2026-09-26T09:55:00.000Z",
})

describe("applyWbWriteOutcomes", () => {
  it("запись на WB применилась — ожидание равно базе", () => {
    const [a] = applyWbWriteOutcomes([item("A", 1)], new Map([["A", 2]]), new Set(["A"]))
    expect(a?.wbExpected).toBe(1)
  })

  it("запись не применилась — ожидание равно тому, что реально стоит на WB", () => {
    // Иначе следующий снимок WB (всё ещё 2) прочитается как пополнение на +1.
    const [a] = applyWbWriteOutcomes([item("A", 1)], new Map([["A", 2]]), new Set())
    expect(a?.wbExpected).toBe(2)
  })

  it("баркода нет в снимке WB — на WB ноль", () => {
    const [a] = applyWbWriteOutcomes([item("A", 1)], new Map(), new Set())
    expect(a?.wbExpected).toBe(0)
  })

  it("база и прочие поля не меняются, вход не мутируется", () => {
    const input = [item("A", 1)]
    const [a] = applyWbWriteOutcomes(input, new Map([["A", 2]]), new Set())
    expect(a).toMatchObject({ barcode: "A", base: 1, expectedAt: "2026-09-26T10:00:00.000Z", wbSnapshotAt: "2026-09-26T09:55:00.000Z" })
    expect(input[0]?.wbExpected).toBe(1)
  })

  it("задержка приёма сигнала в режиме self короче, чем при чужой записи", () => {
    expect(WB_SETTLE_MINUTES_SELF).toBeLessThan(WB_SETTLE_MINUTES)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run packages/domain/src/wb-expectation.test.ts`
Expected: FAIL — `Cannot find module './wb-expectation'`.

- [ ] **Step 3: Реализация**

`sync2/packages/domain/src/wb-expectation.ts`:
```ts
import type { PoolItemState } from "./pool"

/**
 * Задержка приёма сигнала WB, когда WB пишет сам синк: запись применяется в
 * том же прогоне, и следующий снимок уже её видит. 2 минуты — запас на
 * распространение остатка внутри WB. При чужой записи (старый sync/) действует
 * WB_SETTLE_MINUTES из pool.ts.
 */
export const WB_SETTLE_MINUTES_SELF = 2

/**
 * Режим «WB пишет sync2»: reconcilePool ставит ожидание WB равным базе, как
 * будто запись точно дойдёт. После записи ожидание поправляется по факту:
 * применилась → база; не применилась или не отправлялась → то, что стоит на
 * WB по снимку. Иначе неудачная запись в следующем снимке выглядела бы
 * пополнением, и синк продал бы единицу, которой нет.
 *
 * @param wbActual остаток WB по снимку, из которого считался пул (баркод → количество)
 * @param applied баркоды, запись остатка которых на WB применилась в этом прогоне
 */
export function applyWbWriteOutcomes(
  items: PoolItemState[],
  wbActual: ReadonlyMap<string, number>,
  applied: ReadonlySet<string>,
): PoolItemState[] {
  return items.map((item) => ({
    ...item,
    wbExpected: applied.has(item.barcode) ? item.base : (wbActual.get(item.barcode) ?? 0),
  }))
}
```

`sync2/packages/domain/src/index.ts` — добавить `export * from "./wb-expectation"`.

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run packages/domain`
Expected: 35 passed.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/domain/src
git commit -m "sync2: ожидание WB по итогам собственной записи"
```

---

### Task 6: План записей остатков на площадки

**Files:**
- Create: `sync2/packages/domain/src/stock-plan.ts`
- Test: `sync2/packages/domain/src/stock-plan.test.ts`
- Modify: `sync2/packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/domain/src/stock-plan.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import type { PoolItemState } from "./pool"
import { MAX_STOCK_CHANGES_PER_RUN, planStockWrites } from "./stock-plan"

const item = (barcode: string, base: number): PoolItemState => ({
  barcode,
  base,
  wbExpected: base,
  expectedAt: null,
  wbSnapshotAt: null,
})
const s = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse: null })

describe("planStockWrites", () => {
  it("совпадает с пулом — писать нечего", () => {
    const r = planStockWrites([item("A", 2)], [{ channel: "kit", stocks: [s("A", 2)] }], { maxChanges: 120 })
    expect(r).toEqual({ changes: [], aborted: null })
  })

  it("расходится — запись было → станет", () => {
    const r = planStockWrites([item("A", 1)], [{ channel: "kit", stocks: [s("A", 2)] }], { maxChanges: 120 })
    expect(r.changes).toEqual([{ channel: "kit", barcode: "A", before: 2, after: 1, orphan: false }])
  })

  it("товара на площадке нет — не пишем: карточки заводит другой этап", () => {
    const r = planStockWrites([item("A", 1)], [{ channel: "ozon", stocks: [] }], { maxChanges: 120 })
    expect(r.changes).toEqual([])
  })

  it("несколько складов площадки суммируются перед сравнением", () => {
    const r = planStockWrites(
      [item("A", 2)],
      [{ channel: "ozon", stocks: [s("A", 1), { ...s("A", 1), warehouse: "другой" }] }],
      { maxChanges: 120 },
    )
    expect(r.changes).toEqual([])
  })

  it("сирота: на площадке есть, в пуле нет — обнулить", () => {
    const r = planStockWrites([], [{ channel: "ym", stocks: [s("Z", 1)] }], { maxChanges: 120 })
    expect(r.changes).toEqual([{ channel: "ym", barcode: "Z", before: 1, after: 0, orphan: true }])
  })

  it("сирота с нулём — писать нечего", () => {
    const r = planStockWrites([], [{ channel: "ym", stocks: [s("Z", 0)] }], { maxChanges: 120 })
    expect(r.changes).toEqual([])
  })

  it("отрицательная база пишется нулём", () => {
    const r = planStockWrites([item("A", -1)], [{ channel: "kit", stocks: [s("A", 1)] }], { maxChanges: 120 })
    expect(r.changes[0]?.after).toBe(0)
  })

  it("изменений больше порога — не писать ничего", () => {
    const items = [item("A", 0), item("B", 0), item("C", 0)]
    const r = planStockWrites(items, [{ channel: "kit", stocks: [s("A", 1), s("B", 1), s("C", 1)] }], { maxChanges: 2 })
    expect(r.changes).toEqual([])
    expect(r.aborted).toEqual({ count: 3, max: 2 })
  })

  it("порог по умолчанию — 120, как в старом синке", () => {
    expect(MAX_STOCK_CHANGES_PER_RUN).toBe(120)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run packages/domain/src/stock-plan.test.ts`
Expected: FAIL — `Cannot find module './stock-plan'`.

- [ ] **Step 3: Реализация**

`sync2/packages/domain/src/stock-plan.ts`:
```ts
import type { Channel, NormalizedStock } from "@sync2/shared"
import type { PoolItemState } from "./pool"
import { aggregateStockByBarcode } from "./stock"

/** Предохранитель: столько изменений остатков за прогон — уже не норма, а сбой чтения (порог старого синка). */
export const MAX_STOCK_CHANGES_PER_RUN = 120

export interface ChannelStockSnapshot {
  channel: Channel
  stocks: NormalizedStock[]
}

export interface StockChange {
  channel: Channel
  barcode: string
  before: number
  after: number
  /** На площадке есть, в пуле нет: обнуляем, иначе площадка продаёт то, чего нет на складе. */
  orphan: boolean
}

export interface StockPlan {
  changes: StockChange[]
  /** Не null — изменений больше порога, писать нельзя ничего. */
  aborted: { count: number; max: number } | null
}

/**
 * Что писать на каждую площадку, чтобы её остаток сошёлся с пулом.
 * Площадка, которую синк не пишет (WB при чужой записи), сюда просто не
 * передаётся. Товар, которого на площадке нет, не пишется — карточки
 * заводит этап карточек. Сравнение — после суммирования складов площадки.
 */
export function planStockWrites(
  items: PoolItemState[],
  snapshots: ChannelStockSnapshot[],
  opts: { maxChanges: number },
): StockPlan {
  const base = new Map(items.map((i) => [i.barcode, Math.max(0, i.base)]))
  const changes: StockChange[] = []
  for (const snap of snapshots) {
    for (const [barcode, { quantity }] of aggregateStockByBarcode(snap.stocks)) {
      const target = base.get(barcode)
      if (target === undefined) {
        if (quantity > 0) changes.push({ channel: snap.channel, barcode, before: quantity, after: 0, orphan: true })
        continue
      }
      if (quantity !== target) changes.push({ channel: snap.channel, barcode, before: quantity, after: target, orphan: false })
    }
  }
  if (changes.length > opts.maxChanges) return { changes: [], aborted: { count: changes.length, max: opts.maxChanges } }
  return { changes, aborted: null }
}
```

`sync2/packages/domain/src/index.ts` — добавить `export * from "./stock-plan"`.

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run packages/domain && npm run typecheck`
Expected: 44 passed (35 + 9); typecheck чист.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/domain/src
git commit -m "sync2: план записей остатков с предохранителем и обнулением сирот"
```

---

### Task 7: Миграция 0001 и недостающие проверки ограничений

Замечания финальной проверки 1.1: единое правило FK на журнал запусков (все таблицы с `run_id` ссылаются на `runs` — события пула и снимки пишутся только внутри `withRun`, который сначала заводит запуск), `base ≥ 0` в пуле, тесты на ограничения, которых не было.

**Files:**
- Modify: `sync2/packages/db/src/schema.ts`
- Create: `sync2/packages/db/migrations/0001_*.sql` (генерирует drizzle-kit)
- Modify: `sync2/packages/db/src/test-db.ts`
- Modify: `sync2/packages/db/src/schema.db.test.ts`

- [ ] **Step 1: Правки схемы**

В `sync2/packages/db/src/schema.ts`:

1. `stockSnapshotsRaw`: `runId: uuid("run_id").notNull().references(() => runs.runId),` и комментарий у `stocks` заменить на:
```ts
    /** NormalizedStock[] из @sync2/shared — форма как в finstock. */
```
2. `poolEvents`: `runId: uuid("run_id").notNull().references(() => runs.runId),`
3. `poolItems` — добавить третий аргумент с проверками (таблица сейчас без него):
```ts
export const poolItems = pgTable(
  "pool_items",
  {
    barcode: text("barcode").primaryKey(),
    base: integer("base").notNull(),
    wbExpected: integer("wb_expected").notNull(),
    expectedAt: ts("expected_at"),
    wbSnapshotAt: ts("wb_snapshot_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Домен не опускает базу ниже нуля; отрицательное значение в базе — ошибка кода, а не данные.
    check("pool_items_base_check", sql`${t.base} >= 0`),
    check("pool_items_wb_expected_check", sql`${t.wbExpected} >= 0`),
  ],
)
```
(JSDoc над `poolItems` оставить как есть.)

- [ ] **Step 2: Сгенерировать и применить миграцию 0001**

Run (из `sync2/`):
```bash
npm run db:generate
cat packages/db/migrations/0001_*.sql
npm run db:migrate
psql sync2 -c '\d pool_items' -c '\d stock_snapshots_raw'
```
Expected: `0001_*.sql` содержит `ADD CONSTRAINT "pool_events_run_id_runs_run_id_fk"`, `"stock_snapshots_raw_run_id_runs_run_id_fk"`, `"pool_items_base_check"`, `"pool_items_wb_expected_check"`; `0000` не изменён (`git diff --stat packages/db/migrations/0000_*.sql` пуст). Если drizzle-kit назвал FK иначе — взять имена из SQL и подставить в тесты шага 4.

- [ ] **Step 3: Помощник «завести запуск» для тестов**

В `sync2/packages/db/src/test-db.ts` добавить (импорт `runs` из `./schema`, тип `Db` из `./client`):
```ts
/** Запуск в журнале — всё с run_id ссылается на runs, как в жизни, где пишет только withRun. */
export async function insertRun(db: Db, runId: string): Promise<void> {
  await db.insert(runs).values({ runId, job: "test", status: "running", writeMode: "off", startedAt: "2026-09-26T09:00:00.000Z" })
}
```

- [ ] **Step 4: Тесты — починить существующие и добавить недостающие**

В `sync2/packages/db/src/schema.db.test.ts`:

1. Импорты: добавить `insertRun` из `./test-db`; `poolItems`, `stockSnapshotsRaw`, `writes`, `runs` из `./schema`.
2. В `beforeAll` после вставки товара добавить запуски, которые используют существующие тесты:
```ts
    for (const id of ["01", "02", "03", "04", "05"]) await insertRun(h.db, `00000000-0000-4000-8000-0000000000${id}`)
```
3. Добавить в конец `describe` тесты:
```ts
  const RUN = "00000000-0000-4000-8000-000000000004"

  it("один снимок WB даёт не больше одного сигнала на баркод", async () => {
    const sig = {
      barcode: "2041383032873",
      kind: "wb_signal",
      delta: -1,
      baseBefore: 2,
      baseAfter: 1,
      snapshotAt: "2026-09-26T10:00:00Z",
      occurredAt: "2026-09-26T10:01:00Z",
      runId: RUN,
    }
    await h.db.insert(poolEvents).values(sig)
    await expectConstraint(h.db.insert(poolEvents).values(sig), "pool_events_snapshot_kind_idx")
  })

  it("сигнал WB без момента снимка не проходит", async () => {
    await expectConstraint(
      h.db.insert(poolEvents).values({
        barcode: "2041383032873",
        kind: "wb_signal",
        delta: -1,
        baseBefore: 2,
        baseAfter: 1,
        occurredAt: "2026-09-26T10:01:00Z",
        runId: RUN,
      }),
      "pool_events_snapshot_ref_check",
    )
  })

  it("событие пула без запуска в журнале не проходит", async () => {
    await expectConstraint(
      h.db.insert(poolEvents).values({
        barcode: "2041383032873",
        kind: "manual",
        delta: 1,
        baseBefore: 0,
        baseAfter: 1,
        occurredAt: "2026-09-26T10:01:00Z",
        runId: "00000000-0000-4000-8000-0000000000ee",
      }),
      "pool_events_run_id_runs_run_id_fk",
    )
  })

  it("два снимка одной площадки с одним моментом не проходят", async () => {
    const snap = { channelId: kitId, takenAt: "2026-09-26T10:00:00Z", runId: RUN, stocks: [] }
    await h.db.insert(stockSnapshotsRaw).values(snap)
    await expectConstraint(h.db.insert(stockSnapshotsRaw).values(snap), "stock_snapshots_channel_taken_idx")
  })

  it("одно поле товара дважды в одном запуске записей не проходит", async () => {
    const w = { runId: RUN, channelId: kitId, barcode: "2041383032873", field: "stock", before: 2, after: 1, mode: "dry-run", applied: false }
    await h.db.insert(writes).values(w)
    await expectConstraint(h.db.insert(writes).values(w), "writes_run_channel_barcode_field_idx")
  })

  it("неизвестное поле записи не проходит", async () => {
    await expectConstraint(
      h.db.insert(writes).values({ runId: RUN, channelId: kitId, barcode: "X", field: "title", after: 1, mode: "off", applied: false }),
      "writes_field_check",
    )
  })

  it("отрицательная база пула не проходит", async () => {
    await expectConstraint(h.db.insert(poolItems).values({ barcode: "NEG", base: -1, wbExpected: 0 }), "pool_items_base_check")
  })
```
(Переменная `runs` из импорта может остаться неиспользованной — тогда её не импортировать.)

- [ ] **Step 5: Запустить**

Run: `npm run test:db && npm run typecheck && npm test`
Expected: db 18 passed (11 + 7); typecheck чист; unit 44 + прежние (без изменений числа из `apps`/`shared`/`platforms`).

- [ ] **Step 6: Commit**

```bash
git add sync2/packages/db
git commit -m "sync2: миграция 0001 — FK на журнал запусков, база пула не ниже нуля, проверки ограничений"
```

---

### Task 8: Время из базы — в ISO

Колонки `timestamptz` в режиме `string` приходят в текстовом формате Postgres (`2026-09-26 11:15:54.405+00`), а домен живёт в ISO 8601. Строки сравниваются только после нормализации.

**Files:**
- Create: `sync2/packages/db/src/time.ts`
- Test: `sync2/packages/db/src/time.test.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/db/src/time.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { toIso, toIsoOrNull } from "./time"

describe("toIso", () => {
  it("текст Postgres в UTC — ISO с Z", () => {
    expect(toIso("2026-09-26 11:15:54.405+00")).toBe("2026-09-26T11:15:54.405Z")
  })

  it("смещение переводится в UTC", () => {
    expect(toIso("2026-09-26 14:15:54.405+03")).toBe("2026-09-26T11:15:54.405Z")
  })

  it("уже ISO — без изменений", () => {
    expect(toIso("2026-09-26T11:15:54.405Z")).toBe("2026-09-26T11:15:54.405Z")
  })

  it("мусор — ошибка, а не Invalid Date дальше по коду", () => {
    expect(() => toIso("вчера")).toThrow(/время/)
  })

  it("null остаётся null", () => {
    expect(toIsoOrNull(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run packages/db/src/time.test.ts`
Expected: FAIL — `Cannot find module './time'`.

- [ ] **Step 3: Реализация**

`sync2/packages/db/src/time.ts`:
```ts
/**
 * timestamptz в режиме string приходит из Postgres текстом («2026-09-26 11:15:54.405+00»),
 * а домен сравнивает и хранит ISO 8601. Нормализуем на выходе из хранилища — один раз.
 * Точность — миллисекунды: микросекунды Postgres домену не нужны.
 */
export function toIso(value: string): string {
  const ms = Date.parse(value.includes("T") ? value : value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"))
  if (Number.isNaN(ms)) throw new RangeError(`не время: "${value}"`)
  return new Date(ms).toISOString()
}

export function toIsoOrNull(value: string | null): string | null {
  return value === null ? null : toIso(value)
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run packages/db/src/time.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/db/src/time.ts sync2/packages/db/src/time.test.ts
git commit -m "sync2: время из базы нормализуется в ISO"
```

---

### Task 9: Хранилище снимков остатков

**Files:**
- Create: `sync2/packages/db/src/stock-snapshots.ts`
- Test: `sync2/packages/db/src/stock-snapshots.db.test.ts`
- Modify: `sync2/packages/db/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/db/src/stock-snapshots.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { NormalizedStock } from "@sync2/shared"
import { seedChannels } from "./channels-seed"
import { channels } from "./schema"
import { insertStockSnapshot, latestStockSnapshots } from "./stock-snapshots"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

const RUN = "00000000-0000-4000-8000-0000000000c1"
const s = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse: null })

describe.skipIf(!TEST_DATABASE_URL)("снимки остатков", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Map<string, number>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, RUN)
    ids = new Map((await h.db.select().from(channels)).map((c) => [c.code, c.id]))
  })
  afterAll(async () => h?.close())

  it("последний снимок каждой площадки, время в ISO", async () => {
    const wb = ids.get("wb")!
    const kit = ids.get("kit")!
    await insertStockSnapshot(h.db, { channelId: wb, runId: RUN, takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 1)] })
    await insertStockSnapshot(h.db, { channelId: wb, runId: RUN, takenAt: "2026-09-26T10:30:00.000Z", stocks: [s("A", 2)] })
    await insertStockSnapshot(h.db, { channelId: kit, runId: RUN, takenAt: "2026-09-26T10:05:00.000Z", stocks: [] })

    const latest = await latestStockSnapshots(h.db)
    expect(latest.get(wb)).toEqual({ takenAt: "2026-09-26T10:30:00.000Z", stocks: [s("A", 2)] })
    expect(latest.get(kit)).toEqual({ takenAt: "2026-09-26T10:05:00.000Z", stocks: [] })
    expect(latest.has(ids.get("ozon")!)).toBe(false)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npm run test:db -- packages/db/src/stock-snapshots.db.test.ts`
Expected: FAIL — `Cannot find module './stock-snapshots'`.

- [ ] **Step 3: Реализация**

`sync2/packages/db/src/stock-snapshots.ts`:
```ts
import { desc } from "drizzle-orm"
import type { NormalizedStock } from "@sync2/shared"
import type { Db } from "./client"
import { stockSnapshotsRaw } from "./schema"
import { toIso } from "./time"

export interface StockSnapshotInput {
  channelId: number
  runId: string
  takenAt: string
  stocks: NormalizedStock[]
}

/** Снимок только дописывается; повтор с тем же моментом отсечёт уникальный индекс. */
export async function insertStockSnapshot(db: Db, snap: StockSnapshotInput): Promise<void> {
  await db.insert(stockSnapshotsRaw).values(snap)
}

/** Последний снимок каждой площадки: channelId → { takenAt (ISO), stocks }. */
export async function latestStockSnapshots(db: Db): Promise<Map<number, { takenAt: string; stocks: NormalizedStock[] }>> {
  const rows = await db
    .selectDistinctOn([stockSnapshotsRaw.channelId], {
      channelId: stockSnapshotsRaw.channelId,
      takenAt: stockSnapshotsRaw.takenAt,
      stocks: stockSnapshotsRaw.stocks,
    })
    .from(stockSnapshotsRaw)
    .orderBy(stockSnapshotsRaw.channelId, desc(stockSnapshotsRaw.takenAt))
  return new Map(rows.map((r) => [r.channelId, { takenAt: toIso(r.takenAt), stocks: r.stocks as NormalizedStock[] }]))
}
```

`sync2/packages/db/src/index.ts` — добавить:
```ts
export * from "./stock-snapshots"
export * from "./time"
```

- [ ] **Step 4: Запустить — проходит**

Run: `npm run test:db && npm run typecheck`
Expected: db 19 passed; typecheck чист.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/db/src
git commit -m "sync2: хранилище снимков остатков"
```

---

### Task 10: Хранилище заказов

**Files:**
- Modify: `sync2/packages/db/package.json` (зависимость `@sync2/domain`)
- Create: `sync2/packages/db/src/orders.ts`
- Test: `sync2/packages/db/src/orders.db.test.ts`
- Modify: `sync2/packages/db/src/index.ts`

- [ ] **Step 1: Зависимость db → domain (как в finstock)**

В `sync2/packages/db/package.json` в `dependencies` добавить `"@sync2/domain": "*"`, затем `npm install` из `sync2/`.

- [ ] **Step 2: Падающий тест**

`sync2/packages/db/src/orders.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { loadOrdersSince, upsertOrders, type OrderUpsert } from "./orders"
import { channels, ordersRaw } from "./schema"
import { TEST_DATABASE_URL, freshTestDb } from "./test-db"

const o = (externalId: string, patch: Partial<OrderUpsert> = {}): OrderUpsert => ({
  externalId,
  line: 0,
  barcode: "A",
  quantity: 1,
  lifecycle: "open",
  occurredAt: "2026-09-26T10:00:00.000Z",
  raw: { id: externalId },
  ...patch,
})

describe.skipIf(!TEST_DATABASE_URL)("хранилище заказов", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ozon: number
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ozon = (await h.db.select().from(channels).where(eq(channels.code, "ozon")))[0]!.id
  })
  afterAll(async () => h?.close())

  it("повторная запись заказа обновляет статус, а не дублирует строку", async () => {
    await upsertOrders(h.db, ozon, [o("OZ-1")])
    await upsertOrders(h.db, ozon, [o("OZ-1", { lifecycle: "cancelled_before_ship" })])
    const rows = await h.db.select().from(ordersRaw).where(eq(ordersRaw.externalId, "OZ-1"))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.lifecycle).toBe("cancelled_before_ship")
    expect(Date.parse(rows[0]!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(rows[0]!.firstSeenAt))
  })

  it("пустой список — без запроса и без ошибки", async () => {
    expect(await upsertOrders(h.db, ozon, [])).toBe(0)
  })

  it("чтение с даты: id числом, время в ISO", async () => {
    await upsertOrders(h.db, ozon, [o("OZ-OLD", { occurredAt: "2026-08-01T00:00:00.000Z" })])
    const rows = await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")
    expect(rows.map((r) => r.lifecycle)).toEqual(["cancelled_before_ship"])
    expect(typeof rows[0]!.id).toBe("number")
    expect(rows[0]).toMatchObject({ channelId: ozon, barcode: "A", quantity: 1, occurredAt: "2026-09-26T10:00:00.000Z" })
  })
})
```

- [ ] **Step 3: Запустить — падает**

Run: `npm run test:db -- packages/db/src/orders.db.test.ts`
Expected: FAIL — `Cannot find module './orders'`.

- [ ] **Step 4: Реализация**

`sync2/packages/db/src/orders.ts`:
```ts
import { gte, sql } from "drizzle-orm"
import type { OrderRowForPool } from "@sync2/domain"
import type { OrderLifecycle } from "@sync2/shared"
import type { Db } from "./client"
import { ordersRaw } from "./schema"
import { toIso } from "./time"

/** Строка заказа от адаптера площадки: статус уже переведён в жизненный цикл синка. */
export interface OrderUpsert {
  externalId: string
  line: number
  barcode: string | null
  quantity: number
  lifecycle: OrderLifecycle
  occurredAt: string
  raw: unknown
}

/**
 * Идемпотентная запись заказов площадки: новая строка вставляется, известная —
 * обновляет статус, баркод, количество и сырьё. updated_at ставится явно:
 * defaultNow() работает только на вставке.
 */
export async function upsertOrders(db: Db, channelId: number, rows: OrderUpsert[]): Promise<number> {
  if (rows.length === 0) return 0
  await db
    .insert(ordersRaw)
    .values(rows.map((r) => ({ ...r, channelId })))
    .onConflictDoUpdate({
      target: [ordersRaw.channelId, ordersRaw.externalId, ordersRaw.line],
      set: {
        lifecycle: sql`excluded.lifecycle`,
        barcode: sql`excluded.barcode`,
        quantity: sql`excluded.quantity`,
        raw: sql`excluded.raw`,
        updatedAt: sql`now()`,
      },
    })
  return rows.length
}

/** Заказы всех площадок с момента `since` (ISO) — вход для toPoolOrders. */
export async function loadOrdersSince(db: Db, since: string): Promise<OrderRowForPool[]> {
  const rows = await db
    .select({
      id: ordersRaw.id,
      channelId: ordersRaw.channelId,
      barcode: ordersRaw.barcode,
      quantity: ordersRaw.quantity,
      lifecycle: ordersRaw.lifecycle,
      occurredAt: ordersRaw.occurredAt,
    })
    .from(ordersRaw)
    .where(gte(ordersRaw.occurredAt, since))
    .orderBy(ordersRaw.id)
  return rows.map((r) => ({ ...r, lifecycle: r.lifecycle as OrderLifecycle, occurredAt: toIso(r.occurredAt) }))
}
```

`sync2/packages/db/src/index.ts` — добавить `export * from "./orders"`.

- [ ] **Step 5: Запустить — проходит**

Run: `npm run test:db && npm run typecheck`
Expected: db 22 passed; typecheck чист.

- [ ] **Step 6: Commit**

```bash
git add sync2/packages/db sync2/package-lock.json
git commit -m "sync2: хранилище заказов, повторная запись обновляет статус"
```

---

### Task 11: Хранилище состояния пула

**Files:**
- Create: `sync2/packages/db/src/pool-store.ts`
- Test: `sync2/packages/db/src/pool-store.db.test.ts`
- Modify: `sync2/packages/db/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/db/src/pool-store.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PoolEvent, PoolItemState } from "@sync2/domain"
import { seedChannels } from "./channels-seed"
import { upsertOrders } from "./orders"
import { loadPoolState, savePoolRun } from "./pool-store"
import { channels, ordersRaw, poolItems } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

const RUN1 = "00000000-0000-4000-8000-0000000000d1"
const RUN2 = "00000000-0000-4000-8000-0000000000d2"

const item: PoolItemState = {
  barcode: "A",
  base: 1,
  wbExpected: 1,
  expectedAt: "2026-09-26T10:00:00.000Z",
  wbSnapshotAt: "2026-09-26T09:55:00.000Z",
}

describe.skipIf(!TEST_DATABASE_URL)("хранилище пула", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ozon: number
  let orderId: number
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, RUN1)
    await insertRun(h.db, RUN2)
    ozon = (await h.db.select().from(channels)).find((c) => c.code === "ozon")!.id
    await upsertOrders(h.db, ozon, [
      { externalId: "OZ-1", line: 0, barcode: "A", quantity: 1, lifecycle: "open", occurredAt: "2026-09-26T10:00:00.000Z", raw: {} },
    ])
    orderId = (await h.db.select().from(ordersRaw))[0]!.id
  })
  afterAll(async () => h?.close())

  const orderEvent = (): PoolEvent => ({
    barcode: "A",
    kind: "order",
    delta: -1,
    baseBefore: 2,
    baseAfter: 1,
    channelId: ozon,
    orderId,
    snapshotAt: null,
    occurredAt: "2026-09-26T10:00:00.000Z",
    detail: null,
  })

  it("пустая база — пустое состояние", async () => {
    expect(await loadPoolState(h.db)).toEqual({ items: [], applied: new Set(), cancelledApplied: new Set() })
  })

  it("сохранение и чтение: состояние в ISO, учтённый заказ — числом в множестве", async () => {
    await savePoolRun(h.db, { runId: RUN1, items: [item], events: [orderEvent()] })
    const state = await loadPoolState(h.db)
    expect(state.items).toEqual([item])
    expect(state.applied.has(orderId)).toBe(true)
    expect(state.cancelledApplied.size).toBe(0)
  })

  it("повтор того же события — откат всего прогона, состояние не меняется", async () => {
    await expect(
      savePoolRun(h.db, { runId: RUN2, items: [{ ...item, base: 0, wbExpected: 0 }], events: [orderEvent()] }),
    ).rejects.toThrow()
    const [row] = await h.db.select().from(poolItems)
    expect(row!.base).toBe(1)
  })

  it("прогон без событий обновляет только состояние", async () => {
    await savePoolRun(h.db, { runId: RUN2, items: [{ ...item, base: 3, wbExpected: 3 }], events: [] })
    expect((await loadPoolState(h.db)).items[0]?.base).toBe(3)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npm run test:db -- packages/db/src/pool-store.db.test.ts`
Expected: FAIL — `Cannot find module './pool-store'`.

- [ ] **Step 3: Реализация**

`sync2/packages/db/src/pool-store.ts`:
```ts
import { inArray, sql } from "drizzle-orm"
import type { PoolEvent, PoolItemState } from "@sync2/domain"
import type { Db } from "./client"
import { poolEvents, poolItems } from "./schema"
import { toIsoOrNull } from "./time"

export interface PoolState {
  items: PoolItemState[]
  /** Заказы, по которым уже есть событие order. */
  applied: Set<number>
  /** Заказы, по которым уже есть событие cancel. */
  cancelledApplied: Set<number>
}

/**
 * Состояние пула для reconcilePool. Множества строятся конструктором запросов:
 * он отдаёт order_id числом (режим number), а сырой SQL — строкой, и тогда
 * Set.has(number) всегда false — заказы списались бы повторно.
 */
export async function loadPoolState(db: Db): Promise<PoolState> {
  const rows = await db.select().from(poolItems).orderBy(poolItems.barcode)
  const items = rows.map((r) => ({
    barcode: r.barcode,
    base: r.base,
    wbExpected: r.wbExpected,
    expectedAt: toIsoOrNull(r.expectedAt),
    wbSnapshotAt: toIsoOrNull(r.wbSnapshotAt),
  }))
  const events = await db
    .select({ orderId: poolEvents.orderId, kind: poolEvents.kind })
    .from(poolEvents)
    .where(inArray(poolEvents.kind, ["order", "cancel"]))
  const applied = new Set<number>()
  const cancelledApplied = new Set<number>()
  for (const e of events) {
    if (e.orderId === null) continue
    if (e.kind === "order") applied.add(e.orderId)
    else cancelledApplied.add(e.orderId)
  }
  return { items, applied, cancelledApplied }
}

/**
 * Итог прогона пула — одной транзакцией: состояние и события вместе или ничего.
 * Повтор события (второй прогон с теми же заказами) отсекает уникальный индекс,
 * и откатывается весь прогон — состояние не разъедется с журналом.
 */
export async function savePoolRun(
  db: Db,
  run: { runId: string; items: PoolItemState[]; events: PoolEvent[] },
): Promise<void> {
  await db.transaction(async (tx) => {
    if (run.items.length > 0) {
      await tx
        .insert(poolItems)
        .values(run.items)
        .onConflictDoUpdate({
          target: poolItems.barcode,
          set: {
            base: sql`excluded.base`,
            wbExpected: sql`excluded.wb_expected`,
            expectedAt: sql`excluded.expected_at`,
            wbSnapshotAt: sql`excluded.wb_snapshot_at`,
            updatedAt: sql`now()`,
          },
        })
    }
    if (run.events.length > 0) {
      await tx.insert(poolEvents).values(run.events.map((e) => ({ ...e, runId: run.runId })))
    }
  })
}
```

`sync2/packages/db/src/index.ts` — добавить `export * from "./pool-store"`.

- [ ] **Step 4: Запустить — проходит**

Run: `npm run test:db && npm run typecheck`
Expected: db 26 passed; typecheck чист.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/db/src
git commit -m "sync2: хранилище пула — состояние и события одной транзакцией"
```

---

### Task 12: Сквозной цикл пула на живой базе — приёмка плана

Одна история на одном товаре, прогон за прогоном, через настоящую базу: холодный старт → продажа на Ozon → повтор без изменений → отмена до отправки → возврат после доставки → продажа на WB → план записей в KIT.

**Files:**
- Test: `sync2/packages/db/src/pool-cycle.db.test.ts`

- [ ] **Step 1: Тест**

`sync2/packages/db/src/pool-cycle.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { MAX_STOCK_CHANGES_PER_RUN, WB_SETTLE_MINUTES, planStockWrites, reconcilePool, toPoolOrders } from "@sync2/domain"
import type { NormalizedStock } from "@sync2/shared"
import { seedChannels } from "./channels-seed"
import { loadOrdersSince, upsertOrders, type OrderUpsert } from "./orders"
import { loadPoolState, savePoolRun } from "./pool-store"
import { channels } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

const s = (barcode: string, quantity: number): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse: null })
const order = (externalId: string, patch: Partial<OrderUpsert> = {}): OrderUpsert => ({
  externalId,
  line: 0,
  barcode: "A",
  quantity: 1,
  lifecycle: "open",
  occurredAt: "2026-09-26T10:00:00.000Z",
  raw: {},
  ...patch,
})

describe.skipIf(!TEST_DATABASE_URL)("сквозной цикл пула", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let id: (code: string) => number
  let n = 0

  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    const map = new Map((await h.db.select().from(channels)).map((c) => [c.code, c.id]))
    id = (code) => map.get(code)!
  })
  afterAll(async () => h?.close())

  /** Один прогон: чтение состояния и заказов → reconcilePool → сохранение. */
  async function tick(now: string, wb: { takenAt: string; stocks: NormalizedStock[] }) {
    const runId = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
    await insertRun(h.db, runId)
    const state = await loadPoolState(h.db)
    const { orders } = toPoolOrders(await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z"), id("wb"))
    const result = reconcilePool({ now, items: state.items, wbSnapshot: wb, orders, applied: state.applied, cancelledApplied: state.cancelledApplied, settleMinutes: WB_SETTLE_MINUTES })
    await savePoolRun(h.db, { runId, items: result.items, events: result.events })
    return result
  }
  const base = async () => (await loadPoolState(h.db)).items.find((i) => i.barcode === "A")?.base

  it("1. холодный старт: база = снимок WB", async () => {
    await tick("2026-09-26T10:00:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(await base()).toBe(3)
  })

  it("2. продажа на Ozon списывает единицу", async () => {
    await upsertOrders(h.db, id("ozon"), [order("OZ-1")])
    const r = await tick("2026-09-26T10:05:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(r.events.map((e) => e.kind)).toEqual(["order"])
    expect(await base()).toBe(2)
  })

  it("3. повтор без новых данных — ни событий, ни изменений", async () => {
    const r = await tick("2026-09-26T10:10:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(r.events).toEqual([])
    expect(await base()).toBe(2)
  })

  it("4. отмена до отправки возвращает единицу ровно один раз", async () => {
    await upsertOrders(h.db, id("ozon"), [order("OZ-1", { lifecycle: "cancelled_before_ship" })])
    await tick("2026-09-26T10:15:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    await tick("2026-09-26T10:16:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(await base()).toBe(3)
  })

  it("5. возврат после доставки единицу не возвращает", async () => {
    await upsertOrders(h.db, id("kit"), [order("KIT-1")])
    await tick("2026-09-26T10:20:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    await upsertOrders(h.db, id("kit"), [order("KIT-1", { lifecycle: "returned" })])
    await tick("2026-09-26T10:21:00.000Z", { takenAt: "2026-09-26T10:00:00.000Z", stocks: [s("A", 3)] })
    expect(await base()).toBe(2)
  })

  it("6. заказ WB в пул не вычитается — продажа на WB приходит сигналом из снимка", async () => {
    await upsertOrders(h.db, id("wb"), [order("WB-1")])
    // Ожидание менялось в 10:20 (заказ KIT) — снимок через 20+ минут принимается.
    const r = await tick("2026-09-26T10:45:00.000Z", { takenAt: "2026-09-26T10:41:00.000Z", stocks: [s("A", 1)] })
    expect(r.events.map((e) => e.kind)).toEqual(["wb_signal"])
    expect(await base()).toBe(1)
  })

  it("7. план записей в KIT: остаток сводится к пулу, сирота обнуляется", async () => {
    const { items } = await loadPoolState(h.db)
    const plan = planStockWrites(items, [{ channel: "kit", stocks: [s("A", 3), s("Z", 1)] }], { maxChanges: MAX_STOCK_CHANGES_PER_RUN })
    expect(plan.aborted).toBeNull()
    expect(plan.changes).toEqual([
      { channel: "kit", barcode: "A", externalSku: null, before: 3, after: 1, orphan: false },
      { channel: "kit", barcode: "Z", externalSku: null, before: 1, after: 0, orphan: true },
    ])
  })
})
```

- [ ] **Step 2: Запустить**

Run: `npm run test:db -- packages/db/src/pool-cycle.db.test.ts`
Expected: 7 passed. Если шаг 6 не даёт `wb_signal` — проверить `settleMinutes` и что `expectedAt` в базе после шага 5 — ISO `…10:20:00.000Z`: его ставит заказ KIT в 10:20, возврат в 10:21 события не даёт и ожидание не трогает (снимок 10:41 не раньше 10:20 + 20 мин).

Run: `npm run test:db && npm test && npm run typecheck`
Expected: db 33 passed; unit — все зелёные; typecheck чист.

- [ ] **Step 3: Commit**

```bash
git add sync2/packages/db/src/pool-cycle.db.test.ts
git commit -m "sync2: сквозной цикл пула на живой базе"
```

---

### Task 13: README — домен и хранилище

**Files:**
- Modify: `sync2/README.md`

- [ ] **Step 1: Дописать раздел в конец `sync2/README.md`**

````markdown

## Пул остатков (этап 1.2)

- `packages/domain` — чистые функции, из `@sync2/shared` только типы:
  - `reconcilePool` — перенос из finstock (`cabinetId → channelId`), 21 тест перенесены как есть;
  - `toPoolOrders` — заказы WB не вычитаются (они в снимке WB), `cancelled_before_ship` возвращает единицу, `returned` — нет;
  - `wbSignalAccepted` / `acceptedWbBarcodes` / `applyWbWriteOutcomes` — когда WB пишет sync2: WB правится только по баркодам,
    чей сигнал WB принят в этом прогоне; применилась запись → ожидание = база и `expectedAt = now`; исход неизвестен →
    `max(база, факт)`; не применилась → факт из снимка;
  - `planStockWrites` — было → станет по площадкам (с артикулом), сироты обнуляются, `hold` удерживает баркоды площадки,
    больше 120 разных баркодов — не писать ничего.
- `packages/db`: `upsertOrders`/`loadOrdersSince`, `insertStockSnapshot`/`latestStockSnapshots`,
  `loadPoolState`/`savePoolRun` (одна транзакция). Время из базы — `toIso`: Postgres отдаёт текст, домен живёт в ISO.
- Приёмка: `packages/db/src/pool-cycle.db.test.ts` — вся история товара на живой базе.
````

- [ ] **Step 2: Commit**

```bash
git add sync2/README.md
git commit -m "sync2: README — пул остатков"
```

---

## Готово, когда

- `npm run typecheck`, `npm test`, `npm run test:db` — зелёные; в `packages/domain` 44 теста, из них 21 — перенесённые из finstock без правок логики.
- `pool-cycle.db.test.ts` проходит все 7 шагов истории.
- Миграция 0001 применена к локальной `sync2`, `0000` не изменён.
- Ни одной строки, которая ходит в сеть площадок.

## Следующий план

1.3 «KIT и сайт»: адаптеры KIT (`/v1/orders`, `/v1/variants/stocks/bulk_update`) и служебный API сайта (`kotelnikovartifact`), статусы заказов → жизненный цикл, джобы `orders` и `stocks` внутри `withRun` (WB в режиме `external`), `record` для `writes` (пустой массив не вставлять), `redact` в pino, advisory lock от наложения кронов, выкладка на VPS, `dry-run` → `apply` для KIT и сайта.

## Поправки при исполнении (26.09.2026)

Смысловая проверка задач 4–6 нашла гонки режима «WB пишет sync2»; исправлено в коммитах `4fc0af9`, `22e919b`:
`applyWbWriteOutcomes(items, accepted, wbActual, results, now)` вместо трёхаргументной версии из задачи 5;
`planStockWrites` — `hold`, предохранитель по разным баркодам, `externalSku`, сортировка. Тексты задач 5–6 выше —
исходная редакция; действует код.

## Контракт адаптеров для плана 1.3 (обязателен, с тестами)

- Снимок остатков любой площадки, включая WB, содержит **и нулевые строки** по всем существующим карточкам:
  отсутствие баркода в снимке домен читает как «карточки нет» и ничего туда не пишет.
- `NormalizedStock.barcode` — всегда баркод WB; Ozon и ЯМ сопоставляются через offer_id = артикул WB → баркод.
  Иначе товар станет «сиротой» и обнулится.
- Окно чтения заказов (`loadOrdersSince`) — не короче срока, за который площадка может отменить заказ (закладывать 60 дней):
  поздняя отмена за окном потеряет возврат единицы.
- Режим WB `self` (1.4): перед записью на WB перечитывать остаток записываемых баркодов и не писать те, что изменились
  с момента снимка — продажа WB между чтением и записью иначе затрётся.
