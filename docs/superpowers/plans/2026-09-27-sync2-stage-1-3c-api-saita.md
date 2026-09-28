# Синк v2 · этап 1.3c — служебный API сайта и сайт пятой площадкой в dry-run

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать сайту kotelnikovartifact.ru закрытый служебный API для `sync2` (заказы сайта со штрихкодом WB, снимок остатка витрины, запись остатка пула в отдельную таблицу) и подключить сайт пятой площадкой к `ingest`/`pool` на VPS в режиме «считает, не пишет». Витрина на проде не меняется ни на байт (`STOCK_SOURCE=wb`); переключение витрины на остаток пула — этап 1.4. Приёмка — двое суток `dry-run` с сайтом в пуле и объяснённой сверкой «остаток витрины (source wb) ↔ пул».

**Architecture:** В репозитории сайта — миграция `010` (таблица `pool_stocks`, колонка `order_items.barcode` с разовым бэкфиллом, индекс по `orders.created_at`), модуль `lib/stock-source.ts` (единственное место, где остаток размера считается из `pool_stocks`, пересчёт агрегата товара из пула, снимок остатка для сверки, запись пула) и переключатель `STOCK_SOURCE=wb|pool`, через который идут все читатели остатка размера и оба синка WB. Три роута под `app/api/internal/` за общим `lib/internal-auth.ts` (Bearer, сравнение SHA-256 через `timingSafeEqual`). В `sync2` — адаптер `packages/platforms/src/site/` по контракту `ChannelAdapter` (как KIT), необязательная площадка в конфиге (подключается только при `SITE_API_TOKEN`), отдельный план записей сайта в `pool` со своими предохранителями и строка «Сайт ↔ пул» в сводке `compare-v1`. Запись на сайт (`putSiteStocks`) написана, но к `pool` не подключена — отправитель остаётся `noSender`.

**Tech Stack:**
- Сайт: Next.js 16.2.6 App Router (Route Handlers), React 19, TypeScript strict с `target: ES2017` (в коде и тестах — `BigInt(7)`, не литерал `7n`), Drizzle 0.45 + postgres-js, zod 4.4, Vitest 4 (jsdom, `tests/setup.ts`), Prettier (без `;`, двойные кавычки, `printWidth: 80`, `trailingComma: es5`). Миграции — ручные идемпотентные SQL в `scripts/migrations/`, `scripts/migrate.ts` прогоняет **все** файлы на каждой выкладке.
- `sync2`: как в 1.1–1.3b (TS strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, Vitest, JSON-фикстуры через `with { type: "json" }`).

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md` §5 (строка «Сайт» в таблице адаптеров, абзац «Сайт»), §12 (статусы сайта). **Контракт адаптеров** — `sync2/packages/platforms/src/adapter.ts` и конец `docs/superpowers/plans/2026-09-26-sync2-stage-1-2-domen-pula.md`. **Образец адаптера** — `sync2/packages/platforms/src/kit/`. **Предыдущий этап** — `docs/superpowers/plans/2026-09-27-sync2-stage-1-3b-dry-run-na-vps.md`.

---

## Репозитории, ветки, проверки

| Задачи | Репозиторий | Ветка | Проверки перед коммитом |
|---|---|---|---|
| 0 | — (прод-сервер сайта, только чтение) | — | — |
| 1–7 | `/Users/minas/projects/kotelnikovartifact` (GitHub `webkoth/kotelnikovartifact-store`) | `feat/internal-sync-api` от `main` | `npm run lint && npm run typecheck && npm test` |
| 8–10 | `/Users/minas/projects/sai_kotelnikovartifact`, worktree `/Users/minas/projects/sai_kotelnikovartifact-1-3c` | `sync2-stage-1-3c` от `main` | `cd sync2 && npm run typecheck && npm test && npm run test:db` |
| 11 | оба + серверы 201.34.133.76 (сайт) и 147.45.171.40 (sync2) | — | по шагам, каждый внешний шаг — только с «да» владельца |

Подготовка сайта (один раз, перед Task 1):
```bash
cd /Users/minas/projects/kotelnikovartifact
git switch main && git pull --ff-only && git switch -c feat/internal-sync-api
```

Подготовка sync2 (один раз, перед Task 8):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git worktree add ../sai_kotelnikovartifact-1-3c -b sync2-stage-1-3c main
cd ../sai_kotelnikovartifact-1-3c/sync2 && npx -y npm@11.16.0 ci
```

**Слияние с `main` сайта = автодеплой на прод** (GitHub Actions → ssh → `scripts/deploy.sh`). Ни `git push`, ни PR, ни merge в задачах 1–7 не делаются — только в Task 11 с «да» владельца.

---

## Решения этапа

1. **Два писателя остатка не допускаются.** Таблица `pool_stocks (barcode varchar(50) PK, quantity int NOT NULL CHECK >= 0, updated_at timestamptz NOT NULL DEFAULT now())` — её пишет только `sync2` (`PUT /api/internal/stocks`). Переключатель `STOCK_SOURCE = wb | pool` (по умолчанию `wb`):
   - `wb` — витрина как сейчас: остаток размера — `SUM(wb_stock_items.quantity)`, агрегат `wb_products.stocks`/`is_visible` пишут `syncStocks` и `upsertProduct`. Код wb-веток не меняется.
   - `pool` — остаток размера — `SUM(pool_stocks.quantity)` по штрихкодам размера; агрегат товара пересчитывает только `lib/stock-source.ts` (`recalcProductStocksFromPool`) — после `PUT` и после записи размеров карточки; `syncStocks`/`sync-products` продолжают писать `wb_stock_items` и размеры, но `stocks`/`is_visible` не трогают. Новая карточка в `pool` входит с `stocks = 0, is_visible = false` и сразу пересчитывается из пула.
   - Читатели остатка (найдены grep-ом по `wb_stock_items|wbStockItems|stocks|is_visible|isVisible`): остаток **размера** — `getProductSizes`, `getSizesForProducts` (`lib/db/queries/sizes.ts`; ими пользуются страница товара, каталог, быстрый просмотр и проверка продажи сверх остатка в `createOrder`) — переводятся на переключатель; агрегат **товара** — `buildConditions`/`listProducts`/карусели (`lib/db/queries/products.ts`), страница товара (`product.stocks`), `lib/blocks/adapters.ts` (`toStock`), `lib/wb/sync/translations.ts` (`gt(stocks, 0)`), `createOrder` для позиции без размера (`product.stocks`) — читают колонку `wb_products.stocks`/`is_visible`, у которой в каждом режиме ровно один писатель, поэтому не меняются. Писатели агрегата — `recalcProductVisibility` (`lib/wb/sync/stocks.ts`) и `upsertProduct` (`lib/wb/sync/upsert-product.ts`) — гейтятся переключателем.
   - На проде в 1.3c `STOCK_SOURCE=wb`; `PUT` в режиме `wb` только наполняет `pool_stocks` (готовим данные к 1.4).
2. **Штрихкод в позиции заказа.** Миграция `010`: `order_items.barcode varchar(50)` NULL + бэкфилл, индекс `idx_orders_created_at`. Правило (одно для SQL-бэкфилла и для `createOrder` — чистая функция `pickLineBarcode` в `lib/order-barcode.ts`): у позиции есть размер — размер товара с этим `tech_size_name`; размера нет — единственный размер товара (у товара без выбора размера это строка-заглушка `"0"`), размеров несколько — `NULL`; у размера несколько штрихкодов — минимальный по байтам (`min(sku COLLATE "C")` в SQL, `<` над строками в TS). Позиция без штрихкода отдаётся API как `barcode: null` — `sync2` считает её в `ordersNoBarcode`.
   - **Отступление: бэкфилл выполняется ровно один раз** — в одном `DO`-блоке с `ADD COLUMN`, под проверкой «колонки ещё нет». Причина: `scripts/migrate.ts` прогоняет все миграции на каждой выкладке, и повторный `UPDATE … WHERE barcode IS NULL` задним числом приписывал бы штрихкод позициям, которые `createOrder` сознательно оставил без него (неоднозначный размер), — `sync2` списал бы такой заказ поздно и неожиданно. Цена: заказ, созданный старым кодом в окне «миграция → `pm2 reload`» (минуты сборки), останется без штрихкода и будет виден в `ordersNoBarcode`.
3. **Время.** `orders.created_at` — `TIMESTAMP` без пояса с `DEFAULT now()` (`002-orders.sql`): значение — часы в поясе сессии БД. Клиент postgres-js пояс не задаёт (`lib/db/client.ts`), `TZ` в PM2 нет (`ecosystem.config.cjs`), `now()` считает база, а не Node, — действует настройка сервера PostgreSQL. По коду: прод-база — `Etc/UTC`, локальная — `Europe/Moscow` (проверено 2026-09-03, комментарий в `lib/notifications.ts`, `resendPendingNotifications`). Константа `ORDERS_DB_TIME_ZONE = "UTC"` в `lib/internal-orders.ts` с этим обоснованием и тестом; преобразование — в SQL: `to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` — результат не зависит от пояса сессии (проверено на локальной базе в `Europe/Moscow`: `TIMESTAMP '2026-09-27 07:53:00.123456'` → `2026-09-27T07:53:00.123Z`). Комментарию полуторанедельной давности на слово не верим: **Task 0 перепроверяет пояс на проде до кода**; другой пояс — другая константа. Известное следствие: на локальной базе (`Europe/Moscow`) `createdAt` из API сдвинут на 3 часа — касается только разработки.
4. **API** (`app/api/internal/…`, `export const runtime = "nodejs"`, `export const dynamic = "force-dynamic"`, ответы с `cache-control: no-store`):
   - Авторизация `Authorization: Bearer <INTERNAL_API_TOKEN>`, общий `lib/internal-auth.ts`: схема `Bearer` без учёта регистра, сравнение `timingSafeEqual(sha256(got), sha256(expected))` — токен другой длины не роняет сравнение. Нет или неверный токен → `401` с пустым телом.
   - **Отступление: `INTERNAL_API_TOKEN` не входит в кэшируемую `serverSchema`**, а читается функцией `getInternalApiToken()` в `lib/env.ts` на каждый вызов (zod `min(32)`). Причина: `getServerEnv()` нужен заказам, уведомлениям и ревалидации — забытый или короткий токен служебного API не должен ронять весь сайт. Токен не задан или короче 32 символов → `503 {"error":"unavailable"}` + `console.error` (служебный API закрыт, витрина работает). Так же, без кэша, читается `STOCK_SOURCE` (`getStockSource()`); опечатка в нём — ошибка с именем переменной при чтении остатка, а не тихий `wb`.
   - `GET /api/internal/orders?since=<ISO>` — `since` обязателен (`z.iso.datetime({ offset: true })`), окно не больше 90 дней → иначе `400`; заказы с `created_at >= since` по возрастанию `id`, лимит 1000 + `truncated`. Ответ `{ orders: [{ id: string, number, status, createdAt, items: [{ lineId: string, barcode: string | null, quantity, priceKopecks }] }], truncated }`. Имя, телефон, адрес, способы связи, заметки не выбираются из базы вовсе (тест на текст SQL).
   - `GET /api/internal/stocks` — `{ source: "wb" | "pool", items: [{ barcode, quantity }] }` по **всем** штрихкодам каталога сайта (`wb_product_skus`), нули включены. В `pool` — `pool_stocks.quantity` штрихкода (нет строки — 0). **Уточнение для `wb`:** сайт хранит остаток на размер, а не на штрихкод, поэтому остаток размера отдаётся на его минимальный штрихкод (то же правило, что в п. 2), остальные штрихкоды размера — 0: сумма по штрихкодам размера равна тому, что видит витрина. Локально размеров с несколькими штрихкодами 0 (проверено 27.09); Task 0 проверяет прод.
   - `PUT /api/internal/stocks` — `{ items: [{ barcode, quantity: int >= 0 }] }`, 1..5000, дубли → `400 duplicate_barcodes`. Upsert абсолютных значений в `pool_stocks` одной транзакцией; неизвестные сайту штрихкоды (нет в `wb_product_skus`) не пишутся и возвращаются в `unknown`. Ответ `{ updated, unknown, source }` (**`source` — добавка к ответу**: `sync2` видит, повлияла ли запись на витрину). `pool` — после записи пересчёт `stocks`/`is_visible` затронутых товаров и `revalidate("/catalog")`; `wb` — только запись в таблицу.
   - Next 16.2.6 (прочитано по требованию `AGENTS.md`: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `03-api-reference/03-file-conventions/route.md`, `…/02-route-segment-config/index.md`, `03-api-reference/04-functions/revalidatePath.md`): обработчики — `export async function GET/PUT(request: Request)`; не-GET не кэшируется никогда, GET — только с `force-static`; неподдерживаемый метод → 405 и `OPTIONS` Next делает сам; `dynamic` запрещён только при `cacheComponents` — в `next.config.ts` его нет, поэтому `dynamic = "force-dynamic"` оставляем, как в соседних роутах; из файла `route.ts` экспортируются только обработчики и конфиг сегмента (схемы zod — внутри файла, не экспортом). `revalidatePath` в Route Handler только помечает путь, ревалидация — при следующем заходе; вызываем общий хелпер `revalidate("/catalog")` (`lib/wb/sync/revalidate.ts`, тот же путь, что у синков WB, в тестах — no-op), а не `revalidatePath` напрямую.
5. **sync2.**
   - `packages/platforms/src/site/` — `client.ts` (через общий `requestJson`, `Authorization: Bearer`), `lifecycle.ts` (`new` → `open`, любой другой статус → `returned`), `mapper.ts` (снимок: строка на штрихкод сайта, нули включены, штрихкод проверяется по каталогу WB через `resolveWbBarcode`, как у KIT; заказы: `externalId = "<id заказа>:<lineId>"`, позиция без штрихкода или с чужим штрихкодом — `barcode: null`), `adapter.ts` (`createSiteAdapter(config, wbIndex)`; `fetchStocks` дополнительно отдаёт `source`). `putSiteStocks` — для 1.4, пачками по 5000, в `pool` не подключается.
   - **Отступление: `truncated: true` — ошибка адаптера**, а не постраничное чтение: неполный список заказов синк не отличил бы от полного, а окно `ingest` — 60 дней при единицах заказов в неделю. Ошибка делает `ingest` `partial` с текстом в `runs.error`.
   - Конфиг: `SITE_API_URL` (по умолчанию `https://kotelnikovartifact.ru`, только `https`, кроме `localhost`/`127.0.0.1` — токен уходит в заголовке), `SITE_API_TOKEN` (не короче 32). Без токена сайт не подключается нигде: ни в `ingest`, ни в `probe` (`probe` печатает «пропущен»). `channels.write_mode` сайта остаётся `off`.
   - **Отступление: сайт планируется в `pool` отдельным вызовом `planStockWrites`** со своими пределами (120 изменений / 20 в ноль). Остаток витрины в 1.3c — WB с отставанием до 3 часов (синк сайта раз в 3 часа), расхождения с пулом там обычны; в общем вызове баркоды сайта считались бы вместе с Ozon/ЯМ/KIT, и сайт мог бы отклонить план всех зеркал. Отказ плана сайта — счётчик `siteAborted_<причина>`, `partial` с текстом; план зеркал при этом записывается. Строки плана сайта попадают в `writes` с `mode = 'off'` (режим площадки) — **это и есть расхождение витрины с пулом**; в сводке `compare-v1` — отдельная строка «Сайт ↔ пул за сутки» (`plannedWritesSince(db, since, ["off"])`), прежняя строка плана зеркал считает только `dry-run`, как и раньше.
   - Заказы сайта в режиме WB `external`: старый синк заказов сайта не знает и WB за них не списывает. Пул вычтет заказ сайта, а через `WB_SETTLE_MINUTES` сигнал WB вернёт единицу, если владелец не снял её на WB руками, — так и должно быть в `dry-run` (WB — физика). В 1.4, когда WB пишет `sync2`, заказ сайта уйдёт на WB сам.
6. **Выкладка** — Task 11, каждый внешний шаг только с «да» владельца; токен генерируется на сервере сайта и между серверами не печатается.

---

## Карта файлов

```
kotelnikovartifact/                                  (ветка feat/internal-sync-api)
  scripts/migrations/010-internal-sync-api.sql       pool_stocks, order_items.barcode + разовый бэкфилл, idx_orders_created_at
  lib/db/schema.ts                                   + poolStocks, orderItems.barcode
  lib/db/client.ts                                   + тип Selectable
  lib/env.ts                                         + getStockSource, getInternalApiToken
  lib/stock-source.ts                                остаток из pool_stocks: размеры, снимок, пересчёт агрегата, запись
  lib/order-barcode.ts                               pickLineBarcode, groupSkusBySize (чистые)
  lib/db/queries/sizes.ts                            pool-ветки getProductSizes/getSizesForProducts, getSkusBySizeForProducts
  lib/wb/sync/stocks.ts                              recalcProductVisibility — только в wb
  lib/wb/sync/upsert-product.ts                      агрегат — только в wb; в pool пересчёт из пула
  lib/orders.ts                                      createOrder пишет order_items.barcode
  lib/internal-auth.ts                               isValidBearer, requireInternalAuth
  lib/internal-orders.ts                             ORDERS_DB_TIME_ZONE, запросы и сборка ленты заказов
  app/api/internal/orders/route.ts                   GET
  app/api/internal/stocks/route.ts                   GET, PUT
  .env.example, tests/setup.ts                       STOCK_SOURCE, INTERNAL_API_TOKEN
  tests/unit/migrations/010-internal-sync-api.test.ts
  tests/unit/lib/env-sync.test.ts
  tests/unit/lib/stock-source.test.ts
  tests/unit/lib/db/sizes-source.test.ts
  tests/unit/lib/wb/sync/stocks.test.ts              + режим pool
  tests/unit/lib/wb/sync/upsert-product.test.ts      + режим pool
  tests/unit/lib/order-barcode.test.ts
  tests/unit/lib/orders-create.test.ts
  tests/unit/lib/internal-auth.test.ts
  tests/unit/lib/internal-orders.test.ts
  tests/unit/internal-orders-route.test.ts
  tests/unit/internal-stocks-route.test.ts

sai_kotelnikovartifact-1-3c/sync2/                   (ветка sync2-stage-1-3c)
  packages/platforms/src/site/
    client.ts lifecycle.ts mapper.ts adapter.ts      + lifecycle.test.ts mapper.test.ts adapter.test.ts
    fixtures/orders-sample.json fixtures/stocks-sample.json
  packages/platforms/src/index.ts                    + экспорт сайта
  packages/db/src/runs-query.ts (+db test)           plannedWritesSince(…, modes)
  apps/worker/src/channels-config.ts (+test)         site: SITE_API_URL / SITE_API_TOKEN
  apps/worker/src/adapters.ts (+adapters.test.ts)    сайт в зеркалах ingest
  apps/worker/src/cli.ts                             probe умеет сайт
  apps/worker/src/jobs/pool.ts (+db test)            отдельный план сайта
  apps/worker/src/jobs/compare-v1.ts (+test)         строка «Сайт ↔ пул»
  .env.example, README.md
```

---

### Task 0: Проверка на проде до кода — пояс базы, размеры, связность (только чтение)

**Где:** сервер сайта 201.34.133.76 (выполняет владелец, либо мы по ssh, если он даст доступ и «да»), VPS sync2 147.45.171.40 (ssh разрешён). Ничего не меняет.

