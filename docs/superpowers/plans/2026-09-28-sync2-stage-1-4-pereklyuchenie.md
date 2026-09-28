# Синк v2 · этап 1.4 — переключение: sync2 пишет остатки, старый синк отключается

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sync2` становится единственным писателем остатков на пяти площадках. Два шага: **A** — сайт (старый синк сайт не пишет, конфликта писателей нет): полный PUT пула, витрина на `STOCK_SOURCE=pool`, запись сайта в `apply`; **B** — WB, Ozon, ЯМ, KIT разом в одном окне между тиками: строки `orders`/`stocks` старого синка в кроне закомментированы, WB в режиме `self`, площадки в `apply`. После B — суточная сводка «пул ↔ площадки» вместо `compare-v1`, ретенция журнала, документированный и отрепетированный откат.

**Architecture:** Писатель остатка на каждую площадку — `packages/platforms/src/<площадка>/stock-writer.ts` (абсолютные значения, пачки по лимитам API, итог по каждой позиции: применено / отказ / итог неизвестен). `WriteOp` несёт ключ площадки `externalSku` (chrtId WB — из каталога, `products.wb_chrt_id`; offer_id Ozon; offerId ЯМ; id варианта KIT; у сайта — штрихкод). `apps/worker/src/senders.ts` собирает их в один `Sender` для `executeWrites`. `pool` планирует **каждую площадку отдельным вызовом** `planStockWrites` со своими предохранителями (120 / 20 в ноль), WB — первым; блокирует запись при сбое чтения заказов зеркал, при витрине сайта не на пуле, при чужом складе WB; в режиме WB `self` — `wbWriteGate` → `reconcilePool(settle 2)` → предварительная фиксация пула с итогом «неизвестно» для WB-позиций → запись (WB-отправитель перечитывает остаток перед записью и проверяет чтением после) → `applyWbWriteOutcomes` по фактическим итогам → финальная фиксация. Режим WB `self` не отдельный переключатель: он действует ровно тогда, когда у WB действующий `apply`. CLI: `plan`, `write-mode … apply --confirm` с предпросмотром, `site-push-all --confirm`, `check-wb`, `drift`, `prune`. Сайт (отдельный репозиторий): проверка `STOCK_SOURCE` в выкладке, пересчёт агрегата в транзакции `PUT`, самоисцеление в `syncStocks`, разовый `recalc-pool-stocks`.

**Tech Stack:** как в 1.1–1.3c. `sync2`: TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Vitest 4 (проекты `unit`/`db`), Drizzle 0.45 + postgres.js, `tsx`. Сайт: Next.js 16.2.6, Drizzle 0.45, zod 4, Vitest 4, Prettier (без `;`, двойные кавычки, `printWidth: 80`).

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md` §5 (остатки, таблица записи, ограничители), §3 (запись только через выключатель, лимиты), §9–10 (сводка, наблюдаемость), §11 (порядок). **Решение владельца:** `business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md` — п. 4 (продажи других площадок на WB руками не снимать), п. 5, п. 18 (многоразмерные). **Заметки к 1.4:** концы планов 1.1, 1.2 («Контракт адаптеров», «Поправки при исполнении»), 1.3a, 1.3b («Ход выполнения и заметки к 1.4»), 1.3c («Заметки к плану 1.4», «Заметки к 1.4 из ревью сайта»).

---

## Факты, проверенные при написании плана (28.09.2026, только чтение)

- **VPS 147.45.171.40, база `sync2`:** за сутки `ingest ok` 134 (в среднем 15,2 с, максимум 26,9 с), `ingest partial` 3 (≈176 с — WB `/api/v3/orders` отвечал 500, повторы 10+30+60+60 с), `pool ok` 137 (0,3 с). Память `available` 279 МБ, диск 20 ГБ свободно.
- **Склад WB продавца один — `1408913`** (все 421 строки снимка WB). **Дублей ключа площадки нет:** ни на одной площадке нет штрихкода WB с двумя разными `externalSku`.
- **Снимок WB несёт `chrtId` только у 328 из 421 строки** — у нулевых WB строку не отдаёт. Ключ записи WB (`chrtId`) нужен из каталога (`content/v2/get/cards/list` → `sizes[].chrtID`).
- **Спецификация WB `PUT /api/v3/stocks/{warehouseId}`** (`docs/api-reference/openapi/wildberries/02-products.yaml`): тело `{ stocks: [{ chrtId, amount }] }`, до 1000; «названия параметров не валидируются — на неверные придёт 204, а остатки не обновятся»; пример ошибки `SKUUploadDisabled: «Uploading stock is not allowed by 'sku'. Please use the 'chrtId' key»`. Старый синк пишет `{ sku, amount }` (`mcp/wb-mcp/src/tools/inventory.ts`, `updateStocksFBS`). Лимит всех методов остатков — 300/мин, 4xx считается за 10. В логе старого синка 28.09 09:00 — 429 на `POST /api/v3/stocks/1408913`.
- **Ozon `POST /v2/products/stocks`:** до 100 пар товар-склад, до 80 запросов/мин, одну пару — не чаще раза в 30 с (`TOO_MANY_REQUESTS` в `result.errors`), остаток — «в наличии без учёта резерва». Склад FBS кабинета ИП — `1020005023618600` (`data/mappings/sync-config.json`).
- **ЯМ `PUT /v2/campaigns/{campaignId}/offers/stocks`:** по спецификации `skus[]` до 2000, `{ sku, items: [{ count, updatedAt }] }`, ответ — пустой `ApiResponse`. Старый синк шлёт `{ sku, warehouseId: 2369574, items: [{ count, type: "FIT", updatedAt }] }` пачками по 200 и работает на проде с 19.07. Офферы без записи остатка (`NO_STOCKS`) в `/offers/stocks` не приходят вовсе — старый синк добирает их списком `/v2/campaigns/{id}/offers` (урок 04.09: 11 живых офферов без остатка); в `sync2` этого нет.
- **KIT `POST /v1/variants/stocks/bulk_update`:** до 5000 пар, синхронно и **атомарно** — одна битая пара (товар не найден/архивирован/дубль) даёт 400 со списком `errors[{ variant_id, code }]` и не применяется ничего; успех — 204 (у старого синка наблюдалось и пустое 200); `reserved` не меняется.
- **finstock** (только чтение): писателей остатков нет — только чтение (`ym/client.ts` `offers/stocks`, `wb/fbs-client.ts`). Писатели пишутся по образцу старого `sync/src/clients.ts`, `sync/src/kit.ts` и спецификаций.
- **Таблица `stock_snapshots_raw` — 196 МБ за первые сутки, из них KIT 185 МБ** (`raw` — вариант KIT целиком). При тике раз в 5 минут — вдвое больше. Нужны урезанный `raw` KIT и ретенция снимков.
- **План `dry-run` последнего тика:** ровно 6 строк — Ozon `2042353656495` 1→2, `2042770600705` 3→2, `2047852179018` 0→2; ЯМ `2042353656495` 1→2, `2042770600712` 3→2, `2047852183152` 0→3 — многоразмерные карточки (решение п. 18, вариант (б)). `compare-v1` 28.09: расхождений 0.
- **Сайт 201.34.133.76:** `STOCK_SOURCE=wb`, `INTERNAL_API_TOKEN` задан, прод на `8315fa1` (PR #9). `client_max_body_size 20M` для kotelnikovartifact.ru — `PUT` 5000 позиций (~250 КБ) проходит, вопрос закрыт. Страницы товара и каталога читают `cookies()` (`getCurrentCurrency`) — рендерятся на каждый запрос.
- **Крон VPS:** старый синк `orders --apply` в `3-58/5`, `stocks --apply` в `*/30` (оба под `/tmp/sai-ledger.lock`), `reconcile` 08:45, `finance` 1-го в 10:00; `sync2 tick` в `1-59/10` (`flock -n /tmp/sync2.lock`, `timeout 9m`), `compare-v1` 06:05 UTC.

---

## Решения этапа

1. **Два шага переключения.**
   - **Шаг A — сайт.** `putSiteStocks` подключён к `executeWrites` через `buildSender`. Первый прогон — отдельной командой `site-push-all --confirm`: полный `PUT` всех штрихкодов пула (не только разницы), затем на сайте `STOCK_SOURCE=pool`, `pm2 reload ecosystem.config.cjs --update-env`, `npm run stock:recalc-pool` (пересчёт агрегата всех товаров), затем `write-mode site apply --confirm`. Приёмка — сутки: витрина = пул, заказы сайта списываются.
   - **Шаг B — WB, Ozon, ЯМ, KIT разом**, одним скриптом под блокировкой тиков `sync2`: копия крона, строки `orders --apply` и `stocks --apply` старого синка закомментированы (`reconcile` и `finance` — только чтение — остаются), последний прогон `orders --apply` старого синка («слив» заказов, увиденных им, но ещё не записанных на WB), тик `sync2`, проверка `check-wb` (снимок WB = пул по всем штрихкодам), `write-mode wb|ozon|ym|kit apply --confirm`, тик уже в режиме WB `self`. Не сошлось — крон старого синка возвращается автоматически (`trap`). Перед шагом B: сверка `compare-v1` = 0, план `dry-run` зеркал пуст или объяснён (6 строк многоразмерных), `plan wb` объяснён.
2. **Отправители** — по одному на площадку, абсолютные значения, пачки по лимитам (WB 1000, Ozon 100, ЯМ 200, KIT 5000, сайт 5000), итог по каждой позиции в `SendResult` (`ok`, `error`, `uncertain`) → в журнал `writes` и в `applyWbWriteOutcomes`. Ключи: WB — `chrtId` размера на складе `WB_WAREHOUSE_ID`; Ozon — `offer_id` + `OZON_WAREHOUSE_ID`; ЯМ — `offerId` (shopSku) + склад 2369574 (первый из `YM_WAREHOUSE_IDS`); KIT — `variant_id` + `KIT_WAREHOUSE_ID`; сайт — штрихкод. `WriteOp.externalSku` добавлен. Позиция без ключа или ключ на нескольких штрихкодах — отказ до сети. Повтор POST/PUT после обрыва и 5xx (`http.ts`) безопасен только потому, что запись абсолютная — зафиксировано тестом и комментарием. Пустое тело 200/204 у KIT — `kitRequestOrNull`.
3. **Частота:** `tick` раз в 5 минут в минуты `1,6,…,56` (решение владельца: заказы раз в 5 минут; полная сверка остатков — тот же тик). Мимо старого синка (`3,8,…,58`, `:00/:30`, `08:45`). Лимиты: WB marketplace-api — 300/мин на аккаунт (тик: чтение остатков 1 запрос, запись WB — чтение + PUT + чтение ≤ 3); Ozon — 80 запросов/мин записи; ЯМ — 100 000 skus/мин; KIT — строго по одному с паузой 1,1 с (очередь `kitRequest`). Длительность тика ≈ 15–27 с + запись (секунды); при сбоях WB — до 3 минут, следующий тик пропускается `flock -n` — это штатно. `timeout 9m` остаётся. Напоминание о затянувшемся сбое — каждые 72 прогона (≈6 ч при 5 минутах).
4. **Предохранители:** 120 разных баркодов / 20 в ноль — **на площадку за прогон** (отдельный вызов `planStockWrites` на площадку; было: Ozon/ЯМ/KIT одним вызовом). Отказ предохранителя → `partial` с текстом → Telegram при смене состояния (уведомления 1.3b). Первый боевой прогон каждой площадки — ручной командой: `plan <площадка>` (план `dry-run` последнего тика) → «да» владельца → `write-mode <площадка> apply --confirm` (печатает план ещё раз и отказывает, если последний `pool` старше 15 минут, упал или план площадки отклонён предохранителем) → ручной `tick` под блокировкой.
5. **Наблюдаемость:** `compare-v1` живёт до шага B и снимается с крона на шаге B (леджер старого синка перестаёт обновляться). С выкладки этапа — `drift`: раз в сутки «пул ↔ последний снимок площадки» (расхождения, кроме записанных после снимка — «в пути»), записи `apply` за сутки по площадкам (применено / ошибок / баркодов), «повторные записи» (≥ 3 применённых записи одного баркода за сутки — запись «не держится»), упавшие и зависшие прогоны. `drift --print` — то же в терминал. Ретенция (`prune`, раз в сутки): `writes` с `off`/`dry-run` старше 14 дней, `apply` старше 90 дней; `stock_snapshots_raw` старше 7 дней, кроме последнего снимка каждой площадки. `raw` снимка KIT урезан до `id`, штрихкода, артикула и записей своего склада.
6. **Откат** — раздел «Откат» в конце плана и в `sync2/deploy/README.md`: «откат B» (WB/Ozon/ЯМ/KIT → `dry-run`, сайт остаётся) и «полный откат» (+ глобальный `SYNC_WRITE_MODE=dry-run`, сайт `STOCK_SOURCE=wb`). WB возвращается в `external` сам — вместе с `dry-run`. Перед возвратом крона старого синка — `ledger-reseed-from-wb.mjs --apply` → `stocks --apply` (память: после простоя старого синка всегда так). Репетиция — сухой прогон в Task 19.
7. **Многоразмерные** — вариант (б), доработки нет: `planStockWrites` пишет в оффер остаток размера, чей штрихкод стоит в оффере; зафиксировано тестом (Task 1).
8. **Все внешние шаги** (крон VPS, `.env`, `write-mode apply`, merge PR сайта, `pm2 reload`, `site-push-all`) — только в задачах выкладки (15–19), каждый с «да» владельца, с командой, ожидаемым выводом и откатом.

### Отступления от решений постановки (с причинами)

- **Глобальный `SYNC_WRITE_MODE=apply` ставится на шаге A, а не B.** Действующий режим площадки — меньший из глобального и её собственного: при глобальном `dry-run` сайт не пишется вовсе. Площадки WB/Ozon/ЯМ/KIT до шага B защищены своим `dry-run` в `channels`.
- **Пересчёт `recalc all` — после `STOCK_SOURCE=pool`, а не до.** В режиме `wb` агрегат товара пишет синк WB сайта (`recalcProductVisibility`); пересчёт из пула до переключения — второй писатель, которого 1.3c запрещает. Разовая команда `recalc-pool-stocks` отказывает при `STOCK_SOURCE≠pool`; окно «витрина уже на пуле, агрегат ещё от WB» — секунды между `pm2 reload` и командой.
- **Сбой чтения заказов WB запись не блокирует** (спека §5: «любой площадки»). Заказы WB в пул не входят — продажа WB приходит сигналом снимка; блок по WB остановил бы весь синк на часы сбоев WB `/api/v3/orders` (28.09 08:41–09:08+), ничего не защитив. Блокируют заказы Ozon, ЯМ, KIT, сайта — как в спеке (см. открытый вопрос 1).
- **Предварительная фиксация пула до записи на WB** (сверх постановки). Процесс, убитый между записью на WB и фиксацией, иначе оставил бы ожидание «запись применилась» (фантом) или «не отправлялась» (ложный сигнал WB); с фиксацией «итог неизвестен» — безопасное `max(база, факт)`.
- **Перечитывание остатка WB — внутри отправителя WB, плюс проверка чтением после записи.** WB на неверные параметры отвечает 204 без записи (спецификация) — «применено» ставится только когда чтение после записи вернуло целевое число.
- **`chrtId` хранится в `products.wb_chrt_id`** (миграция 0003): `pool` не видит каталога прогона `ingest`, а снимок WB не несёт `chrtId` у нулевых строк.
- **ЯМ: офферы без записи остатка — нулевыми строками снимка** (как у старого синка). Иначе новый оффер ЯМ после шага B никогда не получил бы остаток.
- **Шаг B «сливает» заказы старого синка перед переключением** и проверяет `check-wb`. Заказ зеркала, который `sync2` уже вычел в режиме `external`, а старый синк ещё не записал на WB, в первом тике `self` прочитался бы сигналом WB «+1» — продажа несуществующей единицы.
- **Отдельный `revalidate` страниц товара не нужен:** страницы товара и каталога читают `cookies()` и рендерятся на каждый запрос (проверка — таблица маршрутов в логе сборки, Task 15).
- **Ошибка пересчёта агрегата на сайте — `500 db_error`, а не `recalc_failed`:** пересчёт теперь в той же транзакции, что запись пула, и откатывает её.
- **KIT переключается в шаге B, а не «первым вместе с сайтом» (спека §11):** с 26.09 KIT пишет и старый синк (заплатка), общим леджером.

---

## Репозитории, ветки, проверки

| Задачи | Репозиторий | Ветка | Проверки перед коммитом |
|---|---|---|---|
| 1–13 | `/Users/minas/projects/sai_kotelnikovartifact`, worktree `/Users/minas/projects/sai_kotelnikovartifact-1-4` | `sync2-stage-1-4` от `main` | из `…-1-4/sync2`: `npm run typecheck && npm test && npm run test:db` |
| 14 | `/Users/minas/projects/kotelnikovartifact` (GitHub `webkoth/kotelnikovartifact-store`) | `feat/stock-source-pool` от `main` | `npm run lint && npm run typecheck && npm test` |
| 15–19 | оба + VPS 147.45.171.40 (`sync2`, старый синк) и 201.34.133.76 (сайт) | — | по шагам, каждый внешний шаг — только с «да» владельца |

Подготовка `sync2` (один раз, перед Task 1):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git worktree add ../sai_kotelnikovartifact-1-4 -b sync2-stage-1-4 main
cd ../sai_kotelnikovartifact-1-4/sync2 && npx -y npm@11.16.0 ci
```
Все команды задач 1–13 — из `/Users/minas/projects/sai_kotelnikovartifact-1-4/sync2`, пути в `git add` — от этого каталога.

Подготовка сайта (один раз, перед Task 14):
```bash
cd /Users/minas/projects/kotelnikovartifact
git switch main && git pull --ff-only && git switch -c feat/stock-source-pool
```
**Слияние с `main` сайта = автодеплой на прод.** Ни `git push`, ни PR, ни merge в Task 14 — только в Task 15 с «да» владельца.

---

## Карта файлов

```
sai_kotelnikovartifact-1-4/sync2/                     (ветка sync2-stage-1-4)
  packages/shared/src/catalog.ts                      WbCatalogEntry.chrtId
  packages/domain/src/stock-plan.test.ts              + фиксирующий тест п. 18
  packages/platforms/src/
    writer.ts (+test)                                 WriteOp.externalSku, SendResult/WriteOutcome.uncertain
    stock-write.ts (+test)                            chunk, splitByKey, succeeded/failed, isUncertain
    http.test.ts                                      + повтор PUT тем же телом (фиксирующий)
    wb/client.ts, wb/cards-mapper.ts (+test)          chrtID размера в каталог
    wb/stock-writer.ts (+test)                        writeWbStocks: перечитать → PUT chrtId → проверить чтением
    ozon/stock-writer.ts (+test)                      writeOzonStocks
    ym/stock-writer.ts (+test)                        writeYmStocks
    ym/client.ts, ym/mapper.ts, ym/adapter.ts (+tests) офферы без записи остатка — нулевые строки
    kit/client.ts, kit/stock-writer.ts (+test)        kitRequestOrNull, writeKitStocks
    kit/mapper.ts, kit/mapper-raw.test.ts             урезанный raw снимка
    site/stock-writer.ts (+test)                      writeSiteStocks, SITE_UNKNOWN_BARCODE
    index.ts                                          + экспорт писателей
  packages/db/
    migrations/0003_wb_chrt_id.sql (+meta)            products.wb_chrt_id
    src/schema.ts                                     products.wbChrtId
    src/products.ts                                   upsertProducts пишет chrtId, loadWbChrtIds
    src/runs-query.ts                                 lastRunCounters, latestRun
    src/journal.ts                                    writesOfRun, writeStatsSince, barcodesAppliedSince, pruneJournal
    src/store-1-4.db.test.ts, src/journal.db.test.ts
    src/index.ts
  apps/worker/src/
    channels-config.ts (+test)                        WB_WAREHOUSE_ID, OZON_WAREHOUSE_ID
    senders.ts (+test)                                buildSender
    jobs/ingest.ts (+db test)                         <площадка>OrdersFailed, siteSourcePool
    jobs/pool.ts (+pool.db.test.ts правка)            запись, блокировки, планы по площадкам, WB self
    jobs/pool-apply.db.test.ts, jobs/pool-wb-self.db.test.ts
    jobs/site-push-all.ts (+db test)                  полный PUT пула на сайт
    jobs/drift.ts (+test)                             сводка «пул ↔ площадки», check-wb
    jobs/compare-v1.ts                                formatMsk наружу, комментарий о частоте
    apply-preview.ts (+test)                          проверка перед apply
    transition.ts (+test)                             напоминание раз в 72 прогона
    cli.ts                                            plan, write-mode … apply --confirm, site-push-all, check-wb, drift, prune
  deploy/crontab.sync2.txt, deploy/README.md          крон 1.4, шаги A/B, откат
  .env.example, README.md

kotelnikovartifact/                                   (ветка feat/stock-source-pool)
  scripts/check-stock-source.sh                       проверка STOCK_SOURCE до сборки
  scripts/deploy.sh                                   вызов проверки
  lib/stock-source.ts                                 upsertPoolStocks(…, { recalc }) — пересчёт в транзакции
  app/api/internal/stocks/route.ts                    PUT: пересчёт внутри записи
  lib/wb/sync/stocks.ts                               в pool — recalcProductStocksFromPool("all") в конце цикла
  workers/jobs.ts, package.json                       recalc-pool-stocks, npm run stock:recalc-pool
  tests/unit/scripts/check-stock-source.test.ts
  tests/unit/lib/stock-source.test.ts, tests/unit/internal-stocks-route.test.ts,
  tests/unit/lib/wb/sync/stocks.test.ts, tests/unit/workers-jobs.test.ts
```

---

### Task 1: Контракт записи — ключ площадки, «итог неизвестен», общие помощники

**Files:**
- Modify: `packages/platforms/src/writer.ts`, `writer.test.ts`, `http.ts`, `http.test.ts`, `packages/domain/src/stock-plan.test.ts`, `apps/worker/src/jobs/pool.ts`
- Create: `packages/platforms/src/stock-write.ts`, `stock-write.test.ts`

- [ ] **Step 1: Падающие тесты выключателя.** В `writer.test.ts` помощник `op` дополнить ключом площадки:
```ts
const op = (channel: Channel, barcode: string, after: number): WriteOp => ({
  channel,
  barcode,
  field: "stock",
  before: 0,
  after,
  externalSku: `key-${barcode}`,
})
```
и в конец `describe("executeWrites"`:
```ts
  it("ключ площадки доходит до отправителя и в итог", async () => {
    const { outcomes, send } = await run([op("kit", "A", 1)], "apply", allModes("apply"))
    expect(send).toHaveBeenCalledWith("kit", [expect.objectContaining({ externalSku: "key-A" })])
    expect(outcomes[0]).toMatchObject({ externalSku: "key-A", applied: true, uncertain: false })
  })

  it("отправитель упал целиком — итог неизвестен: что успело уйти в сеть, не знаем", async () => {
    const send = vi.fn(async (): Promise<SendResult[]> => {
      throw new Error("сеть: terminated")
    })
    const { outcomes } = await run([op("wb", "A", 1)], "apply", allModes("apply"), send)
    expect(outcomes[0]).toMatchObject({ applied: false, uncertain: true, error: "сеть: terminated" })
  })

  it("отказ по позиции — неизвестен только если так сказал отправитель", async () => {
    const send = vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => [
      { barcode: ops[0]!.barcode, field: "stock", ok: false, error: "409", uncertain: false },
      { barcode: ops[1]!.barcode, field: "stock", ok: false, error: "таймаут", uncertain: true },
    ])
    const { outcomes } = await run([op("wb", "A", 1), op("wb", "B", 1)], "apply", allModes("apply"), send)
    expect(outcomes.map((o) => [o.barcode, o.uncertain])).toEqual([["A", false], ["B", true]])
  })

  it("вне apply — итог известен: ничего не отправлялось", async () => {
    const { outcomes } = await run([op("kit", "A", 1)], "dry-run", allModes("apply"))
    expect(outcomes[0]).toMatchObject({ uncertain: false })
  })
```
Прежние ожидания `toEqual` на целые итоги (если есть) дополнить полями `externalSku: "key-…"` и `uncertain: false` — смысл тестов не меняется.
Run: `npx vitest run packages/platforms/src/writer.test.ts` → FAIL (нет полей).

- [ ] **Step 2: Реализация** — `packages/platforms/src/writer.ts` целиком:
```ts
import { WRITE_MODES, errorText, isChannel, type Channel, type WriteMode } from "@sync2/shared"

/** Одна запись на площадку: поле товара было → станет. */
export interface WriteOp {
  channel: Channel
  barcode: string
  field: "stock" | "price"
  before: number | null
  after: number
  /**
   * Ключ товара, по которому площадка принимает запись: chrtId размера WB (строкой), offer_id Ozon,
   * offerId (shopSku) ЯМ, id варианта KIT; у сайта null — он пишется по штрихкоду. null там, где ключ
   * нужен, — отправитель отказывает позиции до сети (stock-write.ts, splitByKey).
   */
  externalSku: string | null
}

/** Ответ площадки по одной позиции. Адаптер обязан вернуть по строке на каждую отправленную. */
export interface SendResult {
  barcode: string
  field: WriteOp["field"]
  ok: boolean
  response?: unknown
  error?: string
  /**
   * Итог неизвестен: сеть оборвалась, 5xx после повторов, проверка после записи не сошлась —
   * запись могла примениться. Для WB в режиме self это «unknown» (domain/wb-expectation.ts).
   */
  uncertain?: boolean
}

/** Сетевой вызов площадки. Передаётся адаптером; сам выключатель в сеть не ходит. */
export type Sender = (channel: Channel, ops: WriteOp[]) => Promise<SendResult[]>

export interface WriteOutcome extends WriteOp {
  mode: WriteMode
  applied: boolean
  response: unknown
  error: string | null
  /** true — итог записи неизвестен (см. SendResult.uncertain); вне apply — всегда false. */
  uncertain: boolean
}

export interface WriteDeps {
  globalMode: WriteMode
  channelModes: Record<Channel, WriteMode>
  send: Sender
  /** Запись итогов в журнал `writes`. Вызывается один раз, со всеми позициями, в любом режиме. */
  record: (outcomes: WriteOutcome[]) => Promise<void>
}

/**
 * Журнал не записался после того, как площадки уже могли принять изменения —
 * молча проглотить это нельзя, но и итоги терять нельзя: они едут вместе с ошибкой.
 */
export class WriteJournalError extends Error {
  public readonly outcomes: WriteOutcome[]

  constructor(message: string, options: { cause: unknown; outcomes: WriteOutcome[] }) {
    super(message, { cause: options.cause })
    this.name = "WriteJournalError"
    this.outcomes = options.outcomes
  }
}

const rank = (m: WriteMode) => WRITE_MODES.indexOf(m)

const isWriteMode = (value: unknown): value is WriteMode =>
  typeof value === "string" && (WRITE_MODES as readonly string[]).includes(value)

/** Действует меньший из двух ключей: глобального SYNC_WRITE_MODE и режима площадки в таблице channels. */
export function effectiveMode(global: WriteMode, channel: WriteMode): WriteMode {
  return rank(global) <= rank(channel) ? global : channel
}

/**
 * Единственный путь записи на площадки. В off и dry-run сеть не трогается вовсе —
 * это проверено тестом и не должно обходиться ни одним адаптером.
 */
export async function executeWrites(ops: WriteOp[], deps: WriteDeps): Promise<WriteOutcome[]> {
  // Дубль по ключу channel+barcode+field перезапишет сам себя в журнале — ловим до сети, а не после.
  const seen = new Set<string>()
  for (const o of ops) {
    const dupKey = `${o.channel}\u0000${o.barcode}\u0000${o.field}`
    if (seen.has(dupKey)) throw new Error(`дубль операции записи: ${o.channel}/${o.barcode}/${o.field}`)
    seen.add(dupKey)
  }

  const byChannel = new Map<Channel, WriteOp[]>()
  for (const o of ops) byChannel.set(o.channel, [...(byChannel.get(o.channel) ?? []), o])

  // Битый глобальный режим — не повод угадывать: считаем его выключенным, как и опечатку площадки.
  const globalMode = isWriteMode(deps.globalMode) ? deps.globalMode : "off"

  const outcomes: WriteOutcome[] = []
  for (const [channel, channelOps] of byChannel) {
    const channelMode = deps.channelModes[channel]
    const safeChannelMode = isWriteMode(channelMode) ? channelMode : "off"
    // Площадка, которой нет в списке известных, не должна попасть в сеть ни при каких режимах.
    const mode: WriteMode = isChannel(channel) ? effectiveMode(globalMode, safeChannelMode) : "off"
    if (mode !== "apply") {
      for (const o of channelOps) outcomes.push({ ...o, mode, applied: false, response: null, error: null, uncertain: false })
      continue
    }
    let results: SendResult[]
    try {
      const raw = await deps.send(channel, channelOps)
      if (!Array.isArray(raw)) throw new Error("площадка вернула ответ не списком")
      results = raw
    } catch (e: unknown) {
      // Отправитель упал целиком — какие пачки успели уйти в сеть, неизвестно.
      const error = errorText(e)
      for (const o of channelOps) outcomes.push({ ...o, mode, applied: false, response: null, error, uncertain: true })
      continue
    }
    const key = (barcode: string, field: string) => `${barcode}\u0000${field}`
    const byKey = new Map(results.map((r) => [key(r.barcode, r.field), r]))
    for (const o of channelOps) {
      const r = byKey.get(key(o.barcode, o.field))
      if (!r) {
        outcomes.push({ ...o, mode, applied: false, response: null, error: "площадка не вернула результат по позиции", uncertain: true })
      } else {
        outcomes.push({
          ...o,
          mode,
          applied: r.ok,
          response: r.response ?? null,
          error: r.ok ? null : (r.error ?? "отказ без текста"),
          uncertain: !r.ok && r.uncertain === true,
        })
      }
    }
  }

  try {
    await deps.record(outcomes)
  } catch (e: unknown) {
    // На площадке уже могло уйти изменение — журнал без этих строк не восстановить, поэтому отдаём их вызывающему.
    throw new WriteJournalError(`журнал записей не сохранён: ${errorText(e)}`, { cause: e, outcomes })
  }
  return outcomes
}
```
В `apps/worker/src/jobs/pool.ts` (временно, до Task 10) в построении `ops` дописать `externalSku: c.externalSku` — иначе typecheck падает.

- [ ] **Step 3: Падающие тесты помощников** `packages/platforms/src/stock-write.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { PlatformApiError, RateLimitError } from "./errors"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "./stock-write"
import type { WriteOp } from "./writer"

const op = (barcode: string, externalSku: string | null): WriteOp => ({ channel: "ozon", barcode, field: "stock", before: 0, after: 1, externalSku })

describe("chunk", () => {
  it("пачки по размеру, порядок сохраняется; пустой список — ни одной пачки", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 100)).toEqual([])
  })
  it("размер не целый положительный — ошибка", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError)
  })
})

