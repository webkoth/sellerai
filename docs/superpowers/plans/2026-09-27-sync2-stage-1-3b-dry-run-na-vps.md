# Синк v2 · этап 1.3b — прогоны на VPS в режиме «считает, не пишет» и сверка со старым синком

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Запустить `sync2` на VPS рядом со старым синком: каждые 10 минут забирать заказы и остатки четырёх площадок в базу, пересчитывать пул и план записей в режиме `dry-run` (ничего не отправлять на площадки), раз в сутки присылать в Telegram сверку пула `sync2` с леджером старого синка. Приёмка — трое суток без необъяснённых расхождений; это ворота к переключению (1.4).

**Architecture:** Две джобы в `apps/worker`: `ingest` (каталог WB → `products`, заказы → `orders_raw`, снимки → `stock_snapshots_raw`, ошибка площадки не роняет остальные) и `pool` (пул в режиме WB `external`, `planStockWrites` → `executeWrites` с журналом `writes`; отправитель на площадки в этом этапе отсутствует — любая попытка записи падает с ошибкой). Команда `tick` = `ingest` + `pool` под одной `flock`-блокировкой. Джоба `compare-v1` читает леджер старого синка (`/opt/sellerai-sync/data/state/inventory.json`) и шлёт сводку. Выкладка — архивом в `/opt/sync2`, база — отдельная база `sync2` в уже работающем PostgreSQL 18 на VPS.

**Tech Stack:** как в 1.1–1.3a. На VPS: Ubuntu 24.04, Node 24, PostgreSQL 18 (уже установлен, используется другими проектами — трогать только свою базу), npm 11.16.0 через `npx -y npm@11.16.0 ci`.

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md` §5, §10–11. **Заметки к 1.3b:** конец `docs/superpowers/plans/2026-09-27-sync2-stage-1-3a-adaptery-chteniya.md`.

**Ограничения VPS (27.09):** 2 ГБ памяти, свободно ~415 МБ; старый синк — `/opt/sellerai-sync`, крон: заказы в минуты `3,8,…,58`, сверка в `:00/:30` под `/tmp/sai-ledger.lock`. `sync2` запускается в минуты `1,11,21,31,41,51`, под собственной блокировкой `/tmp/sync2.lock`, одним процессом. **Старый синк, его `.env`, крон и чужие базы PostgreSQL не менять.**

---

## Решения этапа

1. **WB в режиме `external`.** Пишет WB старый синк; `sync2` ждёт его записи `WB_SETTLE_MINUTES` (20 мин) — семантика finstock без изменений. `wbWriteGate`/`applyWbWriteOutcomes` в 1.3b не используются.
2. **Запись на площадки отсутствует физически.** Отправитель `send` в `pool` — функция, которая бросает `Error("запись на площадки подключается на этапе 1.4")`. Глобальный `SYNC_WRITE_MODE=dry-run`, режим площадок в `channels`: `ozon`, `ym`, `kit` — `dry-run`, `wb`, `site` — `off`.
3. **Каталог WB — ворота снимков.** Каталог не получен → джоба `ingest` падает целиком (без индекса WB остатки остальных не сопоставить). Каталог короче 90% прошлого принятого → снимки и заказы зеркал в этом прогоне не пишутся, статус `partial`, сообщение в Telegram.
4. **Свежесть.** `pool` берёт в план только снимки не старше 20 минут; без свежего снимка WB пул не пересчитывается.
5. **Адаптеры создаются на каждый прогон** (кэш каталога и вариантов держит и отказы).
6. **Сайт** в 1.3b не участвует (служебный API — 1.3c).

---

## Карта файлов

```
sync2/
  package.json                         + скрипт deploy
  vitest.config.ts                     проект db включает apps/**/*.db.test.ts
  packages/platforms/src/http.ts       таймаут чтения тела → сетевой сбой (+test)
  packages/db/src/
    products.ts (+db test)             upsertProducts, countProducts
    channels.ts (+db test)             loadChannels
    writes-store.ts (+db test)         drizzleWriteStore
    runs-query.ts (+db test)           lastCounter
    index.ts
  apps/worker/src/
    log.ts (+test)                     redact секретов
    notify.ts (+test)                  createNotifier (Telegram)
    adapters.ts                        buildAdapters(config)
    jobs/ingest.ts (+db test)          runIngest
    jobs/pool.ts (+db test)            runPool
    jobs/compare-v1.ts (+test)         comparePools (чистая) + runCompareV1
    cli.ts                             + ingest | pool | tick | compare-v1
  deploy/
    deploy.sh                          архив → VPS → npm ci → миграции
    crontab.sync2.txt                  строки крона sync2
    logrotate.sync2                    ротация логов
    README.md                          разовая настройка VPS и откат