- [ ] **Step 1: Пояс базы и формы данных на проде.** На сервере сайта:
```bash
cd /var/www/kotelnika-store && set -a && . ./.env && set +a && psql "$DATABASE_URL" -X -A -F ' | ' \
  -c "SHOW TimeZone" \
  -c "SELECT now()::timestamp AS db_local_now, (now() AT TIME ZONE 'UTC') AS utc_now" \
  -c "SELECT number, created_at, notified_at FROM orders ORDER BY id DESC LIMIT 3" \
  -c "SELECT count(*) AS sizes_multi_barcode FROM (SELECT size_id FROM wb_product_skus GROUP BY size_id HAVING count(*) > 1) t" \
  -c "SELECT count(*) AS products_multi_size FROM (SELECT product_id FROM wb_product_sizes GROUP BY product_id HAVING count(*) > 1) t" \
  -c "SELECT count(*) AS lines, count(*) FILTER (WHERE size IS NULL) AS lines_without_size FROM order_items" \
  -c "SELECT count(*) AS products_stock_mismatch FROM wb_products p WHERE p.stocks <> coalesce((SELECT sum(si.quantity) FROM wb_product_sizes s JOIN wb_stock_items si ON si.size_id = s.id WHERE s.product_id = p.id), 0)"
```
(Персональных данных в выводе нет: номер заказа и время. Если `psql` не находится — `sudo -u postgres psql -d kotelnikovartifact` с теми же `-c`.)

- [ ] **Step 2: Сверить время последнего заказа с Telegram.** Владелец открывает в группе заказов сообщение о последнем заказе из вывода Step 1 и сравнивает время сообщения (МСК в клиенте) с `created_at`.
  Правило решения:
  - `TimeZone` = `Etc/UTC` или `UTC`, `db_local_now = utc_now`, `created_at` ≈ время сообщения − 3 ч → `ORDERS_DB_TIME_ZONE = "UTC"` (как в плане);
  - `TimeZone` = `Europe/Moscow`, `created_at` ≈ время сообщения → в Task 6 константа `"Europe/Moscow"`, тест и комментарий — под неё;
  - иначе (время не сходится ни с одним вариантом) — стоп, разбор с владельцем до Task 6.
  - `sizes_multi_barcode > 0` — правило «остаток размера на минимальный штрихкод» (Решения, п. 4) затрагивает эти размеры; перечислить их в отчёте (`SELECT size_id, array_agg(sku) FROM wb_product_skus GROUP BY size_id HAVING count(*) > 1`).
  - `products_stock_mismatch` — сколько товаров сейчас расходятся «агрегат против суммы размеров» (ожидание — 0 или единицы в окне между синками); не блокирует этап, но объясняет расхождения при сверке в Task 11.

- [ ] **Step 3: Связность VPS sync2 → сайт.**
```bash
ssh root@147.45.171.40 'curl -s -o /dev/null -w "%{http_code}\n" https://kotelnikovartifact.ru/api/health'
```
Expected: `200`. Не `200` — стоп: `sync2` до сайта не достанет, решать до выкладки (сеть/файрвол).

- [ ] **Step 4: Записать итог** в конец этого плана разделом «Ход выполнения» (TimeZone, решение по константе, числа из Step 1, код из Step 3) и закоммитить в `main` репозитория `sai_kotelnikovartifact` только этот файл:
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add docs/superpowers/plans/2026-09-27-sync2-stage-1-3c-api-saita.md
git commit -m "План 1.3c: проверка пояса базы сайта на проде" -- docs/superpowers/plans/2026-09-27-sync2-stage-1-3c-api-saita.md
```

---

### Task 1: Миграция 010 и схема Drizzle

**Репозиторий:** сайт, ветка `feat/internal-sync-api`.

**Files:**
- Create: `scripts/migrations/010-internal-sync-api.sql`, `tests/unit/migrations/010-internal-sync-api.test.ts`
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Падающий тест** `tests/unit/migrations/010-internal-sync-api.test.ts`:
```ts
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { getTableConfig } from "drizzle-orm/pg-core"
import { orderItems, poolStocks } from "@/lib/db/schema"

/**
 * scripts/migrate.ts прогоняет ВСЕ миграции на каждой выкладке, поэтому 010
 * обязана быть идемпотентной, а бэкфилл штрихкодов — разовым (см. комментарий
 * в самом файле). Текст миграции проверяется здесь, схема drizzle — рядом:
 * базы в юнит-тестах нет, а расхождение схемы с миграцией ловится только так.
 */
const sqlText = readFileSync(
  path.resolve(process.cwd(), "scripts/migrations/010-internal-sync-api.sql"),
  "utf8"
)

describe("миграция 010 — служебный API синка v2", () => {
  it("идемпотентна: таблица и индекс через IF NOT EXISTS", () => {
    expect(sqlText).toContain("CREATE TABLE IF NOT EXISTS pool_stocks")
    expect(sqlText).toContain(
      "CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at)"
    )
    expect(sqlText).toContain(
      "CONSTRAINT pool_stocks_quantity_check CHECK (quantity >= 0)"
    )
  })

  it("бэкфилл — в одном DO-блоке с ADD COLUMN, под проверкой «колонки ещё нет»", () => {
    const start = sqlText.indexOf("DO $$")
    const end = sqlText.indexOf("$$;", start)
    const block = sqlText.slice(start, end)
    expect(start).toBeGreaterThan(-1)
    expect(block).toMatch(
      /IF NOT EXISTS \(\s*SELECT 1 FROM information_schema\.columns/
    )
    expect(block).toContain("ALTER TABLE order_items ADD COLUMN barcode")
    expect(block).toContain("UPDATE order_items")
    // Вне блока колонку не добавляют и не бэкфиллят — иначе повтор на каждой выкладке.
    const outside = sqlText.slice(0, start) + sqlText.slice(end)
    expect(outside).not.toContain("UPDATE order_items")
  })

  it("минимальный штрихкод размера — по байтам, как сравнение строк в TS", () => {
    expect(sqlText).toContain('min(sk.sku COLLATE "C")')
  })

  it("схема drizzle совпадает с миграцией", () => {
    const pool = getTableConfig(poolStocks)
    expect(pool.name).toBe("pool_stocks")
    expect(pool.columns.map((c) => [c.name, c.getSQLType()])).toEqual([
      ["barcode", "varchar(50)"],
      ["quantity", "integer"],
      ["updated_at", "timestamp with time zone"],
    ])
    expect(pool.checks.map((c) => c.name)).toEqual([
      "pool_stocks_quantity_check",
    ])
    const barcode = getTableConfig(orderItems).columns.find(
      (c) => c.name === "barcode"
    )
    expect(barcode?.getSQLType()).toBe("varchar(50)")
    expect(barcode?.notNull).toBe(false)
  })
})
```
Run: `npx vitest run tests/unit/migrations/010-internal-sync-api.test.ts` → FAIL (нет файла миграции и `poolStocks`).

- [ ] **Step 2: Миграция** `scripts/migrations/010-internal-sync-api.sql`:
```sql
-- Синк v2, этап 1.3c: служебный API сайта для sync2
-- (GET /api/internal/orders, GET/PUT /api/internal/stocks).

-- 1. pool_stocks — остаток на штрихкод WB, который пишет ТОЛЬКО sync2
--    (PUT /api/internal/stocks). Витрина читает его лишь при STOCK_SOURCE=pool
--    (lib/env.ts, lib/stock-source.ts); до этапа 1.4 на проде стоит wb, и
--    таблица только наполняется. Синк WB сюда не пишет никогда: два писателя
--    одного остатка не допускаются.
CREATE TABLE IF NOT EXISTS pool_stocks (
  barcode VARCHAR(50) PRIMARY KEY,
  quantity INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pool_stocks_quantity_check CHECK (quantity >= 0)
);

-- 2. order_items.barcode — штрихкод WB позиции: по нему sync2 списывает заказ
--    сайта из общего пула. Новые позиции пишет createOrder (lib/order-barcode.ts,
--    pickLineBarcode), старые — бэкфилл ниже тем же правилом:
--    - у позиции есть размер — размер товара с этим tech_size_name;
--    - размера нет — единственный размер товара (у товара без выбора размера
--      это строка-заглушка «0»); размеров несколько — неоднозначно, NULL;
--    - у размера несколько штрихкодов — минимальный по байтам (COLLATE "C"):
--      так же сравнивает строки TS, правило детерминировано.
--    Бэкфилл — в одном блоке с ADD COLUMN, то есть ровно один раз:
--    scripts/migrate.ts прогоняет все миграции на каждой выкладке, и повторный
--    бэкфилл задним числом приписал бы штрихкод позициям, которые createOrder
--    сознательно оставил без него, — sync2 списал бы их поздно и неожиданно.
--    Цена: заказ, созданный старым кодом между миграцией и перезапуском PM2
--    (минуты сборки), останется без штрихкода — в sync2 это ordersNoBarcode.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'order_items'
      AND column_name = 'barcode'
  ) THEN
    ALTER TABLE order_items ADD COLUMN barcode VARCHAR(50);

    UPDATE order_items oi
    SET barcode = (
      SELECT min(sk.sku COLLATE "C")
      FROM wb_product_sizes s
      JOIN wb_product_skus sk ON sk.size_id = s.id
      WHERE s.product_id = oi.wb_product_id
        AND CASE
          WHEN oi.size IS NOT NULL THEN s.tech_size_name = oi.size
          ELSE (
            SELECT count(*) FROM wb_product_sizes s2
            WHERE s2.product_id = oi.wb_product_id
          ) = 1
        END
    );
  END IF;
END
$$;

-- 3. Окно заказов для GET /api/internal/orders?since= — по created_at.
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
```

- [ ] **Step 3: Схема.** В `lib/db/schema.ts`, в `orderItems`, после поля `size: varchar({ length: 255 }),` добавить:
```ts
    // Штрихкод WB позиции (синк v2, этап 1.3c): по нему sync2 списывает заказ
    // сайта из общего пула — см. lib/order-barcode.ts и
    // scripts/migrations/010. NULL — позицию нельзя однозначно свести к
    // размеру (несколько размеров без выбранного) или у размера нет
    // штрихкода; sync2 считает такие позиции отдельно (ordersNoBarcode).
    barcode: varchar({ length: 50 }),
```
В конец файла:
```ts
// Остаток на штрихкод WB из общего пула синка v2 (этап 1.3c). Пишет только
// sync2 через PUT /api/internal/stocks; витрина читает таблицу лишь при
// STOCK_SOURCE=pool (lib/stock-source.ts). См. scripts/migrations/010.
export const poolStocks = pgTable(
  "pool_stocks",
  {
    barcode: varchar({ length: 50 }).primaryKey().notNull(),
    quantity: integer().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("pool_stocks_quantity_check", sql`${table.quantity} >= 0`),
  ]
)
```
Run: `npx vitest run tests/unit/migrations/010-internal-sync-api.test.ts` → 4 passed.

- [ ] **Step 4: Миграция на локальной базе — дважды подряд** (вторая проверяет идемпотентность):
```bash
cd /Users/minas/projects/kotelnikovartifact
npm run db:migrate && npm run db:migrate
DB=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')
psql "$DB" -X -A -F ' | ' \
  -c "\d pool_stocks" \
  -c "SELECT oi.id, oi.wb_product_id, oi.size, oi.barcode, (SELECT count(*) FROM wb_product_sizes s WHERE s.product_id = oi.wb_product_id) AS sizes FROM order_items oi" \
  -c "SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_created_at'"
```
Expected: обе прогонки — `Done: applied 10 migration file(s).`; `pool_stocks` с `pool_stocks_quantity_check`; у каждой строки `order_items` `barcode` заполнен, если `size` задан или `sizes = 1`, и `NULL` иначе (сверить глазами по выводу); индекс найден.

- [ ] **Step 5: Проверки и коммит.**
```bash
npx prettier --write lib/db/schema.ts tests/unit/migrations/010-internal-sync-api.test.ts
npm run lint && npm run typecheck && npm test
git add scripts/migrations/010-internal-sync-api.sql lib/db/schema.ts tests/unit/migrations/010-internal-sync-api.test.ts
git commit -m "feat(sync-api): миграция 010 — pool_stocks, штрихкод позиции заказа, индекс по времени заказа"
```

---

### Task 2: Переключатель источника остатка и модуль `lib/stock-source.ts`

**Репозиторий:** сайт, ветка `feat/internal-sync-api`.

**Files:**
- Modify: `lib/env.ts`, `lib/db/client.ts`, `.env.example`
- Create: `lib/stock-source.ts`, `tests/unit/lib/env-sync.test.ts`, `tests/unit/lib/stock-source.test.ts`

- [ ] **Step 1: Падающий тест переключателя** `tests/unit/lib/env-sync.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { getStockSource } from "@/lib/env"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("getStockSource", () => {
  it("пусто — wb: по умолчанию витрина не меняется", () => {
    vi.stubEnv("STOCK_SOURCE", "")
    expect(getStockSource()).toBe("wb")
  })

  it("читается на каждый вызов, без кэша", () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    expect(getStockSource()).toBe("pool")
    vi.stubEnv("STOCK_SOURCE", "wb")
    expect(getStockSource()).toBe("wb")
  })

  it("опечатка — ошибка с именем переменной, а не тихий wb", () => {
    vi.stubEnv("STOCK_SOURCE", "pol")
    expect(() => getStockSource()).toThrow(/STOCK_SOURCE/)
  })
})
```
Run: `npx vitest run tests/unit/lib/env-sync.test.ts` → FAIL (нет `getStockSource`).

- [ ] **Step 2: Переключатель.** В конец `lib/env.ts`:
```ts
/**
 * Источник остатка витрины (синк v2, этап 1.3c):
 * - `wb` — как было: остаток размера из wb_stock_items, агрегат товара
 *   (`wb_products.stocks`/`is_visible`) пишут синки WB;
 * - `pool` — остаток размера из pool_stocks (пишет только sync2 через
 *   PUT /api/internal/stocks), агрегат пересчитывает lib/stock-source.ts,
 *   синки WB пишут wb_stock_items и размеры, но агрегат не трогают.
 *
 * Не в serverSchema и без кэша: читается на каждый вызов, чтобы тесты
 * переключали его через vi.stubEnv, а опечатка ломала только чтение остатка
 * с понятной ошибкой, а не весь getServerEnv (заказы, уведомления).
 */
export const STOCK_SOURCES = ["wb", "pool"] as const
export type StockSource = (typeof STOCK_SOURCES)[number]

export function getStockSource(): StockSource {
  const raw = process.env.STOCK_SOURCE?.trim() ?? ""
  if (raw === "") return "wb"
  if ((STOCK_SOURCES as readonly string[]).includes(raw)) {
    return raw as StockSource
  }
  throw new Error(
    `STOCK_SOURCE: "${raw}" — ожидается ${STOCK_SOURCES.join(" | ")}`
  )
}
```
Run → 3 passed.

- [ ] **Step 3: Тип для построителей запросов.** В `lib/db/client.ts` после `export type DB = typeof db`:
```ts

/**
 * Всё, что нужно построителям запросов (`…Query(dbx, …)`): и настоящая база,
 * и `drizzle.mock({ schema })` в тестах — текст SQL проверяется без
 * подключения.
 */
export type Selectable = Pick<DB, "select">
```

- [ ] **Step 4: Падающий тест модуля** `tests/unit/lib/stock-source.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { drizzle } from "drizzle-orm/postgres-js"
import { PgDialect } from "drizzle-orm/pg-core"
import * as schema from "@/lib/db/schema"

const {
  executeMock,
  transactionMock,
  knownRows,
  insertValuesMock,
  onConflictMock,
} = vi.hoisted(() => ({
  executeMock: vi.fn(),
  transactionMock: vi.fn(),
  knownRows: { current: [] as Array<{ barcode: string; productId: number }> },
  insertValuesMock: vi.fn(),
  onConflictMock: vi.fn(async () => undefined),
}))

vi.mock("@/lib/db/client", () => {
  const tx = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: async () => knownRows.current }),
      }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        insertValuesMock(v)
        return { onConflictDoUpdate: onConflictMock }
      },
    }),
  }
  transactionMock.mockImplementation(
    async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)
  )
  return { db: { execute: executeMock, transaction: transactionMock } }
})

import {
  poolSizeRowsQuery,
  recalcFromPoolSql,
  recalcProductStocksFromPool,
  siteStockSnapshotQuery,
  upsertPoolStocks,
} from "@/lib/stock-source"

/** Текст SQL без переносов — фрагменты сравниваются по смыслу, а не по вёрстке. */
const flat = (s: string) => s.replace(/\s+/g, " ")
const mockDb = drizzle.mock({ schema })
const dialect = new PgDialect()

beforeEach(() => {
  executeMock.mockReset()
  insertValuesMock.mockClear()
  onConflictMock.mockClear()
  transactionMock.mockClear()
  knownRows.current = []
})

describe("остаток размера из pool_stocks", () => {
  it("сумма по штрихкодам размера, коррелирована с wb_product_sizes по имени таблицы", () => {
    const q = poolSizeRowsQuery(mockDb, [1, 2]).toSQL()
    // Имя таблицы — текстом: drizzle в полях select одиночной таблицы пишет
    // колонку без таблицы ("id"), и внутри подзапроса она привязалась бы к
    // wb_product_skus.id — молча неверная сумма.
    expect(flat(q.sql)).toContain(
      "coalesce((select sum(ps.quantity) from pool_stocks ps join wb_product_skus sk on sk.sku = ps.barcode where sk.size_id = wb_product_sizes.id), 0)::int"
    )
    expect(flat(q.sql)).toContain('"wb_product_sizes"."product_id" in ($1, $2)')
    expect(q.sql).not.toContain("wb_stock_items")
    expect(q.params).toEqual([1, 2])
  })
})

describe("снимок остатка для сверки", () => {
  it("wb — остаток размера на минимальный штрихкод, остальные штрихкоды размера — 0", () => {
    const s = flat(siteStockSnapshotQuery(mockDb, "wb").toSQL().sql)
    expect(s).toContain(
      'when wb_product_skus.sku = (select min(sk2.sku collate "C") from wb_product_skus sk2 where sk2.size_id = wb_product_skus.size_id)'
    )
    expect(s).toContain(
      "coalesce((select sum(si.quantity) from wb_stock_items si where si.size_id = wb_product_skus.size_id), 0)"
    )
    expect(s).not.toContain("pool_stocks")
    expect(s).toContain('order by "wb_product_skus"."sku" asc')
  })

  it("pool — остаток штрихкода из pool_stocks, нет строки — 0", () => {
    const s = flat(siteStockSnapshotQuery(mockDb, "pool").toSQL().sql)
    expect(s).toContain(
      "coalesce((select ps.quantity from pool_stocks ps where ps.barcode = wb_product_skus.sku), 0)::int"
    )
    expect(s).not.toContain("wb_stock_items")
  })
})

describe("пересчёт агрегата товара из пула", () => {
  it("по списку товаров — только изменившиеся, с их id", () => {
    const q = dialect.sqlToQuery(recalcFromPoolSql([3, 5]))
    const s = flat(q.sql)
    expect(s).toContain("update wb_products p set stocks = t.total, is_visible = t.total > 0")
    expect(s).toContain("where p2.id in ($1, $2)")
    expect(s).toContain("and (p.stocks <> t.total or p.is_visible <> (t.total > 0))")
    expect(s).toContain("returning p.id")
    expect(q.params).toEqual([3, 5])
  })

  it("все товары — без фильтра: товар без размеров получает 0", () => {
    const q = dialect.sqlToQuery(recalcFromPoolSql("all"))
    expect(flat(q.sql)).toContain("where true")
    expect(q.params).toEqual([])
  })

  it("пустой список — без запроса; иначе число изменённых товаров", async () => {
    await expect(recalcProductStocksFromPool([])).resolves.toBe(0)
    expect(executeMock).not.toHaveBeenCalled()
    executeMock.mockResolvedValue([{ id: 3 }, { id: 5 }])
    await expect(recalcProductStocksFromPool([3, 5])).resolves.toBe(2)
  })
})