describe("splitByKey", () => {
  it("без ключа — отказ до сети; один ключ у нескольких штрихкодов — отказ всем, не угадываем", () => {
    const r = splitByKey([op("A", "JW-1"), op("B", null), op("C", "JW-2"), op("D", "JW-2")], (o) => o.externalSku)
    expect(r.valid.map((v) => [v.op.barcode, v.key])).toEqual([["A", "JW-1"]])
    expect(r.rejected.map((x) => [x.barcode, x.ok, x.uncertain])).toEqual([
      ["B", false, false],
      ["C", false, false],
      ["D", false, false],
    ])
    expect(r.rejected[0]?.error).toMatch(/нет ключа товара на площадке/)
    expect(r.rejected[1]?.error).toMatch(/JW-2 у нескольких штрихкодов \(C, D\)/)
  })
})

describe("итог позиции", () => {
  it("succeeded и failed — форма SendResult", () => {
    expect(succeeded(op("A", "k"), { x: 1 })).toEqual({ barcode: "A", field: "stock", ok: true, response: { x: 1 } })
    expect(failed(op("A", "k"), "нет", { uncertain: true })).toMatchObject({ barcode: "A", ok: false, error: "нет", uncertain: true })
  })
})

describe("isUncertain — могла ли запись дойти", () => {
  it("сеть и 5xx — могла; лимит и прочие 4xx — нет; ошибка кода — считаем, что могла", () => {
    expect(isUncertain(new PlatformApiError("wb", 0, "сеть"))).toBe(true)
    expect(isUncertain(new PlatformApiError("wb", 502, "bad gateway"))).toBe(true)
    expect(isUncertain(new RateLimitError("wb", 8, "429"))).toBe(false)
    expect(isUncertain(new PlatformApiError("wb", 409, "conflict"))).toBe(false)
    expect(isUncertain(new TypeError("x is undefined"))).toBe(true)
  })
})
```
Run: `npx vitest run packages/platforms/src/stock-write.test.ts` → FAIL (нет модуля).

- [ ] **Step 4: Реализация** `packages/platforms/src/stock-write.ts`:
```ts
// Общее для писателей остатка (<площадка>/stock-writer.ts, этап 1.4 синка v2).
import { PlatformApiError, RateLimitError } from "./errors"
import type { SendResult, WriteOp } from "./writer"

/** Пачки по size, порядок сохраняется. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError(`размер пачки: ${size}`)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function succeeded(op: WriteOp, response?: unknown): SendResult {
  return { barcode: op.barcode, field: op.field, ok: true, response }
}

export function failed(op: WriteOp, error: string, opts: { uncertain?: boolean; response?: unknown } = {}): SendResult {
  return { barcode: op.barcode, field: op.field, ok: false, error, uncertain: opts.uncertain ?? false, response: opts.response }
}

/**
 * Могла ли запись дойти, если запрос кончился ошибкой. Сеть (статус 0) и 5xx после повторов —
 * могла: площадка могла принять тело и не успеть ответить. Лимит (429/420) и прочие 4xx — нет:
 * площадка отказала до применения. Не PlatformApiError — ошибка кода: считаем, что могла (безопаснее).
 */
export function isUncertain(e: unknown): boolean {
  if (e instanceof RateLimitError) return false
  if (e instanceof PlatformApiError) return e.status === 0 || e.status >= 500
  return true
}

/**
 * Разбор позиций по ключу площадки до сети. Без ключа — отказ. Один ключ у нескольких штрихкодов —
 * отказ всем: два разных остатка в один товар площадки, и какой из них верный, не угадываем
 * (проверено 28.09: сейчас таких нет ни на одной площадке).
 */
export function splitByKey(
  ops: readonly WriteOp[],
  keyOf: (op: WriteOp) => string | null,
): { valid: Array<{ op: WriteOp; key: string }>; rejected: SendResult[] } {
  const byKey = new Map<string, WriteOp[]>()
  const rejected: SendResult[] = []
  for (const op of ops) {
    const key = keyOf(op)
    if (!key) {
      rejected.push(failed(op, "нет ключа товара на площадке — запись невозможна"))
      continue
    }
    byKey.set(key, [...(byKey.get(key) ?? []), op])
  }
  const valid: Array<{ op: WriteOp; key: string }> = []
  for (const [key, group] of byKey) {
    if (group.length > 1) {
      const barcodes = group.map((o) => o.barcode).join(", ")
      for (const op of group) rejected.push(failed(op, `ключ площадки ${key} у нескольких штрихкодов (${barcodes}) — запись не делается`))
      continue
    }
    valid.push({ op: group[0]!, key })
  }
  return { valid, rejected }
}
```

- [ ] **Step 5: Фиксирующие тесты (зелёные сразу — закрепляют поведение, на которое опирается запись).**
В `packages/platforms/src/http.test.ts`:
```ts
it("запись (PUT) повторяется на 5xx тем же телом — безопасно только потому, что остаток пишется абсолютным числом", async () => {
  const bodies: string[] = []
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    bodies.push(String(init?.body))
    return bodies.length === 1 ? new Response("oops", { status: 502 }) : new Response(null, { status: 204 })
  })
  vi.stubGlobal("fetch", fetchMock)
  await expect(
    requestJsonOrNull("wb", "https://marketplace-api.wildberries.ru/api/v3/stocks/1408913", {
      token: "t",
      method: "PUT",
      body: { stocks: [{ chrtId: 7001, amount: 2 }] },
      retryDelaysMs: [0],
    }),
  ).resolves.toBeNull()
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toBe(bodies[0])
})
```
(импорт `requestJsonOrNull` добавить к импорту из `./http`). В `http.ts` над веткой `if (retryable && attempt < delays.length)` — комментарий:
```ts
    // Повтор POST/PUT записи (этап 1.4) безопасен только потому, что все писатели остатка шлют
    // АБСОЛЮТНЫЕ значения: повтор принятого тела ставит то же число. Писатель с дельтами (+1/−1)
    // через этот повтор пускать нельзя — обрыв после применения удвоил бы изменение.
```
В `packages/domain/src/stock-plan.test.ts`:
```ts
  it("многоразмерная карточка (решение п. 18, вариант б): в оффер — остаток размера, чей штрихкод стоит в оффере, а не сумма", () => {
    // Два размера одного артикула в пуле; на Ozon один оффер на артикул, его штрихкод — второго размера.
    const items = [item("2047852179018", 2), item("2047852183152", 0)]
    const r = planStockWrites(items, [{ channel: "ozon", stocks: [s("2047852183152", 1, { externalSku: "JW-NB-AGT-M-0073" })] }], { maxChanges: 120 })
    expect(r.changes).toEqual([
      { channel: "ozon", barcode: "2047852183152", before: 1, after: 0, orphan: false, externalSku: "JW-NB-AGT-M-0073" },
    ])
  })
```

- [ ] **Step 6: Проверки и коммит.**
```bash
npx vitest run packages/platforms packages/domain && npm run typecheck && npm test && npm run test:db
git add packages/platforms/src/writer.ts packages/platforms/src/writer.test.ts packages/platforms/src/stock-write.ts packages/platforms/src/stock-write.test.ts packages/platforms/src/http.ts packages/platforms/src/http.test.ts packages/domain/src/stock-plan.test.ts apps/worker/src/jobs/pool.ts
git commit -m "sync2: контракт записи — ключ площадки, «итог неизвестен», общие помощники писателей"
```

---

### Task 2: chrtId размера WB — в каталог и в `products`

**Files:**
- Modify: `packages/shared/src/catalog.ts`, `packages/platforms/src/wb/client.ts`, `wb/cards-mapper.ts`, `wb/cards-mapper.test.ts`, `packages/db/src/schema.ts`, `packages/db/src/products.ts`, `packages/db/src/index.ts`
- Create: `packages/db/migrations/0003_wb_chrt_id.sql` (+ `meta/` — генерирует drizzle-kit), `packages/db/src/store-1-4.db.test.ts`

- [ ] **Step 1: Падающие тесты.** В `wb/cards-mapper.test.ts`, в `describe("mapCards на настоящем ответе"`:
```ts
  it("chrtId размера есть у каждой строки — ключ записи остатка WB", () => {
    for (const card of cards) expect(typeof card.chrtId).toBe("number")
  })
```
в `describe("mapCards на придуманных данных…"`:
```ts
  it("chrtId размера — в каждую строку его штрихкодов; размер без chrtID — строки без поля", () => {
    const cards = mapCards([
      { nmID: 5, vendorCode: "R", title: "Р", subjectName: "Кольца", sizes: [{ chrtID: 440206878, skus: ["1", "2"] }, { skus: ["3"] }] },
    ])
    expect(cards.map((c) => [c.barcode, c.chrtId])).toEqual([
      ["1", 440206878],
      ["2", 440206878],
      ["3", undefined],
    ])
  })
```
`packages/db/src/store-1-4.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadWbChrtIds, upsertProducts } from "./products"
import { TEST_DATABASE_URL, freshTestDb } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("хранилище этапа 1.4 — chrtId WB", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  it("chrtId из каталога пишется и читается картой штрихкод → chrtId; каталог без chrtId не затирает известный", async () => {
    await upsertProducts(h.db, [
      { barcode: "A", vendorCode: "R", nmId: 1, title: "", subject: null, chrtId: 440206878 },
      { barcode: "B", vendorCode: "S", nmId: 2, title: "", subject: null },
    ])
    await upsertProducts(h.db, [{ barcode: "A", vendorCode: "R", nmId: 1, title: "новое", subject: null }])
    expect(await loadWbChrtIds(h.db)).toEqual(new Map([["A", 440206878]]))
  })
})
```
Run: `npx vitest run packages/platforms/src/wb/cards-mapper.test.ts` → FAIL; `npm run test:db -- packages/db/src/store-1-4.db.test.ts` → FAIL.

- [ ] **Step 2: Каталог.** `packages/shared/src/catalog.ts`, в `WbCatalogEntry` после `subject`:
```ts
  /**
   * chrtId размера WB — ключ записи остатка (`PUT /api/v3/stocks/{warehouseId}`, этап 1.4). Необязателен:
   * его нет у записей, собранных не из карточек WB (тесты, сверки).
   */
  chrtId?: number | null
```
`packages/platforms/src/wb/client.ts`, в `WbCardListItem`: `sizes?: Array<{ chrtID?: number | null; skus?: string[] | null }> | null` и в комментарий интерфейса — «`sizes[].chrtID` — ключ записи остатка (этап 1.4)».
`packages/platforms/src/wb/cards-mapper.ts`, строка `result.push(…)`:
```ts
        result.push({
          nmId: card.nmID ?? null,
          barcode: trimmed,
          vendorCode,
          title,
          subject,
          // chrtId размера — ключ записи остатка WB (этап 1.4); у всех штрихкодов размера один.
          ...(typeof size.chrtID === "number" ? { chrtId: size.chrtID } : {}),
        })
```

- [ ] **Step 3: Схема и миграция.** `packages/db/src/schema.ts`, в `products` после `wbSubject`:
```ts
  /** chrtId размера WB — ключ записи остатка на склад продавца (этап 1.4); null — каталог его не дал. */
  wbChrtId: bigint("wb_chrt_id", { mode: "number" }),
```
```bash
npm run db:generate -- --name wb_chrt_id
cat packages/db/migrations/0003_wb_chrt_id.sql
```
Expected: `ALTER TABLE "products" ADD COLUMN "wb_chrt_id" bigint;` и новые `meta/0003_snapshot.json`, запись в `meta/_journal.json`. Прежние миграции не менять.

- [ ] **Step 4: Хранилище.** `packages/db/src/products.ts` целиком:
```ts
import { count, isNotNull, sql } from "drizzle-orm"
import type { WbCatalogEntry } from "@sync2/shared"
import type { Db } from "./client"
import { products } from "./schema"

/**
 * Каталог WB → справочник товаров. Дубли штрихкода в одном каталоге схлопываются (побеждает последний).
 * chrtId: каталог без него (не карточки WB) не затирает уже известный — coalesce.
 */
export async function upsertProducts(db: Db, entries: WbCatalogEntry[]): Promise<number> {
  const byBarcode = new Map(entries.map((e) => [e.barcode, e]))
  if (byBarcode.size === 0) return 0
  await db
    .insert(products)
    .values(
      [...byBarcode.values()].map((e) => ({
        barcode: e.barcode,
        vendorCode: e.vendorCode,
        nmId: e.nmId,
        title: e.title,
        wbSubject: e.subject,
        wbChrtId: e.chrtId ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: products.barcode,
      set: {
        vendorCode: sql`excluded.vendor_code`,
        nmId: sql`excluded.nm_id`,
        title: sql`excluded.title`,
        wbSubject: sql`excluded.wb_subject`,
        wbChrtId: sql`coalesce(excluded.wb_chrt_id, products.wb_chrt_id)`,
        updatedAt: sql`now()`,
      },
    })
  return byBarcode.size
}

export async function countProducts(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(products)
  return row?.n ?? 0
}

/** Штрихкод WB → chrtId размера: ключ записи остатка WB (pool.ts, этап 1.4). Без chrtId — не в карте. */
export async function loadWbChrtIds(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ barcode: products.barcode, chrtId: products.wbChrtId }).from(products).where(isNotNull(products.wbChrtId))
  const out = new Map<string, number>()
  for (const r of rows) if (r.chrtId !== null) out.set(r.barcode, r.chrtId)
  return out
}
```
(`index.ts` уже экспортирует `./products`.)

- [ ] **Step 5: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add packages/shared/src/catalog.ts packages/platforms/src/wb packages/db/src/schema.ts packages/db/src/products.ts packages/db/src/store-1-4.db.test.ts packages/db/migrations
git commit -m "sync2: chrtId размера WB — из карточек в каталог и products (миграция 0003)"
```

---

### Task 3: Отправитель WB — перечитать, записать по chrtId, проверить чтением

**Files:** Create `packages/platforms/src/wb/stock-writer.ts`, `wb/stock-writer.test.ts`

- [ ] **Step 1: Падающие тесты** `wb/stock-writer.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { writeWbStocks } from "./stock-writer"

const cfg = { token: "t", warehouseId: 1408913, retryDelaysMs: [0] }
const URL_STOCKS = "https://marketplace-api.wildberries.ru/api/v3/stocks/1408913"
const op = (barcode: string, chrtId: string | null, before: number, after: number): WriteOp => ({
  channel: "wb",
  barcode,
  field: "stock",
  before,
  after,
  externalSku: chrtId,
})

/**
 * Склад WB в памяти: POST — чтение остатков по штрихкодам (строки с нулём WB не отдаёт, как на проде),
 * PUT — запись по chrtId. `putStatus` — ответ на PUT; `ignorePut` — 204 без записи (неверные имена полей).
 */
function fakeWb(initial: Record<string, { chrtId: number; amount: number }>, opts: { putStatus?: number; ignorePut?: boolean } = {}) {
  const store = new Map(Object.entries(initial))
  const calls: Array<{ method: string; body: unknown }> = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET"
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ method, body })
    if (url !== URL_STOCKS) throw new Error(`неожиданный адрес ${url}`)
    if (method === "POST") {
      const skus = (body as { skus: string[] }).skus
      const stocks = skus
        .filter((sku) => (store.get(sku)?.amount ?? 0) > 0)
        .map((sku) => ({ sku, chrtId: store.get(sku)!.chrtId, amount: store.get(sku)!.amount }))
      return new Response(JSON.stringify({ stocks }), { status: 200 })
    }
    if (opts.putStatus !== undefined) return new Response(JSON.stringify([{ code: "NotFound", message: "not found" }]), { status: opts.putStatus })
    if (!opts.ignorePut) {
      for (const s of (body as { stocks: Array<{ chrtId: number; amount: number }> }).stocks) {
        for (const [sku, v] of store) if (v.chrtId === s.chrtId) store.set(sku, { ...v, amount: s.amount })
      }
    }
    return new Response(null, { status: 204 })
  })
  vi.stubGlobal("fetch", fetchMock)
  return { calls, fetchMock }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeWbStocks", () => {
  it("перечитывает остаток, пишет chrtId абсолютным числом, проверяет чтением — применено", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 }, "222": { chrtId: 7002, amount: 0 } })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 0, 1)])
    expect(r).toEqual([
      { barcode: "111", field: "stock", ok: true, response: { chrtId: 7001, amount: 2 } },
      { barcode: "222", field: "stock", ok: true, response: { chrtId: 7002, amount: 1 } },
    ])
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "POST"])
    expect(wb.calls[1]!.body).toEqual({ stocks: [{ chrtId: 7001, amount: 2 }, { chrtId: 7002, amount: 1 }] })
  })

  it("остаток изменился после снимка (продажа на WB) — позиция не пишется, остальные пишутся", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 2 }, "222": { chrtId: 7002, amount: 5 } })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2), op("222", "7002", 5, 4)])
    expect(r[0]).toMatchObject({ barcode: "111", ok: false, uncertain: false, error: expect.stringContaining("изменился после снимка") })
    expect(r[1]).toMatchObject({ barcode: "222", ok: true })
    expect(wb.calls[1]!.body).toEqual({ stocks: [{ chrtId: 7002, amount: 4 }] })
  })

  it("WB ответил 204, а остаток не изменился — итог неизвестен", async () => {
    fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { ignorePut: true })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true, error: expect.stringContaining("после записи на складе 3, ожидалось 2") })
  })

  it("409 — отказ без неопределённости, тело ответа — в журнал; проверочного чтения нет", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { putStatus: 409 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: false, response: [{ code: "NotFound", message: "not found" }] })
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT"])
  })

  it("5xx после повторов — итог неизвестен", async () => {
    const wb = fakeWb({ "111": { chrtId: 7001, amount: 3 } }, { putStatus: 500 })
    const r = await writeWbStocks(cfg, [op("111", "7001", 3, 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true })
    expect(wb.calls.map((c) => c.method)).toEqual(["POST", "PUT", "PUT"])
  })

  it("без chrtId или с нечисловым — отказ до сети", async () => {
    const wb = fakeWb({})
    const r = await writeWbStocks(cfg, [op("111", null, 3, 2), op("222", "abc", 1, 0)])
    expect(r.map((x) => [x.barcode, x.ok])).toEqual([["111", false], ["222", false]])
    expect(wb.fetchMock).not.toHaveBeenCalled()
  })
})
```
Run: `npx vitest run packages/platforms/src/wb/stock-writer.test.ts` → FAIL.

- [ ] **Step 2: Реализация** `wb/stock-writer.ts`:
```ts
// Запись остатка WB на склад продавца (этап 1.4 синка v2). Спецификация:
// docs/api-reference/openapi/wildberries/02-products.yaml, PUT /api/v3/stocks/{warehouseId}.
import { errorText } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { requestJsonOrNull } from "../http"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { fetchFbsStocks } from "./client"

const MARKETPLACE = "https://marketplace-api.wildberries.ru"
/** maxItems тела PUT /api/v3/stocks/{warehouseId}. */
export const WB_STOCKS_PUT_MAX = 1000
/**
 * Короткие повторы записи: пока запрос висит, на WB может пройти продажа, и наше абсолютное число,
 * принятое через минуту, затёрло бы её. Длинные паузы (http.ts, до минуты) здесь опаснее отказа —
 * отказ повторит следующий тик.
 */
const WB_WRITE_RETRY_DELAYS_MS = [2_000, 5_000]
const WB_WRITE_TIMEOUT_MS = 20_000

export interface WbStockWriterConfig {
  token: string
  /** Склад продавца, на который пишет sync2 (WB_WAREHOUSE_ID); проверено 28.09: он один — 1408913. */
  warehouseId: number
  /** Только для тестов. */
  retryDelaysMs?: number[]
}

/** Остаток по штрихкодам на складе; строк с нулём WB не отдаёт — отсутствие строки = 0. */
async function readAmounts(cfg: WbStockWriterConfig, barcodes: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (const row of await fetchFbsStocks(cfg.token, cfg.warehouseId, barcodes)) {
    if (row.sku) out.set(row.sku, Math.max(0, row.amount ?? 0))
  }
  return out
}

/**
 * Запись остатка WB в три шага:
 * 1. перечитать остаток записываемых штрихкодов и не писать те, что изменились с момента снимка
 *    (`op.before`): продажа на WB между снимком и записью иначе затёрлась бы нашим абсолютным числом
 *    (контракт адаптеров, план 1.2). Такая позиция — отказ без неопределённости: следующий снимок
 *    покажет продажу сигналом WB;
 * 2. PUT `{ stocks: [{ chrtId, amount }] }` пачками по 1000 — ключ chrtId, а не sku: спецификация
 *    отклоняет sku (`SKUUploadDisabled`), а неверные имена полей WB принимает ответом 204 без записи;
 * 3. проверить чтением: «применено» — только если на складе целевое число. 204 без записи и
 *    расхождение после записи — «итог неизвестен» (applyWbWriteOutcomes возьмёт max(база, факт)).
 */
export async function writeWbStocks(cfg: WbStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  const withChrt: Array<{ op: WriteOp; chrtId: number }> = []
  for (const { op, key } of valid) {
    const chrtId = Number(key)
    if (!Number.isSafeInteger(chrtId) || chrtId <= 0) results.push(failed(op, `WB: chrtId «${key}» не число — запись невозможна`))
    else withChrt.push({ op, chrtId })
  }
  if (withChrt.length === 0) return results

  let current: Map<string, number>
  try {
    current = await readAmounts(cfg, withChrt.map((x) => x.op.barcode))
  } catch (e) {
    for (const x of withChrt) results.push(failed(x.op, `WB: остаток перед записью не прочитан — ${errorText(e)}`))
    return results
  }
  const toWrite: Array<{ op: WriteOp; chrtId: number }> = []
  for (const x of withChrt) {
    const now = current.get(x.op.barcode) ?? 0
    if (x.op.before !== null && now !== x.op.before) {
      results.push(failed(x.op, `WB: остаток изменился после снимка (было ${x.op.before}, сейчас ${now}) — запись отложена до следующего прогона`, { response: { currentAmount: now } }))
    } else {
      toWrite.push(x)
    }
  }

  const sent: Array<{ op: WriteOp; chrtId: number }> = []
  for (const batch of chunk(toWrite, WB_STOCKS_PUT_MAX)) {
    try {
      await requestJsonOrNull("wb", `${MARKETPLACE}/api/v3/stocks/${cfg.warehouseId}`, {
        token: cfg.token,
        method: "PUT",
        body: { stocks: batch.map((x) => ({ chrtId: x.chrtId, amount: x.op.after })) },
        retryDelaysMs: cfg.retryDelaysMs ?? WB_WRITE_RETRY_DELAYS_MS,
        timeoutMs: WB_WRITE_TIMEOUT_MS,
      })
      sent.push(...batch)
    } catch (e) {
      const response = e instanceof PlatformApiError ? e.body : undefined
      for (const x of batch) results.push(failed(x.op, `WB: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e), response }))
    }
  }
  if (sent.length === 0) return results

  let after: Map<string, number>
  try {
    after = await readAmounts(cfg, sent.map((x) => x.op.barcode))
  } catch (e) {
    for (const x of sent) results.push(failed(x.op, `WB: запись отправлена, проверочное чтение не удалось — ${errorText(e)}`, { uncertain: true }))
    return results
  }
  for (const x of sent) {
    const got = after.get(x.op.barcode) ?? 0
    if (got === x.op.after) results.push(succeeded(x.op, { chrtId: x.chrtId, amount: got }))
    else results.push(failed(x.op, `WB: после записи на складе ${got}, ожидалось ${x.op.after}`, { uncertain: true, response: { chrtId: x.chrtId, amount: got } }))
  }
  return results
}
```
(Если `@sync2/shared` у `platforms` уже в зависимостях — да, `writer.ts` его импортирует.)

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/wb && npm run typecheck
git add packages/platforms/src/wb/stock-writer.ts packages/platforms/src/wb/stock-writer.test.ts
git commit -m "sync2: отправитель WB — перечитать остаток, записать по chrtId, проверить чтением"
```

