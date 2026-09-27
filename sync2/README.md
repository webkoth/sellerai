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
  Битый режим, неизвестная площадка, дубль операции — не отправляются. Сбой журнала `writes` после отправки
  бросает `WriteJournalError` с итогами по позициям — `withRun` пишет их в лог.
- Защита от дублей — уникальными индексами и check-ограничениями в базе, не проверками в коде.
- Каждая джоба — внутри `withRun`: журнал `runs`, лог с `run_id`.
- Текст ошибки — только через `errorText` из `@sync2/shared`.
- Изменение схемы: правка `packages/db/src/schema.ts` → `npm run db:generate` → миграция в git.

## Пул остатков (этап 1.2)

- `packages/domain` — чистые функции, из `@sync2/shared` только типы:
  - `reconcilePool` — перенос из finstock (`cabinetId → channelId`), 21 тест перенесены как есть;
  - `toPoolOrders` — заказы WB не вычитаются (они в снимке WB), `cancelled_before_ship` возвращает единицу, `returned` — нет;
  - режим «WB пишет sync2» (включается в 1.4), порядок вызовов строго такой:
    `wbWriteGate(prevItems, wbSnapshot, WB_SETTLE_MINUTES_SELF)` → `reconcilePool` → `planStockWrites(…, { hold })` →
    запись → `applyWbWriteOutcomes(items, prevItems, accepted, wbActual, results, now)`. `hold` строится только
    `wbWriteGate`. Баркод, чей сигнал WB не принят, на WB не пишется и сохраняет прежнее ожидание; применилась запись →
    ожидание = база и `expectedAt = now`; исход неизвестен → `max(база, факт)` и `expectedAt = now`; не применилась →
    факт из снимка (не ниже нуля). Результат записи по непринятому баркоду — ошибка: значит, `hold` обошли;
  - `planStockWrites` — было → станет по площадкам (с артикулом), сироты обнуляются, `hold` удерживает баркоды площадки.
    Два предохранителя, при срабатывании не пишется ничего: больше 120 разных баркодов (`aborted.reason = "changes"`)
    и больше 20 баркодов в ноль (`"to_zero"`, `MAX_STOCK_TO_ZERO_PER_RUN`). Первый запуск площадки с массой сирот
    (KIT, сайт) — только с явным `maxToZero`.
- `packages/db`: `upsertOrders`/`loadOrdersSince`, `insertStockSnapshot`/`latestStockSnapshots`,
  `loadPoolState`/`savePoolRun` (одна транзакция). Время из базы — `toIso`: Postgres отдаёт текст, домен живёт в ISO.
- Приёмка: `packages/db/src/pool-cycle.db.test.ts` — вся история товара на живой базе.

## Адаптеры чтения (этап 1.3a)

- `packages/platforms/src/adapter.ts` — интерфейс `ChannelAdapter`: `fetchOrders(since)` (заказы, созданные не раньше
  `since`, ISO 8601 — окно, а не курсор) и `fetchStocks()` (`StockFetch`: `stocks: NormalizedStock[]` +
  `skippedNoWbBarcode: string[]`). Только чтение — запись на площадку идёт исключительно через `executeWrites`
  (`writer.ts`), в `packages/platforms` нет ни одного пишущего запроса.
- WB, Ozon и ЯМ перенесены из `finstock/packages/platforms/src` (27.09.2026) с живыми образцами ответов и тестами;
  финансовое (`fetchRealization*`, `fetchTariffs*`) убрано целиком. KIT написан по образцу `sync/src/kit.ts`
  (старый синк) — этой площадки в finstock не было. `createWbAdapter(token)` даёт ещё и `fetchCatalog()` (каталог
  WB нужен как индекс для Ozon/ЯМ/KIT); `createOzonAdapter(credentials, wbIndex)`,
  `createYmAdapter(credentials, wbIndex, warehouseIds)` и `createKitAdapter(config, wbIndex)` принимают этот индекс
  снаружи — его строит WB-адаптер в том же прогоне. У KIT штрихкод варианта, по наблюдению, уже штрихкод WB, но
  всё равно проверяется через `resolveWbBarcode`, а не принимается на веру (найдено финальным ревью 1.3a).
- Ключ товара во всём синке — **штрихкод WB**. `resolveWbBarcode` (`packages/shared/src/catalog.ts`) сопоставляет
  штрихкод площадки со штрихкодом WB, а если его нет — по артикулу (offer_id = артикул WB); не сопоставилось —
  `null`, строка в снимок остатков не попадает и уходит в `skippedNoWbBarcode` (заказ с `barcode: null` — идёт).
- Контракт снимка остатков: строки по всем существующим карточкам площадки, включая нулевые;
  `quantity ≥ 0` (Ozon `present − reserved` бывает минус — обрезается снизу); склад — атрибут строки, сумма по
  складам — дело домена (`aggregateStockByBarcode`); у ЯМ строки только по складам магазина из конфига
  (`warehouseIds`, отсекает, в частности, склад возвратов Маркета).