describe("запись пула", () => {
  it("одной транзакцией пишет только известные сайту штрихкоды, неизвестные возвращает", async () => {
    knownRows.current = [
      { barcode: "A", productId: 1 },
      { barcode: "C", productId: 2 },
    ]
    const r = await upsertPoolStocks([
      { barcode: "A", quantity: 2 },
      { barcode: "X", quantity: 1 },
      { barcode: "C", quantity: 0 },
    ])
    expect(r).toEqual({ updated: 2, unknown: ["X"], productIds: [1, 2] })
    expect(transactionMock).toHaveBeenCalledOnce()
    expect(insertValuesMock).toHaveBeenCalledWith([
      { barcode: "A", quantity: 2 },
      { barcode: "C", quantity: 0 },
    ])
    expect(onConflictMock).toHaveBeenCalledOnce()
  })

  it("все штрихкоды неизвестны — ничего не пишет", async () => {
    const r = await upsertPoolStocks([{ barcode: "X", quantity: 1 }])
    expect(r).toEqual({ updated: 0, unknown: ["X"], productIds: [] })
    expect(insertValuesMock).not.toHaveBeenCalled()
  })
})
```
Run: `npx vitest run tests/unit/lib/stock-source.test.ts` → FAIL (нет модуля).

- [ ] **Step 5: Модуль** `lib/stock-source.ts`:
```ts
import { asc, eq, inArray, sql, type SQL } from "drizzle-orm"
import { db, type Selectable } from "@/lib/db/client"
import { poolStocks, wbProductSizes, wbProductSkus } from "@/lib/db/schema"
import type { StockSource } from "@/lib/env"

/*
 * Всё про остаток из общего пула синка v2 (этап 1.3c) — в одном месте.
 * Переключатель — getStockSource() в lib/env.ts; здесь — запросы, которые
 * читают и пишут pool_stocks.
 *
 * Имена таблиц во вложенных подзапросах — текстом (`wb_product_sizes.id`),
 * а не колонками drizzle: в полях select одиночной таблицы drizzle пишет
 * колонку без таблицы (`"id"`), и внутри подзапроса она привязалась бы к
 * колонке подзапроса — молча неверная сумма (проверено 27.09 на рендере).
 */

/** Остаток размера из pool_stocks: сумма по всем штрихкодам размера; нет строк — 0. */
function poolSizeStockSql(): SQL<number> {
  return sql<number>`coalesce((select sum(ps.quantity) from pool_stocks ps join wb_product_skus sk on sk.sku = ps.barcode where sk.size_id = wb_product_sizes.id), 0)::int`
}

/** Размеры товаров с остатком из пула — та же форма строк, что у wb-ветки sizes.ts. */
export function poolSizeRowsQuery(dbx: Selectable, productIds: number[]) {
  return dbx
    .select({
      productId: wbProductSizes.productId,
      id: wbProductSizes.id,
      techSizeName: wbProductSizes.techSizeName,
      stock: poolSizeStockSql(),
    })
    .from(wbProductSizes)
    .where(inArray(wbProductSizes.productId, productIds))
}

export type SiteStockRow = { barcode: string; quantity: number }

/**
 * Снимок остатка витрины по ВСЕМ штрихкодам каталога сайта, нули включены —
 * для сверки в sync2 (GET /api/internal/stocks).
 *
 * `pool` — остаток штрихкода в pool_stocks. `wb` — сайт хранит остаток на
 * размер, а не на штрихкод, поэтому остаток размера отдаётся на его
 * минимальный по байтам штрихкод (то же правило, что у штрихкода позиции
 * заказа, lib/order-barcode.ts), остальные штрихкоды размера — 0: сумма по
 * штрихкодам размера равна тому, что видит витрина.
 */
export function siteStockSnapshotQuery(dbx: Selectable, source: StockSource) {
  const quantity =
    source === "pool"
      ? sql<number>`coalesce((select ps.quantity from pool_stocks ps where ps.barcode = wb_product_skus.sku), 0)::int`
      : sql<number>`(case when wb_product_skus.sku = (select min(sk2.sku collate "C") from wb_product_skus sk2 where sk2.size_id = wb_product_skus.size_id) then coalesce((select sum(si.quantity) from wb_stock_items si where si.size_id = wb_product_skus.size_id), 0) else 0 end)::int`
  return dbx
    .select({ barcode: wbProductSkus.sku, quantity })
    .from(wbProductSkus)
    .orderBy(asc(wbProductSkus.sku))
}

export async function siteStockSnapshot(
  source: StockSource
): Promise<SiteStockRow[]> {
  const rows = await siteStockSnapshotQuery(db, source)
  return rows.map((r) => ({ barcode: r.barcode, quantity: Number(r.quantity) }))
}

/**
 * Пересчёт агрегата товара (`stocks`, `is_visible`) из pool_stocks — в режиме
 * pool это единственный писатель агрегата. Обновляются только изменившиеся
 * товары; "all" — все товары, в том числе без размеров (им 0): нужно при
 * переключении витрины на pool (этап 1.4).
 */
export function recalcFromPoolSql(productIds: number[] | "all"): SQL {
  const filter =
    productIds === "all"
      ? sql`true`
      : sql`p2.id in (${sql.join(
          productIds.map((id) => sql`${id}`),
          sql`, `
        )})`
  return sql`update wb_products p set stocks = t.total, is_visible = t.total > 0, updated_at = now()
from (
  select p2.id as product_id, coalesce((select sum(ps.quantity) from wb_product_sizes s join wb_product_skus sk on sk.size_id = s.id join pool_stocks ps on ps.barcode = sk.sku where s.product_id = p2.id), 0)::int as total
  from wb_products p2
  where ${filter}
) t
where p.id = t.product_id
  and (p.stocks <> t.total or p.is_visible <> (t.total > 0))
returning p.id`
}

/** Возвращает число товаров, у которых агрегат или видимость изменились. */
export async function recalcProductStocksFromPool(
  productIds: number[] | "all"
): Promise<number> {
  if (productIds !== "all" && productIds.length === 0) return 0
  const rows = await db.execute(recalcFromPoolSql(productIds))
  return rows.length
}

export type PoolStockInput = { barcode: string; quantity: number }

export type PoolStockUpsertResult = {
  updated: number
  /** Штрихкоды, которых нет в каталоге сайта (wb_product_skus) — не записаны. */
  unknown: string[]
  /** Товары, чьи штрихкоды записаны — им нужен пересчёт агрегата в pool. */
  productIds: number[]
}

/**
 * Абсолютные остатки пула в pool_stocks одной транзакцией. Неизвестные сайту
 * штрихкоды не пишутся: строка без товара ничего не значит для витрины и
 * только копилась бы.
 */
export async function upsertPoolStocks(
  items: PoolStockInput[]
): Promise<PoolStockUpsertResult> {
  return db.transaction(async (tx) => {
    const known = await tx
      .select({ barcode: wbProductSkus.sku, productId: wbProductSizes.productId })
      .from(wbProductSkus)
      .innerJoin(wbProductSizes, eq(wbProductSizes.id, wbProductSkus.sizeId))
      .where(
        inArray(
          wbProductSkus.sku,
          items.map((i) => i.barcode)
        )
      )
    const productByBarcode = new Map(
      known.map((k) => [k.barcode, Number(k.productId)])
    )
    const toWrite = items.filter((i) => productByBarcode.has(i.barcode))
    const unknown = items
      .filter((i) => !productByBarcode.has(i.barcode))
      .map((i) => i.barcode)
    if (toWrite.length > 0) {
      await tx
        .insert(poolStocks)
        .values(
          toWrite.map((i) => ({ barcode: i.barcode, quantity: i.quantity }))
        )
        .onConflictDoUpdate({
          target: poolStocks.barcode,
          set: { quantity: sql`excluded.quantity`, updatedAt: sql`now()` },
        })
    }
    const productIds = [
      ...new Set(toWrite.map((i) => productByBarcode.get(i.barcode)!)),
    ]
    return { updated: toWrite.length, unknown, productIds }
  })
}
```
Run: `npx vitest run tests/unit/lib/stock-source.test.ts tests/unit/lib/env-sync.test.ts` → все зелёные.

- [ ] **Step 6: `.env.example`** — после блока `REVALIDATE_SECRET`:
```
# Источник остатка витрины (синк v2): wb (по умолчанию — остаток из синка WB)
# | pool (остаток из pool_stocks, пишет sync2). До этапа 1.4 синка v2 — только wb.
STOCK_SOURCE=wb
```

- [ ] **Step 7: Проверки и коммит.**
```bash
npx prettier --write lib/env.ts lib/db/client.ts lib/stock-source.ts tests/unit/lib/env-sync.test.ts tests/unit/lib/stock-source.test.ts
npm run lint && npm run typecheck && npm test
git add lib/env.ts lib/db/client.ts lib/stock-source.ts .env.example tests/unit/lib/env-sync.test.ts tests/unit/lib/stock-source.test.ts
git commit -m "feat(sync-api): переключатель STOCK_SOURCE и модуль остатка из пула"
```

---

### Task 3: Читатели остатка и синки WB — через переключатель

**Репозиторий:** сайт, ветка `feat/internal-sync-api`.

**Files:**
- Modify: `lib/db/queries/sizes.ts`, `lib/wb/sync/stocks.ts`, `lib/wb/sync/upsert-product.ts`
- Modify: `tests/unit/lib/wb/sync/stocks.test.ts`, `tests/unit/lib/wb/sync/upsert-product.test.ts`
- Create: `tests/unit/lib/db/sizes-source.test.ts`

- [ ] **Step 1: Падающий тест размеров** `tests/unit/lib/db/sizes-source.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }))
vi.mock("@/lib/db/client", () => ({ db: { select: selectMock } }))

import { getProductSizes, getSizesForProducts } from "@/lib/db/queries/sizes"

type Step = ReturnType<typeof vi.fn>
type Chain = {
  from: Step
  leftJoin: Step
  where: Step
  groupBy: Step
  then: (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown
  ) => Promise<unknown>
}

/** Цепочка drizzle, которую можно await-ить на любом звене; видно, какие звенья вызваны. */
function chain(rows: unknown[]): Chain {
  const c = {} as Chain
  c.from = vi.fn(() => c)
  c.leftJoin = vi.fn(() => c)
  c.where = vi.fn(() => c)
  c.groupBy = vi.fn(() => c)
  c.then = (resolve, reject) => Promise.resolve(rows).then(resolve, reject)
  return c
}

const rows = [
  { productId: 1, id: BigInt(11), techSizeName: "18", stock: 0 },
  { productId: 1, id: BigInt(10), techSizeName: "17", stock: 2 },
  { productId: 1, id: BigInt(12), techSizeName: null, stock: 5 },
]
const expected = [
  { id: "10", techSizeName: "17", stock: 2 },
  { id: "11", techSizeName: "18", stock: 0 },
]

beforeEach(() => {
  selectMock.mockReset()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("остаток размеров по STOCK_SOURCE", () => {
  it("wb — прежний запрос: wb_stock_items через leftJoin и groupBy", async () => {
    const c = chain(rows)
    selectMock.mockReturnValue(c)
    const sizes = await getSizesForProducts([1])
    expect(c.leftJoin).toHaveBeenCalledOnce()
    expect(c.groupBy).toHaveBeenCalledOnce()
    expect(sizes.get(1)).toEqual(expected)
  })

  it("pool — остаток из pool_stocks подзапросом, без join к wb_stock_items", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    const c = chain(rows)
    selectMock.mockReturnValue(c)
    const sizes = await getSizesForProducts([1])
    expect(c.leftJoin).not.toHaveBeenCalled()
    expect(c.groupBy).not.toHaveBeenCalled()
    expect(sizes.get(1)).toEqual(expected)
  })

  it("pool — страница товара получает те же размеры в том же порядке", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    selectMock.mockReturnValue(chain(rows))
    await expect(getProductSizes(1)).resolves.toEqual(expected)
  })

  it("pool — пустой список товаров не ходит в базу", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    await expect(getSizesForProducts([])).resolves.toEqual(new Map())
    expect(selectMock).not.toHaveBeenCalled()
  })
})
```
Run: `npx vitest run tests/unit/lib/db/sizes-source.test.ts` → FAIL (pool-тесты: вызван `leftJoin`).

- [ ] **Step 2: Размеры.** В `lib/db/queries/sizes.ts`:
  - импорты — добавить:
```ts
import { getStockSource } from "@/lib/env"
import { poolSizeRowsQuery } from "@/lib/stock-source"
```
  - в `getProductSizes` первой строкой тела, перед `const rows = await db`:
```ts
  // Источник остатка — один переключатель на всю витрину (STOCK_SOURCE,
  // lib/env.ts). Ветка wb ниже — прежний запрос без изменений.
  if (getStockSource() === "pool") {
    return (await getSizesFromPool([productId])).get(productId) ?? []
  }

```
  - в `getSizesForProducts` сразу после `if (productIds.length === 0) return byProduct`:
```ts

  if (getStockSource() === "pool") return getSizesFromPool(productIds)
```
  - в конец файла:
```ts
/**
 * Размеры с остатком из pool_stocks (STOCK_SOURCE=pool): остаток размера —
 * сумма по всем его штрихкодам (lib/stock-source.ts). Форма, отбор строк без
 * tech_size_name и порядок по возрастанию — как у wb-ветки выше.
 */
async function getSizesFromPool(
  productIds: number[]
): Promise<Map<number, ProductSize[]>> {
  const byProduct = new Map<number, ProductSize[]>()
  const rows = await poolSizeRowsQuery(db, productIds)
  for (const row of rows) {
    if (!row.techSizeName) continue
    const productId = Number(row.productId)
    const sizes = byProduct.get(productId) ?? []
    sizes.push({
      id: String(row.id),
      techSizeName: row.techSizeName,
      stock: Number(row.stock),
    })
    byProduct.set(productId, sizes)
  }
  for (const sizes of byProduct.values()) {
    sizes.sort((a, b) => Number(a.techSizeName) - Number(b.techSizeName))
  }
  return byProduct
}
```
Run → 4 passed.

- [ ] **Step 3: Падающий тест синка остатков** — в `tests/unit/lib/wb/sync/stocks.test.ts`: в первой строке импортов добавить `afterEach`; после `beforeEach(() => { … })` внутри `describe("syncStocks"` добавить `afterEach(() => { vi.unstubAllEnvs() })`; в конец `describe`:
```ts
  it("STOCK_SOURCE=pool: пишет wb_stock_items, но агрегат и видимость не трогает", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    const product = { id: BigInt(5), isVisible: true }
    const size = { id: BigInt(50), productId: 5 }
    const sku = { sizeId: 50, sku: "S1" }

    selectMock
      .mockImplementationOnce(() => chainRows([product]))
      .mockImplementationOnce(() => chainRows([size]))
      .mockImplementationOnce(() => chainRows([sku]))

    const r = await syncStocks({ writeMode: "live" })

    expect(upsertStockItemMock).toHaveBeenCalledOnce()
    // Пересчёт агрегата из wb_stock_items не запрашивается и не пишется:
    // в pool агрегат товара пишет только sync2 через pool_stocks.
    expect(selectMock).toHaveBeenCalledTimes(3)
    expect(updateMock).not.toHaveBeenCalled()
    expect(r).toMatchObject({
      productsProcessed: 1,
      itemsWritten: 1,
      hidden: 0,
      shown: 0,
    })
  })
```
Run: `npx vitest run tests/unit/lib/wb/sync/stocks.test.ts` → FAIL (`updateMock` вызван).

- [ ] **Step 4: Синк остатков.** В `lib/wb/sync/stocks.ts` добавить импорт `import { getStockSource } from "@/lib/env"` и в `recalcProductVisibility` сразу после `if (writeMode === "dry-run") { return null }`:
```ts

  // STOCK_SOURCE=pool: агрегат товара пишет только sync2 (PUT
  // /api/internal/stocks → пересчёт из pool_stocks, lib/stock-source.ts).
  // Синк WB продолжает писать wb_stock_items, но агрегат не трогает — два
  // писателя одного остатка не допускаются (план 1.3c синка v2).
  if (getStockSource() === "pool") {
    return null
  }
```
Run → 5 passed.

- [ ] **Step 5: Падающий тест синка карточек** — в `tests/unit/lib/wb/sync/upsert-product.test.ts`:
  - первую строку импортов заменить на `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"`;
  - после блока `vi.mock("drizzle-orm", …)` добавить:
```ts
const { recalcMock } = vi.hoisted(() => ({
  recalcMock: vi.fn(async () => 1),
}))
vi.mock("@/lib/stock-source", () => ({
  recalcProductStocksFromPool: recalcMock,
}))
```
  - после `let nextSizeId = BigInt(100)` добавить `let onConflictSets: Array<{ table: string; set: Row }> = []`;
  - в `makeInsertChain` строку `onConflictDoUpdate: vi.fn(() => chain),` заменить на:
```ts
    onConflictDoUpdate: vi.fn((arg: { set: Row }) => {
      onConflictSets.push({ table: detectTable(values), set: arg.set })
      return chain
    }),
```
  - в `beforeEach` добавить `onConflictSets = []`; после `beforeEach` — `afterEach(() => { vi.unstubAllEnvs() })`;
  - в конец `describe("upsertProduct"`:
```ts
  it("STOCK_SOURCE=wb: агрегат пишется, как раньше, пересчёта из пула нет", async () => {
    await upsertProduct(
      { nmID: 47, brand: "B", title: "x", rating: 0, sizes: [] } as never,
      { writeMode: "live", priceData: null, totalStocks: 5 }
    )
    const set = onConflictSets.find((c) => c.table === "wbProducts")?.set
    expect(set).toHaveProperty("stocks")
    expect(set).toHaveProperty("isVisible")
    expect(recalcMock).not.toHaveBeenCalled()
  })

  it("STOCK_SOURCE=pool: агрегат не пишет, новая карточка входит скрытой, затем пересчёт из пула", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    await upsertProduct(
      { nmID: 48, brand: "B", title: "x", rating: 0, sizes: [] } as never,
      { writeMode: "live", priceData: null, totalStocks: 5 }
    )
    expect(valuesFor("wbProducts")[0]).toEqual(
      expect.objectContaining({ stocks: 0, isVisible: false })
    )
    const set = onConflictSets.find((c) => c.table === "wbProducts")?.set
    expect(set).not.toHaveProperty("stocks")
    expect(set).not.toHaveProperty("isVisible")
    expect(recalcMock).toHaveBeenCalledWith([1])
  })
```
Run: `npx vitest run tests/unit/lib/wb/sync/upsert-product.test.ts` → FAIL (pool-тест).

- [ ] **Step 6: Синк карточек.** В `lib/wb/sync/upsert-product.ts`:
  - импорты — добавить:
```ts
import { getStockSource } from "@/lib/env"
import { recalcProductStocksFromPool } from "@/lib/stock-source"
```
  - после `const slug = generateSlug(card.title)`:
```ts

  // STOCK_SOURCE (lib/env.ts): в wb агрегат `stocks`/`is_visible` пишет этот
  // синк, как раньше; в pool — только sync2 через pool_stocks (два писателя
  // одного остатка не допускаются, план 1.3c синка v2). Новая карточка в pool
  // входит скрытой, видимость ей даёт пересчёт из пула после записи размеров.
  const aggregatesFromWb = getStockSource() === "wb"
  const aggregates = aggregatesFromWb
    ? { stocks: ctx.totalStocks, isVisible: ctx.totalStocks > 0 }
    : { stocks: 0, isVisible: false }
```
  - в `.values({ … })` строку `stocks: ctx.totalStocks,` заменить на `...aggregates,` и строку `isVisible: ctx.totalStocks > 0,` удалить (комментарий «Держим в паре со `stocks`…» между ними оставить над `...aggregates,`);
  - в `set: { … }` две строки — `stocks: sql…excluded.stocks…` и `isVisible: sql…excluded.is_visible…` — заменить на:
```ts
        ...(aggregatesFromWb
          ? {
              stocks: sql`excluded.stocks`,
              isVisible: sql`excluded.is_visible`,
            }
          : {}),
```
  - после `await syncProductSizes(Number(product.id), card.sizes ?? [])`:
```ts

  if (!aggregatesFromWb) {
    // Размеры и их штрихкоды только что записаны — сопоставление штрихкод →
    // товар могло измениться, агрегат пересчитывается из пула.
    await recalcProductStocksFromPool([Number(product.id)])
  }
```
Run → все тесты `upsert-product.test.ts` зелёные (прежние не менялись: в `wb` значения `values` и `set` те же).