---

### Task 4: Отправитель Ozon

**Files:** Create `packages/platforms/src/ozon/stock-writer.ts`, `ozon/stock-writer.test.ts`

- [ ] **Step 1: Падающие тесты** `ozon/stock-writer.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { OZON_STOCKS_BATCH, writeOzonStocks } from "./stock-writer"

const cfg = { clientId: "5332036", apiKey: "k", warehouseId: 1020005023618600, retryDelaysMs: [0] }
const op = (barcode: string, offer: string, after: number): WriteOp => ({ channel: "ozon", barcode, field: "stock", before: 0, after, externalSku: offer })
type Body = { stocks: Array<{ offer_id: string; stock: number; warehouse_id: number }> }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const updated = (b: Body) => json({ result: b.stocks.map((s) => ({ offer_id: s.offer_id, warehouse_id: s.warehouse_id, product_id: 1, updated: true, errors: [] })) })

function stub(handler: (body: Body) => Response) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => handler(JSON.parse(String(init?.body)) as Body))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeOzonStocks", () => {
  it("по offer_id на склад FBS абсолютным числом, с Client-Id; итог — по строке result", async () => {
    const fetchMock = stub(updated)
    const r = await writeOzonStocks(cfg, [op("A", "JW-A", 2)])
    expect(r).toEqual([
      { barcode: "A", field: "stock", ok: true, response: { offer_id: "JW-A", warehouse_id: 1020005023618600, product_id: 1, updated: true, errors: [] } },
    ])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://api-seller.ozon.ru/v2/products/stocks")
    expect((init?.headers as Record<string, string>)["Client-Id"]).toBe("5332036")
    expect(JSON.parse(String(init?.body))).toEqual({ stocks: [{ offer_id: "JW-A", stock: 2, warehouse_id: 1020005023618600 }] })
  })

  it("отказ позиции — коды Ozon без неопределённости; нет строки итога — неизвестно", async () => {
    stub(() =>
      json({ result: [{ offer_id: "JW-A", updated: false, errors: [{ code: "TOO_MANY_REQUESTS", message: "wait" }] }] }),
    )
    const r = await writeOzonStocks(cfg, [op("A", "JW-A", 2), op("B", "JW-B", 1)])
    expect(r[0]).toMatchObject({ barcode: "A", ok: false, uncertain: false, error: "Ozon: TOO_MANY_REQUESTS" })
    expect(r[1]).toMatchObject({ barcode: "B", ok: false, uncertain: true })
  })

  it("больше 100 позиций — пачки по 100", async () => {
    const fetchMock = stub(updated)
    const ops = Array.from({ length: OZON_STOCKS_BATCH + 1 }, (_, i) => op(`B${i}`, `JW-${i}`, 1))
    const r = await writeOzonStocks(cfg, ops)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(r.every((x) => x.ok)).toBe(true)
  })

  it("5xx после повторов — итог неизвестен у всей пачки", async () => {
    stub(() => json({ message: "internal" }, 500))
    const r = await writeOzonStocks(cfg, [op("A", "JW-A", 2)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true })
  })
})
```
Run → FAIL.

- [ ] **Step 2: Реализация** `ozon/stock-writer.ts`:
```ts
// Запись остатка FBS Ozon (этап 1.4 синка v2): POST /v2/products/stocks — образец
// sync/src/clients.ts (writeOzonStock) и описание метода в swagger_ozon.json.
import { errorText } from "@sync2/shared"
import { requestJson } from "../http"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { BASE, ozonAuth, type OzonCredentials } from "./client"

/** Пар товар-склад в одном запросе. */
export const OZON_STOCKS_BATCH = 100

export interface OzonStockWriterConfig extends OzonCredentials {
  /** FBS-склад «Склад Краснодар» кабинета ИП (OZON_WAREHOUSE_ID = 1020005023618600). */
  warehouseId: number
  /** Только для тестов. */
  retryDelaysMs?: number[]
}

interface OzonStockUpdateRow {
  offer_id?: string
  warehouse_id?: number
  product_id?: number
  updated?: boolean
  errors?: Array<{ code?: string; message?: string }> | null
}

/**
 * Остаток — «в наличии без учёта резерва» (спецификация), то же, что снимок считает как
 * present − reserved (ozon/mapper.ts). Только offer_id, без product_id: при обоих Ozon берёт offer_id.
 * До 100 пар в запросе, до 80 запросов в минуту; одну пару — не чаще раза в 30 секунд
 * (TOO_MANY_REQUESTS в result.errors — отказ позиции, следующий тик повторит).
 */
export async function writeOzonStocks(cfg: OzonStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  for (const batch of chunk(valid, OZON_STOCKS_BATCH)) {
    let rows: OzonStockUpdateRow[]
    try {
      const body = await requestJson<{ result?: OzonStockUpdateRow[] | null }>("ozon", `${BASE}/v2/products/stocks`, {
        ...ozonAuth(cfg),
        method: "POST",
        body: { stocks: batch.map(({ op, key }) => ({ offer_id: key, stock: op.after, warehouse_id: cfg.warehouseId })) },
        ...(cfg.retryDelaysMs ? { retryDelaysMs: cfg.retryDelaysMs } : {}),
      })
      rows = body.result ?? []
    } catch (e) {
      for (const { op } of batch) results.push(failed(op, `Ozon: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
      continue
    }
    const byOffer = new Map(rows.map((r) => [String(r.offer_id ?? ""), r]))
    for (const { op, key } of batch) {
      const row = byOffer.get(key)
      if (!row) results.push(failed(op, `Ozon: нет итога по offer_id ${key}`, { uncertain: true }))
      else if (row.updated) results.push(succeeded(op, row))
      else {
        const codes = (row.errors ?? []).map((x) => x.code ?? x.message ?? "?").join(", ")
        results.push(failed(op, `Ozon: ${codes || "не обновлено"}`, { response: row }))
      }
    }
  }
  return results
}
```

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/ozon && npm run typecheck
git add packages/platforms/src/ozon/stock-writer.ts packages/platforms/src/ozon/stock-writer.test.ts
git commit -m "sync2: отправитель Ozon — остаток FBS по offer_id"
```

---

### Task 5: Отправитель ЯМ

**Files:** Create `packages/platforms/src/ym/stock-writer.ts`, `ym/stock-writer.test.ts`

- [ ] **Step 1: Падающие тесты** `ym/stock-writer.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { YM_STOCKS_BATCH, writeYmStocks } from "./stock-writer"

const cfg = {
  apiKey: "k",
  businessId: "191766894",
  campaignId: "149197829",
  warehouseId: 2369574,
  now: () => new Date("2026-09-28T10:00:00.000Z"),
  retryDelaysMs: [0],
}
const op = (barcode: string, offer: string, after: number): WriteOp => ({ channel: "ym", barcode, field: "stock", before: 0, after, externalSku: offer })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function stub(handler: () => Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => handler())
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeYmStocks", () => {
  it("PUT на кампанию: тело как у старого синка (проверено на проде с 19.07), ключ API-Key", async () => {
    const fetchMock = stub(() => json({ status: "OK" }))
    const r = await writeYmStocks(cfg, [op("A", "JW-A", 2)])
    expect(r).toEqual([{ barcode: "A", field: "stock", ok: true, response: { status: "OK" } }])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://api.partner.market.yandex.ru/v2/campaigns/149197829/offers/stocks")
    expect(init?.method).toBe("PUT")
    expect((init?.headers as Record<string, string>)["Api-Key"]).toBe("k")
    expect(JSON.parse(String(init?.body))).toEqual({
      skus: [{ sku: "JW-A", warehouseId: 2369574, items: [{ count: 2, type: "FIT", updatedAt: "2026-09-28T10:00:00.000Z" }] }],
    })
  })

  it("notUpdatedOfferIds — отказ этих позиций", async () => {
    stub(() => json({ status: "OK", result: { notUpdatedOfferIds: ["JW-B"] } }))
    const r = await writeYmStocks(cfg, [op("A", "JW-A", 2), op("B", "JW-B", 1)])
    expect(r.map((x) => [x.barcode, x.ok])).toEqual([["A", true], ["B", false]])
  })

  it("больше 200 позиций — пачки по 200", async () => {
    const fetchMock = stub(() => json({ status: "OK" }))
    await writeYmStocks(cfg, Array.from({ length: YM_STOCKS_BATCH + 1 }, (_, i) => op(`B${i}`, `JW-${i}`, 1)))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("5xx после повторов — неизвестно; 400 — отказ", async () => {
    stub(() => json({ status: "ERROR" }, 503))
    expect((await writeYmStocks(cfg, [op("A", "JW-A", 2)]))[0]).toMatchObject({ ok: false, uncertain: true })
    stub(() => json({ status: "ERROR", errors: [{ code: "BAD_REQUEST" }] }, 400))
    expect((await writeYmStocks(cfg, [op("A", "JW-A", 2)]))[0]).toMatchObject({ ok: false, uncertain: false })
  })
})
```
Run → FAIL.

- [ ] **Step 2: Реализация** `ym/stock-writer.ts`:
```ts
// Запись остатка ЯМ (этап 1.4 синка v2): PUT /v2/campaigns/{campaignId}/offers/stocks —
// образец sync/src/clients.ts (writeYmStock), работающий на проде с 19.07.2026.
import { errorText } from "@sync2/shared"
import { requestJson } from "../http"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { BASE, ymAuth, type YmCredentials } from "./client"

/** Офферов в запросе: спецификация до 2000; 200 — как у старого синка. */
export const YM_STOCKS_BATCH = 200

export interface YmStockWriterConfig extends YmCredentials {
  /** Склад магазина «Kotelnikovartifact» — первый из YM_WAREHOUSE_IDS (2369574). */
  warehouseId: number
  /** Только для тестов. */
  now?: () => Date
  retryDelaysMs?: number[]
}

/**
 * Тело — как у старого синка: `{ sku, warehouseId, items: [{ count, type: "FIT", updatedAt }] }`.
 * Текущая спецификация описывает `{ sku, items: [{ count, updatedAt }] }` на уровне кампании;
 * `warehouseId` и `type` площадка принимает (проверено продом старого синка) — тело не меняем
 * без живой проверки. `count` — доступный остаток, как FIT в снимке (ym/mapper.ts).
 * Данные в каталоге ЯМ обновляются до нескольких минут: «применено» здесь — «принято»; что
 * остаток встал, показывает следующий снимок (drift).
 */
export async function writeYmStocks(cfg: YmStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  const updatedAt = (cfg.now ?? (() => new Date()))().toISOString()
  for (const batch of chunk(valid, YM_STOCKS_BATCH)) {
    let body: { status?: string; result?: { notUpdatedOfferIds?: string[] | null } | null }
    try {
      body = await requestJson("ym", `${BASE}/v2/campaigns/${cfg.campaignId}/offers/stocks`, {
        ...ymAuth(cfg),
        method: "PUT",
        body: { skus: batch.map(({ op, key }) => ({ sku: key, warehouseId: cfg.warehouseId, items: [{ count: op.after, type: "FIT", updatedAt }] })) },
        ...(cfg.retryDelaysMs ? { retryDelaysMs: cfg.retryDelaysMs } : {}),
      })
    } catch (e) {
      for (const { op } of batch) results.push(failed(op, `ЯМ: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
      continue
    }
    const notUpdated = new Set(body.result?.notUpdatedOfferIds ?? [])
    for (const { op, key } of batch) {
      if (notUpdated.has(key)) results.push(failed(op, `ЯМ: оффер ${key} не обновлён (notUpdatedOfferIds)`, { response: body }))
      else results.push(succeeded(op, { status: body.status }))
    }
  }
  return results
}
```

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/ym && npm run typecheck
git add packages/platforms/src/ym/stock-writer.ts packages/platforms/src/ym/stock-writer.test.ts
git commit -m "sync2: отправитель ЯМ — остаток на склад магазина по offerId"
```

---

### Task 6: ЯМ — офферы без записи остатка в снимке

**Files:** Modify `packages/platforms/src/ym/client.ts`, `ym/mapper.ts`, `ym/adapter.ts`, `ym/mapper.test.ts`, `ym/adapter.test.ts`

- [ ] **Step 1: Падающие тесты.** В `ym/mapper.test.ts` (импорт `withOffersWithoutStock` из `./mapper`):
```ts
describe("withOffersWithoutStock", () => {
  it("оффер магазина без записи остатка — пустой строкой на первом складе магазина; уже известный — не дублируется", () => {
    const warehouses = [{ warehouseId: 7, offers: [{ offerId: "A", stocks: [{ type: "FIT", count: 1 }] }] }]
    expect(withOffersWithoutStock(warehouses, ["A", "NEW", "NEW"], [7, 8])).toEqual([
      ...warehouses,
      { warehouseId: 7, offers: [{ offerId: "NEW", stocks: [] }] },
    ])
  })
  it("все офферы уже в остатках или складов в конфиге нет — без изменений", () => {
    const warehouses = [{ warehouseId: 7, offers: [{ offerId: "A", stocks: [] }] }]
    expect(withOffersWithoutStock(warehouses, ["A"], [7])).toBe(warehouses)
    expect(withOffersWithoutStock(warehouses, ["B"], [])).toBe(warehouses)
  })
})
```
В `ym/adapter.test.ts`, в тесте «fetchStocks: остатки → каталог…» к `routeFetch({ … })` добавить маршрут списка офферов:
```ts
      "/v2/campaigns/222/offers": () => ({ status: "OK", result: { paging: {}, offers: [{ offerId: "A" }, { offerId: "NO-BC" }] } }),
```
(ожидания теста не меняются) и новый тест рядом:
```ts
  it("fetchStocks: оффер магазина без записи остатка (NO_STOCKS) — нулевая строка на складе магазина", async () => {
    routeFetch({
      "/v2/campaigns/222/offers/stocks": () => ({ status: "OK", result: { paging: {}, warehouses: [] } }),
      "/v2/campaigns/222/offers": () => ({ status: "OK", result: { paging: {}, offers: [{ offerId: "A" }] } }),
      "/v2/businesses/111/offer-mappings": () => ({
        status: "OK",
        result: { paging: {}, offerMappings: [{ offer: { offerId: "A", barcodes: ["2051508626795"] } }] },
      }),
    })
    const wbIndex = buildWbCatalogIndex([{ barcode: "2051508626795", vendorCode: "A", nmId: null, title: "", subject: null }])
    const { stocks } = await createYmAdapter(CREDS, wbIndex, [7]).fetchStocks()
    expect(stocks).toEqual([expect.objectContaining({ barcode: "2051508626795", externalSku: "A", quantity: 0, warehouse: "7" })])
  })
```
Run: `npx vitest run packages/platforms/src/ym` → FAIL.

- [ ] **Step 2: Реализация.** `ym/client.ts`, в раздел «Остатки» после `fetchYmStocks`:
```ts
interface YmCampaignOffersResponse {
  status: string
  result?: {
    paging?: { nextPageToken?: string | null } | null
    offers?: Array<{ offerId?: string | null }> | null
  } | null
}

const CAMPAIGN_OFFERS_PAGE_LIMIT = 200

/**
 * Все офферы магазина, `POST /v2/campaigns/{campaignId}/offers`. Нужны снимку: оффер, которому остаток
 * ни разу не выставляли (статус NO_STOCKS), в `/offers/stocks` не приходит вовсе — без него синк не
 * узнал бы о карточке и никогда не выставил бы ей остаток (урок старого синка 04.09.2026: 11 живых
 * офферов с ценами «потерялись» так же).
 */
export async function fetchYmCampaignOfferIds(credentials: YmCredentials): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<YmCampaignOffersResponse>(
      "ym",
      pagedUrl(`/v2/campaigns/${credentials.campaignId}/offers`, CAMPAIGN_OFFERS_PAGE_LIMIT, pageToken),
      { ...ymAuth(credentials), method: "POST", body: {} },
    )
    const offers = body.result?.offers ?? []
    for (const o of offers) if (o.offerId) ids.push(o.offerId)
    const next = body.result?.paging?.nextPageToken ?? undefined
    if (!next || next === pageToken || offers.length === 0) break
    pageToken = next
  }
  return ids
}
```
`ym/mapper.ts` (импорт типа `YmWarehouseStocks` из `./client` — уже есть для `mapYmStocks`):
```ts
/**
 * Офферы магазина без записи остатка (NO_STOCKS) — пустой строкой на первом складе магазина из
 * конфига: mapYmStocks даст им нулевую строку снимка («выставлен и пуст»), и план выставит остаток
 * пула. Оффер, который уже есть на любом своём складе, не дублируется.
 */
export function withOffersWithoutStock(
  warehouses: YmWarehouseStocks[],
  campaignOfferIds: readonly string[],
  warehouseIds: readonly number[],
): YmWarehouseStocks[] {
  const target = warehouseIds[0]
  if (target === undefined) return warehouses
  const own = new Set(warehouseIds)
  const seen = new Set<string>()
  for (const w of warehouses) if (own.has(w.warehouseId)) for (const o of w.offers) seen.add(o.offerId)
  const missing = [...new Set(campaignOfferIds)].filter((id) => !seen.has(id))
  if (missing.length === 0) return warehouses
  return [...warehouses, { warehouseId: target, offers: missing.map((offerId) => ({ offerId, stocks: [] })) }]
}
```
`ym/adapter.ts`, `fetchStocks`:
```ts
  async function fetchStocks(): Promise<StockFetch> {
    const warehouses = withOffersWithoutStock(await fetchYmStocks(credentials), await fetchYmCampaignOfferIds(credentials), warehouseIds)
    const offerIds = warehouses.flatMap((w) => w.offers.map((offer) => offer.offerId))
    const barcodes = await fetchYmBarcodes(credentials, offerIds)
    return mapYmStocks(warehouses, barcodes, wbIndex, warehouseIds)
  }
```
(импорты `fetchYmCampaignOfferIds`, `withOffersWithoutStock`).

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/ym && npm run typecheck && npm test
git add packages/platforms/src/ym
git commit -m "sync2: ЯМ — офферы без записи остатка нулевыми строками снимка"
```

---

### Task 7: KIT — отправитель, пустой ответ, урезанный `raw` снимка

**Files:**
- Modify: `packages/platforms/src/kit/client.ts`, `kit/mapper.ts`
- Create: `kit/stock-writer.ts`, `kit/stock-writer.test.ts`, `kit/mapper-raw.test.ts`

- [ ] **Step 1: Падающие тесты** `kit/stock-writer.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { resetKitPaceForTests } from "./client"
import { writeKitStocks } from "./stock-writer"

const WH = "01980d4c-1b53-7aa1-ab23-1b7c23604704"
const cfg = { token: "t", warehouseId: WH, retryDelaysMs: [0] }
const op = (barcode: string, variant: string, after: number): WriteOp => ({ channel: "kit", barcode, field: "stock", before: 0, after, externalSku: variant })
type Item = { variant_id: string; warehouse_id: string; quantity: number }

function stub(handler: (items: Item[]) => Response) {
  const bodies: Item[][] = []
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const items = (JSON.parse(String(init?.body)) as { items: Item[] }).items
    bodies.push(items)
    return handler(items)
  })
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock, bodies }
}

beforeEach(() => {
  resetKitPaceForTests()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeKitStocks", () => {
  it("bulk_update на склад продаж абсолютным числом; 204 без тела — применено", async () => {
    const { fetchMock, bodies } = stub(() => new Response(null, { status: 204 }))
    const r = await writeKitStocks(cfg, [op("A", "v-A", 2)])
    expect(r).toEqual([{ barcode: "A", field: "stock", ok: true, response: { variant_id: "v-A", quantity: 2 } }])
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.kit.yandex.net/v1/variants/stocks/bulk_update")
    expect(bodies[0]).toEqual([{ variant_id: "v-A", warehouse_id: WH, quantity: 2 }])
  })

  it("пустое тело 200 — тоже применено", async () => {
    stub(() => new Response("", { status: 200 }))
    expect((await writeKitStocks(cfg, [op("A", "v-A", 2)]))[0]).toMatchObject({ ok: true })
  })

  it("400 с ошибками элементов — батч атомарен: битые — отказ, остальные — один повтор без них", async () => {
    const { bodies } = stub((items) =>
      items.some((i) => i.variant_id === "v-bad")
        ? new Response(
            JSON.stringify({ code: "VALIDATION_ERROR", message: "bad", trace_id: "0", errors: [{ variant_id: "v-bad", warehouse_id: WH, code: "VARIANT_ARCHIVED", message: "archived" }] }),
            { status: 400 },
          )
        : new Response(null, { status: 204 }),
    )
    const r = await writeKitStocks(cfg, [op("A", "v-A", 2), op("B", "v-bad", 0)])
    expect(r.map((x) => [x.barcode, x.ok, x.error ?? null])).toEqual([
      ["B", false, "KIT: VARIANT_ARCHIVED"],
      ["A", true, null],
    ])
    expect(bodies.map((b) => b.map((i) => i.variant_id))).toEqual([["v-A", "v-bad"], ["v-A"]])
  })

  it("5xx после повторов — итог неизвестен", async () => {
    stub(() => new Response(JSON.stringify({ code: "INTERNAL", message: "x", trace_id: "0" }), { status: 500 }))
    expect((await writeKitStocks(cfg, [op("A", "v-A", 2)]))[0]).toMatchObject({ ok: false, uncertain: true })
  })
})
```
`kit/mapper-raw.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { buildWbCatalogIndex } from "@sync2/shared"
import type { KitVariant } from "./client"
import { mapKitStocks } from "./mapper"

const WH = "01980d4c-1b53-7aa1-ab23-1b7c23604704"
const wbIndex = buildWbCatalogIndex([{ barcode: "2041383032873", vendorCode: "JW-0002", nmId: 1, title: "", subject: null }])

describe("mapKitStocks — raw снимка", () => {
  it("только id, штрихкод, артикул и записи своего склада: вариант целиком раздувал базу (185 МБ снимков KIT за сутки 27–28.09)", () => {
    const variant = {
      id: "v1",
      barcode: "2041383032873",
      sku: "JW-0002",
      stocks: [
        { quantity: 2, reserved: 1, warehouse_id: WH },
        { quantity: 9, warehouse_id: "other" },
      ],
      name: "Браслет",
      description: "длинный текст",
      images: ["https://example.invalid/1.jpg"],
    } as KitVariant
    expect(mapKitStocks([variant], WH, wbIndex).stocks[0]?.raw).toEqual({
      id: "v1",
      barcode: "2041383032873",
      sku: "JW-0002",
      stocks: [{ quantity: 2, reserved: 1, warehouse_id: WH }],
    })
  })
})
```
Run: `npx vitest run packages/platforms/src/kit` → FAIL.

- [ ] **Step 2: Очередь KIT с пустым ответом.** В `kit/client.ts` импорт `requestJsonOrNull` добавить к импорту из `../http`, функцию `kitRequest` заменить на:
```ts
/** Один запрос в очереди модуля: пауза темпа и сам запрос вместе (см. комментарий у `queue`). */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(pace).then(fn)
  queue = run.then(noop, noop)
  return run
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
  return enqueue(() => requestJson<T>("kit", `${BASE}${path}`, { ...kitAuth(credentials), ...options }))
}

/**
 * То же для методов записи, у которых успех — 204 или пустое 200 (`bulk_update`, наблюдение старого
 * синка): `requestJson` счёл бы пустой ответ ошибкой. Та же очередь — запись не обгоняет чтение.
 */
export function kitRequestOrNull<T = unknown>(
  credentials: KitCredentials,
  path: string,
  options: Omit<RequestOptions, "token" | "authHeader"> = {},
): Promise<T | null> {
  return enqueue(() => requestJsonOrNull<T>("kit", `${BASE}${path}`, { ...kitAuth(credentials), ...options }))
}
```

- [ ] **Step 3: Отправитель** `kit/stock-writer.ts`:
```ts
// Запись остатка KIT (этап 1.4 синка v2): POST /v1/variants/stocks/bulk_update —
// образец sync/src/kit.ts (writeKitStock) и kit-swagger.openapi.json.
import { errorText } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { kitRequestOrNull, type KitCredentials } from "./client"

/** Пар товар-склад в одном запросе. */
export const KIT_BULK_MAX = 5000

export interface KitStockWriterConfig extends KitCredentials {
  /** Склад продаж «Склад Краснодар» (KIT_WAREHOUSE_ID). */
  warehouseId: string
  /** Только для тестов. */
  retryDelaysMs?: number[]
}

/** variant_id → код ошибки из тела 400 (BulkOperationError.errors). */
function itemErrors(body: unknown): Map<string, string> {
  const out = new Map<string, string>()
  const errors = (body as { errors?: Array<{ variant_id?: string; code?: string; message?: string }> } | null)?.errors
  if (Array.isArray(errors)) for (const e of errors) if (e.variant_id) out.set(String(e.variant_id), e.code ?? e.message ?? "ошибка элемента")
  return out
}

type Keyed = { op: WriteOp; key: string }

