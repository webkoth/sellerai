# Синк v2 · этап 1.1 — каркас: монорепо, база, журнал запусков, выключатель записи

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поставить в `sai_kotelnikovartifact/sync2/` пустой, но боевой по качеству каркас синка v2 — монорепо по правилам finstock с базой, журналом запусков, структурированным логом, выключателем записи и CLI, — на который этапы 1.2–1.4 кладут пул и адаптеры площадок.

**Architecture:** npm workspaces: `packages/shared` (площадки, режимы записи, конфиг), `packages/db` (схема Drizzle, миграции, клиент, хранилище журнала), `packages/platforms` (пока только `executeWrites` — единственный путь записи на площадки, через выключатель), `apps/worker` (лог pino, обёртка `withRun`, CLI). Слои и правила — как в `finstock/CLAUDE.md`. Сети и площадок в этом плане нет: результат проверяется тестами и CLI на локальной базе.

**Tech Stack:** TypeScript strict, Node 26 (локально), tsx, Vitest, PostgreSQL 18 (локально, Homebrew), Drizzle ORM + drizzle-kit, postgres.js, pino.

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md` (разделы 3, 4, 10).
**Решение:** `business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md`.

**Место этого плана в этапе 1:**
1.1 каркас (этот план) → 1.2 домен пула → 1.3 KIT и сайт (адаптеры, служебный API сайта, dry-run → запись, выкладка на VPS) → 1.4 WB, Ozon, ЯМ (адаптеры, сверка со старым `sync/`, переключение).

**Вне этого плана:** VPS (выкладка — в 1.3), деньги в копейках (появятся с ценами на этапе 2), любые запросы к площадкам.

---

## Карта файлов

```
sync2/
  package.json                  воркспейсы, скрипты
  tsconfig.base.json            строгий TS, как в finstock
  vitest.config.ts              псевдонимы @sync2/* на исходники
  .env.example                  DATABASE_URL, TEST_DATABASE_URL, SYNC_WRITE_MODE, LOG_LEVEL
  README.md                     как запустить, правила
  packages/shared/
    package.json, tsconfig.json
    src/channels.ts             CHANNELS, Channel, WRITE_MODES, WriteMode, parseWriteMode
    src/channels.test.ts
    src/config.ts               loadConfig(env)
    src/config.test.ts
    src/runs.ts                 RunStore, RunStart, RunFinish — тип журнала запусков
    src/index.ts
  packages/db/
    package.json, tsconfig.json
    drizzle.config.ts
    migrations/                 генерирует drizzle-kit
    src/schema.ts               таблицы этапа 1
    src/client.ts               createDb(url)
    src/channels-seed.ts        seedChannels(db) — идемпотентно, режим записи не сбрасывает
    src/run-store.ts            drizzleRunStore(db): RunStore
    src/test-db.ts              поднять чистую тестовую базу
    src/schema.db.test.ts       уникальные индексы и check-ограничения на живой базе
    src/channels-seed.db.test.ts
    src/run-store.db.test.ts
    src/index.ts
  packages/platforms/
    package.json, tsconfig.json
    src/writer.ts               effectiveMode, executeWrites — выключатель записи
    src/writer.test.ts
    src/index.ts
  apps/worker/
    package.json, tsconfig.json
    src/log.ts                  createLogger(level, dest?)
    src/log.test.ts
    src/run.ts                  RunStore, withRun
    src/run.test.ts
    src/cli.ts                  seed-channels | runs | ping
```

Интерфейс `RunStore` живёт в `packages/shared/src/runs.ts` (задача 9), а не рядом с `withRun`: иначе `packages/db` пришлось бы импортировать из `apps/worker`. Реализации — в `packages/db/src/run-store.ts` (живая) и в тесте worker (в памяти).

---

### Task 1: Монорепо и дымовой тест

**Files:**
- Create: `sync2/package.json`, `sync2/tsconfig.base.json`, `sync2/vitest.config.ts`, `sync2/.env.example`
- Create: `sync2/packages/shared/package.json`, `sync2/packages/shared/tsconfig.json`, `sync2/packages/shared/src/index.ts`
- Create: `sync2/packages/db/package.json`, `sync2/packages/db/tsconfig.json`
- Create: `sync2/packages/platforms/package.json`, `sync2/packages/platforms/tsconfig.json`
- Create: `sync2/apps/worker/package.json`, `sync2/apps/worker/tsconfig.json`
- Test: `sync2/packages/shared/src/smoke.test.ts` (удаляется в задаче 2)

- [ ] **Step 1: Корневой `package.json`**

`sync2/package.json`:
```json
{
  "name": "sync2",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.base.json",
    "test": "vitest run",
    "test:db": "vitest run --project db",
    "db:generate": "drizzle-kit generate --config packages/db/drizzle.config.ts",
    "db:migrate": "drizzle-kit migrate --config packages/db/drizzle.config.ts",
    "cli": "tsx --env-file=.env apps/worker/src/cli.ts"
  }
}
```

- [ ] **Step 2: `tsconfig.base.json` — копия finstock**

`sync2/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts", "packages/*/*.config.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "**/dist"]
}
```

- [ ] **Step 3: `vitest.config.ts` — два проекта: быстрые тесты и тесты на живой базе**

Тесты на базе (`*.db.test.ts`) идут отдельным проектом: они требуют локальный PostgreSQL и запускаются командой `npm run test:db`. `npm test` без базы гоняет только быстрые.

`sync2/vitest.config.ts`:
```ts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url))