- [ ] **Step 7: Проверки и коммит.**
```bash
npx prettier --write lib/db/queries/sizes.ts lib/wb/sync/stocks.ts lib/wb/sync/upsert-product.ts tests/unit/lib/db/sizes-source.test.ts tests/unit/lib/wb/sync/stocks.test.ts tests/unit/lib/wb/sync/upsert-product.test.ts
npm run lint && npm run typecheck && npm test
git add lib/db/queries/sizes.ts lib/wb/sync/stocks.ts lib/wb/sync/upsert-product.ts tests/unit/lib/db/sizes-source.test.ts tests/unit/lib/wb/sync/stocks.test.ts tests/unit/lib/wb/sync/upsert-product.test.ts
git commit -m "feat(sync-api): остаток размеров и агрегат товара — через STOCK_SOURCE"
```

---

### Task 4: Штрихкод позиции в `createOrder`

**Репозиторий:** сайт, ветка `feat/internal-sync-api`.

**Files:**
- Create: `lib/order-barcode.ts`, `tests/unit/lib/order-barcode.test.ts`, `tests/unit/lib/orders-create.test.ts`
- Modify: `lib/db/queries/sizes.ts`, `lib/orders.ts`

- [ ] **Step 1: Падающий тест правила** `tests/unit/lib/order-barcode.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { groupSkusBySize, pickLineBarcode } from "@/lib/order-barcode"

describe("pickLineBarcode — то же правило, что бэкфилл в миграции 010", () => {
  const bracelet = [
    { techSizeName: "17", skus: ["2041383032880", "2041383032873"] },
    { techSizeName: "18", skus: ["2041383032897"] },
  ]

  it("размер выбран — минимальный штрихкод этого размера (по байтам)", () => {
    expect(pickLineBarcode(bracelet, "17")).toBe("2041383032873")
    expect(pickLineBarcode(bracelet, "18")).toBe("2041383032897")
  })

  it("размер выбран, но у товара такого нет — null", () => {
    expect(pickLineBarcode(bracelet, "21")).toBeNull()
  })

  it("размер не выбран, размеров несколько — неоднозначно, null", () => {
    expect(pickLineBarcode(bracelet, undefined)).toBeNull()
  })

  it("размер не выбран, размер у товара один (заглушка «0») — его штрихкод", () => {
    expect(
      pickLineBarcode([{ techSizeName: "0", skus: ["2044473196868"] }], undefined)
    ).toBe("2044473196868")
  })

  it("у размера нет штрихкодов или у товара нет размеров — null", () => {
    expect(pickLineBarcode([{ techSizeName: "0", skus: [] }], undefined)).toBeNull()
    expect(pickLineBarcode([], undefined)).toBeNull()
  })

  it("два размера с одним tech_size_name — минимальный штрихкод из обоих", () => {
    expect(
      pickLineBarcode(
        [
          { techSizeName: "17", skus: ["300"] },
          { techSizeName: "17", skus: ["2999"] },
        ],
        "17"
      )
    ).toBe("2999")
  })
})

describe("groupSkusBySize", () => {
  it("строки размер×штрихкод → товар → размеры; размер без штрихкодов — пустой список", () => {
    const grouped = groupSkusBySize([
      { productId: 1, sizeRowId: BigInt(10), techSizeName: "17", sku: "B" },
      { productId: 1, sizeRowId: BigInt(10), techSizeName: "17", sku: "A" },
      { productId: 1, sizeRowId: BigInt(11), techSizeName: "18", sku: null },
      { productId: 2, sizeRowId: BigInt(20), techSizeName: "0", sku: "C" },
    ])
    expect(grouped.get(1)).toEqual([
      { techSizeName: "17", skus: ["B", "A"] },
      { techSizeName: "18", skus: [] },
    ])
    expect(grouped.get(2)).toEqual([{ techSizeName: "0", skus: ["C"] }])
  })
})
```
Run: `npx vitest run tests/unit/lib/order-barcode.test.ts` → FAIL.

- [ ] **Step 2: Правило** `lib/order-barcode.ts`:
```ts
/**
 * Штрихкод WB позиции заказа сайта (синк v2, этап 1.3c) — по нему sync2
 * списывает заказ сайта из общего пула. То же правило, что у разового
 * бэкфилла в scripts/migrations/010-internal-sync-api.sql; меняется одно —
 * меняется и другое.
 */

/** Размер товара так, как его видит правило: название и все штрихкоды размера. */
export type BarcodeSize = { techSizeName: string | null; skus: string[] }

/**
 * - размер выбран — размеры товара с этим tech_size_name;
 * - размер не выбран — единственный размер товара (у товара без выбора
 *   размера это строка-заглушка «0»); размеров несколько — null;
 * - из штрихкодов подходящих размеров — минимальный по байтам: `<` над
 *   строками JS сравнивает кодовые единицы, как `COLLATE "C"` в миграции.
 */
export function pickLineBarcode(
  sizes: BarcodeSize[],
  size: string | undefined
): string | null {
  const matched =
    size !== undefined
      ? sizes.filter((s) => s.techSizeName === size)
      : sizes.length === 1
        ? sizes
        : []
  let best: string | null = null
  for (const sku of matched.flatMap((s) => s.skus)) {
    if (best === null || sku < best) best = sku
  }
  return best
}

export type SizeSkuRow = {
  productId: number
  sizeRowId: bigint
  techSizeName: string | null
  sku: string | null
}

/** Строки «размер × штрихкод» (left join) → товар → размеры со списками штрихкодов. */
export function groupSkusBySize(
  rows: SizeSkuRow[]
): Map<number, BarcodeSize[]> {
  const byProduct = new Map<number, Map<string, BarcodeSize>>()
  for (const row of rows) {
    const sizes = byProduct.get(row.productId) ?? new Map<string, BarcodeSize>()
    const key = String(row.sizeRowId)
    const size = sizes.get(key) ?? { techSizeName: row.techSizeName, skus: [] }
    if (row.sku !== null) size.skus.push(row.sku)
    sizes.set(key, size)
    byProduct.set(row.productId, sizes)
  }
  return new Map(
    [...byProduct].map(([productId, sizes]) => [productId, [...sizes.values()]])
  )
}
```
Run → 7 passed.

- [ ] **Step 3: Запрос штрихкодов.** В `lib/db/queries/sizes.ts`: в импорт схемы добавить `wbProductSkus`; импорт `import { groupSkusBySize, type BarcodeSize } from "@/lib/order-barcode"`; в конец файла:
```ts
/**
 * Размеры товаров со всеми их штрихкодами — для штрихкода позиции заказа
 * (lib/order-barcode.ts, pickLineBarcode). Размер без штрихкодов попадает с
 * пустым списком: он считается при правиле «единственный размер товара».
 */
export async function getSkusBySizeForProducts(
  productIds: number[]
): Promise<Map<number, BarcodeSize[]>> {
  if (productIds.length === 0) return new Map()
  const rows = await db
    .select({
      productId: wbProductSizes.productId,
      sizeRowId: wbProductSizes.id,
      techSizeName: wbProductSizes.techSizeName,
      sku: wbProductSkus.sku,
    })
    .from(wbProductSizes)
    .leftJoin(wbProductSkus, eq(wbProductSkus.sizeId, wbProductSizes.id))
    .where(inArray(wbProductSizes.productId, productIds))
  return groupSkusBySize(rows)
}
```

- [ ] **Step 4: Падающий тест `createOrder`** `tests/unit/lib/orders-create.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OrderInput } from "@/lib/validations/order"

const { findProductsByIdsMock, getSizesMock, getSkusMock, inserted } =
  vi.hoisted(() => ({
    findProductsByIdsMock: vi.fn(),
    getSizesMock: vi.fn(),
    getSkusMock: vi.fn(),
    inserted: [] as unknown[],
  }))

vi.mock("@/lib/db/queries/products", () => ({
  findProductsByIds: findProductsByIdsMock,
}))
vi.mock("@/lib/db/queries/sizes", () => ({
  getSizesForProducts: getSizesMock,
  getSkusBySizeForProducts: getSkusMock,
}))
vi.mock("@/lib/db/client", () => {
  // tx.insert(orders).values(…).returning(…) и await tx.insert(orderItems).values([…])
  const tx = {
    insert: () => ({
      values: (v: unknown) => {
        inserted.push(v)
        return Object.assign(Promise.resolve(undefined), {
          returning: async () => [{ id: BigInt(7) }],
        })
      },
    }),
  }
  return {
    db: {
      transaction: async (cb: (t: typeof tx) => Promise<void>) => cb(tx),
    },
  }
})

import { createOrder } from "@/lib/orders"

const input: OrderInput = {
  items: [
    { productId: 1, quantity: 1, size: "17" },
    { productId: 2, quantity: 1 },
  ],
  name: "Иван",
  phone: "+7 (999) 123-45-67",
  shippingAddress: "Севастополь, ул. Ленина, 1",
  contactMethods: ["phone"],
  notes: "",
  displayCurrency: "RUB",
  consent: true,
}

beforeEach(() => {
  inserted.length = 0
  findProductsByIdsMock.mockResolvedValue([
    { id: BigInt(1), title: "Браслет", discountedPrice: "1000.00", discount: "10", stocks: 3 },
    { id: BigInt(2), title: "Подвеска", discountedPrice: "500.00", discount: "0", stocks: 1 },
  ])
  getSizesMock.mockResolvedValue(
    new Map([[1, [{ id: "10", techSizeName: "17", stock: 2 }]]])
  )
  getSkusMock.mockResolvedValue(
    new Map([
      [
        1,
        [
          { techSizeName: "17", skus: ["2041383032873"] },
          { techSizeName: "18", skus: ["2041383032897"] },
        ],
      ],
      [2, [{ techSizeName: "0", skus: ["2044473196868"] }]],
    ])
  )
})

describe("createOrder — штрихкод позиции", () => {
  it("пишет штрихкод WB в order_items по правилу pickLineBarcode", async () => {
    await createOrder(input, { consentPolicyVersion: "2026-09-22" })
    expect(getSkusMock).toHaveBeenCalledWith([1, 2])
    // inserted[0] — строка orders, inserted[1] — позиции order_items.
    expect(inserted[1]).toEqual([
      expect.objectContaining({ wbProductId: 1, size: "17", barcode: "2041383032873" }),
      expect.objectContaining({ wbProductId: 2, size: null, barcode: "2044473196868" }),
    ])
  })

  it("неоднозначная позиция — barcode null, заказ всё равно создаётся", async () => {
    getSkusMock.mockResolvedValue(
      new Map([
        [1, [{ techSizeName: "17", skus: ["2041383032873"] }]],
        [
          2,
          [
            { techSizeName: "17", skus: ["A"] },
            { techSizeName: "18", skus: ["B"] },
          ],
        ],
      ])
    )
    await createOrder(input, { consentPolicyVersion: "2026-09-22" })
    expect(inserted[1]).toEqual([
      expect.objectContaining({ wbProductId: 1, barcode: "2041383032873" }),
      expect.objectContaining({ wbProductId: 2, barcode: null }),
    ])
  })
})
```
Run: `npx vitest run tests/unit/lib/orders-create.test.ts` → FAIL (`getSkusBySizeForProducts` не вызывается, `barcode` нет).

- [ ] **Step 5: `createOrder`.** В `lib/orders.ts`:
  - импорт размеров заменить на `import { getSizesForProducts, getSkusBySizeForProducts } from "@/lib/db/queries/sizes"` и добавить `import { pickLineBarcode } from "@/lib/order-barcode"`;
  - в `type OrderItemSnapshot` после `size?: string` добавить:
```ts
  /** Штрихкод WB позиции (lib/order-barcode.ts); null — не сводится к размеру однозначно. */
  barcode: string | null
```
  - в `insertOrderWithRetry`, в `snapshots.map((s) => ({ … }))`, после `size: s.size ?? null,` добавить `barcode: s.barcode,`;
  - в `createOrder` блок
```ts
  const { lineTotals, total } = computeTotals(resolved)
  const snapshots: OrderItemSnapshot[] = resolved.map((r, i) => ({
    ...r,
    lineTotal: lineTotals[i],
  }))
```
заменить на
```ts
  // Штрихкод WB позиции — для служебного API синка v2 (GET
  // /api/internal/orders): sync2 списывает по нему заказ сайта из пула.
  // Правило — lib/order-barcode.ts, то же, что у бэкфилла в миграции 010.
  const skusByProduct = await getSkusBySizeForProducts(uniqueIds)

  const { lineTotals, total } = computeTotals(resolved)
  const snapshots: OrderItemSnapshot[] = resolved.map((r, i) => ({
    ...r,
    lineTotal: lineTotals[i],
    barcode: pickLineBarcode(skusByProduct.get(r.wbProductId) ?? [], r.size),
  }))
```
Run: `npx vitest run tests/unit/lib/orders-create.test.ts tests/unit/lib/orders.test.ts tests/unit/lib/order-barcode.test.ts` → все зелёные.

- [ ] **Step 6: Проверки и коммит.**
```bash
npx prettier --write lib/order-barcode.ts lib/db/queries/sizes.ts lib/orders.ts tests/unit/lib/order-barcode.test.ts tests/unit/lib/orders-create.test.ts
npm run lint && npm run typecheck && npm test
git add lib/order-barcode.ts lib/db/queries/sizes.ts lib/orders.ts tests/unit/lib/order-barcode.test.ts tests/unit/lib/orders-create.test.ts
git commit -m "feat(sync-api): createOrder пишет штрихкод WB позиции"
```

---

### Task 5: Авторизация служебного API

**Репозиторий:** сайт, ветка `feat/internal-sync-api`.

**Files:**
- Modify: `lib/env.ts`, `.env.example`, `tests/setup.ts`, `tests/unit/lib/env-sync.test.ts`
- Create: `lib/internal-auth.ts`, `tests/unit/lib/internal-auth.test.ts`

- [ ] **Step 1: Падающие тесты.** В `tests/unit/lib/env-sync.test.ts` импорт заменить на `import { getInternalApiToken, getStockSource } from "@/lib/env"` и дописать в конец:
```ts
describe("getInternalApiToken", () => {
  it("не задан — undefined: служебный API закрыт", () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "")
    expect(getInternalApiToken()).toBeUndefined()
  })

  it("короче 32 символов — ошибка с именем переменной", () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "short")
    expect(() => getInternalApiToken()).toThrow(/INTERNAL_API_TOKEN/)
  })

  it("64 hex-символа (openssl rand -hex 32) — принимается", () => {
    vi.stubEnv("INTERNAL_API_TOKEN", "a".repeat(64))
    expect(getInternalApiToken()).toBe("a".repeat(64))
  })
})
```
`tests/unit/lib/internal-auth.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { isValidBearer, requireInternalAuth } from "@/lib/internal-auth"

const TOKEN = "k".repeat(64)
const req = (authorization?: string) =>
  new Request("http://localhost/api/internal/stocks", {
    headers: authorization ? { authorization } : {},
  })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("isValidBearer", () => {
  it("тот же токен — да; схема без учёта регистра", () => {
    expect(isValidBearer(`Bearer ${TOKEN}`, TOKEN)).toBe(true)
    expect(isValidBearer(`bearer ${TOKEN}`, TOKEN)).toBe(true)
  })

  it("другой токен той же длины — нет", () => {
    expect(isValidBearer(`Bearer ${"x".repeat(64)}`, TOKEN)).toBe(false)
  })

  it("токен другой длины — нет и не бросает: сравниваются хэши", () => {
    expect(isValidBearer("Bearer x", TOKEN)).toBe(false)
  })

  it("без схемы Bearer, пустой или без заголовка — нет", () => {
    expect(isValidBearer(TOKEN, TOKEN)).toBe(false)
    expect(isValidBearer("Bearer ", TOKEN)).toBe(false)
    expect(isValidBearer(null, TOKEN)).toBe(false)
  })
})

describe("requireInternalAuth", () => {
  it("верный токен — пропуск (null)", () => {
    vi.stubEnv("INTERNAL_API_TOKEN", TOKEN)
    expect(requireInternalAuth(req(`Bearer ${TOKEN}`))).toBeNull()
  })

  it("нет или неверный токен — 401 с пустым телом, без подсказок", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", TOKEN)
    for (const r of [req(), req("Bearer wrong")]) {
      const res = requireInternalAuth(r)!
      expect(res.status).toBe(401)
      await expect(res.text()).resolves.toBe("")
    }
  })

  it("токен на сервере не задан или короткий — 503, служебный API закрыт", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    for (const value of ["", "short"]) {
      vi.stubEnv("INTERNAL_API_TOKEN", value)
      const res = requireInternalAuth(req(`Bearer ${value}`))!
      expect(res.status).toBe(503)
      await expect(res.json()).resolves.toEqual({ error: "unavailable" })
    }
  })
})
```
Run: `npx vitest run tests/unit/lib/env-sync.test.ts tests/unit/lib/internal-auth.test.ts` → FAIL.

- [ ] **Step 2: Токен в окружении.** В конец `lib/env.ts`:
```ts
const internalApiTokenSchema = z.string().min(32)

/**
 * Токен служебного API для синка v2 (`Authorization: Bearer …`,
 * app/api/internal/*). undefined — не задан: служебный API закрыт (503).
 * Короче 32 символов — ошибка: такой токен не должен тихо приниматься. Не в
 * serverSchema по той же причине, что STOCK_SOURCE: без токена должна не
 * работать только служебная часть, а не весь сайт.
 */
export function getInternalApiToken(): string | undefined {
  const raw = process.env.INTERNAL_API_TOKEN?.trim()
  if (!raw) return undefined
  if (!internalApiTokenSchema.safeParse(raw).success) {
    throw new Error("INTERNAL_API_TOKEN короче 32 символов")
  }
  return raw
}
```
`tests/setup.ts` — после `process.env.TELEGRAM_CHAT_ID ??= "test-chat"`:
```ts
process.env.INTERNAL_API_TOKEN ??= "test-internal-token-0123456789abcdef"
```
`.env.example` — после `STOCK_SOURCE=wb`:
```
# Токен служебного API для sync2 (GET /api/internal/orders, GET/PUT /api/internal/stocks),
# не короче 32 символов; на сервере: openssl rand -hex 32 прямо в .env, не печатать.
# Пусто — служебный API закрыт (503), витрина работает.
INTERNAL_API_TOKEN=
```

- [ ] **Step 3: Хелпер** `lib/internal-auth.ts`:
```ts
import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { getInternalApiToken } from "@/lib/env"

const NO_STORE = { "cache-control": "no-store" }

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest()

/**
 * Заголовок `Authorization: Bearer <токен>` против ожидаемого токена без
 * утечки по времени. timingSafeEqual требует буферы равной длины — сравниваем
 * SHA-256 обоих, поэтому токен другой длины даёт «нет», а не исключение.
 */
export function isValidBearer(
  authorization: string | null,
  expected: string
): boolean {
  const token = /^Bearer (.+)$/i.exec(authorization ?? "")?.[1]
  if (!token) return false
  return timingSafeEqual(sha256(token), sha256(expected))
}

function unavailable(): NextResponse {
  return NextResponse.json(
    { error: "unavailable" },
    { status: 503, headers: NO_STORE }
  )
}

/**
 * Пропуск в служебный API синка v2 (app/api/internal/*). null — можно
 * обрабатывать запрос; иначе — готовый ответ:
 * - 401 с пустым телом: токена нет или он неверный — никаких подсказок;
 * - 503: токен на сервере не задан или битый — служебный API закрыт, а
 *   причина видна в логе сервера.
 */
export function requireInternalAuth(req: Request): NextResponse | null {
  let expected: string | undefined
  try {
    expected = getInternalApiToken()
  } catch (err) {
    console.error(
      "служебный API закрыт:",
      err instanceof Error ? err.message : err
    )
    return unavailable()
  }
  if (!expected) {
    console.error("служебный API закрыт: INTERNAL_API_TOKEN не задан")
    return unavailable()
  }
  if (!isValidBearer(req.headers.get("authorization"), expected)) {
    return new NextResponse(null, { status: 401, headers: NO_STORE })
  }
  return null
}
```
Run → зелёные.