async function sendBatch(cfg: KitStockWriterConfig, batch: Keyed[], retryWithoutInvalid: boolean): Promise<SendResult[]> {
  if (batch.length === 0) return []
  try {
    await kitRequestOrNull(cfg, "/v1/variants/stocks/bulk_update", {
      method: "POST",
      body: { items: batch.map(({ op, key }) => ({ variant_id: key, warehouse_id: cfg.warehouseId, quantity: op.after })) },
      ...(cfg.retryDelaysMs ? { retryDelaysMs: cfg.retryDelaysMs } : {}),
    })
    return batch.map(({ op, key }) => succeeded(op, { variant_id: key, quantity: op.after }))
  } catch (e) {
    const invalid = e instanceof PlatformApiError && e.status === 400 ? itemErrors(e.body) : new Map<string, string>()
    if (retryWithoutInvalid && invalid.size > 0) {
      const bad = batch.filter(({ key }) => invalid.has(key))
      const good = batch.filter(({ key }) => !invalid.has(key))
      return [...bad.map(({ op, key }) => failed(op, `KIT: ${invalid.get(key)}`)), ...(await sendBatch(cfg, good, false))]
    }
    return batch.map(({ op }) => failed(op, `KIT: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
  }
}

/**
 * Остаток KIT абсолютным числом на склад продаж, до 5000 пар. Запрос атомарный: одна битая пара
 * (товар не найден, архивирован, дубль) — 400 со списком errors и не применено НИЧЕГО. Поэтому битые
 * пары — отказ, остальные — один повтор без них. `reserved` площадка не трогает.
 */
export async function writeKitStocks(cfg: KitStockWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  for (const batch of chunk(valid, KIT_BULK_MAX)) results.push(...(await sendBatch(cfg, batch, true)))
  return results
}
```

- [ ] **Step 4: Урезанный `raw`.** В `kit/mapper.ts`, в `mapKitStocks`, `raw: variant` заменить на:
```ts
      // Только то, что нужно для разбора споров: вариант целиком (описания, картинки) раздувал
      // stock_snapshots_raw — 185 МБ снимков KIT за первые сутки (28.09), а тик теперь раз в 5 минут.
      raw: {
        id: variant.id,
        barcode: variant.barcode,
        sku: variant.sku ?? null,
        stocks: (variant.stocks ?? []).filter((entry) => entry.warehouse_id === warehouseId),
      },
```
Прежние ожидания `raw: variant` в тестах остатков KIT (если есть) — на урезанную форму.

- [ ] **Step 5: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/kit && npm run typecheck && npm test
git add packages/platforms/src/kit
git commit -m "sync2: отправитель KIT — атомарный bulk_update с повтором без битых пар; урезанный raw снимка"
```

---

### Task 8: Сайт — отправитель; `ingest` — счётчики сбоя заказов и источника витрины

**Files:**
- Create: `packages/platforms/src/site/stock-writer.ts`, `site/stock-writer.test.ts`
- Modify: `packages/platforms/src/index.ts`, `apps/worker/src/jobs/ingest.ts`, `ingest.db.test.ts`

- [ ] **Step 1: Падающие тесты** `site/stock-writer.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { SITE_UNKNOWN_BARCODE, writeSiteStocks } from "./stock-writer"

const cfg = { baseUrl: "https://kotelnikovartifact.ru", token: "t".repeat(64) }
const op = (barcode: string, after: number): WriteOp => ({ channel: "site", barcode, field: "stock", before: 0, after, externalSku: null })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("writeSiteStocks", () => {
  it("PUT абсолютных остатков по штрихкоду; неизвестный сайту штрихкод — отказ позиции", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ updated: 1, unknown: ["B"], source: "pool" }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const r = await writeSiteStocks(cfg, [op("A", 2), op("B", 0)])
    expect(r[0]).toEqual({ barcode: "A", field: "stock", ok: true, response: { source: "pool" } })
    expect(r[1]).toMatchObject({ barcode: "B", ok: false, uncertain: false, error: `${SITE_UNKNOWN_BARCODE} B` })
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
      items: [
        { barcode: "A", quantity: 2 },
        { barcode: "B", quantity: 0 },
      ],
    })
  })

  it("400 — отказ всей пачки без неопределённости", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "validation" }), { status: 400 })))
    expect((await writeSiteStocks(cfg, [op("A", 2)]))[0]).toMatchObject({ ok: false, uncertain: false })
  })
})
```
В `apps/worker/src/jobs/ingest.db.test.ts`: у помощника `ingest` в `opts` добавить `site?: "wb" | "pool"`, в `mirrors` дописать сайт:
```ts
          mirrors: () => [
            fake("ozon", [order("O1"), order("O0", 0)], opts.mirrorsFail),
            fake("kit", [order("K1")]),
            ...(opts.site
              ? [{ ...fake("site", []), fetchStocks: async () => ({ stocks: [], skippedNoWbBarcode: [], source: opts.site! }) }]
              : []),
          ],
```
и в конец `describe`:
```ts
  it("сбой заказов площадки — <площадка>OrdersFailed; источник витрины сайта — siteSourcePool", async () => {
    const r = await ingest(cat(10), { mirrorsFail: true, site: "pool", acceptCatalog: true })
    expect(r.counters).toMatchObject({ ozonOrdersFailed: 1, siteSourcePool: 1 })
    expect(r.counters).not.toHaveProperty("kitOrdersFailed")
    const w = await ingest(cat(10), { site: "wb", acceptCatalog: true })
    expect(w.counters).toMatchObject({ siteSourcePool: 0 })
  })