- Жизненный цикл заказа — общий тип `OrderLifecycle` (`open | shipped | cancelled_before_ship | returned`),
  площадка переводит в него свой сырой статус чистой функцией `<площадка>Lifecycle`:

  | Площадка | `cancelled_before_ship` | `returned` | `shipped` | `open` |
  |---|---|---|---|---|
  | WB (FBS) | `isCancelledStatus(status)` | — (возвраты WB — сигнал снимка, в пул заказы WB не идут) | `supplierStatus = "complete"` | остальное |
  | Ozon | `status = "cancelled"` явно с `cancelled_after_ship = false`; `cancelled_from_split_pending` | `status = "cancelled"` с `cancelled_after_ship = true` **или без этого признака** | `delivering`, `driver_pickup`, `delivered`, `sent_by_seller`, `arbitration`, `client_arbitration` | остальное |
  | ЯМ | `CANCELLED` с подстатусом из разрешающего списка `YM_BEFORE_SHIP_SUBSTATUSES` (34 шт. — товар точно не покидал склад) | `RETURNED`, `PARTIALLY_RETURNED`; `CANCELLED` с любым другим (в т.ч. неизвестным/пустым) подстатусом | `DELIVERY`, `PICKUP`, `DELIVERED` | остальное |
  | KIT | `CANCELLED`, `DELIVERY_CANCELLED` | `FULL_REFUND`, `PARTIAL_REFUND` | `WAIT_FOR_DELIVERY`, `DELIVERED`, `COMPLETED` | остальное |

  Правило при сомнении — `returned`, а не `cancelled_before_ship`: ошибка в эту сторону даёт недосчёт одной
  единицы (владелец вернёт её через WB), в обратную — продажу несуществующей. У ЯМ поэтому список подстатусов
  «до отправки» — разрешающий, а не запрещающий: у большинства подстатусов ЯМ нет описания в документации, и
  запрещающий список ошибался бы в опасную сторону.
- `apps/worker/src/channels-config.ts` — `loadChannelsConfig(env)`: ключи и склады четырёх площадок из окружения
  (см. `.env.example`), чистая функция, тестируется без `process.env`. `YM_WAREHOUSE_IDS` — непустой список
  положительных целых через запятую; пустой список (в т.ч. одна запятая), не-число, ноль, отрицательное или
  дробное значение — ошибка с именем переменной, а не тихая подстановка `NaN` или пустого списка складов.
- Команда `sync2 probe` (`apps/worker/src/cli.ts`) — живая приёмка без базы и без единой записи: не вызывает
  `loadConfig`/`createDb`, не требует `DATABASE_URL`. Порядок: WB `fetchCatalog` → индекс → WB, Ozon, ЯМ, KIT —
  `fetchOrders(now − 60 дней)` и `fetchStocks()` **последовательно** (не параллельно — общие с работающим старым
  синком (`/opt/sellerai-sync`) лимиты площадок). На каждую площадку — строка сводки (заказы по жизненному циклу,
  строки/штуки/наличие остатков, пропуски без штрихкода WB), затем — списки `skippedNoWbBarcode` (первые 20 +
  счёт).
  - Битый или неполный конфиг (не хватает ключа, `YM_WAREHOUSE_IDS` не проходит проверку) — `ОШИБКА конфига:
    <текст>` в stderr и код выхода 2, без необработанного отказа промиса и стек-трейса; площадки при этом не
    читаются вовсе.
  - Сбой конкретной площадки при живом чтении печатает `канал | ОШИБКА <errorText>` и даёт код выхода 1 в конце —
    остальные площадки всё равно читаются.
  - Если не прочитался каталог WB, Ozon/ЯМ/KIT всё равно читают заказы (они не зависят от каталога WB), но
    остатки не запрашиваются вовсе — строка получает пометку ` (без каталога WB — остатки не сопоставлены)` и
    `остатки: пропущены` вместо чисел: без индекса штрихкодов WB `resolveWbBarcode` не сопоставит почти ничего,
    и печатать это как настоящий снимок было бы неверно.
  - `warehouse` в строках остатков WB — id склада (`String(id)`), не имя: имя продавец может переименовать в
    личном кабинете в любой момент, id — устойчивый ключ склада.

  ```bash
  npm run cli -- probe
  ```

  На VPS — с `.env` старого синка и `npm ci` версией из `packageManager` (лок-файл собран под неё; более старая
  версия npm на сервере не читает часть его optional-зависимостей и падает с «Missing: … from lock file»):

  ```bash
  npx -y npm@11.16.0 ci
  ```

### Живая проверка `probe` (27.09.2026)

Прочитаны все четыре площадки на VPS (`root@147.45.171.40`), без ошибок, без пропусков без штрихкода WB:

```
wb   | заказов: 30 (open=0, shipped=21, cancelled_before_ship=9, returned=0) | строк остатков: 417 | штук: 114 | в наличии: 83 | пропусков без штрихкода WB: 0
ozon | заказов: 12 (open=0, shipped=10, cancelled_before_ship=1, returned=1) | строк остатков: 81  | штук: 77  | в наличии: 57 | пропусков без штрихкода WB: 0
ym   | заказов: 3  (open=0, shipped=2,  cancelled_before_ship=0, returned=1) | строк остатков: 83  | штук: 79  | в наличии: 58 | пропусков без штрихкода WB: 0
kit  | заказов: 2  (open=0, shipped=0,  cancelled_before_ship=2, returned=0) | строк остатков: 393 | штук: 100 | в наличии: 69 | пропусков без штрихкода WB: 0
```

Для сравнения — старый синк на той же VPS, тот же момент (`grep "пул:|applied" /opt/sellerai-sync/logs/cron-stocks.log | tail -2`):

```
[2026-09-27T08:30:10.717Z] пул: WB-товаров 83, заказов 63, seed 0. К изменению: WB 0, Ozon 0, ЯМ 0, KIT 0
[2026-09-27T08:30:10.719Z] applied: WB 0, Ozon 0/0, ЯМ 0/0, KIT 0/0
```

Сходится: WB «в наличии» 83 = «WB-товаров 83» у старого синка; Ozon «строк остатков» 81 = `ozon_get_stocks count: 81`
из его же лога; KIT 393 строки и ровно 2 заказа `cancelled_before_ship` — как и ожидалось (два тестовых отменённых
заказа в кабинете на эту дату).

## Джобы `ingest`/`pool`, команда `tick`, сверка `compare-v1` (этап 1.3b)

- `sync2 ingest` — каталог WB → `products`, заказы и снимки остатков всех площадок → `orders_raw`/
  `stock_snapshots_raw` (`apps/worker/src/jobs/ingest.ts`). Каталог WB — ворота: не прочитался — вся джоба падает
  (`failed`); прочитался, но короче 90 % прошлого принятого (`lastCounter(db, "ingest", "wbCatalog")`) — товары
  пишутся, а снимки и заказы зеркал в этом прогоне нет (`partial`, `catalogRejected: 1`). Сбой отдельной площадки
  (заказы или остатки) не роняет остальные — джоба заканчивается `partial` с текстом ошибок в `runs.error`.
- `sync2 pool` — пересчёт пула (`reconcilePool`) и план записей по зеркалам (`planStockWrites` → `executeWrites`)
  в режиме WB `external`: WB пишет старый синк, `sync2` в 1.3b только считает (`apps/worker/src/jobs/pool.ts`).
  Без свежего снимка WB (не старше `SNAPSHOT_FRESH_MINUTES = 20`) пул не пересчитывается — `partial`,
  `noFreshWb: 1`. Отправителя на площадки физически нет: любая попытка `apply` бросает ошибку
  «запись на площадки подключается на этапе 1.4» — в 1.3b `channels.write_mode` у ozon/ym/kit держится `dry-run`,
  у wb/site — `off`, поэтому джоба до отправителя не доходит.
- `sync2 tick` — `ingest`, затем `pool`; это два отдельных запуска в журнале `runs`. `pool` выполняется и после
  `partial` у `ingest` (частичные данные лучше, чем никакие), но не после `failed`.
- `sync2 compare-v1` — пул sync2 (`pool_items`) против леджера старого синка (`V1_LEDGER_PATH`, по умолчанию
  `/opt/sellerai-sync/data/state/inventory.json`) + сводка за сутки (упавшие прогоны, план записей по площадкам)
  в Telegram (`apps/worker/src/jobs/compare-v1.ts`: чистые `comparePools`/`formatComparison` + `runCompareV1`).
  Леджера нет или он битый — джоба падает (`failed`), сверка вслепую хуже, чем её отсутствие. Нулевая база у
  товара, которого нет в другом пуле, — не расхождение (не хранится вечно ни там, ни там).
- `sync2 write-mode <площадка> <off|dry-run|apply>` — меняет `channels.write_mode` одной площадки и печатает все
  пять. `apply` в 1.3b отклоняется с понятной ошибкой и кодом выхода 2 — физического отправителя ещё нет.
- Уведомления в Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) для `ingest`/`pool` — только при смене
  состояния джобы: прошлый запуск был `ok`, этот `partial`/`failed` → `⚠️ sync2 <job>: <ошибки/счётчики>`;
  прошлый был не `ok` (и хоть один запуск уже был), этот `ok` → `✅ sync2 <job> снова в норме`. Повтор одного
  состояния молчит; самый первый запуск джобы ни в какую сторону не считается переходом
  (`apps/worker/src/cli.ts`: `notifyTransition`, `lastRunStatus` в `packages/db/src/runs-query.ts`).
- Коды выхода `ingest`/`pool`/`tick`/`compare-v1`: исключение внутри джобы (`withRun` перехватывает и пишет
  `failed`) → 1; `partial` — штатная работа, а не авария → 0.
- Локальная проверка на пустой базе без ключей площадок: `npm run cli -- pool` → `partial`, `noFreshWb: 1`, код 0.