- [ ] **Step 4: Проверки и коммит.**
```bash
npx prettier --write lib/env.ts lib/internal-auth.ts tests/setup.ts tests/unit/lib/env-sync.test.ts tests/unit/lib/internal-auth.test.ts
npm run lint && npm run typecheck && npm test
git add lib/env.ts lib/internal-auth.ts tests/setup.ts .env.example tests/unit/lib/env-sync.test.ts tests/unit/lib/internal-auth.test.ts
git commit -m "feat(sync-api): Bearer-авторизация служебного API"
```

---

### Task 6: `GET /api/internal/orders`

**Репозиторий:** сайт, ветка `feat/internal-sync-api`.

**Files:**
- Create: `lib/internal-orders.ts`, `app/api/internal/orders/route.ts`, `tests/unit/lib/internal-orders.test.ts`, `tests/unit/internal-orders-route.test.ts`

- [ ] **Step 1: Прочитать документацию Next** (требование `AGENTS.md`): `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`. Сверить с «Решения этапа», п. 4; расхождение — остановиться и описать.

- [ ] **Step 2: Падающий тест ленты** `tests/unit/lib/internal-orders.test.ts` (пояс — из Task 0; если там решено `Europe/Moscow`, в тесте и константе ниже `'UTC'` первого `at time zone` заменяется на `'Europe/Moscow'`):
```ts
import { describe, expect, it } from "vitest"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "@/lib/db/schema"
import {
  assembleOrdersFeed,
  itemsForOrdersQuery,
  ORDERS_DB_TIME_ZONE,
  ordersSinceQuery,
} from "@/lib/internal-orders"

const mockDb = drizzle.mock({ schema })
const flat = (s: string) => s.replace(/\s+/g, " ")

describe("время заказов", () => {
  it("пояс записи created_at — UTC: прод-база в Etc/UTC (план 1.3c, Task 0)", () => {
    expect(ORDERS_DB_TIME_ZONE).toBe("UTC")
  })

  it("createdAt — ISO UTC с Z, пересчёт в SQL, от пояса сессии не зависит", () => {
    const s = flat(ordersSinceQuery(mockDb, "2026-09-01T00:00:00.000Z", 1001).toSQL().sql)
    expect(s).toContain(
      `to_char(("created_at" at time zone 'UTC') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
    )
  })

  it("since переводится в часы базы — сравнение с created_at по индексу", () => {
    const q = ordersSinceQuery(mockDb, "2026-09-01T00:00:00.000Z", 1001).toSQL()
    expect(flat(q.sql)).toContain(
      `"orders"."created_at" >= ($1::timestamptz at time zone 'UTC')`
    )
    expect(q.params).toEqual(["2026-09-01T00:00:00.000Z", 1001])
  })
})

describe("запросы ленты", () => {
  it("заказы по возрастанию id с лимитом", () => {
    const s = flat(ordersSinceQuery(mockDb, "2026-09-01T00:00:00.000Z", 1001).toSQL().sql)
    expect(s).toMatch(/order by "orders"\."id" asc limit \$2$/)
  })

  it("персональные данные из базы не выбираются вовсе", () => {
    const s = ordersSinceQuery(mockDb, "2026-09-01T00:00:00.000Z", 1001).toSQL().sql
    for (const column of [
      "customer_name",
      "customer_phone",
      "shipping_address",
      "contact_methods",
      "notes",
    ]) {
      expect(s).not.toContain(column)
    }
  })

  it("позиции — цена в копейках округлением в SQL, по id", () => {
    const q = itemsForOrdersQuery(mockDb, [41, 42]).toSQL()
    const s = flat(q.sql)
    expect(s).toContain(`round("price" * 100)::int`)
    expect(s).toContain(`"order_items"."order_id" in ($1, $2)`)
    expect(s).toMatch(/order by "order_items"\."id" asc$/)
    expect(q.params).toEqual([41, 42])
  })
})

describe("assembleOrdersFeed", () => {
  const orderRows = [
    { id: BigInt(41), number: "ORD-TEST0001", status: "new", createdAt: "2026-09-26T07:53:00.000Z" },
    { id: BigInt(42), number: "ORD-TEST0002", status: "new", createdAt: "2026-09-27T09:00:00.000Z" },
  ]
  const itemRows = [
    { id: BigInt(77), orderId: 41, barcode: "2041383032873", quantity: 1, priceKopecks: 189000 },
    { id: BigInt(78), orderId: 41, barcode: null, quantity: 2, priceKopecks: 99000 },
  ]

  it("позиции группируются по заказу, id — строками, заказ без позиций — пустой список", () => {
    expect(assembleOrdersFeed(orderRows, itemRows, 1000)).toEqual({
      orders: [
        {
          id: "41",
          number: "ORD-TEST0001",
          status: "new",
          createdAt: "2026-09-26T07:53:00.000Z",
          items: [
            { lineId: "77", barcode: "2041383032873", quantity: 1, priceKopecks: 189000 },
            { lineId: "78", barcode: null, quantity: 2, priceKopecks: 99000 },
          ],
        },
        {
          id: "42",
          number: "ORD-TEST0002",
          status: "new",
          createdAt: "2026-09-27T09:00:00.000Z",
          items: [],
        },
      ],
      truncated: false,
    })
  })

  it("строк больше лимита — лишняя отрезается, truncated", () => {
    const feed = assembleOrdersFeed(orderRows, itemRows, 1)
    expect(feed.orders.map((o) => o.id)).toEqual(["41"])
    expect(feed.truncated).toBe(true)
  })
})
```
Run: `npx vitest run tests/unit/lib/internal-orders.test.ts` → FAIL.

- [ ] **Step 3: Лента** `lib/internal-orders.ts`:
```ts
import { asc, inArray, sql } from "drizzle-orm"
import { db, type Selectable } from "@/lib/db/client"
import { orderItems, orders } from "@/lib/db/schema"

/**
 * Пояс, в котором база пишет orders.created_at. Колонка — TIMESTAMP без пояса
 * (scripts/migrations/002-orders.sql), значение ставит default now() самой
 * базы — это часы в поясе сессии (TimeZone). Клиент postgres-js пояс не
 * задаёт (lib/db/client.ts), TZ процессу не нужен (now() считает база), —
 * действует настройка сервера PostgreSQL. Прод-база живёт в Etc/UTC:
 * проверено 2026-09-03 (lib/notifications.ts) и перепроверено перед этапом
 * 1.3c синка v2 (план 1.3c, Task 0). Локальная база разработчика —
 * Europe/Moscow: там createdAt из API сдвинут на 3 часа, это касается только
 * разработки. Сменится пояс базы — меняется эта константа, а старые строки
 * придётся пересчитать.
 */
export const ORDERS_DB_TIME_ZONE = "UTC"
/** Заказов в одном ответе; больше — `truncated`, sync2 считает это ошибкой. */
export const ORDERS_FEED_LIMIT = 1000
/** Окно `since` не шире — sync2 читает 60 дней, 90 — с запасом. */
export const ORDERS_FEED_MAX_WINDOW_DAYS = 90

/** Литерал пояса — константа выше, не ввод пользователя. */
const DB_TZ = sql.raw(`'${ORDERS_DB_TIME_ZONE}'`)

export type FeedItem = {
  lineId: string
  barcode: string | null
  quantity: number
  priceKopecks: number
}
export type FeedOrder = {
  id: string
  number: string
  status: string
  createdAt: string
  items: FeedItem[]
}
export type OrdersFeed = { orders: FeedOrder[]; truncated: boolean }

/**
 * Заказы начиная с момента since (ISO). Выбираются только номер, статус и
 * время: имя, телефон, адрес, способы связи и заметки покупателя в ленту
 * синка не попадают вовсе. createdAt — ISO UTC с «Z»: сначала часы базы
 * читаются как момент в её поясе, затем выводятся часами UTC — результат не
 * зависит от пояса сессии.
 */
export function ordersSinceQuery(
  dbx: Selectable,
  sinceIso: string,
  limit: number
) {
  return dbx
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      createdAt: sql<string>`to_char((${orders.createdAt} at time zone ${DB_TZ}) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
    })
    .from(orders)
    .where(
      sql`${orders.createdAt} >= (${sinceIso}::timestamptz at time zone ${DB_TZ})`
    )
    .orderBy(asc(orders.id))
    .limit(limit)
}

/** Позиции заказов; цена — копейки, округление в SQL (numeric, без float). */
export function itemsForOrdersQuery(dbx: Selectable, orderIds: number[]) {
  return dbx
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      barcode: orderItems.barcode,
      quantity: orderItems.quantity,
      priceKopecks: sql<number>`round(${orderItems.price} * 100)::int`,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .orderBy(asc(orderItems.id))
}

type OrderRow = { id: bigint; number: string; status: string; createdAt: string }
type ItemRow = {
  id: bigint
  orderId: number
  barcode: string | null
  quantity: number
  priceKopecks: number
}

/** Строки заказов (limit + 1) и их позиций → ответ API. */
export function assembleOrdersFeed(
  orderRows: OrderRow[],
  itemRows: ItemRow[],
  limit: number
): OrdersFeed {
  const byOrder = new Map<string, FeedItem[]>()
  for (const item of itemRows) {
    const key = String(item.orderId)
    const list = byOrder.get(key) ?? []
    list.push({
      lineId: String(item.id),
      barcode: item.barcode,
      quantity: item.quantity,
      priceKopecks: Number(item.priceKopecks),
    })
    byOrder.set(key, list)
  }
  return {
    orders: orderRows.slice(0, limit).map((o) => ({
      id: String(o.id),
      number: o.number,
      status: o.status,
      createdAt: o.createdAt,
      items: byOrder.get(String(o.id)) ?? [],
    })),
    truncated: orderRows.length > limit,
  }
}

export async function listOrdersSince(sinceIso: string): Promise<OrdersFeed> {
  const orderRows = await ordersSinceQuery(db, sinceIso, ORDERS_FEED_LIMIT + 1)
  const page = orderRows.slice(0, ORDERS_FEED_LIMIT)
  const itemRows =
    page.length === 0
      ? []
      : await itemsForOrdersQuery(
          db,
          page.map((o) => Number(o.id))
        )
  return assembleOrdersFeed(orderRows, itemRows, ORDERS_FEED_LIMIT)
}
```
Run → зелёные.

- [ ] **Step 4: Проверка преобразования на локальной базе** (пояс сессии — `Europe/Moscow`, результат обязан быть тем же):
```bash
DB=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')
psql "$DB" -X -A -c "SET TimeZone = 'Europe/Moscow'" -c "SELECT to_char((TIMESTAMP '2026-09-27 07:53:00.123456' at time zone 'UTC') at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')"
```
Expected: `2026-09-27T07:53:00.123Z`.

- [ ] **Step 5: Падающий тест роута** `tests/unit/internal-orders-route.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }))
vi.mock("@/lib/internal-orders", () => ({
  listOrdersSince: listMock,
  ORDERS_FEED_MAX_WINDOW_DAYS: 90,
}))

import { GET } from "@/app/api/internal/orders/route"

const TOKEN = process.env.INTERNAL_API_TOKEN!
const DAY = 86_400_000
const get = (query: string, auth: string | null = `Bearer ${TOKEN}`) =>
  GET(
    new Request(`http://localhost/api/internal/orders${query}`, {
      headers: auth ? { authorization: auth } : {},
    })
  )

const feed = {
  orders: [
    {
      id: "41",
      number: "ORD-TEST0001",
      status: "new",
      createdAt: "2026-09-26T07:53:00.000Z",
      items: [{ lineId: "77", barcode: "2041383032873", quantity: 1, priceKopecks: 189000 }],
    },
  ],
  truncated: false,
}

afterEach(() => {
  listMock.mockReset()
  vi.restoreAllMocks()
})

describe("GET /api/internal/orders", () => {
  it("без токена — 401, в базу не ходит", async () => {
    const res = await get("?since=2026-09-01T00:00:00.000Z", null)
    expect(res.status).toBe(401)
    expect(listMock).not.toHaveBeenCalled()
  })

  it("без since или с мусором — 400", async () => {
    expect((await get("")).status).toBe(400)
    expect((await get("?since=вчера")).status).toBe(400)
    expect(listMock).not.toHaveBeenCalled()
  })

  it("окно шире 90 дней — 400 window_too_large", async () => {
    const since = new Date(Date.now() - 91 * DAY).toISOString()
    const res = await get(`?since=${encodeURIComponent(since)}`)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: "window_too_large" })
  })

  it("отдаёт ленту; since со смещением приводится к UTC", async () => {
    listMock.mockResolvedValue(feed)
    const utc = new Date(Date.now() - 10 * DAY)
    const withOffset = new Date(utc.getTime() + 3 * 3_600_000)
      .toISOString()
      .replace("Z", "+03:00")
    const res = await get(`?since=${encodeURIComponent(withOffset)}`)
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    await expect(res.json()).resolves.toEqual(feed)
    expect(listMock).toHaveBeenCalledWith(utc.toISOString())
  })

  it("ошибка базы — 500 без подробностей", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    listMock.mockRejectedValue(new Error("connection refused"))
    const res = await get(`?since=${encodeURIComponent(new Date(Date.now() - DAY).toISOString())}`)
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "db_error" })
  })
})
```
Run: `npx vitest run tests/unit/internal-orders-route.test.ts` → FAIL (нет роута).

- [ ] **Step 6: Роут** `app/api/internal/orders/route.ts`:
```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireInternalAuth } from "@/lib/internal-auth"
import {
  listOrdersSince,
  ORDERS_FEED_MAX_WINDOW_DAYS,
} from "@/lib/internal-orders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store" }
const querySchema = z.object({ since: z.iso.datetime({ offset: true }) })

/**
 * Лента заказов сайта для синка v2 (sync2, адаптер site): заказы с
 * created_at >= since по возрастанию id, со штрихкодом WB каждой позиции.
 * Без персональных данных покупателя. Закрыт токеном (lib/internal-auth.ts).
 */
export async function GET(req: Request) {
  const denied = requireInternalAuth(req)
  if (denied) return denied

  const parsed = querySchema.safeParse({
    since: new URL(req.url).searchParams.get("since") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400, headers: NO_STORE }
    )
  }
  const sinceMs = Date.parse(parsed.data.since)
  if (Date.now() - sinceMs > ORDERS_FEED_MAX_WINDOW_DAYS * 86_400_000) {
    return NextResponse.json(
      { error: "window_too_large", maxDays: ORDERS_FEED_MAX_WINDOW_DAYS },
      { status: 400, headers: NO_STORE }
    )
  }

  try {
    const feed = await listOrdersSince(new Date(sinceMs).toISOString())
    return NextResponse.json(feed, { headers: NO_STORE })
  } catch (err) {
    console.error("internal orders feed failed", err)
    return NextResponse.json(
      { error: "db_error" },
      { status: 500, headers: NO_STORE }
    )
  }
}
```
Run → 5 passed.

- [ ] **Step 7: Проверки и коммит.**
```bash
npx prettier --write lib/internal-orders.ts app/api/internal/orders/route.ts tests/unit/lib/internal-orders.test.ts tests/unit/internal-orders-route.test.ts
npm run lint && npm run typecheck && npm test
git add lib/internal-orders.ts app/api/internal/orders/route.ts tests/unit/lib/internal-orders.test.ts tests/unit/internal-orders-route.test.ts
git commit -m "feat(sync-api): GET /api/internal/orders — заказы сайта со штрихкодом WB"
```

---

### Task 7: `GET` и `PUT /api/internal/stocks`

**Репозиторий:** сайт, ветка `feat/internal-sync-api`.

**Files:**
- Create: `app/api/internal/stocks/route.ts`, `tests/unit/internal-stocks-route.test.ts`

- [ ] **Step 1: Падающий тест** `tests/unit/internal-stocks-route.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"

const { snapshotMock, upsertMock, recalcMock, revalidateMock } = vi.hoisted(
  () => ({
    snapshotMock: vi.fn(),
    upsertMock: vi.fn(),
    recalcMock: vi.fn(),
    revalidateMock: vi.fn(async () => undefined),
  })
)
vi.mock("@/lib/stock-source", () => ({
  siteStockSnapshot: snapshotMock,
  upsertPoolStocks: upsertMock,
  recalcProductStocksFromPool: recalcMock,
}))
vi.mock("@/lib/wb/sync/revalidate", () => ({ revalidate: revalidateMock }))

import { GET, PUT } from "@/app/api/internal/stocks/route"

const TOKEN = process.env.INTERNAL_API_TOKEN!
const url = "http://localhost/api/internal/stocks"
const get = (auth: string | null = `Bearer ${TOKEN}`) =>
  GET(new Request(url, { headers: auth ? { authorization: auth } : {} }))
const put = (body: unknown, auth: string | null = `Bearer ${TOKEN}`) =>
  PUT(
    new Request(url, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: auth } : {}),
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  snapshotMock.mockReset()
  upsertMock.mockReset()
  recalcMock.mockReset()
  revalidateMock.mockClear()
})

describe("GET /api/internal/stocks", () => {
  it("без токена — 401", async () => {
    expect((await get(null)).status).toBe(401)
    expect(snapshotMock).not.toHaveBeenCalled()
  })

  it("снимок по всем штрихкодам с источником остатка", async () => {
    snapshotMock.mockResolvedValue([
      { barcode: "2041383032873", quantity: 2 },
      { barcode: "2044473196868", quantity: 0 },
    ])
    const res = await get()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      source: "wb",
      items: [
        { barcode: "2041383032873", quantity: 2 },
        { barcode: "2044473196868", quantity: 0 },
      ],
    })
    expect(snapshotMock).toHaveBeenCalledWith("wb")
  })

  it("STOCK_SOURCE=pool — снимок из пула", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    snapshotMock.mockResolvedValue([])
    await expect((await get()).json()).resolves.toEqual({ source: "pool", items: [] })
    expect(snapshotMock).toHaveBeenCalledWith("pool")
  })
})