```

---

### Task 1: Таймаут чтения тела ответа — сетевой сбой, а не сырой `TimeoutError`

**Files:** Modify `sync2/packages/platforms/src/http.ts`, `http.test.ts`

- [ ] **Step 1: Падающий тест** (дописать в `http.test.ts`):
```ts
it("тело ответа не дочиталось до таймаута — повтор, затем PlatformApiError со статусом 0", async () => {
  const bodyTimeout = () =>
    ({ ok: true, status: 200, headers: new Headers(), text: () => Promise.reject(new DOMException("t", "TimeoutError")) }) as unknown as Response
  const fetchMock = vi.fn(async () => bodyTimeout())
  vi.stubGlobal("fetch", fetchMock)
  await expect(requestJson("kit", "https://api.kit.yandex.net/v1/orders", { token: "t", retryDelaysMs: [0] })).rejects.toMatchObject({ status: 0 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
```
Run: `cd sync2 && npx vitest run packages/platforms/src/http.test.ts` → FAIL (сейчас летит сырой `TimeoutError`).

- [ ] **Step 2: Реализация.** В `requestJson` чтение тела (`response.text()`/`json()`) перенести внутрь того же `try`, что и `fetch`, либо обернуть отдельным `try`: `AbortError`/`TimeoutError` при чтении тела — сетевой сбой (status 0), повтор по `retryDelaysMs`, по исчерпании — `PlatformApiError(source, 0, …)`. Комментарий: «таймаут `AbortSignal.timeout` действует и на чтение тела; без этого обрыв посреди большого ответа ронял прогон сырым исключением».

- [ ] **Step 3:** `npx vitest run packages/platforms`, `npm run typecheck` → зелёные.
```bash
git add sync2/packages/platforms/src/http.ts sync2/packages/platforms/src/http.test.ts
git commit -m "sync2: таймаут чтения тела ответа — сетевой сбой с повтором"
```

---

### Task 2: Хранилище — товары, площадки, журнал записей, счётчики прошлых запусков

**Files:**
- Create: `sync2/packages/db/src/{products,channels,writes-store,runs-query}.ts` + `*.db.test.ts`
- Modify: `sync2/packages/db/src/index.ts`, `sync2/vitest.config.ts`

- [ ] **Step 1: Проект `db` в Vitest видит и `apps`.** В `sync2/vitest.config.ts` у проекта `db`:
```ts
include: ["packages/**/src/**/*.db.test.ts", "apps/**/src/**/*.db.test.ts"],
```
(проект `unit` уже исключает `**/*.db.test.ts`).

- [ ] **Step 2: Падающие тесты** `sync2/packages/db/src/store-1-3b.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { loadChannels } from "./channels"
import { countProducts, upsertProducts } from "./products"
import { drizzleRunStore } from "./run-store"
import { lastCounter } from "./runs-query"
import { channels, writes } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"
import { drizzleWriteStore } from "./writes-store"
import { eq } from "drizzle-orm"

describe.skipIf(!TEST_DATABASE_URL)("хранилище этапа 1.3b", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => h?.close())

  it("товары из каталога WB: вставка и обновление без дублей", async () => {
    const e = { barcode: "A", vendorCode: "JW-1", nmId: 1, title: "Браслет", subject: "Браслеты" }
    await upsertProducts(h.db, [e, { ...e }])
    await upsertProducts(h.db, [{ ...e, title: "Браслет новый" }])
    expect(await countProducts(h.db)).toBe(1)
  })

  it("площадки: id и режим записи, неизвестный код в базе — ошибка", async () => {
    await h.db.update(channels).set({ writeMode: "dry-run" }).where(eq(channels.code, "kit"))
    const m = await loadChannels(h.db)
    expect(m.get("kit")).toMatchObject({ writeMode: "dry-run" })
    expect(m.get("wb")).toMatchObject({ writeMode: "off" })
    expect(m.size).toBe(5)
  })

  it("журнал записей: пустой список не пишется, итоги пишутся с id площадки", async () => {
    const runId = "00000000-0000-4000-8000-0000000000e1"
    await insertRun(h.db, runId)
    const record = drizzleWriteStore(h.db, runId, await loadChannels(h.db))
    await record([])
    await record([{ channel: "kit", barcode: "A", field: "stock", before: 2, after: 1, mode: "dry-run", applied: false, response: null, error: null }])
    const rows = await h.db.select().from(writes)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ barcode: "A", before: 2, after: 1, mode: "dry-run", applied: false })
  })

  it("счётчик прошлого успешного запуска джобы", async () => {
    const store = drizzleRunStore(h.db)
    for (const [id, n, status] of [["f1", 400, "ok"], ["f2", 10, "failed"]] as const) {
      const runId = `00000000-0000-4000-8000-0000000000${id}`
      await store.start({ runId, job: "ingest", writeMode: "dry-run", startedAt: `2026-09-27T10:0${id === "f1" ? 0 : 1}:00.000Z` })
      await store.finish(runId, { status, finishedAt: "2026-09-27T10:05:00.000Z", counters: { wbCatalog: n }, error: null })
    }
    expect(await lastCounter(h.db, "ingest", "wbCatalog")).toBe(400)
    expect(await lastCounter(h.db, "ingest", "нет-такого")).toBeNull()
  })
})
```
Run: `npm run test:db -- packages/db/src/store-1-3b.db.test.ts` → FAIL (нет модулей).

- [ ] **Step 3: Реализация.**

`sync2/packages/db/src/products.ts`:
```ts
import { count, sql } from "drizzle-orm"
import type { WbCatalogEntry } from "@sync2/shared"
import type { Db } from "./client"
import { products } from "./schema"

/** Каталог WB → справочник товаров. Дубли штрихкода в одном каталоге схлопываются (побеждает последний). */
export async function upsertProducts(db: Db, entries: WbCatalogEntry[]): Promise<number> {
  const byBarcode = new Map(entries.map((e) => [e.barcode, e]))
  if (byBarcode.size === 0) return 0
  await db
    .insert(products)
    .values([...byBarcode.values()].map((e) => ({ barcode: e.barcode, vendorCode: e.vendorCode, nmId: e.nmId, title: e.title, wbSubject: e.subject })))
    .onConflictDoUpdate({
      target: products.barcode,
      set: {
        vendorCode: sql`excluded.vendor_code`,
        nmId: sql`excluded.nm_id`,
        title: sql`excluded.title`,
        wbSubject: sql`excluded.wb_subject`,
        updatedAt: sql`now()`,
      },
    })
  return byBarcode.size
}

export async function countProducts(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(products)
  return row?.n ?? 0
}
```

`sync2/packages/db/src/channels.ts`:
```ts
import { isChannel, parseWriteMode, type Channel, type WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import { channels } from "./schema"

export interface ChannelRow {
  id: number
  writeMode: WriteMode
}

/** Площадки из базы: код → id и режим записи. Неизвестный код или режим — ошибка, а не тихий пропуск. */
export async function loadChannels(db: Db): Promise<Map<Channel, ChannelRow>> {
  const out = new Map<Channel, ChannelRow>()
  for (const r of await db.select().from(channels)) {
    if (!isChannel(r.code)) throw new Error(`неизвестная площадка в таблице channels: ${r.code}`)
    out.set(r.code, { id: r.id, writeMode: parseWriteMode(r.writeMode, "off") })
  }
  return out
}
```

`sync2/packages/db/src/writes-store.ts`:
```ts
import type { Channel, WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import type { ChannelRow } from "./channels"
import { writes } from "./schema"

/** Итог записи по позиции — структурно совместим с WriteOutcome из @sync2/platforms (db от platforms не зависит). */
export interface WriteRecord {
  channel: Channel
  barcode: string
  field: "stock" | "price"
  before: number | null
  after: number
  mode: WriteMode
  applied: boolean
  response: unknown
  error: string | null
}

/** record для executeWrites: пишет журнал writes; пустой список не вставляется (drizzle бросает на .values([])). */
export function drizzleWriteStore(db: Db, runId: string, channelRows: ReadonlyMap<Channel, ChannelRow>) {
  return async (outcomes: WriteRecord[]): Promise<void> => {
    if (outcomes.length === 0) return
    await db.insert(writes).values(
      outcomes.map((o) => {
        const ch = channelRows.get(o.channel)
        if (!ch) throw new Error(`площадки ${o.channel} нет в таблице channels`)
        return { runId, channelId: ch.id, barcode: o.barcode, field: o.field, before: o.before, after: o.after, mode: o.mode, applied: o.applied, response: o.response ?? null, error: o.error }
      }),
    )
  }
}
```

`sync2/packages/db/src/runs-query.ts`:
```ts
import { and, desc, eq, inArray } from "drizzle-orm"
import type { Db } from "./client"
import { runs } from "./schema"

/** Значение счётчика из последнего успешного (ok/partial) запуска джобы; нет — null. */
export async function lastCounter(db: Db, job: string, key: string): Promise<number | null> {
  const [row] = await db
    .select({ counters: runs.counters })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial"])))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  const v = (row?.counters as Record<string, unknown> | undefined)?.[key]
  return typeof v === "number" ? v : null
}
```
`sync2/packages/db/src/index.ts` — добавить экспорт четырёх модулей.

- [ ] **Step 4:** `npm run test:db` (+4), `npm run typecheck` → зелёные.
```bash
git add sync2/packages/db/src sync2/vitest.config.ts
git commit -m "sync2: хранилище — товары WB, площадки, журнал записей, счётчики прошлых запусков"
```

---

### Task 3: Лог без секретов и Telegram-уведомления

**Files:** Modify `sync2/apps/worker/src/log.ts`, `log.test.ts`; Create `sync2/apps/worker/src/notify.ts`, `notify.test.ts`

- [ ] **Step 1: Падающий тест** в `log.test.ts`:
```ts
it("секреты в лог не попадают", () => {
  const { lines, dest } = capture()
  createLogger("info", dest).info({ token: "SECRET1", cfg: { apiKey: "SECRET2", token: "SECRET3" }, headers: { Authorization: "Bearer SECRET4" } }, "x")
  expect(lines[0]).not.toMatch(/SECRET/)
})
```
Реализация в `createLogger`: опция pino `redact: { paths: ["token", "apiKey", "*.token", "*.apiKey", "headers.Authorization", "*.headers.Authorization", "err.config.headers"], censor: "[скрыто]" }`.

- [ ] **Step 2: Уведомления — падающий тест** `notify.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest"
import { createNotifier } from "./notify"

describe("createNotifier", () => {
  it("шлёт текст в чат через Bot API", async () => {
    const f = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    await createNotifier({ token: "T", chatId: "-100", fetchImpl: f }).send("привет")
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe("https://api.telegram.org/botT/sendMessage")
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ chat_id: "-100", text: "привет", disable_web_page_preview: true })
  })
  it("без токена — ничего не шлёт и не падает", async () => {
    const f = vi.fn()
    await createNotifier({ token: "", chatId: "-100", fetchImpl: f }).send("x")
    expect(f).not.toHaveBeenCalled()
  })
  it("ошибка Telegram не роняет джобу — возвращает false", async () => {
    const f = vi.fn(async () => new Response("bad", { status: 400 }))
    await expect(createNotifier({ token: "T", chatId: "-100", fetchImpl: f }).send("x")).resolves.toBe(false)
  })
})
```
Реализация `notify.ts`:
```ts
export interface Notifier {
  /** true — доставлено; false — не отправлялось или Telegram отказал (джоба не падает). */
  send(text: string): Promise<boolean>
}

export function createNotifier(opts: { token: string; chatId: string; fetchImpl?: typeof fetch }): Notifier {
  const f = opts.fetchImpl ?? fetch
  return {
    async send(text) {
      if (!opts.token || !opts.chatId) return false
      try {
        const r = await f(`https://api.telegram.org/bot${opts.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: opts.chatId, text, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(15_000),
        })
        return r.ok
      } catch {
        return false
      }
    },
  }
}
```

- [ ] **Step 3:** `npx vitest run apps/worker`, `npm run typecheck`.
```bash
git add sync2/apps/worker/src/log.ts sync2/apps/worker/src/log.test.ts sync2/apps/worker/src/notify.ts sync2/apps/worker/src/notify.test.ts
git commit -m "sync2: секреты скрыты в логе, уведомления в Telegram"
```

---

### Task 4: Джоба `ingest`

**Files:** Create `sync2/apps/worker/src/adapters.ts`, `sync2/apps/worker/src/jobs/ingest.ts`, `sync2/apps/worker/src/jobs/ingest.db.test.ts`

- [ ] **Step 1: Сборка адаптеров** `apps/worker/src/adapters.ts`:
```ts
import { createKitAdapter, createOzonAdapter, createWbAdapter, createYmAdapter, type ChannelAdapter } from "@sync2/platforms"
import type { WbCatalogEntry, WbCatalogIndex } from "@sync2/shared"
import type { ChannelsConfig } from "./channels-config"

export interface Adapters {
  wb: ChannelAdapter & { fetchCatalog(): Promise<WbCatalogEntry[]> }
  /** Зеркала строятся от индекса каталога WB этого же прогона. */
  mirrors(index: WbCatalogIndex): ChannelAdapter[]
}

/** Новые экземпляры на каждый прогон: кэш каталога и вариантов держит и отказы. */
export function buildAdapters(cfg: ChannelsConfig): Adapters {
  return {
    wb: createWbAdapter(cfg.wb.token),
    mirrors: (index) => [
      createOzonAdapter(cfg.ozon, index),
      createYmAdapter(cfg.ym, index, cfg.ym.warehouseIds),
      createKitAdapter(cfg.kit, index),
    ],
  }
}
```
(Точные сигнатуры и имя типа `ChannelsConfig` — сверить с `packages/platforms/src/*/adapter.ts` и `apps/worker/src/channels-config.ts`; при расхождении — подстроить вызовы, поведение не менять.)

- [ ] **Step 2: Падающий тест** `apps/worker/src/jobs/ingest.db.test.ts` — фальшивые адаптеры, живая тестовая база:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { countProducts, latestStockSnapshots, loadChannels, loadOrdersSince, seedChannels } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { ChannelAdapter } from "@sync2/platforms"
import type { ChannelOrder, WbCatalogEntry } from "@sync2/shared"
import { runIngest } from "./ingest"

const cat = (n: number): WbCatalogEntry[] =>
  Array.from({ length: n }, (_, i) => ({ barcode: `B${i}`, vendorCode: `V${i}`, nmId: i, title: "", subject: null }))
const order = (id: string, q = 1): ChannelOrder => ({ externalId: id, barcode: "B0", externalSku: null, quantity: q, priceMinor: 0, lifecycle: "open", occurredAt: "2026-09-27T09:00:00.000Z", raw: {} })
const fake = (channel: ChannelAdapter["channel"], orders: ChannelOrder[], fail = false): ChannelAdapter => ({
  channel,
  fetchOrders: async () => (fail ? Promise.reject(new Error(`${channel} упал`)) : orders),
  fetchStocks: async () => ({ stocks: [{ barcode: "B0", externalSku: null, quantity: 1, warehouse: null }], skippedNoWbBarcode: [] }),
})

describe.skipIf(!TEST_DATABASE_URL)("runIngest", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let n = 0
  const runId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
  })
  afterAll(async () => h?.close())

  // У каждого прогона своё время: снимок уникален по паре «площадка + момент».
  const deps = (catalog: WbCatalogEntry[], mirrorsFail = false, at = `2026-09-27T10:0${n}:00.000Z`) => ({
    db: h.db,
    now: () => new Date(at),
    adapters: {
      wb: { ...fake("wb", [order("W1")]), fetchCatalog: async () => catalog },
      mirrors: () => [fake("ozon", [order("O1"), order("O0", 0)], mirrorsFail), fake("kit", [order("K1")])],
    },
  })

  it("пишет товары, заказы и снимки; строки с количеством 0 отбрасываются", async () => {
    const id = runId()
    await insertRun(h.db, id)
    const r = await runIngest({ ...deps(cat(10)), runId: id, previousCatalog: null })
    expect(r.status).toBe("ok")
    expect(await countProducts(h.db)).toBe(10)
    const orders = await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")
    expect(orders.map((o) => o.quantity)).toEqual([1, 1, 1])
    const channels = await loadChannels(h.db)
    expect((await latestStockSnapshots(h.db)).has(channels.get("kit")!.id)).toBe(true)
    expect(r.counters).toMatchObject({ wbCatalog: 10, ozonOrders: 1, kitOrders: 1 })
  })

  it("сбой площадки — partial, остальные площадки записаны", async () => {
    const id = runId()
    await insertRun(h.db, id)
    const r = await runIngest({ ...deps(cat(10), true), runId: id, previousCatalog: 10 })
    expect(r.status).toBe("partial")
    expect(r.errors).toEqual([expect.stringContaining("ozon")])
  })

  it("каталог WB короче 90% прошлого — ни заказов зеркал, ни снимков, partial", async () => {
    const id = runId()
    await insertRun(h.db, id)
    const before = (await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")).length
    const r = await runIngest({ ...deps(cat(8)), runId: id, previousCatalog: 10 })
    expect(r).toMatchObject({ status: "partial", counters: { catalogRejected: 1 } })
    expect((await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")).length).toBe(before)
  })
})
```
Если пакет `@sync2/db` не экспортирует подпуть `test-db`, добавить в `sync2/packages/db/package.json` `"exports": { ".": "./src/index.ts", "./test-db": "./src/test-db.ts" }` и псевдоним `"@sync2/db/test-db"` в `vitest.config.ts` **раньше** `"@sync2/db"` (урок finstock: более короткий псевдоним перехватывает подпуть).

Run: `npm run test:db -- apps/worker/src/jobs/ingest.db.test.ts` → FAIL.

- [ ] **Step 3: Реализация** `apps/worker/src/jobs/ingest.ts`:
```ts
import { insertStockSnapshot, loadChannels, upsertOrders, upsertProducts, type Db, type OrderUpsert } from "@sync2/db"
import { buildWbCatalogIndex, errorText, type ChannelOrder } from "@sync2/shared"
import type { ChannelAdapter } from "@sync2/platforms"
import type { Adapters } from "../adapters"

/** Окно чтения заказов — не короче срока поздней отмены (заметки к 1.3b: 60 дней). */
export const ORDERS_WINDOW_DAYS = 60
/** Каталог WB короче этой доли прошлого принятого — прогон не пишет снимки и заказы зеркал. */
export const MIN_CATALOG_SHARE = 0.9

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
 * (без индекса остатки зеркал не сопоставить); заметно короче прошлого — пишутся только
 * товары, снимки и заказы зеркал пропускаются. Сбой отдельной площадки не роняет остальные.
 */
export async function runIngest(deps: {
  db: Db
  now: () => Date
  runId: string
  adapters: Adapters
  previousCatalog: number | null
}): Promise<IngestResult> {
  const { db, runId } = deps
  const counters: Record<string, number> = {}
  const errors: string[] = []
  const since = new Date(deps.now().getTime() - ORDERS_WINDOW_DAYS * 86_400_000).toISOString()
  const channels = await loadChannels(db)

  const catalog = await deps.adapters.wb.fetchCatalog()
  counters.wbCatalog = catalog.length
  await upsertProducts(db, catalog)
  if (deps.previousCatalog !== null && catalog.length < deps.previousCatalog * MIN_CATALOG_SHARE) {
    counters.catalogRejected = 1
    return { status: "partial", counters, errors: [`каталог WB ${catalog.length} при прошлом ${deps.previousCatalog}`] }
  }

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
```
Замечание: внутри одного прогона `takenAt` снимков разных площадок совпадает — это допустимо (уникальность по паре площадка + момент); между прогонами время разное.

- [ ] **Step 4:** `npm run test:db` → +3; `npm run typecheck`.
```bash
git add sync2/apps/worker/src sync2/packages/db/package.json sync2/vitest.config.ts
git commit -m "sync2: джоба ingest — каталог WB как ворота, заказы и снимки по площадкам"
```

---

### Task 5: Джоба `pool` — пересчёт и план записей в `dry-run`

**Files:** Create `sync2/apps/worker/src/jobs/pool.ts`, `pool.db.test.ts`

- [ ] **Step 1: Падающий тест** `apps/worker/src/jobs/pool.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { channels, insertStockSnapshot, loadChannels, loadPoolState, seedChannels, upsertOrders, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import { eq } from "drizzle-orm"
import { runPool } from "./pool"

const s = (barcode: string, quantity: number) => ({ barcode, externalSku: null, quantity, warehouse: null })

describe.skipIf(!TEST_DATABASE_URL)("runPool", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Awaited<ReturnType<typeof loadChannels>>
  let n = 0
  const runId = async () => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
    await insertRun(h.db, id)
    return id
  }
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    for (const c of ["ozon", "ym", "kit"] as const) await h.db.update(channels).set({ writeMode: "dry-run" }).where(eq(channels.code, c))
    ids = await loadChannels(h.db)
  })
  afterAll(async () => h?.close())

  const now = new Date("2026-09-27T10:10:00.000Z")

  it("без свежего снимка WB пул не пересчитывается", async () => {
    const r = await runPool({ db: h.db, now: () => now, runId: await runId(), globalMode: "dry-run" })
    expect(r.status).toBe("partial")
    expect((await loadPoolState(h.db)).items).toEqual([])
  })

  it("холодный старт от WB, заказ KIT, план записей в dry-run — в журнале, на площадки ничего", async () => {
    const id = await runId()
    await insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: id, takenAt: "2026-09-27T10:05:00.000Z", stocks: [s("A", 3)] })
    await insertStockSnapshot(h.db, { channelId: ids.get("kit")!.id, runId: id, takenAt: "2026-09-27T10:05:00.000Z", stocks: [s("A", 3), s("Z", 1)] })
    await upsertOrders(h.db, ids.get("kit")!.id, [
      { externalId: "K1", line: 0, barcode: "A", quantity: 1, lifecycle: "open", occurredAt: "2026-09-27T10:06:00.000Z", raw: {} },
    ])
    const pid = await runId()
    const r = await runPool({ db: h.db, now: () => now, runId: pid, globalMode: "dry-run" })
    expect(r.status).toBe("ok")
    // Холодный старт считает открытый заказ KIT уже учтённым старым синком на WB — база 3.
    expect((await loadPoolState(h.db)).items.find((i) => i.barcode === "A")?.base).toBe(3)
    const logged = await h.db.select().from(writes).where(eq(writes.runId, pid))
    expect(logged.map((w) => [w.barcode, w.before, w.after, w.mode, w.applied])).toEqual([["Z", 1, 0, "dry-run", false]])
  })

  it("снимок зеркала старше 20 минут в план не попадает", async () => {
    const sid = await runId()
    // Свежий WB (10:35), KIT остался от 10:05 — к 10:40 он устарел; Ozon и ЯМ снимков нет вовсе.
    await insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: sid, takenAt: "2026-09-27T10:35:00.000Z", stocks: [s("A", 3)] })
    const pid = await runId()
    const r = await runPool({ db: h.db, now: () => new Date("2026-09-27T10:40:00.000Z"), runId: pid, globalMode: "dry-run" })
    expect(r.status).toBe("ok")
    expect(r.counters).toMatchObject({ staleSnapshots: 3, kitPlanned: 0 })
  })
})
```

- [ ] **Step 2: Реализация** `apps/worker/src/jobs/pool.ts`:
```ts
import { latestStockSnapshots, loadChannels, loadOrdersSince, loadPoolState, savePoolRun, drizzleWriteStore, type Db } from "@sync2/db"
import { MAX_STOCK_CHANGES_PER_RUN, MAX_STOCK_TO_ZERO_PER_RUN, WB_SETTLE_MINUTES, planStockWrites, reconcilePool, toPoolOrders } from "@sync2/domain"
import { executeWrites, type WriteOp } from "@sync2/platforms"
import { CHANNELS, type Channel, type WriteMode } from "@sync2/shared"
import { ORDERS_WINDOW_DAYS } from "./ingest"

/** Снимок старше этого в план не берётся: цель считалась бы от устаревшего остатка площадки. */
export const SNAPSHOT_FRESH_MINUTES = 20

/** Отправителя на площадки в 1.3b нет: запись подключается при переключении (1.4). */
const noSender = async (): Promise<never> => {
  throw new Error("запись на площадки подключается на этапе 1.4")
}

export async function runPool(deps: { db: Db; now: () => Date; runId: string; globalMode: WriteMode }) {
  const { db, runId } = deps
  const now = deps.now()
  const counters: Record<string, number> = {}
  const channels = await loadChannels(db)
  const snaps = await latestStockSnapshots(db)
  const fresh = (takenAt: string) => now.getTime() - Date.parse(takenAt) <= SNAPSHOT_FRESH_MINUTES * 60_000

  const wbId = channels.get("wb")!.id
  const wb = snaps.get(wbId)
  if (!wb || !fresh(wb.takenAt)) {
    counters.noFreshWb = 1
    return { status: "partial" as const, counters }
  }

  const state = await loadPoolState(db)
  const rows = await loadOrdersSince(db, new Date(now.getTime() - ORDERS_WINDOW_DAYS * 86_400_000).toISOString())
  const { orders, skipped } = toPoolOrders(rows, wbId)
  const result = reconcilePool({
    now: now.toISOString(),
    items: state.items,
    wbSnapshot: wb,
    orders,
    applied: state.applied,
    cancelledApplied: state.cancelledApplied,
    settleMinutes: WB_SETTLE_MINUTES,
  })
  await savePoolRun(db, { runId, items: result.items, events: result.events })
  counters.events = result.events.length
  counters.ordersNoBarcode = skipped.noBarcode

  // WB пишет старый синк (режим external) — в план только зеркала со свежим снимком.
  const mirrors: Array<{ channel: Channel; stocks: typeof wb.stocks }> = []
  let stale = 0
  for (const c of ["ozon", "ym", "kit"] as const) {
    const snap = snaps.get(channels.get(c)!.id)
    if (snap && fresh(snap.takenAt)) mirrors.push({ channel: c, stocks: snap.stocks })
    else stale++
  }
  counters.staleSnapshots = stale

  const plan = planStockWrites(result.items, mirrors, { maxChanges: MAX_STOCK_CHANGES_PER_RUN, maxToZero: MAX_STOCK_TO_ZERO_PER_RUN })
  if (plan.aborted) {
    counters[`aborted_${plan.aborted.reason}`] = plan.aborted.count
    return { status: "partial" as const, counters }
  }
  const ops: WriteOp[] = plan.changes.map((c) => ({ channel: c.channel, barcode: c.barcode, field: "stock", before: c.before, after: c.after }))
  const channelModes = Object.fromEntries(CHANNELS.map((c) => [c, channels.get(c)?.writeMode ?? "off"])) as Record<Channel, WriteMode>
  const outcomes = await executeWrites(ops, { globalMode: deps.globalMode, channelModes, send: noSender, record: drizzleWriteStore(db, runId, channels) })
  for (const c of ["ozon", "ym", "kit"] as const) counters[`${c}Planned`] = outcomes.filter((o) => o.channel === c).length
  return { status: "ok" as const, counters }
}
```
(Имена экспорта `MAX_STOCK_TO_ZERO_PER_RUN` и т.п. — сверить с `packages/domain/src/index.ts`.)

- [ ] **Step 3:** `npm run test:db` → +3; `npm run typecheck`.
```bash
git add sync2/apps/worker/src/jobs/pool.ts sync2/apps/worker/src/jobs/pool.db.test.ts
git commit -m "sync2: джоба pool — пересчёт пула и план записей в dry-run без отправителя"
```

---

### Task 6: Сверка со старым синком `compare-v1`

**Files:** Create `sync2/apps/worker/src/jobs/compare-v1.ts`, `compare-v1.test.ts`

- [ ] **Step 1: Падающий тест** (чистая функция):
```ts
import { describe, expect, it } from "vitest"
import { comparePools, formatComparison } from "./compare-v1"

describe("comparePools", () => {
  it("совпадения, расхождения и товары только в одном пуле", () => {
    const r = comparePools(
      [{ barcode: "A", base: 2 }, { barcode: "B", base: 1 }, { barcode: "C", base: 0 }],
      { items: { A: { base: 2 }, B: { base: 3 }, D: { base: 1 } } },
    )
    expect(r).toEqual({
      same: 1,
      diff: [{ barcode: "B", v1: 3, v2: 1 }],
      onlyV1: [{ barcode: "D", v1: 1 }],
      onlyV2: [],
    })
  })
  it("нулевой товар, которого нет у старого синка, — не расхождение", () => {
    expect(comparePools([{ barcode: "C", base: 0 }], { items: {} }).onlyV2).toEqual([])
  })
})

describe("formatComparison", () => {
  it("короткая сводка для Telegram", () => {
    const text = formatComparison({ same: 80, diff: [{ barcode: "B", v1: 3, v2: 1 }], onlyV1: [], onlyV2: [] }, { failedRuns: 0, planned: { ozon: 2, ym: 0, kit: 1 } })
    expect(text).toContain("совпадает 80 из 81")
    expect(text).toContain("B: старый 3, новый 1")
  })
})
```
Реализация `compare-v1.ts`:
- `comparePools(v2: Array<{barcode; base}>, v1: { items: Record<string, { base: number }> })` — `same` (равная база), `diff`, `onlyV1` (есть у старого с базой > 0, нет у нового), `onlyV2` (есть у нового с базой > 0, нет у старого); нулевые «только у одного» не считаются.
- `formatComparison(r, { failedRuns, planned })` — текст:
```
🔎 sync2 ↔ старый синк, сверка пула
Совпадает N из M
Расходится K: <до 10 строк «баркод: старый X, новый Y»>
Только у старого: …  Только у нового: …
План записей за сутки (dry-run): Ozon a, ЯМ b, KIT c
Упавших прогонов за сутки: f
```
- `runCompareV1({ db, ledgerPath, notifier, now })`: читает `pool_items`, леджер JSON (нет файла — ошибка), считает `failedRuns` за 24 часа из `runs` и `planned` за 24 часа из `writes` (группировка по площадке), отправляет `formatComparison` через `notifier.send`, возвращает счётчики `{ same, diff, onlyV1, onlyV2 }`.

- [ ] **Step 2:** тесты зелёные, `npm run typecheck`.
```bash
git add sync2/apps/worker/src/jobs/compare-v1.ts sync2/apps/worker/src/jobs/compare-v1.test.ts
git commit -m "sync2: сверка пула со старым синком и сводка в Telegram"
```

---

### Task 7: Команды CLI `ingest`, `pool`, `tick`, `compare-v1`

**Files:** Modify `sync2/apps/worker/src/cli.ts`, `sync2/.env.example`, `sync2/README.md`

- [ ] **Step 1: Команды.** Каждая — внутри `withRun` (журнал `runs`, лог с `run_id`), с базой из `loadConfig`, режимом записи из `config.writeMode`:
  - `ingest` — `buildAdapters(loadChannelsConfig(env))`, `previousCatalog = lastCounter(db, "ingest", "wbCatalog")`, `runIngest`; тексты ошибок площадок — в `runs.error` (через `errors.join("; ")`, вернуть их из джобы вместе со статусом). Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) — **только при смене состояния**: прошлый запуск той же джобы был `ok`, текущий `partial`/`failed` → «⚠️ sync2 ingest: …»; прошлый был не `ok`, текущий `ok` → «✅ sync2 ingest снова в норме». Повторы одного состояния молчат. Для этого — функция `lastRunStatus(db, job)` в `packages/db/src/runs-query.ts` (статус последнего завершённого запуска, `null` если не было) с db-тестом. То же правило — для `pool`.
  - `pool` — `runPool`.
  - `tick` — `ingest`, затем `pool` (два отдельных запуска в журнале; `pool` выполняется и после `partial` у `ingest`, но не после `failed`).
  - `compare-v1` — `runCompareV1` с `V1_LEDGER_PATH` (по умолчанию `/opt/sellerai-sync/data/state/inventory.json`).
  - `write-mode <площадка> <off|dry-run|apply>` — меняет `channels.write_mode` одной площадки и печатает все пять; `apply` в 1.3b отклоняется с ошибкой «запись подключается на этапе 1.4» (код 2).
  `ingest`/`pool`, упавшие с исключением, — код выхода 1; `partial` — 0 (это штатная работа, а не авария).

- [ ] **Step 2: `.env.example`** — добавить `TELEGRAM_BOT_TOKEN=`, `TELEGRAM_CHAT_ID=-1004395280612`, `V1_LEDGER_PATH=/opt/sellerai-sync/data/state/inventory.json`, и заменить `SYNC_WRITE_MODE=off` на комментарий «на VPS в 1.3b — dry-run».

- [ ] **Step 3: Локальная проверка на тестовой базе без площадок:** `npm run cli -- pool` (при пустой базе — `partial`, `noFreshWb: 1`, код 0).

- [ ] **Step 4:** `npm run typecheck`, `npm test`, `npm run test:db`.
```bash
git add sync2/apps/worker/src/cli.ts sync2/.env.example sync2/README.md
git commit -m "sync2: команды ingest, pool, tick, compare-v1"
```

---

### Task 8: Выкладка на VPS

**Files:** Create `sync2/deploy/{deploy.sh,crontab.sync2.txt,logrotate.sync2,README.md}`; Modify `sync2/package.json` (скрипт `"deploy": "bash deploy/deploy.sh"`)

- [ ] **Step 1: `deploy/deploy.sh`** (запуск с Mac из `sync2/`):
```bash
#!/usr/bin/env bash
# Выкладка sync2 на VPS: код без node_modules и .env; .env и logs на сервере не трогаются.
set -euo pipefail
HOST=root@147.45.171.40
DIR=/opt/sync2
TMP=$(mktemp -d)
tar --exclude node_modules --exclude .env --exclude logs -czf "$TMP/sync2.tgz" .
ssh "$HOST" "mkdir -p $DIR/logs"
scp -q "$TMP/sync2.tgz" "$HOST:$DIR/"
ssh "$HOST" "cd $DIR && tar xzf sync2.tgz && rm sync2.tgz && find . -name '._*' -delete && npx -y npm@11.16.0 ci --silent && set -a && . ./.env && set +a && npm run db:migrate"
rm -rf "$TMP"
echo "выложено в $HOST:$DIR"
```

- [ ] **Step 2: `deploy/crontab.sync2.txt`:**
```
# sync2 (этап 1.3b, dry-run): каждые 10 минут в минуты 1,11,…,51 — мимо старого синка (3,8,…,58 и :00/:30).
1-59/10 * * * * cd /opt/sync2 && flock -n /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts tick >> logs/tick.log 2>&1
# сверка со старым синком — раз в сутки, 09:05 МСК
5 6 * * * cd /opt/sync2 && node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts compare-v1 >> logs/compare.log 2>&1
```

- [ ] **Step 3: `deploy/logrotate.sync2`:**
```
/opt/sync2/logs/*.log {
  daily
  rotate 14
  compress
  missingok
  notifempty
  copytruncate
}
```

- [ ] **Step 4: `deploy/README.md` — разовая настройка VPS** (выполнять по шагам, проверяя вывод):
```bash
# 1) База и пользователь — только свои; чужие базы не трогать
ssh root@147.45.171.40 "sudo -u postgres psql -c \"CREATE ROLE sync2 LOGIN PASSWORD '<сгенерировать: openssl rand -hex 16>'\" && sudo -u postgres createdb -O sync2 sync2"
# 2) Код
cd sync2 && npm run deploy
# 3) .env на сервере: ключи площадок и Telegram — из /opt/sellerai-sync/.env, плюс своё
ssh root@147.45.171.40 'cd /opt/sync2 && grep -E "^(WB_API_TOKEN|OZON_CLIENT_ID|OZON_API_TOKEN|YM_API_TOKEN|YM_BUSINESS_ID|YM_CAMPAIGN_ID|YAKIT_API_TOKEN|TELEGRAM_BOT_TOKEN)=" /opt/sellerai-sync/.env > .env && cat >> .env <<EOF
DATABASE_URL=postgres://sync2:<пароль>@localhost:5432/sync2
SYNC_WRITE_MODE=dry-run
LOG_LEVEL=info
YM_WAREHOUSE_IDS=2369574
KIT_WAREHOUSE_ID=01980d4c-1b53-7aa1-ab23-1b7c23604704
TELEGRAM_CHAT_ID=-1004395280612
V1_LEDGER_PATH=/opt/sellerai-sync/data/state/inventory.json
EOF
chmod 600 .env'
# 4) Миграции, площадки, режимы записи
ssh root@147.45.171.40 'cd /opt/sync2 && set -a && . ./.env && set +a && npm run db:migrate && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts" && $T seed-channels && $T write-mode ozon dry-run && $T write-mode ym dry-run && $T write-mode kit dry-run'
# 5) Первый прогон руками (не в минуты старого синка)
ssh root@147.45.171.40 'cd /opt/sync2 && node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts tick; node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts runs 5'
# 6) Крон — ДОПИСАТЬ к существующему, не заменять (старый синк живёт там же)
scp deploy/crontab.sync2.txt root@147.45.171.40:/opt/sync2/deploy/
ssh root@147.45.171.40 'crontab -l | grep -q "/opt/sync2" || (crontab -l; cat /opt/sync2/deploy/crontab.sync2.txt) | crontab -; crontab -l'
# 7) Ротация логов
ssh root@147.45.171.40 'cp /opt/sync2/deploy/logrotate.sync2 /etc/logrotate.d/sync2'
```
Откат: `ssh root@147.45.171.40 'crontab -l | grep -v "/opt/sync2" | crontab -'` — старый синк при этом не затрагивается. Память: после первого `tick` проверить `free -m`; если свободной меньше 150 МБ — сообщить владельцу до включения крона.

- [ ] **Step 5: Выполнить шаги 1–7 на VPS.** ssh/scp на `root@147.45.171.40` разрешены владельцем. Перед шагом 6 — вывод первого `tick` и `runs 5` в отчёт. Пароль базы не печатать в отчёт и не коммитить.

- [ ] **Step 6: Commit**
```bash
git add sync2/deploy sync2/package.json
git commit -m "sync2: выкладка на VPS — скрипт, крон dry-run, ротация логов"
```

---

### Task 9: Приёмка — трое суток параллельной работы

- [ ] Через 24, 48 и 72 часа после включения крона:
  - `ssh root@147.45.171.40 'cd /opt/sync2 && node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts runs 20'` — доля `failed` < 5%, `partial` — только с объяснимыми причинами (сбой площадки, свежесть);
  - сводка `compare-v1` в Telegram: расхождения пула — каждое объяснено (время между прогонами старого и нового синка, заказ в пути, возврат по новым правилам);
  - план записей `dry-run` по зеркалам: при выровненном старым синком остатке — единицы; массовые — разбор.
- [ ] Итог — таблица «сутки → совпадает/расходится/объяснено» в README `sync2` и в заметках плана 1.4. Решение о переключении принимает владелец.

---

## Готово, когда

- На VPS каждые 10 минут идёт `tick`, в `runs` видны `ingest`/`pool`, в `writes` — только `dry-run`/`off`, `applied = false`.
- Раз в сутки в Telegram приходит сводка сверки.
- Трое суток без необъяснённых расхождений; решение владельца о 1.4.
- Старый синк, его крон и `.env` не менялись; другие базы PostgreSQL не тронуты.