```
Run: `npx vitest run packages/platforms/src/site` → FAIL; `npm run test:db -- apps/worker/src/jobs/ingest.db.test.ts` → FAIL.

- [ ] **Step 2: Отправитель** `site/stock-writer.ts`:
```ts
// Запись остатка пула на сайт (этап 1.4 синка v2): PUT /api/internal/stocks через putSiteStocks.
import { errorText } from "@sync2/shared"
import { failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { putSiteStocks, type SiteCredentials, type SitePutResult } from "./client"

/** Начало текста отказа «штрихкода нет в каталоге сайта» — site-push-all считает такие отдельно. */
export const SITE_UNKNOWN_BARCODE = "сайт не знает штрихкод"

/**
 * Ключ сайта — сам штрихкод WB (у сайта каталог — копия WB). Сайт пишет pool_stocks одной
 * транзакцией на пачку; в STOCK_SOURCE=pool — и агрегат витрины (репозиторий сайта, этап 1.4).
 * `source` из ответа — в журнал: видно, влияла ли запись на витрину.
 */
export async function writeSiteStocks(cfg: SiteCredentials, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.barcode)
  if (valid.length === 0) return rejected
  let r: SitePutResult
  try {
    r = await putSiteStocks(cfg, valid.map(({ op }) => ({ barcode: op.barcode, quantity: op.after })))
  } catch (e) {
    return [...rejected, ...valid.map(({ op }) => failed(op, `сайт: запись не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))]
  }
  const unknown = new Set(r.unknown)
  return [
    ...rejected,
    ...valid.map(({ op }) => (unknown.has(op.barcode) ? failed(op, `${SITE_UNKNOWN_BARCODE} ${op.barcode}`) : succeeded(op, { source: r.source }))),
  ]
}
```
(Если `SitePutResult` не экспортирован из `site/client.ts` — добавить `export` к интерфейсу.)
`packages/platforms/src/index.ts` — дописать:
```ts
export * from "./stock-write"
export { writeWbStocks, type WbStockWriterConfig } from "./wb/stock-writer"
export { writeOzonStocks, type OzonStockWriterConfig } from "./ozon/stock-writer"
export { writeYmStocks, type YmStockWriterConfig } from "./ym/stock-writer"
export { writeKitStocks, type KitStockWriterConfig } from "./kit/stock-writer"
export { SITE_UNKNOWN_BARCODE, writeSiteStocks } from "./site/stock-writer"
```

- [ ] **Step 3: `ingest`.** В `apps/worker/src/jobs/ingest.ts`, в `catch` чтения заказов:
```ts
    } catch (e) {
      // pool (этап 1.4) по этому счётчику не пишет остатки в этом прогоне (спека §5).
      counters[`${a.channel}OrdersFailed`] = 1
      errors.push(`${a.channel} заказы: ${errorText(e)}`)
    }
```
в `try` чтения остатков после `counters[\`${a.channel}Skipped\`] = …`:
```ts
      // Источник остатка витрины сайта: pool пишет сайт только при pool (siteWriteBlocked в pool.ts).
      if (a.channel === "site" && "source" in s) counters.siteSourcePool = s.source === "pool" ? 1 : 0
```

- [ ] **Step 4: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add packages/platforms/src/site packages/platforms/src/index.ts apps/worker/src/jobs/ingest.ts apps/worker/src/jobs/ingest.db.test.ts
git commit -m "sync2: отправитель сайта; ingest — счётчики сбоя заказов и источника витрины"
```

---

### Task 9: Склады записи в конфиге и сборка отправителя

**Files:**
- Modify: `apps/worker/src/channels-config.ts`, `channels-config.test.ts`, `sync2/.env.example`
- Create: `apps/worker/src/senders.ts`, `senders.test.ts`

- [ ] **Step 1: Падающие тесты.** В `channels-config.test.ts` в ожидании «собирает ключи и склады четырёх площадок»: `wb: { token: "wb", warehouseId: null }`, `ozon: { clientId: "5332036", apiKey: "oz", warehouseId: null }`; в конец верхнего `describe`:
```ts
  describe("склады записи WB и Ozon — необязательны для чтения, целые положительные", () => {
    it("заданы — числами", () => {
      const c = loadChannelsConfig({ ...env, WB_WAREHOUSE_ID: "1408913", OZON_WAREHOUSE_ID: "1020005023618600" })
      expect([c.wb.warehouseId, c.ozon.warehouseId]).toEqual([1408913, 1020005023618600])
    })
    it("мусор — ошибка с именем переменной", () => {
      expect(() => loadChannelsConfig({ ...env, WB_WAREHOUSE_ID: "склад" })).toThrow(/WB_WAREHOUSE_ID/)
      expect(() => loadChannelsConfig({ ...env, OZON_WAREHOUSE_ID: "-1" })).toThrow(/OZON_WAREHOUSE_ID/)
    })
  })
```
`apps/worker/src/senders.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "@sync2/platforms"
import { loadChannelsConfig } from "./channels-config"
import { buildSender } from "./senders"

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
const op = (channel: WriteOp["channel"]): WriteOp => ({ channel, barcode: "A", field: "stock", before: 1, after: 2, externalSku: "JW-A" })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("buildSender", () => {
  it("склад WB, склад Ozon или токен сайта не заданы — ошибка до сети", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const send = buildSender(loadChannelsConfig(env))
    await expect(send("wb", [op("wb")])).rejects.toThrow(/WB_WAREHOUSE_ID/)
    await expect(send("ozon", [op("ozon")])).rejects.toThrow(/OZON_WAREHOUSE_ID/)
    await expect(send("site", [op("site")])).rejects.toThrow(/SITE_API_TOKEN/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("ЯМ — на кампанию и первый склад из YM_WAREHOUSE_IDS", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ status: "OK" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const r = await buildSender(loadChannelsConfig(env))("ym", [op("ym")])
    expect(r).toEqual([{ barcode: "A", field: "stock", ok: true, response: { status: "OK" } }])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("https://api.partner.market.yandex.ru/v2/campaigns/149197829/offers/stocks")
    expect((JSON.parse(String(init?.body)) as { skus: unknown[] }).skus[0]).toMatchObject({ sku: "JW-A", warehouseId: 2369574, items: [{ count: 2, type: "FIT" }] })
  })
})
```
Run → FAIL.

- [ ] **Step 2: Конфиг.** В `channels-config.ts`: в `ChannelsConfig` — `wb: { token: string; warehouseId: number | null }`, `ozon: { clientId: string; apiKey: string; warehouseId: number | null }` с комментарием «склад записи (этап 1.4); null — запись этой площадки невозможна, чтение работает». Перед `loadChannelsConfig`:
```ts
/** Необязательное целое положительное (склады записи WB/Ozon, этап 1.4): пусто — null, мусор — ошибка с именем. */
function optionalPositiveInt(env: Record<string, string | undefined>, name: string): number | null {
  const raw = env[name]?.trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${name}: "${raw}" — не целое положительное число`)
  return n
}
```
в объекте результата: `wb: { token: required(env, "WB_API_TOKEN"), warehouseId: optionalPositiveInt(env, "WB_WAREHOUSE_ID") }`, `ozon: { clientId: …, apiKey: …, warehouseId: optionalPositiveInt(env, "OZON_WAREHOUSE_ID") }`.
`sync2/.env.example` — в конец:
```
# Этап 1.4 — склады, на которые sync2 пишет остаток (без них запись WB/Ozon невозможна, чтение работает).
WB_WAREHOUSE_ID=1408913
OZON_WAREHOUSE_ID=1020005023618600
```

- [ ] **Step 3: Сборка** `apps/worker/src/senders.ts`:
```ts
import { writeKitStocks, writeOzonStocks, writeSiteStocks, writeWbStocks, writeYmStocks, type Sender } from "@sync2/platforms"
import type { ChannelsConfig } from "./channels-config"

/**
 * Отправитель для executeWrites (этап 1.4): площадка → её писатель остатка
 * (packages/platforms/src/<площадка>/stock-writer.ts). Нет склада записи или токена сайта —
 * ошибка на всю пачку площадки: executeWrites запишет её в журнал по каждой позиции.
 */
export function buildSender(cfg: ChannelsConfig): Sender {
  return async (channel, ops) => {
    switch (channel) {
      case "wb":
        if (cfg.wb.warehouseId === null) throw new Error("WB_WAREHOUSE_ID не задан — запись WB невозможна")
        return writeWbStocks({ token: cfg.wb.token, warehouseId: cfg.wb.warehouseId }, ops)
      case "ozon":
        if (cfg.ozon.warehouseId === null) throw new Error("OZON_WAREHOUSE_ID не задан — запись Ozon невозможна")
        return writeOzonStocks({ clientId: cfg.ozon.clientId, apiKey: cfg.ozon.apiKey, warehouseId: cfg.ozon.warehouseId }, ops)
      case "ym": {
        const warehouseId = cfg.ym.warehouseIds[0]
        if (warehouseId === undefined) throw new Error("YM_WAREHOUSE_IDS пуст — запись ЯМ невозможна")
        return writeYmStocks({ apiKey: cfg.ym.apiKey, businessId: cfg.ym.businessId, campaignId: cfg.ym.campaignId, warehouseId }, ops)
      }
      case "kit":
        return writeKitStocks({ token: cfg.kit.token, warehouseId: cfg.kit.warehouseId }, ops)
      case "site":
        if (!cfg.site) throw new Error(`SITE_API_TOKEN не задан${cfg.siteError ? ` (${cfg.siteError})` : ""} — запись сайта невозможна`)
        return writeSiteStocks(cfg.site, ops)
    }
  }
}
```

- [ ] **Step 4: Проверки и коммит.**
```bash
npm run typecheck && npm test
git add apps/worker/src/channels-config.ts apps/worker/src/channels-config.test.ts apps/worker/src/senders.ts apps/worker/src/senders.test.ts .env.example
git commit -m "sync2: склады записи WB и Ozon в конфиге, сборка отправителя по площадкам"
```

---

### Task 10: `pool` — запись, блокировки, предохранители по площадкам, WB `self`

**Files:**
- Modify: `apps/worker/src/jobs/pool.ts` (целиком), `pool.db.test.ts`, `packages/db/src/runs-query.ts`
- Create: `apps/worker/src/jobs/pool-apply.db.test.ts`, `pool-wb-self.db.test.ts`

- [ ] **Step 1: Счётчики последнего `ingest`.** В `packages/db/src/runs-query.ts`:
```ts
/** Счётчики последнего завершённого (ok/partial) запуска джобы; ни одного — null. pool читает из ingest сбои заказов и источник витрины. */
export async function lastRunCounters(db: Db, job: string): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({ counters: runs.counters })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial"])))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  return (row?.counters as Record<string, unknown> | undefined) ?? null
}
```

- [ ] **Step 2: Падающие тесты записи** `apps/worker/src/jobs/pool-apply.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { channels, drizzleRunStore, insertStockSnapshot, loadChannels, seedChannels, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { SendResult, WriteOp } from "@sync2/platforms"
import type { Channel, NormalizedStock, WriteMode } from "@sync2/shared"
import { and, eq } from "drizzle-orm"
import { runPool } from "./pool"

const s = (barcode: string, quantity: number, externalSku: string | null = null): NormalizedStock => ({ barcode, externalSku, quantity, warehouse: null })
const okSend = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true })))

describe.skipIf(!TEST_DATABASE_URL)("runPool — запись на площадки (этап 1.4)", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Awaited<ReturnType<typeof loadChannels>>
  let n = 0
  const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  const runId = async () => {
    const id = nextId()
    await insertRun(h.db, id)
    return id
  }
  /** Завершённый ingest со счётчиками: pool читает из него сбои заказов и источник витрины сайта. */
  const ingestRun = async (at: string, counters: Record<string, number> = {}) => {
    const store = drizzleRunStore(h.db)
    const id = nextId()
    await store.start({ runId: id, job: "ingest", writeMode: "apply", startedAt: at })
    await store.finish(id, { status: "ok", finishedAt: at, counters, error: null })
  }
  const snap = async (c: Channel, at: string, stocks: NormalizedStock[]) =>
    insertStockSnapshot(h.db, { channelId: ids.get(c)!.id, runId: await runId(), takenAt: at, stocks })
  const mode = (c: Channel, m: WriteMode) => h.db.update(channels).set({ writeMode: m }).where(eq(channels.code, c))
  const logged = async (pid: string, c: Channel) =>
    (await h.db.select().from(writes).where(and(eq(writes.runId, pid), eq(writes.channelId, ids.get(c)!.id)))).map((w) => [w.barcode, w.before, w.after, w.mode, w.applied])
  const pool = async (at: string, send: ReturnType<typeof okSend>) => {
    const pid = await runId()
    const r = await runPool({ db: h.db, now: () => new Date(at), runId: pid, globalMode: "apply", send })
    return { pid, r }
  }

  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ids = await loadChannels(h.db)
    await mode("kit", "apply")
    await mode("ozon", "dry-run")
  })
  afterAll(async () => h?.close())

  it("площадка в apply — отправитель получает только её позиции с ключом площадки; в журнале apply/applied", async () => {
    await ingestRun("2026-09-28T10:04:00.000Z")
    await snap("wb", "2026-09-28T10:05:00.000Z", [s("A", 3), s("B", 1)])
    await snap("kit", "2026-09-28T10:05:00.000Z", [s("A", 2, "var-A"), s("B", 1, "var-B")])
    await snap("ozon", "2026-09-28T10:05:00.000Z", [s("A", 3, "JW-A"), s("B", 0, "JW-B")])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T10:06:00.000Z", send)
    expect(r.status).toBe("ok")
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith("kit", [{ channel: "kit", barcode: "A", field: "stock", before: 2, after: 3, externalSku: "var-A" }])
    expect(await logged(pid, "kit")).toEqual([["A", 2, 3, "apply", true]])
    expect(await logged(pid, "ozon")).toEqual([["B", 0, 1, "dry-run", false]])
    expect(r.counters).toMatchObject({ kitPlanned: 1, kitApplied: 1, ozonPlanned: 1, wbSelf: 0 })
  })

  it("сбой чтения заказов зеркала в последнем ingest — запись не делается: план в журнале dry-run, partial с текстом", async () => {
    await ingestRun("2026-09-28T10:09:00.000Z", { ozonOrdersFailed: 1 })
    await snap("wb", "2026-09-28T10:10:00.000Z", [s("A", 3), s("B", 1)])
    await snap("kit", "2026-09-28T10:10:00.000Z", [s("A", 1, "var-A"), s("B", 1, "var-B")])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T10:11:00.000Z", send)
    expect(send).not.toHaveBeenCalled()
    expect(await logged(pid, "kit")).toEqual([["A", 1, 3, "dry-run", false]])
    expect(r).toMatchObject({ status: "partial", counters: { writesBlockedOrders: 1 } })
    expect(r.error).toMatch(/не прочитаны заказы Ozon/)
  })

  it("каталог WB отклонён в последнем ingest — запись не делается", async () => {
    await ingestRun("2026-09-28T10:12:00.000Z", { catalogRejected: 1 })
    const send = okSend()
    const { r } = await pool("2026-09-28T10:13:00.000Z", send)
    expect(send).not.toHaveBeenCalled()
    expect(r).toMatchObject({ status: "partial", counters: { writesBlockedCatalog: 1 } })
  })

  it("сайт в apply, а витрина не на пуле — запись сайта не делается, остальные пишутся", async () => {
    await mode("site", "apply")
    await ingestRun("2026-09-28T10:14:00.000Z", { siteSourcePool: 0 })
    await snap("wb", "2026-09-28T10:15:00.000Z", [s("A", 3), s("B", 1)])
    await snap("site", "2026-09-28T10:15:00.000Z", [s("A", 5), s("B", 1)])
    await snap("kit", "2026-09-28T10:15:00.000Z", [s("A", 1, "var-A"), s("B", 1, "var-B")])
    const send = okSend()
    const { pid, r } = await pool("2026-09-28T10:16:00.000Z", send)
    expect(send.mock.calls.map((c) => c[0])).toEqual(["kit"])
    expect(await logged(pid, "site")).toEqual([["A", 5, 3, "dry-run", false]])
    expect(r).toMatchObject({ status: "partial", counters: { siteWriteBlocked: 1 } })
    expect(r.error).toMatch(/сайт: витрина берёт остаток не из пула/)
    await mode("site", "off")
  })

  it("предохранитель одной площадки не останавливает другую", async () => {
    await mode("ozon", "apply")
    await ingestRun("2026-09-28T10:19:00.000Z")
    await snap("wb", "2026-09-28T10:20:00.000Z", [s("A", 3), s("B", 1)])
    // 21 сирота KIT с остатком — 21 «в ноль» при пределе 20; Ozon — обычное расхождение.
    await snap("kit", "2026-09-28T10:20:00.000Z", Array.from({ length: 21 }, (_, i) => s(`Z${i}`, 1, `var-Z${i}`)))
    await snap("ozon", "2026-09-28T10:20:00.000Z", [s("A", 2, "JW-A"), s("B", 1, "JW-B")])
    const send = okSend()
    const { r } = await pool("2026-09-28T10:21:00.000Z", send)
    expect(send.mock.calls.map((c) => c[0])).toEqual(["ozon"])
    expect(r.counters).toMatchObject({ kitAborted_to_zero: 21, kitPlanned: 0, ozonApplied: 1 })
    expect(r.error).toMatch(/KIT: план отклонён предохранителем \(to_zero: 21 при пределе 20\)/)
    await mode("ozon", "dry-run")
  })
})
```

- [ ] **Step 3: Падающие тесты WB `self`** `apps/worker/src/jobs/pool-wb-self.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { channels, drizzleRunStore, insertStockSnapshot, loadChannels, loadPoolState, seedChannels, upsertOrders, upsertProducts } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { SendResult, Sender, WriteOp } from "@sync2/platforms"
import type { Channel, NormalizedStock } from "@sync2/shared"
import { eq } from "drizzle-orm"
import { runPool } from "./pool"

const WH = "1408913"
const w = (barcode: string, quantity: number, warehouse = WH): NormalizedStock => ({ barcode, externalSku: null, quantity, warehouse })
const okSend = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true })))

/**
 * Сквозная история режима «WB пишет sync2» на живой базе. Снимки WB задаются руками так, как их
 * отдал бы WB после наших записей (фальшивый отправитель склад не меняет). Баркоды разведены по
 * сценариям: A — запись по заказу, B — итог неизвестен, C — неустоявшийся снимок, D — чужой склад.
 */
describe.skipIf(!TEST_DATABASE_URL)("runPool — WB пишет sync2 (режим self)", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Awaited<ReturnType<typeof loadChannels>>
  let n = 0
  const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  const runId = async () => {
    const id = nextId()
    await insertRun(h.db, id)
    return id
  }
  const ingestRun = async (at: string) => {
    const store = drizzleRunStore(h.db)
    const id = nextId()
    await store.start({ runId: id, job: "ingest", writeMode: "apply", startedAt: at })
    await store.finish(id, { status: "ok", finishedAt: at, counters: {}, error: null })
  }
  const snapWb = async (at: string, stocks: NormalizedStock[]) => insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: await runId(), takenAt: at, stocks })
  const order = (c: Channel, id: string, barcode: string, at: string) =>
    upsertOrders(h.db, ids.get(c)!.id, [{ externalId: id, line: 0, barcode, quantity: 1, lifecycle: "open", occurredAt: at, raw: {} }])
  const pool = async (at: string, send: Sender) => runPool({ db: h.db, now: () => new Date(at), runId: await runId(), globalMode: "apply", send, wbWarehouseId: 1408913 })
  const item = async (barcode: string) => (await loadPoolState(h.db)).items.find((i) => i.barcode === barcode)

  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ids = await loadChannels(h.db)
    await h.db.update(channels).set({ writeMode: "apply" }).where(eq(channels.code, "wb"))
    await upsertProducts(h.db, [
      { barcode: "A", vendorCode: "JW-A", nmId: 1, title: "", subject: null, chrtId: 7001 },
      { barcode: "B", vendorCode: "JW-B", nmId: 2, title: "", subject: null, chrtId: 7002 },
      { barcode: "C", vendorCode: "JW-C", nmId: 3, title: "", subject: null, chrtId: 7003 },
      { barcode: "D", vendorCode: "JW-D", nmId: 4, title: "", subject: null, chrtId: 7004 },
    ])
  })
  afterAll(async () => h?.close())

  it("холодный старт в self — WB совпадает с пулом, записей нет", async () => {
    await ingestRun("2026-09-28T10:00:00.000Z")
    await snapWb("2026-09-28T10:00:00.000Z", [w("A", 3), w("B", 2), w("C", 2), w("D", 2)])
    const send = okSend()
    const r = await pool("2026-09-28T10:00:30.000Z", send)
    expect(r).toMatchObject({ status: "ok", counters: { wbSelf: 1, wbPlanned: 0 } })
    expect(send).not.toHaveBeenCalled()
  })

  it("заказ Ozon — sync2 пишет WB по chrtId, первым; ожидание WB = база, момент записи", async () => {
    await order("ozon", "O1", "A", "2026-09-28T10:02:00.000Z")
    await ingestRun("2026-09-28T10:05:00.000Z")
    await snapWb("2026-09-28T10:05:00.000Z", [w("A", 3), w("B", 2), w("C", 2), w("D", 2)])
    const send = okSend()
    const r = await pool("2026-09-28T10:05:30.000Z", send)
    expect(r.status).toBe("ok")
    expect(send.mock.calls[0]).toEqual(["wb", [{ channel: "wb", barcode: "A", field: "stock", before: 3, after: 2, externalSku: "7001" }]])
    expect(await item("A")).toMatchObject({ base: 2, wbExpected: 2, expectedAt: "2026-09-28T10:05:30.000Z" })
  })

  it("итог записи WB неизвестен — ожидание max(база, факт) и момент записи; зафиксировано ещё до сети", async () => {
    await order("kit", "K1", "B", "2026-09-28T10:12:00.000Z")
    await ingestRun("2026-09-28T10:15:00.000Z")
    await snapWb("2026-09-28T10:15:00.000Z", [w("A", 2), w("B", 2), w("C", 2), w("D", 2)])
    let duringSend: unknown
    const send = vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => {
      duringSend = await item("B")
      return ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: false, uncertain: true, error: "сеть: terminated" }))
    })
    const r = await pool("2026-09-28T10:15:30.000Z", send)
    expect(duringSend).toMatchObject({ base: 1, wbExpected: 2, expectedAt: "2026-09-28T10:15:30.000Z" })
    expect(await item("B")).toMatchObject({ base: 1, wbExpected: 2 })
    expect(r).toMatchObject({ status: "partial", counters: { wbWriteUnknown: 1, writeErrors: 1 } })
  })

  it("снимок WB не устоялся после записи — баркод не пишется, ожидание прежнее; следующий устоявшийся — пишется", async () => {
    await order("ozon", "O2", "C", "2026-09-28T10:19:00.000Z")
    await ingestRun("2026-09-28T10:20:00.000Z")
    await snapWb("2026-09-28T10:20:00.000Z", [w("A", 2), w("B", 2), w("C", 2), w("D", 2)])
    const first = okSend()
    await pool("2026-09-28T10:20:30.000Z", first)
    // B повторяется: прошлая запись с неизвестным итогом, на WB по-прежнему 2.
    expect(first.mock.calls[0]?.[1].map((o) => [o.barcode, o.before, o.after])).toEqual([
      ["B", 2, 1],
      ["C", 2, 1],
    ])

    await order("kit", "K2", "C", "2026-09-28T10:21:00.000Z")
    await ingestRun("2026-09-28T10:21:00.000Z")
    await snapWb("2026-09-28T10:21:00.000Z", [w("A", 2), w("B", 1), w("C", 1), w("D", 2)])
    const second = okSend()
    await pool("2026-09-28T10:21:30.000Z", second)
    expect(second).not.toHaveBeenCalled()
    expect(await item("C")).toMatchObject({ base: 0, wbExpected: 1 })

    await ingestRun("2026-09-28T10:25:00.000Z")
    await snapWb("2026-09-28T10:25:00.000Z", [w("A", 2), w("B", 1), w("C", 1), w("D", 2)])
    const third = okSend()
    await pool("2026-09-28T10:25:30.000Z", third)
    expect(third.mock.calls[0]).toEqual(["wb", [{ channel: "wb", barcode: "C", field: "stock", before: 1, after: 0, externalSku: "7003" }]])
  })

  it("в снимке WB второй склад — запись WB не делается: остаток — сумма складов, а пишем в один", async () => {
    await order("ozon", "O3", "D", "2026-09-28T10:29:00.000Z")
    await ingestRun("2026-09-28T10:30:00.000Z")
    await snapWb("2026-09-28T10:30:00.000Z", [w("A", 2), w("B", 1), w("C", 0), w("D", 2), w("A", 0, "777"), w("D", 0, "777")])
    const send = okSend()
    const r = await pool("2026-09-28T10:30:30.000Z", send)
    expect(send).not.toHaveBeenCalled()
    expect(r).toMatchObject({ status: "partial", counters: { wbForeignWarehouse: 1 } })
    expect(r.error).toMatch(/WB: в снимке склады 777 помимо склада записи 1408913/)
  })
})
```
Run: `npm run test:db -- apps/worker/src/jobs/pool-apply.db.test.ts apps/worker/src/jobs/pool-wb-self.db.test.ts` → FAIL.

- [ ] **Step 4: Реализация** — `apps/worker/src/jobs/pool.ts` целиком:
```ts
import {
  drizzleWriteStore,
  lastRunCounters,
  lastRunStatus,
  latestStockSnapshots,
  loadChannels,
  loadOrdersSince,
  loadPoolState,
  loadWbChrtIds,
  savePoolRun,
  type Db,
} from "@sync2/db"
import {
  MAX_STOCK_CHANGES_PER_RUN,
  MAX_STOCK_TO_ZERO_PER_RUN,
  WB_SETTLE_MINUTES,
  WB_SETTLE_MINUTES_SELF,
  aggregateStockByBarcode,
  applyWbWriteOutcomes,
  planStockWrites,
  reconcilePool,
  toPoolOrders,
  wbWriteGate,
  type StockChange,
  type WbWriteResult,
} from "@sync2/domain"
import { effectiveMode, executeWrites, type Sender, type WriteOp } from "@sync2/platforms"
import { CHANNELS, type Channel, type NormalizedStock, type WriteMode } from "@sync2/shared"
import { ORDERS_WINDOW_DAYS } from "./ingest"

/** Снимок старше этого в план не берётся: цель считалась бы от устаревшего остатка площадки. */
export const SNAPSHOT_FRESH_MINUTES = 20
/** Ошибок записи в runs.error — не больше стольких, остальное счётом. */
const MAX_WRITE_ERRORS_SHOWN = 5

/** Зеркала, отсутствие или старость снимка которых считается в staleSnapshots (как в 1.3b). */
const MIRRORS = ["ozon", "ym", "kit"] as const
/**
 * Сайт (1.3c): снимка нет вовсе — сайт не подключён (нет SITE_API_TOKEN), счётчиков сайта нет;
 * снимок есть, но старый — siteStale.
 */
const SITE = "site" as const
/**
 * Площадки, чьи заказы входят в пул: сбой их чтения в последнем ingest блокирует запись (спека §5).
 * Заказы WB в пул не входят — продажа WB приходит сигналом снимка, — и их сбой запись не блокирует.
 */
const ORDER_CHANNELS = ["ozon", "ym", "kit", "site"] as const
const LABEL: Record<Channel, string> = { wb: "WB", ozon: "Ozon", ym: "ЯМ", kit: "KIT", site: "сайт" }

/** Отправитель по умолчанию: без переданного отправителя любая попытка записи — ошибка позиции в журнале. */
export const noSender: Sender = async () => {
  throw new Error("отправитель не передан — запись на площадки невозможна")
}

export interface PoolJobResult {
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}

export interface PoolDeps {
  db: Db
  now: () => Date
  runId: string
  globalMode: WriteMode
  /** Отправка на площадки — buildSender (apps/worker/src/senders.ts). */
  send?: Sender
  /** Склад WB, на который пишет sync2 (WB_WAREHOUSE_ID); null или не передан — запись WB невозможна. */
  wbWarehouseId?: number | null
}

/**
 * Склады WB в снимке, кроме склада записи. Остаток WB в пуле — сумма всех складов продавца,
 * а пишем мы на один: при втором складе цель «пул» на одном складе дала бы сумму больше пула.
 */
export function wbForeignWarehouses(stocks: NormalizedStock[], warehouseId: number | null): string[] {
  const own = warehouseId === null ? null : String(warehouseId)
  return [...new Set(stocks.map((s) => s.warehouse ?? "без склада"))].filter((w) => w !== own).sort()
}

/**
 * Прогон пула (этап 1.4): пересчёт → план записей по каждой площадке отдельно → запись.
 *
 * WB пишет sync2 (режим self) ровно тогда, когда у WB действующий apply; иначе WB пишет старый
 * синк (external, семантика finstock). В self: шлюз WB по состоянию ДО прогона, приём сигнала
 * через WB_SETTLE_MINUTES_SELF, план WB с удержанием непринятых баркодов, и ожидание WB — по итогам
 * записи (applyWbWriteOutcomes). Пул фиксируется ДО сети с итогом «неизвестно» для уходящих
 * WB-позиций и второй раз — по фактическим итогам: процесс, убитый между записью и фиксацией
 * (timeout крона, OOM), оставляет безопасное ожидание max(база, факт).
 *
 * Блокировки прогона (площадка в журнале как dry-run, в сеть не уходит, partial с текстом):
 * сбой чтения заказов зеркала или отклонённый каталог WB в последнем ingest — все площадки;
 * витрина сайта не на пуле — сайт; второй склад WB или не задан склад записи — WB.
 */
export async function runPool(deps: PoolDeps): Promise<PoolJobResult> {
  const { db, runId } = deps
  const now = deps.now()
  const nowIso = now.toISOString()
  const counters: Record<string, number> = {}
  const channels = await loadChannels(db)
  const missing = CHANNELS.filter((c) => !channels.has(c))
  if (missing.length > 0) throw new Error(`площадки не заведены — выполните seed-channels (нет: ${missing.join(", ")})`)
  const channelId = (c: Channel) => channels.get(c)!.id

  // Действующий режим площадки — меньший из глобального и её собственного (как в executeWrites).
  const configured = Object.fromEntries(CHANNELS.map((c) => [c, effectiveMode(deps.globalMode, channels.get(c)!.writeMode)])) as Record<Channel, WriteMode>
  // Откат WB в dry-run возвращает семантику external сам, без отдельного переключателя.
  const wbSelf = configured.wb === "apply"
  const settle = wbSelf ? WB_SETTLE_MINUTES_SELF : WB_SETTLE_MINUTES
  counters.wbSelf = wbSelf ? 1 : 0

  const snaps = await latestStockSnapshots(db)
  const fresh = (takenAt: string) => now.getTime() - Date.parse(takenAt) <= SNAPSHOT_FRESH_MINUTES * 60_000

  const wb = snaps.get(channelId("wb"))
  if (!wb || !fresh(wb.takenAt)) {
    counters.noFreshWb = 1
    return { status: "partial", counters }
  }
  counters.wbSnapshotAgeMin = Math.round((now.getTime() - Date.parse(wb.takenAt)) / 60_000)

  const state = await loadPoolState(db)
  // Холодный старт считает все открытые заказы зеркал уже учтёнными: если ingest
  // последний раз прочитал не всё (partial), база построится от неполной картины навсегда.
  if (state.items.length === 0 && (await lastRunStatus(db, "ingest")) !== "ok") {
    counters.coldStartRefused = 1
    return { status: "partial", counters }
  }

  // Шлюз WB — по состоянию ДО прогона (wb-expectation.ts).
  const gate = wbWriteGate(state.items, wb, settle)
  const rows = await loadOrdersSince(db, new Date(now.getTime() - ORDERS_WINDOW_DAYS * 86_400_000).toISOString())
  const { orders, skipped } = toPoolOrders(rows, channelId("wb"))
  const result = reconcilePool({
    now: nowIso,
    items: state.items,
    wbSnapshot: wb,
    orders,
    applied: state.applied,
    cancelledApplied: state.cancelledApplied,
    settleMinutes: settle,
  })
  counters.events = result.events.length
  counters.ordersNoBarcode = skipped.noBarcode
  counters.noBase = result.skipped.noBase

  // ── Блокировки записи этого прогона ──
  const modes: Record<Channel, WriteMode> = { ...configured }
  const problems: string[] = []
  const block = (list: readonly Channel[], counter: string, text: string) => {
    let hit = false
    for (const c of list) {
      if (modes[c] !== "apply") continue
      modes[c] = "dry-run"
      hit = true
    }
    if (!hit) return
    counters[counter] = 1
    problems.push(text)
  }
  const ingestCounters = (await lastRunCounters(db, "ingest")) ?? {}
  const failedOrders = ORDER_CHANNELS.filter((c) => ingestCounters[`${c}OrdersFailed`] === 1)
  if (failedOrders.length > 0) {
    block(CHANNELS, "writesBlockedOrders", `запись остатков не делалась: не прочитаны заказы ${failedOrders.map((c) => LABEL[c]).join(", ")} (спека §5)`)
  }
  if (ingestCounters.catalogRejected === 1) {
    block(CHANNELS, "writesBlockedCatalog", "запись остатков не делалась: каталог WB отклонён в последнем ingest — заказы и снимки не прочитаны")
  }
  if (ingestCounters.siteSourcePool !== 1) {
    block([SITE], "siteWriteBlocked", "сайт: витрина берёт остаток не из пула (STOCK_SOURCE≠pool) — запись сайта не делалась")
  }
  const wbWarehouseId = deps.wbWarehouseId ?? null
  const foreign = wbForeignWarehouses(wb.stocks, wbWarehouseId)
  if (foreign.length > 0) {
    block(
      ["wb"],
      "wbForeignWarehouse",
      wbWarehouseId === null
        ? "WB: не задан WB_WAREHOUSE_ID — запись WB не делалась"
        : `WB: в снимке склады ${foreign.join(", ")} помимо склада записи ${wbWarehouseId} — запись WB не делалась`,
    )
  }

  // ── Планы: каждая площадка — отдельный вызов со своими предохранителями ──
  // WB первым: окно между перечитыванием остатка WB в отправителе и записью короче.
  const targets: Array<{ channel: Channel; stocks: NormalizedStock[] }> = []
  if (configured.wb !== "off") targets.push({ channel: "wb", stocks: wb.stocks })
  let stale = 0
  for (const c of MIRRORS) {
    const snap = snaps.get(channelId(c))
    if (snap && fresh(snap.takenAt)) targets.push({ channel: c, stocks: snap.stocks })
    else stale++
  }
  counters.staleSnapshots = stale
  const siteSnap = snaps.get(channelId(SITE))
  if (siteSnap && !fresh(siteSnap.takenAt)) counters.siteStale = 1
  else if (siteSnap) targets.push({ channel: SITE, stocks: siteSnap.stocks })

  const limits = { maxChanges: MAX_STOCK_CHANGES_PER_RUN, maxToZero: MAX_STOCK_TO_ZERO_PER_RUN }
  const changes: StockChange[] = []
  for (const t of targets) {
    const plan = planStockWrites(result.items, [t], t.channel === "wb" ? { ...limits, hold: gate.hold } : limits)
    if (plan.aborted) {
      counters[`${t.channel}Aborted_${plan.aborted.reason}`] = plan.aborted.count
      problems.push(`${LABEL[t.channel]}: план отклонён предохранителем (${plan.aborted.reason}: ${plan.aborted.count} при пределе ${plan.aborted.max})`)
      continue
    }
    changes.push(...plan.changes)
  }

  const chrtIds = changes.some((c) => c.channel === "wb") ? await loadWbChrtIds(db) : new Map<string, number>()
  const ops: WriteOp[] = changes.map((c) => ({
    channel: c.channel,
    barcode: c.barcode,
    field: "stock",
    before: c.before,
    after: c.after,
    // Ключ записи: WB — chrtId размера из каталога (products.wb_chrt_id); сайт — сам штрихкод; остальные — ключ из снимка.
    externalSku: c.channel === "wb" ? (chrtIds.get(c.barcode)?.toString() ?? null) : c.channel === SITE ? null : c.externalSku,
  }))

  // ── Фиксация пула и запись ──
  const wbActual = new Map([...aggregateStockByBarcode(wb.stocks)].map(([barcode, a]) => [barcode, a.quantity]))
  const itemsAfter = (results: ReadonlyMap<string, WbWriteResult>) =>
    wbSelf ? applyWbWriteOutcomes(result.items, state.items, gate.accepted, wbActual, results, nowIso) : result.items
  const pending = new Map<string, WbWriteResult>()
  if (modes.wb === "apply") for (const o of ops) if (o.channel === "wb") pending.set(o.barcode, "unknown")
  await savePoolRun(db, { runId, items: itemsAfter(pending), events: result.events })

  const outcomes = await executeWrites(ops, {
    globalMode: deps.globalMode,
    channelModes: modes,
    send: deps.send ?? noSender,
    record: drizzleWriteStore(db, runId, channels),
  })

  if (wbSelf) {
    const results = new Map<string, WbWriteResult>()
    for (const o of outcomes) {
      if (o.channel !== "wb" || o.mode !== "apply") continue
      results.set(o.barcode, o.applied ? "applied" : o.uncertain ? "unknown" : "failed")
    }
    await savePoolRun(db, { runId, items: itemsAfter(results), events: [] })
    counters.wbWriteUnknown = [...results.values()].filter((r) => r === "unknown").length
  }

  if (configured.wb !== "off") counters.wbPlanned = outcomes.filter((o) => o.channel === "wb").length
  for (const c of MIRRORS) counters[`${c}Planned`] = outcomes.filter((o) => o.channel === c).length
  if (siteSnap) counters[`${SITE}Planned`] = outcomes.filter((o) => o.channel === SITE).length
  for (const c of CHANNELS) {
    const applied = outcomes.filter((o) => o.channel === c && o.applied).length
    if (applied > 0) counters[`${c}Applied`] = applied
  }

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
В `pool.db.test.ts` (1.3b–1.3c) в тесте «ошибки в итогах записи — partial с текстом» ожидание `/kit A: запись на площадки подключается на этапе 1\.4/` заменить на `/kit A: отправитель не передан/` — остальные тесты файла не меняются.

- [ ] **Step 5: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add apps/worker/src/jobs/pool.ts apps/worker/src/jobs/pool.db.test.ts apps/worker/src/jobs/pool-apply.db.test.ts apps/worker/src/jobs/pool-wb-self.db.test.ts packages/db/src/runs-query.ts
git commit -m "sync2: pool пишет на площадки — блокировки, предохранители по площадкам, WB в режиме self"
```

---

### Task 11: CLI — предпросмотр и `apply --confirm`, `plan`, `site-push-all`

**Files:**
- Create: `packages/db/src/journal.ts`, `packages/db/src/journal.db.test.ts`, `apps/worker/src/apply-preview.ts`, `apply-preview.test.ts`, `apps/worker/src/jobs/site-push-all.ts`, `site-push-all.db.test.ts`
- Modify: `packages/db/src/runs-query.ts`, `packages/db/src/index.ts`, `apps/worker/src/cli.ts`

- [ ] **Step 1: Падающие тесты хранилища** `packages/db/src/journal.db.test.ts` (Task 12 допишет сюда же):
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { loadChannels } from "./channels"
import { writesOfRun } from "./journal"
import { upsertProducts } from "./products"
import { drizzleRunStore } from "./run-store"
import { latestRun } from "./runs-query"
import { writes } from "./schema"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "./test-db"

describe.skipIf(!TEST_DATABASE_URL)("журнал записей — этап 1.4", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Awaited<ReturnType<typeof loadChannels>>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ids = await loadChannels(h.db)
  })
  afterAll(async () => h?.close())

  it("последний завершённый прогон джобы — id, статус, время ISO, счётчики", async () => {
    const store = drizzleRunStore(h.db)
    for (const [id, at] of [["00000000-0000-4000-8000-0000000000a1", "2026-09-28T10:00:00.000Z"], ["00000000-0000-4000-8000-0000000000a2", "2026-09-28T10:05:00.000Z"]] as const) {
      await store.start({ runId: id, job: "pool", writeMode: "dry-run", startedAt: at })
      await store.finish(id, { status: "ok", finishedAt: at, counters: { events: 1 }, error: null })
    }
    expect(await latestRun(h.db, "pool")).toEqual({
      runId: "00000000-0000-4000-8000-0000000000a2",
      status: "ok",
      startedAt: "2026-09-28T10:05:00.000Z",
      counters: { events: 1 },
    })
    expect(await latestRun(h.db, "нет-такой")).toBeNull()
  })

  it("строки плана прогона — с артикулом и названием из products, по площадке и штрихкоду", async () => {
    const runId = "00000000-0000-4000-8000-0000000000b1"
    await insertRun(h.db, runId)
    await upsertProducts(h.db, [{ barcode: "A", vendorCode: "JW-A", nmId: 1, title: "Браслет", subject: null }])
    await h.db.insert(writes).values([
      { runId, channelId: ids.get("ozon")!.id, barcode: "Z", field: "stock", before: 1, after: 0, mode: "dry-run", applied: false, response: null, error: null },
      { runId, channelId: ids.get("kit")!.id, barcode: "A", field: "stock", before: 2, after: 3, mode: "apply", applied: true, response: null, error: null },
    ])
    expect(await writesOfRun(h.db, runId)).toEqual([
      { channel: "kit", barcode: "A", vendorCode: "JW-A", title: "Браслет", before: 2, after: 3, mode: "apply", applied: true, error: null },
      { channel: "ozon", barcode: "Z", vendorCode: null, title: null, before: 1, after: 0, mode: "dry-run", applied: false, error: null },
    ])
  })
})
```
Run: `npm run test:db -- packages/db/src/journal.db.test.ts` → FAIL.

- [ ] **Step 2: Хранилище.** В `packages/db/src/runs-query.ts`:
```ts
export interface RunInfo {
  runId: string
  status: string
  /** ISO 8601. */
  startedAt: string
  counters: Record<string, unknown>
}

/** Последний завершённый (ok/partial/failed) запуск джобы; ни одного — null. */
export async function latestRun(db: Db, job: string): Promise<RunInfo | null> {
  const [row] = await db
    .select({ runId: runs.runId, status: runs.status, startedAt: runs.startedAt, counters: runs.counters })
    .from(runs)
    .where(and(eq(runs.job, job), inArray(runs.status, ["ok", "partial", "failed"])))
    .orderBy(desc(runs.startedAt))
    .limit(1)
  if (!row) return null
  return { runId: row.runId, status: row.status, startedAt: toIsoOrNull(row.startedAt)!, counters: row.counters as Record<string, unknown> }
}
```
`packages/db/src/journal.ts`:
```ts
import { asc, eq } from "drizzle-orm"
import { isChannel, parseWriteMode, type Channel, type WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import { channels, products, writes } from "./schema"

/** Строка плана/записи прогона — для `plan` и предпросмотра `write-mode … apply`. */
export interface WriteRow {
  channel: Channel
  barcode: string
  vendorCode: string | null
  title: string | null
  before: number | null
  after: number
  mode: WriteMode
  applied: boolean
  error: string | null
}

/** Все записи прогона по площадке и штрихкоду, с артикулом и названием товара (для глаз владельца). */
export async function writesOfRun(db: Db, runId: string): Promise<WriteRow[]> {
  const rows = await db
    .select({
      code: channels.code,
      barcode: writes.barcode,
      vendorCode: products.vendorCode,
      title: products.title,
      before: writes.before,
      after: writes.after,
      mode: writes.mode,
      applied: writes.applied,
      error: writes.error,
    })
    .from(writes)
    .innerJoin(channels, eq(writes.channelId, channels.id))
    .leftJoin(products, eq(products.barcode, writes.barcode))
    .where(eq(writes.runId, runId))
    .orderBy(asc(channels.code), asc(writes.barcode))
  const out: WriteRow[] = []
  for (const r of rows) {
    if (!isChannel(r.code)) continue
    out.push({ channel: r.code, barcode: r.barcode, vendorCode: r.vendorCode, title: r.title, before: r.before, after: r.after, mode: parseWriteMode(r.mode, "off"), applied: r.applied, error: r.error })
  }
  return out
}
```
`packages/db/src/index.ts` — `export * from "./journal"`.

- [ ] **Step 3: Падающие тесты предпросмотра** `apps/worker/src/apply-preview.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { checkApplyPreview } from "./apply-preview"

const now = new Date("2026-09-28T10:10:00.000Z")
const run = (patch: Partial<{ status: string; startedAt: string; counters: Record<string, unknown> }> = {}) => ({
  runId: "r",
  status: "ok",
  startedAt: "2026-09-28T10:06:00.000Z",
  counters: { events: 0 },
  ...patch,
})

describe("checkApplyPreview — можно ли включать apply площадки", () => {
  it("свежий пересчитанный пул без отказа предохранителя — можно", () => {
    expect(checkApplyPreview(run(), "kit", now)).toEqual({ ok: true })
  })
  it("pool не запускался, упал, пул не пересчитан, план старше 15 минут — нельзя", () => {
    expect(checkApplyPreview(null, "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("ещё не запускался") })
    expect(checkApplyPreview(run({ status: "failed" }), "kit", now)).toMatchObject({ ok: false })
    expect(checkApplyPreview(run({ counters: { noFreshWb: 1 } }), "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("не пересчитан") })
    expect(checkApplyPreview(run({ startedAt: "2026-09-28T09:50:00.000Z" }), "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("20 мин") })
  })
  it("план площадки отклонён предохранителем — нельзя; чужой отказ не мешает", () => {
    expect(checkApplyPreview(run({ counters: { events: 0, kitAborted_to_zero: 21 } }), "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("kitAborted_to_zero") })
    expect(checkApplyPreview(run({ counters: { events: 0, siteAborted_to_zero: 21 } }), "kit", now)).toEqual({ ok: true })
  })
})
```
Реализация `apps/worker/src/apply-preview.ts`:
```ts
import type { RunInfo } from "@sync2/db"
import type { Channel } from "@sync2/shared"

/** План старше этого для решения «включать apply» не годится — сначала tick. */
export const APPLY_PREVIEW_MAX_AGE_MIN = 15

/**
 * Можно ли включать apply площадки по последнему прогону pool (решение 4 плана 1.4): план свежий,
 * пул пересчитан (есть счётчик events), и план этой площадки не отклонён предохранителем.
 */
export function checkApplyPreview(run: RunInfo | null, channel: Channel, now: Date): { ok: true } | { ok: false; reason: string } {
  if (!run) return { ok: false, reason: "pool ещё не запускался — сначала tick" }
  if (run.status !== "ok" && run.status !== "partial") return { ok: false, reason: `последний pool — ${run.status}` }
  if (!("events" in run.counters)) return { ok: false, reason: "в последнем pool пул не пересчитан (нет свежего снимка WB или отказ холодного старта)" }
  const ageMin = Math.round((now.getTime() - Date.parse(run.startedAt)) / 60_000)
  if (ageMin > APPLY_PREVIEW_MAX_AGE_MIN) return { ok: false, reason: `последний pool ${ageMin} мин назад — план устарел, сначала tick` }
  const aborted = Object.keys(run.counters).filter((k) => k.startsWith(`${channel}Aborted_`))
  if (aborted.length > 0) return { ok: false, reason: `план ${channel} отклонён предохранителем (${aborted.join(", ")}) — разобрать до apply` }
  return { ok: true }
}
```

- [ ] **Step 4: Падающий тест полного PUT** `apps/worker/src/jobs/site-push-all.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { drizzleRunStore, loadChannels, savePoolRun, seedChannels, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import { SITE_UNKNOWN_BARCODE, type SendResult, type WriteOp } from "@sync2/platforms"
import type { Channel } from "@sync2/shared"
import { eq } from "drizzle-orm"
import { runSitePushAll } from "./site-push-all"

describe.skipIf(!TEST_DATABASE_URL)("runSitePushAll", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    const rid = "00000000-0000-4000-8000-0000000000c1"
    await insertRun(h.db, rid)
    const item = (barcode: string, base: number) => ({ barcode, base, wbExpected: base, expectedAt: null, wbSnapshotAt: null })
    await savePoolRun(h.db, { runId: rid, items: [item("A", 2), item("B", 0)], events: [] })
    const store = drizzleRunStore(h.db)
    const pid = "00000000-0000-4000-8000-0000000000c2"
    await store.start({ runId: pid, job: "pool", writeMode: "dry-run", startedAt: "2026-09-28T10:01:00.000Z" })
    await store.finish(pid, { status: "ok", finishedAt: "2026-09-28T10:01:01.000Z", counters: { events: 0 }, error: null })
  })
  afterAll(async () => h?.close())

  it("весь пул на сайт — и нули; неизвестные сайту штрихкоды — отдельный счётчик, не ошибка", async () => {
    const send = vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> =>
      ops.map((o) => (o.barcode === "B" ? { barcode: "B", field: "stock", ok: false, error: `${SITE_UNKNOWN_BARCODE} B` } : { barcode: o.barcode, field: "stock", ok: true })),
    )
    const runId = "00000000-0000-4000-8000-0000000000c3"
    await insertRun(h.db, runId)
    const r = await runSitePushAll({ db: h.db, now: () => new Date("2026-09-28T10:05:00.000Z"), runId, globalMode: "apply", send })
    expect(send).toHaveBeenCalledWith("site", [
      { channel: "site", barcode: "A", field: "stock", before: null, after: 2, externalSku: null },
      { channel: "site", barcode: "B", field: "stock", before: null, after: 0, externalSku: null },
    ])
    expect(r).toEqual({ status: "ok", counters: { sent: 2, applied: 1, siteUnknown: 1, failed: 0 } })
    const site = (await loadChannels(h.db)).get("site")!.id
    expect((await h.db.select().from(writes).where(eq(writes.runId, runId))).every((w) => w.channelId === site && w.mode === "apply")).toBe(true)
  })

  it("пул старше 15 минут — ошибка до записи", async () => {
    const send = vi.fn()
    await expect(
      runSitePushAll({ db: h.db, now: () => new Date("2026-09-28T10:30:00.000Z"), runId: "00000000-0000-4000-8000-0000000000c4", globalMode: "apply", send }),
    ).rejects.toThrow(/пул не пересчитывался последние 15 мин/)
    expect(send).not.toHaveBeenCalled()
  })
})
```
Реализация `apps/worker/src/jobs/site-push-all.ts`:
```ts
import { drizzleWriteStore, lastRunWithCounterAt, loadChannels, loadPoolState, type Db } from "@sync2/db"
import { SITE_UNKNOWN_BARCODE, executeWrites, type Sender, type WriteOp } from "@sync2/platforms"
import { CHANNELS, type Channel, type WriteMode } from "@sync2/shared"

/** Пул старше этого на сайт целиком не выкладывается — сначала tick. */
export const SITE_PUSH_MAX_POOL_AGE_MIN = 15

/**
 * Шаг A этапа 1.4: весь пул на сайт (`PUT /api/internal/stocks`), все штрихкоды, нули включены —
 * до переключения витрины на STOCK_SOURCE=pool, иначе товары без строки в pool_stocks покажут 0.
 * Режим сайта на эту команду — apply (ручной запуск с --confirm); глобальный SYNC_WRITE_MODE главнее.
 * Штрихкоды пула, которых нет в каталоге сайта, — счётчик siteUnknown, не ошибка.
 */
export async function runSitePushAll(deps: { db: Db; now: () => Date; runId: string; globalMode: WriteMode; send: Sender }): Promise<{
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}> {
  const { db } = deps
  const recalcAt = await lastRunWithCounterAt(db, "pool", "events")
  if (recalcAt === null || deps.now().getTime() - Date.parse(recalcAt) > SITE_PUSH_MAX_POOL_AGE_MIN * 60_000) {
    throw new Error(`пул не пересчитывался последние ${SITE_PUSH_MAX_POOL_AGE_MIN} мин — сначала tick`)
  }
  const channels = await loadChannels(db)
  const { items } = await loadPoolState(db)
  const ops: WriteOp[] = items.map((i) => ({ channel: "site", barcode: i.barcode, field: "stock", before: null, after: Math.max(0, i.base), externalSku: null }))
  const channelModes = Object.fromEntries(CHANNELS.map((c) => [c, c === "site" ? "apply" : "off"])) as Record<Channel, WriteMode>
  const outcomes = await executeWrites(ops, { globalMode: deps.globalMode, channelModes, send: deps.send, record: drizzleWriteStore(db, deps.runId, channels) })
  const isUnknown = (e: string | null) => e !== null && e.startsWith(SITE_UNKNOWN_BARCODE)
  const failed = outcomes.filter((o) => o.error !== null && !isUnknown(o.error))
  const counters = {
    sent: ops.length,
    applied: outcomes.filter((o) => o.applied).length,
    siteUnknown: outcomes.filter((o) => isUnknown(o.error)).length,
    failed: failed.length,
  }
  if (ops.length > 0 && outcomes.every((o) => o.mode !== "apply")) {
    return { status: "partial", counters, error: `запись не делалась: SYNC_WRITE_MODE=${deps.globalMode}` }
  }
  if (failed.length > 0) return { status: "partial", counters, error: failed.slice(0, 5).map((o) => `${o.barcode}: ${o.error}`).join("; ") }
  return { status: "ok", counters }
}
```
Run: `npx vitest run apps/worker/src/apply-preview.test.ts && npm run test:db -- apps/worker/src/jobs/site-push-all.db.test.ts packages/db/src/journal.db.test.ts` → зелёные.

- [ ] **Step 5: CLI.** В `apps/worker/src/cli.ts`:
  - импорты: из `@sync2/db` — `latestRun`, `writesOfRun`, `type RunInfo`, `type WriteRow`; из `@sync2/platforms` — `type Sender`; `import { checkApplyPreview } from "./apply-preview"`, `import { buildSender } from "./senders"`, `import { runSitePushAll } from "./jobs/site-push-all"`;
  - константы флагов и проверку флагов в `main` заменить:
```ts
/** Ручной обход ворот каталога WB в ingest (и tick): принять каталог без проверки доли. */
const ACCEPT_CATALOG_FLAG = "--accept-catalog"
/** Подтверждение необратимого шага (этап 1.4): write-mode … apply, site-push-all. */
const CONFIRM_FLAG = "--confirm"
/** drift: сводка в терминал, а не в Telegram. */
const PRINT_FLAG = "--print"
const ALLOWED_FLAGS: Record<string, readonly string[]> = {
  ingest: [ACCEPT_CATALOG_FLAG],
  tick: [ACCEPT_CATALOG_FLAG],
  "write-mode": [CONFIRM_FLAG],
  "site-push-all": [CONFIRM_FLAG],
  drift: [PRINT_FLAG],
}
```
```ts
  for (const flag of flags) {
    if (!(ALLOWED_FLAGS[cmd] ?? []).includes(flag)) {
      console.error(`неизвестный флаг для ${cmd}: ${flag}\n\n${USAGE}`)
      return 2
    }
  }
```
  - помощники рядом с `notifyTransition`:
```ts
/** Отправитель и склад WB для pool. Конфиг площадок битый — pool падает (failed), как ingest. */
function writeTargets(env: NodeJS.ProcessEnv): { send: Sender; wbWarehouseId: number | null } {
  const cfg = loadChannelsConfig(env)
  return { send: buildSender(cfg), wbWarehouseId: cfg.wb.warehouseId }
}

/** План или итог записей прогона pool — для глаз владельца перед «да». */
function printPlan(run: RunInfo, rows: WriteRow[]): void {
  console.log(`pool ${run.startedAt} ${run.status} ${JSON.stringify(run.counters)}`)
  if (rows.length === 0) {
    console.log("записей в плане нет")
    return
  }
  for (const w of rows) {
    const state = w.applied ? "применено" : w.error ? `ошибка: ${w.error}` : w.mode
    console.log([w.channel, w.barcode, w.vendorCode ?? "", `${w.before ?? "—"} → ${w.after}`, state, (w.title ?? "").slice(0, 40)].join("\t"))
  }
}
```
  - в `runPoolCommand` вызов: `runPool({ db, now: () => new Date(), runId: ctx.runId, globalMode: config.writeMode, ...writeTargets(process.env) })`;
  - ветку `write-mode` заменить проверкой режима и apply:
```ts
      case "write-mode": {
        if (!arg || !isChannel(arg)) {
          console.error(`неизвестная площадка: ${arg}\n\n${USAGE}`)
          return 2
        }
        if (arg2 !== "off" && arg2 !== "dry-run" && arg2 !== "apply") {
          console.error(`неизвестный режим записи: ${arg2} (ожидается ${WRITE_MODES.join(" | ")})\n\n${USAGE}`)
          return 2
        }
        if (arg2 === "apply") {
          // Решение 4 плана 1.4: apply — только после просмотра плана последнего тика и с --confirm.
          const run = await latestRun(db, "pool")
          if (run) printPlan(run, (await writesOfRun(db, run.runId)).filter((w) => w.channel === arg))
          const verdict = checkApplyPreview(run, arg, new Date())
          if (!verdict.ok) {
            console.error(`apply не включён: ${verdict.reason}`)
            return 2
          }
          if (!flags.includes(CONFIRM_FLAG)) {
            console.error(`apply не включён: посмотрите план ${arg} выше и повторите с ${CONFIRM_FLAG}`)
            return 2
          }
        }
        const updated = await db.update(channels).set({ writeMode: arg2 }).where(eq(channels.code, arg)).returning({ code: channels.code })
        if (updated.length === 0) {
          console.error(`площадка ${arg} не заведена в базе — выполните seed-channels`)
          return 2
        }
        const rows = await db.select({ code: channels.code, writeMode: channels.writeMode }).from(channels).orderBy(channels.code)
        for (const r of rows) console.log(`${r.code}\t${r.writeMode}`)
        return 0
      }
```
  - новые ветки перед `default`:
```ts
      case "plan": {
        if (arg && !isChannel(arg)) {
          console.error(`неизвестная площадка: ${arg}\n\n${USAGE}`)
          return 2
        }
        const run = await latestRun(db, "pool")
        if (!run) {
          console.error("pool ещё не запускался")
          return 2
        }
        const rows = await writesOfRun(db, run.runId)
        printPlan(run, arg ? rows.filter((w) => w.channel === arg) : rows)
        return 0
      }
      case "site-push-all": {
        if (!flags.includes(CONFIRM_FLAG)) {
          console.error(`site-push-all пишет весь пул на сайт — повторите с ${CONFIRM_FLAG}`)
          return 2
        }
        const outcome = await withRun("site-push-all", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (ctx) => {
          const r = await runSitePushAll({ db, now: () => new Date(), runId: ctx.runId, globalMode: config.writeMode, send: buildSender(loadChannelsConfig(process.env)) })
          return { status: r.status, counters: r.counters, error: r.error }
        })
        console.log(`${outcome.status} ${JSON.stringify(outcome.counters)}${outcome.error ? ` — ${outcome.error}` : ""}`)
        return outcome.status === "ok" ? 0 : 1
      }
```
  - `USAGE`: строку `pool …` заменить на `  pool                   пересчёт пула и запись на площадки по режимам channels`, строку `write-mode …` — на:
```
  write-mode <площадка> <off|dry-run|apply> [--confirm]
                         режим записи площадки; apply — только после плана последнего тика и с --confirm
  plan [<площадка>]      план/итог записей последнего прогона pool
  site-push-all --confirm
                         весь пул на сайт (шаг A этапа 1.4)
```

- [ ] **Step 6: Локальная проверка на тестовой базе без площадок:**
```bash
npm run cli -- write-mode kit apply    # код 2: «pool ещё не запускался»
npm run cli -- plan                    # код 2: «pool ещё не запускался»
npm run cli -- site-push-all           # код 2: «повторите с --confirm»
```

- [ ] **Step 7: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add packages/db/src/journal.ts packages/db/src/journal.db.test.ts packages/db/src/runs-query.ts packages/db/src/index.ts apps/worker/src/apply-preview.ts apps/worker/src/apply-preview.test.ts apps/worker/src/jobs/site-push-all.ts apps/worker/src/jobs/site-push-all.db.test.ts apps/worker/src/cli.ts
git commit -m "sync2: CLI — план последнего тика, apply только с --confirm, полный PUT пула на сайт"
```

---

### Task 12: Наблюдаемость — `drift`, `check-wb`, `prune`, напоминания

**Files:**
- Modify: `packages/db/src/journal.ts`, `journal.db.test.ts`, `apps/worker/src/jobs/compare-v1.ts`, `apps/worker/src/transition.ts`, `transition.test.ts`, `apps/worker/src/cli.ts`
- Create: `apps/worker/src/jobs/drift.ts`, `drift.test.ts`

- [ ] **Step 1: Падающие тесты хранилища** — дописать в `packages/db/src/journal.db.test.ts` (импорты: `barcodesAppliedSince`, `pruneJournal`, `writeStatsSince` из `./journal`; `insertStockSnapshot` из `./stock-snapshots`; `stockSnapshotsRaw` из `./schema`):
```ts
  it("статистика записей apply за период по площадкам и повторные записи одного баркода", async () => {
    const runId = "00000000-0000-4000-8000-0000000000d1"
    await insertRun(h.db, runId)
    await insertRun(h.db, "00000000-0000-4000-8000-0000000000c9")
    const ozon = ids.get("ozon")!.id
    const at = (m: number) => `2026-09-20T10:0${m}:00.000Z`
    await h.db.insert(writes).values([
      { runId, channelId: ozon, barcode: "R", field: "stock", before: 1, after: 2, mode: "apply", applied: true, response: null, error: null, createdAt: at(1) },
      { runId: "00000000-0000-4000-8000-0000000000b1", channelId: ozon, barcode: "R", field: "stock", before: 1, after: 2, mode: "apply", applied: true, response: null, error: null, createdAt: at(2) },
      { runId: "00000000-0000-4000-8000-0000000000c9", channelId: ozon, barcode: "R", field: "stock", before: 1, after: 2, mode: "apply", applied: true, response: null, error: null, createdAt: at(3) },
      { runId, channelId: ozon, barcode: "E", field: "stock", before: 1, after: 0, mode: "apply", applied: false, response: null, error: "409", createdAt: at(4) },
      { runId, channelId: ozon, barcode: "D", field: "stock", before: 1, after: 0, mode: "dry-run", applied: false, response: null, error: null, createdAt: at(5) },
    ])
    const stats = await writeStatsSince(h.db, "2026-09-20T00:00:00.000Z")
    expect(stats.ozon).toEqual({ applied: 3, failed: 1, barcodes: 2, repeated: [{ barcode: "R", times: 3 }] })
    expect(stats.wb).toEqual({ applied: 0, failed: 0, barcodes: 0, repeated: [] })
    expect(await barcodesAppliedSince(h.db, ozon, at(2))).toEqual(new Set(["R"]))
  })

  it("ретенция: план (off/dry-run) — 14 дней, apply — 90, снимки — 7, последний снимок площадки остаётся всегда", async () => {
    const runId = "00000000-0000-4000-8000-0000000000e1"
    await insertRun(h.db, runId)
    const kit = ids.get("kit")!.id
    const wb = ids.get("wb")!.id
    const row = (barcode: string, mode: "dry-run" | "apply", createdAt: string) => ({ runId, channelId: kit, barcode, field: "stock", before: 0, after: 1, mode, applied: false, response: null, error: null, createdAt })
    await h.db.insert(writes).values([row("P1", "dry-run", "2026-09-10T00:00:00.000Z"), row("P2", "dry-run", "2026-09-20T00:00:00.000Z"), row("P3", "apply", "2026-06-20T00:00:00.000Z"), row("P4", "apply", "2026-09-01T00:00:00.000Z")])
    for (const at of ["2026-09-10T00:00:00.000Z", "2026-09-15T00:00:00.000Z", "2026-09-27T00:00:00.000Z"]) await insertStockSnapshot(h.db, { channelId: kit, runId, takenAt: at, stocks: [] })
    await insertStockSnapshot(h.db, { channelId: wb, runId, takenAt: "2026-09-10T00:00:00.000Z", stocks: [] })
    expect(await pruneJournal(h.db, "2026-09-28T00:00:00.000Z")).toEqual({ writesPlan: 1, writesApply: 1, snapshots: 2 })
    const left = (await h.db.select({ barcode: writes.barcode }).from(writes).where(eq(writes.runId, runId))).map((r) => r.barcode).sort()
    expect(left).toEqual(["P2", "P4"])
    expect((await h.db.select().from(stockSnapshotsRaw)).map((s) => [s.channelId, s.takenAt.slice(0, 10)]).sort()).toEqual([
      [wb, "2026-09-10"],
      [kit, "2026-09-27"],
    ].sort())
  })
```
(импорт `eq` из `drizzle-orm`. Прогон `…b1` создан тестом «строки плана прогона» выше — порядок тестов в файле важен. Тест ретенции — последним: строки прочих тестов созданы с `created_at` не старше 20.09 или `now()` и под удаление не попадают; снимков другие тесты файла не пишут.)
Run: `npm run test:db -- packages/db/src/journal.db.test.ts` → FAIL.

- [ ] **Step 2: Хранилище** — дописать в `packages/db/src/journal.ts` (импорты дополнить: `and, desc, gt, gte, inArray, lt, notInArray` из `drizzle-orm`; `CHANNELS` из `@sync2/shared`; `stockSnapshotsRaw` из `./schema`):
```ts
/** Записи apply одной площадки за период. */
export interface WriteStats {
  applied: number
  failed: number
  /** Разных штрихкодов среди записей. */
  barcodes: number
  /** Штрихкоды, применённые не меньше REPEATED_WRITES_MIN раз, — запись «не держится». */
  repeated: Array<{ barcode: string; times: number }>
}

export const REPEATED_WRITES_MIN = 3

/** Статистика записей apply с sinceIso по площадкам — для суточной сводки drift. */
export async function writeStatsSince(db: Db, sinceIso: string): Promise<Record<Channel, WriteStats>> {
  const out = Object.fromEntries(CHANNELS.map((c) => [c, { applied: 0, failed: 0, barcodes: 0, repeated: [] }])) as Record<Channel, WriteStats>
  const rows = await db
    .select({ code: channels.code, barcode: writes.barcode, applied: writes.applied })
    .from(writes)
    .innerJoin(channels, eq(writes.channelId, channels.id))
    .where(and(eq(writes.mode, "apply"), gte(writes.createdAt, sinceIso)))
  const seen = new Map<Channel, Set<string>>()
  const appliedTimes = new Map<Channel, Map<string, number>>()
  for (const r of rows) {
    if (!isChannel(r.code)) continue
    const stats = out[r.code]
    const set = seen.get(r.code) ?? new Set<string>()
    set.add(r.barcode)
    seen.set(r.code, set)
    if (!r.applied) {
      stats.failed++
      continue
    }
    stats.applied++
    const times = appliedTimes.get(r.code) ?? new Map<string, number>()
    times.set(r.barcode, (times.get(r.barcode) ?? 0) + 1)
    appliedTimes.set(r.code, times)
  }
  for (const [c, set] of seen) out[c].barcodes = set.size
  for (const [c, times] of appliedTimes) {
    out[c].repeated = [...times]
      .filter(([, n]) => n >= REPEATED_WRITES_MIN)
      .map(([barcode, n]) => ({ barcode, times: n }))
      .sort((a, b) => b.times - a.times || (a.barcode < b.barcode ? -1 : 1))
  }
  return out
}

/** Штрихкоды площадки, применённые после момента sinceIso: запись «в пути» — снимок её ещё не видел. */
export async function barcodesAppliedSince(db: Db, channelId: number, sinceIso: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ barcode: writes.barcode })
    .from(writes)
    .where(and(eq(writes.channelId, channelId), eq(writes.mode, "apply"), eq(writes.applied, true), gt(writes.createdAt, sinceIso)))
  return new Set(rows.map((r) => r.barcode))
}

/** Строки плана (off/dry-run) — пишутся каждым тиком, пока площадка не выровнена. */
export const WRITES_KEEP_PLAN_DAYS = 14
/** Настоящие записи — дольше: разбор споров с площадкой. */
export const WRITES_KEEP_APPLY_DAYS = 90
/** Снимки остатков: нужен только последний; неделя — для разбора. */
export const SNAPSHOTS_KEEP_DAYS = 7

/**
 * Ретенция журнала (решение 5 плана 1.4). Последний снимок каждой площадки не удаляется никогда,
 * даже старый: по нему pool и drift видят площадку. Прогоны (`runs`) не удаляются — на них ссылаются
 * события пула и заказы.
 */
export async function pruneJournal(db: Db, nowIso: string): Promise<{ writesPlan: number; writesApply: number; snapshots: number }> {
  const before = (days: number) => new Date(Date.parse(nowIso) - days * 86_400_000).toISOString()
  const plan = await db
    .delete(writes)
    .where(and(inArray(writes.mode, ["off", "dry-run"]), lt(writes.createdAt, before(WRITES_KEEP_PLAN_DAYS))))
    .returning({ id: writes.id })
  const apply = await db
    .delete(writes)
    .where(and(eq(writes.mode, "apply"), lt(writes.createdAt, before(WRITES_KEEP_APPLY_DAYS))))
    .returning({ id: writes.id })
  const latest = db
    .selectDistinctOn([stockSnapshotsRaw.channelId], { id: stockSnapshotsRaw.id })
    .from(stockSnapshotsRaw)
    .orderBy(stockSnapshotsRaw.channelId, desc(stockSnapshotsRaw.takenAt))
  const snaps = await db
    .delete(stockSnapshotsRaw)
    .where(and(lt(stockSnapshotsRaw.takenAt, before(SNAPSHOTS_KEEP_DAYS)), notInArray(stockSnapshotsRaw.id, latest)))
    .returning({ id: stockSnapshotsRaw.id })
  return { writesPlan: plan.length, writesApply: apply.length, snapshots: snaps.length }
}
```

- [ ] **Step 3: Падающие тесты сводки** `apps/worker/src/jobs/drift.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { WriteStats } from "@sync2/db"
import { CHANNELS, type Channel } from "@sync2/shared"
import { channelDrift, formatDrift } from "./drift"

const s = (barcode: string, quantity: number) => ({ barcode, externalSku: null, quantity, warehouse: null })
const pool = new Map([["A", 2], ["B", 0], ["C", 1]])
const noStats = Object.fromEntries(CHANNELS.map((c) => [c, { applied: 0, failed: 0, barcodes: 0, repeated: [] }])) as Record<Channel, WriteStats>

describe("channelDrift", () => {
  it("совпадения, расхождения, сирота с остатком; записанное после снимка — «в пути», не расхождение", () => {
    const d = channelDrift("ozon", "2026-09-28T09:00:00.000Z", pool, [s("A", 1), s("B", 0), s("C", 3), s("Z", 1), s("Y", 0)], new Set(["C"]))
    expect(d).toEqual({
      channel: "ozon",
      takenAt: "2026-09-28T09:00:00.000Z",
      compared: 5,
      inFlight: 1,
      mismatches: [
        { barcode: "A", pool: 2, actual: 1 },
        { barcode: "Z", pool: 0, actual: 1 },
      ],
    })
  })
})

describe("formatDrift", () => {
  it("строка на площадку, записи за сутки, повторные записи", () => {
    const text = formatDrift(
      [
        channelDrift("wb", "2026-09-28T09:58:00.000Z", pool, [s("A", 2), s("B", 0), s("C", 1)], new Set()),
        channelDrift("ozon", "2026-09-28T09:58:00.000Z", pool, [s("A", 1)], new Set()),
      ],
      { ...noStats, ozon: { applied: 5, failed: 1, barcodes: 4, repeated: [{ barcode: "A", times: 5 }] } },
      { now: new Date("2026-09-28T10:00:00.000Z"), lastPoolRecalcAt: "2026-09-28T09:56:00.000Z", failedRuns: 0, stuckRuns: 0 },
    )
    expect(text).toContain("WB: расходится 0 из 3 (снимок 2 мин, в пути 0)")
    expect(text).toContain("Ozon: расходится 1 из 1 (снимок 2 мин, в пути 0) — A: пул 2, на площадке 1")
    expect(text).toContain("Ozon 5/1/4")
    expect(text).toContain("Повторные записи (≥3 за сутки): Ozon A ×5")
  })
})
```
Run: `npx vitest run apps/worker/src/jobs/drift.test.ts` → FAIL.

- [ ] **Step 4: Реализация.** В `apps/worker/src/jobs/compare-v1.ts`: `function formatMsk` → `export function formatMsk`; комментарий у `POOL_STALE_MS`: «тик — раз в 5 минут (этап 1.4)». `apps/worker/src/jobs/drift.ts`:
```ts
import {
  barcodesAppliedSince,
  countFailedRunsSince,
  countStuckRunsSince,
  lastRunWithCounterAt,
  latestStockSnapshots,
  loadChannels,
  loadPoolState,
  writeStatsSince,
  REPEATED_WRITES_MIN,
  type Db,
  type WriteStats,
} from "@sync2/db"
import { aggregateStockByBarcode } from "@sync2/domain"
import { CHANNELS, type Channel, type NormalizedStock } from "@sync2/shared"
import type { Notifier } from "../notify"
import { COMPARE_WINDOW_MS, MAX_TELEGRAM_TEXT, STUCK_RUN_MS, formatMsk } from "./compare-v1"

const LABEL: Record<Channel, string> = { wb: "WB", ozon: "Ozon", ym: "ЯМ", kit: "KIT", site: "сайт" }
const MAX_LIST = 10
const TRUNCATED_MARK = "\n… (сводка обрезана)"

/** Пул против последнего снимка одной площадки. */
export interface ChannelDrift {
  channel: Channel
  takenAt: string
  /** Штрихкодов в снимке площадки. */
  compared: number
  /** Расходились бы, но запись применена после снимка — следующий снимок её увидит. */
  inFlight: number
  mismatches: Array<{ barcode: string; pool: number; actual: number }>
}

/**
 * Расхождение площадки с пулом. Штрихкод площадки, которого нет в пуле, — цель 0 (как в
 * planStockWrites): сирота с остатком — расхождение, с нулём — нет.
 */
export function channelDrift(channel: Channel, takenAt: string, pool: ReadonlyMap<string, number>, stocks: NormalizedStock[], inFlight: ReadonlySet<string>): ChannelDrift {
  const mismatches: ChannelDrift["mismatches"] = []
  let compared = 0
  let flight = 0
  for (const [barcode, { quantity }] of aggregateStockByBarcode(stocks)) {
    compared++
    const target = Math.max(0, pool.get(barcode) ?? 0)
    if (quantity === target) continue
    if (inFlight.has(barcode)) {
      flight++
      continue
    }
    mismatches.push({ barcode, pool: target, actual: quantity })
  }
  mismatches.sort((a, b) => (a.barcode < b.barcode ? -1 : a.barcode > b.barcode ? 1 : 0))
  return { channel, takenAt, compared, inFlight: flight, mismatches }
}

function driftLine(d: ChannelDrift, now: Date): string {
  const age = Math.round((now.getTime() - Date.parse(d.takenAt)) / 60_000)
  const head = `${LABEL[d.channel]}: расходится ${d.mismatches.length} из ${d.compared} (снимок ${age} мин, в пути ${d.inFlight})`
  if (d.mismatches.length === 0) return head
  const shown = d.mismatches.slice(0, MAX_LIST).map((m) => `${m.barcode}: пул ${m.pool}, на площадке ${m.actual}`)
  const rest = d.mismatches.length > shown.length ? `, … (ещё ${d.mismatches.length - shown.length})` : ""
  return `${head} — ${shown.join(", ")}${rest}`
}

/** Суточная сводка «пул ↔ площадки» для Telegram — числа для решения, не отчёт с рекомендацией. */
export function formatDrift(
  drifts: ChannelDrift[],
  stats: Record<Channel, WriteStats>,
  extra: { now: Date; lastPoolRecalcAt: string | null; failedRuns: number; stuckRuns: number },
): string {
  const writesLine = CHANNELS.map((c) => `${LABEL[c]} ${stats[c].applied}/${stats[c].failed}/${stats[c].barcodes}`).join(" · ")
  const repeated = CHANNELS.flatMap((c) => stats[c].repeated.map((r) => `${LABEL[c]} ${r.barcode} ×${r.times}`))
  const text = [
    "📏 sync2: пул ↔ площадки",
    ...drifts.map((d) => driftLine(d, extra.now)),
    `Записи за сутки (применено/ошибок/баркодов): ${writesLine}`,
    `Повторные записи (≥${REPEATED_WRITES_MIN} за сутки): ${repeated.length ? repeated.slice(0, MAX_LIST).join(", ") : "—"}`,
    extra.lastPoolRecalcAt === null ? "Пул: ⚠️ ни разу не пересчитан" : `Пул пересчитан: ${formatMsk(extra.lastPoolRecalcAt)}`,
    `Упавших прогонов за сутки: ${extra.failedRuns}, зависших (running > ${STUCK_RUN_MS / 60_000} мин): ${extra.stuckRuns}`,
  ].join("\n")
  return text.length <= MAX_TELEGRAM_TEXT ? text : text.slice(0, MAX_TELEGRAM_TEXT - TRUNCATED_MARK.length) + TRUNCATED_MARK
}

/** Пул против последних снимков всех площадок, у которых снимок есть. */
async function currentDrifts(db: Db): Promise<ChannelDrift[]> {
  const channels = await loadChannels(db)
  const snaps = await latestStockSnapshots(db)
  const { items } = await loadPoolState(db)
  const pool = new Map(items.map((i) => [i.barcode, i.base]))
  const out: ChannelDrift[] = []
  for (const c of CHANNELS) {
    const ch = channels.get(c)
    const snap = ch ? snaps.get(ch.id) : undefined
    if (!ch || !snap) continue
    out.push(channelDrift(c, snap.takenAt, pool, snap.stocks, await barcodesAppliedSince(db, ch.id, snap.takenAt)))
  }
  return out
}

/** Готовность к шагу B: снимок WB последнего тика совпадает с пулом по всем штрихкодам. null — снимка WB нет. */
export async function wbDriftNow(db: Db): Promise<ChannelDrift | null> {
  return (await currentDrifts(db)).find((d) => d.channel === "wb") ?? null
}

/** Сводка drift: print — в терминал, иначе в Telegram (не доставлено — ошибка, как у compare-v1). */
export async function runDrift(deps: { db: Db; notifier: Notifier; now: () => Date; print: boolean }): Promise<Record<string, number>> {
  const { db } = deps
  const now = deps.now()
  const since = new Date(now.getTime() - COMPARE_WINDOW_MS).toISOString()
  const [drifts, stats, lastPoolRecalcAt, failedRuns, stuckRuns] = await Promise.all([
    currentDrifts(db),
    writeStatsSince(db, since),
    lastRunWithCounterAt(db, "pool", "events"),
    countFailedRunsSince(db, since),
    countStuckRunsSince(db, since, new Date(now.getTime() - STUCK_RUN_MS).toISOString()),
  ])
  const text = formatDrift(drifts, stats, { now, lastPoolRecalcAt, failedRuns, stuckRuns })
  if (deps.print) console.log(text)
  else if (!(await deps.notifier.send(text))) throw new Error("сводка drift не доставлена в Telegram (бот не настроен или Telegram отказал)")
  const counters: Record<string, number> = { repeated: CHANNELS.reduce((n, c) => n + stats[c].repeated.length, 0) }
  for (const d of drifts) counters[`${d.channel}Drift`] = d.mismatches.length
  return counters
}
```
(`REPEATED_WRITES_MIN` и `WriteStats` экспортирует `journal.ts` через `index.ts`.)

- [ ] **Step 5: Напоминание при тике раз в 5 минут.** `apps/worker/src/transition.ts`: `REMIND_EVERY_RUNS = 72`, комментарий «≈6 ч при тике раз в 5 минут (этап 1.4)»; в `transition.test.ts` ожидание `toBe(36)` → `toBe(72)`.

- [ ] **Step 6: CLI.** В `cli.ts` импорт `import { runDrift, wbDriftNow } from "./jobs/drift"`, `pruneJournal` из `@sync2/db`; ветки перед `default`:
```ts
      case "drift": {
        const print = flags.includes(PRINT_FLAG)
        const outcome = await withRun("drift", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async () => ({
          counters: await runDrift({ db, notifier, now: () => new Date(), print }),
        }))
        return outcome.status === "failed" ? 1 : 0
      }
      case "check-wb": {
        // Шаг B этапа 1.4: переключать WB можно, только когда снимок WB последнего тика = пул.
        const d = await wbDriftNow(db)
        if (!d) {
          console.error("снимка WB нет — сначала tick")
          return 3
        }
        console.log(`WB: снимок ${d.takenAt}, сравнено ${d.compared}, расходится ${d.mismatches.length}`)
        for (const m of d.mismatches.slice(0, 20)) console.log(`${m.barcode}\tпул ${m.pool}\tWB ${m.actual}`)
        return d.mismatches.length === 0 ? 0 : 3
      }
      case "prune": {
        const outcome = await withRun("prune", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async () => ({
          counters: { ...(await pruneJournal(db, new Date().toISOString())) },
        }))
        return outcome.status === "failed" ? 1 : 0
      }
```
`USAGE`:
```
  drift [--print]        пул ↔ последние снимки площадок, записи за сутки (Telegram; --print — в терминал)
  check-wb               снимок WB последнего тика = пул? код 0 — да, 3 — нет (шаг B этапа 1.4)
  prune                  ретенция: writes off/dry-run > 14 дн, apply > 90 дн; снимки > 7 дн (кроме последнего)
```

- [ ] **Step 7: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add packages/db/src/journal.ts packages/db/src/journal.db.test.ts apps/worker/src/jobs/drift.ts apps/worker/src/jobs/drift.test.ts apps/worker/src/jobs/compare-v1.ts apps/worker/src/transition.ts apps/worker/src/transition.test.ts apps/worker/src/cli.ts
git commit -m "sync2: сводка «пул ↔ площадки», проверка WB перед переключением, ретенция журнала и снимков"
```

---

### Task 13: Крон, `.env`, README — этап 1.4

**Files:** Modify `sync2/deploy/crontab.sync2.txt`, `sync2/deploy/README.md`, `sync2/README.md`

- [ ] **Step 1: `deploy/crontab.sync2.txt`** целиком:
```
# >>> sync2 (этап 1.4) — блок целиком заменяется при выкладке (deploy/README.md, «Этап 1.4»)
# tick каждые 5 минут в минуты 1,6,…,56 — мимо старого синка (orders 3,8,…,58; stocks :00/:30; reconcile 08:45).
# timeout 9m: зависший прогон не держит flock вечно; тик при занятой блокировке пропускается (flock -n) — это штатно.
1-59/5 * * * * cd /opt/sync2 && flock -n /tmp/sync2.lock timeout 9m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts tick >> logs/tick.log 2>&1
# сверка со старым синком — 09:05 МСК; снимается на шаге B (старый синк больше не пишет, леджер стоит)
5 6 * * * cd /opt/sync2 && timeout 5m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts compare-v1 >> logs/compare.log 2>&1
# пул ↔ площадки и записи за сутки — 09:10 МСК
10 6 * * * cd /opt/sync2 && timeout 5m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts drift >> logs/drift.log 2>&1
# ретенция журнала writes и снимков — 06:17 МСК, под блокировкой тика
17 3 * * * cd /opt/sync2 && flock -w 120 /tmp/sync2.lock timeout 5m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts prune >> logs/prune.log 2>&1
# <<< sync2
```

- [ ] **Step 2: `deploy/README.md`** — раздел «Этап 1.4» после «Каталог WB отклонён»: (1) замена блока крона — команда из Task 15 Step 7; (2) `.env`: `WB_WAREHOUSE_ID=1408913`, `OZON_WAREHOUSE_ID=1020005023618600`, на шаге A — `SYNC_WRITE_MODE=apply`; (3) шаг A и шаг B — команды из Task 16 и Task 18 этого плана (дословно, с путём к плану); (4) раздел «Откат этапа 1.4» — команды из раздела «Откат» этого плана дословно. Прежний раздел «Откат» (снятие крона `sync2`) дополнить строкой: «после шага B снятие крона `sync2` без отката 1.4 оставляет площадки без писателя — сначала «Откат этапа 1.4»».

- [ ] **Step 3: `sync2/README.md`** — раздел после «Сайт — служебный API (этап 1.3c)»:
```md
## Запись на площадки (этап 1.4)

- Писатели остатка — `packages/platforms/src/<площадка>/stock-writer.ts`, собраны в `apps/worker/src/senders.ts`
  (`buildSender`). Всё — абсолютными значениями: повтор запроса после обрыва безопасен. Ключ площадки —
  `WriteOp.externalSku`: WB — chrtId размера (`products.wb_chrt_id` из карточек WB), Ozon — offer_id,
  ЯМ — offerId, KIT — id варианта; сайт — штрихкод. Итог по позиции: применено / отказ / итог неизвестен (`uncertain`).
- WB: склад `WB_WAREHOUSE_ID`; отправитель перечитывает остаток перед записью (продажа после снимка — не пишем)
  и проверяет чтением после (WB отвечает 204 и на неверные имена полей). Ozon — `OZON_WAREHOUSE_ID`.
  ЯМ — первый из `YM_WAREHOUSE_IDS`; офферы без записи остатка попадают в снимок нулём. KIT — атомарный
  `bulk_update`: битые пары — отказ, остальные — повтор без них.
- `pool`: план — отдельно на каждую площадку (120 баркодов / 20 в ноль), WB первым. Режим WB `self` — когда у WB
  действующий `apply`: шлюз, settle 2 минуты, фиксация пула до сети с итогом «неизвестно», затем по фактическим
  итогам (`applyWbWriteOutcomes`). Блокировки прогона (журнал `dry-run`, `partial`): не прочитаны заказы
  Ozon/ЯМ/KIT/сайта или отклонён каталог WB — все площадки; витрина сайта не на пуле — сайт; второй склад WB — WB.
- Команды: `plan [<площадка>]`, `write-mode <площадка> apply --confirm` (печатает план последнего тика; отказ, если
  pool старше 15 минут, упал или план отклонён предохранителем), `site-push-all --confirm` (весь пул на сайт),
  `check-wb`, `drift [--print]`, `prune`.
- Крон: `tick` раз в 5 минут (`1-59/5`), `compare-v1` — до шага B, `drift` 06:10 UTC, `prune` 03:17 UTC.
- Переключение и откат — `deploy/README.md`, «Этап 1.4»; план — `docs/superpowers/plans/2026-09-28-sync2-stage-1-4-pereklyuchenie.md`.
```

- [ ] **Step 4: Коммит.**
```bash
git add deploy/crontab.sync2.txt deploy/README.md README.md
git commit -m "sync2: крон раз в 5 минут, drift и prune; README и порядок переключения этапа 1.4"
```

---

### Task 14: Сайт — ветка `feat/stock-source-pool`

**Репозиторий:** `/Users/minas/projects/kotelnikovartifact`, ветка `feat/stock-source-pool`.

**Files:**
- Create: `scripts/check-stock-source.sh`, `tests/unit/scripts/check-stock-source.test.ts`
- Modify: `scripts/deploy.sh`, `lib/stock-source.ts`, `app/api/internal/stocks/route.ts`, `lib/wb/sync/stocks.ts`, `workers/jobs.ts`, `package.json`, `tests/unit/lib/stock-source.test.ts`, `tests/unit/internal-stocks-route.test.ts`, `tests/unit/lib/wb/sync/stocks.test.ts`, `tests/unit/workers-jobs.test.ts`

- [ ] **Step 1: Падающий тест проверки выкладки** `tests/unit/scripts/check-stock-source.test.ts`:
```ts
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

const script = path.resolve(process.cwd(), "scripts/check-stock-source.sh")

function check(envText: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "stock-source-"))
  const file = path.join(dir, ".env")
  writeFileSync(file, envText)
  return spawnSync("bash", [script, file], { encoding: "utf8" })
}

describe("scripts/check-stock-source.sh — STOCK_SOURCE до сборки", () => {
  it("wb, pool и пусто — выкладка продолжается", () => {
    for (const text of ["STOCK_SOURCE=wb\n", "STOCK_SOURCE=pool\n", "OTHER=1\n"]) {
      expect(check(text).status).toBe(0)
    }
  })

  it("опечатка — код 1 и значение в тексте: витрина с ней не открылась бы", () => {
    const r = check("STOCK_SOURCE=pol\n")
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('STOCK_SOURCE="pol"')
  })

  it("кавычки и CRLF не мешают; действует последнее значение, как у dotenv", () => {
    expect(check('STOCK_SOURCE="pool"\r\n').status).toBe(0)
    expect(check("STOCK_SOURCE=pol\nSTOCK_SOURCE=pool\n").status).toBe(0)
  })
})
```
Run: `npx vitest run tests/unit/scripts/check-stock-source.test.ts` → FAIL.

- [ ] **Step 2: Проверка и вызов в выкладке.** `scripts/check-stock-source.sh`:
```bash
#!/usr/bin/env bash
# Проверка STOCK_SOURCE в .env до сборки (синк v2, этап 1.4). Опечатка в переключателе
# роняет чтение остатка на каждой странице витрины (lib/env.ts, getStockSource) — ловим
# её до `npm run build` и `pm2 reload`: прод остаётся на прежней версии.
# Использование: bash scripts/check-stock-source.sh [путь к .env]
set -euo pipefail
env_file="${1:-.env}"
value=$(grep -E '^STOCK_SOURCE=' "$env_file" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d "\"' \r" || true)
case "$value" in
  "" | wb | pool)
    echo "==> STOCK_SOURCE=${value:-wb (по умолчанию)}"
    ;;
  *)
    echo "==> STOCK_SOURCE=\"$value\" в $env_file — ожидается wb | pool. Выкладка остановлена." >&2
    exit 1
    ;;
esac
```
В `scripts/deploy.sh` после блока проверки `content/legal` (перед `echo "==> Installing dependencies …"`):
```bash
# Источник остатка витрины (синк v2, этап 1.4): опечатка в STOCK_SOURCE роняет
# чтение остатка на каждой странице. Проверка — до сборки и перезапуска.
bash scripts/check-stock-source.sh .env
```
Run → 3 passed.

- [ ] **Step 3: Падающие тесты пересчёта в транзакции.** В `tests/unit/lib/stock-source.test.ts`: в `vi.hoisted` добавить `txExecuteMock: vi.fn(async (_q: unknown) => [] as unknown[])`, в объект `tx` мока `@/lib/db/client` — `execute: txExecuteMock`, в `beforeEach` — `txExecuteMock.mockClear()`; в `describe("запись пула"`:
```ts
  it("recalc — агрегат затронутых товаров пересчитывается в той же транзакции, что и запись", async () => {
    knownRows.current = [
      { barcode: "A", productId: 1 },
      { barcode: "C", productId: 2 },
    ]
    await upsertPoolStocks(
      [
        { barcode: "A", quantity: 2 },
        { barcode: "C", quantity: 0 },
      ],
      { recalc: true }
    )
    expect(transactionMock).toHaveBeenCalledOnce()
    expect(txExecuteMock).toHaveBeenCalledOnce()
    const q = dialect.sqlToQuery(txExecuteMock.mock.calls[0]![0] as SQL)
    expect(flat(q.sql)).toContain("update wb_products p set stocks = t.total")
    expect(q.params).toEqual([1, 2])
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("без recalc или без известных штрихкодов — пересчёта нет", async () => {
    knownRows.current = [{ barcode: "A", productId: 1 }]
    await upsertPoolStocks([{ barcode: "A", quantity: 2 }])
    await upsertPoolStocks([{ barcode: "X", quantity: 1 }], { recalc: true })
    expect(txExecuteMock).not.toHaveBeenCalled()
  })
```
В `tests/unit/internal-stocks-route.test.ts`:
  - «wb — только запись в pool_stocks…»: `expect(upsertMock).toHaveBeenCalledWith(items, { recalc: false })`;
  - «pool — пересчёт затронутых товаров и ревалидация каталога» заменить на:
```ts
  it("pool — пересчёт внутри записи (одна транзакция) и ревалидация каталога", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    upsertMock.mockResolvedValue({ updated: 1, unknown: [], productIds: [7] })
    const res = await put({ items: [{ barcode: "A", quantity: 0 }] })
    expect(res.status).toBe(200)
    expect(upsertMock).toHaveBeenCalledWith([{ barcode: "A", quantity: 0 }], { recalc: true })
    expect(recalcMock).not.toHaveBeenCalled()
    expect(revalidateMock).toHaveBeenCalledWith("/catalog")
  })
```
  - «ошибка записи — 500 db_error; ошибка пересчёта — 500 recalc_failed» заменить на:
```ts
  it("ошибка записи или пересчёта (одна транзакция, откат) — 500 db_error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.stubEnv("STOCK_SOURCE", "pool")
    upsertMock.mockRejectedValue(new Error("recalc timeout"))
    const res = await put({ items: [{ barcode: "A", quantity: 1 }] })
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "db_error" })
    expect(revalidateMock).not.toHaveBeenCalled()
  })
```
Run: `npx vitest run tests/unit/lib/stock-source.test.ts tests/unit/internal-stocks-route.test.ts` → FAIL.

- [ ] **Step 4: Реализация.** `lib/stock-source.ts`, `upsertPoolStocks`:
  - сигнатура: `export async function upsertPoolStocks(items: PoolStockInput[], opts: { recalc?: boolean } = {}): Promise<PoolStockUpsertResult>`;
  - в JSDoc дописать: «`recalc` (STOCK_SOURCE=pool) — пересчёт агрегата затронутых товаров в той же транзакции: витрина не видит пул без агрегата, а сбой пересчёта откатывает и запись (sync2 повторит PUT — значения абсолютные)»;
  - перед `return { updated: toWrite.length, unknown, productIds }` внутри транзакции:
```ts
    if (opts.recalc && productIds.length > 0) {
      await tx.execute(recalcFromPoolSql(productIds))
    }
```
  `app/api/internal/stocks/route.ts`: импорт `recalcProductStocksFromPool` убрать; `result = await upsertPoolStocks(items)` → `result = await upsertPoolStocks(items, { recalc: source === "pool" })`; блок после записи заменить на:
```ts
  if (source === "pool" && result.productIds.length > 0) {
    await revalidate("/catalog")
  }
```
  (ветка `recalc_failed` удаляется; JSDoc `PUT`: «в STOCK_SOURCE=pool агрегат пересчитывается в той же транзакции, что и запись пула»).
Run → зелёные.

- [ ] **Step 5: Падающие тесты самоисцеления и разовой команды.** В `tests/unit/lib/wb/sync/stocks.test.ts` до импорта `syncStocks`:
```ts
const { recalcAllMock } = vi.hoisted(() => ({ recalcAllMock: vi.fn(async (_ids: unknown) => 3) }))
vi.mock("@/lib/stock-source", () => ({ recalcProductStocksFromPool: recalcAllMock }))
```
в `beforeEach` — `recalcAllMock.mockClear()`; в конец `describe("syncStocks"`:
```ts
  it("STOCK_SOURCE=pool: в конце цикла — полный пересчёт агрегата из пула (самоисцеление)", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    selectMock.mockImplementationOnce(() => chainRows([]))
    await syncStocks({ writeMode: "live" })
    expect(recalcAllMock).toHaveBeenCalledWith("all")
  })

  it("STOCK_SOURCE=wb или dry-run — пересчёта из пула нет", async () => {
    selectMock.mockImplementationOnce(() => chainRows([]))
    await syncStocks({ writeMode: "live" })
    vi.stubEnv("STOCK_SOURCE", "pool")
    selectMock.mockImplementationOnce(() => chainRows([]))
    await syncStocks({ writeMode: "dry-run" })
    expect(recalcAllMock).not.toHaveBeenCalled()
  })
```
В `tests/unit/workers-jobs.test.ts` к `vi.hoisted` добавить `recalcPoolMock: vi.fn(async (_ids: unknown) => 5)` и
```ts
vi.mock("@/lib/stock-source", () => ({ recalcProductStocksFromPool: recalcPoolMock }))
```
и тесты:
```ts
  it("recalc-pool-stocks при STOCK_SOURCE=pool — полный пересчёт агрегата из пула", async () => {
    vi.stubEnv("STOCK_SOURCE", "pool")
    await runJob("recalc-pool-stocks")
    expect(recalcPoolMock).toHaveBeenCalledWith("all")
    vi.unstubAllEnvs()
  })

  it("recalc-pool-stocks при STOCK_SOURCE=wb — отказ: в wb агрегат пишет синк WB", async () => {
    vi.stubEnv("STOCK_SOURCE", "wb")
    await expect(runJob("recalc-pool-stocks")).rejects.toThrow(/STOCK_SOURCE не pool/)
    expect(recalcPoolMock).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })
```
Run → FAIL.

- [ ] **Step 6: Реализация.** `lib/wb/sync/stocks.ts`: импорт `import { recalcProductStocksFromPool } from "@/lib/stock-source"`; перед блоком `try { await revalidate("/catalog") }` в конце `syncStocks`:
```ts
  // STOCK_SOURCE=pool (синк v2, этап 1.4): агрегат товара пишет только пул.
  // Раз в цикл синка остатков — полный пересчёт из pool_stocks: товар, чьи
  // размеры или штрихкоды поменялись между PUT sync2, получает верный агрегат
  // («самоисцеление»). В wb агрегат пишет recalcProductVisibility выше.
  if (opts.writeMode !== "dry-run" && getStockSource() === "pool") {
    try {
      const changed = await recalcProductStocksFromPool("all")
      logger.info(
        { event: "sync.stocks.pool_recalc", changed },
        "Aggregates recalculated from pool"
      )
    } catch (err) {
      stats.errors++
      logger.error(
        { event: "sync.stocks.pool_recalc_error", err: String(err) },
        "Pool recalc failed"
      )
    }
  }
```
`workers/jobs.ts`: в `JOB_NAMES` добавить `"recalc-pool-stocks"`; в `runJob` перед `if (running.size > 0)`:
```ts
  // recalc-pool-stocks — разовый полный пересчёт агрегата товара из pool_stocks
  // (синк v2, этап 1.4: сразу после переключения витрины на пул). Только при
  // STOCK_SOURCE=pool: в wb агрегат пишет синк WB, и второй писатель перетёр
  // бы его. Вне WB-мьютекса: один быстрый UPDATE.
  if (name === "recalc-pool-stocks") {
    const { getStockSource } = await import("@/lib/env")
    if (getStockSource() !== "pool") {
      const err = new Error(
        "recalc-pool-stocks: STOCK_SOURCE не pool — в wb агрегат пишет синк WB"
      )
      logger.error(
        { event: "job.failed", name, err: err.message },
        "Job failed"
      )
      throw err
    }
    const { recalcProductStocksFromPool } = await import("@/lib/stock-source")
    const changed = await recalcProductStocksFromPool("all")
    logger.info({ event: "job.done", name, changed }, "Job finished")
    return
  }
```
`package.json`, в `scripts` после `wb:sync:translations`: `"stock:recalc-pool": "tsx workers/run-one.ts recalc-pool-stocks",`.

- [ ] **Step 7: Страницы товара — проверка по документации Next** (требование `AGENTS.md`): прочитать `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` — вызов `cookies()` переводит маршрут в динамический рендеринг. `getCurrentCurrency()` (`lib/currency/cookie.ts`) вызывается в `app/[locale]/catalog/[slug]/page.tsx` и `app/[locale]/catalog/page.tsx`, кэша данных (`unstable_cache`, `"use cache"`) в проекте нет (grep 28.09) — отдельная ревалидация страниц товара не нужна. Подтверждение — таблица маршрутов сборки в Task 15 (Step 3). Документация говорит иное — остановиться и описать до PR.

- [ ] **Step 8: Проверки и коммит.**
```bash
npx prettier --write lib/stock-source.ts app/api/internal/stocks/route.ts lib/wb/sync/stocks.ts workers/jobs.ts tests/unit/scripts/check-stock-source.test.ts tests/unit/lib/stock-source.test.ts tests/unit/internal-stocks-route.test.ts tests/unit/lib/wb/sync/stocks.test.ts tests/unit/workers-jobs.test.ts
npm run lint && npm run typecheck && npm test
git add scripts/check-stock-source.sh scripts/deploy.sh lib/stock-source.ts app/api/internal/stocks/route.ts lib/wb/sync/stocks.ts workers/jobs.ts package.json tests/unit/scripts/check-stock-source.test.ts tests/unit/lib/stock-source.test.ts tests/unit/internal-stocks-route.test.ts tests/unit/lib/wb/sync/stocks.test.ts tests/unit/workers-jobs.test.ts
git commit -m "feat(stock-source): проверка STOCK_SOURCE в выкладке, пересчёт агрегата в транзакции записи пула, самоисцеление и разовый пересчёт"
```
Ветка не пушится до Task 15.

---

### Task 15: Выкладка кода и тик раз в 5 минут — режимы площадок не меняются

Перед каждым шагом с пометкой **[«да»]** — показать владельцу команду и что она изменит, дождаться явного «да». Токены не печатаются. Не выполнять в минуты кронов (`sync2` `1,6,…,56`; старый синк `3,8,…,58`, `:00/:30`).

- [ ] **Step 1 [«да»]: слияние ветки `sync2`** (после ревью `superpowers:requesting-code-review`):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git merge --no-ff sync2-stage-1-4 -m "sync2: этап 1.4 — запись на площадки"
cd sync2 && npm run typecheck && npm test && npm run test:db
```

- [ ] **Step 2 [«да»]: PR сайта** (после ревью):
```bash
cd /Users/minas/projects/kotelnikovartifact
git push -u origin feat/stock-source-pool
gh pr create --repo webkoth/kotelnikovartifact-store --base main --head feat/stock-source-pool \
  --title "Витрина на пуле синка v2: проверка STOCK_SOURCE, пересчёт в транзакции (этап 1.4)" \
  --body "scripts/check-stock-source.sh в выкладке; PUT /api/internal/stocks пересчитывает агрегат в той же транзакции; syncStocks в pool — полный пересчёт из пула; npm run stock:recalc-pool. На проде остаётся STOCK_SOURCE=wb — витрина не меняется. План: sai_kotelnikovartifact/docs/superpowers/plans/2026-09-28-sync2-stage-1-4-pereklyuchenie.md"
gh pr checks --watch --repo webkoth/kotelnikovartifact-store
```
Expected: checks зелёные.

- [ ] **Step 3 [СТОП — «да» владельца на merge]: слияние = выкладка сайта.**
```bash
gh pr merge --merge --repo webkoth/kotelnikovartifact-store feat/stock-source-pool
gh run watch --repo webkoth/kotelnikovartifact-store $(gh run list --repo webkoth/kotelnikovartifact-store --branch main --limit 1 --json databaseId -q '.[0].databaseId')
gh run view --repo webkoth/kotelnikovartifact-store --log $(gh run list --repo webkoth/kotelnikovartifact-store --branch main --limit 1 --json databaseId -q '.[0].databaseId') | grep -E "STOCK_SOURCE=|catalog/\[slug\]|Deploy complete"
```
Expected: `==> STOCK_SOURCE=wb`, в таблице маршрутов `ƒ /[locale]/catalog/[slug]` (динамический — Task 14 Step 7), `Deploy complete`. `curl -s -o /dev/null -w "%{http_code}\n" https://kotelnikovartifact.ru/catalog` → `200`.
Откат: revert-PR с «да» владельца (витрина на `wb`, изменения безвредны).

- [ ] **Step 4 [«да»]: склады записи в `.env` VPS** (запись всё ещё невозможна — площадки в `dry-run`/`off`):
```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
cp .env logs/.env.bak-1-4
grep -q '^WB_WAREHOUSE_ID=' .env || echo 'WB_WAREHOUSE_ID=1408913' >> .env
grep -q '^OZON_WAREHOUSE_ID=' .env || echo 'OZON_WAREHOUSE_ID=1020005023618600' >> .env
grep -E '^(WB_WAREHOUSE_ID|OZON_WAREHOUSE_ID|SYNC_WRITE_MODE)=' .env
REMOTE
```
Expected: `SYNC_WRITE_MODE=dry-run`, `WB_WAREHOUSE_ID=1408913`, `OZON_WAREHOUSE_ID=1020005023618600`.

- [ ] **Step 5 [«да»]: выкладка кода `sync2`** (миграция 0003):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact/sync2 && npm run deploy
```

- [ ] **Step 6: ручной тик и проверка chrtId** (под блокировкой крона):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock /tmp/sync2.lock $T tick; $T runs 2; set -a; . ./.env; set +a; psql "$DATABASE_URL" -X -A -c "select count(*) filter (where wb_chrt_id is not null) as with_chrt, count(*) from products"'
```
Expected: `ingest ok`, `pool ok` с `wbSelf: 0`; `with_chrt` = `count` (421/421). Меньше — разобрать до шага B (запись WB этих штрихкодов получит отказ «нет ключа»).

- [ ] **Step 7 [«да»]: крон `sync2` раз в 5 минут, `drift`, `prune`; WB — в `dry-run`** (план WB в журнале для предпросмотра шага B):
```bash
scp /Users/minas/projects/sai_kotelnikovartifact/sync2/deploy/crontab.sync2.txt root@147.45.171.40:/opt/sync2/deploy/crontab.sync2.txt
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
crontab -l > /opt/sync2/logs/crontab.before-1-4.txt
crontab -l | grep -v -e '/opt/sync2' -e '^# sync2 (этап 1.3b' -e '^# timeout 9m: зависший' -e '^# сверка со старым синком — раз в сутки' > /tmp/cron.1-4
cat /opt/sync2/deploy/crontab.sync2.txt >> /tmp/cron.1-4
crontab /tmp/cron.1-4 && rm /tmp/cron.1-4
crontab -l | grep -n -e 'sync2' -e 'orchestrator.js'
cd /opt/sync2 && flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts write-mode wb dry-run
REMOTE
```
Expected: строки старого синка (`orders`, `stocks`, `reconcile`, `finance`) на месте; блок `# >>> sync2 (этап 1.4)` … `# <<< sync2` — tick `1-59/5`, compare-v1, drift, prune; `write-mode` печатает `wb dry-run`, `ozon/ym/kit dry-run`, `site off`.
Откат: `ssh root@147.45.171.40 'crontab /opt/sync2/logs/crontab.before-1-4.txt'`.

- [ ] **Step 8: полчаса наблюдения** (6 тиков):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T runs 14; $T plan; free -m; grep -c "429" logs/tick.log; du -sh /var/lib/postgresql 2>/dev/null | tail -1'
```
Expected: тики в минуты `…1`/`…6`, `failed` нет; `pool` — `wbPlanned` (план WB в журнале, `dry-run`), `ozonPlanned`/`ymPlanned` = 3 (многоразмерные), `kitPlanned` 0; `plan` — строки `dry-run`; память `available` > 150 МБ. `drift --print` — числа по площадкам. Итог — в «Ход выполнения» этого плана.

---

### Task 16: Шаг A — сайт

- [ ] **Step 1 [«да»]: глобальный режим `apply`** (площадки WB/Ozon/ЯМ/KIT остаются в `dry-run`, сайт — `off`: запись всё ещё не идёт):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && cp .env logs/.env.bak-1-4A && sed -i "s/^SYNC_WRITE_MODE=.*/SYNC_WRITE_MODE=apply/" .env && grep ^SYNC_WRITE_MODE= .env'
```
Expected: `SYNC_WRITE_MODE=apply`. Следующий тик: `runs 2` — в `pool` нет ни одного `*Applied`. Откат: `sed -i "s/^SYNC_WRITE_MODE=.*/SYNC_WRITE_MODE=dry-run/"`.

- [ ] **Step 2 [«да»]: полный PUT пула на сайт** (витрина ещё на `wb` — пишется только `pool_stocks`):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock /tmp/sync2.lock sh -c "$T tick && $T site-push-all --confirm"'
```
Expected: `ok {"sent":N,"applied":M,"siteUnknown":K,"failed":0}` — `N` = число позиций пула (421), `K` — штрихкоды WB, которых нет на сайте (единицы). На сервере сайта (только чтение):
```bash
ssh root@201.34.133.76 'cd /var/www/kotelnika-store && set -a && . ./.env && set +a && psql "$DATABASE_URL" -X -A -F " | " -c "select count(*) as pool_rows, sum(quantity) as pool_units from pool_stocks"'
```
Expected: `pool_rows` = `M`, `pool_units` = сумма базы пула по этим штрихкодам (`select sum(base) from pool_items` в `sync2` минус неизвестные сайту).

- [ ] **Step 3 [«да», сервер сайта]: витрина на пул.**
```bash
ssh root@201.34.133.76 'bash -s' <<'REMOTE'
set -euo pipefail
cd /var/www/kotelnika-store
cp .env /root/kotelnika-env.bak-1-4A
sed -i 's/^STOCK_SOURCE=.*/STOCK_SOURCE=pool/' .env
bash scripts/check-stock-source.sh .env
pm2 reload ecosystem.config.cjs --update-env
npm run stock:recalc-pool
set -a && . ./.env && set +a
psql "$DATABASE_URL" -X -A -F " | " \
  -c "select count(*) as agg_mismatch from wb_products p where p.stocks <> coalesce((select sum(ps.quantity) from wb_product_sizes s join wb_product_skus sk on sk.size_id = s.id join pool_stocks ps on ps.barcode = sk.sku where s.product_id = p.id), 0)" \
  -c "select count(*) filter (where is_visible) as visible, count(*) as products from wb_products"
REMOTE
curl -s -o /dev/null -w "%{http_code} /catalog\n" https://kotelnikovartifact.ru/catalog
```
Expected: `==> STOCK_SOURCE=pool`; `pm2` — `kotelnika-web`, `kotelnika-scheduler` перезапущены; в логе команды `"event":"job.done","name":"recalc-pool-stocks","changed":…`; `agg_mismatch = 0`; `200 /catalog`. Витрина глазами: товар с остатком в пуле виден, с нулём — скрыт; карточка браслета с размерами показывает остатки размеров.
Откат шага A — раздел «Откат», вариант A.

- [ ] **Step 4: тик и план сайта** — снимок сайта теперь из пула:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock /tmp/sync2.lock $T tick; $T runs 2; $T plan site'
```
Expected: `ingest` — `siteSourcePool: 1`; `pool` — `sitePlanned` 0 или единицы (заказы между Step 2 и сейчас); `plan site` — эти строки.

- [ ] **Step 5 [«да»]: запись сайта в `apply` и первый боевой тик.**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock /tmp/sync2.lock sh -c "$T write-mode site apply --confirm && $T tick"; $T runs 2; $T plan site'
```
Expected: `write-mode` печатает план сайта и таблицу режимов (`site apply`); `pool ok` — `siteApplied` = строки плана, `siteWriteBlocked` нет; `plan site` — «применено».

---

### Task 17: Приёмка шага A — сутки

- [ ] Через 12 и 24 часа:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T drift --print; $T runs 30 | cut -f2,3,5 | sort | uniq -c | sort -rn | head'
```
  - `сайт: расходится 0` (или только «в пути»); записи сайта за сутки — без ошибок; повторных записей сайта нет;
  - в `runs` — нет `failed`; `partial` — только с объяснимыми причинами (сбой площадки);
  - заказ сайта (если был): в `pool_events` — `order` с площадкой `site`, в следующем тике — запись сайта с новым остатком; владелец по-прежнему снимает единицу на WB руками (WB до шага B пишет старый синк);
  - `compare-v1` утром: расхождений 0 (или объяснены заказом ≤ 30 мин).
- [ ] Итог — таблица «час → расхождений сайта → объяснено» в «Ход выполнения» этого плана. Решение о шаге B принимает владелец (открытые вопросы 1–3 — до шага B).

---

### Task 18: Шаг B — WB, Ozon, ЯМ, KIT разом

- [ ] **Step 1: условия (только чтение, утром после `compare-v1`):**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; tail -20 logs/compare.log; $T plan ozon; $T plan ym; $T plan kit; $T plan wb; $T drift --print'
```
Expected: `compare-v1` — «расходится 0»; `plan ozon`/`plan ym` — только 6 строк многоразмерных (Факты) или пусто; `plan kit` — пусто; `plan wb` — пусто или единицы с заказом ≤ 20 мин (WB в `external`, старый синк ещё пишет). Любое другое — разбор до шага B. Показать владельцу этот вывод — это и есть предпросмотр первого боевого прогона шага B.

- [ ] **Step 2 [«да» — одно на весь скрипт]: окно переключения.** Запускать сразу после тика `sync2` (минута `…1`/`…6` + 1 мин):
```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"
exec 9>/tmp/sync2.lock
flock -w 600 9                                   # тики sync2 стоят до конца скрипта
crontab -l > /opt/sync2/logs/crontab.before-1-4B.txt
# Не дошли до переключения — крон старого синка возвращается сам.
trap 'crontab /opt/sync2/logs/crontab.before-1-4B.txt; echo "СТОП: крон старого синка возвращён, sync2 в dry-run"' ERR
crontab -l | sed -E 's@^([^#].*orchestrator\.js (orders|stocks) --apply.*)$@#OFF-1.4 \1@' | crontab -
crontab -l | grep -n 'orchestrator.js'
# Последний прогон заказов старого синка: заказы, которые он увидел, но ещё не записал на WB, — на WB.
flock -w 120 /tmp/sai-ledger.lock /usr/bin/node /opt/sellerai-sync/sync/dist/orchestrator.js orders --apply 2>&1 | tail -3
$T tick
$T check-wb                                      # код ≠ 0 — стоп: снимок WB расходится с пулом
for c in wb ozon ym kit; do $T write-mode "$c" apply --confirm; done
trap - ERR
$T tick                                          # первый боевой тик: WB в режиме self
$T runs 2
$T plan
REMOTE
```
Expected:
  - `grep orchestrator.js` — `#OFF-1.4 3-58/5 … orders --apply`, `#OFF-1.4 */30 … stocks --apply`; `reconcile` и `finance` без изменений;
  - `check-wb` — `расходится 0`, код 0;
  - `write-mode` ×4 — план каждой площадки и таблица режимов (`wb/ozon/ym/kit apply`, `site apply`);
  - последний тик: `pool` — `wbSelf: 1`, `ozonApplied`/`ymApplied` = 3 (многоразмерные, решение п. 18), `wbPlanned` 0 или заказы последних минут, без `writeErrors`; `plan` — «применено».
  - `check-wb` вернул не 0 → скрипт остановился, крон старого синка возвращён (`trap`), `sync2` в `dry-run`: разобрать расхождения (`check-wb` печатает их) и повторить Step 2 в следующем окне.

- [ ] **Step 3 [«да»]: снять `compare-v1` с крона** (леджер старого синка больше не обновляется):
```bash
ssh root@147.45.171.40 'crontab -l | grep -v -e "cli.ts compare-v1" -e "^# сверка со старым синком — 09:05 МСК" | crontab - && crontab -l | grep -n sync2'
```
Expected: в блоке `sync2` — tick, drift, prune.

- [ ] **Step 4: владельцу — сообщение** (решение п. 4): «С этой минуты продажи Ozon, ЯМ, KIT и сайта снимает с WB синк. Руками на WB — только физика: поступление, брак, потеря. После заказа на сайте единицу на WB больше не снимать».

---

### Task 19: Приёмка шага B и репетиция отката

- [ ] **Сутки–трое:** утром — сводка `drift` в Telegram; дополнительно через 1, 6 и 24 часа:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T drift --print; $T runs 30 | cut -f2,3,5 | sort | uniq -c | sort -rn | head'
```
  - по всем площадкам «расходится 0» (кроме «в пути»); ошибок записи нет или каждая объяснена (Ozon `TOO_MANY_REQUESTS` — повторена следующим тиком); «повторные записи» — пусто (иначе запись не держится: разбор);
  - первый реальный заказ каждой площадки: `pool_events` — `order`, следующий тик — запись WB (`wbApplied`) и зеркал; заказ WB — сигнал WB в следующем тике, запись зеркал;
  - первый заказ KIT: остаток KIT после записи = пул (вопрос 5 о `reserved`);
  - `wbWriteUnknown` > 0 — разбор каждого: `select * from pool_items where barcode = …` и следующий снимок.
- [ ] **Репетиция отката — только чтение, ничего не меняет:**
```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sellerai-sync
/usr/bin/node sync/scripts/ledger-reseed-from-wb.mjs 2>&1 | head -15          # dry-run: леджер не пишется
diff <(crontab -l) <(crontab -l | sed -E 's@^#OFF-1\.4 @@') || true   # что вернёт откат крона
REMOTE
```
Expected: пересев печатает «Изменится base у N позиций» — N = число штрихкодов, изменившихся с шага B (продажи, поступления), и «заказов Ozon/ЯМ помечено учтёнными»; `diff` — ровно две строки `orders`/`stocks` без префикса `#OFF-1.4`.
- [ ] Итог — таблица «сутки → расхождений по площадкам → записей/ошибок → объяснено» в «Ход выполнения» этого плана и в `sync2/README.md`. Решение о закрытии этапа 1 и удалении `sync/` (спека §11, этап 5) — у владельца.

---

## Откат

Каждый вариант — одно «да» владельца на весь вариант. Команды — также в `sync2/deploy/README.md`, «Откат этапа 1.4».

**Вариант A — откат шага A** (сайт снова на WB; до шага B):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts write-mode site off'
ssh root@201.34.133.76 'bash -s' <<'REMOTE'
set -euo pipefail
cd /var/www/kotelnika-store
sed -i 's/^STOCK_SOURCE=.*/STOCK_SOURCE=wb/' .env
bash scripts/check-stock-source.sh .env
pm2 reload ecosystem.config.cjs --update-env
npm run wb:sync:stocks        # агрегат снова от WB (~5,5 мин)
REMOTE
```

**Вариант B — откат шага B** (WB, Ozon, ЯМ, KIT снова пишет старый синк; сайт остаётся на пуле). Последний тик `sync2` с записью выравнивает WB по всем заказам до этой минуты — пересев от WB тогда не теряет их. Если откат из-за ошибочных записей `sync2` — строку `$T tick` убрать, а заказы последних 10 минут (`select * from pool_events where occurred_at > now() - interval '10 minutes'`) сверить с WB руками.
```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"
exec 9>/tmp/sync2.lock
flock -w 600 9
$T tick                                                   # последний тик с записью
flock -w 120 /tmp/sai-ledger.lock /usr/bin/node /opt/sellerai-sync/sync/scripts/ledger-reseed-from-wb.mjs --apply | tail -3
for c in wb ozon ym kit; do $T write-mode "$c" dry-run; done
flock -w 120 /tmp/sai-ledger.lock /usr/bin/node /opt/sellerai-sync/sync/dist/orchestrator.js stocks --apply | tail -5
crontab -l | sed -E 's@^#OFF-1\.4 @@' | crontab -
grep -q 'cli.ts compare-v1' <(crontab -l) || (crontab -l; echo '5 6 * * * cd /opt/sync2 && timeout 5m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts compare-v1 >> logs/compare.log 2>&1') | crontab -
crontab -l | grep -n -e 'orchestrator.js' -e 'compare-v1'
REMOTE
```
Пересев — без `--no-wb-orders`: иначе заказы KIT не помечаются учтёнными и первый `stocks` вычтет их повторно. WB возвращается в `external` сам (действующий режим WB — `dry-run`). Владельцу: «продажи на сайте снова снимаем с WB руками».

**Вариант «полный»** — вариант B, затем `sed -i "s/^SYNC_WRITE_MODE=.*/SYNC_WRITE_MODE=dry-run/" /opt/sync2/.env`, затем вариант A.

---

## Готово, когда

- `sync2` в `main`, выложен; тик раз в 5 минут, `drift` и `prune` в кроне; все тесты зелёные (`sync2`: `typecheck`, `test`, `test:db`; сайт: `lint`, `typecheck`, `test`).
- Сайт: витрина на `STOCK_SOURCE=pool`, `site apply`, сутки без необъяснённых расхождений.
- Шаг B: строки `orders`/`stocks` старого синка закомментированы (`#OFF-1.4`), `wb/ozon/ym/kit apply`, `wbSelf: 1`; `compare-v1` снят с крона; сводка `drift` приходит; сутки–трое — все площадки «расходится 0» кроме «в пути», повторных записей нет.
- Откат отрепетирован сухим прогоном; команды отката — в `sync2/deploy/README.md`.

## Самопроверка по спеке

| Спека / решение | Где покрыто |
|---|---|
| §5 таблица записи: WB `PUT /api/v3/stocks/{warehouseId}`, Ozon `/v2/products/stocks`, ЯМ `PUT …/offers/stocks`, KIT `bulk_update`, сайт `PUT /api/internal/stocks` | Task 3–5, 7, 8 |
| §5 «ключ товара — баркод и артикул WB, адаптер шлёт то, что площадка различает» | Task 1 (`externalSku`), Task 2 (chrtId WB), Task 10 (ключ по площадке) |
| §5 ограничители 120 / 20 в ноль | Task 10: на площадку за прогон |
| §5 «при сбое чтения заказов — запись остатков не делается, алерт» | Task 8 (счётчик), Task 10 (блок + `partial` → Telegram); исключение — заказы WB (отступление) |
| §5 цель WB = пул, запись на FBS-склад; режимы external/self (план 1.2) | Task 10 (`wbSelf`, шлюз, settle 2, `applyWbWriteOutcomes`), Task 3 (перечитывание) |
| §3 запись только через выключатель `SYNC_WRITE_MODE` × `channels.write_mode`, тест «off/dry-run не ходят в сеть» | `executeWrites` (Task 1 сохраняет), Task 11 (`apply` только с `--confirm`) |
| §3 лимиты по спецификации, без слепых повторов 429 | Task 3–7 (пачки, короткие повторы WB, 429 — отказ без неопределённости), решение 3 |
| §2 п. 5 «заказы раз в 5 минут, полная сверка раз в 30» | Task 13: тик раз в 5 минут делает и то и другое |
| §9 сводка раз в сутки; «всё хорошо» не шлётся | Task 12 (`drift` — сводка), уведомления только о смене состояния (1.3b) |
| §10 `writes` — каждое было → стало с ответом; контрактные тесты | Task 1–10 (итоги по позиции, `response`), тесты писателей по спецификациям и телам старого синка |
| §10 `compare-v1` на время параллельного режима | до шага B; Task 18 Step 3 снимает |
| §11 «переключение Ozon/ЯМ/WB с отключением в v1» | Task 18 (KIT — вместе с ними, отступление) |
| Решение п. 4 «продажи других площадок на WB руками не снимать» | Task 18 Step 4 |
| Решение п. 18 многоразмерные (б) | Task 1 Step 5 (тест), Task 18 Step 1 (6 строк) |
| Заметки 1.2: перечитать WB перед записью в self; advisory lock на цикл записи | Task 3; блокировка — `flock /tmp/sync2.lock` на тик и все ручные команды |
| Заметки 1.2: первый apply — с явным `maxToZero`, `aborted.reason` в лог и алерт | Task 10 (счётчик `<площадка>Aborted_<reason>` и текст), Task 11 (отказ `apply` при отклонённом плане) |
| Заметки 1.3b: `externalSku` в `WriteOp`; ретенция `writes` | Task 1; Task 12 |
| Заметки 1.3c: полный PUT → recalc all → STOCK_SOURCE=pool; `sync-products` и `computeTotalStocks` | Task 16 (порядок с отступлением); `computeTotalStocks` остаётся — нужен режиму `wb` и откату |
| Заметки ревью сайта: STOCK_SOURCE в deploy.sh, пересчёт в транзакции, syncStocks → recalc all, revalidate страниц товара, `client_max_body_size` | Task 14 Step 2, 4, 6, 7; `client_max_body_size 20M` — Факты |
| Заметка 1.3c: «заказ сайта в режиме self уходит на WB через sync2 — проверить на первом реальном заказе» | Task 19 |

## Открытые вопросы (к владельцу — до шага B)

1. **Сбой чтения заказов зеркала блокирует запись всех площадок** (спека §5, так и сделано). В `sync2` заказы хранятся в базе, и пропущенный прогон чтения ничего не «забывает» — блок не защищает, а задерживает списания других площадок; сайт недоступен → стоит весь синк. Снять блок (оставить только уведомление) — да/нет?
2. **`reconcile` старого синка (08:45) после шага B** считает пул от застывшего леджера и будет ежедневно присылать ложные «Ozon/ЯМ: неверный остаток». Закомментировать его вместе с `orders`/`stocks` — да/нет? (Сейчас по постановке — оставлен.)
3. **После шага B WB руками — только физика** (решение п. 4), включая заказы сайта: подтвердить, что владелец и партнёр перестают снимать единицу на WB после продаж на других площадках.
4. **Тестовый заказ на сайте для приёмки A** — да/нет? У заказа сайта один статус `new`; отмена в синке — `returned`, единица сама не вернётся (возврат через WB руками).
5. **KIT и резерв:** запись ставит `quantity`, `reserved` KIT не трогает. Если KIT считает доступным `quantity − reserved`, после заказа KIT до отгрузки на KIT будет на 1 меньше пула. Старый синк работает так же; проверяется на первом заказе KIT (Task 19).
6. **Тело записи ЯМ** оставлено как у старого синка (`warehouseId`, `type: "FIT"`), текущая спецификация их не описывает. Перейти на тело по спецификации — только после живой проверки на одном оффере — нужна ли она до шага B (да/нет)?

## Решения владельца по открытым вопросам (28.09.2026) — обязательны для исполнителей

1. **Сбой чтения заказов зеркала запись НЕ останавливает** — ни на своей площадке, ни на остальных. Только уведомление (переход состояния `ingest` в `partial` уже шлёт его) и счётчик `<площадка>OrdersFailed`; `pool` пишет по последним известным заказам из базы. Всё, что в Task 10 описано как «блок записи при сбое заказов зеркала», реализуется как «предупреждение без блока» (тест: заказы Ozon не прочитались → план и запись Ozon/ЯМ/KIT/сайта/WB идут). Остальные предохранители (свежесть снимка площадки, 120/20, шлюз WB) — без изменений.
2. **`reconcile` старого синка (08:45) на шаге B закомментировать** вместе с `orders` и `stocks`; `finance` (1-го числа) оставить. В Task 18 и в откате — строка `reconcile` тоже.
3. **Подтверждено:** после шага B WB руками правят только физику (поступление, брак, потеря); единицу после продаж на других площадках и на сайте больше не снимают — это делает синк.
4. **Тестовый заказ на сайте для приёмки A — да.** Отмена — `returned`, единицу возвращает владелец через WB.
5. **KIT: пишем только остаток (`quantity`), `reserved` не трогаем.** Поведение при заказе KIT до отгрузки проверяется на первом реальном заказе (Task 19).
6. **ЯМ: живая проверка тела записи до шага B — да.** Шаг перед Task 18: записать одному офферу ЯМ его текущий остаток (значение не меняется) телом, которое сформирует отправитель sync2; успех — `status: OK` и неизменный остаток при чтении. Выполнять с тем же предпросмотром и «да» владельца в момент шага.