describe("PUT /api/internal/stocks", () => {
  it("без токена — 401, ничего не пишет", async () => {
    expect((await put({ items: [{ barcode: "A", quantity: 1 }] }, null)).status).toBe(401)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("битый JSON и неверные тела — 400", async () => {
    expect((await put("{")).status).toBe(400)
    for (const body of [
      { items: [] },
      { items: [{ barcode: "A", quantity: -1 }] },
      { items: [{ barcode: "A", quantity: 1.5 }] },
      { items: [{ barcode: "", quantity: 1 }] },
      { items: Array.from({ length: 5001 }, (_, i) => ({ barcode: `B${i}`, quantity: 0 })) },
    ]) {
      expect((await put(body)).status).toBe(400)
    }
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("дубли штрихкодов — 400 с их перечнем", async () => {
    const res = await put({
      items: [
        { barcode: "A", quantity: 1 },
        { barcode: "A", quantity: 2 },
      ],
    })
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "duplicate_barcodes",
      barcodes: ["A"],
    })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("wb — только запись в pool_stocks, витрина не пересчитывается", async () => {
    upsertMock.mockResolvedValue({ updated: 2, unknown: ["X"], productIds: [1, 2] })
    const items = [
      { barcode: "A", quantity: 3 },
      { barcode: "B", quantity: 0 },
      { barcode: "X", quantity: 1 },
    ]
    const res = await put({ items })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ updated: 2, unknown: ["X"], source: "wb" })
    expect(upsertMock).toHaveBeenCalledWith(items)
    expect(recalcMock).not.toHaveBeenCalled()
    expect(revalidateMock).not.toHaveBeenCalled()
  })

  it("pool — пересчёт затронутых товаров и ревалидация каталога", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    upsertMock.mockResolvedValue({ updated: 1, unknown: [], productIds: [7] })
    recalcMock.mockResolvedValue(1)
    const res = await put({ items: [{ barcode: "A", quantity: 0 }] })
    expect(res.status).toBe(200)
    expect(recalcMock).toHaveBeenCalledWith([7])
    expect(revalidateMock).toHaveBeenCalledWith("/catalog")
  })

  it("pool, но все штрихкоды неизвестны — пересчитывать нечего", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    upsertMock.mockResolvedValue({ updated: 0, unknown: ["X"], productIds: [] })
    expect((await put({ items: [{ barcode: "X", quantity: 1 }] })).status).toBe(200)
    expect(recalcMock).not.toHaveBeenCalled()
    expect(revalidateMock).not.toHaveBeenCalled()
  })

  it("ошибка записи — 500 db_error; ошибка пересчёта — 500 recalc_failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    upsertMock.mockRejectedValue(new Error("deadlock"))
    await expect((await put({ items: [{ barcode: "A", quantity: 1 }] })).json()).resolves.toEqual({ error: "db_error" })

    vi.stubEnv("STOCK_SOURCE", "pool")
    upsertMock.mockResolvedValue({ updated: 1, unknown: [], productIds: [7] })
    recalcMock.mockRejectedValue(new Error("timeout"))
    const res = await put({ items: [{ barcode: "A", quantity: 1 }] })
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "recalc_failed" })
  })
})
```
Run: `npx vitest run tests/unit/internal-stocks-route.test.ts` → FAIL (нет роута).

- [ ] **Step 2: Роут** `app/api/internal/stocks/route.ts`:
```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { getStockSource } from "@/lib/env"
import { requireInternalAuth } from "@/lib/internal-auth"
import {
  recalcProductStocksFromPool,
  siteStockSnapshot,
  upsertPoolStocks,
} from "@/lib/stock-source"
import { revalidate } from "@/lib/wb/sync/revalidate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store" }
/** Позиций в одном PUT — sync2 режет запись на пачки этого размера (SITE_PUT_MAX_ITEMS). */
const PUT_MAX_ITEMS = 5000

const putSchema = z.object({
  items: z
    .array(
      z.object({
        barcode: z.string().trim().min(1).max(50),
        quantity: z.number().int().min(0).max(1_000_000),
      })
    )
    .min(1)
    .max(PUT_MAX_ITEMS),
})

function duplicateBarcodes(barcodes: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const barcode of barcodes) {
    if (seen.has(barcode)) duplicates.add(barcode)
    seen.add(barcode)
  }
  return [...duplicates]
}

/**
 * Снимок остатка витрины по всем штрихкодам каталога сайта, нули включены —
 * для сверки в sync2. `source` — откуда витрина сейчас берёт остаток.
 */
export async function GET(req: Request) {
  const denied = requireInternalAuth(req)
  if (denied) return denied
  try {
    const source = getStockSource()
    const items = await siteStockSnapshot(source)
    return NextResponse.json({ source, items }, { headers: NO_STORE })
  } catch (err) {
    console.error("internal stocks snapshot failed", err)
    return NextResponse.json(
      { error: "db_error" },
      { status: 500, headers: NO_STORE }
    )
  }
}

/**
 * Абсолютные остатки общего пула в pool_stocks — единственный писатель этой
 * таблицы (sync2). В STOCK_SOURCE=pool после записи пересчитывается агрегат
 * затронутых товаров и ревалидируется каталог; в wb таблица только
 * наполняется, витрина не меняется. Повтор запроса безопасен: значения
 * абсолютные.
 */