// Пакеты воркспейса лежат в node_modules симлинком, а node_modules Vitest не
// преобразует. Псевдонимы прямо на исходники снимают вопрос целиком (как в finstock).
const alias = {
  "@sync2/shared": pkg("shared"),
  "@sync2/db": pkg("db"),
  "@sync2/platforms": pkg("platforms"),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.ts"],
          exclude: ["**/*.db.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["packages/**/src/**/*.db.test.ts"],
          environment: "node",
          // Тесты базы делят одну тестовую базу — параллельно нельзя.
          fileParallelism: false,
        },
      },
    ],
  },
})
```

`npm test` запускает оба проекта; проект `db` сам себя пропускает без `TEST_DATABASE_URL` (задача 5, `describe.skipIf`).

- [ ] **Step 4: `.env.example`**

`sync2/.env.example`:
```bash
# Рабочая база синка
DATABASE_URL=postgres://localhost:5432/sync2
# Тестовая база: тесты *.db.test.ts стирают её схему целиком — никогда не указывать рабочую
TEST_DATABASE_URL=postgres://localhost:5432/sync2_test
# Глобальный режим записи на площадки: off | dry-run | apply. По умолчанию off.
SYNC_WRITE_MODE=off
LOG_LEVEL=info
```

- [ ] **Step 5: Пакеты воркспейса**

`sync2/packages/shared/package.json`:
```json
{
  "name": "@sync2/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`sync2/packages/db/package.json`:
```json
{
  "name": "@sync2/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@sync2/shared": "*" }
}
```

`sync2/packages/platforms/package.json`:
```json
{
  "name": "@sync2/platforms",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@sync2/shared": "*" }
}
```

`sync2/apps/worker/package.json`:
```json
{
  "name": "@sync2/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": { "@sync2/shared": "*", "@sync2/db": "*", "@sync2/platforms": "*" }
}
```

В каждом из четырёх пакетов — `tsconfig.json` (для `packages/*` и `apps/*` путь одинаковый):
```json
{ "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`sync2/packages/shared/src/index.ts`:
```ts
export {}
```

- [ ] **Step 6: Установить зависимости**

Run (из `sync2/`):
```bash
cd sync2
npm install -D typescript vitest tsx @types/node drizzle-kit
npm install -w @sync2/db drizzle-orm postgres
npm install -w @sync2/worker pino
```
Expected: `node_modules/` создан, в `package-lock.json` есть `drizzle-orm`, `postgres`, `pino`, `vitest`.

- [ ] **Step 7: Дымовой тест**

`sync2/packages/shared/src/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest"

describe("каркас", () => {
  it("vitest видит пакеты воркспейса", async () => {
    const mod = await import("@sync2/shared")
    expect(mod).toBeTypeOf("object")
  })
})
```

Run: `npm test`
Expected: `unit` — 1 passed; `db` — no test files (не ошибка).

Run: `npm run typecheck`
Expected: без ошибок.

- [ ] **Step 8: Commit**

```bash
cd ..
git add sync2/package.json sync2/package-lock.json sync2/tsconfig.base.json sync2/vitest.config.ts sync2/.env.example sync2/packages sync2/apps
git commit -m "sync2: каркас монорепо по правилам finstock"
```

---

### Task 2: Площадки и режимы записи

Единый список площадок нужен в трёх местах: в коде, в check-ограничении базы и в сиде. Он живёт здесь, а схема строит ограничение из него же.

**Files:**
- Create: `sync2/packages/shared/src/channels.ts`
- Test: `sync2/packages/shared/src/channels.test.ts`
- Modify: `sync2/packages/shared/src/index.ts`
- Delete: `sync2/packages/shared/src/smoke.test.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/shared/src/channels.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { CHANNELS, CHANNEL_TITLES, WRITE_MODES, isChannel, parseWriteMode } from "./channels"

describe("площадки", () => {
  it("пять площадок, WB первым — он мастер", () => {
    expect(CHANNELS).toEqual(["wb", "ozon", "ym", "kit", "site"])
  })

  it("у каждой площадки есть название", () => {
    for (const c of CHANNELS) expect(CHANNEL_TITLES[c]).toMatch(/\S/)
  })

  it("isChannel отличает площадку от произвольной строки", () => {
    expect(isChannel("kit")).toBe(true)
    expect(isChannel("avito")).toBe(false)
  })
})

describe("режим записи", () => {
  it("три режима по возрастанию опасности", () => {
    expect(WRITE_MODES).toEqual(["off", "dry-run", "apply"])
  })

  it("пусто или undefined — берётся запасной режим", () => {
    expect(parseWriteMode(undefined, "off")).toBe("off")
    expect(parseWriteMode("", "dry-run")).toBe("dry-run")
  })

  it("регистр и пробелы не важны", () => {
    expect(parseWriteMode("  APPLY ", "off")).toBe("apply")
  })

  it("опечатка — ошибка, а не тихий off", () => {
    expect(() => parseWriteMode("aply", "off")).toThrow(/режим записи/)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `cd sync2 && npx vitest run packages/shared/src/channels.test.ts`
Expected: FAIL — `Failed to resolve import "./channels"`.

- [ ] **Step 3: Реализация**

`sync2/packages/shared/src/channels.ts`:
```ts
/** Площадки синка. WB — мастер остатка до перехода на finstock (решение 25.09.2026). */
export const CHANNELS = ["wb", "ozon", "ym", "kit", "site"] as const
export type Channel = (typeof CHANNELS)[number]

export const CHANNEL_TITLES: Record<Channel, string> = {
  wb: "Wildberries",
  ozon: "Ozon",
  ym: "Яндекс.Маркет",
  kit: "Яндекс KIT",
  site: "kotelnikovartifact.ru",
}

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value)
}

/**
 * Режим записи на площадки, по возрастанию опасности.
 * off — не отправлять и не делать вид; dry-run — посчитать и записать в журнал,
 * что было бы отправлено; apply — отправить.
 */
export const WRITE_MODES = ["off", "dry-run", "apply"] as const
export type WriteMode = (typeof WRITE_MODES)[number]

/**
 * Разбор режима из окружения. Опечатка — ошибка: молча превратить "aply" в off
 * значит оставить владельца в уверенности, что запись идёт.
 */
export function parseWriteMode(raw: string | undefined, fallback: WriteMode): WriteMode {
  const value = (raw ?? "").trim().toLowerCase()
  if (value === "") return fallback
  if ((WRITE_MODES as readonly string[]).includes(value)) return value as WriteMode
  throw new RangeError(`неизвестный режим записи: "${raw}" (ожидается ${WRITE_MODES.join(" | ")})`)
}
```

`sync2/packages/shared/src/index.ts`:
```ts
export * from "./channels"
```

Удалить `sync2/packages/shared/src/smoke.test.ts`.

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run packages/shared/src/channels.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A sync2/packages/shared
git commit -m "sync2: список площадок и режимы записи"
```

---

### Task 3: Конфиг из окружения

**Files:**
- Create: `sync2/packages/shared/src/config.ts`
- Test: `sync2/packages/shared/src/config.test.ts`
- Modify: `sync2/packages/shared/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/shared/src/config.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { loadConfig } from "./config"

const base = { DATABASE_URL: "postgres://localhost:5432/sync2" }

describe("loadConfig", () => {
  it("по умолчанию запись выключена, лог info", () => {
    expect(loadConfig(base)).toEqual({
      databaseUrl: "postgres://localhost:5432/sync2",
      writeMode: "off",
      logLevel: "info",
    })
  })

  it("берёт режим записи и уровень лога из окружения", () => {
    const c = loadConfig({ ...base, SYNC_WRITE_MODE: "dry-run", LOG_LEVEL: "debug" })
    expect(c.writeMode).toBe("dry-run")
    expect(c.logLevel).toBe("debug")
  })

  it("без DATABASE_URL — ошибка с понятным текстом", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/)
  })

  it("опечатка в режиме записи — ошибка", () => {
    expect(() => loadConfig({ ...base, SYNC_WRITE_MODE: "yes" })).toThrow(/режим записи/)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run packages/shared/src/config.test.ts`
Expected: FAIL — `Failed to resolve import "./config"`.

- [ ] **Step 3: Реализация**

`sync2/packages/shared/src/config.ts`:
```ts
import { parseWriteMode, type WriteMode } from "./channels"

export interface Config {
  databaseUrl: string
  /** Глобальный режим записи. Действующий режим площадки — меньший из этого и её собственного. */
  writeMode: WriteMode
  logLevel: string
}

/** Окружение передаётся параметром, а не читается из process.env: функция чистая и тестируется. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const databaseUrl = env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error("DATABASE_URL не задан — см. sync2/.env.example")
  return {
    databaseUrl,
    writeMode: parseWriteMode(env.SYNC_WRITE_MODE, "off"),
    logLevel: env.LOG_LEVEL?.trim() || "info",
  }
}
```

`sync2/packages/shared/src/index.ts`:
```ts
export * from "./channels"
export * from "./config"
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run packages/shared`
Expected: 11 passed.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/shared
git commit -m "sync2: конфиг из окружения, запись выключена по умолчанию"
```

---

### Task 4: Схема базы и первая миграция

Таблицы этапа 1 из спеки, раздел 4. Цены, прайс, решения на кнопках — на этапе 2, сюда не добавлять.

**Files:**
- Create: `sync2/packages/db/src/schema.ts`
- Create: `sync2/packages/db/src/client.ts`
- Create: `sync2/packages/db/src/index.ts`
- Create: `sync2/packages/db/drizzle.config.ts`
- Create: `sync2/packages/db/migrations/*` (генерирует drizzle-kit)

- [ ] **Step 1: Схема**

`sync2/packages/db/src/schema.ts`:
```ts
import { sql } from "drizzle-orm"
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { CHANNELS, WRITE_MODES } from "@sync2/shared"

/** 'a','b','c' для check-ограничения из закрытого списка — единый источник в @sync2/shared. */
const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "))

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" })

export const ORDER_LIFECYCLES = ["open", "shipped", "cancelled_before_ship", "returned"] as const
export const POOL_EVENT_KINDS = ["order", "cancel", "wb_signal", "cold_start", "manual"] as const
export const RUN_STATUSES = ["running", "ok", "partial", "failed"] as const
export const WRITE_FIELDS = ["stock", "price"] as const

/** Площадки. Режим записи площадки — второй ключ выключателя, рядом с глобальным SYNC_WRITE_MODE. */
export const channels = pgTable(
  "channels",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    writeMode: text("write_mode").notNull().default("off"),
    /** Склад площадки, куда пишется остаток: id склада WB/Ozon/ЯМ, склад KIT. */
    warehouseRef: text("warehouse_ref"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("channels_code_idx").on(t.code),
    check("channels_code_check", sql`${t.code} in (${inList(CHANNELS)})`),
    check("channels_write_mode_check", sql`${t.writeMode} in (${inList(WRITE_MODES)})`),
  ],
)

/** Товар. Ключ — баркод WB: он общий для всех площадок, артикул WB на Ozon/ЯМ совпадает с offer_id не везде. */
export const products = pgTable("products", {
  barcode: text("barcode").primaryKey(),
  vendorCode: text("vendor_code"),
  nmId: bigint("nm_id", { mode: "number" }),
  title: text("title").notNull().default(""),
  wbSubject: text("wb_subject"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})

/** Товар на площадке: чем он там называется и в каком состоянии. */
export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    barcode: text("barcode").notNull().references(() => products.barcode),
    /** offer_id Ozon/ЯМ, variant_id KIT, id товара сайта, chrtID WB. */
    externalId: text("external_id").notNull(),
    status: text("status").notNull().default("active"),
    contentHash: text("content_hash"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("listings_channel_barcode_idx").on(t.channelId, t.barcode)],
)

/** Сырой снимок остатков площадки. Только дописывается. */
export const stockSnapshotsRaw = pgTable(
  "stock_snapshots_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    takenAt: ts("taken_at").notNull(),
    runId: uuid("run_id").notNull(),
    /** [{ barcode, externalId, quantity }] — уже нормализованный адаптером вид. */
    stocks: jsonb("stocks").notNull(),
  },
  (t) => [uniqueIndex("stock_snapshots_channel_taken_idx").on(t.channelId, t.takenAt)],
)

/** Строка заказа любой площадки. Статус обновляется, строка не удаляется. */
export const ordersRaw = pgTable(
  "orders_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    externalId: text("external_id").notNull(),
    line: integer("line").notNull().default(0),
    barcode: text("barcode"),
    quantity: integer("quantity").notNull(),
    lifecycle: text("lifecycle").notNull(),
    occurredAt: ts("occurred_at").notNull(),
    raw: jsonb("raw").notNull(),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_raw_channel_ext_line_idx").on(t.channelId, t.externalId, t.line),
    index("orders_raw_barcode_idx").on(t.barcode),
    check("orders_raw_lifecycle_check", sql`${t.lifecycle} in (${inList(ORDER_LIFECYCLES)})`),
    check("orders_raw_quantity_check", sql`${t.quantity} > 0`),
  ],
)

/** Состояние пула на баркод — те же поля, что PoolItemState в finstock/packages/domain/src/pool.ts. */
export const poolItems = pgTable("pool_items", {
  barcode: text("barcode").primaryKey().references(() => products.barcode),
  base: integer("base").notNull(),
  wbExpected: integer("wb_expected").notNull(),
  expectedAt: ts("expected_at"),
  wbSnapshotAt: ts("wb_snapshot_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})

/** Журнал пула. Дубль события отсекает база, а не код. */
export const poolEvents = pgTable(
  "pool_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    barcode: text("barcode").notNull(),
    kind: text("kind").notNull(),
    delta: integer("delta").notNull(),
    baseBefore: integer("base_before").notNull(),
    baseAfter: integer("base_after").notNull(),
    channelId: integer("channel_id").references(() => channels.id),
    orderId: bigint("order_id", { mode: "number" }).references(() => ordersRaw.id),
    snapshotAt: ts("snapshot_at"),
    occurredAt: ts("occurred_at").notNull(),
    runId: uuid("run_id").notNull(),
    detail: jsonb("detail"),
  },
  (t) => [
    check("pool_events_kind_check", sql`${t.kind} in (${inList(POOL_EVENT_KINDS)})`),
    // Заказ списывается ровно один раз и отменяется ровно один раз.
    uniqueIndex("pool_events_order_kind_idx").on(t.orderId, t.kind).where(sql`${t.orderId} is not null`),
    // Один снимок WB даёт не больше одного сигнала на баркод.
    uniqueIndex("pool_events_snapshot_kind_idx")
      .on(t.barcode, t.kind, t.snapshotAt)
      .where(sql`${t.snapshotAt} is not null`),
  ],
)

/** Журнал запусков джоб. */
export const runs = pgTable(
  "runs",
  {
    runId: uuid("run_id").primaryKey(),
    job: text("job").notNull(),
    status: text("status").notNull(),
    writeMode: text("write_mode").notNull(),
    startedAt: ts("started_at").notNull(),
    finishedAt: ts("finished_at"),
    counters: jsonb("counters").notNull().default({}),
    error: text("error"),
  },
  (t) => [
    check("runs_status_check", sql`${t.status} in (${inList(RUN_STATUSES)})`),
    check("runs_write_mode_check", sql`${t.writeMode} in (${inList(WRITE_MODES)})`),
    index("runs_job_started_idx").on(t.job, t.startedAt),
  ],
)

/** Каждая запись на площадку — было → стало, режим, ответ. */
export const writes = pgTable(
  "writes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: uuid("run_id").notNull().references(() => runs.runId),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    barcode: text("barcode").notNull(),
    field: text("field").notNull(),
    before: integer("before"),
    after: integer("after").notNull(),
    mode: text("mode").notNull(),
    applied: boolean("applied").notNull(),
    response: jsonb("response"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("writes_run_channel_barcode_field_idx").on(t.runId, t.channelId, t.barcode, t.field),
    check("writes_field_check", sql`${t.field} in (${inList(WRITE_FIELDS)})`),
    check("writes_mode_check", sql`${t.mode} in (${inList(WRITE_MODES)})`),
  ],
)
```

- [ ] **Step 2: Клиент и индекс пакета**

`sync2/packages/db/src/client.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

/** Соединение передаётся явно: воркер берёт URL из loadConfig, тесты — из TEST_DATABASE_URL. */
export function createDb(url: string, opts: { max?: number } = {}) {
  const client = postgres(url, { max: opts.max ?? 5, onnotice: () => {} })
  return { db: drizzle(client, { schema }), close: () => client.end() }
}

export type Db = ReturnType<typeof createDb>["db"]
```

`sync2/packages/db/src/index.ts`:
```ts
export * from "./schema"
export * from "./client"
```

- [ ] **Step 3: Конфиг drizzle-kit**

`sync2/packages/db/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost:5432/sync2" },
})
```

- [ ] **Step 4: Сгенерировать миграцию**

Run (из `sync2/`): `npm run db:generate`
Expected: создан `packages/db/migrations/0000_*.sql` с `CREATE TABLE "channels"`, `"orders_raw"`, `"pool_events"`, `"runs"`, `"writes"` и с check-ограничениями вида `CHECK ("channels"."code" in ('wb', 'ozon', 'ym', 'kit', 'site'))`.

Открыть сгенерированный SQL и убедиться глазами: у `pool_events_order_kind_idx` есть `WHERE "pool_events"."order_id" is not null`. Если drizzle-kit импорт `@sync2/shared` не разрешил (ошибка `Cannot find module`), запустить `npm install` из `sync2/` ещё раз — пакет должен быть в `node_modules/@sync2/shared` симлинком.

- [ ] **Step 5: Создать локальные базы и применить миграцию**

Run:
```bash
createdb sync2 && createdb sync2_test
cp .env.example .env
npm run db:migrate
psql sync2 -c '\dt'
```
Expected: список из 9 таблиц: channels, listings, orders_raw, pool_events, pool_items, products, runs, stock_snapshots_raw, writes.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add sync2/packages/db
git commit -m "sync2: схема базы этапа 1 и первая миграция"
```

---

### Task 5: Тестовая база и проверка ограничений на живом PostgreSQL

Правило finstock: защита от дублей — индексами. Значит, индексы надо проверять на настоящей базе, а не моками.

**Files:**
- Create: `sync2/packages/db/src/test-db.ts`
- Test: `sync2/packages/db/src/schema.db.test.ts`

- [ ] **Step 1: Помощник тестовой базы**

`sync2/packages/db/src/test-db.ts`:
```ts
import { fileURLToPath } from "node:url"
import { sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { createDb } from "./client"

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url))

/**
 * Чистая тестовая база: схема public стирается целиком и накатывается миграциями.
 * Защита от ошибки конфигурации: имя базы обязано заканчиваться на _test.
 */
export async function freshTestDb() {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL не задан")
  const name = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "")
  if (!name.endsWith("_test")) throw new Error(`тестовая база должна оканчиваться на _test, а не "${name}"`)
  const handle = createDb(TEST_DATABASE_URL, { max: 1 })
  await handle.db.execute(sql`drop schema if exists public cascade`)
  await handle.db.execute(sql`drop schema if exists drizzle cascade`)
  await handle.db.execute(sql`create schema public`)
  await migrate(handle.db, { migrationsFolder })
  return handle
}

/**
 * Ждёт, что запрос нарушит ограничение `name`. Drizzle 0.44+ оборачивает ошибку базы
 * в DrizzleQueryError («Failed query: …»), а исходная ошибка postgres.js — в `cause`,
 * с полем `constraint_name`. Поэтому `.rejects.toThrow(/имя/)` здесь не работает.
 */
export async function expectConstraint(query: PromiseLike<unknown>, name: string): Promise<void> {
  const err = await Promise.resolve(query).then(
    () => null,
    (e: unknown) => e,
  )
  if (err === null) throw new Error(`ожидалось нарушение ${name}, но запрос прошёл`)
  const cause = ((err as { cause?: unknown }).cause ?? err) as { constraint_name?: string; message?: string }
  const text = `${cause.constraint_name ?? ""} ${cause.message ?? ""}`
  if (!text.includes(name)) throw new Error(`ожидалось нарушение ${name}, получено: ${text}`)
}
```

- [ ] **Step 2: Тест ограничений**

`sync2/packages/db/src/schema.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { channels, ordersRaw, poolEvents, products } from "./schema"
import { TEST_DATABASE_URL, expectConstraint, freshTestDb } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("ограничения схемы на живой базе", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let kitId: number

  beforeAll(async () => {
    h = await freshTestDb()
    const [kit] = await h.db.insert(channels).values({ code: "kit", title: "Яндекс KIT" }).returning()
    kitId = kit!.id
    await h.db.insert(products).values({ barcode: "2041383032873", title: "Браслет" })
  })
  afterAll(async () => h?.close())

  const order = (externalId: string) => ({
    channelId: kitId,
    externalId,
    barcode: "2041383032873",
    quantity: 1,
    lifecycle: "open",
    occurredAt: "2026-09-26T10:00:00Z",
    raw: {},
  })

  it("неизвестная площадка не проходит check", async () => {
    await expectConstraint(h.db.insert(channels).values({ code: "avito", title: "Авито" }), "channels_code_check")
  })

  it("неизвестный режим записи не проходит check", async () => {
    await expectConstraint(
      h.db.insert(channels).values({ code: "ym", title: "ЯМ", writeMode: "yes" }),
      "channels_write_mode_check",
    )
  })

  it("одна и та же строка заказа не записывается дважды", async () => {
    await h.db.insert(ordersRaw).values(order("KIT-1"))
    await expectConstraint(h.db.insert(ordersRaw).values(order("KIT-1")), "orders_raw_channel_ext_line_idx")
  })

  it("неизвестный статус заказа не проходит check", async () => {
    await expectConstraint(
      h.db.insert(ordersRaw).values({ ...order("KIT-2"), lifecycle: "lost" }),
      "orders_raw_lifecycle_check",
    )
  })

  it("заказ списывается из пула ровно один раз", async () => {
    const [o] = await h.db.insert(ordersRaw).values(order("KIT-3")).returning()
    const ev = {
      barcode: "2041383032873",
      kind: "order",
      delta: -1,
      baseBefore: 2,
      baseAfter: 1,
      channelId: kitId,
      orderId: o!.id,
      occurredAt: "2026-09-26T10:00:00Z",
      runId: "00000000-0000-4000-8000-000000000001",
    }
    await h.db.insert(poolEvents).values(ev)
    await expectConstraint(h.db.insert(poolEvents).values(ev), "pool_events_order_kind_idx")
  })

  it("ручные события без заказа не упираются в индекс заказа", async () => {
    const manual = {
      barcode: "2041383032873",
      kind: "manual",
      delta: 1,
      baseBefore: 1,
      baseAfter: 2,
      occurredAt: "2026-09-26T11:00:00Z",
      runId: "00000000-0000-4000-8000-000000000002",
    }
    await h.db.insert(poolEvents).values(manual)
    await h.db.insert(poolEvents).values(manual)
  })
})
```

- [ ] **Step 3: Запустить**

Run: `TEST_DATABASE_URL=postgres://localhost:5432/sync2_test npx vitest run --project db`
Expected: 6 passed.

Run: `npx vitest run --project db` (без переменной)
Expected: 6 skipped, не failed.

Если `expectConstraint` пишет «получено: …» с другим именем — сверить имя в `schema.ts` с именем в сгенерированной миграции: drizzle-kit берёт имена индексов и ограничений из схемы как есть.

- [ ] **Step 4: Прописать переменную для `test:db`**

В `sync2/package.json` заменить скрипт:
```json
"test:db": "TEST_DATABASE_URL=${TEST_DATABASE_URL:-postgres://localhost:5432/sync2_test} vitest run --project db"
```

Run: `npm run test:db`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/db/src/test-db.ts sync2/packages/db/src/schema.db.test.ts sync2/package.json
git commit -m "sync2: ограничения схемы проверены на живой базе"
```

---

### Task 6: Сид площадок — идемпотентный и не сбрасывающий режим записи

Повторный сид не имеет права вернуть площадку из `apply` в `off` или наоборот: режим записи меняет только человек.

**Files:**
- Create: `sync2/packages/db/src/channels-seed.ts`
- Test: `sync2/packages/db/src/channels-seed.db.test.ts`
- Modify: `sync2/packages/db/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/db/src/channels-seed.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { CHANNELS } from "@sync2/shared"
import { seedChannels } from "./channels-seed"
import { channels } from "./schema"
import { TEST_DATABASE_URL, freshTestDb } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("seedChannels", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  it("заводит пять площадок с выключенной записью", async () => {
    await seedChannels(h.db)
    const rows = await h.db.select().from(channels)
    expect(rows.map((r) => r.code).sort()).toEqual([...CHANNELS].sort())
    expect(rows.every((r) => r.writeMode === "off")).toBe(true)
  })

  it("повторный сид не дублирует и не сбрасывает режим записи", async () => {
    await h.db.update(channels).set({ writeMode: "apply" }).where(eq(channels.code, "kit"))
    await seedChannels(h.db)
    const rows = await h.db.select().from(channels)
    expect(rows).toHaveLength(5)
    expect(rows.find((r) => r.code === "kit")?.writeMode).toBe("apply")
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npm run test:db -- packages/db/src/channels-seed.db.test.ts`
Expected: FAIL — `Failed to resolve import "./channels-seed"`.

- [ ] **Step 3: Реализация**

`sync2/packages/db/src/channels-seed.ts`:
```ts
import { sql } from "drizzle-orm"
import { CHANNELS, CHANNEL_TITLES } from "@sync2/shared"
import type { Db } from "./client"
import { channels } from "./schema"

/** Заводит недостающие площадки. Название обновляет, режим записи и склад — никогда. */
export async function seedChannels(db: Db): Promise<void> {
  await db
    .insert(channels)
    .values(CHANNELS.map((code) => ({ code, title: CHANNEL_TITLES[code] })))
    .onConflictDoUpdate({ target: channels.code, set: { title: sql`excluded.title` } })
}
```

В `sync2/packages/db/src/index.ts` добавить строку:
```ts
export * from "./channels-seed"
```

- [ ] **Step 4: Запустить — проходит**

Run: `npm run test:db`
Expected: 8 passed (6 из задачи 5 + 2).

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/db/src
git commit -m "sync2: сид площадок, режим записи не сбрасывается"
```

---

### Task 7: Выключатель записи — единственный путь на площадку

Правило finstock: выключатель подключается и покрывается тестом до первой пишущей функции. Любой адаптер этапов 1.3–1.4 пишет только через `executeWrites`, отдавая ему `send`.

**Files:**
- Create: `sync2/packages/platforms/src/writer.ts`
- Test: `sync2/packages/platforms/src/writer.test.ts`
- Create: `sync2/packages/platforms/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/platforms/src/writer.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest"
import type { Channel, WriteMode } from "@sync2/shared"
import { effectiveMode, executeWrites, type SendResult, type WriteOp, type WriteOutcome } from "./writer"

const allModes = (mode: WriteMode): Record<Channel, WriteMode> => ({
  wb: mode,
  ozon: mode,
  ym: mode,
  kit: mode,
  site: mode,
})

const op = (channel: Channel, barcode: string, after: number): WriteOp => ({
  channel,
  barcode,
  field: "stock",
  before: 0,
  after,
})

const okSender = () =>
  vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> =>
    ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true, response: { accepted: true } })),
  )

async function run(ops: WriteOp[], globalMode: WriteMode, channelModes: Record<Channel, WriteMode>, send = okSender()) {
  const recorded: WriteOutcome[] = []
  const outcomes = await executeWrites(ops, {
    globalMode,
    channelModes,
    send,
    record: async (o) => {
      recorded.push(...o)
    },
  })
  return { outcomes, recorded, send }
}

describe("effectiveMode", () => {
  it("берётся меньший из глобального и площадки", () => {
    expect(effectiveMode("apply", "off")).toBe("off")
    expect(effectiveMode("off", "apply")).toBe("off")
    expect(effectiveMode("apply", "dry-run")).toBe("dry-run")
    expect(effectiveMode("apply", "apply")).toBe("apply")
  })
})

describe("executeWrites", () => {
  it("off: ни одного сетевого вызова, всё записано как неприменённое", async () => {
    const { outcomes, recorded, send } = await run([op("kit", "A", 1)], "off", allModes("apply"))
    expect(send).not.toHaveBeenCalled()
    expect(outcomes).toEqual(recorded)
    expect(outcomes[0]).toMatchObject({ mode: "off", applied: false, error: null })
  })

  it("dry-run: ни одного сетевого вызова, режим dry-run в журнале", async () => {
    const { outcomes, send } = await run([op("kit", "A", 1)], "dry-run", allModes("apply"))
    expect(send).not.toHaveBeenCalled()
    expect(outcomes[0]).toMatchObject({ mode: "dry-run", applied: false })
  })

  it("apply глобально, но площадка off — эта площадка не трогается", async () => {
    const modes = { ...allModes("apply"), ozon: "off" as const }
    const { outcomes, send } = await run([op("kit", "A", 1), op("ozon", "A", 1)], "apply", modes)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toBe("kit")
    expect(outcomes.find((o) => o.channel === "ozon")).toMatchObject({ mode: "off", applied: false })
    expect(outcomes.find((o) => o.channel === "kit")).toMatchObject({ mode: "apply", applied: true })
  })

  it("apply: один вызов на площадку со всеми её операциями", async () => {
    const { send } = await run([op("kit", "A", 1), op("kit", "B", 2), op("site", "A", 1)], "apply", allModes("apply"))
    expect(send).toHaveBeenCalledTimes(2)
    const kitCall = send.mock.calls.find((c) => c[0] === "kit")!
    expect(kitCall[1].map((o) => o.barcode)).toEqual(["A", "B"])
  })

  it("площадка ответила отказом по позиции — applied=false с текстом ошибки", async () => {
    const send = vi.fn(async (): Promise<SendResult[]> => [
      { barcode: "A", field: "stock", ok: false, error: "товар на модерации" },
    ])
    const { outcomes } = await run([op("kit", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes[0]).toMatchObject({ applied: false, error: "товар на модерации" })
  })

  it("площадка не вернула результат по позиции — это ошибка, а не успех", async () => {
    const send = vi.fn(async (): Promise<SendResult[]> => [])
    const { outcomes } = await run([op("kit", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes[0]).toMatchObject({ applied: false, error: "площадка не вернула результат по позиции" })
  })

  it("вызов площадки упал — все её позиции с ошибкой, другие площадки пишутся", async () => {
    const send = vi.fn(async (channel: Channel, ops: WriteOp[]): Promise<SendResult[]> => {
      if (channel === "kit") throw new Error("ECONNRESET")
      return ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true }))
    })
    const { outcomes } = await run([op("kit", "A", 1), op("site", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes.find((o) => o.channel === "kit")).toMatchObject({ applied: false, error: "ECONNRESET" })
    expect(outcomes.find((o) => o.channel === "site")).toMatchObject({ applied: true })
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run packages/platforms`
Expected: FAIL — `Failed to resolve import "./writer"`.

- [ ] **Step 3: Реализация**

`sync2/packages/platforms/src/writer.ts`:
```ts
import { WRITE_MODES, type Channel, type WriteMode } from "@sync2/shared"

/** Одна запись на площадку: поле товара было → станет. */
export interface WriteOp {
  channel: Channel
  barcode: string
  field: "stock" | "price"
  before: number | null
  after: number
}

/** Ответ площадки по одной позиции. Адаптер обязан вернуть по строке на каждую отправленную. */
export interface SendResult {
  barcode: string
  field: WriteOp["field"]
  ok: boolean
  response?: unknown
  error?: string
}

/** Сетевой вызов площадки. Передаётся адаптером; сам выключатель в сеть не ходит. */
export type Sender = (channel: Channel, ops: WriteOp[]) => Promise<SendResult[]>

export interface WriteOutcome extends WriteOp {
  mode: WriteMode
  applied: boolean
  response: unknown
  error: string | null
}

export interface WriteDeps {
  globalMode: WriteMode
  channelModes: Record<Channel, WriteMode>
  send: Sender
  /** Запись итогов в журнал `writes`. Вызывается один раз, со всеми позициями, в любом режиме. */
  record: (outcomes: WriteOutcome[]) => Promise<void>
}

const rank = (m: WriteMode) => WRITE_MODES.indexOf(m)

/** Действует меньший из двух ключей: глобального SYNC_WRITE_MODE и режима площадки в таблице channels. */
export function effectiveMode(global: WriteMode, channel: WriteMode): WriteMode {
  return rank(global) <= rank(channel) ? global : channel
}

/**
 * Единственный путь записи на площадки. В off и dry-run сеть не трогается вовсе —
 * это проверено тестом и не должно обходиться ни одним адаптером.
 */
export async function executeWrites(ops: WriteOp[], deps: WriteDeps): Promise<WriteOutcome[]> {
  const byChannel = new Map<Channel, WriteOp[]>()
  for (const o of ops) byChannel.set(o.channel, [...(byChannel.get(o.channel) ?? []), o])

  const outcomes: WriteOutcome[] = []
  for (const [channel, channelOps] of byChannel) {
    const mode = effectiveMode(deps.globalMode, deps.channelModes[channel])
    if (mode !== "apply") {
      for (const o of channelOps) outcomes.push({ ...o, mode, applied: false, response: null, error: null })
      continue
    }
    let results: SendResult[]
    try {
      results = await deps.send(channel, channelOps)
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e)
      for (const o of channelOps) outcomes.push({ ...o, mode, applied: false, response: null, error })
      continue
    }
    const key = (barcode: string, field: string) => `${barcode}\u0000${field}`
    const byKey = new Map(results.map((r) => [key(r.barcode, r.field), r]))
    for (const o of channelOps) {
      const r = byKey.get(key(o.barcode, o.field))
      if (!r) {
        outcomes.push({ ...o, mode, applied: false, response: null, error: "площадка не вернула результат по позиции" })
      } else {
        outcomes.push({ ...o, mode, applied: r.ok, response: r.response ?? null, error: r.ok ? null : (r.error ?? "отказ без текста") })
      }
    }
  }
  await deps.record(outcomes)
  return outcomes
}
```

`sync2/packages/platforms/src/index.ts`:
```ts
export * from "./writer"
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run packages/platforms`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/platforms
git commit -m "sync2: выключатель записи — в off и dry-run сеть не трогается"
```

---

### Task 8: Структурированный лог

**Files:**
- Create: `sync2/apps/worker/src/log.ts`
- Test: `sync2/apps/worker/src/log.test.ts`

- [ ] **Step 1: Падающий тест**

`sync2/apps/worker/src/log.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { createLogger } from "./log"

function capture() {
  const lines: string[] = []
  return { lines, dest: { write: (s: string) => void lines.push(s) } }
}

describe("createLogger", () => {
  it("пишет JSON с приложением, run_id, сообщением и ISO-временем", () => {
    const { lines, dest } = capture()
    createLogger("info", dest).child({ run_id: "r-1", job: "ping" }).info({ written: 3 }, "готово")
    const rec = JSON.parse(lines[0]!)
    expect(rec).toMatchObject({ app: "sync2", run_id: "r-1", job: "ping", written: 3, msg: "готово", level: 30 })
    expect(rec.time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("уровень отсекает мелкие записи", () => {
    const { lines, dest } = capture()
    const log = createLogger("warn", dest)
    log.info("не должно попасть")
    log.warn("должно")
    expect(lines).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npx vitest run apps/worker/src/log.test.ts`
Expected: FAIL — `Failed to resolve import "./log"`.

- [ ] **Step 3: Реализация**

`sync2/apps/worker/src/log.ts`:
```ts
import pino, { type DestinationStream, type Logger } from "pino"

export type { Logger }

/** JSON-лог. У каждого запуска — child с run_id и job (см. withRun). */
export function createLogger(level: string, dest?: DestinationStream): Logger {
  const opts = { level, base: { app: "sync2" }, timestamp: pino.stdTimeFunctions.isoTime }
  return dest ? pino(opts, dest) : pino(opts)
}
```

- [ ] **Step 4: Запустить — проходит**

Run: `npx vitest run apps/worker/src/log.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add sync2/apps/worker/src/log.ts sync2/apps/worker/src/log.test.ts
git commit -m "sync2: JSON-лог pino"
```

---

### Task 9: Журнал запусков — `withRun`

Урок finstock (`apps/worker/src/lib/run-log.ts`): запуск джобы и закрывающая запись — в раздельных try/catch. Сбой записи журнала после успешной джобы не должен превращать успех в провал.

**Files:**
- Create: `sync2/packages/shared/src/runs.ts`
- Modify: `sync2/packages/shared/src/index.ts`
- Create: `sync2/apps/worker/src/run.ts`
- Test: `sync2/apps/worker/src/run.test.ts`

- [ ] **Step 1: Тип хранилища — в shared, чтобы db не зависел от worker**

`sync2/packages/shared/src/runs.ts`:
```ts
import type { WriteMode } from "./channels"

export type RunStatus = "running" | "ok" | "partial" | "failed"

export interface RunStart {
  runId: string
  job: string
  writeMode: WriteMode
  startedAt: string
}

export interface RunFinish {
  status: Exclude<RunStatus, "running">
  finishedAt: string
  counters: Record<string, number>
  error: string | null
}

export interface RunStore {
  start(run: RunStart): Promise<void>
  finish(runId: string, result: RunFinish): Promise<void>
}
```

`sync2/packages/shared/src/index.ts`:
```ts
export * from "./channels"
export * from "./config"
export * from "./runs"
```

- [ ] **Step 2: Падающий тест**

`sync2/apps/worker/src/run.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { RunFinish, RunStart, RunStore } from "@sync2/shared"
import { createLogger } from "./log"
import { withRun } from "./run"

function memoryStore(opts: { failFinish?: boolean } = {}) {
  const started: RunStart[] = []
  const finished: Array<{ runId: string } & RunFinish> = []
  const store: RunStore = {
    start: async (r) => void started.push(r),
    finish: async (runId, r) => {
      if (opts.failFinish) throw new Error("соединение с базой потеряно")
      finished.push({ runId, ...r })
    },
  }
  return { store, started, finished }
}

const lines: string[] = []
const log = createLogger("debug", { write: (s: string) => void lines.push(s) })
const deps = (store: RunStore) => ({
  store,
  log,
  writeMode: "dry-run" as const,
  now: () => new Date("2026-09-26T10:00:00Z"),
  newId: () => "00000000-0000-4000-8000-00000000000a",
})

describe("withRun", () => {
  it("успех: start, затем finish ok со счётчиками", async () => {
    const m = memoryStore()
    const r = await withRun("ping", deps(m.store), async () => ({ counters: { read: 5 } }))
    expect(r).toEqual({ runId: "00000000-0000-4000-8000-00000000000a", status: "ok", counters: { read: 5 }, error: null })
    expect(m.started[0]).toMatchObject({ job: "ping", writeMode: "dry-run", startedAt: "2026-09-26T10:00:00.000Z" })
    expect(m.finished[0]).toMatchObject({ status: "ok", counters: { read: 5 }, error: null })
  })

  it("джоба сама говорит partial — так и записывается", async () => {
    const m = memoryStore()
    const r = await withRun("stocks", deps(m.store), async () => ({ status: "partial", counters: { skipped: 2 } }))
    expect(r.status).toBe("partial")
    expect(m.finished[0]!.status).toBe("partial")
  })

  it("джоба упала — failed с текстом, исключение наружу не летит", async () => {
    const m = memoryStore()
    const r = await withRun("orders", deps(m.store), async () => {
      throw new Error("429 от Ozon")
    })
    expect(r).toMatchObject({ status: "failed", error: "429 от Ozon" })
    expect(m.finished[0]).toMatchObject({ status: "failed", error: "429 от Ozon", counters: {} })
  })

  it("сбой закрывающей записи не превращает успех в провал", async () => {
    const m = memoryStore({ failFinish: true })
    const r = await withRun("ping", deps(m.store), async () => ({ counters: { read: 1 } }))
    expect(r.status).toBe("ok")
    expect(lines.some((l) => l.includes("не удалось закрыть запись журнала"))).toBe(true)
  })

  it("контекст джобы несёт run_id и лог с run_id", async () => {
    const m = memoryStore()
    let seen = ""
    await withRun("ping", deps(m.store), async (ctx) => {
      seen = ctx.runId
      ctx.log.info("внутри")
      return { counters: {} }
    })
    expect(seen).toBe("00000000-0000-4000-8000-00000000000a")
    const inner = lines.map((l) => JSON.parse(l)).find((x) => x.msg === "внутри")
    expect(inner).toMatchObject({ run_id: seen, job: "ping" })
  })
})
```

- [ ] **Step 3: Запустить — падает**

Run: `npx vitest run apps/worker/src/run.test.ts`
Expected: FAIL — `Failed to resolve import "./run"`.

- [ ] **Step 4: Реализация**

`sync2/apps/worker/src/run.ts`:
```ts
import { randomUUID } from "node:crypto"
import type { RunStatus, RunStore, WriteMode } from "@sync2/shared"
import type { Logger } from "./log"

export interface RunContext {
  runId: string
  log: Logger
}

export interface JobResult {
  /** Не указано — ok. partial — джоба что-то пропустила; путать с ok нельзя. */
  status?: "ok" | "partial"
  counters: Record<string, number>
}

export interface RunDeps {
  store: RunStore
  log: Logger
  writeMode: WriteMode
  now?: () => Date
  newId?: () => string
}

export interface RunOutcome {
  runId: string
  status: Exclude<RunStatus, "running">
  counters: Record<string, number>
  error: string | null
}

/**
 * Оборачивает джобу записью в журнал `runs`. Сбой джобы не роняет процесс: он
 * записывается как failed. Запуск и закрывающая запись — в раздельных try/catch:
 * сбой записи журнала после успешной джобы не должен переписать успех в провал
 * (урок finstock, apps/worker/src/lib/run-log.ts).
 */
export async function withRun(
  job: string,
  deps: RunDeps,
  fn: (ctx: RunContext) => Promise<JobResult>,
): Promise<RunOutcome> {
  const now = deps.now ?? (() => new Date())
  const runId = (deps.newId ?? randomUUID)()
  const log = deps.log.child({ run_id: runId, job })

  await deps.store.start({ runId, job, writeMode: deps.writeMode, startedAt: now().toISOString() })
  log.info({ writeMode: deps.writeMode }, "старт")

  let outcome: RunOutcome
  try {
    const result = await fn({ runId, log })
    outcome = { runId, status: result.status ?? "ok", counters: result.counters, error: null }
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e)
    log.error({ err: e }, "джоба упала")
    outcome = { runId, status: "failed", counters: {}, error }
  }

  try {
    await deps.store.finish(runId, {
      status: outcome.status,
      finishedAt: now().toISOString(),
      counters: outcome.counters,
      error: outcome.error,
    })
  } catch (e: unknown) {
    log.error({ err: e }, "не удалось закрыть запись журнала")
  }
  log.info({ status: outcome.status, counters: outcome.counters }, "финиш")
  return outcome
}
```

- [ ] **Step 5: Запустить — проходит**

Run: `npx vitest run apps/worker`
Expected: 7 passed (2 лога + 5 withRun).

- [ ] **Step 6: Commit**

```bash
git add sync2/packages/shared/src sync2/apps/worker/src/run.ts sync2/apps/worker/src/run.test.ts
git commit -m "sync2: журнал запусков withRun, сбой журнала не портит успех"
```

---

### Task 10: Хранилище журнала на базе

**Files:**
- Create: `sync2/packages/db/src/run-store.ts`
- Test: `sync2/packages/db/src/run-store.db.test.ts`
- Modify: `sync2/packages/db/src/index.ts`

- [ ] **Step 1: Падающий тест**

`sync2/packages/db/src/run-store.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { drizzleRunStore } from "./run-store"
import { runs } from "./schema"
import { TEST_DATABASE_URL, freshTestDb } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("drizzleRunStore", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  const runId = "00000000-0000-4000-8000-0000000000b1"

  it("start пишет running, finish закрывает", async () => {
    const store = drizzleRunStore(h.db)
    await store.start({ runId, job: "ping", writeMode: "off", startedAt: "2026-09-26T10:00:00.000Z" })
    let [row] = await h.db.select().from(runs).where(eq(runs.runId, runId))
    expect(row).toMatchObject({ job: "ping", status: "running", writeMode: "off", finishedAt: null })

    await store.finish(runId, {
      status: "partial",
      finishedAt: "2026-09-26T10:00:05.000Z",
      counters: { read: 3, skipped: 1 },
      error: null,
    })
    ;[row] = await h.db.select().from(runs).where(eq(runs.runId, runId))
    expect(row).toMatchObject({ status: "partial", counters: { read: 3, skipped: 1 }, error: null })
    expect(row!.finishedAt).not.toBeNull()
  })

  it("finish по несуществующему запуску — ошибка, а не тихий ноль строк", async () => {
    const store = drizzleRunStore(h.db)
    await expect(
      store.finish("00000000-0000-4000-8000-0000000000ff", {
        status: "ok",
        finishedAt: "2026-09-26T10:00:05.000Z",
        counters: {},
        error: null,
      }),
    ).rejects.toThrow(/не найден/)
  })
})
```

- [ ] **Step 2: Запустить — падает**

Run: `npm run test:db -- packages/db/src/run-store.db.test.ts`
Expected: FAIL — `Failed to resolve import "./run-store"`.

- [ ] **Step 3: Реализация**

`sync2/packages/db/src/run-store.ts`:
```ts
import { eq } from "drizzle-orm"
import type { RunStore } from "@sync2/shared"
import type { Db } from "./client"
import { runs } from "./schema"

export function drizzleRunStore(db: Db): RunStore {
  return {
    async start(r) {
      await db.insert(runs).values({ ...r, status: "running" })
    },
    async finish(runId, r) {
      const updated = await db.update(runs).set(r).where(eq(runs.runId, runId)).returning({ runId: runs.runId })
      if (updated.length === 0) throw new Error(`запуск ${runId} не найден в журнале`)
    },
  }
}
```

В `sync2/packages/db/src/index.ts` добавить:
```ts
export * from "./run-store"
```

- [ ] **Step 4: Запустить — проходит**

Run: `npm run test:db`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add sync2/packages/db/src
git commit -m "sync2: журнал запусков в базе"
```

---

### Task 11: CLI — `seed-channels`, `runs`, `ping`

`ping` — сквозная проверка проводки: конфиг → база → withRun → журнал, без площадок.

**Files:**
- Create: `sync2/apps/worker/src/cli.ts`

- [ ] **Step 1: Реализация**

`sync2/apps/worker/src/cli.ts`:
```ts
import { desc } from "drizzle-orm"
import { createDb, drizzleRunStore, runs, seedChannels } from "@sync2/db"
import { loadConfig } from "@sync2/shared"
import { createLogger } from "./log"
import { withRun } from "./run"

const USAGE = `sync2 <команда>
  seed-channels   завести пять площадок (режим записи не трогается)
  runs [N]        последние N запусков (по умолчанию 20)
  ping            пустая джоба: проверка конфига, базы и журнала`

async function main(argv: string[]): Promise<number> {
  const [cmd, arg] = argv
  if (!cmd || cmd === "help") {
    console.log(USAGE)
    return cmd ? 0 : 2
  }
  const config = loadConfig(process.env)
  const log = createLogger(config.logLevel)
  const { db, close } = createDb(config.databaseUrl)
  try {
    switch (cmd) {
      case "seed-channels":
        await seedChannels(db)
        log.info("площадки заведены")
        return 0
      case "runs": {
        const limit = Number(arg ?? 20)
        const rows = await db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit)
        for (const r of rows) {
          console.log([r.startedAt, r.job, r.status, r.writeMode, JSON.stringify(r.counters), r.error ?? ""].join("\t"))
        }
        return 0
      }
      case "ping": {
        const out = await withRun("ping", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (ctx) => {
          ctx.log.info("pong")
          return { counters: {} }
        })
        return out.status === "failed" ? 1 : 0
      }
      default:
        console.error(`неизвестная команда: ${cmd}\n\n${USAGE}`)
        return 2
    }
  } finally {
    await close()
  }
}

process.exitCode = await main(process.argv.slice(2))
```

- [ ] **Step 2: Проверить вживую на локальной базе**

Run (из `sync2/`, `.env` из задачи 4):
```bash
npm run cli -- seed-channels
npm run cli -- ping
npm run cli -- runs 5
psql sync2 -c "select code, write_mode from channels order by id"
```
Expected:
- `seed-channels` — строка лога `"msg":"площадки заведены"`;
- `ping` — три строки лога с одним `run_id`: `старт`, `pong`, `финиш` со `"status":"ok"`; код выхода 0;
- `runs 5` — строка `…	ping	ok	off	{}	`;
- `psql` — пять строк `wb|off`, `ozon|off`, `ym|off`, `kit|off`, `site|off`.

- [ ] **Step 3: Typecheck и все тесты**

Run:
```bash
npm run typecheck
npm test
npm run test:db
```
Expected: typecheck без ошибок; `unit` — 26 passed (7 + 4 + 8 + 2 + 5); `db` — 10 passed.

- [ ] **Step 4: Commit**

```bash
git add sync2/apps/worker/src/cli.ts
git commit -m "sync2: CLI seed-channels, runs, ping"
```

---

### Task 12: README каркаса

**Files:**
- Create: `sync2/README.md`

- [ ] **Step 1: README**

`sync2/README.md`:
````markdown
# sync2 — синк остатков, цен и карточек на пять площадок

Спека: `../docs/superpowers/specs/2026-09-25-sync-v2-design.md`.
Решение: `business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md`.
Пишется по правилам finstock (`~/projects/finstock/CLAUDE.md`) и позже переносится туда копированием папок.

## Запуск локально

```bash
cd sync2
npm install
createdb sync2 && createdb sync2_test
cp .env.example .env
npm run db:migrate
npm run cli -- seed-channels
npm run cli -- ping
```

## Проверки

```bash
npm run typecheck
npm test          # быстрые тесты; тесты базы пропускаются без TEST_DATABASE_URL
npm run test:db   # тесты на живой базе sync2_test (схема стирается!)
```

## Правила

- Слои: площадка → адаптер (`packages/platforms`) → сырьё (только дописывается) → домен (чистый) → действие.
- Запись на площадку — только через `executeWrites` (`packages/platforms/src/writer.ts`).
  Действует меньший из двух режимов: `SYNC_WRITE_MODE` и `channels.write_mode`. По умолчанию оба `off`.
- Защита от дублей — уникальными индексами, не проверками в коде.
- Каждая джоба — внутри `withRun`: журнал `runs`, лог с `run_id`.
- Изменение схемы: правка `packages/db/src/schema.ts` → `npm run db:generate` → миграция в git.
````

- [ ] **Step 2: Commit**

```bash
git add sync2/README.md
git commit -m "sync2: README каркаса"
```

---

## Готово, когда

- `npm run typecheck`, `npm test` (26 passed), `npm run test:db` (10 passed) — зелёные.
- `npm run cli -- ping` пишет в `runs` строку `ok`, лог — JSON с одним `run_id`.
- В `channels` пять площадок, все `write_mode = off`.
- Ни одной строки кода, которая ходит в сеть площадок.

## Следующий план

План 1.2 «домен пула» (`docs/superpowers/plans/`, пишется после приёмки этого) — перенос `reconcilePool` из `finstock/packages/domain/src/pool.ts` с тестами, жизненный цикл заказа (`cancelled_before_ship` / `returned`), цели по площадкам.