export async function PUT(req: Request) {
  const denied = requireInternalAuth(req)
  if (denied) return denied

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400, headers: NO_STORE }
    )
  }
  const parsed = putSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400, headers: NO_STORE }
    )
  }
  const items = parsed.data.items
  const duplicates = duplicateBarcodes(items.map((i) => i.barcode))
  if (duplicates.length > 0) {
    return NextResponse.json(
      { error: "duplicate_barcodes", barcodes: duplicates.slice(0, 20) },
      { status: 400, headers: NO_STORE }
    )
  }

  let result: Awaited<ReturnType<typeof upsertPoolStocks>>
  try {
    result = await upsertPoolStocks(items)
  } catch (err) {
    console.error("internal stocks upsert failed", err)
    return NextResponse.json(
      { error: "db_error" },
      { status: 500, headers: NO_STORE }
    )
  }

  const source = getStockSource()
  if (source === "pool" && result.productIds.length > 0) {
    try {
      await recalcProductStocksFromPool(result.productIds)
    } catch (err) {
      // Пул уже записан; повтор PUT (sync2 повторяет 5xx) пересчитает снова.
      console.error("internal stocks recalc failed", err)
      return NextResponse.json(
        { error: "recalc_failed" },
        { status: 500, headers: NO_STORE }
      )
    }
    await revalidate("/catalog")
  }

  return NextResponse.json(
    { updated: result.updated, unknown: result.unknown, source },
    { headers: NO_STORE }
  )
}
```
Run → 10 passed.

- [ ] **Step 3: Живая проверка локально** (dev-сервер против локальной базы; токен только в окружении этой команды):
```bash
cd /Users/minas/projects/kotelnikovartifact
export INTERNAL_API_TOKEN=$(openssl rand -hex 32)
npx next dev -p 3050 > /tmp/next-dev-1-3c.log 2>&1 &
sleep 15
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3050/api/internal/stocks
curl -s -H "Authorization: Bearer $INTERNAL_API_TOKEN" http://localhost:3050/api/internal/stocks | head -c 300; echo
curl -s -H "Authorization: Bearer $INTERNAL_API_TOKEN" "http://localhost:3050/api/internal/orders?since=$(date -u -v-60d +%Y-%m-%dT%H:%M:%S.000Z)" | head -c 500; echo
kill %1; unset INTERNAL_API_TOKEN
```
Expected: `401`; `{"source":"wb","items":[{"barcode":"…","quantity":…}` — строк столько же, сколько `SELECT count(*) FROM wb_product_skus` (локально 172); лента заказов без имён и телефонов, `createdAt` с `Z` (на локальной базе — со сдвигом на 3 часа, Решения п. 3). `PUT` локально не вызывается: на `wb` он безвреден, но проверен тестами.

- [ ] **Step 4: Проверки и коммит.**
```bash
npx prettier --write app/api/internal/stocks/route.ts tests/unit/internal-stocks-route.test.ts
npm run lint && npm run typecheck && npm test
git add app/api/internal/stocks/route.ts tests/unit/internal-stocks-route.test.ts
git commit -m "feat(sync-api): GET/PUT /api/internal/stocks — снимок витрины и запись пула"
```
Ветка `feat/internal-sync-api` не пушится до Task 11.

---

### Task 8: sync2 — клиент и адаптер сайта

**Репозиторий:** worktree `/Users/minas/projects/sai_kotelnikovartifact-1-3c`, ветка `sync2-stage-1-3c`. Команды — из `…/sai_kotelnikovartifact-1-3c/sync2`.

**Files:**
- Create: `sync2/packages/platforms/src/site/{client,lifecycle,mapper,adapter}.ts`, `{lifecycle,mapper,adapter}.test.ts`, `fixtures/orders-sample.json`, `fixtures/stocks-sample.json`
- Modify: `sync2/packages/platforms/src/index.ts`

- [ ] **Step 1: Образцы ответов** — по контракту Task 6–7 сайта (API ещё не выложен; после выкладки в Task 11 сверить с живым ответом через `probe`).
`sync2/packages/platforms/src/site/fixtures/orders-sample.json`:
```json
{
  "orders": [
    {
      "id": "1001",
      "number": "ORD-TEST0001",
      "status": "new",
      "createdAt": "2026-09-26T07:53:00.000Z",
      "items": [
        { "lineId": "5001", "barcode": "2041383032873", "quantity": 1, "priceKopecks": 189000 },
        { "lineId": "5002", "barcode": null, "quantity": 2, "priceKopecks": 99000 }
      ]
    },
    {
      "id": "1002",
      "number": "ORD-TEST0002",
      "status": "cancelled",
      "createdAt": "2026-09-27T09:00:00.000Z",
      "items": [{ "lineId": "5003", "barcode": "2044473196868", "quantity": 1, "priceKopecks": 250000 }]
    },
    {
      "id": "1003",
      "number": "ORD-TEST0003",
      "status": "new",
      "createdAt": "2026-09-27T10:00:00.000Z",
      "items": [{ "lineId": "5004", "barcode": "4600000000011", "quantity": 1, "priceKopecks": 100000 }]
    }
  ],
  "truncated": false
}
```
`sync2/packages/platforms/src/site/fixtures/stocks-sample.json`:
```json
{
  "source": "wb",
  "items": [
    { "barcode": "2041383032873", "quantity": 2 },
    { "barcode": "2044473196868", "quantity": 0 },
    { "barcode": "4600000000011", "quantity": 1 }
  ]
}
```

- [ ] **Step 2: Падающие тесты.**
`site/lifecycle.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { siteLifecycle } from "./lifecycle"

describe("siteLifecycle", () => {
  it("new — open: заказ принят, единица держится до решения владельца", () => {
    expect(siteLifecycle("new")).toBe("open")
  })
  it("любой другой статус — returned: при сомнении не возвращаем единицу сами", () => {
    for (const s of ["cancelled", "done", "NEW", ""]) expect(siteLifecycle(s)).toBe("returned")
  })
})
```
`site/mapper.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import ordersFixture from "./fixtures/orders-sample.json" with { type: "json" }
import stocksFixture from "./fixtures/stocks-sample.json" with { type: "json" }
import type { SiteOrder, SiteStockItem } from "./client"
import { mapSiteOrders, mapSiteStocks } from "./mapper"

const wbIndex = buildWbCatalogIndex([
  { barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", nmId: 259678801, title: "Браслет", subject: "Браслеты" },
  { barcode: "2044473196868", vendorCode: "8797686554332", nmId: 1, title: "Подвеска", subject: "Подвески бижутерные" },
])
const orders = ordersFixture.orders as SiteOrder[]
const stocks = stocksFixture.items as SiteStockItem[]
const since = "2026-09-01T00:00:00.000Z"

describe("mapSiteStocks", () => {
  it("строка на каждый штрихкод сайта из каталога WB, нули включены; чужой — в пропуски", () => {
    expect(mapSiteStocks(stocks, wbIndex)).toEqual({
      stocks: [
        { barcode: "2041383032873", externalSku: null, quantity: 2, warehouse: null, raw: { barcode: "2041383032873", quantity: 2 } },
        { barcode: "2044473196868", externalSku: null, quantity: 0, warehouse: null, raw: { barcode: "2044473196868", quantity: 0 } },
      ],
      skippedNoWbBarcode: ["4600000000011"],
    })
  })
  it("остаток не ниже нуля и целый", () => {
    expect(mapSiteStocks([{ barcode: "2041383032873", quantity: -3 }], wbIndex).stocks[0]?.quantity).toBe(0)
    expect(mapSiteStocks([{ barcode: "2041383032873", quantity: 2.7 }], wbIndex).stocks[0]?.quantity).toBe(2)
  })
})

describe("mapSiteOrders", () => {
  it("позиция — строка; externalId — заказ:позиция; new → open, иное → returned", () => {
    expect(mapSiteOrders(orders, since, wbIndex).map((r) => [r.externalId, r.barcode, r.quantity, r.priceMinor, r.lifecycle])).toEqual([
      ["1001:5001", "2041383032873", 1, 189000, "open"],
      ["1001:5002", null, 2, 99000, "open"],
      ["1002:5003", "2044473196868", 1, 250000, "returned"],
      ["1003:5004", null, 1, 100000, "open"],
    ])
  })
  it("штрихкод сайта не из каталога WB — barcode null, исходный штрихкод в externalSku", () => {
    expect(mapSiteOrders(orders, since, wbIndex).find((r) => r.externalId === "1003:5004")).toMatchObject({
      barcode: null,
      externalSku: "4600000000011",
      occurredAt: "2026-09-27T10:00:00.000Z",
    })
  })
  it("заказы раньше since и с нечитаемой датой не попадают", () => {
    const broken = { ...orders[0]!, id: "999", createdAt: "вчера" }
    expect(mapSiteOrders([...orders, broken], "2026-09-27T00:00:00.000Z", wbIndex).map((r) => r.externalId)).toEqual(["1002:5003", "1003:5004"])
  })
  it("raw — только номер, статус, время и позиция", () => {
    expect(Object.keys(mapSiteOrders(orders, since, wbIndex)[0]!.raw as object).sort()).toEqual(["createdAt", "id", "item", "number", "status"])
  })
})
```
`site/adapter.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { createSiteAdapter } from "./adapter"
import { SITE_PUT_MAX_ITEMS, putSiteStocks } from "./client"
import ordersFixture from "./fixtures/orders-sample.json" with { type: "json" }
import stocksFixture from "./fixtures/stocks-sample.json" with { type: "json" }

const config = { baseUrl: "https://kotelnikovartifact.ru", token: "t".repeat(64) }
const wbIndex = buildWbCatalogIndex([
  { barcode: "2041383032873", vendorCode: "v1", nmId: null, title: "", subject: null },
  { barcode: "2044473196868", vendorCode: "v2", nmId: null, title: "", subject: null },
])
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("createSiteAdapter", () => {
  it("канал — site", () => {
    expect(createSiteAdapter(config, wbIndex).channel).toBe("site")
  })

  it("заказы: GET /api/internal/orders?since=… с Bearer-токеном", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => json(ordersFixture))
    vi.stubGlobal("fetch", fetchMock)
    const rows = await createSiteAdapter(config, wbIndex).fetchOrders("2026-09-01T00:00:00.000Z")
    expect(rows).toHaveLength(4)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://kotelnikovartifact.ru/api/internal/orders?since=2026-09-01T00%3A00%3A00.000Z")
    expect(init?.method).toBe("GET")
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${config.token}`)
  })

  it("неполный список заказов (truncated) — ошибка, а не молча урезанные заказы", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ orders: [], truncated: true })))
    await expect(createSiteAdapter(config, wbIndex).fetchOrders("2026-09-01T00:00:00.000Z")).rejects.toThrow(/неполный/)
  })

  it("неверный токен — PlatformApiError 401 без повторов", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }))
    vi.stubGlobal("fetch", fetchMock)
    const err = await createSiteAdapter(config, wbIndex)
      .fetchOrders("2026-09-01T00:00:00.000Z")
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PlatformApiError)
    expect(err).toMatchObject({ platform: "site", status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("остатки: снимок по каталогу WB и источник остатка витрины", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(stocksFixture)))
    const r = await createSiteAdapter(config, wbIndex).fetchStocks()
    expect(r.source).toBe("wb")
    expect(r.stocks.map((s) => [s.barcode, s.quantity])).toEqual([
      ["2041383032873", 2],
      ["2044473196868", 0],
    ])
    expect(r.skippedNoWbBarcode).toEqual(["4600000000011"])
  })

  it("неизвестный источник остатка — ошибка", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ source: "что-то", items: [] })))
    await expect(createSiteAdapter(config, wbIndex).fetchStocks()).rejects.toThrow(/источник остатка/)
  })
})

describe("putSiteStocks", () => {
  it("PUT абсолютных остатков пачками не больше лимита сайта; итоги суммируются", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const n = (JSON.parse(String(init?.body)) as { items: unknown[] }).items.length
      return json({ updated: n, unknown: n === 1 ? ["X"] : [], source: "wb" })
    })
    vi.stubGlobal("fetch", fetchMock)
    const items = Array.from({ length: SITE_PUT_MAX_ITEMS + 1 }, (_, i) => ({ barcode: `B${i}`, quantity: i % 3 }))
    await expect(putSiteStocks(config, items)).resolves.toEqual({ updated: SITE_PUT_MAX_ITEMS + 1, unknown: ["X"] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://kotelnikovartifact.ru/api/internal/stocks")
    expect(init?.method).toBe("PUT")
  })

  it("дубль штрихкода — ошибка до сети", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(putSiteStocks(config, [{ barcode: "A", quantity: 1 }, { barcode: "A", quantity: 2 }])).rejects.toThrow(/дубль/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("пустой список — ни одного запроса", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(putSiteStocks(config, [])).resolves.toEqual({ updated: 0, unknown: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```
Run: `npx vitest run packages/platforms/src/site` → FAIL (нет модулей).

- [ ] **Step 3: Реализация.**
`site/client.ts`:
```ts
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
```
`site/lifecycle.ts`:
```ts
import type { OrderLifecycle } from "@sync2/shared"

/**
 * Жизненный цикл заказа сайта. У сайта один статус — `new`: заказ принят,
 * его обрабатывает владелец вручную, а отмену он возвращает остатком через WB
 * (решение владельца, 1.3c). Любой другой статус, который появится позже, —
 * `returned`: правило «при сомнении — returned» (план 1.3a) — ошибка в эту
 * сторону даёт недосчёт одной единицы, в обратную — продажу несуществующей.
 */
export function siteLifecycle(status: string): OrderLifecycle {
  return status === "new" ? "open" : "returned"
}
```
`site/mapper.ts`:
```ts
import { resolveWbBarcode, type ChannelOrder, type NormalizedStock, type WbCatalogIndex } from "@sync2/shared"
import type { StockFetch } from "../adapter"
import type { SiteOrder, SiteStockItem } from "./client"
import { siteLifecycle } from "./lifecycle"

/**
 * Штрихкод сайта → штрихкод WB. У сайта это уже штрихкод WB (каталог сайта —
 * копия WB), но, как у KIT, проверяется по каталогу WB этого прогона, а не
 * принимается на веру: чужой штрихкод сделал бы товар «сиротой».
 */
function toWbBarcode(wbIndex: WbCatalogIndex, barcode: string | null): string | null {
  return barcode ? resolveWbBarcode(wbIndex, { barcodes: [barcode], sku: null }) : null
}

/**
 * Снимок остатка витрины: строка на каждый штрихкод каталога сайта, нули
 * включены (контракт снимка, план 1.3a). Штрихкод не из каталога WB — в
 * пропуски. Остаток — целый и не ниже нуля.
 */
export function mapSiteStocks(items: SiteStockItem[], wbIndex: WbCatalogIndex): StockFetch {
  const stocks: NormalizedStock[] = []
  const skippedNoWbBarcode: string[] = []
  for (const item of items) {
    const barcode = toWbBarcode(wbIndex, item.barcode)
    if (!barcode) {
      skippedNoWbBarcode.push(item.barcode)
      continue
    }
    const quantity = Number(item.quantity)
    stocks.push({
      barcode,
      externalSku: null,
      quantity: Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0,
      warehouse: null,
      raw: item,
    })
  }
  return { stocks, skippedNoWbBarcode }
}

/**
 * Заказы сайта в заказы синка — строка на позицию. `externalId` — «id
 * заказа:id позиции» (оба — id строк базы сайта). Позиция без штрихкода или
 * со штрихкодом не из каталога WB — `barcode: null` (домен считает её в
 * ordersNoBarcode), исходный штрихкод остаётся в `externalSku`. Заказы раньше
 * `since` и с нечитаемой датой пропускаются. `raw` — номер, статус, время и
 * позиция: персональных данных сайт в ленту не отдаёт.
 */
export function mapSiteOrders(orders: SiteOrder[], since: string, wbIndex: WbCatalogIndex): ChannelOrder[] {
  const sinceMs = Date.parse(since)
  const result: ChannelOrder[] = []
  for (const order of orders) {
    const createdAtMs = Date.parse(order.createdAt)
    if (Number.isNaN(createdAtMs) || createdAtMs < sinceMs) continue
    const lifecycle = siteLifecycle(order.status)
    const occurredAt = new Date(createdAtMs).toISOString()
    for (const item of order.items) {
      result.push({
        externalId: `${order.id}:${item.lineId}`,
        barcode: toWbBarcode(wbIndex, item.barcode),
        externalSku: item.barcode,
        quantity: item.quantity,
        priceMinor: item.priceKopecks,
        lifecycle,
        occurredAt,
        raw: { id: order.id, number: order.number, status: order.status, createdAt: order.createdAt, item },
      })
    }
  }
  return result
}
```
`site/adapter.ts`:
```ts
import type { WbCatalogIndex } from "@sync2/shared"
import type { ChannelAdapter, StockFetch } from "../adapter"
import { fetchSiteOrders, fetchSiteStocks, type SiteCredentials, type SiteStockSource } from "./client"
import { mapSiteOrders, mapSiteStocks } from "./mapper"

export type SiteConfig = SiteCredentials

/** Снимок сайта плюс источник его остатка: `wb` в 1.3c, `pool` — после 1.4. */
export interface SiteStockFetch extends StockFetch {
  source: SiteStockSource
}

export interface SiteAdapter extends ChannelAdapter {
  fetchStocks(): Promise<SiteStockFetch>
}

/**
 * Адаптер сайта — пятой площадки (этап 1.3c). Только чтение; запись —
 * `putSiteStocks` (client.ts), подключается к executeWrites на этапе 1.4.
 */
export function createSiteAdapter(config: SiteConfig, wbIndex: WbCatalogIndex): SiteAdapter {
  return {
    channel: "site",
    async fetchOrders(since) {
      return mapSiteOrders(await fetchSiteOrders(config, since), since, wbIndex)
    },
    async fetchStocks() {
      const r = await fetchSiteStocks(config)
      return { ...mapSiteStocks(r.items, wbIndex), source: r.source }
    },
  }
}
```
`sync2/packages/platforms/src/index.ts` — дописать:
```ts
export { createSiteAdapter, type SiteAdapter, type SiteConfig, type SiteStockFetch } from "./site/adapter"
export { putSiteStocks, SITE_PUT_MAX_ITEMS, type SiteCredentials, type SiteStockSource } from "./site/client"
```

- [ ] **Step 4: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/site && npm run typecheck && npm test
git add packages/platforms/src/site packages/platforms/src/index.ts
git commit -m "sync2: адаптер сайта — заказы и снимок витрины через служебный API"
```

---

### Task 9: sync2 — конфиг сайта, сборка адаптеров, `probe`

**Репозиторий:** worktree, ветка `sync2-stage-1-3c`.

**Files:**
- Modify: `sync2/apps/worker/src/channels-config.ts`, `channels-config.test.ts`, `adapters.ts`, `cli.ts`, `sync2/.env.example`
- Create: `sync2/apps/worker/src/adapters.test.ts`

- [ ] **Step 1: Падающие тесты.** В `channels-config.test.ts`: в ожидании теста «собирает ключи и склады четырёх площадок» добавить строку `site: null,` после `kit: …`; в конец верхнего `describe`:
```ts
  describe("сайт — только при заданном SITE_API_TOKEN", () => {
    const token = "s".repeat(64)
    it("токена нет — сайт не подключается", () => {
      expect(loadChannelsConfig(env).site).toBeNull()
    })
    it("токен есть — адрес по умолчанию", () => {
      expect(loadChannelsConfig({ ...env, SITE_API_TOKEN: token }).site).toEqual({ baseUrl: "https://kotelnikovartifact.ru", token })
    })
    it("свой адрес — без завершающего слэша", () => {
      expect(loadChannelsConfig({ ...env, SITE_API_TOKEN: token, SITE_API_URL: "https://staging.example.ru/" }).site?.baseUrl).toBe("https://staging.example.ru")
    })
    it("http — только для localhost: токен уходит в заголовке", () => {
      expect(() => loadChannelsConfig({ ...env, SITE_API_TOKEN: token, SITE_API_URL: "http://kotelnikovartifact.ru" })).toThrow(/SITE_API_URL/)
      expect(loadChannelsConfig({ ...env, SITE_API_TOKEN: token, SITE_API_URL: "http://localhost:3050" }).site?.baseUrl).toBe("http://localhost:3050")
    })
    it("не URL — ошибка с именем переменной", () => {
      expect(() => loadChannelsConfig({ ...env, SITE_API_TOKEN: token, SITE_API_URL: "kotelnikovartifact" })).toThrow(/SITE_API_URL/)
    })
    it("токен короче 32 символов — ошибка", () => {
      expect(() => loadChannelsConfig({ ...env, SITE_API_TOKEN: "short" })).toThrow(/SITE_API_TOKEN/)
    })
  })
```
`apps/worker/src/adapters.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import { buildAdapters } from "./adapters"
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
const channels = (e: Record<string, string>) =>
  buildAdapters(loadChannelsConfig(e))
    .mirrors(buildWbCatalogIndex([]))
    .map((a) => a.channel)

describe("buildAdapters", () => {
  it("без токена сайта — зеркала Ozon, ЯМ, KIT", () => {
    expect(channels(env)).toEqual(["ozon", "ym", "kit"])
  })
  it("с токеном сайта — сайт пятой площадкой", () => {
    expect(channels({ ...env, SITE_API_TOKEN: "s".repeat(64) })).toEqual(["ozon", "ym", "kit", "site"])
  })
})
```
Run: `npx vitest run apps/worker/src/channels-config.test.ts apps/worker/src/adapters.test.ts` → FAIL.

- [ ] **Step 2: Конфиг.** В `channels-config.ts`:
  - в `ChannelsConfig` после `kit: …` добавить `site: SiteChannelConfig | null`, а перед интерфейсом:
```ts
/** Сайт — служебный API (этап 1.3c); null — SITE_API_TOKEN не задан, сайт не подключается. */
export interface SiteChannelConfig {
  baseUrl: string
  token: string
}

export const DEFAULT_SITE_API_URL = "https://kotelnikovartifact.ru"
/** Тот же предел, что у INTERNAL_API_TOKEN на стороне сайта. */
const SITE_TOKEN_MIN_LENGTH = 32
```
  - перед `loadChannelsConfig`:
```ts
/**
 * Сайт подключается, только если задан SITE_API_TOKEN (= INTERNAL_API_TOKEN
 * сайта). Токен уходит в заголовке, поэтому адрес — только https (кроме
 * localhost для разработки); короткий токен — ошибка, а не тихое отключение.
 */
function optionalSite(env: Record<string, string | undefined>): SiteChannelConfig | null {
  const token = env.SITE_API_TOKEN?.trim()
  if (!token) return null
  if (token.length < SITE_TOKEN_MIN_LENGTH) throw new Error(`SITE_API_TOKEN короче ${SITE_TOKEN_MIN_LENGTH} символов`)
  const raw = env.SITE_API_URL?.trim() || DEFAULT_SITE_API_URL
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`SITE_API_URL: "${raw}" — не URL`)
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  if (url.protocol !== "https:" && !local) throw new Error(`SITE_API_URL: только https (кроме localhost), получено ${url.protocol}`)
  return { baseUrl: `${url.origin}${url.pathname}`.replace(/\/+$/, ""), token }
}
```
  - в объект `loadChannelsConfig` после `kit: …` добавить `site: optionalSite(env),`; в шапочном комментарии файла «четырёх площадок» → «площадок (сайт — необязательный, этап 1.3c)».

- [ ] **Step 3: Сборка адаптеров.** В `adapters.ts` импорт дополнить `createSiteAdapter`, а `mirrors` заменить на:
```ts
    mirrors: (index) => [
      createOzonAdapter(cfg.ozon, index),
      createYmAdapter(cfg.ym, index, cfg.ym.warehouseIds),
      createKitAdapter(cfg.kit, index),
      // Сайт — пятая площадка (этап 1.3c), только при заданном SITE_API_TOKEN.
      ...(cfg.site ? [createSiteAdapter(cfg.site, index)] : []),
    ],
```
Run → зелёные.

- [ ] **Step 4: `probe`.** В `cli.ts`:
  - в импорт из `@sync2/platforms` добавить `createSiteAdapter`;
  - в `USAGE` строку `probe …` заменить на `  probe                  живое чтение площадок (WB, Ozon, ЯМ, KIT; сайт — если задан SITE_API_TOKEN) без базы и записи`;
  - после `channels.push({ channel: "kit", adapter: createKitAdapter(config.kit, wbIndex) })`:
```ts
  // Сайт — пятая площадка (этап 1.3c), только при заданном SITE_API_TOKEN.
  if (config.site) channels.push({ channel: "site", adapter: createSiteAdapter(config.site, wbIndex) })
  else console.log("site | пропущен: SITE_API_TOKEN не задан")
```
  - в цикле сразу после `printChannelSummary(channel, orders, stocks)`:
```ts
        if ("source" in stocks) console.log(`${channel} | источник остатка витрины: ${String(stocks.source)}`)
```
  - в комментарии над `runProbe` «четырёх площадок» → «площадок».

- [ ] **Step 5: `.env.example`** — в конец:
```
# Сайт kotelnikovartifact.ru (этап 1.3c) — служебный API сайта. Без токена сайт в синк не подключается.
# SITE_API_TOKEN = INTERNAL_API_TOKEN из .env сайта (201.34.133.76), не короче 32 символов; не печатать.
SITE_API_URL=https://kotelnikovartifact.ru
SITE_API_TOKEN=
```

- [ ] **Step 6: Проверки и коммит.**
```bash
npm run typecheck && npm test
git add apps/worker/src/channels-config.ts apps/worker/src/channels-config.test.ts apps/worker/src/adapters.ts apps/worker/src/adapters.test.ts apps/worker/src/cli.ts .env.example
git commit -m "sync2: сайт в конфиге площадок, ingest и probe — при заданном SITE_API_TOKEN"
```

---

### Task 10: sync2 — отдельный план сайта в `pool`, строка «Сайт ↔ пул» в сводке, README

**Репозиторий:** worktree, ветка `sync2-stage-1-3c`.

**Files:**
- Modify: `sync2/apps/worker/src/jobs/pool.ts`, `pool.db.test.ts`, `sync2/packages/db/src/runs-query.ts`, `runs-query.db.test.ts`, `sync2/apps/worker/src/jobs/compare-v1.ts`, `compare-v1.test.ts`, `sync2/README.md`

- [ ] **Step 1: Падающие тесты пула** — в `pool.db.test.ts`: импорт `import { eq } from "drizzle-orm"` заменить на `import { and, eq } from "drizzle-orm"`; в конец `describe("после seed-channels"` (после теста «ошибки в итогах записи…»):
```ts
    it("сайт — отдельный план: свежий снимок сайта в журнале с режимом off, на площадки ничего", async () => {
      const sid = await runId()
      await insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: sid, takenAt: "2026-09-27T10:55:00.000Z", stocks: [s("A", 3), s("B", 1)] })
      await insertStockSnapshot(h.db, { channelId: ids.get("site")!.id, runId: sid, takenAt: "2026-09-27T10:55:00.000Z", stocks: [s("A", 5), s("B", 1)] })
      const pid = await runId()
      const r = await runPool({ db: h.db, now: () => new Date("2026-09-27T11:00:00.000Z"), runId: pid, globalMode: "dry-run" })
      expect(r.status).toBe("ok")
      expect(r.counters).toMatchObject({ sitePlanned: 1 })
      expect(r.counters).not.toHaveProperty("siteStale")
      const logged = await h.db.select().from(writes).where(and(eq(writes.runId, pid), eq(writes.channelId, ids.get("site")!.id)))
      expect(logged.map((w) => [w.barcode, w.before, w.after, w.mode, w.applied])).toEqual([["A", 5, 3, "off", false]])
    })

    it("сайт упёрся в предохранитель — план сайта отклонён, план KIT всё равно записан, partial", async () => {
      const sid = await runId()
      await insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: sid, takenAt: "2026-09-27T11:05:00.000Z", stocks: [s("A", 3), s("B", 1)] })
      await insertStockSnapshot(h.db, { channelId: ids.get("kit")!.id, runId: sid, takenAt: "2026-09-27T11:05:00.000Z", stocks: [s("A", 1), s("B", 1)] })
      // 21 баркод сайта, которых нет в пуле, с остатком — 21 «в ноль» при пределе 20.
      const orphans = Array.from({ length: 21 }, (_, i) => s(`Z${i}`, 1))
      await insertStockSnapshot(h.db, { channelId: ids.get("site")!.id, runId: sid, takenAt: "2026-09-27T11:05:00.000Z", stocks: orphans })
      const r = await runPool({ db: h.db, now: () => new Date("2026-09-27T11:10:00.000Z"), runId: await runId(), globalMode: "dry-run" })
      expect(r.status).toBe("partial")
      expect(r.counters).toMatchObject({ siteAborted_to_zero: 21, kitPlanned: 1, sitePlanned: 0 })
      expect(r.error).toMatch(/сайт: план отклонён предохранителем/)
    })
```
(Пул к этим тестам: `A = 3`, `B = 1` — холодный старт от снимка WB 10:05 в тесте «холодный старт при не-ok…»; снимок KIT 10:45 из теста «ошибки в итогах записи» к 11:00 ещё свежий — KIT `A 1→3` в первом тесте тоже планируется, но проверяются только строки сайта.)
Run: `npm run test:db -- apps/worker/src/jobs/pool.db.test.ts` → FAIL (сайт не планируется).

- [ ] **Step 2: Пул.** `apps/worker/src/jobs/pool.ts`:
  - импорт из `@sync2/domain` дополнить `type StockChange`;
  - после `const MIRRORS = ["ozon", "ym", "kit"] as const`:
```ts
/**
 * Сайт планируется отдельно от зеркал (этап 1.3c): его остаток в 1.3c — витрина
 * с источником WB (синк сайта раз в 3 часа), и расхождение с пулом там обычно.
 * В общем вызове planStockWrites баркоды сайта считались бы вместе с Ozon/ЯМ/KIT,
 * и сайт мог бы отклонить план всех зеркал. Отдельный вызов — свои пределы и свой
 * отказ. Режим записи сайта в 1.3c — off: строки плана попадают в журнал с
 * mode = 'off' — это и есть расхождение витрины с пулом (сводка compare-v1).
 */
const SITE = "site" as const
```
  - `const missing = (["wb", ...MIRRORS] as const)…` → `const missing = (["wb", ...MIRRORS, SITE] as const)…`;
  - весь хвост функции, начиная со строки `const plan = planStockWrites(…)`, заменить на:
```ts
  const limits = { maxChanges: MAX_STOCK_CHANGES_PER_RUN, maxToZero: MAX_STOCK_TO_ZERO_PER_RUN }
  const plan = planStockWrites(result.items, mirrors, limits)
  if (plan.aborted) {
    counters[`aborted_${plan.aborted.reason}`] = plan.aborted.count
    return { status: "partial", counters }
  }

  let siteChanges: StockChange[] = []
  let siteAborted: string | null = null
  const siteSnap = snaps.get(channelId(SITE))
  if (!siteSnap || !fresh(siteSnap.takenAt)) {
    counters.siteStale = 1
  } else {
    const sitePlan = planStockWrites(result.items, [{ channel: SITE, stocks: siteSnap.stocks }], limits)
    if (sitePlan.aborted) {
      counters[`siteAborted_${sitePlan.aborted.reason}`] = sitePlan.aborted.count
      siteAborted = `сайт: план отклонён предохранителем (${sitePlan.aborted.reason}: ${sitePlan.aborted.count} при пределе ${sitePlan.aborted.max})`
    } else {
      siteChanges = sitePlan.changes
    }
  }

  const ops: WriteOp[] = [...plan.changes, ...siteChanges].map((c) => ({ channel: c.channel, barcode: c.barcode, field: "stock", before: c.before, after: c.after }))
  const channelModes = Object.fromEntries(CHANNELS.map((c) => [c, channels.get(c)?.writeMode ?? "off"])) as Record<Channel, WriteMode>
  const outcomes = await executeWrites(ops, { globalMode: deps.globalMode, channelModes, send: noSender, record: drizzleWriteStore(db, runId, channels) })
  for (const c of [...MIRRORS, SITE]) counters[`${c}Planned`] = outcomes.filter((o) => o.channel === c).length

  const problems: string[] = []
  if (siteAborted) problems.push(siteAborted)
  const failed = outcomes.filter((o) => o.error !== null)
  if (failed.length > 0) {
    counters.writeErrors = failed.length
    const shown = failed.slice(0, MAX_WRITE_ERRORS_SHOWN).map((o) => `${o.channel} ${o.barcode}: ${o.error}`)
    const rest = failed.length > shown.length ? `; … ещё ${failed.length - shown.length}` : ""
    problems.push(`ошибки записи: ${shown.join("; ")}${rest}`)
  }
  if (problems.length > 0) return { status: "partial", counters, error: problems.join("; ") }
  return { status: "ok", counters }
}
```
Run: `npm run test:db -- apps/worker/src/jobs/pool.db.test.ts` → все зелёные (прежний тест «ошибки в итогах записи» по-прежнему находит `kit A: запись на площадки подключается на этапе 1.4`; «снимок зеркала старше 20 минут» — `staleSnapshots: 3`, сайт считается отдельно, `siteStale: 1`).

- [ ] **Step 3: Падающие тесты сводки.** В `packages/db/src/runs-query.db.test.ts`, в тесте «запланированные записи за период…», после `expect(planned).toMatchObject({ … })`:
```ts
    // Режим off отдельно — так сводка показывает план сайта (его запись в 1.3c выключена).
    const off = await plannedWritesSince(h.db, "2026-09-01T00:00:00.000Z", ["off"])
    expect(off).toMatchObject({ ym: { barcodes: 1, rows: 1 }, ozon: { barcodes: 0, rows: 0 } })
```
В `apps/worker/src/jobs/compare-v1.test.ts`: в `extra()` добавить `siteDiff: { barcodes: 0, rows: 0 },` после `suspectedDoubleCounts: 0,`; в `describe("formatComparison"`:
```ts
  it("расхождение витрины сайта с пулом — отдельной строкой", () => {
    const text = formatComparison({ same: 1, diff: [], onlyV1: [], onlyV2: [] }, extra({ siteDiff: { barcodes: 3, rows: 18 } }))
    expect(text).toContain("Сайт ↔ пул за сутки (витрина не меняется, записи off; баркодов/строк): 3/18")
  })
```
Run: `npm run test:db -- packages/db/src/runs-query.db.test.ts && npx vitest run apps/worker/src/jobs/compare-v1.test.ts` → FAIL.

- [ ] **Step 4: Сводка.**
  - `packages/db/src/runs-query.ts`: импорт `@sync2/shared` дополнить `type WriteMode`; функцию заменить на:
```ts
/**
 * План записей начиная с sinceIso, по площадкам; без строк — нули. По умолчанию
 * только dry-run; ["off"] — план площадок с выключенной записью (сайт в 1.3c):
 * это расхождение их остатка с пулом, а не записи. Главное число — разные
 * баркоды: пока площадку не выровняли, одна и та же запись планируется каждым
 * тиком, и строк за сутки в разы больше, чем изменений.
 */
export async function plannedWritesSince(db: Db, sinceIso: string, modes: readonly WriteMode[] = ["dry-run"]): Promise<Record<Channel, PlannedWrites>> {
  const out = Object.fromEntries(CHANNELS.map((c) => [c, { barcodes: 0, rows: 0 }])) as Record<Channel, PlannedWrites>
  const rows = await db
    .select({ code: channels.code, barcodes: countDistinct(writes.barcode), rows: count() })
    .from(writes)
    .innerJoin(channels, eq(writes.channelId, channels.id))
    .where(and(gte(writes.createdAt, sinceIso), inArray(writes.mode, [...modes])))
    .groupBy(channels.code)
  for (const r of rows) if (isChannel(r.code)) out[r.code] = { barcodes: r.barcodes, rows: r.rows }
  return out
}
```
  - `apps/worker/src/jobs/compare-v1.ts`: в `SummaryExtra` после `suspectedDoubleCounts: number`:
```ts
  /** Расхождение витрины сайта с пулом за сутки: план сайта в журнале с mode = 'off' (этап 1.3c). */
  siteDiff: PlannedWrites
```
    в `formatComparison` после строки `` `План записей за сутки (dry-run, …` ``:
```ts
    `Сайт ↔ пул за сутки (витрина не меняется, записи off; баркодов/строк): ${extra.siteDiff.barcodes}/${extra.siteDiff.rows}`,
```
    в `runCompareV1` в деструктуризацию после `suspectedDoubleCounts` добавить `offPlanned`, в `Promise.all` после `countSuspectedDoubleCounts(db, since),` — `plannedWritesSince(db, since, ["off"]),`; вызов `formatComparison(result, { … })` дополнить `siteDiff: offPlanned.site`.
Run → зелёные.

- [ ] **Step 5: README** — после раздела про 1.3b:
```md
## Сайт — служебный API (этап 1.3c)

- Адаптер `packages/platforms/src/site/`: `GET /api/internal/orders?since=` и `GET /api/internal/stocks` сайта
  kotelnikovartifact.ru (репозиторий `kotelnikovartifact`), `Authorization: Bearer $SITE_API_TOKEN` — это
  `INTERNAL_API_TOKEN` из `.env` сайта. Подключается в `ingest` и `probe`, только если задан `SITE_API_TOKEN`
  (не короче 32 символов); `SITE_API_URL` — по умолчанию `https://kotelnikovartifact.ru`, только https (кроме localhost).
- Жизненный цикл: у сайта один статус `new` → `open`; любой другой → `returned` (отмены владелец возвращает через WB).
  `truncated` в ответе заказов — ошибка адаптера (`ingest` → `partial`), а не частичный список.
- Снимок: строка на каждый штрихкод каталога сайта, нули включены; штрихкод не из каталога WB — в `siteSkipped`.
  `source` — откуда витрина берёт остаток: `wb` (1.3c) или `pool` (после 1.4); `probe` его печатает.
- `pool` планирует сайт отдельным вызовом `planStockWrites` со своими пределами — счётчики `sitePlanned`, `siteStale`,
  `siteAborted_<причина>` (+ `partial` с текстом); план Ozon/ЯМ/KIT от сайта не зависит. `channels.write_mode` сайта —
  `off`: строки плана пишутся в `writes` с `mode = 'off'` — это расхождение витрины с пулом. В сводке `compare-v1` —
  строка «Сайт ↔ пул за сутки»; прежняя строка плана считает только `dry-run`.
- Заказ сайта в режиме WB `external`: старый синк его не знает и WB не списывает, поэтому сигнал WB через
  `WB_SETTLE_MINUTES` вернёт единицу в пул, если владелец не снял её на WB руками. В 1.4 заказ сайта уйдёт на WB сам.
- Запись `putSiteStocks` (`PUT /api/internal/stocks`, абсолютные значения, пачками по 5000) есть, но к `pool` не
  подключена: отправитель — `noSender` до 1.4.
```
В пункте про `compare-v1` раздела 1.3b строку «план записей за сутки — … только `mode = 'dry-run'`» дополнить: «; план сайта (`mode = 'off'`) — отдельной строкой «Сайт ↔ пул»».

- [ ] **Step 6: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add apps/worker/src/jobs/pool.ts apps/worker/src/jobs/pool.db.test.ts packages/db/src/runs-query.ts packages/db/src/runs-query.db.test.ts apps/worker/src/jobs/compare-v1.ts apps/worker/src/jobs/compare-v1.test.ts README.md
git commit -m "sync2: сайт в пуле — отдельный план со своими предохранителями, строка «Сайт ↔ пул» в сводке"
```

---

### Task 11: Выкладка — только с «да» владельца на каждом внешнем шаге

Перед каждым шагом с пометкой **[«да»]** — показать владельцу команду и что она изменит, дождаться явного «да». Токены не печатаются ни в терминал, ни в отчёт.

**(а) Сайт**

- [ ] **Step 1 [«да»]: ветка и PR.** Ревью ветки (`superpowers:requesting-code-review`), затем:
```bash
cd /Users/minas/projects/kotelnikovartifact
git push -u origin feat/internal-sync-api
gh pr create --repo webkoth/kotelnikovartifact-store --base main --head feat/internal-sync-api \
  --title "Служебный API для синка v2 (этап 1.3c)" \
  --body "GET /api/internal/orders, GET/PUT /api/internal/stocks за Bearer-токеном; pool_stocks и STOCK_SOURCE (на проде остаётся wb — витрина не меняется); штрихкод WB в позиции заказа. План: sai_kotelnikovartifact/docs/superpowers/plans/2026-09-27-sync2-stage-1-3c-api-saita.md"
gh pr checks --watch --repo webkoth/kotelnikovartifact-store
```
Expected: `checks` зелёный (lint, typecheck, unit). Красный — чинить в ветке, не мержить.

- [ ] **Step 2 [«да», делает владелец на 201.34.133.76]: окружение до мержа** (merge = автодеплой, новый код должен стартовать уже с токеном):
```bash
cd /var/www/kotelnika-store
grep -q '^INTERNAL_API_TOKEN=' .env || printf 'INTERNAL_API_TOKEN=%s\n' "$(openssl rand -hex 32)" >> .env
grep -q '^STOCK_SOURCE=' .env || printf 'STOCK_SOURCE=wb\n' >> .env
grep -c '^INTERNAL_API_TOKEN=' .env; awk -F= '/^INTERNAL_API_TOKEN=/{print length($2)}' .env; grep '^STOCK_SOURCE=' .env
```
Expected: `1`, `64`, `STOCK_SOURCE=wb`. Значение токена не выводится.

- [ ] **Step 3 [СТОП — «да» владельца на merge]: слияние = выкладка на прод.**
```bash
gh pr merge --merge --repo webkoth/kotelnikovartifact-store feat/internal-sync-api
# через 10–20 с, когда в списке появится прогон по main:
gh run watch --repo webkoth/kotelnikovartifact-store $(gh run list --repo webkoth/kotelnikovartifact-store --branch main --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: `checks` и `deploy` зелёные; в логе deploy — `Applying migration: 010-internal-sync-api.sql`, `Deploy complete`.

- [ ] **Step 4: Проверка прода без токена** (только чтение):
```bash
for p in /api/internal/stocks "/api/internal/orders?since=2026-09-01T00:00:00.000Z"; do curl -s -o /dev/null -w "%{http_code} $p\n" "https://kotelnikovartifact.ru$p"; done
curl -s https://kotelnikovartifact.ru/api/health | head -c 200; echo
curl -s -o /dev/null -w "%{http_code} /catalog\n" https://kotelnikovartifact.ru/catalog
```
Expected: `401` на оба служебных, `"status":"ok"`, `200 /catalog`. Владелец на сервере (только чтение):
```bash
cd /var/www/kotelnika-store && set -a && . ./.env && set +a && psql "$DATABASE_URL" -X -A -F ' | ' \
  -c "SELECT count(*) FILTER (WHERE barcode IS NULL) AS without_barcode, count(*) AS lines FROM order_items" \
  -c "SELECT count(*) AS pool_rows FROM pool_stocks"
```
Expected: `without_barcode` — только неоднозначные строки (позиции без размера у товара с несколькими размерами), `pool_rows = 0`. Витрина глазами: каталог и карточка браслета с размерами — как до выкладки.

**(б) sync2**

- [ ] **Step 5 [«да»]: слияние ветки sync2** (после ревью `superpowers:requesting-code-review`):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git merge --no-ff sync2-stage-1-3c -m "sync2: этап 1.3c — сайт пятой площадкой"
cd sync2 && npm run typecheck && npm test && npm run test:db
```

- [ ] **Step 6 [«да»]: выкладка кода sync2** — не в минуты крона (`1,11,…,51` sync2; `3,8,…,58` и `:00/:30` старого синка):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact/sync2 && npm run deploy
```
Без `SITE_API_TOKEN` поведение VPS не меняется: сайт не подключён, `pool` пишет `siteStale: 1`.

- [ ] **Step 7 [«да»]: токен на VPS sync2 без вывода в терминал.** Вариант А — у владельца есть ssh на оба сервера с Mac (`SITE_SSH` — его логин на 201.34.133.76, тот же, что `DEPLOY_USER` в секретах GitHub):
```bash
ssh "$SITE_SSH@201.34.133.76" 'grep "^INTERNAL_API_TOKEN=" /var/www/kotelnika-store/.env' \
  | sed 's/^INTERNAL_API_TOKEN=/SITE_API_TOKEN=/' \
  | ssh root@147.45.171.40 'cd /opt/sync2 && grep -v "^SITE_API_TOKEN=" .env > .env.new && cat >> .env.new && chmod 600 .env.new && mv .env.new .env'
```
Вариант Б — вручную: владелец копирует значение на сервере сайта (`grep '^INTERNAL_API_TOKEN=' /var/www/kotelnika-store/.env | cut -d= -f2-` — только на своём экране) и вставляет на VPS sync2 в скрытый ввод:
```bash
ssh -t root@147.45.171.40 'read -rs T && printf "SITE_API_TOKEN=%s\n" "$T" >> /opt/sync2/.env && unset T'
```
Проверка (печатает только число строк и длину):
```bash
ssh root@147.45.171.40 'grep -c "^SITE_API_TOKEN=" /opt/sync2/.env; awk -F= "/^SITE_API_TOKEN=/{print length(\$2)}" /opt/sync2/.env'
```
Expected: `1`, `64`.

- [ ] **Step 8: `probe` на VPS** (только чтение; не в минуты кронов):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts probe'
```
Expected: строки WB/Ozon/ЯМ/KIT как в 1.3b и
`site | заказов: N (open=N, shipped=0, cancelled_before_ship=0, returned=0) | строк остатков: ≈ число штрихкодов сайта | … | пропусков без штрихкода WB: единицы` и `site | источник остатка витрины: wb`. Сверить `строк остатков` с `SELECT count(*) FROM wb_product_skus` на проде сайта; пропуски — перечислить в отчёте (штрихкоды сайта, которых нет в текущем каталоге WB).

- [ ] **Step 9: Ручной `tick` под блокировкой крона и журнал:**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts tick; node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts runs 4'
```
Expected: `ingest ok` со счётчиками `siteOrders`, `siteStock`, `siteSkipped`; `pool ok` с `sitePlanned` (баркоды, где витрина расходится с пулом) и без `siteStale`. `partial` — разобрать по `runs.error` до приёмки.

- [ ] **Step 10: Приёмка — двое суток.** Раз в сутки — сводка `compare-v1` (строка «Сайт ↔ пул за сутки») и список расхождений последнего прогона:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && set -a && . ./.env && set +a && psql "$DATABASE_URL" -X -A -F " | "' <<'SQL'
select w.barcode, w.before as site, w.after as pool
from writes w join channels c on c.id = w.channel_id
where c.code = 'site'
  and w.run_id = (select run_id from runs where job = 'pool' and status in ('ok', 'partial') order by started_at desc limit 1)
order by w.barcode;
SQL
```
Каждое расхождение объяснить одним из: (1) отставание витрины — синк остатков сайта раз в 3 часа (в `:00` МСК), расхождение уходит после ближайшего прогона; (2) заказ сайта или зеркала за последние ≤ 40 минут (settle WB); (3) размер с несколькими штрихкодами (Task 0); (4) товар, у которого агрегат расходится с суммой размеров (Task 0, `products_stock_mismatch`). Расхождение, пережившее два цикла синка сайта без объяснения, — разбор до 1.4. Итог — таблица «сутки → расхождений → объяснено» в «Ход выполнения» этого плана и в README `sync2`. Решение о 1.4 принимает владелец.

**Откат.** sync2 — `ssh root@147.45.171.40 'sed -i "/^SITE_API_TOKEN=/d" /opt/sync2/.env'` (сайт отключается со следующего тика). Сайт — revert-PR с «да» владельца; до него служебный API безвреден: витрина на `STOCK_SOURCE=wb`, `pool_stocks` не читается, `order_items.barcode` читает только API.

---

## Готово, когда

- Сайт: PR слит и выложен; `/api/internal/*` без токена — `401`, с токеном из `sync2` — `200`; `GET /api/internal/stocks` отдаёт `source: "wb"`; витрина (каталог, карточки, размеры, оформление заказа) ведёт себя как до выкладки; новые заказы пишутся со штрихкодом.
- Все тесты зелёные: сайт — `npm run lint`, `npm run typecheck`, `npm test`; `sync2` — `npm run typecheck`, `npm test`, `npm run test:db`.
- На VPS `probe` читает сайт; каждый `tick` пишет заказы и снимок сайта; `pool` планирует сайт отдельно, строки сайта в `writes` — `mode = 'off'`, `applied = false`; на сайт не уходит ни одного `PUT`.
- Двое суток `dry-run` с сайтом в пуле, все расхождения «витрина ↔ пул» объяснены; сводка приходит с строкой «Сайт ↔ пул».

## Самопроверка по спеке

| Спека | Где покрыто |
|---|---|
| §5 таблица: «Сайт — `GET /api/internal/orders?since=` / `PUT /api/internal/stocks`» | Task 6, Task 7; плюс `GET /api/internal/stocks` для сверки снимком (контракт снимка 1.3a) |
| §5 «два служебных эндпоинта с токеном в заголовке» | Task 5 (`Authorization: Bearer`, `timingSafeEqual` по SHA-256, 401 без подсказок) |
| §5 «отключить `sync-stocks` и `sync-prices` на сайте» | **не в 1.3c**: `sync-stocks` остаётся писателем `wb_stock_items` (нужен режиму `wb` и откату), агрегат переходит к пулу переключателем `STOCK_SOURCE` в 1.4; `sync-prices` — этап 2 (цены) |
| §5 жизненный цикл, «только `cancelled_before_ship` даёт +1» | Task 8: `new` → `open`, иное → `returned`; `cancelled_before_ship` сайт не даёт никогда (отмены — через WB) |
| §5 контракт снимка: нули, ключ — штрихкод WB, `quantity ≥ 0` | Task 7 (нули по всем штрихкодам), Task 8 (`resolveWbBarcode`, `max(0, trunc)`) |
| §5 ограничители (120 / 20 в ноль) | Task 10: для сайта — отдельный вызов с теми же пределами |
| §3 сеть только в `packages/platforms`, запись только через `executeWrites` | Task 8 (`site/client.ts`), `putSiteStocks` не подключён, `noSender` |
| §3 деньги — копейки | Task 6 (`round(price * 100)::int` в SQL), Task 8 (`priceMinor = priceKopecks`) |
| §10 контрактные тесты адаптера на записанных ответах | Task 8 (фикстуры по контракту; сверка с живым ответом — Task 11, Step 8) |
| §10 `compare-v1` на время параллельного режима | Task 10 (строка «Сайт ↔ пул») |
| §11 этап 1: «адаптеры пяти площадок на чтение; пул в `dry-run` рядом с v1» | Task 8–11 — пятая площадка |
| §12 «статусы заказов сайта для `cancelled_before_ship`/`returned`» | закрыт решением владельца: `new` → `open`, иное → `returned` |
| Персональные данные | Task 6: не выбираются из базы (тест на текст SQL); Task 8: `raw` без них |

## Открытые вопросы

1. **Как владелец сейчас отражает заказ сайта на WB?** Если снимает единицу на WB руками — пул и старый синк сходятся; если нет — пул вычитает заказ сайта, а через 20 минут сигнал WB его возвращает. На `dry-run` это не влияет, но от ответа зависит, как читать сводку в приёмке.
2. **Прокси перед сайтом** (nginx на 201.34.133.76): пропускает ли `PUT` с телом до ~250 КБ (5000 позиций) — в 1.3c `PUT` с VPS не вызывается; проверить `client_max_body_size` перед 1.4. Ограничить `/api/internal/` по IP VPS sync2 в nginx — дополнительная защита на решение владельца.
3. **Размеры с несколькими штрихкодами на проде** (Task 0): если есть — в `wb` остаток размера показывается на минимальном штрихкоде, а WB хранит остаток по каждому; решить до 1.4, какой штрихкод держит остаток в пуле.
4. **Товары без размеров на сайте** (карточки, для которых `sync-products` ещё не записал размеры): их нет ни в снимке, ни в пуле-на-сайте; в `pool` такой товар скрыт. Число — из Task 0 (`products_stock_mismatch` частично это показывает).

## Заметки к плану 1.4

- Переключение витрины на пул: сначала полный `PUT` всех штрихкодов пула (сайт — отправитель `putSiteStocks`, `write-mode site dry-run` → `apply`), затем `recalcProductStocksFromPool("all")` (скрипт или разовый вызов), и только потом `STOCK_SOURCE=pool` + `pm2 reload ecosystem.config.cjs --update-env`. Иначе товары без строк в `pool_stocks` покажут 0.
- После переключения `sync-products` по-прежнему считает `computeTotalStocks` (запросы к WB) впустую — убрать или оставить для режима `wb`/отката.
- Лента заказов: при росте числа заказов — постраничность вместо ошибки на `truncated`.
- Ретенция `writes`: строки сайта с `mode = 'off'` добавляются каждым тиком, пока витрина расходится с пулом.
- Заказ сайта в режиме WB `self` уходит на WB через `sync2` — проверить на первом реальном заказе после переключения.

## Ход выполнения

**Task 0 (28.09.2026, только чтение).** Прод-база сайта: `TimeZone = Etc/UTC`, `now()::timestamp = now() AT TIME ZONE 'UTC'` →
`ORDERS_DB_TIME_ZONE = "UTC"` подтверждён (сверка с Telegram не нужна). `sizes_multi_barcode = 0` — открытый вопрос 3 закрыт;
`products_multi_size = 17` (браслеты с размерами); заказов на сайте 1 (позиция без размера); `products_stock_mismatch = 0`;
штрихкодов каталога сайта 422. На сервере `WB_WRITE_MODE=live`, `STOCK_SOURCE` и `INTERNAL_API_TOKEN` ещё нет. VPS sync2 →
`https://kotelnikovartifact.ru/api/health` = `200`.

**Открытый вопрос 1 закрыт владельцем (28.09):** после заказа на сайте единицу на WB снимают вручную — сигнал WB подтверждает
списание пула, двойного возврата нет. Доступ к серверу сайта — `ssh root@201.34.133.76`.

**Выкладка 28.09.2026 (Task 11).** Сайт: PR #9 (`webkoth/kotelnikovartifact-store`, 15 коммитов, 597 тестов, CI и CodeRabbit
зелёные) слит владельцем, автодеплой 08:40 UTC — миграция 010 применена; `/api/internal/*` без токена → 401, `/catalog` → 200,
`/api/health` ok; `order_items` 1/1 со штрихкодом, `pool_stocks` пуст; в `.env` сайта `INTERNAL_API_TOKEN` (64) и `STOCK_SOURCE=wb`,
копия прежнего `.env` — `/root/kotelnika-env.bak-20260928`. sync2: `b639586` в main (сверх плана — базовая точка заказов по
площадке для холодного старта новой площадки у живого пула, миграция `0002`; выкладка под `flock` крона), выложен 08:21 UTC,
токен перенесён сервер→сервер без вывода (`SITE_API_TOKEN`, 64; копия `.env` — `/opt/sync2/logs/.env.bak-20260928`).
`probe`: сайт — 1 заказ (open), 421 строка остатков, пропуск 1 штрихкода (`2042327282309`, нет в текущем каталоге WB), источник `wb`.
Первый тик с сайтом 08:44: `siteOrdersBaseline: 1` (точка только у сайта), старый заказ сайта — событие `order` `delta 0`
`{coldStart: "channel"}`, `sitePlanned: 0` — витрина совпадает с пулом. `ingest partial` — WB `/api/v3/orders` отвечал 500
(сбой WB, 08:41–08:44), остальные площадки прочитаны.

**Заметки к 1.4 из ревью сайта:** опечатка в `STOCK_SOURCE` роняет витрину — проверять значение в `scripts/deploy.sh` до сборки;
в `pool` пересчёт агрегата после `PUT` — в той же транзакции, `syncStocks` в `pool` вызывает `recalcProductStocksFromPool("all")`
(самоисцеление дрейфа); `revalidate("/catalog")` не помечает страницы товаров; `client_max_body_size` nginx для `PUT` 5000 позиций.
