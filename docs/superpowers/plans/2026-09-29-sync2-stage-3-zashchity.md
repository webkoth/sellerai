# Синк v2 · этап 3 — защиты цен: флаг минимальной цены Ozon, шаблон минимальных цен WB, «Хочу скидку»

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Защиты цен перестают быть ручными и не гаснут молча. **Выпуск 1 (Task 1–6, в бой до 20.10):** джоба `ozon-timers` раз в сутки продлевает флаг «учитывать минимальную цену в акциях» Ozon у каждого продающегося товара, у которого до конца таймера меньше 23 дней или флаг погас; цены не меняются; всё через `executeWrites`, журнал `writes` и свой режим записи защит (`channels.guard_write_mode`). **Выпуск 2 (Task 7–16):** синк заполняет скачанный из ЛК шаблон WB «Минимальные цены и блокировки для автоакций» (мин. цена = прайс × (1 − уступка) вверх до рубля, блокировка «Нет»), бот напоминает за 6 дней до истечения и при изменении прайса, принимает файл ответом и возвращает заполненный с кнопкой «Загрузил в ЛК»; джоба `ozon-tasks` раз в 30 минут выносит заявки Ozon «Хочу скидку» в группу с расчётом нетто и кнопками «одобрить / отклонить», исполняет ответы партнёров.

**Architecture:** Домен (`packages/domain/src`): `ozon-timer.ts` (план продления), `wb-min-price.ts` (мин. цены шаблона, напоминание), `discount-task.ts` (нетто заявки, новые/пропавшие заявки). База: миграция 0005 — `channels.guard_write_mode`, `writes.field` += `price_timer`, `discount_task`; миграция 0006 — виды вопросов `ozon_discount_task`, `wb_min_template` и ответы `approve`, `decline`, `uploaded`; `DecisionRow` — размеченное объединение по `kind`. Площадки: Ozon — `v5/product/info/prices` (с `product_id`), `v1/product/action/timer/status|update`, `v1/product/import/prices` (только для погасшего флага, с текущими ценами), `v2/actions/discounts-task/list`, `v3/product/info/list` (sku → offer_id), `v1/actions/discounts-task/approve|decline`; WB — файл шаблона ЛК через `exceljs` (API нет). Воркер: джобы `ozon-timers` (крон 07:24 МСК), `ozon-tasks` (крон :14/:44), бот (напоминания и приём шаблона, кнопки заявок, срок заявки), CLI `ozon-guard timers|tasks`, `guard-mode`, `guard-plan`, `wb-min-prices fill|uploaded|status|concession`, блок «🛡 Защиты» в суточной сводке `drift`.

**Tech Stack:** как в 1.1–2: TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Vitest 4 (проекты `unit`/`db`), Drizzle 0.45 + postgres.js, `tsx`, pino; новое — `exceljs` 4.4.0 (зависимость `@sync2/platforms`, проверено 29.09 на настоящем шаблоне ЛК: чтение, запись двух столбцов, 382 правила проверки данных сохраняются; `import ExcelJS from "exceljs"` проходит `tsc` с настройками `sync2`).

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md` §2 п. 12–15, §6 (мин. цена WB — `ceil_руб(прайс × (1 − уступка))`), §7 (защиты), §9 (Telegram), §11 этап 3. **Решение владельца:** `business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md` — п. 12 (WB: −10 % без блокировки, на все, факт 26.09), п. 13 (Ozon: флаг раз в неделю, «Хочу скидку» — в Telegram с нетто, в ЛК не одобрять), п. 15 (кнопки — двое партнёров), п. 20. **Исходники:** `sync/scripts/ozon-min-price-flag.mjs` (эталон продления 26.09), шаблоны ЛК `~/Мой диск/Шаблон обновления минимальной цены и блокировки автоакций 26.09.2026 12.36.xlsx` (скачан после загрузки) и `… −10% без блокировки 26.09.2026 — ЗАПОЛНЕН.xlsx` (загружен 26.09). **Код этапа 2** — ветка `sync2-stage-2` (`79f794c`), сигнатуры ниже взяты оттуда.

---

## Факты, проверенные при написании плана (29.09.2026, только чтение)

- **VPS 147.45.171.40, `/opt/sync2` (29.09 11:11 UTC):** выложен код 1.4; применены миграции 0000–0003 (4 строки в `drizzle.__drizzle_migrations`); `channels.write_mode`: `wb/ozon/ym/kit` — `dry-run`, `site` — `off`; в `.env` нет `TELEGRAM_APPROVERS`. Крон `sync2` — блок 1.4 (`tick` `1-59/5`, `compare-v1` 06:05, `drift` 06:10, `prune` 03:17 UTC). Старый синк: `orders` `3-58/5`, `stocks` `*/30`, `reconcile` 08:45 — работают; `prices` и `intake` закомментированы. Этап 2 **не выложен**; шаги A/B этапа 1.4 не выполнены. На VPS нет `sync/scripts/ozon-min-price-flag.mjs` — 26.09 он запускался с Mac.
- **Ветка `sync2-stage-2` (`79f794c`, worktree `/Users/minas/projects/sai_kotelnikovartifact-2`):** код Task 1–21 этапа 2 закоммичен. Что трогает этап 3: `WriteOp.field: "stock" | "price"` (`packages/platforms/src/writer.ts`), `WRITE_FIELDS = ["stock", "price"]` и `writes_field_check` (`packages/db/src/schema.ts`), `WriteRow.field` превращает всё, что не `price`, в `stock` (`journal.ts`), `WriteRecord.price → writes.detail` (`writes-store.ts`); `DecisionPayload` — только WB, и его поля читаются без проверки вида в `jobs/prices.ts` (строки 174–322), `cli-prices.ts` (`decisions`, `decide`), `decision-text.ts` (`decisionText`, `reminderText`); `allowedAnswers(kind, wbReturnEnabled)`, `parseCallbackData` — `^d:(\d+):([axr])$`; `openDecisions` возвращает число, `decisions.run_id` — nullable; `decisionText(d: Pick<DecisionRow, "kind" | "payload">)` — `Pick` по объединению теряет связь вида и нагрузки, поэтому в этапе 3 — полный `DecisionRow`. Запись цены Ozon этапа 2 шлёт `min_price_for_auto_actions_enabled: true`, но таймер не продлевает («продление — этап 3»). Крон этапа 2: `prices` в `4,34`, `bot` — закомментирован до Task 24 этапа 2, `spp` чт 04:20 UTC.
- **Ozon, флаг (swagger `docs/api-reference/openapi/ozon/swagger_ozon.json`):** `POST /v1/product/action/timer/update` `{ product_ids: [≤ 1000] }` — «минимальная цена действует 30 дней после установки… продлить: вызовите метод повторно»; ответ 200 «Обновлено» без схемы. `POST /v1/product/action/timer/status` `{ product_ids }` → `statuses[]{ product_id, min_price_for_auto_actions_enabled, expired_at }`, пустой `expired_at` — активного таймера нет. `POST /v5/product/info/prices` → `items[]{ offer_id, product_id, price{ price, old_price, min_price, vat, … } }`. Эталон 26.09 (`ozon-min-price-flag.mjs --apply`): `import/prices` с **текущими** `price/old_price/min_price`, `min_price_for_auto_actions_enabled: true`, `auto_action_enabled`/`auto_add_to_ozon_actions_list_enabled`/`price_strategy_enabled` — `UNKNOWN`, затем `timer/update` по всем, через 5 с — проверка, что цены не сдвинулись. Итог 26.09: флаг у 81 из 81, **истекает 26.10** (память `sync-v2-2026-09.md`).
- **Ozon, «Хочу скидку»:** `v1/actions/discounts-task/list` — «метод устаревает», замена `POST /v2/actions/discounts-task/list` `{ status: ALL|NEW|APPROVED|DECLINED, limit ∈ {5,10,15,20,30,50}, last_id }` → `tasks[]{ id, sku, name, requested_price, original_price, min_auto_price, requested_quantity_max, edited_till, end_at, reduction_factor, … }` — **без `offer_id` и без `requested_quantity_min`**. `POST /v3/product/info/list` принимает `sku[]` и отдаёт `items[]{ id, offer_id, sku, sources[]{ sku } }`. `POST /v1/actions/discounts-task/approve` `{ tasks: [{ id, approved_price, seller_comment, approved_quantity_min, approved_quantity_max }] }` и `…/decline` `{ tasks: [{ id, seller_comment }] }` — только для заявок `NEW`/`SEEN`; ответ `result{ success_count, fail_count, fail_details[]{ task_id, error_for_user } }`.
- **WB, минимальные цены:** API нет — в OpenAPI (`02-products.yaml`, `08-promotion.yaml`) только `upload/task` цен и календарь акций; на форуме WB API (тема 2169) и у сервисов (SelSup, 2026) — «отдельного метода нет, только Excel-шаблон в ЛК: Цены и скидки → Обновить через Excel → „Минимальные цены и блокировки для автоакций“». Шаблон: лист «Минимальная цена для автоакций», 13 столбцов: `Бренд, Категория, Артикул WB, Артикул продавца, Последний баркод, Остатки WB, Остатки продавца, Оборачиваемость, Цена со скидкой, Текущая минимальная цена для применения скидки по автоакции, Новая минимальная цена для применения скидки по автоакции, RUB, Текущая блокировка применения скидки по автоакции, Новая блокировка применения скидки по автоакции`; 382 строки; «Цена со скидкой» — то число (`5000`), то строка (`'9164'`); «Текущая минимальная цена» — текст `4500 (осталось 30 дней)`; столбец M — проверка данных «Нет,7 дней,30 дней,Бессрочно». Заполненный 26.09: K = `ceil(«Цена со скидкой» × 0,9)` (9 164 → 8 248), M = «Нет»; загружен 26.09 12:36 МСК, проверено 382/382, действует 30 дней → **26.10**. Кнопка ЛК «Добавить все подходящие» снимает минимальные цены (решение, «Риски»).
- **Telegram:** бот `@KotelnikovArtifactBot` — админ группы `-1004395280612`, режим приватности включён: в группе он видит команды себе и **ответы на свои сообщения**, нажатия кнопок — всегда. У токена один потребитель `getUpdates` — приём включается `SYNC2_BOT_POLLING=on` в строке крона бота (этап 2, Task 24). Подпись к документу — до 1024 символов; сообщение с документом правится `editMessageCaption`, а не `editMessageText`.
- **Код плана проверен 29.09 в песочнице** (копия `sync2` из `sync2-stage-2` + все блоки кода Task 1–15, отдельная база `*_test`): `tsc` без ошибок, unit 703 и db 189 тестов зелёные (единственный красный — `agreed-csv.test.ts`, ему в копии не хватало `data/prices/`); `drizzle-kit generate` дал 0005 и 0006 ровно с операторами из Task 1 и Task 7; чтение настоящего шаблона ЛК — `[] 382 0 0 30`.
- **exceljs 4.4.0 (npm, 20.12.2024):** проверено 29.09 в песочнице на шаблоне 26.09: чтение 382 строк, запись K и M, повторное чтение — 382 строки, все 382 правила проверки данных на месте, прочие ячейки не изменились (сверено `openpyxl`); `tsc` 5.9.3 с `tsconfig.base.json` `sync2` — без ошибок.

---

## Решения этапа

1. **Два выпуска.** Выпуск 1 (Task 1–6) — только продление флага Ozon: миграция 0005, домен, адаптер, джоба, CLI, крон. Он не зависит ни от цен этапа 2 в `apply`, ни от бота — выходит сразу после выкладки этапа 2 (Task 23 этапа 2), с первым боевым прогоном `--renew-below=30` (продлить всех сразу, срок ≈ +30 дней). Выпуск 2 (Task 7–16) — шаблон WB и «Хочу скидку», требует бота этапа 2 (Task 24 этапа 2).
2. **Режим записи защит — отдельная колонка `channels.guard_write_mode`** (`off` по умолчанию), действующий режим — меньший из `SYNC_WRITE_MODE` и её. Не `price_write_mode`: флаг должен продлеваться, пока цены Ozon ещё в `dry-run` (приёмка этапа 2), и откат защит не должен трогать цены. `apply` — только `guard-mode ozon apply --confirm` после свежего (≤ 26 ч) прогона `ozon-guard timers` с печатью плана. У WB записи защит нет (API нет) — `guard-mode` принимает только `ozon`.
3. **Продление флага Ozon.** Джоба раз в сутки; пишет товары с ценой > 0, у которых до конца таймера меньше 23 дней или флаг погас — каждый товар продлевается примерно раз в неделю (решение п. 13), а пропущенный день не оставляет дыры. Живой флаг — только `timer/update`; погасший — сначала `import/prices` с **текущими** `price/old_price/min_price` и флагом (как 26.09), затем `timer/update`. Проверка применения — чтением `timer/status` в той же записи: флаг включён и до конца ≥ 29 дней. Товар без `min_price` не включается (Ozon отвергнет флаг без порога) — алерт. После включения погасшего флага — перечитать цены: сдвинулись — алерт. Больше 400 продлений за прогон — не пишется ничего.
4. **`min_price` Ozon пересчитывает только джоба `prices` этапа 2** (единственный писатель цены Ozon, `min_price` = порог равного нетто). Джоба защит цены не считает и не меняет.
5. **Журнал `writes`:** `price_timer` — `before`/`after` — срок таймера до/после (unix-секунды), `external_sku` — `product_id`, `detail` — `offer_id`, `reenable`, цены товара; `discount_task` — `before` — цена Ozon, `after` — одобренная цена (отклонение — `after = before`), `external_sku` — id заявки, `detail` — действие, количество, id вопроса. Ключ строки — штрихкод WB по снимку остатков Ozon; нет его или он занят — `offer:<offer_id>` (дубль ключа уронил бы `executeWrites`).
6. **WB — заполнение скачанного шаблона ЛК, а не генерация с нуля.** ЛК принимает свой шаблон (26.09 так и было); скачанный файл несёт текущие мин. цены с «осталось N дней» — бесплатная проверка прошлой загрузки. Синк меняет только столбцы K и M: K = `ceil(прайс × (1 − уступка) / 1 ₽)` (спека §6), M = «Нет» у всех строк (решение п. 12, без блокировки). Карточка без прайса (не в наличии) — от «Цены со скидкой» шаблона с уступкой 10 % (как 26.09 «на все 382»). Мин. цена выше «Цены со скидкой» (WB сейчас продаёт ниже прайса) — K пустой, строка в пропусках с причиной. Уступка по товару — `agreed_prices.concession_bp`, правка `wb-min-prices concession` (решение п. 12: коллекционным можно 0 %).
7. **Канал WB — Telegram.** Бот раз в МСК-сутки после 09:00 напоминает: за 6 дней до конца срока и ежедневно после (26.10 → 20.10 — совпадает с планом владельца), либо при изменениях прайса/уступки и пойманных автоакциях после последнего заполнения (одно напоминание на пачку изменений; спека §7). Партнёр присылает скачанный шаблон ответом на напоминание (или с подписью `/wbmin`) → бот возвращает заполненный файл с кнопкой «✅ Загрузил в ЛК» (вопрос `wb_min_template`) → срок = момент нажатия + 30 дней. Дубль из терминала — `wb-min-prices fill|uploaded|status`. Бот на площадки не пишет — шаблон грузит человек.
8. **«Хочу скидку»:** джоба `ozon-tasks` раз в 30 минут читает заявки `NEW` (v2), sku → offer_id (`v3/product/info/list`), нетто по цене заявки против нетто WB от прайса (ставка Ozon — живая с товара, иначе по предмету), порог равного нетто; открывает вопрос `ozon_discount_task` (один на заявку навсегда — по `subject`). Кнопки «✅ Одобрить X ₽ / ❌ Отклонить» — только при действующем `apply` защит Ozon, иначе вопрос-уведомление без кнопок; в тексте всегда «в ЛК не одобрять» (решение п. 13). Ответ исполняет следующий прогон джобы (одобрение — по цене заявки, количество 1…запрошенное). Заявка пропала из `NEW` — вопрос закрыт. За 2 часа до `edited_till` — напоминание.
9. **Вопросы трёх семейств** — `DecisionRow` становится размеченным объединением по `kind` (нагрузка у каждого вида своя); этап 2 правится точечно: `prices` берёт только WB-вопросы (`isWbPriceDecision`), тексты и CLI — по виду.
10. **Наблюдаемость:** `ozon-timers` и `ozon-tasks` — в `runs` со счётчиками и уведомлением о смене состояния (`notifyTransition`); блок «🛡 Защиты» в суточной сводке `drift` — ближайший срок флага Ozon и сколько под угрозой, срок мин. цен WB, заявки без ответа, режим защит.
11. **Все внешние шаги** (слияние, выкладка, крон, `guard-mode … apply`, отметка загрузки 26.09) — только в Task 6 и Task 16, каждый с «да» владельца.

### Отступления от спеки и постановки (с причинами)

- **`ozon-guard` «раз в неделю: `timer/update` по всем товарам, `min_price` из расчёта» (спека §7) → ежедневный прогон с порогом 23 дня, без расчёта цены.** Еженедельный крон, пропустивший запуск (сбой, выкладка), оставил бы товары без флага до следующей недели; порог даёт то же «раз в неделю на товар». `min_price` пишет джоба `prices` — второй писатель цены Ozon спорил бы с ней.
- **Одна джоба `ozon-guard` → две (`ozon-timers`, `ozon-tasks`) под одной командой `ozon-guard timers|tasks`:** частота разная (1 раз в сутки и 48 раз в сутки), счётчики и уведомления о смене состояния — раздельные.
- **Шаблон WB — команда и бот, а не только `sync2 wb-min-prices <шаблон.xlsx>` (спека §7):** синк работает на VPS, шаблон у владельца на телефоне/Mac — Telegram короче, чем `scp` туда и обратно; команда остаётся.
- **Карточки без прайса в шаблоне заполняются от цены WB, а не уходят в пропуски (спека: «пропуски — списком с причиной»):** решение 26.09 — «минимальная цена −10 % на все»; пропуски — только когда посчитать нельзя или мин. цена выше цены со скидкой.
- **Кнопки заявок Ozon — только при `apply` защит Ozon:** «одобрить», которое заведомо не исполнится, хуже уведомления без кнопок (урок кнопки «вернуть» этапа 2).

---

## Репозитории, ветки, проверки

| Задачи | Репозиторий | Ветка | Проверки перед коммитом |
|---|---|---|---|
| 1–5 (выпуск 1), 7–15 (выпуск 2) | `/Users/minas/projects/sai_kotelnikovartifact`, worktree `/Users/minas/projects/sai_kotelnikovartifact-3` | `sync2-stage-3` | из `…-3/sync2`: `npm run typecheck && npm test && npm run test:db` |
| 6, 16 | то же + VPS 147.45.171.40 | `main` | по шагам, каждый внешний шаг — только с «да» владельца |

Подготовка (один раз, перед Task 1) — **вариант А, этап 2 ещё не влит в `main`:**
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git worktree add ../sai_kotelnikovartifact-3 -b sync2-stage-3 sync2-stage-2
cd ../sai_kotelnikovartifact-3/sync2 && npx -y npm@11.16.0 ci
```
Этап 2 влили в `main`, пока идёт этап 3, — перенести ветку на `main` (коммиты этапа 2 уже там и выпадут):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact-3 && git rebase main
```
**Вариант Б, этап 2 уже в `main`:**
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git worktree add ../sai_kotelnikovartifact-3 -b sync2-stage-3 main
cd ../sai_kotelnikovartifact-3/sync2 && npx -y npm@11.16.0 ci
```
После Task 5 — указатель выпуска 1 (Task 6 вливает именно его, Task 7–15 идут дальше в `sync2-stage-3`):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact-3 && git branch sync2-stage-3a
```
Все команды задач — из `/Users/minas/projects/sai_kotelnikovartifact-3/sync2`, пути в `git add` — от этого каталога. Тестовая база — `sync2_test`. В основном worktree (`main`) много чужих незакоммиченных правок вне `sync2/` — слияние в Task 6/16 их не трогает; `stash`, `reset`, `checkout .` там не делать.

---

## Карта файлов

```
sai_kotelnikovartifact-3/sync2/                          (ветка sync2-stage-3)
  packages/shared/src/
    write-fields.ts (+test)                              WRITE_FIELDS: stock, price, price_timer, discount_task       [1]
    prices.ts                                            OZON_MIN_PRICE_TIMER_DAYS, OzonFlagProduct, OzonTimerStatus   [2]
    decisions.ts                                         виды/ответы/нагрузки трёх семейств вопросов                  [7]
    wb-min.ts                                            WbMinTemplateRow                                              [8]
    index.ts
  packages/domain/src/
    ozon-timer.ts (+test)                                planOzonTimers                                                [2]
    price-watch.ts                                       DecisionKind → WbPriceDecisionKind                            [7]
    wb-min-price.ts (+test)                              wbMinPriceRub, planWbMinPrices, wbMinReminder, mskDate        [8]
    discount-task.ts (+test)                             assessDiscountTask, diffDiscountTasks                         [13]
    index.ts
  packages/db/
    migrations/0005_ozon_guard.sql, 0006_guard_decisions.sql (+meta)                                                   [1, 7]
    src/schema.ts, channels.ts, writes-store.ts, journal.ts                                                            [1]
    src/decisions.ts                                     DecisionRow по видам, isWbPriceDecision, новые запросы         [7, 10]
    src/agreed-prices.ts                                 agreedChangesSince, setAgreedConcession                       [10]
    src/store-3.db.test.ts                                                                                             [1, 7, 10]
  packages/platforms/
    package.json                                         + exceljs 4.4.0                                               [9]
    src/writer.ts                                        field: WriteField, timer?, discountTask?                      [1, 3, 12]
    src/ozon/min-price-timer.ts (+test)                  флаги, таймеры, продление с проверкой                         [3]
    src/ozon/discount-tasks.ts (+test)                   заявки v2, sku → offer_id, одобрение/отклонение               [12]
    src/wb/min-price-template.ts (+test)                 шаблон ЛК: чтение, заполнение K/M, скелет для тестов          [9]
    src/index.ts
  apps/worker/src/
    apply-preview.ts (+test)                             checkGuardApplyPreview                                        [4]
    guard-senders.ts (+test)                             отправитель защит: price_timer, discount_task                 [4, 14]
    jobs/ozon-timers.ts (+db test)                       джоба продления                                               [4]
    cli-guards.ts                                        ozon-guard, guard-mode, guard-plan, wb-min-prices             [4, 10, 14]
    cli.ts                                               подключение команд защит                                      [4]
    decision-text.ts (+test)                             тексты, кнопки, напоминания по видам                          [7, 14]
    cli-prices.ts                                        decisions/decide по видам, бот с ozonTasksEnabled             [7, 14]
    jobs/prices.ts                                       только WB-вопросы                                             [7]
    wb-min.ts (+test)                                    состояние шаблона WB, заполнение из базы, тексты напоминаний  [10]
    telegram.ts (+test)                                  документы: sendDocument, downloadFile, editMessageCaption      [11]
    jobs/bot.ts, jobs/bot-wb-min.ts (+db test)           шаблон WB в боте, срок заявки Ozon                            [11, 14]
    jobs/ozon-tasks.ts (+db test)                        джоба «Хочу скидку»                                           [14]
    jobs/guard-summary.ts (+test), jobs/drift.ts         блок «🛡 Защиты»                                              [15]
  deploy/crontab.sync2.txt, deploy/README.md                                                                          [5, 15]
  README.md                                                                                                            [5, 15]
```

---

## Выпуск 1 — продление флага минимальной цены Ozon

### Task 1: Поля журнала защит и режим записи защит (миграция 0005)

**Files:**
- Create: `packages/shared/src/write-fields.ts`, `packages/shared/src/write-fields.test.ts`, `packages/db/src/store-3.db.test.ts`, `packages/db/migrations/0005_ozon_guard.sql` (+ `meta/0005_snapshot.json`, `meta/_journal.json` — генерирует drizzle-kit)
- Modify: `packages/shared/src/index.ts`, `packages/db/src/schema.ts`, `packages/db/src/channels.ts`, `packages/db/src/writes-store.ts`, `packages/db/src/journal.ts`, `packages/platforms/src/writer.ts`

- [ ] **Step 1: Падающие тесты.** `packages/shared/src/write-fields.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { WRITE_FIELDS, isWriteField } from "./write-fields"

describe("поля журнала writes", () => {
  it("остаток, цена и две защиты этапа 3; прочее — не поле", () => {
    expect(WRITE_FIELDS).toEqual(["stock", "price", "price_timer", "discount_task"])
    expect(isWriteField("price_timer")).toBe(true)
    expect(isWriteField("title")).toBe(false)
  })
})
```
`packages/db/src/store-3.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadChannels } from "./channels"
import { seedChannels } from "./channels-seed"
import { writesOfRun } from "./journal"
import { channels, writes } from "./schema"
import { TEST_DATABASE_URL, expectConstraint, freshTestDb, insertRun } from "./test-db"
import { drizzleWriteStore } from "./writes-store"

describe.skipIf(!TEST_DATABASE_URL)("этап 3: режим защит и поля журнала", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  const RUN = "00000000-0000-4000-8000-000000007001"
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, RUN)
  })
  afterAll(async () => h?.close())

  it("guard_write_mode по умолчанию off у всех площадок, опечатка не пишется", async () => {
    const chs = await loadChannels(h.db)
    expect([...chs.values()].every((c) => c.guardWriteMode === "off")).toBe(true)
    await expectConstraint(h.db.update(channels).set({ guardWriteMode: "aply" }).where(eq(channels.code, "ozon")), "channels_guard_write_mode_check")
  })

  it("журнал принимает price_timer с detail из timer; план прогона отдаёт поле как есть; чужое поле — отказ", async () => {
    const chs = await loadChannels(h.db)
    await drizzleWriteStore(h.db, RUN, chs, "2026-10-05T04:24:00.000Z")([
      {
        channel: "ozon",
        barcode: "2041383032873",
        field: "price_timer",
        before: 1792920960,
        after: 1794198240,
        mode: "dry-run",
        applied: false,
        response: null,
        error: null,
        uncertain: false,
        externalSku: "1234567",
        timer: { productId: 1234567, offerId: "JW-NB-AGT-M-0002", reenable: false },
      },
    ])
    const [w] = await h.db.select().from(writes).where(eq(writes.runId, RUN))
    expect(w).toMatchObject({ field: "price_timer", before: 1792920960, after: 1794198240, externalSku: "1234567" })
    expect(w!.detail).toMatchObject({ productId: 1234567, reenable: false })
    expect((await writesOfRun(h.db, RUN))[0]!.field).toBe("price_timer")
    await expectConstraint(
      h.db.insert(writes).values({ runId: RUN, channelId: chs.get("ozon")!.id, barcode: "X", field: "title", after: 1, mode: "off", applied: false }),
      "writes_field_check",
    )
  })
})
```
Run: `npx vitest run packages/shared/src/write-fields.test.ts` → FAIL (нет модуля); `npm run test:db -- packages/db/src/store-3.db.test.ts` → FAIL (нет колонки `guard_write_mode`).

- [ ] **Step 2: Реализация.** `packages/shared/src/write-fields.ts`:
```ts
/**
 * Что пишется на площадку — поле журнала writes. price_timer — продление флага минимальной цены Ozon,
 * discount_task — ответ на заявку Ozon «Хочу скидку» (этап 3 синка v2). Список — единый для CHECK базы и типов.
 */
export const WRITE_FIELDS = ["stock", "price", "price_timer", "discount_task"] as const
export type WriteField = (typeof WRITE_FIELDS)[number]

export function isWriteField(value: string): value is WriteField {
  return (WRITE_FIELDS as readonly string[]).includes(value)
}
```
`packages/shared/src/index.ts` — добавить `export * from "./write-fields"`.

`packages/db/src/schema.ts`:
- удалить строку `export const WRITE_FIELDS = ["stock", "price"] as const`;
- в импорт из `"@sync2/shared"` добавить `WRITE_FIELDS`; строку `export { ORDER_LIFECYCLES }` заменить на `export { ORDER_LIFECYCLES, WRITE_FIELDS }`;
- в `channels` после `priceWriteMode`:
```ts
    /** Режим записи защит площадки (этап 3): флаг минимальной цены и заявки «Хочу скидку» Ozon; действует меньший из него и SYNC_WRITE_MODE. */
    guardWriteMode: text("guard_write_mode").notNull().default("off"),
```
- в ограничения `channels` после `channels_price_write_mode_check`:
```ts
    check("channels_guard_write_mode_check", sql`${t.guardWriteMode} in (${inList(WRITE_MODES)})`),
```
- комментарий у `writes.before`: `/** Остаток — штуки; цена — копейки; срок таймера Ozon (price_timer) — unix-секунды; поэтому bigint. */`.

`packages/db/src/channels.ts` — целиком:
```ts
import { isChannel, parseWriteMode, type Channel, type WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import { channels } from "./schema"

export interface ChannelRow {
  id: number
  writeMode: WriteMode
  /** Режим записи цен (этап 2). */
  priceWriteMode: WriteMode
  /** Режим записи защит (этап 3). */
  guardWriteMode: WriteMode
}

/** Площадки из базы: код → id и режимы записи. Неизвестный код или режим — ошибка, а не тихий пропуск. */
export async function loadChannels(db: Db): Promise<Map<Channel, ChannelRow>> {
  const out = new Map<Channel, ChannelRow>()
  for (const r of await db.select().from(channels)) {
    if (!isChannel(r.code)) throw new Error(`неизвестная площадка в таблице channels: ${r.code}`)
    out.set(r.code, {
      id: r.id,
      writeMode: parseWriteMode(r.writeMode, "off"),
      priceWriteMode: parseWriteMode(r.priceWriteMode, "off"),
      guardWriteMode: parseWriteMode(r.guardWriteMode, "off"),
    })
  }
  return out
}
```
`packages/db/src/writes-store.ts` — в `WriteRecord` заменить `field: "stock" | "price"` на `field: WriteField` (импорт `type WriteField` из `@sync2/shared`), после `price?: unknown` добавить:
```ts
  /** Продление флага Ozon (этап 3): OzonTimerDetail из @sync2/platforms — в writes.detail. */
  timer?: unknown
  /** Ответ на заявку «Хочу скидку» (этап 3): OzonDiscountDetail из @sync2/platforms — в writes.detail. */
  discountTask?: unknown
```
и в `values` строку `detail: o.price ?? null,` заменить на `detail: o.price ?? o.timer ?? o.discountTask ?? null,`.

`packages/db/src/journal.ts`: в импорт из `@sync2/shared` добавить `isWriteField, type WriteField`; в `WriteRow` — `field: WriteField` (комментарий: `/** Остаток, цена (этап 2), продление флага Ozon или заявка Ozon (этап 3). */`); в `writesOfRun` — `field: isWriteField(r.field) ? r.field : "stock",`; сигнатура `writeStatsSince(db: Db, sinceIso: string, field: WriteField = "stock")`.

`packages/platforms/src/writer.ts`: в импорт из `@sync2/shared` добавить `type WriteField`; в `WriteOp` — `field: WriteField`.

- [ ] **Step 3: Миграция.**
```bash
npm run db:generate -- --name ozon_guard
```
Expected: `packages/db/migrations/0005_ozon_guard.sql` ровно с этими операторами (порядок может отличаться):
```sql
ALTER TABLE "writes" DROP CONSTRAINT "writes_field_check";--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "guard_write_mode" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_guard_write_mode_check" CHECK ("channels"."guard_write_mode" in ('off', 'dry-run', 'apply'));--> statement-breakpoint
ALTER TABLE "writes" ADD CONSTRAINT "writes_field_check" CHECK ("writes"."field" in ('stock', 'price', 'price_timer', 'discount_task'));
```
Лишнее в файле (пересоздание таблиц, `DROP COLUMN`) — стоп: схема разошлась с 0004, разобраться до коммита. На живой базе: колонка с default без перезаписи таблицы (PG ≥ 11), CHECK по 5 строкам `channels` и ≈ тысячам строк `writes`.

- [ ] **Step 4: Прогон и коммит.**
```bash
npx vitest run packages/shared/src/write-fields.test.ts && npm run typecheck && npm test && npm run test:db
git add packages/shared/src/write-fields.ts packages/shared/src/write-fields.test.ts packages/shared/src/index.ts \
  packages/db/src/schema.ts packages/db/src/channels.ts packages/db/src/writes-store.ts packages/db/src/journal.ts \
  packages/db/src/store-3.db.test.ts packages/db/migrations packages/platforms/src/writer.ts
git commit -m "sync2: миграция 0005 — режим записи защит, поля журнала price_timer и discount_task"
```

---

### Task 2: План продления флага минимальной цены Ozon (`@sync2/domain/ozon-timer`)

**Files:**
- Create: `packages/domain/src/ozon-timer.ts`, `packages/domain/src/ozon-timer.test.ts`
- Modify: `packages/shared/src/prices.ts`, `packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/domain/src/ozon-timer.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { OzonFlagProduct, OzonTimerStatus } from "@sync2/shared"
import { planOzonTimers } from "./ozon-timer"

const NOW = new Date("2026-10-05T04:24:00.000Z")
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()
const p = (id: number, over: Partial<OzonFlagProduct> = {}): OzonFlagProduct => ({
  offerId: `JW-${id}`,
  productId: id,
  priceMinor: 1149000,
  oldMinor: 1580000,
  minMinor: 1140500,
  vat: "0",
  ...over,
})
const st = (id: number, enabled: boolean, expiresAt: string | null): OzonTimerStatus => ({ productId: id, enabled, expiresAt })

describe("план продления флага минимальной цены Ozon", () => {
  it("≥ 23 дней — не трогать; меньше — продлить; погасший — включить заново", () => {
    const plan = planOzonTimers([p(1), p(2), p(3)], [st(1, true, days(25)), st(2, true, days(21)), st(3, false, null)], NOW)
    expect(plan.fresh).toBe(1)
    expect(plan.actions.map((a) => [a.product.productId, a.reenable, a.expiresBefore])).toEqual([
      [2, false, days(21)],
      [3, true, null],
    ])
    expect(plan.earliestExpiry).toBe(days(21))
    expect(plan.freshEarliest).toBe(days(25))
    expect(plan.atRisk).toEqual(["JW-3"])
  })

  it("до конца меньше 7 дней — под угрозой; срок в прошлом или пустой при включённом флаге — как погасший", () => {
    const plan = planOzonTimers([p(1), p(2), p(3)], [st(1, true, days(3)), st(2, true, days(-1)), st(3, true, null)], NOW)
    expect(plan.actions.map((a) => [a.product.productId, a.reenable])).toEqual([
      [1, false],
      [2, true],
      [3, true],
    ])
    expect(plan.atRisk).toEqual(["JW-1", "JW-2", "JW-3"])
    expect(plan.earliestExpiry).toBe(days(3))
  })

  it("цена 0 — не продаётся; нет min_price — флаг не включается; нет статуса — включить заново; повтор товара — один раз", () => {
    const plan = planOzonTimers([p(1, { priceMinor: 0 }), p(2, { minMinor: null }), p(3), p(3)], [], NOW)
    expect(plan.notSelling).toBe(1)
    expect(plan.noMinPrice).toEqual(["JW-2"])
    expect(plan.noStatus).toBe(1)
    expect(plan.actions.map((a) => [a.product.productId, a.reenable])).toEqual([[3, true]])
  })

  it("порог продления — параметр: срок 26.10 при запуске 05.10 (21 день) продлевается при 23, при 20 — нет, при 30 — да", () => {
    const s = [st(1, true, "2026-10-26T09:36:00.000Z")]
    expect(planOzonTimers([p(1)], s, NOW).actions).toHaveLength(1)
    expect(planOzonTimers([p(1)], s, NOW, 20).actions).toHaveLength(0)
    expect(planOzonTimers([p(1)], [st(1, true, days(29))], NOW, 30).actions).toHaveLength(1)
  })
})
```
Run: `npx vitest run packages/domain/src/ozon-timer.test.ts` → FAIL (нет модуля).

- [ ] **Step 2: Реализация.** `packages/shared/src/prices.ts` — дописать в конец:
```ts
/** Флаг «учитывать минимальную цену в акциях» Ozon живёт 30 дней после установки (swagger: timer/update). */
export const OZON_MIN_PRICE_TIMER_DAYS = 30

/** Товар Ozon для продления флага минимальной цены (этап 3): ключи и цены продавца как есть (v5), копейки. */
export interface OzonFlagProduct {
  offerId: string
  productId: number
  /** Цена продавца; 0 — цены нет, товар не продаётся. */
  priceMinor: number
  oldMinor: number | null
  minMinor: number | null
  /** НДС, как вернула площадка, — уходит обратно без изменений. */
  vat: string | null
}

/** Таймер флага (timer/status). expiresAt null — активного таймера нет. */
export interface OzonTimerStatus {
  productId: number
  enabled: boolean
  expiresAt: string | null
}
```
`packages/domain/src/ozon-timer.ts`:
```ts
// Продление флага минимальной цены Ozon (этап 3 синка v2, решение 25.09 п. 13): чистый план — кому продлить,
// кому включить заново, кто под угрозой. Сеть и запись — в адаптере и джобе.
import type { OzonFlagProduct, OzonTimerStatus } from "@sync2/shared"

/** Продлевать, когда до конца таймера меньше стольких дней: при ежедневном прогоне — раз в неделю на товар. */
export const OZON_TIMER_RENEW_BELOW_DAYS = 23
/** Флаг погас или истекает раньше — «под угрозой» (алерт, если продлевать некому). */
export const OZON_TIMER_ALERT_BELOW_DAYS = 7
const DAY_MS = 86_400_000

export interface OzonTimerAction {
  product: OzonFlagProduct
  /** Флаг погас (или статуса нет): сначала import/prices с текущими ценами и флагом, затем timer/update. */
  reenable: boolean
  /** Срок таймера до записи (ISO); null — активного таймера нет. */
  expiresBefore: string | null
}

export interface OzonTimerPlan {
  actions: OzonTimerAction[]
  /** Флаг включён, до конца не меньше порога продления. */
  fresh: number
  /** Цена 0 — товар не продаётся, флаг не нужен. */
  notSelling: number
  /** offer_id без min_price: флаг без порога Ozon не примет (action_price_enabled_min_price_missing). */
  noMinPrice: string[]
  /** Статуса таймера нет в ответе — считаем флаг погасшим. */
  noStatus: number
  /** Самый ранний срок среди активных таймеров (ISO); null — активных нет. */
  earliestExpiry: string | null
  /** Самый ранний срок среди свежих (их прогон не трогает) — для срока «после прогона». */
  freshEarliest: string | null
  /** offer_id, у которых флаг погас или истекает раньше порога тревоги. */
  atRisk: string[]
}

export function planOzonTimers(
  products: readonly OzonFlagProduct[],
  statuses: readonly OzonTimerStatus[],
  now: Date,
  renewBelowDays: number = OZON_TIMER_RENEW_BELOW_DAYS,
  alertBelowDays: number = OZON_TIMER_ALERT_BELOW_DAYS,
): OzonTimerPlan {
  const byId = new Map(statuses.map((s) => [s.productId, s]))
  const nowMs = now.getTime()
  const renewEdge = nowMs + renewBelowDays * DAY_MS
  const alertEdge = nowMs + alertBelowDays * DAY_MS
  const plan: OzonTimerPlan = { actions: [], fresh: 0, notSelling: 0, noMinPrice: [], noStatus: 0, earliestExpiry: null, freshEarliest: null, atRisk: [] }
  const seen = new Set<number>()
  for (const p of products) {
    if (seen.has(p.productId)) continue
    seen.add(p.productId)
    if (p.priceMinor <= 0) {
      plan.notSelling++
      continue
    }
    if (p.minMinor === null || p.minMinor <= 0) {
      plan.noMinPrice.push(p.offerId)
      continue
    }
    const s = byId.get(p.productId)
    if (!s) plan.noStatus++
    const exp = s?.enabled && s.expiresAt ? Date.parse(s.expiresAt) : Number.NaN
    if (Number.isFinite(exp) && exp > nowMs) {
      if (plan.earliestExpiry === null || exp < Date.parse(plan.earliestExpiry)) plan.earliestExpiry = new Date(exp).toISOString()
      if (exp < alertEdge) plan.atRisk.push(p.offerId)
      if (exp >= renewEdge) {
        plan.fresh++
        if (plan.freshEarliest === null || exp < Date.parse(plan.freshEarliest)) plan.freshEarliest = new Date(exp).toISOString()
        continue
      }
      plan.actions.push({ product: p, reenable: false, expiresBefore: new Date(exp).toISOString() })
    } else {
      plan.atRisk.push(p.offerId)
      plan.actions.push({ product: p, reenable: true, expiresBefore: null })
    }
  }
  return plan
}
```
`packages/domain/src/index.ts` — добавить `export * from "./ozon-timer"`.

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/domain/src/ozon-timer.test.ts && npm run typecheck
git add packages/shared/src/prices.ts packages/domain/src/ozon-timer.ts packages/domain/src/ozon-timer.test.ts packages/domain/src/index.ts
git commit -m "sync2: план продления флага минимальной цены Ozon — порог 23 дня, погасший включается заново"
```

---

### Task 3: Ozon — флаги, таймеры, продление с проверкой чтением (`ozon/min-price-timer.ts`)

**Files:**
- Create: `packages/platforms/src/ozon/min-price-timer.ts`, `packages/platforms/src/ozon/min-price-timer.test.ts`
- Modify: `packages/platforms/src/writer.ts`, `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/platforms/src/ozon/min-price-timer.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { fetchOzonTimerStatuses, mapOzonFlagProducts, writeOzonMinPriceTimers } from "./min-price-timer"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const NOW = new Date("2026-10-05T04:24:00.000Z")
const in30 = new Date(NOW.getTime() + 30 * 86_400_000).toISOString()
const in10 = new Date(NOW.getTime() + 10 * 86_400_000).toISOString()
const cfg = { clientId: "5332036", apiKey: "k", retryDelaysMs: [0], verifyDelayMs: 0, now: () => NOW }
afterEach(() => vi.unstubAllGlobals())

type Route = (body: Record<string, unknown>) => Response
function stub(routes: Record<string, Route>) {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      calls.push({ path, body })
      const route = routes[path]
      if (!route) throw new Error(`нет маршрута ${path}`)
      return route(body)
    }),
  )
  return calls
}
const op = (productId: number, reenable: boolean, over: Partial<WriteOp> = {}): WriteOp => ({
  channel: "ozon",
  barcode: `B${productId}`,
  field: "price_timer",
  before: null,
  after: 1,
  externalSku: String(productId),
  timer: { productId, offerId: `JW-${productId}`, reenable, priceMinor: 1149000, oldMinor: 1580000, minMinor: 1140500, vat: "0", expiresBefore: null },
  ...over,
})
const statusOk = (ids: string[], expired = in30) => json({ statuses: ids.map((id) => ({ product_id: Number(id), min_price_for_auto_actions_enabled: true, expired_at: expired })) })

describe("флаги и таймеры Ozon — чтение", () => {
  it("v5: offer_id и product_id обязательны; цена 0 → 0, зачёркнутая и min 0 → null; НДС строкой", () => {
    expect(
      mapOzonFlagProducts([
        { offer_id: "JW-1", product_id: 111, price: { price: 11490, old_price: 15800, min_price: 11405, vat: 0 } },
        { offer_id: "JW-2", product_id: "222", price: { price: 0, old_price: 0, min_price: 0, vat: null } },
        { offer_id: null, product_id: 3, price: { price: 100 } },
      ]),
    ).toEqual([
      { offerId: "JW-1", productId: 111, priceMinor: 1149000, oldMinor: 1580000, minMinor: 1140500, vat: "0" },
      { offerId: "JW-2", productId: 222, priceMinor: 0, oldMinor: null, minMinor: null, vat: null },
    ])
  })

  it("timer/status пачками по 1000; пустой expired_at — таймера нет", async () => {
    const calls = stub({
      "/v1/product/action/timer/status": (b) =>
        json({ statuses: (b.product_ids as string[]).map((id) => ({ product_id: Number(id), min_price_for_auto_actions_enabled: id !== "1", expired_at: id === "1" ? "" : in30 })) }),
    })
    const got = await fetchOzonTimerStatuses(cfg, Array.from({ length: 1001 }, (_, i) => i + 1))
    expect(calls.map((c) => (c.body.product_ids as string[]).length)).toEqual([1000, 1])
    expect(got[0]).toEqual({ productId: 1, enabled: false, expiresAt: null })
    expect(got[1]).toEqual({ productId: 2, enabled: true, expiresAt: in30 })
  })
})

describe("продление флага Ozon — запись", () => {
  it("живой флаг: только timer/update строками product_id, затем проверка timer/status — продлено", async () => {
    const calls = stub({
      "/v1/product/action/timer/update": () => json({}),
      "/v1/product/action/timer/status": (b) => statusOk(b.product_ids as string[]),
    })
    const r = await writeOzonMinPriceTimers(cfg, [op(111, false)])
    expect(calls.map((c) => c.path)).toEqual(["/v1/product/action/timer/update", "/v1/product/action/timer/status"])
    expect(calls[0]!.body).toEqual({ product_ids: ["111"] })
    expect(r).toEqual([expect.objectContaining({ barcode: "B111", field: "price_timer", ok: true })])
  })

  it("погасший флаг: import/prices с текущими ценами и UNKNOWN у автоакций (как 26.09), затем timer/update", async () => {
    const calls = stub({
      "/v1/product/import/prices": () => json({ result: [{ offer_id: "JW-222", updated: true, errors: [] }] }),
      "/v1/product/action/timer/update": () => json({}),
      "/v1/product/action/timer/status": (b) => statusOk(b.product_ids as string[]),
    })
    const r = await writeOzonMinPriceTimers(cfg, [op(222, true)])
    expect(calls[0]!.body).toEqual({
      prices: [
        {
          offer_id: "JW-222",
          price: "11490.00",
          old_price: "15800.00",
          min_price: "11405.00",
          min_price_for_auto_actions_enabled: true,
          auto_action_enabled: "UNKNOWN",
          auto_add_to_ozon_actions_list_enabled: "UNKNOWN",
          price_strategy_enabled: "UNKNOWN",
          currency_code: "RUB",
          vat: "0",
        },
      ],
    })
    expect(calls[1]!.body).toEqual({ product_ids: ["222"] })
    expect(r[0]).toMatchObject({ ok: true })
  })

  it("флаг не включился — отказ без таймера; таймер 500 — итог неизвестен; срок не сдвинулся — итог неизвестен", async () => {
    stub({
      "/v1/product/import/prices": () => json({ result: [{ offer_id: "JW-1", updated: false, errors: [{ code: "action_price_enabled_min_price_missing" }] }] }),
      "/v1/product/action/timer/update": (b) => ((b.product_ids as string[]).includes("2") ? json({ message: "boom" }, 500) : json({})),
      "/v1/product/action/timer/status": (b) => statusOk(b.product_ids as string[], in10),
    })
    const byBarcode = new Map((await writeOzonMinPriceTimers(cfg, [op(1, true)])).map((x) => [x.barcode, x]))
    expect(byBarcode.get("B1")).toMatchObject({ ok: false, uncertain: false })
    expect(byBarcode.get("B1")!.error).toContain("action_price_enabled_min_price_missing")
    const r2 = await writeOzonMinPriceTimers(cfg, [op(2, false)])
    expect(r2[0]).toMatchObject({ ok: false, uncertain: true })
    const r3 = await writeOzonMinPriceTimers(cfg, [op(3, false)])
    expect(r3[0]).toMatchObject({ ok: false, uncertain: true })
    expect(r3[0]!.error).toContain("не продлился")
  })

  it("не своя операция — отказ до сети", async () => {
    const calls = stub({})
    const r = await writeOzonMinPriceTimers(cfg, [op(1, false, { field: "price" }), op(2, true, { timer: undefined })])
    expect(calls).toEqual([])
    expect(r.every((x) => !x.ok && !x.uncertain)).toBe(true)
  })
})
```
Run: `npx vitest run packages/platforms/src/ozon/min-price-timer.test.ts` → FAIL (нет модуля).

- [ ] **Step 2: Реализация.** `packages/platforms/src/writer.ts` — после `PriceDetail` добавить:
```ts
/** Продление флага минимальной цены Ozon (этап 3): что уходит в import/prices (погасший флаг) и timer/update. */
export interface OzonTimerDetail {
  productId: number
  offerId: string
  /** Флаг погас: сначала import/prices с текущими ценами и флагом, затем timer/update. */
  reenable: boolean
  /** Текущие цены товара (копейки) — уходят в import/prices без изменений. */
  priceMinor: number
  oldMinor: number | null
  minMinor: number
  vat: string | null
  /** Срок таймера до записи (ISO) — для журнала. */
  expiresBefore: string | null
}
```
и в `WriteOp` после `price?: PriceDetail`:
```ts
  /** Только field = "price_timer" (этап 3). */
  timer?: OzonTimerDetail
```
`packages/platforms/src/ozon/min-price-timer.ts`:
```ts
// Флаг минимальной цены Ozon (этап 3 синка v2, решение 25.09 п. 13). Чтение — v5/product/info/prices (цены продавца
// с product_id) и timer/status; запись — timer/update, а для погасшего флага сначала import/prices с ТЕКУЩИМИ ценами
// и флагом (эталон — sync/scripts/ozon-min-price-flag.mjs, 26.09, 81/81). Цены не меняются. Проверка — чтением.
import {
  OZON_MIN_PRICE_TIMER_DAYS,
  errorText,
  minorToDecimalString,
  rubToMinor,
  type OzonFlagProduct,
  type OzonTimerStatus,
} from "@sync2/shared"
import { requestJson, requestJsonOrNull, requestJsonWithMeta } from "../http"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, succeeded } from "../stock-write"
import type { OzonTimerDetail, SendResult, WriteOp } from "../writer"
import { BASE, ozonAuth, type OzonCredentials } from "./client"
import { OZON_PRICES_BATCH } from "./prices"

const PAGE = 1000
const MAX_PAGES = 100
const DAY_MS = 86_400_000
/** timer/update и timer/status — до 1000 product_id за запрос (swagger). */
export const OZON_TIMER_BATCH = 1000
/** Проверка чтением: после продления до конца таймера не меньше 29 дней (30 минус запас на часы Ozon). */
export const OZON_TIMER_VERIFY_MIN_DAYS = OZON_MIN_PRICE_TIMER_DAYS - 1

interface V5FlagItem {
  offer_id?: string | null
  product_id?: number | string | null
  price?: { price?: number | null; old_price?: number | null; min_price?: number | null; vat?: number | string | null } | null
}

const positiveMinor = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? rubToMinor(v) : null)

export function mapOzonFlagProducts(items: readonly V5FlagItem[]): OzonFlagProduct[] {
  const out: OzonFlagProduct[] = []
  for (const it of items) {
    const productId = Number(it.product_id)
    if (!it.offer_id || !Number.isSafeInteger(productId) || productId <= 0) continue
    const p = it.price ?? {}
    out.push({
      offerId: it.offer_id,
      productId,
      priceMinor: positiveMinor(p.price) ?? 0,
      oldMinor: positiveMinor(p.old_price),
      minMinor: positiveMinor(p.min_price),
      vat: p.vat === null || p.vat === undefined ? null : String(p.vat),
    })
  }
  return out
}

export async function fetchOzonFlagProducts(cfg: OzonCredentials): Promise<OzonFlagProduct[]> {
  const all: V5FlagItem[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<{ items?: V5FlagItem[] | null; cursor?: string | null }>("ozon", `${BASE}/v5/product/info/prices`, {
      ...ozonAuth(cfg),
      method: "POST",
      body: { filter: { visibility: "ALL" }, limit: PAGE, ...(cursor ? { cursor } : {}) },
    })
    const items = body.items ?? []
    all.push(...items)
    if (items.length < PAGE || !body.cursor || body.cursor === cursor) return mapOzonFlagProducts(all)
    cursor = body.cursor
  }
  throw new Error(`Ozon цены: больше ${MAX_PAGES} страниц — список неполный`)
}

interface TimerStatusRow {
  product_id?: number | string | null
  min_price_for_auto_actions_enabled?: boolean | null
  expired_at?: string | null
}

export function mapOzonTimerStatuses(rows: readonly TimerStatusRow[]): OzonTimerStatus[] {
  const out: OzonTimerStatus[] = []
  for (const r of rows) {
    const productId = Number(r.product_id)
    if (!Number.isSafeInteger(productId) || productId <= 0) continue
    const ms = typeof r.expired_at === "string" && r.expired_at.trim() !== "" ? Date.parse(r.expired_at) : Number.NaN
    out.push({ productId, enabled: r.min_price_for_auto_actions_enabled === true, expiresAt: Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null })
  }
  return out
}

export async function fetchOzonTimerStatuses(cfg: OzonCredentials, productIds: readonly number[]): Promise<OzonTimerStatus[]> {
  const out: OzonTimerStatus[] = []
  for (const batch of chunk([...new Set(productIds)], OZON_TIMER_BATCH)) {
    const body = await requestJson<{ statuses?: TimerStatusRow[] | null }>("ozon", `${BASE}/v1/product/action/timer/status`, {
      ...ozonAuth(cfg),
      method: "POST",
      body: { product_ids: batch.map(String) },
    })
    out.push(...mapOzonTimerStatuses(body.statuses ?? []))
  }
  return out
}

/** Тело import/prices для включения флага: текущие цены как есть, механики — UNKNOWN (не менять). */
export function ozonFlagPriceBody(t: OzonTimerDetail) {
  return {
    offer_id: t.offerId,
    price: minorToDecimalString(t.priceMinor),
    old_price: t.oldMinor === null ? "0" : minorToDecimalString(t.oldMinor),
    min_price: minorToDecimalString(t.minMinor),
    min_price_for_auto_actions_enabled: true,
    auto_action_enabled: "UNKNOWN",
    auto_add_to_ozon_actions_list_enabled: "UNKNOWN",
    price_strategy_enabled: "UNKNOWN",
    currency_code: "RUB",
    ...(t.vat !== null ? { vat: t.vat } : {}),
  }
}

export interface OzonTimerWriterConfig extends OzonCredentials {
  retryDelaysMs?: number[]
  /** Пауза перед проверкой чтением (скрипт 26.09 ждал 5 с); тесты — 0. */
  verifyDelayMs?: number
  now?: () => Date
}

interface ImportRow {
  offer_id?: string
  updated?: boolean
  errors?: Array<{ code?: string; message?: string }> | null
}

export async function writeOzonMinPriceTimers(cfg: OzonTimerWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const results: SendResult[] = []
  const ready: WriteOp[] = []
  for (const op of ops) {
    if (op.field !== "price_timer" || !op.timer) results.push(failed(op, "Ozon: нет данных таймера — запись невозможна"))
    else if (op.timer.reenable && op.timer.minMinor <= 0) results.push(failed(op, "Ozon: нет min_price — флаг без порога не включается"))
    else ready.push(op)
  }
  const retry = { retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS], timeoutMs: WRITE_TIMEOUT_MS, maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS }

  // 1. Погасший флаг — сначала import/prices с текущими ценами (без этого timer/update продлевать нечего).
  const toTimer: WriteOp[] = ready.filter((o) => !o.timer!.reenable)
  for (const batch of chunk(ready.filter((o) => o.timer!.reenable), OZON_PRICES_BATCH)) {
    try {
      const r = await requestJsonWithMeta<{ result?: ImportRow[] | null }>("ozon", `${BASE}/v1/product/import/prices`, {
        ...ozonAuth(cfg),
        method: "POST",
        body: { prices: batch.map((o) => ozonFlagPriceBody(o.timer!)) },
        ...retry,
      })
      const byOffer = new Map((r.body.result ?? []).map((x) => [String(x.offer_id ?? ""), x]))
      for (const o of batch) {
        const row = byOffer.get(o.timer!.offerId)
        if (row?.updated) toTimer.push(o)
        else {
          const codes = (row?.errors ?? []).map((x) => x.code ?? x.message ?? "?").join(", ")
          results.push(failed(o, `Ozon: флаг не включён — ${row ? codes || "не обновлено" : "нет итога по offer_id"}`, { response: row ?? null, uncertain: !row }))
        }
      }
    } catch (e: unknown) {
      for (const o of batch) results.push(failed(o, `Ozon: флаг не включён — ${errorText(e)}`, { uncertain: isUncertain(e) }))
    }
  }

  // 2. Продление таймера. Ответ — «Обновлено» без схемы: пустое тело — не ошибка.
  const sent: WriteOp[] = []
  for (const batch of chunk(toTimer, OZON_TIMER_BATCH)) {
    try {
      await requestJsonOrNull("ozon", `${BASE}/v1/product/action/timer/update`, {
        ...ozonAuth(cfg),
        method: "POST",
        body: { product_ids: batch.map((o) => String(o.timer!.productId)) },
        ...retry,
      })
      sent.push(...batch)
    } catch (e: unknown) {
      for (const o of batch) results.push(failed(o, `Ozon: таймер не продлён — ${errorText(e)}`, { uncertain: isUncertain(e) }))
    }
  }
  if (sent.length === 0) return results

  // 3. Проверка чтением: флаг включён и до конца не меньше 29 дней.
  if (cfg.verifyDelayMs) await new Promise((resolve) => setTimeout(resolve, cfg.verifyDelayMs))
  let statuses: Map<number, OzonTimerStatus>
  try {
    statuses = new Map((await fetchOzonTimerStatuses(cfg, sent.map((o) => o.timer!.productId))).map((s) => [s.productId, s]))
  } catch (e: unknown) {
    for (const o of sent) results.push(failed(o, `Ozon: таймер отправлен, проверка не прочиталась — ${errorText(e)}`, { uncertain: true }))
    return results
  }
  const edge = (cfg.now?.() ?? new Date()).getTime() + OZON_TIMER_VERIFY_MIN_DAYS * DAY_MS
  for (const o of sent) {
    const s = statuses.get(o.timer!.productId)
    const exp = s?.enabled && s.expiresAt ? Date.parse(s.expiresAt) : Number.NaN
    if (Number.isFinite(exp) && exp >= edge) results.push(succeeded(o, s))
    else results.push(failed(o, `Ozon: таймер не продлился — флаг ${s?.enabled ? "включён" : "выключен"}, срок ${s?.expiresAt ?? "—"}`, { response: s ?? null, uncertain: true }))
  }
  return results
}
```
`packages/platforms/src/index.ts` — добавить:
```ts
export {
  fetchOzonFlagProducts,
  fetchOzonTimerStatuses,
  mapOzonFlagProducts,
  mapOzonTimerStatuses,
  ozonFlagPriceBody,
  writeOzonMinPriceTimers,
  OZON_TIMER_BATCH,
  OZON_TIMER_VERIFY_MIN_DAYS,
  type OzonTimerWriterConfig,
} from "./ozon/min-price-timer"
```

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/platforms/src/ozon/min-price-timer.test.ts && npm run typecheck && npm test
git add packages/platforms/src/writer.ts packages/platforms/src/ozon/min-price-timer.ts packages/platforms/src/ozon/min-price-timer.test.ts packages/platforms/src/index.ts
git commit -m "sync2: Ozon — флаг минимальной цены: чтение таймеров, продление, включение погасшего текущими ценами, проверка чтением"
```

---

### Task 4: Джоба `ozon-timers`, отправитель защит, CLI `ozon-guard timers`, `guard-mode`, `guard-plan`

**Files:**
- Create: `apps/worker/src/jobs/ozon-timers.ts`, `apps/worker/src/jobs/ozon-timers.db.test.ts`, `apps/worker/src/guard-senders.ts`, `apps/worker/src/guard-senders.test.ts`, `apps/worker/src/cli-guards.ts`
- Modify: `apps/worker/src/apply-preview.ts`, `apps/worker/src/apply-preview.test.ts`, `apps/worker/src/cli.ts`

- [ ] **Step 1: Падающие тесты.** `apps/worker/src/apply-preview.test.ts` — дописать:
```ts
describe("предпросмотр apply защит", () => {
  const guardRun = (over: Partial<RunInfo> = {}): RunInfo => ({ runId: "r", status: "ok", startedAt: "2026-10-05T04:24:00.000Z", counters: { ozonProducts: 81, ozonTimerPlanned: 81 }, ...over })
  const guardNow = new Date("2026-10-05T10:00:00.000Z")
  it("свежий прогон с прочитанными товарами — можно; нет, упал, старше 26 ч, без чтения, над пределом — нельзя", () => {
    expect(checkGuardApplyPreview(guardRun(), guardNow)).toEqual({ ok: true })
    expect(checkGuardApplyPreview(null, guardNow).ok).toBe(false)
    expect(checkGuardApplyPreview(guardRun({ status: "failed" }), guardNow).ok).toBe(false)
    expect(checkGuardApplyPreview(guardRun({ startedAt: "2026-10-04T04:00:00.000Z" }), guardNow).ok).toBe(false)
    expect(checkGuardApplyPreview(guardRun({ counters: {} }), guardNow).ok).toBe(false)
    expect(checkGuardApplyPreview(guardRun({ counters: { ozonProducts: 81, ozonTimerAborted: 500 } }), guardNow).ok).toBe(false)
  })
})
```
В импорт из `./apply-preview` добавить `checkGuardApplyPreview`, в начало файла — `import type { RunInfo } from "@sync2/db"`.

`apps/worker/src/guard-senders.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { WriteOp } from "@sync2/platforms"
import type { ChannelsConfig } from "./channels-config"
import { buildGuardSender } from "./guard-senders"

const cfg = { ozon: { clientId: "1", apiKey: "k", warehouseId: null } } as unknown as ChannelsConfig
const op = (field: WriteOp["field"]): WriteOp => ({ channel: "ozon", barcode: "A", field, before: null, after: 1, externalSku: "1" })

describe("отправитель защит", () => {
  it("пишет только Ozon и только одно поле защит за пачку; остаток и цена — не его", async () => {
    const send = buildGuardSender(cfg)
    await expect(send("wb", [op("price_timer")])).rejects.toThrow(/только Ozon/)
    await expect(send("ozon", [op("price_timer"), op("discount_task")])).rejects.toThrow(/одно поле/)
    await expect(send("ozon", [op("stock")])).rejects.toThrow(/не поле защит/)
  })
})
```
`apps/worker/src/jobs/ozon-timers.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { channels, insertStockSnapshot, loadChannels, seedChannels, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { SendResult, WriteOp } from "@sync2/platforms"
import type { Channel, OzonFlagProduct, OzonTimerStatus, WriteMode } from "@sync2/shared"
import { runOzonTimers, type OzonTimersDeps } from "./ozon-timers"

const NOW = new Date("2026-10-05T04:24:00.000Z")
const NOW_SEC = Math.floor(NOW.getTime() / 1000)
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()
const prod = (id: number, over: Partial<OzonFlagProduct> = {}): OzonFlagProduct => ({ offerId: `JW-${id}`, productId: id, priceMinor: 1149000, oldMinor: 1580000, minMinor: 1140500, vat: "0", ...over })
const st = (id: number, enabled: boolean, expiresAt: string | null): OzonTimerStatus => ({ productId: id, enabled, expiresAt })
const okSend = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true })))

describe.skipIf(!TEST_DATABASE_URL)("runOzonTimers", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let n = 0
  const nextRun = async () => {
    const id = `00000000-0000-4000-8000-${String(7100 + ++n).padStart(12, "0")}`
    await insertRun(h.db, id)
    return id
  }
  const guard = (m: WriteMode) => h.db.update(channels).set({ guardWriteMode: m }).where(eq(channels.code, "ozon"))
  const job = async (products: OzonFlagProduct[], statuses: OzonTimerStatus[], extra: Partial<OzonTimersDeps> = {}) => {
    const runId = await nextRun()
    const send = okSend()
    const r = await runOzonTimers({
      db: h.db,
      now: () => NOW,
      runId,
      globalMode: "apply",
      sources: { products: async () => products, statuses: async () => statuses },
      send,
      ...extra,
    })
    const rows = await h.db.select().from(writes).where(eq(writes.runId, runId))
    return { r, rows, send }
  }
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    const ids = await loadChannels(h.db)
    await insertStockSnapshot(h.db, {
      channelId: ids.get("ozon")!.id,
      runId: await nextRun(),
      takenAt: "2026-10-05T04:21:00.000Z",
      stocks: [{ barcode: "2041383032873", externalSku: "JW-1", quantity: 2, warehouse: null }],
    })
  })
  afterAll(async () => h?.close())
  beforeEach(async () => {
    await guard("off")
  })

  it("защиты off: план — в журнал с mode off, в сеть ни шагу; погасший флаг — partial с подсказкой", async () => {
    const { r, rows, send } = await job([prod(1), prod(2)], [st(1, true, days(21)), st(2, false, null)])
    expect(send).not.toHaveBeenCalled()
    expect(r.status).toBe("partial")
    expect(r.counters).toMatchObject({ ozonProducts: 2, ozonTimerPlanned: 2, ozonTimerReenable: 1, ozonTimerAtRisk: 1, ozonTimerMinDaysLeft: 21 })
    expect(r.error).toContain("guard-mode ozon apply")
    const byBarcode = new Map(rows.map((w) => [w.barcode, w]))
    expect(byBarcode.get("2041383032873")).toMatchObject({
      field: "price_timer",
      mode: "off",
      applied: false,
      externalSku: "1",
      before: Math.floor(Date.parse(days(21)) / 1000),
      after: NOW_SEC + 30 * 86_400,
    })
    expect(byBarcode.get("offer:JW-2")!.detail).toMatchObject({ offerId: "JW-2", reenable: true, minMinor: 1140500 })
  })

  it("apply: одна пачка продлений, применено, ok; свежие не пишутся", async () => {
    await guard("apply")
    const { r, rows, send } = await job([prod(1), prod(3)], [st(1, true, days(21)), st(3, true, days(25))])
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![1].map((o) => [o.field, o.timer?.productId])).toEqual([["price_timer", 1]])
    expect(r).toMatchObject({ status: "ok", counters: { ozonTimerFresh: 1, ozonTimerPlanned: 1, ozonTimerApplied: 1 } })
    expect(rows.map((w) => [w.mode, w.applied])).toEqual([["apply", true]])
  })

  it("глобальный dry-run главнее apply защит; --renew-below=30 продлевает и свежие", async () => {
    await guard("apply")
    const { rows, send } = await job([prod(1)], [st(1, true, days(25))], { globalMode: "dry-run", renewBelowDays: 30 })
    expect(send).not.toHaveBeenCalled()
    expect(rows.map((w) => w.mode)).toEqual(["dry-run"])
  })

  it("нет min_price — partial, без записи", async () => {
    const { r, rows } = await job([prod(4, { minMinor: null })], [])
    expect(r).toMatchObject({ status: "partial", counters: { ozonNoMinPrice: 1 } })
    expect(rows).toEqual([])
  })

  it("после включения погасшего флага цены сдвинулись — алерт", async () => {
    await guard("apply")
    const products = vi.fn(async () => [prod(5)])
    products.mockResolvedValueOnce([prod(5)]).mockResolvedValueOnce([prod(5, { priceMinor: 1000000 })])
    const runId = await nextRun()
    const r = await runOzonTimers({ db: h.db, now: () => NOW, runId, globalMode: "apply", sources: { products, statuses: async () => [] }, send: okSend() })
    expect(r.counters.ozonTimerPriceMoved).toBe(1)
    expect(r.error).toContain("цены сдвинулись")
  })

  it("больше предела — не пишется ничего", async () => {
    const { r, rows } = await job([prod(6), prod(7)], [], { maxActions: 1 })
    expect(r.counters.ozonTimerAborted).toBe(2)
    expect(rows).toEqual([])
  })
})
```
Run: `npx vitest run apps/worker/src/apply-preview.test.ts apps/worker/src/guard-senders.test.ts` → FAIL; `npm run test:db -- apps/worker/src/jobs/ozon-timers.db.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `apps/worker/src/apply-preview.ts` — дописать:
```ts
/** Прогон ozon-guard timers — раз в сутки; план старше этого для «включать apply защит» не годится. */
export const GUARD_APPLY_PREVIEW_MAX_AGE_H = 26

/** Можно ли включать apply защит Ozon (этап 3): последний ozon-timers свежий, не упал, товары прочитаны, нет предела. */
export function checkGuardApplyPreview(run: RunInfo | null, now: Date): { ok: true } | { ok: false; reason: string } {
  if (!run) return { ok: false, reason: "ozon-guard timers ещё не запускался — сначала guard-mode ozon dry-run и ozon-guard timers" }
  if (run.status !== "ok" && run.status !== "partial") return { ok: false, reason: `последний ozon-guard timers — ${run.status}` }
  const ageH = Math.round((now.getTime() - Date.parse(run.startedAt)) / 3_600_000)
  if (ageH > GUARD_APPLY_PREVIEW_MAX_AGE_H) return { ok: false, reason: `последний ozon-guard timers ${ageH} ч назад — запустите заново` }
  if (!("ozonProducts" in run.counters)) return { ok: false, reason: "в последнем ozon-guard timers товары Ozon не прочитаны" }
  if ("ozonTimerAborted" in run.counters) return { ok: false, reason: "последний ozon-guard timers отклонён пределом — разобрать до apply" }
  return { ok: true }
}
```
`apps/worker/src/guard-senders.ts` (выпуск 1 — только таймер; `discount_task` добавит Task 14):
```ts
import { writeOzonMinPriceTimers, type Sender } from "@sync2/platforms"
import type { ChannelsConfig } from "./channels-config"

/** Пауза перед проверкой продления чтением — как скрипт 26.09 (ozon-min-price-flag.mjs). */
export const OZON_TIMER_VERIFY_DELAY_MS = 5_000

/**
 * Отправитель защит для executeWrites (этап 3): только Ozon (у WB API защит нет — шаблон через ЛК), одна пачка —
 * одно поле. Остаток и цена сюда не попадают: у них свои отправители и свои режимы записи.
 */
export function buildGuardSender(cfg: ChannelsConfig): Sender {
  return async (channel, ops) => {
    if (channel !== "ozon") throw new Error(`защиты пишутся только Ozon, а не ${channel}`)
    const fields = new Set(ops.map((o) => o.field))
    if (fields.size > 1) throw new Error("защиты: одна пачка — одно поле")
    const field = ops[0]?.field
    if (field === undefined) return []
    if (field === "price_timer") return writeOzonMinPriceTimers({ ...cfg.ozon, verifyDelayMs: OZON_TIMER_VERIFY_DELAY_MS }, ops)
    throw new Error(`защиты: ${field} — не поле защит`)
  }
}
```
`apps/worker/src/jobs/ozon-timers.ts`:
```ts
import { OZON_TIMER_RENEW_BELOW_DAYS, planOzonTimers } from "@sync2/domain"
import { drizzleWriteStore, latestStockSnapshots, loadChannels, type ChannelRow, type Db } from "@sync2/db"
import { WriteJournalError, effectiveMode, executeWrites, type Sender, type WriteOp, type WriteOutcome } from "@sync2/platforms"
import { OZON_MIN_PRICE_TIMER_DAYS, errorText, type Channel, type OzonFlagProduct, type OzonTimerStatus, type WriteMode } from "@sync2/shared"
import { formatMsk } from "./compare-v1"

export const OZON_TIMERS_JOB = "ozon-timers"
/** Больше продлений за прогон — не пишется ничего (товаров Ozon ≈ 81; сотни — ошибка чтения или чужой кабинет). */
export const MAX_TIMER_ACTIONS_PER_RUN = 400
const DAY_MS = 86_400_000
const MAX_SHOWN = 5
const shown = (items: readonly string[]) => items.slice(0, MAX_SHOWN).join(", ") + (items.length > MAX_SHOWN ? ` … ещё ${items.length - MAX_SHOWN}` : "")

export interface OzonTimerSources {
  products: () => Promise<OzonFlagProduct[]>
  statuses: (productIds: number[]) => Promise<OzonTimerStatus[]>
}

export interface OzonTimersDeps {
  db: Db
  now: () => Date
  runId: string
  globalMode: WriteMode
  sources: OzonTimerSources
  send: Sender
  /** Продлевать, когда до конца меньше стольких дней; по умолчанию 23 (`--renew-below=30` — всех сразу). */
  renewBelowDays?: number
  maxActions?: number
}

export interface GuardJobResult {
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}

/** Режимы защит всех площадок — для executeWrites. */
export function guardModesOf(channels: ReadonlyMap<Channel, ChannelRow>): Record<Channel, WriteMode> {
  return Object.fromEntries([...channels].map(([c, r]) => [c, r.guardWriteMode])) as Record<Channel, WriteMode>
}

/** Ключ журнала — штрихкод WB по снимку Ozon; нет его или он уже занят в прогоне — `offer:<offer_id>`. */
export function journalBarcode(offerId: string, barcodeOf: ReadonlyMap<string, string>, used: Set<string>): string {
  const wb = barcodeOf.get(offerId)
  const key = wb && !used.has(wb) ? wb : `offer:${offerId}`
  used.add(key)
  return key
}

/**
 * Продление флага минимальной цены Ozon (этап 3, решение п. 13): план по порогу, запись через executeWrites с режимом
 * защит, проверка применения — в отправителе (timer/status), сдвиг цен после включения погасшего флага — здесь.
 */
export async function runOzonTimers(deps: OzonTimersDeps): Promise<GuardJobResult> {
  const { db } = deps
  const now = deps.now()
  const nowIso = now.toISOString()
  const counters: Record<string, number> = {}
  const problems: string[] = []

  const channels = await loadChannels(db)
  const ozon = channels.get("ozon")
  if (!ozon) throw new Error("площадка ozon не заведена — выполните seed-channels")
  const modes = guardModesOf(channels)
  const mode = effectiveMode(deps.globalMode, modes.ozon)

  const products = await deps.sources.products()
  const priced = products.filter((p) => p.priceMinor > 0)
  const statuses = priced.length > 0 ? await deps.sources.statuses(priced.map((p) => p.productId)) : []
  const plan = planOzonTimers(products, statuses, now, deps.renewBelowDays ?? OZON_TIMER_RENEW_BELOW_DAYS)
  counters.ozonProducts = products.length
  counters.ozonTimerFresh = plan.fresh
  if (plan.notSelling > 0) counters.ozonNotSelling = plan.notSelling
  if (plan.noStatus > 0) counters.ozonTimerNoStatus = plan.noStatus
  if (plan.noMinPrice.length > 0) {
    counters.ozonNoMinPrice = plan.noMinPrice.length
    problems.push(`Ozon: нет min_price у ${plan.noMinPrice.length} товаров — флаг минимальной цены не включается: ${shown(plan.noMinPrice)}`)
  }

  const barcodeOf = new Map<string, string>()
  for (const s of (await latestStockSnapshots(db)).get(ozon.id)?.stocks ?? []) if (s.externalSku && !barcodeOf.has(s.externalSku)) barcodeOf.set(s.externalSku, s.barcode)
  const used = new Set<string>()
  const afterSec = Math.floor(now.getTime() / 1000) + OZON_MIN_PRICE_TIMER_DAYS * 86_400
  const ops: WriteOp[] = plan.actions.map((a) => ({
    channel: "ozon",
    barcode: journalBarcode(a.product.offerId, barcodeOf, used),
    field: "price_timer",
    before: a.expiresBefore ? Math.floor(Date.parse(a.expiresBefore) / 1000) : null,
    after: afterSec,
    externalSku: String(a.product.productId),
    timer: {
      productId: a.product.productId,
      offerId: a.product.offerId,
      reenable: a.reenable,
      priceMinor: a.product.priceMinor,
      oldMinor: a.product.oldMinor,
      minMinor: a.product.minMinor ?? 0,
      vat: a.product.vat,
      expiresBefore: a.expiresBefore,
    },
  }))
  const reenable = plan.actions.filter((a) => a.reenable).length
  if (reenable > 0) counters.ozonTimerReenable = reenable

  const maxActions = deps.maxActions ?? MAX_TIMER_ACTIONS_PER_RUN
  const appliedIds = new Set<number>()
  if (ops.length > maxActions) {
    counters.ozonTimerAborted = ops.length
    problems.push(`Ozon: ${ops.length} продлений за прогон при пределе ${maxActions} — не записано ничего; см. guard-plan`)
  } else if (ops.length > 0) {
    let outs: WriteOutcome[]
    try {
      outs = await executeWrites(ops, { globalMode: deps.globalMode, channelModes: modes, send: deps.send, record: drizzleWriteStore(db, deps.runId, channels, nowIso) })
    } catch (e: unknown) {
      if (!(e instanceof WriteJournalError)) throw e
      counters.journalErrors = 1
      problems.push(`журнал продлений Ozon не сохранён: ${errorText(e.cause)}`)
      outs = e.outcomes
    }
    counters.ozonTimerPlanned = outs.length
    const applied = outs.filter((o) => o.applied)
    for (const o of applied) appliedIds.add(o.timer!.productId)
    if (applied.length > 0) counters.ozonTimerApplied = applied.length
    const failedOuts = outs.filter((o) => o.mode === "apply" && o.error !== null)
    if (failedOuts.length > 0) {
      counters.ozonTimerFailed = failedOuts.length
      problems.push(`Ozon: флаг минимальной цены не продлён — ${shown(failedOuts.map((o) => `${o.timer?.offerId ?? o.barcode}: ${o.error}`))}`)
    }
    // Погасший флаг включался повторной отправкой цен — они не должны были сдвинуться (проверка скрипта 26.09).
    const reenabled = applied.filter((o) => o.timer?.reenable)
    if (reenabled.length > 0) {
      try {
        const after = new Map((await deps.sources.products()).map((p) => [p.productId, p]))
        const moved = reenabled.filter((o) => {
          const t = o.timer!
          const a = after.get(t.productId)
          return !a || a.priceMinor !== t.priceMinor || a.oldMinor !== t.oldMinor || a.minMinor !== t.minMinor
        })
        if (moved.length > 0) {
          counters.ozonTimerPriceMoved = moved.length
          problems.push(`Ozon: после включения флага цены сдвинулись — ${shown(moved.map((o) => o.timer!.offerId))}`)
        }
      } catch (e: unknown) {
        problems.push(`Ozon: цены после включения флага не перечитались — ${errorText(e)}`)
      }
    }
  }

  // Сроки после прогона — для сводки: продлённые — +30 дней, остальные — как были; под угрозой — кого не продлили.
  const afterExps: number[] = plan.freshEarliest ? [Date.parse(plan.freshEarliest)] : []
  for (const a of plan.actions) {
    if (appliedIds.has(a.product.productId)) afterExps.push(now.getTime() + OZON_MIN_PRICE_TIMER_DAYS * DAY_MS)
    else if (a.expiresBefore) afterExps.push(Date.parse(a.expiresBefore))
  }
  if (afterExps.length > 0) counters.ozonTimerMinDaysLeft = Math.floor((Math.min(...afterExps) - now.getTime()) / DAY_MS)
  const appliedOffers = new Set(plan.actions.filter((a) => appliedIds.has(a.product.productId)).map((a) => a.product.offerId))
  const atRiskAfter = plan.atRisk.filter((o) => !appliedOffers.has(o)).length
  if (atRiskAfter > 0) counters.ozonTimerAtRisk = atRiskAfter

  if (mode !== "apply" && plan.atRisk.length > 0) {
    const edge = plan.earliestExpiry ? `ближайший срок ${formatMsk(plan.earliestExpiry)}` : "активных таймеров нет"
    problems.push(
      `Ozon: флаг минимальной цены погас или истекает за 7 дней у ${plan.atRisk.length} товаров (${edge}), а запись защит Ozon — ${mode}: guard-mode ozon apply --confirm или вручную node sync/scripts/ozon-min-price-flag.mjs --apply`,
    )
  }
  return problems.length > 0 ? { status: "partial", counters, error: problems.join("; ") } : { status: "ok", counters }
}
```
`apps/worker/src/cli-guards.ts`:
```ts
import { eq } from "drizzle-orm"
import { channels, drizzleRunStore, lastRunStatus, latestRun, writesOfRun, type Db, type RunInfo, type WriteRow } from "@sync2/db"
import { fetchOzonFlagProducts, fetchOzonTimerStatuses } from "@sync2/platforms"
import type { Config } from "@sync2/shared"
import { checkGuardApplyPreview } from "./apply-preview"
import { loadChannelsConfig } from "./channels-config"
import { buildGuardSender } from "./guard-senders"
import { formatMsk } from "./jobs/compare-v1"
import { OZON_TIMERS_JOB, runOzonTimers } from "./jobs/ozon-timers"
import type { Logger } from "./log"
import type { Notifier } from "./notify"
import { notifyTransition } from "./notify-run"
import { withRun } from "./run"

export const GUARD_COMMANDS: ReadonlySet<string> = new Set(["ozon-guard", "guard-mode", "guard-plan"])

/** Флаги команд защит; `--renew-below=…` — со значением через «=». */
export const GUARD_FLAGS: Record<string, readonly string[]> = {
  "ozon-guard": ["--renew-below"],
  "guard-mode": ["--confirm"],
}

export const GUARD_USAGE = `
Защиты (этап 3):
  ozon-guard timers [--renew-below=<1..30>]
                         флаг минимальной цены Ozon: продлить, где до конца < 23 дней (или < N) или погас (крон раз в сутки)
  guard-mode ozon <off|dry-run|apply> [--confirm]
                         режим записи защит Ozon; apply — после плана свежего ozon-guard timers и с --confirm
  guard-plan             план/итог продлений последнего ozon-guard timers`

export interface GuardCliContext {
  db: Db
  log: Logger
  config: Config
  notifier: Notifier
  env: NodeJS.ProcessEnv
}

const flagValue = (flags: readonly string[], name: string): string | null => {
  const f = flags.find((x) => x.startsWith(`${name}=`))
  return f ? f.slice(name.length + 1) : null
}

/** `--renew-below=N`: целое 1…30; нет флага — порог по умолчанию (undefined). */
export function parseRenewBelow(flags: readonly string[]): { ok: true; days: number | undefined } | { ok: false; error: string } {
  if (!flags.some((f) => f === "--renew-below" || f.startsWith("--renew-below="))) return { ok: true, days: undefined }
  const raw = flagValue(flags, "--renew-below") ?? ""
  const n = Number(raw)
  if (!/^\d+$/.test(raw) || n < 1 || n > 30) return { ok: false, error: `--renew-below=<1..30>, получено «${raw}»` }
  return { ok: true, days: n }
}

/** Срок таймера из журнала (unix-секунды) — для людей. */
export const fmtSec = (sec: number | null): string => (sec === null ? "—" : formatMsk(new Date(sec * 1000).toISOString()))

export function printTimerPlan(run: RunInfo, rows: readonly WriteRow[]): void {
  console.log(`${OZON_TIMERS_JOB} ${run.startedAt} ${run.status} ${JSON.stringify(run.counters)}`)
  const timers = rows.filter((w) => w.field === "price_timer")
  if (timers.length === 0) {
    console.log("продлений в плане нет")
    return
  }
  for (const w of timers) {
    const state = w.applied ? "применено" : w.uncertain ? `итог неизвестен: ${w.error ?? ""}` : w.error ? `ошибка: ${w.error}` : w.mode
    console.log([w.barcode, w.vendorCode ?? "", `product ${w.externalSku ?? "—"}`, `${fmtSec(w.before)} → ${fmtSec(w.after)}`, state, (w.title ?? "").slice(0, 40)].join("\t"))
  }
}

export async function runGuardCommand(ctx: GuardCliContext, pos: readonly string[], flags: readonly string[]): Promise<number> {
  const [cmd, arg, arg2] = pos
  const { db, log, config, notifier, env } = ctx
  switch (cmd) {
    case "ozon-guard": {
      if (arg !== "timers") {
        console.error(`ozon-guard timers${GUARD_USAGE}`)
        return 2
      }
      const renew = parseRenewBelow(flags)
      if (!renew.ok) {
        console.error(renew.error)
        return 2
      }
      const prev = await lastRunStatus(db, OZON_TIMERS_JOB)
      const outcome = await withRun(OZON_TIMERS_JOB, { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (run) => {
        const chCfg = loadChannelsConfig(env)
        const r = await runOzonTimers({
          db,
          now: () => new Date(),
          runId: run.runId,
          globalMode: config.writeMode,
          sources: { products: () => fetchOzonFlagProducts(chCfg.ozon), statuses: (ids) => fetchOzonTimerStatuses(chCfg.ozon, ids) },
          send: buildGuardSender(chCfg),
          ...(renew.days !== undefined ? { renewBelowDays: renew.days } : {}),
        })
        return { status: r.status, counters: r.counters, error: r.error }
      })
      await notifyTransition(db, log, notifier, OZON_TIMERS_JOB, prev, outcome)
      console.log(`${outcome.status} ${JSON.stringify(outcome.counters)}${outcome.error ? ` — ${outcome.error}` : ""}`)
      return outcome.status === "failed" ? 1 : 0
    }
    case "guard-mode": {
      if (arg !== "ozon") {
        console.error("защиты пишутся только на Ozon (у WB API нет — шаблон через ЛК): guard-mode ozon <off|dry-run|apply> [--confirm]")
        return 2
      }
      if (arg2 !== "off" && arg2 !== "dry-run" && arg2 !== "apply") {
        console.error(`неизвестный режим: ${arg2} (ожидается off | dry-run | apply)`)
        return 2
      }
      if (arg2 === "apply") {
        const run = await latestRun(db, OZON_TIMERS_JOB)
        if (run) printTimerPlan(run, (await writesOfRun(db, run.runId)).filter((w) => w.channel === "ozon"))
        const verdict = checkGuardApplyPreview(run, new Date())
        if (!verdict.ok) {
          console.error(`apply защит не включён: ${verdict.reason}`)
          return 2
        }
        if (!flags.includes("--confirm")) {
          console.error("apply защит не включён: посмотрите план выше и повторите с --confirm")
          return 2
        }
      } else if (flags.includes("--confirm")) {
        console.error("--confirm нужен только для apply")
        return 2
      }
      const updated = await db.update(channels).set({ guardWriteMode: arg2 }).where(eq(channels.code, "ozon")).returning({ code: channels.code })
      if (updated.length === 0) {
        console.error("площадка ozon не заведена в базе — выполните seed-channels")
        return 2
      }
      for (const r of await db
        .select({ code: channels.code, stock: channels.writeMode, price: channels.priceWriteMode, guard: channels.guardWriteMode })
        .from(channels)
        .orderBy(channels.code)) {
        console.log(`${r.code}\tостатки ${r.stock}\tцены ${r.price}\tзащиты ${r.guard}`)
      }
      return 0
    }
    case "guard-plan": {
      const run = await latestRun(db, OZON_TIMERS_JOB)
      if (!run) {
        console.error("ozon-guard timers ещё не запускался")
        return 2
      }
      printTimerPlan(run, await writesOfRun(db, run.runId))
      return 0
    }
    default:
      console.error(`неизвестная команда защит: ${cmd}`)
      return 2
  }
}
```
`apps/worker/src/cli.ts`:
- импорт: `import { GUARD_COMMANDS, GUARD_FLAGS, GUARD_USAGE, runGuardCommand } from "./cli-guards"`;
- в конце `USAGE` после `${PRICE_USAGE}` дописать `${GUARD_USAGE}`;
- проверка флагов: `(ALLOWED_FLAGS[cmd] ?? PRICE_FLAGS[cmd] ?? GUARD_FLAGS[cmd] ?? [])`;
- после строки `if (PRICE_COMMANDS.has(cmd)) return await runPriceCommand(…)`:
```ts
    if (GUARD_COMMANDS.has(cmd)) return await runGuardCommand({ db, log, config, notifier, env: process.env }, positional, flags)
```

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run apps/worker/src/apply-preview.test.ts apps/worker/src/guard-senders.test.ts && npm run typecheck && npm test && npm run test:db
git add apps/worker/src/apply-preview.ts apps/worker/src/apply-preview.test.ts apps/worker/src/guard-senders.ts apps/worker/src/guard-senders.test.ts \
  apps/worker/src/jobs/ozon-timers.ts apps/worker/src/jobs/ozon-timers.db.test.ts apps/worker/src/cli-guards.ts apps/worker/src/cli.ts
git commit -m "sync2: джоба ozon-timers — продление флага Ozon через executeWrites с режимом защит; CLI ozon-guard timers, guard-mode, guard-plan"
```

---

### Task 5: Крон, README, `deploy/README.md` — выпуск 1

**Files:**
- Modify: `deploy/crontab.sync2.txt`, `deploy/README.md`, `README.md`

- [ ] **Step 1: `deploy/crontab.sync2.txt`** — первую строку заменить на `# >>> sync2 (этап 3) — блок целиком заменяется при выкладке (deploy/README.md; этап 3 — вставкой строк, см. «Этап 3»)`; перед `# <<< sync2` вставить:
```
# защиты Ozon: продление флага минимальной цены — ежедневно 07:24 МСК (мимо тика 1,6,…,56, цен 4/34, старого orders 3,8,…,58);
# пишет только товары, у которых до конца таймера < 23 дней или флаг погас (≈ раз в неделю на товар), режим — guard-mode ozon.
24 4 * * * cd /opt/sync2 && flock -w 240 /tmp/sync2.lock timeout 9m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts ozon-guard timers >> logs/guard.log 2>&1
```
Строку `bot` не трогать (её состояние на сервере — дело Task 24 этапа 2).

- [ ] **Step 2: `deploy/README.md`** — раздел `## Этап 3 — защиты: выпуск 1 (флаг Ozon)` после «Откат этапа 2»: (1) предусловие — этап 2 выложен (Task 23 этапа 2); (2) крон — **вставка** двух строк перед `# <<< sync2` командой из Task 6 Step 4 (дословно), а не замена блока: строка бота на сервере могла быть раскомментирована вручную; (3) первые прогоны и `guard-mode` — команды Task 6 Step 2–3 дословно; (4) «Откат выпуска 1» — раздел «Откат» этого плана, вариант «Флаг Ozon», дословно; (5) ручной запасной путь — `node sync/scripts/ozon-min-price-flag.mjs --verify|--apply` с Mac из корня `sai_kotelnikovartifact` (ключи Ozon — `.env` корня).

- [ ] **Step 3: `README.md` `sync2`** — в список команд добавить три строки `GUARD_USAGE` и абзац: «Защиты цен (этап 3): флаг минимальной цены Ozon продлевает `ozon-guard timers` раз в сутки; режим записи — `guard-mode ozon`, отдельно от остатков и цен; журнал — `writes.field = price_timer`, срок в `before/after` — unix-секунды».

- [ ] **Step 4: Прогон, коммит, указатель выпуска 1.**
```bash
npm run typecheck && npm test && npm run test:db
git add deploy/crontab.sync2.txt deploy/README.md README.md
git commit -m "sync2: этап 3, выпуск 1 — крон ozon-guard timers 07:24 МСК, выкладка вставкой строк, README"
cd /Users/minas/projects/sai_kotelnikovartifact-3 && git branch sync2-stage-3a
```
Затем ревью выпуска 1 (`superpowers:requesting-code-review` по диапазону `sync2-stage-2..sync2-stage-3a` или `main..sync2-stage-3a`) — до Task 6.

---

### Task 6: Выпуск 1 в бой — флаг Ozon продлевает синк [«да»]

Перед каждым шагом — показать владельцу команду и что она изменит, дождаться «да». Не в минуты кронов `sync2` (`1,6,…,56`, `4,34`, `24` в 04 UTC). `T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"` в `/opt/sync2`. **Предусловие:** этап 2 в `main` и выложен (Task 23 Step 1 этапа 2 — миграция 0004 на VPS). Не выполнено к 15.10 — выпуск 1 не гнать: 20.10 продлить вручную (Step 6).

- [ ] **Step 1 [«да»]: слияние и выкладка.**
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git merge --no-ff sync2-stage-3a -m "sync2: этап 3, выпуск 1 — продление флага минимальной цены Ozon"
cd sync2 && npm run typecheck && npm test && npm run test:db && npm run deploy
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T guard-mode ozon off; $T runs 3'
```
Expected: миграция 0005 применена; таблица режимов — `защиты off` у всех пяти; тики `ok`. Откат: прежний `main` → `npm run deploy` (миграцию 0005 не откатывать: колонка с default, старый код её не читает).

- [ ] **Step 2 [«да»]: первый прогон в `dry-run`.**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T guard-mode ozon dry-run && flock -w 240 /tmp/sync2.lock $T ozon-guard timers --renew-below=30; $T guard-plan | head -30'
```
Expected: `ozonProducts` ≈ 81 и больше (все товары кабинета), `ozonTimerPlanned` ≈ 81 (с `--renew-below=30` — все с ценой и `min_price`), `ozonTimerReenable` 0 (флаг включён 26.09 у всех 81; не 0 — список новых товаров в `guard-plan`, это нормально), `ozonNoMinPrice` 0 (не 0 — эти товары без порога: сначала цена с `min_price` этапом 2), `ozonTimerMinDaysLeft` = дней до 26.10 (в `dry-run` ничего не продлено); в `guard-plan` — `… 26.10 12:36 МСК → <сегодня + 30> … dry-run`.

- [ ] **Step 3 [«да»]: `apply` и боевое продление всех.**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T guard-mode ozon apply --confirm && flock -w 240 /tmp/sync2.lock $T ozon-guard timers --renew-below=30; $T runs 1'
```
Expected: `guard-mode` печатает план шага 2 и `ozon … защиты apply`; прогон `ok`, `ozonTimerApplied` = `ozonTimerPlanned`, `ozonTimerMinDaysLeft` 30, `ozonTimerFailed`, `ozonTimerAtRisk`, `ozonTimerPriceMoved` нет. Проверка, что держится:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock -w 240 /tmp/sync2.lock $T ozon-guard timers; $T runs 1'
```
Expected: `ozonTimerFresh` ≈ 81, `ozonTimerPlanned` нет, `ozonTimerMinDaysLeft` 29. Не так (`ozonTimerFailed`, `…PriceMoved`) — `$T guard-mode ozon dry-run`, разбор по `guard-plan`; флаг 26.09 действует до 26.10.

- [ ] **Step 4 [«да»]: строка крона** (вставка перед `# <<< sync2`, остальное не трогается):
```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
crontab -l > logs/crontab.before-3a.txt
grep -q 'cli.ts ozon-guard timers' logs/crontab.before-3a.txt && { echo "строка уже есть"; exit 0; }
awk -v c='# защиты Ozon: продление флага минимальной цены — ежедневно 07:24 МСК (этап 3, выпуск 1)' \
    -v l='24 4 * * * cd /opt/sync2 && flock -w 240 /tmp/sync2.lock timeout 9m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts ozon-guard timers >> logs/guard.log 2>&1' \
    '/^# <<< sync2/{print c; print l} {print}' logs/crontab.before-3a.txt | crontab -
crontab -l | grep -E 'cli.ts (tick|prices|bot|spp|drift|prune|ozon-guard)'
REMOTE
```
Expected: прежние строки `sync2` и старого синка как были, плюс `ozon-guard timers`. Откат: `ssh root@147.45.171.40 'crontab /opt/sync2/logs/crontab.before-3a.txt'`.

- [ ] **Step 5: наблюдение — 3 суток.** Каждое утро `$T runs 5 | grep ozon-timers` — `ok`, `ozonTimerPlanned` 0 или единицы (новые товары), `ozonTimerMinDaysLeft` ≥ 23. Итог — строкой в «Ход выполнения» этого плана; владельцу — «задача 20.10 по Ozon снята, остаётся WB».

- [ ] **Step 6 (запасной, только если Step 3 не сделан к 20.10) [«да»]:** с Mac из `/Users/minas/projects/sai_kotelnikovartifact`: `node sync/scripts/ozon-min-price-flag.mjs --verify` → владельцу; `--smoke` → проверка трёх; `--apply` (запись — командой `! node sync/scripts/ozon-min-price-flag.mjs --apply` от владельца, если классификатор сессии её блокирует).

---

## Выпуск 2 — шаблон минимальных цен WB и «Хочу скидку»

Предусловие выпуска 2 в бою: выпуск 1 работает, бот этапа 2 включён (`SYNC2_BOT_POLLING=on`, `TELEGRAM_APPROVERS` — Task 24 этапа 2). Код — дальше в `sync2-stage-3` поверх Task 5.

### Task 7: Вопросы трёх видов — типы, миграция 0006, точечные правки этапа 2

**Files:**
- Modify: `packages/shared/src/decisions.ts`, `packages/domain/src/price-watch.ts`, `packages/db/src/decisions.ts`, `packages/db/src/store-3.db.test.ts`, `apps/worker/src/decision-text.ts`, `apps/worker/src/decision-text.test.ts`, `apps/worker/src/jobs/prices.ts`, `apps/worker/src/jobs/price-summary.ts`, `apps/worker/src/jobs/bot.ts`, `apps/worker/src/cli-prices.ts`
- Create: `packages/db/migrations/0006_guard_decisions.sql` (+ meta)

- [ ] **Step 1: Падающие тесты.** `apps/worker/src/decision-text.test.ts`: импорт типов заменить на `import type { DecisionRow, OzonTaskDecisionRow, WbPriceDecisionRow } from "@sync2/db"`, из `./decision-text` импортировать ещё `decisionListLine, reminderText`; помощник `d` — на `WbPriceDecisionRow`:
```ts
const d = (over: Partial<WbPriceDecisionRow> = {}): WbPriceDecisionRow => ({
```
(тело прежнее). Дописать:
```ts
const task = (over: Partial<OzonTaskDecisionRow> = {}): OzonTaskDecisionRow => ({
  id: 13,
  kind: "ozon_discount_task",
  subject: "777",
  payload: {
    taskId: 777,
    sku: 5125270344,
    offerId: "JW-NB-AGT-M-0002",
    barcode: "2041383032873",
    nmId: 259678801,
    title: "Браслет «Мудрость Будды»",
    requestedMinor: 1000000,
    currentMinor: 1149000,
    quantityMax: 2,
    netRequestedMinor: 450000,
    netWbMinor: 513184,
    thresholdMinor: 1140409,
    agreedMinor: 916400,
    decideBy: "2026-10-02T09:00:00.000Z",
    endAt: "2026-10-09T09:00:00.000Z",
  },
  status: "open",
  answer: null,
  answeredById: null,
  answeredByName: null,
  answeredAt: null,
  result: null,
  tgMessageId: null,
  sentAt: null,
  remindedAt: null,
  tgClosedAt: null,
  createdAt: "2026-10-01T09:14:00.000Z",
  ...over,
})
const template: DecisionRow = {
  ...task(),
  id: 14,
  kind: "wb_min_template",
  subject: "fill:55",
  payload: { fileName: "Минимальные цены WB — заполнено 20.10.2026.xlsx", filledAt: "2026-10-20T06:10:00.000Z", filled: 380, byAgreed: 78, byWbPrice: 302, skipped: 2, minDaysLeft: 6 },
}

describe("заявка Ozon «Хочу скидку» и шаблон WB", () => {
  it("заявка: цена → заявка с процентом, нетто против WB, порог, срок, «в ЛК не одобрять»; кнопки — только при apply защит", () => {
    const text = fullText(task())
    expect(text).toContain("Цена на Ozon: 11 490,00 ₽ → по заявке: 10 000,00 ₽ (−13,0 %), до 2 шт.")
    expect(text).toContain("🔴 Нетто ниже WB на 631,84 ₽ (−12,3 %); цена равного нетто — 11 404,09 ₽")
    expect(text).toContain("Решить до: 02.10 12:00 МСК")
    expect(text).toContain("в ЛК заявку не одобрять")
    expect(decisionKeyboard(task(), false, false)).toEqual([])
    expect(decisionKeyboard(task(), false, true)).toEqual([
      [{ text: "✅ Одобрить 10 000,00 ₽", callback_data: "d:13:o" }],
      [{ text: "❌ Отклонить заявку", callback_data: "d:13:n" }],
    ])
  })

  it("нетто не посчитано — без вердикта; заявка не ниже порога — зелёная", () => {
    const p = task().payload
    expect(fullText(task({ payload: { ...p, netWbMinor: null, netRequestedMinor: null, thresholdMinor: null, agreedMinor: null } }))).toContain("⚪ Нетто не посчитано")
    expect(fullText(task({ payload: { ...p, requestedMinor: 1150000, netRequestedMinor: 517500 } }))).toContain("🟢 Нетто не ниже WB (+0,8 %)")
  })

  it("шаблон WB: одна кнопка «Загрузил в ЛК» (код u); текст, напоминание и строка списка — по виду", () => {
    expect(decisionKeyboard(template, false)).toEqual([[{ text: "✅ Загрузил в ЛК", callback_data: "d:14:u" }]])
    expect(fullText(template)).toContain("Строк с мин. ценой: 380 (по прайсу 78, по цене WB без прайса 302); пропущено: 2")
    expect(parseCallbackData("d:14:u")).toEqual({ id: 14, answer: "uploaded" })
    expect(parseCallbackData("d:14:o")).toEqual({ id: 14, answer: "approve" })
    expect(reminderText(template)).toContain("Загрузил в ЛК")
    expect(reminderText(task())).toContain("Заявка Ozon #777")
    expect(reminderText(d())).toContain("nm 259678801")
    expect(decisionListLine(task())).toContain("заявка 777")
    expect(decisionListLine(d())).toContain("nm 259678801")
    expect(allowedAnswers("wb_min_template", false)).toEqual(["uploaded"])
  })
})
```
`packages/db/src/store-3.db.test.ts` — в импорт добавить `import { activeDecisionsOfKind, closeOpenOfKind, decisionSubjects, finishDecision, openDecisionReturningId, openDecisions } from "./decisions"` и `decisions` из `./schema`; дописать в `describe`:
```ts
  it("вопросы трёх видов: нагрузка своя; заявка Ozon помнится после исхода; новый файл WB закрывает старые; CHECK видов и ответов", async () => {
    const payload = {
      taskId: 777,
      sku: 5125270344,
      offerId: "JW-NB-AGT-M-0002",
      barcode: "2041383032873",
      nmId: 259678801,
      title: "Браслет",
      requestedMinor: 1000000,
      currentMinor: 1149000,
      quantityMax: 2,
      netRequestedMinor: 450000,
      netWbMinor: 513184,
      thresholdMinor: 1140409,
      agreedMinor: 916400,
      decideBy: null,
      endAt: null,
    }
    const id = await openDecisionReturningId(h.db, { kind: "ozon_discount_task", subject: "777", payload }, null)
    expect(id).not.toBeNull()
    expect(await openDecisionReturningId(h.db, { kind: "ozon_discount_task", subject: "777", payload }, null)).toBeNull()
    expect((await activeDecisionsOfKind(h.db, "ozon_discount_task"))[0]).toMatchObject({ kind: "ozon_discount_task", payload: { taskId: 777, requestedMinor: 1000000 } })
    await finishDecision(h.db, id!, "closed", "истекла", "2026-10-01T10:00:00.000Z")
    expect(await decisionSubjects(h.db, "ozon_discount_task")).toEqual(new Set(["777"]))
    const fill = { fileName: "f.xlsx", filledAt: "2026-10-20T06:10:00.000Z", filled: 1, byAgreed: 1, byWbPrice: 0, skipped: 0, minDaysLeft: null }
    await openDecisions(h.db, [{ kind: "wb_min_template", subject: "fill:1", payload: fill }, { kind: "wb_min_template", subject: "fill:2", payload: fill }], null)
    expect(await closeOpenOfKind(h.db, "wb_min_template", "заменено", "2026-10-20T06:11:00.000Z")).toBe(2)
    await expectConstraint(h.db.insert(decisions).values({ kind: "nope", subject: "1", payload: {} }), "decisions_kind_check")
    await expectConstraint(h.db.insert(decisions).values({ kind: "wb_price_new", subject: "2", payload: {}, answer: "maybe" }), "decisions_answer_check")
  })
```
Run: `npx vitest run apps/worker/src/decision-text.test.ts` → FAIL (нет видов/функций).

- [ ] **Step 2: Типы.** `packages/shared/src/decisions.ts` — целиком:
```ts
/** Вопросы партнёрам с кнопками (спека §9, решение п. 15). Цены WB — этап 2; защиты — этап 3. */
export const WB_PRICE_DECISION_KINDS = ["wb_price_drift", "wb_price_new"] as const
export type WbPriceDecisionKind = (typeof WB_PRICE_DECISION_KINDS)[number]

/** ozon_discount_task — заявка Ozon «Хочу скидку»; wb_min_template — заполненный шаблон мин. цен WB ждёт загрузки в ЛК. */
export const DECISION_KINDS = [...WB_PRICE_DECISION_KINDS, "ozon_discount_task", "wb_min_template"] as const
export type DecisionKind = (typeof DECISION_KINDS)[number]

export function isWbPriceKind(kind: DecisionKind): kind is WbPriceDecisionKind {
  return (WB_PRICE_DECISION_KINDS as readonly string[]).includes(kind)
}

/**
 * open — ждёт ответа; answered — ответ получен, исполнит джоба; done — исполнено; failed — не
 * исполнено (текст в result); closed — закрыт без ответа (цена вернулась, заявка истекла, файл заменён).
 */
export const DECISION_STATUSES = ["open", "answered", "done", "failed", "closed"] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

/** accept/autoaction/return — цены WB; approve/decline — заявка Ozon; uploaded — шаблон WB загружен в ЛК. */
export const DECISION_ANSWERS = ["accept", "autoaction", "return", "approve", "decline", "uploaded"] as const
export type DecisionAnswer = (typeof DECISION_ANSWERS)[number]

/** Цена WB (этап 2): что видел партнёр в момент вопроса. Деньги — копейки; priceRub/discountPct — как на WB. */
export interface DecisionPayload {
  nmId: number
  vendorCode: string | null
  title: string | null
  /** Прайс в момент вопроса; null — прайса нет (wb_price_new). */
  agreedMinor: number | null
  /** Цена продавца со скидкой на WB в момент вопроса. */
  observedMinor: number
  priceRub: number
  discountPct: number
}

/** Заявка Ozon «Хочу скидку» (этап 3). Деньги — копейки; нетто — после ставки площадки. */
export interface OzonDiscountPayload {
  taskId: number
  sku: number
  offerId: string | null
  /** Штрихкод WB по снимку Ozon; null — товар не сопоставлен. */
  barcode: string | null
  nmId: number | null
  title: string | null
  /** Цена по заявке — её одобряет кнопка. */
  requestedMinor: number
  /** Цена продавца на Ozon в момент вопроса; null — не прочитана. */
  currentMinor: number | null
  quantityMax: number
  /** Нетто по цене заявки (после ставки Ozon); null — ставки нет. */
  netRequestedMinor: number | null
  /** Нетто WB от прайса; null — прайса или ставки WB нет. */
  netWbMinor: number | null
  /** Цена Ozon равного с WB нетто. */
  thresholdMinor: number | null
  agreedMinor: number | null
  /** До какого момента Ozon ждёт решения (edited_till), ISO. */
  decideBy: string | null
  endAt: string | null
}

/** Заполненный шаблон минимальных цен WB (этап 3). */
export interface WbMinTemplatePayload {
  fileName: string
  filledAt: string
  filled: number
  byAgreed: number
  byWbPrice: number
  skipped: number
  /** Самый короткий остаток срока текущих мин. цен в скачанном шаблоне, дней; null — не указан. */
  minDaysLeft: number | null
}

/** Нагрузка вопроса по виду. */
export type PayloadOf<K extends DecisionKind> = K extends WbPriceDecisionKind
  ? DecisionPayload
  : K extends "ozon_discount_task"
    ? OzonDiscountPayload
    : WbMinTemplatePayload

/** Кто поменял прайс: импорт CSV, кнопка партнёра, команда владельца. */
export const AGREED_PRICE_SOURCES = ["import", "button", "cli"] as const
export type AgreedPriceSource = (typeof AGREED_PRICE_SOURCES)[number]
```
`packages/domain/src/price-watch.ts`: в импорте `type DecisionKind` → `type WbPriceDecisionKind`; оба поля `kind: DecisionKind` → `kind: WbPriceDecisionKind`.

- [ ] **Step 3: База.** `packages/db/src/decisions.ts` — шапка и типы заменить на:
```ts
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm"
import {
  isWbPriceKind,
  type DecisionAnswer,
  type DecisionKind,
  type DecisionPayload,
  type DecisionStatus,
  type PayloadOf,
  type WbPriceDecisionKind,
} from "@sync2/shared"
import type { Db } from "./client"
import { decisions } from "./schema"
import { setAgreedPriceIn } from "./agreed-prices"
import { toIso, toIsoOrNull } from "./time"

interface DecisionRowCommon {
  id: number
  subject: string
  status: DecisionStatus
  answer: DecisionAnswer | null
  answeredById: number | null
  answeredByName: string | null
  answeredAt: string | null
  result: string | null
  tgMessageId: number | null
  sentAt: string | null
  remindedAt: string | null
  tgClosedAt: string | null
  createdAt: string
}

/** Вопрос одного вида: у каждого вида своя нагрузка (этап 3). */
export type DecisionRowOf<K extends DecisionKind> = DecisionRowCommon & { kind: K; payload: PayloadOf<K> }
/** Вопрос любого вида — размеченное объединение: `switch (d.kind)` сужает и нагрузку. */
export type DecisionRow = { [K in DecisionKind]: DecisionRowOf<K> }[DecisionKind]
export type WbPriceDecisionRow = DecisionRowOf<WbPriceDecisionKind>
export type OzonTaskDecisionRow = DecisionRowOf<"ozon_discount_task">
export type NewDecision = { [K in DecisionKind]: { kind: K; subject: string; payload: PayloadOf<K> } }[DecisionKind]

export function isWbPriceDecision(d: DecisionRow): d is WbPriceDecisionRow {
  return isWbPriceKind(d.kind)
}

export function isOzonTaskDecision(d: DecisionRow): d is OzonTaskDecisionRow {
  return d.kind === "ozon_discount_task"
}
```
`toRow` — последнюю строку тела `return { … }` оформить как `return { id: r.id, kind: r.kind, subject: r.subject, payload: r.payload, status: r.status as DecisionStatus, … } as unknown as DecisionRow` с комментарием `// Связь вида и нагрузки держит запись: пишет только openDecisions* (NewDecision), вид проверяет CHECK базы.` (поля — прежние).
`openDecisions` — сигнатура `openDecisions(db: Db, items: readonly NewDecision[], runId: string | null)` (тело прежнее). `returnsDoneBetween` — тип результата `Promise<WbPriceDecisionRow[]>`, в конце `.map(toRow).filter(isWbPriceDecision)`. В конец файла:
```ts
/** Вопросы одного вида без исхода (open, answered). */
export async function activeDecisionsOfKind(db: Db, kind: DecisionKind): Promise<DecisionRow[]> {
  return (
    await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.kind, kind), inArray(decisions.status, ["open", "answered"])))
      .orderBy(asc(decisions.id))
  ).map(toRow)
}

/** Предметы всех вопросов вида за всё время: заявка Ozon спрашивается один раз, и после исхода тоже. */
export async function decisionSubjects(db: Db, kind: DecisionKind): Promise<Set<string>> {
  return new Set((await db.select({ subject: decisions.subject }).from(decisions).where(eq(decisions.kind, kind))).map((r) => r.subject))
}

/** Один новый вопрос — его id; открытый по тому же предмету уже есть — null. */
export async function openDecisionReturningId(db: Db, item: NewDecision, runId: string | null): Promise<number | null> {
  const [r] = await db
    .insert(decisions)
    .values({ kind: item.kind, subject: item.subject, payload: item.payload, runId })
    .onConflictDoNothing()
    .returning({ id: decisions.id })
  return r?.id ?? null
}

/** Закрыть все открытые вопросы вида (новый файл WB заменяет прежний, загрузка отмечена из терминала). */
export async function closeOpenOfKind(db: Db, kind: DecisionKind, result: string, atIso: string): Promise<number> {
  const rows = await db
    .update(decisions)
    .set({ status: "closed", result, updatedAt: atIso })
    .where(and(eq(decisions.kind, kind), eq(decisions.status, "open")))
    .returning({ id: decisions.id })
  return rows.length
}

/** Автоакции, признанные партнёрами (исполненные ответы «автоакция») после момента — напоминание о шаблоне WB. */
export async function autoactionsSince(db: Db, sinceIso: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(decisions)
    .where(and(eq(decisions.kind, "wb_price_drift"), eq(decisions.answer, "autoaction"), eq(decisions.status, "done"), gt(decisions.updatedAt, sinceIso)))
  return r?.n ?? 0
}
```
Миграция:
```bash
npm run db:generate -- --name guard_decisions
```
Expected `0006_guard_decisions.sql` (порядок может отличаться, лишнего — нет):
```sql
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_kind_check";--> statement-breakpoint
ALTER TABLE "decisions" DROP CONSTRAINT "decisions_answer_check";--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_kind_check" CHECK ("decisions"."kind" in ('wb_price_drift', 'wb_price_new', 'ozon_discount_task', 'wb_min_template'));--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_answer_check" CHECK ("decisions"."answer" is null or "decisions"."answer" in ('accept', 'autoaction', 'return', 'approve', 'decline', 'uploaded'));
```

- [ ] **Step 4: Тексты и кнопки.** `apps/worker/src/decision-text.ts` — целиком:
```ts
import type { DecisionRow, OzonTaskDecisionRow } from "@sync2/db"
import {
  formatRub,
  formatSignedPctBp,
  type DecisionAnswer,
  type DecisionKind,
  type DecisionPayload,
  type OzonDiscountPayload,
  type WbMinTemplatePayload,
  type WbPriceDecisionKind,
} from "@sync2/shared"
import { formatMsk } from "./jobs/compare-v1"
import type { InlineButton, TgUser } from "./telegram"

export const ANSWER_LABELS: Record<DecisionAnswer, string> = {
  accept: "✅ Принять как прайс",
  autoaction: "🏷 Автоакция — не трогать",
  return: "↩️ Вернуть WB к прайсу",
  approve: "✅ Одобрить заявку",
  decline: "❌ Отклонить заявку",
  uploaded: "✅ Загрузил в ЛК",
}
const CODE: Record<DecisionAnswer, string> = { accept: "a", autoaction: "x", return: "r", approve: "o", decline: "n", uploaded: "u" }
const BY_CODE = new Map<string, DecisionAnswer>(Object.entries(CODE).map(([answer, code]) => [code, answer as DecisionAnswer]))

/** callback_data ≤ 64 байт: «d:<id>:<код>». */
export function callbackData(id: number, answer: DecisionAnswer): string {
  return `d:${id}:${CODE[answer]}`
}

export function parseCallbackData(data: string | undefined): { id: number; answer: DecisionAnswer } | null {
  const m = /^d:(\d+):([axronu])$/.exec(data ?? "")
  if (!m) return null
  const id = Number(m[1])
  const answer = BY_CODE.get(m[2]!)
  // id вне безопасного целого ушёл бы в bigint базы ошибкой — это не наша кнопка.
  return Number.isSafeInteger(id) && id > 0 && answer ? { id, answer } : null
}

/**
 * Какие ответы принимаются: «вернуть» — только при apply цен WB; «одобрить/отклонить» заявку Ozon — только при apply
 * защит Ozon (иначе вопрос — уведомление без кнопок); «загрузил» — всегда.
 */
export function allowedAnswers(kind: DecisionKind, wbReturnEnabled: boolean, ozonTasksEnabled = false): DecisionAnswer[] {
  switch (kind) {
    case "wb_price_new":
      return ["accept"]
    case "wb_price_drift":
      return wbReturnEnabled ? ["accept", "autoaction", "return"] : ["accept", "autoaction"]
    case "ozon_discount_task":
      return ozonTasksEnabled ? ["approve", "decline"] : []
    case "wb_min_template":
      return ["uploaded"]
  }
}

function buttonText(d: DecisionRow, a: DecisionAnswer): string {
  if (a === "approve" && d.kind === "ozon_discount_task") return `✅ Одобрить ${formatRub(d.payload.requestedMinor)}`
  return ANSWER_LABELS[a]
}

export function decisionKeyboard(d: DecisionRow, wbReturnEnabled: boolean, ozonTasksEnabled = false): InlineButton[][] {
  return allowedAnswers(d.kind, wbReturnEnabled, ozonTasksEnabled).map((a) => [{ text: buttonText(d, a), callback_data: callbackData(d.id, a) }])
}

function wbPriceText(kind: WbPriceDecisionKind, p: DecisionPayload): string {
  const head = [p.title ?? "(без названия)", `Арт. ${p.vendorCode ?? "—"} · nm ${p.nmId}`]
  const wbLine = `Цена продавца на WB: ${formatRub(p.observedMinor)} (до скидки ${p.priceRub} ₽, скидка ${p.discountPct} %)`
  if (kind === "wb_price_new") return ["🆕 WB: товар в наличии без прайса", ...head, wbLine, "Принять эту цену как прайс?"].join("\n")
  const agreed = p.agreedMinor ?? 0
  const bp = agreed > 0 ? Math.round(((p.observedMinor - agreed) * 10_000) / agreed) : 0
  return [
    "💰 WB: цена продавца отличается от прайса",
    ...head,
    `Прайс: ${formatRub(agreed)} → на WB: ${formatRub(p.observedMinor)} (${formatSignedPctBp(bp)})`,
    `До скидки ${p.priceRub} ₽, скидка ${p.discountPct} %`,
    "Что это?",
  ].join("\n")
}

function ozonTaskText(p: OzonDiscountPayload): string {
  const lines = [`🛍 Ozon «Хочу скидку»: заявка #${p.taskId}`, p.title ?? "(без названия)", `Арт. ${p.offerId ?? "—"} · SKU ${p.sku}${p.nmId ? ` · nm ${p.nmId}` : ""}`]
  const off = p.currentMinor ? ` (${formatSignedPctBp(Math.round(((p.requestedMinor - p.currentMinor) * 10_000) / p.currentMinor))})` : ""
  lines.push(`Цена на Ozon: ${p.currentMinor === null ? "—" : formatRub(p.currentMinor)} → по заявке: ${formatRub(p.requestedMinor)}${off}, до ${p.quantityMax} шт.`)
  if (p.netRequestedMinor === null || p.netWbMinor === null || p.netWbMinor <= 0 || p.thresholdMinor === null) {
    lines.push("⚪ Нетто не посчитано — нет прайса или ставки; решайте по цене")
  } else {
    const diff = p.netRequestedMinor - p.netWbMinor
    const diffBp = Math.round((diff * 10_000) / p.netWbMinor)
    lines.push(`Нетто по заявке: ${formatRub(p.netRequestedMinor)} · нетто WB: ${formatRub(p.netWbMinor)} (прайс ${formatRub(p.agreedMinor ?? 0)})`)
    lines.push(
      diff >= 0
        ? `🟢 Нетто не ниже WB (${formatSignedPctBp(diffBp)})`
        : `🔴 Нетто ниже WB на ${formatRub(-diff)} (${formatSignedPctBp(diffBp)}); цена равного нетто — ${formatRub(p.thresholdMinor)}`,
    )
  }
  if (p.decideBy) lines.push(`Решить до: ${formatMsk(p.decideBy)}`)
  lines.push("Решают кнопки партнёров; в ЛК заявку не одобрять (решение 25.09, п. 13)")
  return lines.join("\n")
}

function wbMinTemplateText(p: WbMinTemplatePayload): string {
  return [
    `📄 Минимальные цены WB — файл заполнен ${formatMsk(p.filledAt)}`,
    `Строк с мин. ценой: ${p.filled} (по прайсу ${p.byAgreed}, по цене WB без прайса ${p.byWbPrice}); пропущено: ${p.skipped}; блокировка — «Нет» у всех`,
    p.minDaysLeft === null ? "Срок текущих мин. цен в шаблоне не указан" : `Текущие мин. цены в ЛК: самый короткий срок — ${p.minDaysLeft} дн.`,
    "Загрузите файл в ЛК WB: Цены и скидки → Обновить через Excel → «Минимальные цены и блокировки для автоакций» — и нажмите кнопку.",
  ].join("\n")
}

export function decisionText(d: DecisionRow): string {
  switch (d.kind) {
    case "wb_price_new":
    case "wb_price_drift":
      return wbPriceText(d.kind, d.payload)
    case "ozon_discount_task":
      return ozonTaskText(d.payload)
    case "wb_min_template":
      return wbMinTemplateText(d.payload)
  }
}

export function answeredLine(d: Pick<DecisionRow, "answer" | "answeredByName" | "answeredAt">): string | null {
  if (!d.answer || !d.answeredAt) return null
  return `Решено: ${d.answeredByName ?? "?"}, ${formatMsk(d.answeredAt)} — ${ANSWER_LABELS[d.answer]}`
}

export function outcomeLine(d: Pick<DecisionRow, "status" | "result">): string | null {
  if (d.status === "done") return `Итог: ${d.result ?? "исполнено"}`
  if (d.status === "failed") return `⚠️ Не исполнено: ${d.result ?? "без текста"}`
  if (d.status === "closed") return `Закрыто без ответа: ${d.result ?? ""}`.trim()
  return null
}

/** Текст сообщения целиком: вопрос, кто решил, итог — сообщение пересобирается, а не дописывается. */
export function fullText(d: DecisionRow): string {
  return [decisionText(d), answeredLine(d), outcomeLine(d)].filter((x): x is string => x !== null).join("\n\n")
}

export function reminderText(d: DecisionRow): string {
  switch (d.kind) {
    case "ozon_discount_task":
      return `⏰ Заявка Ozon #${d.payload.taskId} без ответа${d.payload.decideBy ? ` — решить до ${formatMsk(d.payload.decideBy)}` : ""}; без ответа ничего не применяется, Ozon закроет её сам`
    case "wb_min_template":
      return "⏰ Файл минимальных цен WB без отметки «Загрузил в ЛК» больше суток — без загрузки защита WB не действует"
    default:
      return `⏰ Напоминание: вопрос по nm ${d.payload.nmId} без ответа больше суток — без ответа ничего не применяется`
  }
}

/** Строка списка `decisions` для терминала. */
export function decisionListLine(d: DecisionRow): string {
  const state = [`#${d.id}`, d.kind, d.status, d.answer ?? "", d.tgMessageId ? "в группе" : "не отправлен"]
  switch (d.kind) {
    case "ozon_discount_task":
      return [...state, `заявка ${d.payload.taskId}`, `${d.payload.currentMinor === null ? "—" : formatRub(d.payload.currentMinor)} → ${formatRub(d.payload.requestedMinor)}`, (d.payload.title ?? "").slice(0, 30)].join("\t")
    case "wb_min_template":
      return [...state, `заполнено ${d.payload.filled}`, formatMsk(d.payload.filledAt)].join("\t")
    default:
      return [...state, `nm ${d.payload.nmId}`, `${d.payload.agreedMinor === null ? "—" : formatRub(d.payload.agreedMinor)} → ${formatRub(d.payload.observedMinor)}`, (d.payload.title ?? "").slice(0, 30)].join("\t")
  }
}

/** Заявка Ozon: до срока решения (edited_till) осталось ≤ 2 ч, напоминания ещё не было. */
export const TASK_DEADLINE_REMIND_MS = 2 * 60 * 60 * 1000
export function deadlineReminderDue(d: OzonTaskDecisionRow, now: Date): boolean {
  if (d.status !== "open" || d.tgMessageId === null || d.remindedAt !== null || d.payload.decideBy === null) return false
  const left = Date.parse(d.payload.decideBy) - now.getTime()
  return left > 0 && left <= TASK_DEADLINE_REMIND_MS
}

export function userName(u: TgUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || (u.username ? `@${u.username}` : String(u.id))
}
```

- [ ] **Step 5: Этап 2 — только WB-вопросы там, где нужны цены WB.**
- `apps/worker/src/jobs/prices.ts`: в импорт из `@sync2/db` добавить `isWbPriceDecision`; строку `const active = (await activeDecisions(db)).filter((d) => inScope(d.payload.nmId))` заменить на `const active = (await activeDecisions(db)).filter(isWbPriceDecision).filter((d) => inScope(d.payload.nmId))`.
- `apps/worker/src/jobs/price-summary.ts`: в импорт добавить `isWbPriceDecision`; `const active = (await activeDecisions(db)).filter(isWbPriceDecision)` (блок «Цены» считает только вопросы цен WB).
- `apps/worker/src/jobs/bot.ts`: в `BotDeps` после `wbReturnEnabled`:
```ts
  /** Действующий режим записи защит Ozon — apply: кнопки заявки «Хочу скидку» показываются и принимаются (этап 3). */
  ozonTasksEnabled?: boolean
```
вызовы — `decisionKeyboard(d, deps.wbReturnEnabled, deps.ozonTasksEnabled ?? false)` и `allowedAnswers(d.kind, deps.wbReturnEnabled, deps.ozonTasksEnabled ?? false)`; текст отказа неподходящего ответа:
```ts
    const refusal =
      parsed.answer === "return"
        ? "Запись цен WB выключена — вернуть сейчас нельзя"
        : parsed.answer === "approve" || parsed.answer === "decline"
          ? "Запись защит Ozon выключена — ответить на заявку сейчас нельзя"
          : "Этот ответ к вопросу не подходит"
    await reply(refusal, true)
```
- `apps/worker/src/cli-prices.ts`: импорт — `allowedAnswers, decisionListLine` из `./decision-text`; ветка `decisions` — тело цикла `console.log(decisionListLine(d))`; ветка `decide` — целиком:
```ts
    case "decide": {
      if (!arg || !arg2 || !(DECISION_ANSWERS as readonly string[]).includes(arg2) || (arg === "all-drift" && arg2 !== "accept" && arg2 !== "autoaction")) {
        console.error("decide <id|all-drift> <accept|autoaction|return|approve|decline> [--confirm] (all-drift — только accept|autoaction)")
        return 2
      }
      const answer = arg2 as DecisionAnswer
      if (answer === "uploaded") {
        console.error("загрузку шаблона WB отмечает wb-min-prices uploaded --confirm")
        return 2
      }
      const chs = await loadChannels(db)
      if (answer === "return") {
        const refusal = returnRefusal(effectiveMode(config.writeMode, chs.get("wb")?.priceWriteMode ?? "off"))
        if (refusal) {
          console.error(refusal)
          return 2
        }
      }
      const ozonTasksEnabled = effectiveMode(config.writeMode, chs.get("ozon")?.guardWriteMode ?? "off") === "apply"
      const open = (await activeDecisions(db)).filter((d) => d.status === "open")
      const targets = arg === "all-drift" ? open.filter((d) => d.kind === "wb_price_drift") : open.filter((d) => d.id === Number(arg))
      if (targets.length === 0) {
        console.error("открытых вопросов с таким номером нет")
        return 2
      }
      const unfit = targets.filter((d) => !allowedAnswers(d.kind, true, ozonTasksEnabled).includes(answer))
      if (unfit.length > 0) {
        const hint = answer === "approve" || answer === "decline" ? " — ответ на заявку Ozon: нужна запись защит Ozon в apply (guard-mode ozon apply)" : ""
        console.error(`ответ ${answer} не подходит: ${unfit.map((d) => `#${d.id} (${d.kind})`).join(", ")}${hint}`)
        return 2
      }
      for (const d of targets) console.log(`${decisionListLine(d)}\t→ ${answer}`)
      if (!flags.includes("--confirm")) {
        console.error(`ответ не записан: ${targets.length} вопросов выше — повторите с --confirm`)
        return 2
      }
      let n = 0
      for (const d of targets) if (await answerDecision(db, d.id, answer, { id: null, name: CLI_APPROVER }, new Date().toISOString())) n++
      console.log(`отвечено ${n}; исполнит следующий прогон (prices — цены WB, ozon-guard tasks — заявки Ozon)`)
      return 0
    }
```
В `PRICE_USAGE` строку `decide` заменить на `decide <id|all-drift> <accept|autoaction|return|approve|decline> [--confirm]`. В ветке `bot` после `wbReturnEnabled`:
```ts
        const ozonTasksEnabled = effectiveMode(config.writeMode, chs.get("ozon")?.guardWriteMode ?? "off") === "apply"
```
и в `runBot({ … })` добавить `ozonTasksEnabled,`.

- [ ] **Step 6: Прогон и коммит.**
```bash
npx vitest run apps/worker/src/decision-text.test.ts && npm run typecheck && npm test && npm run test:db
git add packages/shared/src/decisions.ts packages/domain/src/price-watch.ts packages/db/src/decisions.ts packages/db/src/store-3.db.test.ts packages/db/migrations \
  apps/worker/src/decision-text.ts apps/worker/src/decision-text.test.ts apps/worker/src/jobs/prices.ts apps/worker/src/jobs/price-summary.ts apps/worker/src/jobs/bot.ts apps/worker/src/cli-prices.ts
git commit -m "sync2: вопросы трёх видов — заявка Ozon и шаблон WB со своей нагрузкой, миграция 0006; цены WB берут только свои вопросы"
```

---

### Task 8: Минимальные цены WB — расчёт шаблона и напоминание (`@sync2/domain/wb-min-price`)

**Files:**
- Create: `packages/shared/src/wb-min.ts`, `packages/domain/src/wb-min-price.ts`, `packages/domain/src/wb-min-price.test.ts`
- Modify: `packages/shared/src/index.ts`, `packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/domain/src/wb-min-price.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { WbMinTemplateRow } from "@sync2/shared"
import { mskDate, planWbMinPrices, wbMinPriceRub, wbMinReminder } from "./wb-min-price"

const row = (r: number, nmId: number | null, discountedMinor: number | null, daysLeft: number | null = 30): WbMinTemplateRow => ({ row: r, nmId, vendorCode: nmId ? `JW-${nmId}` : null, discountedMinor, daysLeft })

describe("минимальная цена WB для шаблона", () => {
  it("вверх до рубля от цены × (1 − уступка): 9 164 → 8 248 (как 26.09), 5 000 → 4 500, 20 631,20 → 18 569; 0 % — сама цена", () => {
    expect(wbMinPriceRub(916400, 1000)).toBe(8248)
    expect(wbMinPriceRub(500000, 1000)).toBe(4500)
    expect(wbMinPriceRub(2063120, 1000)).toBe(18569)
    expect(wbMinPriceRub(916400, 0)).toBe(9164)
    expect(() => wbMinPriceRub(916400, 10_000)).toThrow(RangeError)
    expect(() => wbMinPriceRub(0, 1000)).toThrow(RangeError)
  })

  it("по прайсу с уступкой карточки; без прайса — от цены со скидкой −10 %; выше цены со скидкой — пропуск; без артикула/цены — пропуск", () => {
    const agreed = new Map([
      [259678801, { priceMinor: 916400, concessionBp: 1000 }],
      [300, { priceMinor: 1000000, concessionBp: 0 }],
    ])
    const plan = planWbMinPrices([row(2, 258921133, 500000), row(3, 259678801, 916400, 3), row(4, 300, 900000), row(5, null, 100000), row(6, 400, null, null), row(7, 259678801, 916400)], agreed)
    expect(plan.fills).toEqual([
      { row: 2, nmId: 258921133, minRub: 4500, source: "wb-price" },
      { row: 3, nmId: 259678801, minRub: 8248, source: "agreed" },
    ])
    expect(plan.skips.map((s) => [s.row, s.reason.slice(0, 22)])).toEqual([
      [4, "мин. цена 10000 ₽ выше"],
      [5, "нет артикула WB"],
      [6, "нет прайса и цены со с"],
      [7, "артикул повторяется в "],
    ])
    expect(plan.blockRows).toEqual([2, 3, 4, 6])
    expect(plan.minDaysLeft).toBe(3)
  })
})

describe("напоминание о шаблоне WB", () => {
  const expiresAt = "2026-10-26T09:36:00.000Z"
  const none = { agreed: 0, autoactions: 0 }
  it("за 6 дней до конца — с 09:00 МСК, раз в МСК-сутки; раньше — только при изменениях; срок неизвестен — «неизвестно»", () => {
    expect(wbMinReminder({ now: new Date("2026-10-20T06:05:00.000Z"), expiresAt, remindedOn: null, changes: none })).toEqual({ kind: "expiry", daysLeft: 6 })
    expect(wbMinReminder({ now: new Date("2026-10-20T05:30:00.000Z"), expiresAt, remindedOn: null, changes: none })).toBeNull()
    expect(wbMinReminder({ now: new Date("2026-10-20T15:00:00.000Z"), expiresAt, remindedOn: "2026-10-20", changes: none })).toBeNull()
    expect(wbMinReminder({ now: new Date("2026-10-19T06:05:00.000Z"), expiresAt, remindedOn: null, changes: none })).toBeNull()
    expect(wbMinReminder({ now: new Date("2026-10-19T06:05:00.000Z"), expiresAt, remindedOn: null, changes: { agreed: 2, autoactions: 1 } })).toEqual({ kind: "changes", agreed: 2, autoactions: 1 })
    expect(wbMinReminder({ now: new Date("2026-10-27T06:05:00.000Z"), expiresAt, remindedOn: "2026-10-26", changes: none })).toEqual({ kind: "expiry", daysLeft: -1 })
    expect(wbMinReminder({ now: new Date("2026-10-19T06:05:00.000Z"), expiresAt: null, remindedOn: null, changes: none })).toEqual({ kind: "unknown" })
  })

  it("МСК-дата: 20.10 21:30 UTC — уже 21.10", () => {
    expect(mskDate(new Date("2026-10-20T06:05:00.000Z"))).toBe("2026-10-20")
    expect(mskDate(new Date("2026-10-20T21:30:00.000Z"))).toBe("2026-10-21")
  })
})
```
Run: `npx vitest run packages/domain/src/wb-min-price.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `packages/shared/src/wb-min.ts`:
```ts
/** Строка шаблона ЛК WB «Минимальная цена для автоакций» (этап 3), как её прочитал адаптер. */
export interface WbMinTemplateRow {
  /** Номер строки листа (1 — заголовок). */
  row: number
  nmId: number | null
  vendorCode: string | null
  /** «Цена со скидкой», копейки; null — пусто или не число. */
  discountedMinor: number | null
  /** «Текущая минимальная цена … (осталось N дней)» → N; null — мин. цены нет или срок не указан. */
  daysLeft: number | null
}
```
`packages/shared/src/index.ts` — `export * from "./wb-min"`.

`packages/domain/src/wb-min-price.ts`:
```ts
// Минимальные цены WB для автоакций (этап 3, решение 25.09 п. 12; спека §6: ceil_руб(прайс × (1 − уступка))).
// API у WB нет — синк считает столбец «Новая минимальная цена» скачанного из ЛК шаблона; грузит человек.
import { BP, formatRub, type WbMinTemplateRow } from "@sync2/shared"

/** Уступка по умолчанию — для карточек без прайса (26.09: −10 % на все 382). */
export const WB_DEFAULT_CONCESSION_BP = 1000
/** Мин. цена из шаблона действует 30 дней после загрузки (ЛК, факт 26.09 → 26.10). */
export const WB_MIN_VALID_DAYS = 30
/** Напоминать за столько дней до конца (26.10 → 20.10) и каждый день после. */
export const WB_MIN_REMIND_BEFORE_DAYS = 6
export const WB_MIN_REMIND_FROM_MSK_HOUR = 9
const DAY_MS = 86_400_000
const MSK_MS = 3 * 60 * 60 * 1000

/** Целые рубли, вверх: ЛК принимает мин. цену целым числом. */
export function wbMinPriceRub(priceMinor: number, concessionBp: number): number {
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) throw new RangeError(`цена не копейки > 0: ${priceMinor}`)
  if (!Number.isInteger(concessionBp) || concessionBp < 0 || concessionBp >= BP) throw new RangeError(`уступка вне [0, 100 %): ${concessionBp} bp`)
  return Math.ceil((priceMinor * (BP - concessionBp)) / (BP * 100))
}

export interface WbMinFill {
  row: number
  nmId: number
  minRub: number
  source: "agreed" | "wb-price"
}

export interface WbMinSkip {
  row: number
  nmId: number | null
  reason: string
}

export interface WbMinPlan {
  fills: WbMinFill[]
  skips: WbMinSkip[]
  /** Строки, где блокировка ставится «Нет» (все строки с артикулом, первая по каждому). */
  blockRows: number[]
  minDaysLeft: number | null
}

export function planWbMinPrices(rows: readonly WbMinTemplateRow[], agreed: ReadonlyMap<number, { priceMinor: number; concessionBp: number }>): WbMinPlan {
  const plan: WbMinPlan = { fills: [], skips: [], blockRows: [], minDaysLeft: null }
  const seen = new Set<number>()
  for (const r of rows) {
    if (r.nmId === null) {
      plan.skips.push({ row: r.row, nmId: null, reason: "нет артикула WB" })
      continue
    }
    if (seen.has(r.nmId)) {
      plan.skips.push({ row: r.row, nmId: r.nmId, reason: "артикул повторяется в файле — заполнена первая строка" })
      continue
    }
    seen.add(r.nmId)
    plan.blockRows.push(r.row)
    if (r.daysLeft !== null && (plan.minDaysLeft === null || r.daysLeft < plan.minDaysLeft)) plan.minDaysLeft = r.daysLeft
    const a = agreed.get(r.nmId)
    const hasPrice = r.discountedMinor !== null && r.discountedMinor > 0
    let fill: WbMinFill
    if (a) fill = { row: r.row, nmId: r.nmId, minRub: wbMinPriceRub(a.priceMinor, a.concessionBp), source: "agreed" }
    else if (hasPrice) fill = { row: r.row, nmId: r.nmId, minRub: wbMinPriceRub(r.discountedMinor!, WB_DEFAULT_CONCESSION_BP), source: "wb-price" }
    else {
      plan.skips.push({ row: r.row, nmId: r.nmId, reason: "нет прайса и цены со скидкой" })
      continue
    }
    if (hasPrice && fill.minRub * 100 > r.discountedMinor!) {
      plan.skips.push({ row: r.row, nmId: r.nmId, reason: `мин. цена ${fill.minRub} ₽ выше цены со скидкой ${formatRub(r.discountedMinor!)} — WB сейчас ниже прайса (вопрос сторожа)` })
      continue
    }
    plan.fills.push(fill)
  }
  return plan
}

export type WbMinReminder = { kind: "expiry"; daysLeft: number } | { kind: "unknown" } | { kind: "changes"; agreed: number; autoactions: number }

export interface WbMinReminderInput {
  now: Date
  expiresAt: string | null
  /** МСК-дата последнего напоминания (ГГГГ-ММ-ДД). */
  remindedOn: string | null
  /** Изменения прайса/уступки и признанные автоакции после последнего заполнения или напоминания о них. */
  changes: { agreed: number; autoactions: number }
}

/** ГГГГ-ММ-ДД по Москве. */
export function mskDate(d: Date): string {
  return new Date(d.getTime() + MSK_MS).toISOString().slice(0, 10)
}

/** Одно напоминание в МСК-сутки, с 09:00: срок (≤ 6 дней, и после истечения), неизвестный срок, изменения. */
export function wbMinReminder(i: WbMinReminderInput, remindBeforeDays: number = WB_MIN_REMIND_BEFORE_DAYS): WbMinReminder | null {
  if (new Date(i.now.getTime() + MSK_MS).getUTCHours() < WB_MIN_REMIND_FROM_MSK_HOUR) return null
  if (i.remindedOn === mskDate(i.now)) return null
  if (i.expiresAt === null) return { kind: "unknown" }
  const daysLeft = Math.floor((Date.parse(i.expiresAt) - i.now.getTime()) / DAY_MS)
  if (daysLeft <= remindBeforeDays) return { kind: "expiry", daysLeft }
  if (i.changes.agreed + i.changes.autoactions > 0) return { kind: "changes", agreed: i.changes.agreed, autoactions: i.changes.autoactions }
  return null
}
```
`packages/domain/src/index.ts` — `export * from "./wb-min-price"`.

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/domain/src/wb-min-price.test.ts && npm run typecheck
git add packages/shared/src/wb-min.ts packages/shared/src/index.ts packages/domain/src/wb-min-price.ts packages/domain/src/wb-min-price.test.ts packages/domain/src/index.ts
git commit -m "sync2: минимальные цены WB — прайс минус уступка вверх до рубля, без прайса от цены WB, напоминание за 6 дней"
```

---

### Task 9: WB — шаблон ЛК: чтение и заполнение двух столбцов (`wb/min-price-template.ts`, exceljs)

**Files:**
- Create: `packages/platforms/src/wb/min-price-template.ts`, `packages/platforms/src/wb/min-price-template.test.ts`
- Modify: `packages/platforms/package.json`, `package-lock.json`, `packages/platforms/src/index.ts`

- [ ] **Step 1: Зависимость.**
```bash
npx -y npm@11.16.0 install exceljs@4.4.0 --save-exact -w @sync2/platforms
```
Expected: в `packages/platforms/package.json` — `"exceljs": "4.4.0"`; `package-lock.json` обновлён.

- [ ] **Step 2: Падающий тест** — `packages/platforms/src/wb/min-price-template.test.ts`:
```ts
import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"
import { WB_MIN_ALL_HEADERS, WB_MIN_SHEET, fillWbMinTemplate, readWbMinTemplate, wbMinTemplateSkeleton } from "./min-price-template"

const rows = [
  { nmId: 258921133, vendorCode: "JW-NB-AGT-M-0001", discounted: 5000, currentMin: "4500 (осталось 30 дней)" },
  { nmId: 259678801, vendorCode: "JW-NB-AGT-M-0002", discounted: "9164", currentMin: "8248 (осталось 3 дней)" },
  { nmId: 263616667, vendorCode: "JW-NB-AGT-M-0005", discounted: "", currentMin: "" },
]
const xlsx = async (wb: ExcelJS.Workbook) => new Uint8Array(await wb.xlsx.writeBuffer())

describe("шаблон ЛК WB «Минимальная цена для автоакций»", () => {
  it("читает артикул, цену со скидкой (числом или строкой) и «осталось N дней»", async () => {
    const r = await readWbMinTemplate(await wbMinTemplateSkeleton(rows))
    expect(r.errors).toEqual([])
    expect(r.rows).toEqual([
      { row: 2, nmId: 258921133, vendorCode: "JW-NB-AGT-M-0001", discountedMinor: 500000, daysLeft: 30 },
      { row: 3, nmId: 259678801, vendorCode: "JW-NB-AGT-M-0002", discountedMinor: 916400, daysLeft: 3 },
      { row: 4, nmId: 263616667, vendorCode: "JW-NB-AGT-M-0005", discountedMinor: null, daysLeft: null },
    ])
  })

  it("не шаблон — ошибка текстом: не xlsx, нет листа среди нескольких, нет столбцов", async () => {
    expect((await readWbMinTemplate(new TextEncoder().encode("не файл"))).errors[0]).toContain("не xlsx")
    const two = new ExcelJS.Workbook()
    two.addWorksheet("Лист1").addRow(["Артикул WB"])
    two.addWorksheet("Лист2")
    expect((await readWbMinTemplate(await xlsx(two))).errors[0]).toContain("нет листа")
    const one = new ExcelJS.Workbook()
    one.addWorksheet("Что-то").addRow(["Артикул WB", "Цена со скидкой"])
    expect((await readWbMinTemplate(await xlsx(one))).errors[0]).toContain("нет столбцов")
  })

  it("заполняет только K и M; заголовок, прочие ячейки и проверка данных M не меняются", async () => {
    const out = await fillWbMinTemplate(await wbMinTemplateSkeleton(rows), { mins: new Map([[2, 4500], [3, 8248]]), blockRows: [2, 3, 4], block: "Нет" })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(Buffer.from(out) as unknown as ArrayBuffer)
    const ws = wb.getWorksheet(WB_MIN_SHEET)!
    expect(ws.getRow(1).values).toEqual([undefined, ...WB_MIN_ALL_HEADERS])
    expect([2, 3, 4].map((r) => [ws.getRow(r).getCell(11).value ?? null, ws.getRow(r).getCell(13).value])).toEqual([
      [4500, "Нет"],
      [8248, "Нет"],
      [null, "Нет"],
    ])
    expect(ws.getRow(3).getCell(9).value).toBe("9164")
    expect(ws.getRow(3).getCell(10).value).toBe("8248 (осталось 3 дней)")
    expect(ws.getCell("M4").dataValidation).toMatchObject({ type: "list", formulae: ['"Нет,7 дней,30 дней,Бессрочно"'] })
  })
})
```
Run: `npx vitest run packages/platforms/src/wb/min-price-template.test.ts` → FAIL (нет модуля).

- [ ] **Step 3: Реализация** (проверено 29.09 в песочнице на шаблоне ЛК 26.09: 382 строки, 382 правила проверки после записи) — `packages/platforms/src/wb/min-price-template.ts`:
```ts
// Шаблон ЛК WB «Минимальные цены и блокировки для автоакций» (этап 3; API у WB нет — Цены и скидки → Обновить через
// Excel). Синк меняет только два столбца — новая мин. цена (K) и новая блокировка (M); остальное в файле не трогается.
import ExcelJS from "exceljs"
import type { Cell, Worksheet } from "exceljs"
import { decimalStringToMinor, type WbMinTemplateRow } from "@sync2/shared"

export const WB_MIN_SHEET = "Минимальная цена для автоакций"
/** Заголовок шаблона ЛК целиком (факт 26.09) — для скелета в тестах. */
export const WB_MIN_ALL_HEADERS = [
  "Бренд",
  "Категория",
  "Артикул WB",
  "Артикул продавца",
  "Последний баркод",
  "Остатки WB",
  "Остатки продавца",
  "Оборачиваемость",
  "Цена со скидкой",
  "Текущая минимальная цена для применения скидки по автоакции",
  "Новая минимальная цена для применения скидки по автоакции, RUB",
  "Текущая блокировка применения скидки по автоакции",
  "Новая блокировка применения скидки по автоакции",
] as const
/** Столбцы, которые синк читает или пишет, — ищутся по заголовку, а не по букве. */
export const WB_MIN_HEADERS = {
  nmId: "Артикул WB",
  vendorCode: "Артикул продавца",
  discounted: "Цена со скидкой",
  currentMin: "Текущая минимальная цена для применения скидки по автоакции",
  newMin: "Новая минимальная цена для применения скидки по автоакции, RUB",
  newBlock: "Новая блокировка применения скидки по автоакции",
} as const
type HeaderKey = keyof typeof WB_MIN_HEADERS
type Columns = Record<HeaderKey, number>
/** Шаблон ЛК ≈ 35 КБ на 382 строки; больше 5 МБ — не он. */
export const WB_TEMPLATE_MAX_BYTES = 5 * 1024 * 1024

export interface WbMinTemplateRead {
  rows: WbMinTemplateRow[]
  errors: string[]
}

function cellText(c: Cell): string {
  const v = c.value
  if (v === null || v === undefined) return ""
  if (typeof v === "number") return String(v)
  return c.text.trim()
}

async function open(bytes: Uint8Array): Promise<{ wb: ExcelJS.Workbook; ws: Worksheet; cols: Columns } | { error: string }> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer)
  } catch (e: unknown) {
    return { error: `не xlsx: ${e instanceof Error ? e.message : String(e)}` }
  }
  const ws = wb.getWorksheet(WB_MIN_SHEET) ?? (wb.worksheets.length === 1 ? wb.worksheets[0] : undefined)
  if (!ws) return { error: `нет листа «${WB_MIN_SHEET}»` }
  const byTitle = new Map<string, number>()
  ws.getRow(1).eachCell((c, col) => byTitle.set(cellText(c), col))
  const cols: Partial<Columns> = {}
  const missing: string[] = []
  for (const [k, title] of Object.entries(WB_MIN_HEADERS) as Array<[HeaderKey, string]>) {
    const col = byTitle.get(title)
    if (col === undefined) missing.push(title)
    else cols[k] = col
  }
  if (missing.length > 0) return { error: `в заголовке нет столбцов: ${missing.join("; ")}` }
  return { wb, ws, cols: cols as Columns }
}

export async function readWbMinTemplate(bytes: Uint8Array): Promise<WbMinTemplateRead> {
  const o = await open(bytes)
  if ("error" in o) return { rows: [], errors: [o.error] }
  const rows: WbMinTemplateRow[] = []
  for (let r = 2; r <= o.ws.rowCount; r++) {
    const row = o.ws.getRow(r)
    const nmText = cellText(row.getCell(o.cols.nmId))
    const vendor = cellText(row.getCell(o.cols.vendorCode))
    if (nmText === "" && vendor === "") continue
    const nm = /^\d+$/.test(nmText) ? Number(nmText) : Number.NaN
    const priceText = cellText(row.getCell(o.cols.discounted)).replace(",", ".").replace(/\s/g, "")
    const days = /осталось\s+(\d+)\s+д/.exec(cellText(row.getCell(o.cols.currentMin)))
    rows.push({
      row: r,
      nmId: Number.isSafeInteger(nm) && nm > 0 ? nm : null,
      vendorCode: vendor || null,
      discountedMinor: /^\d+(\.\d+)?$/.test(priceText) ? decimalStringToMinor(priceText) : null,
      daysLeft: days ? Number(days[1]) : null,
    })
  }
  return { rows, errors: [] }
}

/** Записать мин. цены (строка → целые рубли) и блокировку в указанные строки; остальное — как было. */
export async function fillWbMinTemplate(bytes: Uint8Array, fill: { mins: ReadonlyMap<number, number>; blockRows: readonly number[]; block: string }): Promise<Uint8Array> {
  const o = await open(bytes)
  if ("error" in o) throw new Error(`шаблон WB: ${o.error}`)
  for (const [r, rub] of fill.mins) o.ws.getRow(r).getCell(o.cols.newMin).value = rub
  for (const r of fill.blockRows) o.ws.getRow(r).getCell(o.cols.newBlock).value = fill.block
  return new Uint8Array(await o.wb.xlsx.writeBuffer())
}

/** Шаблон той же формы (13 столбцов, проверка данных блокировки) — для тестов синка, не для ЛК. */
export async function wbMinTemplateSkeleton(rows: ReadonlyArray<{ nmId: number; vendorCode: string; discounted: string | number; currentMin: string }>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(WB_MIN_SHEET)
  ws.addRow([...WB_MIN_ALL_HEADERS])
  for (const r of rows) ws.addRow(["KOTELNIKOVARTIFACT", "Браслеты", r.nmId, r.vendorCode, "2041383032873", 0, 2, 0, r.discounted, r.currentMin, null, "Нет", null])
  for (let i = 2; i <= rows.length + 1; i++) ws.getCell(`M${i}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"Нет,7 дней,30 дней,Бессрочно"'] }
  return new Uint8Array(await wb.xlsx.writeBuffer())
}
```
`packages/platforms/src/index.ts` — добавить:
```ts
export {
  WB_MIN_ALL_HEADERS,
  WB_MIN_HEADERS,
  WB_MIN_SHEET,
  WB_TEMPLATE_MAX_BYTES,
  fillWbMinTemplate,
  readWbMinTemplate,
  wbMinTemplateSkeleton,
  type WbMinTemplateRead,
} from "./wb/min-price-template"
```

- [ ] **Step 4: Прогон на настоящем шаблоне и коммит.**
```bash
npx vitest run packages/platforms/src/wb/min-price-template.test.ts && npm run typecheck && npm test
cat > wbmin-check.ts <<'TS'
import { readFileSync } from "node:fs"
import { readWbMinTemplate } from "./packages/platforms/src/wb/min-price-template"
const r = await readWbMinTemplate(new Uint8Array(readFileSync(process.argv[2]!)))
console.log(r.errors, r.rows.length, r.rows.filter((x) => x.nmId === null).length, r.rows.filter((x) => x.discountedMinor === null).length, Math.min(...r.rows.map((x) => x.daysLeft ?? 99)))
TS
npx tsx wbmin-check.ts "$HOME/Мой диск/Шаблон обновления минимальной цены и блокировки автоакций 26.09.2026 12.36.xlsx"; rm wbmin-check.ts
git add packages/platforms/package.json package-lock.json packages/platforms/src/wb/min-price-template.ts packages/platforms/src/wb/min-price-template.test.ts packages/platforms/src/index.ts
git commit -m "sync2: WB — шаблон ЛК минимальных цен: чтение по заголовкам, запись только K и M (exceljs 4.4.0)"
```
Expected проверки: `[] 382 0 0 30` (382 строки, у всех артикул и цена, срок 30 дней на момент скачивания 26.09; проверено при написании плана).

---

### Task 10: Состояние шаблона WB, заполнение из базы, CLI `wb-min-prices`

**Files:**
- Create: `apps/worker/src/wb-min.ts`, `apps/worker/src/wb-min.test.ts`, `apps/worker/src/wb-min.db.test.ts`
- Modify: `packages/db/src/agreed-prices.ts`, `apps/worker/src/cli-guards.ts`

- [ ] **Step 1: Падающие тесты.** `apps/worker/src/wb-min.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { EMPTY_WB_MIN_STATE, changesSinceMark, dateMsk, markUploaded, parseAt, wbMinReminderText } from "./wb-min"

describe("состояние шаблона WB", () => {
  it("загрузка — срок +30 дней; дата без времени — полночь МСК; мусор — null", () => {
    const s = markUploaded(EMPTY_WB_MIN_STATE, new Date("2026-09-26T09:36:00.000Z"), "Минас")
    expect(s).toMatchObject({ uploadedAt: "2026-09-26T09:36:00.000Z", expiresAt: "2026-10-26T09:36:00.000Z", uploadedBy: "Минас" })
    expect(parseAt("2026-09-26")!.toISOString()).toBe("2026-09-25T21:00:00.000Z")
    expect(parseAt("2026-09-26T09:36:00Z")!.toISOString()).toBe("2026-09-26T09:36:00.000Z")
    expect(parseAt("вчера")).toBeNull()
  })

  it("изменения считаются от позднего из «заполнено» и «напомнено об изменениях»", () => {
    expect(changesSinceMark({ ...EMPTY_WB_MIN_STATE, lastFillAt: "2026-10-01T00:00:00.000Z", changesNotifiedAt: "2026-10-05T00:00:00.000Z" })).toBe("2026-10-05T00:00:00.000Z")
    expect(changesSinceMark(EMPTY_WB_MIN_STATE)).toBeNull()
  })

  it("тексты напоминаний: срок, истёк, неизвестен, изменения — и как прислать шаблон", () => {
    const s = { ...EMPTY_WB_MIN_STATE, expiresAt: "2026-10-26T09:36:00.000Z" }
    expect(wbMinReminderText({ kind: "expiry", daysLeft: 6 }, s)).toContain("истекают 26.10 12:36 МСК (через 6 дн.)")
    expect(wbMinReminderText({ kind: "expiry", daysLeft: -1 }, s)).toContain("истекли")
    expect(wbMinReminderText({ kind: "unknown" }, s)).toContain("wb-min-prices uploaded")
    expect(wbMinReminderText({ kind: "changes", agreed: 2, autoactions: 1 }, s)).toContain("у 2 карточек, автоакций признано 1")
    expect(wbMinReminderText({ kind: "unknown" }, s)).toContain("ответом на это сообщение")
    expect(dateMsk(new Date("2026-10-20T21:30:00.000Z"))).toBe("21.10.2026")
  })
})
```
`apps/worker/src/wb-min.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { agreedChangesSince, answerDecision, autoactionsSince, finishDecision, loadAgreedPrices, openDecisionReturningId, setAgreedConcession, setAgreedPrice } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb } from "@sync2/db/test-db"
import { readWbMinTemplate, wbMinTemplateSkeleton } from "@sync2/platforms"
import { buildWbMinFill } from "./wb-min"

describe.skipIf(!TEST_DATABASE_URL)("шаблон WB из базы", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
    await setAgreedPrice(h.db, { nmId: 259678801, barcode: "2041383032873", priceMinor: 916400, source: "import", approvedBy: "тест", reason: null })
    await setAgreedPrice(h.db, { nmId: 300, barcode: "B300", priceMinor: 1000000, source: "import", approvedBy: "тест", reason: null })
  })
  afterAll(async () => h?.close())

  it("по прайсу 8 248, без прайса от цены WB 4 500; прайс без строки в файле — в замечаниях; не шаблон — отказ", async () => {
    const src = await wbMinTemplateSkeleton([
      { nmId: 258921133, vendorCode: "JW-NB-AGT-M-0001", discounted: 5000, currentMin: "4500 (осталось 5 дней)" },
      { nmId: 259678801, vendorCode: "JW-NB-AGT-M-0002", discounted: "9164", currentMin: "8248 (осталось 5 дней)" },
    ])
    const r = await buildWbMinFill(h.db, src, new Date("2026-10-20T06:10:00.000Z"))
    if (!r.ok) throw new Error(r.error)
    expect(r.payload).toEqual({ fileName: "Минимальные цены WB — заполнено 20.10.2026.xlsx", filledAt: "2026-10-20T06:10:00.000Z", filled: 2, byAgreed: 1, byWbPrice: 1, skipped: 0, minDaysLeft: 5 })
    expect(r.plan.fills.map((f) => [f.nmId, f.minRub])).toEqual([
      [258921133, 4500],
      [259678801, 8248],
    ])
    expect(r.skipsText).toContain("прайс есть, а строки в файле нет: 1")
    expect((await readWbMinTemplate(r.out)).rows).toHaveLength(2)
    expect(await buildWbMinFill(h.db, new TextEncoder().encode("x"), new Date())).toMatchObject({ ok: false })
  })

  it("после момента: уступка — изменение карточки (с историей), признанная автоакция — отдельно", async () => {
    // После прайсов beforeAll: их строки истории старше — считается только уступка ниже.
    const since = new Date().toISOString()
    await setAgreedConcession(h.db, { nmId: 259678801, concessionBp: 0, approvedBy: "тест", reason: "коллекционный" })
    expect(await agreedChangesSince(h.db, since)).toBe(1)
    expect((await loadAgreedPrices(h.db)).get(259678801)).toMatchObject({ priceMinor: 916400, concessionBp: 0 })
    await expect(setAgreedConcession(h.db, { nmId: 999, concessionBp: 0, approvedBy: "тест", reason: "x" })).rejects.toThrow(/прайса nm 999 нет/)
    const id = await openDecisionReturningId(
      h.db,
      { kind: "wb_price_drift", subject: "259678801", payload: { nmId: 259678801, vendorCode: null, title: null, agreedMinor: 916400, observedMinor: 850000, priceRub: 15800, discountPct: 46 } },
      null,
    )
    await answerDecision(h.db, id!, "autoaction", { id: null, name: "тест" }, new Date().toISOString())
    await finishDecision(h.db, id!, "done", "автоакция", new Date().toISOString(), ["answered"])
    expect(await autoactionsSince(h.db, since)).toBe(1)
  })
})
```
Run: `npx vitest run apps/worker/src/wb-min.test.ts` → FAIL (нет модуля); `npm run test:db -- apps/worker/src/wb-min.db.test.ts` → FAIL.

- [ ] **Step 2: База.** `packages/db/src/agreed-prices.ts`: в импорт `drizzle-orm` добавить `countDistinct, gt`; дописать:
```ts
/** Карточки, у которых прайс или уступка менялись после момента (по истории) — напоминание о шаблоне WB. */
export async function agreedChangesSince(db: Db, sinceIso: string): Promise<number> {
  const [r] = await db.select({ n: countDistinct(history.nmId) }).from(history).where(gt(history.createdAt, sinceIso))
  return r?.n ?? 0
}

/**
 * Уступка WB карточки для минимальной цены (решение 25.09, п. 12: по товару, коллекционным можно 0 %). Строка истории —
 * с тем же прайсом; источник прайса и кто его утвердил не меняются. Прайса нет — ошибка.
 */
export async function setAgreedConcession(db: Db, a: { nmId: number; concessionBp: number; approvedBy: string; reason: string }): Promise<{ prevConcessionBp: number }> {
  if (!Number.isInteger(a.concessionBp) || a.concessionBp < 0 || a.concessionBp >= 10_000) throw new RangeError(`уступка вне [0, 100 %): ${a.concessionBp} bp`)
  return db.transaction(async (tx) => {
    const [cur] = await tx.select().from(agreedPrices).where(eq(agreedPrices.nmId, a.nmId)).for("update")
    if (!cur) throw new Error(`прайса nm ${a.nmId} нет — уступка задаётся только к прайсу`)
    await tx.insert(history).values({
      nmId: a.nmId,
      priceMinor: cur.priceMinor,
      prevPriceMinor: cur.priceMinor,
      concessionBp: a.concessionBp,
      source: "cli",
      approvedBy: a.approvedBy,
      reason: a.reason,
    })
    await tx.update(agreedPrices).set({ concessionBp: a.concessionBp, updatedAt: new Date().toISOString() }).where(eq(agreedPrices.nmId, a.nmId))
    return { prevConcessionBp: cur.concessionBp }
  })
}
```

- [ ] **Step 3: Состояние и заполнение.** `apps/worker/src/wb-min.ts`:
```ts
// Шаблон минимальных цен WB (этап 3): состояние в sync_state (срок загрузки, последнее заполнение, напоминания),
// заполнение скачанного из ЛК файла по прайсу из базы, тексты напоминаний. Общее для бота и CLI.
import { agreedChangesSince, autoactionsSince, getState, loadAgreedPrices, setState, type Db } from "@sync2/db"
import { WB_MIN_VALID_DAYS, planWbMinPrices, type WbMinPlan, type WbMinReminder } from "@sync2/domain"
import { fillWbMinTemplate, readWbMinTemplate } from "@sync2/platforms"
import type { WbMinTemplatePayload } from "@sync2/shared"
import { formatMsk } from "./jobs/compare-v1"

export const WB_MIN_STATE_KEY = "wb-min:state"
/** Блокировка применения скидки по автоакции — «Нет» (решение 25.09, п. 12: без блокировки). */
export const WB_MIN_BLOCK = "Нет"
/** Ответ файлом на любое из стольких последних напоминаний — шаблон. */
export const WB_MIN_REQUESTS_KEPT = 5
const MAX_SKIPS_SHOWN = 20
const DAY_MS = 86_400_000

export interface WbMinState {
  /** Когда шаблон загружен в ЛК (кнопка или CLI). */
  uploadedAt: string | null
  /** До когда действуют мин. цены — загрузка + 30 дней. */
  expiresAt: string | null
  uploadedBy: string | null
  lastFillAt: string | null
  /** Сообщения бота с просьбой прислать шаблон. */
  requestMessageIds: number[]
  /** МСК-дата последнего напоминания. */
  remindedOn: string | null
  /** Когда последний раз напомнили об изменениях — следующие считаются от него. */
  changesNotifiedAt: string | null
}

export const EMPTY_WB_MIN_STATE: WbMinState = {
  uploadedAt: null,
  expiresAt: null,
  uploadedBy: null,
  lastFillAt: null,
  requestMessageIds: [],
  remindedOn: null,
  changesNotifiedAt: null,
}

export async function loadWbMinState(db: Db): Promise<WbMinState> {
  return { ...EMPTY_WB_MIN_STATE, ...((await getState<Partial<WbMinState>>(db, WB_MIN_STATE_KEY)) ?? {}) }
}

export async function saveWbMinState(db: Db, s: WbMinState): Promise<void> {
  await setState(db, WB_MIN_STATE_KEY, s)
}

export function markUploaded(s: WbMinState, at: Date, by: string): WbMinState {
  return { ...s, uploadedAt: at.toISOString(), expiresAt: new Date(at.getTime() + WB_MIN_VALID_DAYS * DAY_MS).toISOString(), uploadedBy: by }
}

/** `--at=ГГГГ-ММ-ДД` — полночь МСК (срок с запасом) или ISO-время; мусор — null. */
export function parseAt(raw: string): Date | null {
  const ms = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? Date.parse(`${raw}T00:00:00+03:00`) : Date.parse(raw)
  return Number.isFinite(ms) ? new Date(ms) : null
}

/** Изменения считаются от позднего из «заполнено» и «напомнили об изменениях». */
export function changesSinceMark(s: WbMinState): string | null {
  if (s.lastFillAt === null) return s.changesNotifiedAt
  if (s.changesNotifiedAt === null) return s.lastFillAt
  return s.lastFillAt > s.changesNotifiedAt ? s.lastFillAt : s.changesNotifiedAt
}

export async function wbMinChangesSince(db: Db, sinceIso: string | null): Promise<{ agreed: number; autoactions: number }> {
  if (sinceIso === null) return { agreed: 0, autoactions: 0 }
  return { agreed: await agreedChangesSince(db, sinceIso), autoactions: await autoactionsSince(db, sinceIso) }
}

const HOWTO =
  "Скачайте в ЛК WB: Цены и скидки → Обновить через Excel → «Минимальные цены и блокировки для автоакций» — и пришлите файл ответом на это сообщение: верну заполненный (мин. цена = прайс − уступка, по умолчанию 10 %; блокировка «Нет»)."

export function wbMinReminderText(r: WbMinReminder, s: WbMinState): string {
  switch (r.kind) {
    case "expiry":
      return [
        r.daysLeft >= 0
          ? `⏰ Минимальные цены WB истекают ${formatMsk(s.expiresAt!)} (через ${r.daysLeft} дн.)`
          : `🔴 Минимальные цены WB истекли ${formatMsk(s.expiresAt!)} — автоакции WB сейчас без нижней границы`,
        HOWTO,
      ].join("\n")
    case "unknown":
      return ["⚠️ Срок минимальных цен WB синку неизвестен.", HOWTO, "Или отметьте прошлую загрузку из терминала: wb-min-prices uploaded --at=<дата> --confirm"].join("\n")
    case "changes":
      return [`📝 После последнего заполнения шаблона прайс или уступка изменились у ${r.agreed} карточек, автоакций признано ${r.autoactions} — мин. цены WB по ним устарели.`, HOWTO].join("\n")
  }
}

/** ДД.ММ.ГГГГ по Москве — для имени файла. */
export function dateMsk(d: Date): string {
  const t = new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString()
  return `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`
}

export type WbMinFillResult =
  | { ok: true; out: Uint8Array; plan: WbMinPlan; payload: WbMinTemplatePayload; skipsText: string | null }
  | { ok: false; error: string }

/** Заполнить скачанный шаблон по прайсу из базы. Файл и база не меняются — только новый файл в ответе. */
export async function buildWbMinFill(db: Db, bytes: Uint8Array, now: Date): Promise<WbMinFillResult> {
  const read = await readWbMinTemplate(bytes)
  if (read.errors.length > 0) return { ok: false, error: read.errors.join("; ") }
  if (read.rows.length === 0) return { ok: false, error: "в шаблоне нет строк с артикулами" }
  const agreed = new Map([...(await loadAgreedPrices(db))].map(([nmId, a]) => [nmId, { priceMinor: a.priceMinor, concessionBp: a.concessionBp }]))
  const plan = planWbMinPrices(read.rows, agreed)
  const out = await fillWbMinTemplate(bytes, { mins: new Map(plan.fills.map((f) => [f.row, f.minRub])), blockRows: plan.blockRows, block: WB_MIN_BLOCK })
  const byAgreed = plan.fills.filter((f) => f.source === "agreed").length
  const inFile = new Set(read.rows.flatMap((r) => (r.nmId === null ? [] : [r.nmId])))
  const notInFile = [...agreed.keys()].filter((nmId) => !inFile.has(nmId)).length
  const lines = plan.skips.slice(0, MAX_SKIPS_SHOWN).map((s) => `стр. ${s.row}${s.nmId ? `, nm ${s.nmId}` : ""}: ${s.reason}`)
  if (plan.skips.length > MAX_SKIPS_SHOWN) lines.push(`… ещё ${plan.skips.length - MAX_SKIPS_SHOWN}`)
  if (notInFile > 0) lines.push(`прайс есть, а строки в файле нет: ${notInFile} — скачайте шаблон по всем товарам`)
  return {
    ok: true,
    out,
    plan,
    payload: {
      fileName: `Минимальные цены WB — заполнено ${dateMsk(now)}.xlsx`,
      filledAt: now.toISOString(),
      filled: plan.fills.length,
      byAgreed,
      byWbPrice: plan.fills.length - byAgreed,
      skipped: plan.skips.length,
      minDaysLeft: plan.minDaysLeft,
    },
    skipsText: lines.length > 0 ? lines.join("\n") : null,
  }
}
```

- [ ] **Step 4: CLI.** `apps/worker/src/cli-guards.ts`:
- импорты: `import { readFileSync, writeFileSync } from "node:fs"`; из `@sync2/db` — ещё `activeDecisionsOfKind, closeOpenOfKind, loadAgreedPrices, setAgreedConcession`; `import { wbMinPriceRub } from "@sync2/domain"`; `import { buildWbMinFill, changesSinceMark, loadWbMinState, markUploaded, parseAt, saveWbMinState, wbMinChangesSince } from "./wb-min"`;
- `GUARD_COMMANDS` — добавить `"wb-min-prices"`; `GUARD_FLAGS` — `"wb-min-prices": ["--out", "--at", "--confirm", "--reason"]`;
- в `GUARD_USAGE` дописать:
```
  wb-min-prices fill <шаблон.xlsx> [--out=<файл.xlsx>]
                         заполнить скачанный из ЛК WB шаблон мин. цен: K = прайс − уступка (вверх до ₽), M = «Нет»
  wb-min-prices uploaded [--at=<ГГГГ-ММ-ДД|ISO>] [--confirm]
                         отметить загрузку шаблона в ЛК: мин. цены WB действуют 30 дней от неё
  wb-min-prices status   срок мин. цен WB, последнее заполнение, изменения прайса после него
  wb-min-prices concession <nmId> <0..99> --reason=<причина> [--confirm]
                         уступка WB карточки, % (решение п. 12: коллекционным можно 0)
```
- в `switch` перед `default`: `case "wb-min-prices": return runWbMinCommand(db, arg, arg2, pos[3], flags)`;
- функция в том же файле:
```ts
const CLI_APPROVER = "владелец (CLI)"

async function runWbMinCommand(db: Db, sub: string | undefined, a1: string | undefined, a2: string | undefined, flags: readonly string[]): Promise<number> {
  const confirm = flags.includes("--confirm")
  const now = new Date()
  switch (sub) {
    case "fill": {
      if (!a1) {
        console.error("wb-min-prices fill <шаблон.xlsx> [--out=<файл.xlsx>]")
        return 2
      }
      const outPath = flagValue(flags, "--out") ?? `${a1.replace(/\.xlsx$/i, "")} — ЗАПОЛНЕН.xlsx`
      const r = await buildWbMinFill(db, new Uint8Array(readFileSync(a1)), now)
      if (!r.ok) {
        console.error(`шаблон не прочитан: ${r.error}`)
        return 2
      }
      writeFileSync(outPath, r.out)
      const p = r.payload
      console.log(`заполнено ${p.filled} (по прайсу ${p.byAgreed}, по цене WB ${p.byWbPrice}), пропущено ${p.skipped}; блокировка «Нет» — ${r.plan.blockRows.length}; самый короткий срок текущих мин. цен: ${p.minDaysLeft ?? "—"} дн.`)
      if (r.skipsText) console.log(r.skipsText)
      console.log(`файл: ${outPath}\nзагрузите в ЛК WB (Цены и скидки → Обновить через Excel → «Минимальные цены и блокировки для автоакций») и отметьте: wb-min-prices uploaded --confirm`)
      await saveWbMinState(db, { ...(await loadWbMinState(db)), lastFillAt: now.toISOString() })
      return 0
    }
    case "uploaded": {
      const raw = flagValue(flags, "--at")
      const at = raw === null ? now : parseAt(raw)
      if (!at) {
        console.error(`--at=<ГГГГ-ММ-ДД|ISO>, получено «${raw}»`)
        return 2
      }
      const next = markUploaded(await loadWbMinState(db), at, CLI_APPROVER)
      console.log(`загрузка ${formatMsk(next.uploadedAt!)} → мин. цены WB действуют до ${formatMsk(next.expiresAt!)}`)
      if (!confirm) {
        console.error("не записано: повторите с --confirm")
        return 2
      }
      await saveWbMinState(db, next)
      const closed = await closeOpenOfKind(db, "wb_min_template", "загрузка отмечена из терминала", now.toISOString())
      console.log(`записано${closed > 0 ? `; закрыто вопросов о файле: ${closed}` : ""}`)
      return 0
    }
    case "status": {
      const s = await loadWbMinState(db)
      const ch = await wbMinChangesSince(db, changesSinceMark(s))
      const left = s.expiresAt === null ? null : Math.floor((Date.parse(s.expiresAt) - now.getTime()) / 86_400_000)
      console.log(`срок мин. цен WB: ${s.expiresAt === null ? "неизвестен" : `${formatMsk(s.expiresAt)} (${left} дн.)`}; загрузка: ${s.uploadedAt === null ? "—" : `${formatMsk(s.uploadedAt)}, ${s.uploadedBy ?? "?"}`}`)
      console.log(`последнее заполнение: ${s.lastFillAt === null ? "—" : formatMsk(s.lastFillAt)}; после него прайс/уступка у ${ch.agreed} карточек, автоакций ${ch.autoactions}; напоминание: ${s.remindedOn ?? "—"}`)
      const waiting = (await activeDecisionsOfKind(db, "wb_min_template")).length
      if (waiting > 0) console.log(`файлов ждут отметки «Загрузил в ЛК»: ${waiting}`)
      return 0
    }
    case "concession": {
      const nmId = Number(a1)
      const reason = flagValue(flags, "--reason")
      if (!Number.isSafeInteger(nmId) || nmId <= 0 || !a2 || !/^\d{1,2}$/.test(a2) || !reason) {
        console.error("wb-min-prices concession <nmId> <0..99> --reason=<причина> [--confirm]")
        return 2
      }
      const pct = Number(a2)
      const cur = (await loadAgreedPrices(db)).get(nmId)
      if (!cur) {
        console.error(`прайса nm ${nmId} нет — уступка задаётся только к прайсу`)
        return 2
      }
      console.log(`nm ${nmId}: уступка ${cur.concessionBp / 100} % → ${pct} % (мин. цена ${wbMinPriceRub(cur.priceMinor, cur.concessionBp)} ₽ → ${wbMinPriceRub(cur.priceMinor, pct * 100)} ₽); причина: ${reason}`)
      if (!confirm) {
        console.error("не записано: повторите с --confirm")
        return 2
      }
      await setAgreedConcession(db, { nmId, concessionBp: pct * 100, approvedBy: CLI_APPROVER, reason })
      console.log("записано; новая мин. цена попадёт в ЛК со следующим шаблоном")
      return 0
    }
    default:
      console.error(`wb-min-prices fill|uploaded|status|concession${GUARD_USAGE}`)
      return 2
  }
}
```

- [ ] **Step 5: Прогон и коммит.**
```bash
npx vitest run apps/worker/src/wb-min.test.ts && npm run typecheck && npm test && npm run test:db
git add packages/db/src/agreed-prices.ts apps/worker/src/wb-min.ts apps/worker/src/wb-min.test.ts apps/worker/src/wb-min.db.test.ts apps/worker/src/cli-guards.ts
git commit -m "sync2: шаблон WB — состояние срока и заполнения, заполнение по прайсу из базы, уступка по карточке; CLI wb-min-prices"
```

---

### Task 11: Telegram — шаблон WB в боте: напоминание, приём файла ответом, файл с кнопкой «Загрузил в ЛК»

**Files:**
- Create: `apps/worker/src/jobs/bot-wb-min.ts`, `apps/worker/src/jobs/bot-wb-min.db.test.ts`
- Modify: `apps/worker/src/telegram.ts`, `apps/worker/src/telegram.test.ts`, `apps/worker/src/jobs/bot.ts`, `apps/worker/src/jobs/bot.db.test.ts`, `apps/worker/src/cli-prices.ts`

- [ ] **Step 1: Падающие тесты.** `apps/worker/src/telegram.test.ts` — дописать в `describe`:
```ts
  it("документ — multipart с именем, подписью, кнопками и ответом; скачивание — getFile, затем файл; подпись правится editMessageCaption", async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const f = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body })
      if (url.endsWith("/getFile")) return ok({ file_path: "documents/f.xlsx" })
      if (url.includes("/file/bot")) return new Response(new Uint8Array([1, 2, 3]))
      return ok({ message_id: 77 })
    }) as unknown as typeof fetch
    const tg = createTelegramApi("T", f)
    expect(await tg.sendDocument("-100", { name: "Мин. цены.xlsx", bytes: new Uint8Array([9]) }, { caption: "подпись", keyboard: [[{ text: "✅", callback_data: "d:1:u" }]], replyTo: 5 })).toBe(77)
    const form = calls[0]!.body as FormData
    expect(form.get("chat_id")).toBe("-100")
    expect(form.get("caption")).toBe("подпись")
    expect(JSON.parse(String(form.get("reply_markup")))).toEqual({ inline_keyboard: [[{ text: "✅", callback_data: "d:1:u" }]] })
    expect(JSON.parse(String(form.get("reply_parameters")))).toEqual({ message_id: 5, allow_sending_without_reply: true })
    expect((form.get("document") as unknown as { name: string }).name).toBe("Мин. цены.xlsx")
    expect(await tg.downloadFile("F1")).toEqual(new Uint8Array([1, 2, 3]))
    await tg.editMessageCaption("-100", 77, "итог")
    expect(calls.map((c) => c.url.replace("https://api.telegram.org", ""))).toEqual(["/botT/sendDocument", "/botT/getFile", "/file/botT/documents/f.xlsx", "/botT/editMessageCaption"])
  })
```
`apps/worker/src/jobs/bot.db.test.ts` — в `fakeTg` (объект `api`) дописать три метода, чтобы он оставался `TelegramApi`:
```ts
    async sendDocument() {
      return nextId++
    },
    async editMessageCaption(_chatId, messageId, text) {
      log.edited.push({ messageId, text })
    },
    async downloadFile() {
      return new Uint8Array()
    },
```
`apps/worker/src/jobs/bot-wb-min.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { activeDecisionsOfKind, decisionById, setAgreedPrice } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb } from "@sync2/db/test-db"
import { wbMinTemplateSkeleton } from "@sync2/platforms"
import type { InlineButton, TelegramApi, TgUpdate, TgUser } from "../telegram"
import { EMPTY_WB_MIN_STATE, loadWbMinState, saveWbMinState } from "../wb-min"
import { runBot } from "./bot"

const CHAT = "-1004395280612"
const MINAS = { id: 5710949139, first_name: "Минас" }
const STRANGER = { id: 42, first_name: "Чужой" }

function fakeTg(updates: TgUpdate[][] = [], file: Uint8Array = new Uint8Array()) {
  let nextId = 100
  const log = {
    sent: [] as Array<{ text: string; replyTo?: number }>,
    docs: [] as Array<{ name: string; caption?: string; keyboard?: InlineButton[][]; replyTo?: number }>,
    captions: [] as Array<{ messageId: number; caption: string }>,
    answers: [] as string[],
  }
  const api: TelegramApi = {
    async getUpdates() {
      return updates.shift() ?? []
    },
    async sendMessage(_chatId, text, opts = {}) {
      log.sent.push({ text, ...(opts.replyTo ? { replyTo: opts.replyTo } : {}) })
      return nextId++
    },
    async editMessageText() {},
    async answerCallbackQuery(_id, text) {
      log.answers.push(text)
    },
    async sendDocument(_chatId, f, opts = {}) {
      log.docs.push({ name: f.name, ...opts })
      return nextId++
    },
    async editMessageCaption(_chatId, messageId, caption) {
      log.captions.push({ messageId, caption })
    },
    async downloadFile() {
      return file
    },
  }
  return { api, log }
}
const doc = (updateId: number, from: TgUser, o: { replyTo?: number; caption?: string }): TgUpdate => ({
  update_id: updateId,
  message: {
    message_id: 500 + updateId,
    chat: { id: Number(CHAT) },
    from,
    document: { file_id: `F${updateId}`, file_name: "Шаблон.xlsx", file_size: 35_000 },
    ...(o.caption ? { caption: o.caption } : {}),
    ...(o.replyTo ? { reply_to_message: { message_id: o.replyTo } } : {}),
  },
})
const press = (updateId: number, from: TgUser, data: string, messageId: number): TgUpdate => ({
  update_id: updateId,
  callback_query: { id: `q${updateId}`, from, data, message: { message_id: messageId, chat: { id: Number(CHAT) } } },
})

describe.skipIf(!TEST_DATABASE_URL)("бот — шаблон минимальных цен WB", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let template: Uint8Array
  const bot = (tg: TelegramApi, at: string, polling = true) =>
    runBot({ db: h.db, tg, chatId: CHAT, approvers: new Set([MINAS.id]), now: () => new Date(at), pollTimeoutSec: 0, wbReturnEnabled: false, polling, wbMinReminders: true })
  beforeAll(async () => {
    h = await freshTestDb()
    await setAgreedPrice(h.db, { nmId: 259678801, barcode: "2041383032873", priceMinor: 916400, source: "import", approvedBy: "тест", reason: null })
    await saveWbMinState(h.db, { ...EMPTY_WB_MIN_STATE, uploadedAt: "2026-09-26T09:36:00.000Z", expiresAt: "2026-10-26T09:36:00.000Z" })
    template = await wbMinTemplateSkeleton([
      { nmId: 258921133, vendorCode: "JW-NB-AGT-M-0001", discounted: 5000, currentMin: "4500 (осталось 6 дней)" },
      { nmId: 259678801, vendorCode: "JW-NB-AGT-M-0002", discounted: "9164", currentMin: "8248 (осталось 6 дней)" },
    ])
  })
  afterAll(async () => h?.close())

  it("20.10 09:05 МСК — напоминание за 6 дней, одно в сутки", async () => {
    const first = fakeTg()
    expect(await bot(first.api, "2026-10-20T06:05:00.000Z", false)).toMatchObject({ wbMinReminded: 1 })
    expect(first.log.sent[0]!.text).toContain("истекают 26.10 12:36 МСК (через 6 дн.)")
    expect(await loadWbMinState(h.db)).toMatchObject({ remindedOn: "2026-10-20", requestMessageIds: [100] })
    const again = fakeTg()
    await bot(again.api, "2026-10-20T08:00:00.000Z", false)
    expect(again.log.sent).toEqual([])
  })

  it("чужой файл — отказ; файл не ответом и без /wbmin — не замечен", async () => {
    const { api, log } = fakeTg([[doc(1, STRANGER, { replyTo: 100 }), doc(2, MINAS, {})]], template)
    await bot(api, "2026-10-20T08:01:00.000Z")
    expect(log.sent).toEqual([{ text: "Шаблон принимается только от партнёров магазина", replyTo: 501 }])
    expect(log.docs).toEqual([])
  })

  it("файл ответом на напоминание — заполненный файл с кнопкой, вопрос открыт, отмечено заполнение", async () => {
    const { api, log } = fakeTg([[doc(3, MINAS, { replyTo: 100 })]], template)
    expect(await bot(api, "2026-10-20T08:02:00.000Z")).toMatchObject({ templateFilled: 1 })
    const [d] = await activeDecisionsOfKind(h.db, "wb_min_template")
    expect(d).toMatchObject({ kind: "wb_min_template", status: "open", tgMessageId: 100, payload: { filled: 2, byAgreed: 1, byWbPrice: 1, minDaysLeft: 6 } })
    expect(log.docs[0]).toMatchObject({ name: "Минимальные цены WB — заполнено 20.10.2026.xlsx", replyTo: 503, keyboard: [[{ text: "✅ Загрузил в ЛК", callback_data: `d:${d!.id}:u` }]] })
    expect(log.docs[0]!.caption).toContain("Строк с мин. ценой: 2")
    expect((await loadWbMinState(h.db)).lastFillAt).toBe("2026-10-20T08:02:00.000Z")
  })

  it("«Загрузил в ЛК» — срок +30 дней от нажатия, вопрос исполнен, под файлом — кто и когда", async () => {
    const [d] = await activeDecisionsOfKind(h.db, "wb_min_template")
    const { api, log } = fakeTg([[press(4, MINAS, `d:${d!.id}:u`, d!.tgMessageId!)]])
    await bot(api, "2026-10-20T09:00:00.000Z")
    expect(await loadWbMinState(h.db)).toMatchObject({ uploadedAt: "2026-10-20T09:00:00.000Z", expiresAt: "2026-11-19T09:00:00.000Z", uploadedBy: "Минас" })
    expect(await decisionById(h.db, d!.id)).toMatchObject({ status: "done", answer: "uploaded" })
    expect(log.captions[0]!.caption).toContain("Решено: Минас, 20.10 12:00 МСК — ✅ Загрузил в ЛК")
  })

  it("подпись /wbmin — тоже шаблон; новый файл закрывает прежний неотмеченный", async () => {
    const { api } = fakeTg([[doc(5, MINAS, { caption: "/wbmin@KotelnikovArtifactBot" })], [doc(6, MINAS, { caption: "/wbmin" })]], template)
    await bot(api, "2026-10-21T08:00:00.000Z")
    const [first] = await activeDecisionsOfKind(h.db, "wb_min_template")
    await bot(api, "2026-10-21T08:01:00.000Z")
    expect(await decisionById(h.db, first!.id)).toMatchObject({ status: "closed", result: "заменено новым заполнением" })
    expect(await activeDecisionsOfKind(h.db, "wb_min_template")).toHaveLength(1)
  })
})
```
Run: `npm run test:db -- apps/worker/src/jobs/bot-wb-min.db.test.ts` → FAIL.

- [ ] **Step 2: Telegram.** `apps/worker/src/telegram.ts`:
- типы сообщения:
```ts
export interface TgDocument {
  file_id: string
  file_name?: string
  file_size?: number
  mime_type?: string
}

export interface TgMessage {
  message_id: number
  chat: { id: number }
  from?: TgUser
  text?: string
  /** Подпись к файлу — в ней может быть команда (/wbmin). */
  caption?: string
  document?: TgDocument
  /** Ответ на сообщение: в режиме приватности бот видит в группе ответы на свои сообщения. */
  reply_to_message?: { message_id: number }
}
```
- в `TelegramApi` дописать:
```ts
  /** Файл в группу (multipart/form-data); вернуть message_id. */
  sendDocument(chatId: string, file: { name: string; bytes: Uint8Array }, opts?: { caption?: string; keyboard?: InlineButton[][]; replyTo?: number }): Promise<number>
  /** Правка подписи к документу; кнопки снимаются. «Не изменилось» — не ошибка. */
  editMessageCaption(chatId: string, messageId: number, caption: string): Promise<void>
  /** Присланный файл: getFile, затем сам файл по file_path. */
  downloadFile(fileId: string): Promise<Uint8Array>
```
- в `createTelegramApi` помощник `call` заменить на три (тексты ошибок — прежние):
```ts
  const post = async (method: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
    try {
      return await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (e: unknown) {
      throw new Error(`Telegram ${method}: сеть — ${e instanceof Error ? e.name : "ошибка"}`)
    }
  }
  const parse = async <T>(method: string, r: Response): Promise<T> => {
    const j = (await r.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null
    if (!r.ok || !j?.ok) throw new Error(`Telegram ${method}: ${r.status} ${j?.description ?? ""}`.trim())
    return j.result as T
  }
  const call = async <T>(method: string, body: unknown, timeoutMs: number): Promise<T> =>
    parse<T>(method, await post(method, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, timeoutMs))
```
- в возвращаемый объект дописать:
```ts
    sendDocument: async (chatId, file, opts = {}) => {
      const form = new FormData()
      form.append("chat_id", chatId)
      form.append("document", new Blob([file.bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), file.name)
      if (opts.caption) form.append("caption", opts.caption)
      if (opts.keyboard) form.append("reply_markup", JSON.stringify({ inline_keyboard: opts.keyboard }))
      if (opts.replyTo) form.append("reply_parameters", JSON.stringify({ message_id: opts.replyTo, allow_sending_without_reply: true }))
      return (await parse<{ message_id: number }>("sendDocument", await post("sendDocument", { body: form }, 30_000))).message_id
    },
    editMessageCaption: async (chatId, messageId, caption) => {
      try {
        await call("editMessageCaption", { chat_id: chatId, message_id: messageId, caption, reply_markup: { inline_keyboard: [] } }, 15_000)
      } catch (e: unknown) {
        if (!(e instanceof Error && e.message.includes("message is not modified"))) throw e
      }
    },
    downloadFile: async (fileId) => {
      const f = await call<{ file_path?: string }>("getFile", { file_id: fileId }, 15_000)
      if (!f.file_path) throw new Error("Telegram getFile: нет file_path")
      let r: Response
      try {
        r = await fetchImpl(`https://api.telegram.org/file/bot${token}/${f.file_path}`, { signal: AbortSignal.timeout(30_000) })
      } catch (e: unknown) {
        throw new Error(`Telegram файл: сеть — ${e instanceof Error ? e.name : "ошибка"}`)
      }
      if (!r.ok) throw new Error(`Telegram файл: ${r.status}`)
      return new Uint8Array(await r.arrayBuffer())
    },
```

- [ ] **Step 3: Бот.** `apps/worker/src/jobs/bot-wb-min.ts`:
```ts
// Шаблон минимальных цен WB в боте (этап 3): напоминание раз в сутки, приём скачанного шаблона ответом на напоминание
// (или с подписью /wbmin) от партнёра, заполненный файл с кнопкой «Загрузил в ЛК», отметка загрузки. На площадки не пишет.
import { closeOpenOfKind, decisionById, finishDecision, markDecisionSent, openDecisionReturningId, type DecisionRow } from "@sync2/db"
import { mskDate, wbMinReminder } from "@sync2/domain"
import { WB_TEMPLATE_MAX_BYTES } from "@sync2/platforms"
import { errorText } from "@sync2/shared"
import { decisionKeyboard, fullText } from "../decision-text"
import type { TgMessage } from "../telegram"
import {
  WB_MIN_REQUESTS_KEPT,
  buildWbMinFill,
  changesSinceMark,
  loadWbMinState,
  markUploaded,
  saveWbMinState,
  wbMinChangesSince,
  wbMinReminderText,
  type WbMinState,
} from "../wb-min"
import type { BotDeps } from "./bot"
import { formatMsk } from "./compare-v1"

/** Подпись к документу Telegram — до 1024 символов. */
export const CAPTION_MAX = 1024
type Add = (key: string) => void

async function safe(add: Add, call: () => Promise<unknown>): Promise<void> {
  try {
    await call()
  } catch {
    add("tgFailed")
  }
}

/** Файл — шаблон, если это ответ на напоминание бота или в подписи команда /wbmin. */
export function isTemplateMessage(m: TgMessage, s: WbMinState): boolean {
  if (!m.document) return false
  const replyTo = m.reply_to_message?.message_id
  return (replyTo !== undefined && s.requestMessageIds.includes(replyTo)) || /^\/wbmin(@\w+)?(\s|$)/.test((m.caption ?? "").trim())
}

export async function wbMinRemind(deps: BotDeps, add: Add): Promise<void> {
  const now = deps.now()
  const s = await loadWbMinState(deps.db)
  const r = wbMinReminder({ now, expiresAt: s.expiresAt, remindedOn: s.remindedOn, changes: await wbMinChangesSince(deps.db, changesSinceMark(s)) })
  if (!r) return
  let messageId: number
  try {
    messageId = await deps.tg.sendMessage(deps.chatId, wbMinReminderText(r, s))
  } catch {
    add("wbMinRemindFailed")
    return
  }
  await saveWbMinState(deps.db, {
    ...s,
    remindedOn: mskDate(now),
    requestMessageIds: [...s.requestMessageIds, messageId].slice(-WB_MIN_REQUESTS_KEPT),
    ...(r.kind === "changes" ? { changesNotifiedAt: now.toISOString() } : {}),
  })
  add("wbMinReminded")
}

export async function handleWbMinTemplate(deps: BotDeps, m: TgMessage, add: Add): Promise<void> {
  const reply = (text: string) => safe(add, () => deps.tg.sendMessage(deps.chatId, text, { replyTo: m.message_id }))
  const doc = m.document!
  if (!m.from || !deps.approvers.has(m.from.id)) {
    await reply("Шаблон принимается только от партнёров магазина")
    add("templateRejected")
    return
  }
  if (!/\.xlsx$/i.test(doc.file_name ?? "")) {
    await reply("Нужен файл .xlsx — шаблон «Минимальные цены и блокировки для автоакций» из ЛК WB")
    add("templateRejected")
    return
  }
  if ((doc.file_size ?? 0) > WB_TEMPLATE_MAX_BYTES) {
    await reply("Файл больше 5 МБ — это не шаблон минимальных цен WB")
    add("templateRejected")
    return
  }
  let bytes: Uint8Array
  try {
    bytes = await deps.tg.downloadFile(doc.file_id)
  } catch (e: unknown) {
    await reply(`Файл не скачался: ${errorText(e)} — пришлите ещё раз`)
    add("templateFailed")
    return
  }
  const now = deps.now()
  const nowIso = now.toISOString()
  const fill = await buildWbMinFill(deps.db, bytes, now)
  if (!fill.ok) {
    await reply(`Шаблон не прочитан: ${fill.error}`)
    add("templateFailed")
    return
  }
  await closeOpenOfKind(deps.db, "wb_min_template", "заменено новым заполнением", nowIso)
  const id = await openDecisionReturningId(deps.db, { kind: "wb_min_template", subject: `fill:${m.message_id}`, payload: fill.payload }, null)
  const d = id === null ? null : await decisionById(deps.db, id)
  if (!d) {
    add("templateDuplicate")
    return
  }
  let messageId: number
  try {
    messageId = await deps.tg.sendDocument(
      deps.chatId,
      { name: fill.payload.fileName, bytes: fill.out },
      { caption: fullText(d).slice(0, CAPTION_MAX), keyboard: decisionKeyboard(d, false), replyTo: m.message_id },
    )
  } catch (e: unknown) {
    await finishDecision(deps.db, d.id, "closed", `файл не отправлен в Telegram: ${errorText(e)}`, nowIso, ["open"])
    await reply("Заполненный файл не отправился — пришлите шаблон ещё раз")
    add("templateSendFailed")
    return
  }
  await markDecisionSent(deps.db, d.id, messageId, nowIso)
  if (fill.skipsText) await safe(add, () => deps.tg.sendMessage(deps.chatId, `Пропуски и замечания:\n${fill.skipsText}`, { replyTo: messageId }))
  await saveWbMinState(deps.db, { ...(await loadWbMinState(deps.db)), lastFillAt: nowIso })
  add("templateFilled")
}

/** «Загрузил в ЛК»: срок мин. цен WB = момент нажатия + 30 дней; вопрос исполнен сразу — на площадки ничего не пишется. */
export async function completeWbMinUpload(deps: BotDeps, d: DecisionRow): Promise<void> {
  const now = deps.now()
  const next = markUploaded(await loadWbMinState(deps.db), now, d.answeredByName ?? "?")
  await saveWbMinState(deps.db, next)
  await finishDecision(deps.db, d.id, "done", `мин. цены WB действуют до ${formatMsk(next.expiresAt!)} (30 дней от отметки)`, now.toISOString(), ["answered"])
}
```
`apps/worker/src/jobs/bot.ts`:
- импорты: из `@sync2/db` добавить `finishDecision, type DecisionRow`; `import { CAPTION_MAX, completeWbMinUpload, handleWbMinTemplate, isTemplateMessage, wbMinRemind } from "./bot-wb-min"`; `import { loadWbMinState } from "../wb-min"`; `import type { TelegramApi, TgCallbackQuery, TgUpdate } from "../telegram"` — как было;
- в `BotDeps` дописать:
```ts
  /** Напоминания о шаблоне минимальных цен WB (этап 3); крон — true, старые тесты бота — без них. */
  wbMinReminders?: boolean
```
- перед `runBot`:
```ts
/** Правка сообщения вопроса: у файла шаблона WB — подпись документа, у остальных — текст. */
export function editDecisionMessage(tg: TelegramApi, chatId: string, d: DecisionRow): Promise<void> {
  const text = fullText(d)
  return d.kind === "wb_min_template" ? tg.editMessageCaption(chatId, d.tgMessageId!, text.slice(0, CAPTION_MAX)) : tg.editMessageText(chatId, d.tgMessageId!, text)
}
```
- в цикле `unsentDecisions` первой строкой тела:
```ts
    if (d.kind === "wb_min_template") {
      // Файл уходит только вместе с документом (bot-wb-min): открытый без сообщения — сбой между записью и отправкой.
      await finishDecision(db, d.id, "closed", "файл не был отправлен — пришлите шаблон ещё раз", nowIso(), ["open"])
      continue
    }
```
- в цикле итогов `await tg.editMessageText(deps.chatId, d.tgMessageId!, fullText(d))` → `await editDecisionMessage(tg, deps.chatId, d)`;
- после цикла напоминаний:
```ts
  if (deps.wbMinReminders) {
    try {
      await wbMinRemind(deps, add)
    } catch {
      add("wbMinRemindFailed")
    }
  }
```
- `handleUpdate` — после `if (u.callback_query) …`:
```ts
  const m = u.message
  if (!m) return
  if (m.document && String(m.chat.id) === deps.chatId && isTemplateMessage(m, await loadWbMinState(deps.db))) return handleWbMinTemplate(deps, m, add)
```
(прежняя ветка `/id` — дальше без изменений, `m` уже объявлен);
- в `handleCallback` три последние строки (`await reply(\`Принято: …\`)`, правка сообщения, `add("answered")`) заменить на:
```ts
  if (answered.kind === "wb_min_template") {
    await completeWbMinUpload(deps, answered)
    add("wbMinUploaded")
  }
  await reply(`Принято: ${ANSWER_LABELS[parsed.answer]}`)
  const shownRow = (await decisionById(db, d.id)) ?? answered
  if (shownRow.tgMessageId) await tgSafe(add, () => editDecisionMessage(tg, deps.chatId, shownRow))
  add("answered")
```
`apps/worker/src/cli-prices.ts`, ветка `bot` — в `runBot({ … })` добавить `wbMinReminders: true,`.

- [ ] **Step 4: Прогон и коммит.**
```bash
npx vitest run apps/worker/src/telegram.test.ts && npm run typecheck && npm test && npm run test:db
git add apps/worker/src/telegram.ts apps/worker/src/telegram.test.ts apps/worker/src/jobs/bot-wb-min.ts apps/worker/src/jobs/bot-wb-min.db.test.ts apps/worker/src/jobs/bot.ts apps/worker/src/jobs/bot.db.test.ts apps/worker/src/cli-prices.ts
git commit -m "sync2: бот — шаблон мин. цен WB: напоминание за 6 дней, файл ответом → заполненный с кнопкой «Загрузил в ЛК», срок +30 дней"
```

---
### Task 12: Ozon — заявки «Хочу скидку»: чтение v2, sku → offer_id, одобрение и отклонение (`ozon/discount-tasks.ts`)

**Files:**
- Create: `packages/platforms/src/ozon/discount-tasks.ts`, `packages/platforms/src/ozon/discount-tasks.test.ts`
- Modify: `packages/platforms/src/writer.ts`, `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/platforms/src/ozon/discount-tasks.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { fetchOzonNewDiscountTasks, fetchOzonOffersBySku, mapOzonDiscountTasks, writeOzonDiscountTasks } from "./discount-tasks"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const cfg = { clientId: "5332036", apiKey: "k", retryDelaysMs: [0] }
afterEach(() => vi.unstubAllGlobals())

function stub(route: (path: string, body: Record<string, unknown>) => Response) {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      calls.push({ path, body })
      return route(path, body)
    }),
  )
  return calls
}
const task = (id: number) => ({ id, sku: 5125270344, name: "Браслет", requested_price: 10000, original_price: 15800, requested_quantity_max: 2, edited_till: "2026-10-02T09:00:00Z", end_at: "2026-10-09T09:00:00Z" })
const op = (taskId: number, action: "approve" | "decline", over: Partial<WriteOp> = {}): WriteOp => ({
  channel: "ozon",
  barcode: `B${taskId}`,
  field: "discount_task",
  before: 1149000,
  after: action === "approve" ? 1000000 : 1149000,
  externalSku: String(taskId),
  discountTask: { taskId, action, approvedMinor: action === "approve" ? 1000000 : null, quantityMin: 1, quantityMax: 2, decisionId: 1, comment: "" },
  ...over,
})

describe("заявки Ozon «Хочу скидку» — чтение", () => {
  it("разбор: id и sku обязательны, цена заявки > 0; пустая дата «0001-…» — null; количества нет — 1", () => {
    expect(
      mapOzonDiscountTasks([
        task(7),
        { ...task(8), id: "abc" },
        { ...task(9), requested_price: 0 },
        { ...task(10), edited_till: "0001-01-01T00:00:00Z", requested_quantity_max: null },
      ]),
    ).toEqual([
      { id: 7, sku: 5125270344, name: "Браслет", requestedMinor: 1000000, originalMinor: 1580000, quantityMax: 2, decideBy: "2026-10-02T09:00:00.000Z", endAt: "2026-10-09T09:00:00.000Z" },
      { id: 10, sku: 5125270344, name: "Браслет", requestedMinor: 1000000, originalMinor: 1580000, quantityMax: 1, decideBy: null, endAt: "2026-10-09T09:00:00.000Z" },
    ])
  })

  it("v2 только NEW, по 50, дальше — last_id последней заявки страницы", async () => {
    const calls = stub((_p, b) => json({ tasks: b.last_id === undefined ? Array.from({ length: 50 }, (_, i) => task(i + 1)) : [task(51), task(52)] }))
    expect(await fetchOzonNewDiscountTasks(cfg)).toHaveLength(52)
    expect(calls.map((c) => c.body)).toEqual([
      { status: "NEW", limit: 50 },
      { status: "NEW", limit: 50, last_id: 50 },
    ])
  })

  it("sku → offer_id и product_id: и основной sku, и sku источников", async () => {
    const calls = stub(() => json({ items: [{ id: 111, offer_id: "JW-NB-AGT-M-0002", sku: 5001, sources: [{ sku: 5002 }] }] }))
    const m = await fetchOzonOffersBySku(cfg, [5001, 5002, 5001])
    expect(calls[0]).toEqual({ path: "/v3/product/info/list", body: { sku: ["5001", "5002"] } })
    expect(m.get(5002)).toEqual({ offerId: "JW-NB-AGT-M-0002", productId: 111 })
    expect(m.get(5001)).toEqual({ offerId: "JW-NB-AGT-M-0002", productId: 111 })
  })
})

describe("заявки Ozon — ответ", () => {
  it("одобрение — цена заявки рублями и количество 1…запрошенное; отклонение — только id; оба успешны", async () => {
    const calls = stub(() => json({ result: { success_count: 1, fail_count: 0, fail_details: [] } }))
    const r = await writeOzonDiscountTasks(cfg, [op(7, "approve"), op(8, "decline")])
    expect(calls).toEqual([
      { path: "/v1/actions/discounts-task/approve", body: { tasks: [{ id: 7, approved_price: 10000, seller_comment: "", approved_quantity_min: 1, approved_quantity_max: 2 }] } },
      { path: "/v1/actions/discounts-task/decline", body: { tasks: [{ id: 8, seller_comment: "" }] } },
    ])
    expect(r.map((x) => [x.barcode, x.ok])).toEqual([
      ["B7", true],
      ["B8", true],
    ])
  })

  it("отказ по заявке — ошибка текстом Ozon; счёт не сходится — итог неизвестен; 500 — итог неизвестен; чужая операция — до сети", async () => {
    stub(() => json({ result: { success_count: 1, fail_count: 1, fail_details: [{ task_id: 9, error_for_user: "Заявка уже обработана" }] } }))
    const r = await writeOzonDiscountTasks(cfg, [op(7, "approve"), op(9, "approve")])
    expect(r.find((x) => x.barcode === "B9")).toMatchObject({ ok: false, uncertain: false, error: "Ozon: Заявка уже обработана" })
    expect(r.find((x) => x.barcode === "B7")).toMatchObject({ ok: true })
    stub(() => json({ result: { success_count: 0, fail_count: 0, fail_details: [] } }))
    expect((await writeOzonDiscountTasks(cfg, [op(7, "approve")]))[0]).toMatchObject({ ok: false, uncertain: true })
    stub(() => json({ message: "boom" }, 500))
    expect((await writeOzonDiscountTasks(cfg, [op(7, "decline")]))[0]).toMatchObject({ ok: false, uncertain: true })
    const calls = stub(() => json({}))
    const bad = await writeOzonDiscountTasks(cfg, [op(1, "approve", { field: "price" }), op(2, "approve", { discountTask: undefined })])
    expect(calls).toEqual([])
    expect(bad.every((x) => !x.ok && !x.uncertain)).toBe(true)
  })
})
```
Run: `npx vitest run packages/platforms/src/ozon/discount-tasks.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `packages/platforms/src/writer.ts` — после `OzonTimerDetail`:
```ts
/** Ответ на заявку Ozon «Хочу скидку» (этап 3). */
export interface OzonDiscountDetail {
  taskId: number
  action: "approve" | "decline"
  /** approve — одобряемая цена (цена заявки), копейки; decline — null. */
  approvedMinor: number | null
  quantityMin: number
  quantityMax: number
  /** Вопрос, чей ответ исполняется. */
  decisionId: number
  comment: string
}
```
и в `WriteOp` после `timer?`:
```ts
  /** Только field = "discount_task" (этап 3). */
  discountTask?: OzonDiscountDetail
```
`packages/platforms/src/ozon/discount-tasks.ts`:
```ts
// Заявки Ozon «Хочу скидку» (этап 3, решение 25.09 п. 13: в Telegram с нетто, в ЛК не одобрять). Чтение —
// v2/actions/discounts-task/list (v1 устаревает): только NEW, по 50, last_id; offer_id в v2 нет — sku → offer_id через
// v3/product/info/list. Ответ — v1/actions/discounts-task/approve|decline (заявки NEW/SEEN).
import { errorText, minorToRub, rubToMinor } from "@sync2/shared"
import { requestJson, requestJsonWithMeta } from "../http"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { BASE, ozonAuth, type OzonCredentials } from "./client"

const V2_LIMIT = 50
const MAX_PAGES = 20
const SKU_BATCH = 1000
export const OZON_TASKS_BATCH = 50

export interface OzonDiscountTask {
  id: number
  sku: number
  name: string | null
  /** Цена по заявке — её одобряет кнопка. */
  requestedMinor: number
  originalMinor: number | null
  quantityMax: number
  /** До какого момента Ozon ждёт решения (edited_till). */
  decideBy: string | null
  endAt: string | null
}

interface V2Task {
  id?: number | string | null
  sku?: number | string | null
  name?: string | null
  requested_price?: number | null
  original_price?: number | null
  requested_quantity_max?: number | string | null
  edited_till?: string | null
  end_at?: string | null
}

const isoOrNull = (s: string | null | undefined): string | null => {
  const ms = typeof s === "string" && s.trim() !== "" ? Date.parse(s) : Number.NaN
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null
}

export function mapOzonDiscountTasks(rows: readonly V2Task[]): OzonDiscountTask[] {
  const out: OzonDiscountTask[] = []
  for (const t of rows) {
    const id = Number(t.id)
    const sku = Number(t.sku)
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(sku) || sku <= 0) continue
    if (typeof t.requested_price !== "number" || !(t.requested_price > 0)) continue
    const qty = Number(t.requested_quantity_max)
    out.push({
      id,
      sku,
      name: t.name ?? null,
      requestedMinor: rubToMinor(t.requested_price),
      originalMinor: typeof t.original_price === "number" && t.original_price > 0 ? rubToMinor(t.original_price) : null,
      quantityMax: Number.isSafeInteger(qty) && qty > 0 ? qty : 1,
      decideBy: isoOrNull(t.edited_till),
      endAt: isoOrNull(t.end_at),
    })
  }
  return out
}

export async function fetchOzonNewDiscountTasks(cfg: OzonCredentials): Promise<OzonDiscountTask[]> {
  const all: V2Task[] = []
  let lastId: number | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<{ tasks?: V2Task[] | null }>("ozon", `${BASE}/v2/actions/discounts-task/list`, {
      ...ozonAuth(cfg),
      method: "POST",
      body: { status: "NEW", limit: V2_LIMIT, ...(lastId !== undefined ? { last_id: lastId } : {}) },
    })
    const tasks = body.tasks ?? []
    all.push(...tasks)
    const last = Number(tasks.at(-1)?.id)
    if (tasks.length < V2_LIMIT || !Number.isSafeInteger(last) || last === lastId) return mapOzonDiscountTasks(all)
    lastId = last
  }
  throw new Error(`Ozon заявки на скидку: больше ${MAX_PAGES} страниц — список неполный`)
}

interface ProductInfoItem {
  id?: number | string | null
  offer_id?: string | null
  sku?: number | string | null
  sources?: Array<{ sku?: number | string | null }> | null
}

export async function fetchOzonOffersBySku(cfg: OzonCredentials, skus: readonly number[]): Promise<Map<number, { offerId: string; productId: number }>> {
  const out = new Map<number, { offerId: string; productId: number }>()
  for (const batch of chunk([...new Set(skus)], SKU_BATCH)) {
    const body = await requestJson<{ items?: ProductInfoItem[] | null }>("ozon", `${BASE}/v3/product/info/list`, { ...ozonAuth(cfg), method: "POST", body: { sku: batch.map(String) } })
    for (const it of body.items ?? []) {
      const productId = Number(it.id)
      if (!it.offer_id || !Number.isSafeInteger(productId) || productId <= 0) continue
      for (const s of [it.sku, ...(it.sources ?? []).map((x) => x.sku)]) {
        const n = Number(s)
        if (Number.isSafeInteger(n) && n > 0 && !out.has(n)) out.set(n, { offerId: it.offer_id, productId })
      }
    }
  }
  return out
}

interface ApproveDeclineResponse {
  result?: {
    success_count?: number | null
    fail_count?: number | null
    fail_details?: Array<{ task_id?: number | string | null; error_for_user?: string | null }> | null
  } | null
}

export async function writeOzonDiscountTasks(cfg: OzonCredentials & { retryDelaysMs?: number[] }, ops: WriteOp[]): Promise<SendResult[]> {
  const results: SendResult[] = []
  const approve: WriteOp[] = []
  const decline: WriteOp[] = []
  for (const op of ops) {
    const t = op.discountTask
    if (op.field !== "discount_task" || !t) results.push(failed(op, "Ozon: нет данных заявки — запись невозможна"))
    else if (t.action === "approve" && (t.approvedMinor === null || t.approvedMinor <= 0)) results.push(failed(op, "Ozon: одобрение без цены"))
    else (t.action === "approve" ? approve : decline).push(op)
  }
  const plan: Array<[string, WriteOp[]]> = [
    ["/v1/actions/discounts-task/approve", approve],
    ["/v1/actions/discounts-task/decline", decline],
  ]
  for (const [path, list] of plan) {
    for (const batch of chunk(list, OZON_TASKS_BATCH)) {
      const tasks = batch.map((o) => {
        const t = o.discountTask!
        return t.action === "approve"
          ? { id: t.taskId, approved_price: minorToRub(t.approvedMinor!), seller_comment: t.comment, approved_quantity_min: t.quantityMin, approved_quantity_max: t.quantityMax }
          : { id: t.taskId, seller_comment: t.comment }
      })
      let body: ApproveDeclineResponse
      try {
        body = (
          await requestJsonWithMeta<ApproveDeclineResponse>("ozon", `${BASE}${path}`, {
            ...ozonAuth(cfg),
            method: "POST",
            body: { tasks },
            retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
            timeoutMs: WRITE_TIMEOUT_MS,
            maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS,
          })
        ).body
      } catch (e: unknown) {
        for (const o of batch) results.push(failed(o, `Ozon: заявка не обработана — ${errorText(e)}`, { uncertain: isUncertain(e) }))
        continue
      }
      const fails = new Map((body.result?.fail_details ?? []).map((f) => [Number(f.task_id), f.error_for_user ?? "отказ без текста"]))
      const success = body.result?.success_count
      const accounted = typeof success === "number" && success + fails.size === batch.length
      for (const o of batch) {
        const err = fails.get(o.discountTask!.taskId)
        if (err !== undefined) results.push(failed(o, `Ozon: ${err}`, { response: body.result ?? null }))
        else if (accounted) results.push(succeeded(o, body.result))
        else results.push(failed(o, "Ozon: итог по заявке не назван", { response: body.result ?? null, uncertain: true }))
      }
    }
  }
  return results
}
```
`packages/platforms/src/index.ts` — добавить:
```ts
export {
  fetchOzonNewDiscountTasks,
  fetchOzonOffersBySku,
  mapOzonDiscountTasks,
  writeOzonDiscountTasks,
  OZON_TASKS_BATCH,
  type OzonDiscountTask,
} from "./ozon/discount-tasks"
```

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/platforms/src/ozon/discount-tasks.test.ts && npm run typecheck && npm test
git add packages/platforms/src/writer.ts packages/platforms/src/ozon/discount-tasks.ts packages/platforms/src/ozon/discount-tasks.test.ts packages/platforms/src/index.ts
git commit -m "sync2: Ozon — заявки «Хочу скидку»: v2 NEW по last_id, sku → offer_id, одобрение по цене заявки и отклонение с итогом по заявке"
```

---

### Task 13: Нетто заявки и новые/пропавшие заявки (`@sync2/domain/discount-task`)

**Files:**
- Create: `packages/domain/src/discount-task.ts`, `packages/domain/src/discount-task.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/domain/src/discount-task.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { assessDiscountTask, diffDiscountTasks } from "./discount-task"

describe("нетто заявки Ozon против WB", () => {
  it("браслет 9 164 ₽ (WB 44 %), Ozon 55 %: нетто WB 5 131,84, порог 11 404,09; заявка 10 000 → нетто 4 500", () => {
    expect(assessDiscountTask({ requestedMinor: 1000000, agreedMinor: 916400, takeWbBp: 4400, takeOzonBp: 5500 })).toEqual({ netRequestedMinor: 450000, netWbMinor: 513184, thresholdMinor: 1140409 })
  })

  it("нет прайса или ставки WB — нетто WB и порога нет; ставка Ozon ≥ 100 % — как нет ставки", () => {
    expect(assessDiscountTask({ requestedMinor: 1000000, agreedMinor: null, takeWbBp: 4400, takeOzonBp: 5500 })).toEqual({ netRequestedMinor: 450000, netWbMinor: null, thresholdMinor: null })
    expect(assessDiscountTask({ requestedMinor: 1000000, agreedMinor: 916400, takeWbBp: 4400, takeOzonBp: 10_100 })).toEqual({ netRequestedMinor: null, netWbMinor: 513184, thresholdMinor: null })
  })

  it("новые — которых не спрашивали никогда (повтор в списке — один раз); пропавшие — открытые вопросы, чьей заявки нет в NEW", () => {
    expect(diffDiscountTasks([1, 2, 2, 3], new Set(["1"]), [{ id: 10, taskId: 1 }, { id: 11, taskId: 9 }])).toEqual({ fresh: [2, 3], gone: [11] })
  })
})
```
Run: `npx vitest run packages/domain/src/discount-task.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `packages/domain/src/discount-task.ts`:
```ts
// Заявка Ozon «Хочу скидку» (этап 3, решение 25.09 п. 13): нетто по цене заявки против нетто WB от прайса (равное
// нетто — п. 9). Порог — цена Ozon, с которой нетто равно WB (он же min_price этапа 2).
import { BP, applyDiscountBp, grossUpBp } from "@sync2/shared"

export interface DiscountAssessment {
  netRequestedMinor: number | null
  netWbMinor: number | null
  thresholdMinor: number | null
}

export function assessDiscountTask(i: { requestedMinor: number; agreedMinor: number | null; takeWbBp: number | null; takeOzonBp: number | null }): DiscountAssessment {
  const takeOzon = i.takeOzonBp !== null && i.takeOzonBp >= 0 && i.takeOzonBp < BP ? i.takeOzonBp : null
  const netWb = i.agreedMinor !== null && i.agreedMinor > 0 && i.takeWbBp !== null ? applyDiscountBp(i.agreedMinor, i.takeWbBp) : null
  return {
    netRequestedMinor: takeOzon === null ? null : applyDiscountBp(i.requestedMinor, takeOzon),
    netWbMinor: netWb,
    thresholdMinor: netWb === null || takeOzon === null ? null : grossUpBp(netWb, takeOzon),
  }
}

/** Новые заявки (не спрашивали ни разу — subject вопроса = id заявки) и открытые вопросы, чьей заявки больше нет в NEW. */
export function diffDiscountTasks(taskIds: readonly number[], known: ReadonlySet<string>, open: ReadonlyArray<{ id: number; taskId: number }>): { fresh: number[]; gone: number[] } {
  const inList = new Set(taskIds)
  const fresh = [...inList].filter((id) => !known.has(String(id)))
  return { fresh, gone: open.filter((d) => !inList.has(d.taskId)).map((d) => d.id) }
}
```
`packages/domain/src/index.ts` — `export * from "./discount-task"`.

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/domain/src/discount-task.test.ts && npm run typecheck
git add packages/domain/src/discount-task.ts packages/domain/src/discount-task.test.ts packages/domain/src/index.ts
git commit -m "sync2: нетто заявки Ozon против нетто WB от прайса, порог равного нетто; новые и пропавшие заявки"
```

---

### Task 14: Джоба `ozon-tasks` — вопросы по заявкам, исполнение ответов; срок заявки в боте; `ozon-guard tasks`

**Files:**
- Create: `apps/worker/src/jobs/ozon-tasks.ts`, `apps/worker/src/jobs/ozon-tasks.db.test.ts`
- Modify: `apps/worker/src/guard-senders.ts`, `apps/worker/src/guard-senders.test.ts`, `apps/worker/src/jobs/bot.ts`, `apps/worker/src/jobs/bot.db.test.ts`, `apps/worker/src/cli-guards.ts`

- [ ] **Step 1: Падающие тесты.** `apps/worker/src/jobs/ozon-tasks.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { activeDecisionsOfKind, answerDecision, channels, decisionById, insertStockSnapshot, loadChannels, seedChannels, setAgreedPrice, upsertProducts, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { OzonDiscountTask, SendResult, WriteOp } from "@sync2/platforms"
import type { Channel, MirrorPrice, WriteMode } from "@sync2/shared"
import { loadPricingConfig } from "../pricing-config"
import { runOzonTasks, type OzonTaskSources } from "./ozon-tasks"

const OFFER = "JW-NB-AGT-M-0002"
const BARCODE = "2041383032873"
const at = (min: number) => new Date(Date.parse("2026-10-01T09:14:00.000Z") + min * 60_000)
const t = (id: number): OzonDiscountTask => ({ id, sku: 5125270344, name: "Браслет", requestedMinor: 1000000, originalMinor: 1580000, quantityMax: 2, decideBy: "2026-10-02T09:00:00.000Z", endAt: null })
const livePrice: MirrorPrice = { channel: "ozon", externalSku: OFFER, priceMinor: 1149000, baseMinor: 1580000, minMinor: 1140500, takeBp: 5500, vat: "0" }
const sources = (tasks: OzonDiscountTask[] | Error): OzonTaskSources => ({
  tasks: async () => {
    if (tasks instanceof Error) throw tasks
    return tasks
  },
  offersBySku: async () => new Map([[5125270344, { offerId: OFFER, productId: 111 }]]),
  prices: async () => [livePrice],
})
const okSend = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true })))

describe.skipIf(!TEST_DATABASE_URL)("runOzonTasks", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let n = 0
  const nextRun = async () => {
    const id = `00000000-0000-4000-8000-${String(7400 + ++n).padStart(12, "0")}`
    await insertRun(h.db, id)
    return id
  }
  const guard = (m: WriteMode) => h.db.update(channels).set({ guardWriteMode: m }).where(eq(channels.code, "ozon"))
  const job = async (minute: number, src: OzonTaskSources, send = okSend()) => {
    const runId = await nextRun()
    const r = await runOzonTasks({ db: h.db, now: () => at(minute), runId, globalMode: "apply", config: loadPricingConfig(), sources: src, send })
    return { r, send, runId }
  }
  const openOf = async (taskId: number) => (await activeDecisionsOfKind(h.db, "ozon_discount_task")).find((d) => d.subject === String(taskId))!
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await upsertProducts(h.db, [{ barcode: BARCODE, vendorCode: OFFER, nmId: 259678801, title: "Браслет «Мудрость Будды»", subject: "Браслеты" }])
    await setAgreedPrice(h.db, { nmId: 259678801, barcode: BARCODE, priceMinor: 916400, source: "import", approvedBy: "тест", reason: null })
    await insertStockSnapshot(h.db, { channelId: (await loadChannels(h.db)).get("ozon")!.id, runId: await nextRun(), takenAt: "2026-10-01T09:11:00.000Z", stocks: [{ barcode: BARCODE, externalSku: OFFER, quantity: 2, warehouse: null }] })
  })
  afterAll(async () => h?.close())

  it("новая заявка — вопрос с нетто (живая ставка Ozon 55 %, WB 44 % по предмету); та же заявка — не спрашивается снова", async () => {
    const { r } = await job(0, sources([t(777)]))
    expect(r.counters).toMatchObject({ tasksNew: 1, tasksOpened: 1 })
    expect((await openOf(777)).payload).toMatchObject({
      taskId: 777,
      offerId: OFFER,
      barcode: BARCODE,
      nmId: 259678801,
      currentMinor: 1149000,
      netRequestedMinor: 450000,
      netWbMinor: 513184,
      thresholdMinor: 1140409,
      agreedMinor: 916400,
      decideBy: "2026-10-02T09:00:00.000Z",
    })
    expect((await job(30, sources([t(777)]))).r.counters.tasksOpened ?? 0).toBe(0)
  })

  it("заявка пропала из NEW — вопрос закрыт; чтение упало — partial, ничего не закрыто", async () => {
    const failedRead = await job(59, sources(new Error("сеть")))
    expect(failedRead.r).toMatchObject({ status: "partial", counters: { tasksReadFailed: 1 } })
    expect((await openOf(777)).status).toBe("open")
    const id = (await openOf(777)).id
    expect((await job(60, sources([]))).r.counters.tasksClosed).toBe(1)
    expect(await decisionById(h.db, id)).toMatchObject({ status: "closed", result: "заявка больше не новая — истекла, отозвана или решена в ЛК" })
  })

  it("ответ при защитах off — не исполнен, в сеть ни шагу", async () => {
    await guard("off")
    await job(90, sources([t(778)]))
    const d = await openOf(778)
    await answerDecision(h.db, d.id, "approve", { id: 5710949139, name: "Минас" }, at(91).toISOString())
    const { r, send } = await job(120, sources([t(778)]))
    expect(send).not.toHaveBeenCalled()
    expect(r.counters.tasksModeOff).toBe(1)
    expect((await decisionById(h.db, d.id))!.result).toContain("запись защит Ozon — off")
  })

  it("apply: одобрить — по цене заявки, 1…2 шт.; отклонить — цена не меняется; журнал discount_task; второй ключ — task:<id>", async () => {
    await guard("apply")
    await job(150, sources([t(779), t(780)]))
    const a = await openOf(779)
    const b = await openOf(780)
    await answerDecision(h.db, a.id, "approve", { id: 5710949139, name: "Минас" }, at(151).toISOString())
    await answerDecision(h.db, b.id, "decline", { id: 5710949139, name: "Минас" }, at(151).toISOString())
    const { r, send, runId } = await job(180, sources([]))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![1].map((o) => [o.barcode, o.discountTask?.action, o.discountTask?.approvedMinor, o.discountTask?.quantityMax])).toEqual([
      [BARCODE, "approve", 1000000, 2],
      ["task:780", "decline", null, 2],
    ])
    expect(r.counters).toMatchObject({ tasksApproved: 1, tasksDeclined: 1 })
    expect((await decisionById(h.db, a.id))!.result).toBe("Ozon: заявка одобрена по 10 000,00 ₽")
    expect((await decisionById(h.db, b.id))!.result).toBe("Ozon: заявка отклонена")
    const rows = await h.db.select().from(writes).where(eq(writes.runId, runId))
    expect(rows.map((w) => [w.field, w.externalSku, w.before, w.after, w.applied]).sort()).toEqual([
      ["discount_task", "779", 1149000, 1000000, true],
      ["discount_task", "780", 1149000, 1149000, true],
    ])
  })
})
```
`apps/worker/src/guard-senders.test.ts` — дописать в тест: `await expect(send("ozon", [op("discount_task")])).resolves.toEqual([expect.objectContaining({ ok: false })])` (операция без `discountTask` отклоняется отправителем Ozon до сети).
`apps/worker/src/jobs/bot.db.test.ts` — новый `describe` в конец файла:
```ts
describe.skipIf(!TEST_DATABASE_URL)("runBot — заявки Ozon", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  const runId = "00000000-0000-4000-8000-000000005201"
  const payload = {
    taskId: 777,
    sku: 5125270344,
    offerId: "JW-NB-AGT-M-0002",
    barcode: "2041383032873",
    nmId: 259678801,
    title: "Браслет",
    requestedMinor: 1000000,
    currentMinor: 1149000,
    quantityMax: 2,
    netRequestedMinor: 450000,
    netWbMinor: 513184,
    thresholdMinor: 1140409,
    agreedMinor: 916400,
    decideBy: "2026-10-02T09:00:00.000Z",
    endAt: null,
  }
  const bot = (tg: TelegramApi, at: string, ozonTasksEnabled: boolean) =>
    runBot({ db: h.db, tg, chatId: CHAT, approvers: new Set([MINAS.id]), now: () => new Date(at), pollTimeoutSec: 0, wbReturnEnabled: false, ozonTasksEnabled, polling: true })
  beforeAll(async () => {
    h = await freshTestDb()
    await insertRun(h.db, runId)
    await openDecisions(h.db, [{ kind: "ozon_discount_task", subject: "777", payload }], runId)
  })
  afterAll(async () => h?.close())

  it("защиты не в apply — вопрос без кнопок, нажатие «одобрить» — отказ; за 2 ч до срока — напоминание один раз", async () => {
    const first = fakeTg()
    await bot(first.api, "2026-10-01T09:15:00.000Z", false)
    expect(first.log.sent[0]!.keyboard).toEqual([])
    const [d] = await activeDecisions(h.db)
    const second = fakeTg([[press(30, MINAS, `d:${d!.id}:o`, d!.tgMessageId!)]])
    await bot(second.api, "2026-10-01T09:16:00.000Z", false)
    expect(second.log.answers[0]).toEqual({ text: "Запись защит Ozon выключена — ответить на заявку сейчас нельзя", alert: true })
    const near = fakeTg()
    await bot(near.api, "2026-10-02T07:30:00.000Z", false)
    expect(near.log.sent).toEqual([expect.objectContaining({ replyTo: d!.tgMessageId, text: expect.stringContaining("Заявка Ozon #777") })])
    const again = fakeTg()
    await bot(again.api, "2026-10-02T08:00:00.000Z", false)
    expect(again.log.sent).toEqual([])
  })

  it("защиты в apply — нажатие «одобрить» принимается", async () => {
    const [d] = await activeDecisions(h.db)
    const { api, log } = fakeTg([[press(31, MINAS, `d:${d!.id}:o`, d!.tgMessageId!)]])
    await bot(api, "2026-10-02T08:10:00.000Z", true)
    expect(log.answers[0]).toEqual({ text: "Принято: ✅ Одобрить заявку", alert: false })
    expect(await decisionById(h.db, d!.id)).toMatchObject({ status: "answered", answer: "approve" })
  })
})
```
Run: `npm run test:db -- apps/worker/src/jobs/ozon-tasks.db.test.ts apps/worker/src/jobs/bot.db.test.ts` → FAIL.

- [ ] **Step 2: Отправитель и бот.** `apps/worker/src/guard-senders.ts`: импорт `writeOzonDiscountTasks`; перед `throw new Error(\`защиты: ${field} — не поле защит\`)`:
```ts
    if (field === "discount_task") return writeOzonDiscountTasks(cfg.ozon, ops)
```
`apps/worker/src/jobs/bot.ts`: импорт из `@sync2/db` — ещё `activeDecisionsOfKind, isOzonTaskDecision`; из `../decision-text` — ещё `deadlineReminderDue`; после цикла 24-часовых напоминаний:
```ts
  // Заявка Ozon: Ozon ждёт решения до edited_till — за 2 ч до срока напомнить (сутки — слишком поздно).
  for (const d of (await activeDecisionsOfKind(db, "ozon_discount_task")).filter(isOzonTaskDecision)) {
    if (!deadlineReminderDue(d, deps.now())) continue
    try {
      await tg.sendMessage(deps.chatId, reminderText(d), { replyTo: d.tgMessageId! })
      await markReminded(db, d.id, nowIso())
      add("reminded")
    } catch {
      add("remindFailed")
    }
  }
```

- [ ] **Step 3: Джоба** — `apps/worker/src/jobs/ozon-tasks.ts`:
```ts
import { assessDiscountTask, diffDiscountTasks } from "@sync2/domain"
import {
  activeDecisions,
  activeDecisionsOfKind,
  decisionSubjects,
  drizzleWriteStore,
  finishDecision,
  isOzonTaskDecision,
  latestStockSnapshots,
  loadAgreedPrices,
  loadChannels,
  loadProducts,
  openDecisions,
  type Db,
  type NewDecision,
  type OzonTaskDecisionRow,
} from "@sync2/db"
import { WriteJournalError, effectiveMode, executeWrites, type OzonDiscountTask, type Sender, type WriteOp, type WriteOutcome } from "@sync2/platforms"
import { errorText, formatRub, type MirrorPrice, type WriteMode } from "@sync2/shared"
import type { PricingConfig } from "../pricing-config"
import { guardModesOf, type GuardJobResult } from "./ozon-timers"

export const OZON_TASKS_JOB = "ozon-tasks"
/** Новых вопросов за прогон — не больше; остальные — следующим прогоном (через 30 мин). */
export const MAX_TASK_QUESTIONS_PER_RUN = 20

export interface OzonTaskSources {
  tasks: () => Promise<OzonDiscountTask[]>
  offersBySku: (skus: number[]) => Promise<Map<number, { offerId: string; productId: number }>>
  /** Цены Ozon этапа 2 (v5): текущая цена и живая ставка товара. */
  prices: () => Promise<MirrorPrice[]>
}

export interface OzonTasksDeps {
  db: Db
  now: () => Date
  runId: string
  globalMode: WriteMode
  config: PricingConfig
  sources: OzonTaskSources
  send: Sender
  maxQuestions?: number
}

/**
 * «Хочу скидку» (этап 3, решение п. 13): 1) ответы партнёров — одобрить/отклонить через executeWrites с режимом защит;
 * 2) заявки NEW — новые в вопросы с нетто, пропавшие — закрыть. Бот на площадки не пишет — исполняет эта джоба.
 */
export async function runOzonTasks(deps: OzonTasksDeps): Promise<GuardJobResult> {
  const { db } = deps
  const now = deps.now()
  const nowIso = now.toISOString()
  const counters: Record<string, number> = {}
  const problems: string[] = []
  const add = (k: string, n = 1) => {
    counters[k] = (counters[k] ?? 0) + n
  }
  const finish = (): GuardJobResult => (problems.length > 0 ? { status: "partial", counters, error: problems.join("; ") } : { status: "ok", counters })

  const channels = await loadChannels(db)
  const ozon = channels.get("ozon")
  if (!ozon) throw new Error("площадка ozon не заведена — выполните seed-channels")
  const modes = guardModesOf(channels)
  const mode = effectiveMode(deps.globalMode, modes.ozon)

  // ── 1. Ответы партнёров ──
  const answered = (await activeDecisions(db)).filter(isOzonTaskDecision).filter((d) => d.status === "answered")
  if (answered.length > 0 && mode !== "apply") {
    for (const d of answered) await finishDecision(db, d.id, "failed", `запись защит Ozon — ${mode}: ответ не исполнен; в ЛК заявку не одобрять`, nowIso, ["answered"])
    add("tasksModeOff", answered.length)
    problems.push(`Ozon: ${answered.length} ответов на заявки не исполнены — запись защит Ozon ${mode}`)
  } else if (answered.length > 0) {
    const used = new Set<string>()
    const ops: WriteOp[] = []
    const byTask = new Map<number, OzonTaskDecisionRow>()
    for (const d of answered) {
      const p = d.payload
      if (d.answer !== "approve" && d.answer !== "decline") {
        await finishDecision(db, d.id, "failed", `ответ ${d.answer ?? "—"} к заявке не относится`, nowIso, ["answered"])
        add("tasksFailed")
        continue
      }
      // Ключ журнала — штрихкод WB; вторая заявка на тот же товар в прогоне — task:<id> (дубль уронил бы executeWrites).
      const barcode = p.barcode && !used.has(p.barcode) ? p.barcode : `task:${p.taskId}`
      used.add(barcode)
      const approve = d.answer === "approve"
      const before = p.currentMinor ?? p.requestedMinor
      ops.push({
        channel: "ozon",
        barcode,
        field: "discount_task",
        before,
        after: approve ? p.requestedMinor : before,
        externalSku: String(p.taskId),
        discountTask: { taskId: p.taskId, action: approve ? "approve" : "decline", approvedMinor: approve ? p.requestedMinor : null, quantityMin: 1, quantityMax: p.quantityMax, decisionId: d.id, comment: "" },
      })
      byTask.set(p.taskId, d)
    }
    let outs: WriteOutcome[] = []
    if (ops.length > 0) {
      try {
        outs = await executeWrites(ops, { globalMode: deps.globalMode, channelModes: modes, send: deps.send, record: drizzleWriteStore(db, deps.runId, channels, nowIso) })
      } catch (e: unknown) {
        if (!(e instanceof WriteJournalError)) throw e
        add("journalErrors")
        problems.push(`журнал ответов на заявки Ozon не сохранён: ${errorText(e.cause)}`)
        outs = e.outcomes
      }
    }
    for (const o of outs) {
      const t = o.discountTask!
      const d = byTask.get(t.taskId)!
      if (o.applied) {
        await finishDecision(db, d.id, "done", t.action === "approve" ? `Ozon: заявка одобрена по ${formatRub(o.after)}` : "Ozon: заявка отклонена", nowIso, ["answered"])
        add(t.action === "approve" ? "tasksApproved" : "tasksDeclined")
      } else {
        const text = o.uncertain ? `Ozon: итог неизвестен — проверьте заявку в ЛК (${o.error ?? ""})` : `Ozon: ${o.error ?? `режим ${o.mode}`}`
        await finishDecision(db, d.id, "failed", text, nowIso, ["answered"])
        add("tasksFailed")
        problems.push(`заявка Ozon #${t.taskId}: ${text}`)
      }
    }
  }

  // ── 2. Заявки NEW ──
  let tasks: OzonDiscountTask[]
  try {
    tasks = await deps.sources.tasks()
  } catch (e: unknown) {
    add("tasksReadFailed")
    problems.push(`Ozon: заявки «Хочу скидку» не прочитаны — ${errorText(e)}`)
    return finish()
  }
  counters.tasksNew = tasks.length
  const open = (await activeDecisionsOfKind(db, "ozon_discount_task")).filter(isOzonTaskDecision).filter((d) => d.status === "open")
  const diff = diffDiscountTasks(
    tasks.map((t) => t.id),
    await decisionSubjects(db, "ozon_discount_task"),
    open.map((d) => ({ id: d.id, taskId: d.payload.taskId })),
  )
  let closed = 0
  for (const id of diff.gone) if (await finishDecision(db, id, "closed", "заявка больше не новая — истекла, отозвана или решена в ЛК", nowIso, ["open"])) closed++
  if (closed > 0) counters.tasksClosed = closed
  const maxQ = deps.maxQuestions ?? MAX_TASK_QUESTIONS_PER_RUN
  if (diff.fresh.length > maxQ) counters.tasksPostponed = diff.fresh.length - maxQ
  const freshIds = new Set(diff.fresh.slice(0, maxQ))
  const fresh = tasks.filter((t, i) => freshIds.has(t.id) && tasks.findIndex((x) => x.id === t.id) === i)
  if (fresh.length === 0) return finish()

  let offers = new Map<number, { offerId: string; productId: number }>()
  try {
    offers = await deps.sources.offersBySku([...new Set(fresh.map((t) => t.sku))])
  } catch (e: unknown) {
    problems.push(`Ozon: товары заявок не сопоставлены — ${errorText(e)}`)
  }
  const priceOf = new Map<string, MirrorPrice>()
  try {
    for (const p of await deps.sources.prices()) priceOf.set(p.externalSku, p)
  } catch (e: unknown) {
    problems.push(`Ozon: цены для заявок не прочитаны — ${errorText(e)}`)
  }
  const barcodeOf = new Map<string, string>()
  for (const s of (await latestStockSnapshots(db)).get(ozon.id)?.stocks ?? []) if (s.externalSku && !barcodeOf.has(s.externalSku)) barcodeOf.set(s.externalSku, s.barcode)
  const productOf = new Map((await loadProducts(db)).map((p) => [p.barcode, p]))
  const agreed = await loadAgreedPrices(db)
  const items = fresh.map((t): NewDecision => {
    const offer = offers.get(t.sku)
    const barcode = offer ? (barcodeOf.get(offer.offerId) ?? null) : null
    const product = barcode ? productOf.get(barcode) : undefined
    const nmId = product?.nmId ?? null
    const rates = product?.wbSubject ? (deps.config.rates.get(product.wbSubject) ?? null) : null
    const live = offer ? priceOf.get(offer.offerId) : undefined
    const agreedMinor = nmId !== null ? (agreed.get(nmId)?.priceMinor ?? null) : null
    const a = assessDiscountTask({ requestedMinor: t.requestedMinor, agreedMinor, takeWbBp: rates?.takeWbBp ?? null, takeOzonBp: live?.takeBp ?? rates?.takeOzonBp ?? null })
    return {
      kind: "ozon_discount_task",
      subject: String(t.id),
      payload: {
        taskId: t.id,
        sku: t.sku,
        offerId: offer?.offerId ?? null,
        barcode,
        nmId,
        title: t.name ?? product?.title ?? null,
        requestedMinor: t.requestedMinor,
        currentMinor: live?.priceMinor ?? null,
        quantityMax: t.quantityMax,
        netRequestedMinor: a.netRequestedMinor,
        netWbMinor: a.netWbMinor,
        thresholdMinor: a.thresholdMinor,
        agreedMinor,
        decideBy: t.decideBy,
        endAt: t.endAt,
      },
    }
  })
  counters.tasksOpened = await openDecisions(db, items, deps.runId)
  const noNet = items.filter((i) => i.kind === "ozon_discount_task" && i.payload.netWbMinor === null).length
  if (noNet > 0) counters.tasksNoNet = noNet
  return finish()
}
```
`apps/worker/src/cli-guards.ts`:
- импорты: `fetchOzonNewDiscountTasks, fetchOzonOffersBySku, fetchOzonPrices` из `@sync2/platforms`; `import { loadPricingConfig } from "./pricing-config"`; `import { OZON_TASKS_JOB, runOzonTasks } from "./jobs/ozon-tasks"`;
- в `GUARD_USAGE` после строки `ozon-guard timers …`:
```
  ozon-guard tasks       «Хочу скидку» Ozon: исполнить ответы партнёров, новые заявки — в группу с нетто, пропавшие — закрыть (крон :14/:44)
```
- в ветке `ozon-guard` первой проверкой:
```ts
      if (arg === "tasks") {
        const prevTasks = await lastRunStatus(db, OZON_TASKS_JOB)
        const outcome = await withRun(OZON_TASKS_JOB, { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (run) => {
          const chCfg = loadChannelsConfig(env)
          const pricing = loadPricingConfig()
          const r = await runOzonTasks({
            db,
            now: () => new Date(),
            runId: run.runId,
            globalMode: config.writeMode,
            config: pricing,
            sources: {
              tasks: () => fetchOzonNewDiscountTasks(chCfg.ozon),
              offersBySku: (skus) => fetchOzonOffersBySku(chCfg.ozon, skus),
              prices: () => fetchOzonPrices(chCfg.ozon, { acquiringFallbackBp: pricing.ozonAcquiringFallbackBp }),
            },
            send: buildGuardSender(chCfg),
          })
          return { status: r.status, counters: r.counters, error: r.error }
        })
        await notifyTransition(db, log, notifier, OZON_TASKS_JOB, prevTasks, outcome)
        console.log(`${outcome.status} ${JSON.stringify(outcome.counters)}${outcome.error ? ` — ${outcome.error}` : ""}`)
        return outcome.status === "failed" ? 1 : 0
      }
```
а сообщение об ошибке аргумента — `ozon-guard timers|tasks`.

- [ ] **Step 4: Прогон и коммит.**
```bash
npx vitest run apps/worker/src/guard-senders.test.ts && npm run typecheck && npm test && npm run test:db
git add apps/worker/src/jobs/ozon-tasks.ts apps/worker/src/jobs/ozon-tasks.db.test.ts apps/worker/src/guard-senders.ts apps/worker/src/guard-senders.test.ts apps/worker/src/jobs/bot.ts apps/worker/src/jobs/bot.db.test.ts apps/worker/src/cli-guards.ts
git commit -m "sync2: джоба ozon-tasks — заявки «Хочу скидку» в группу с нетто, ответы партнёров исполняются с режимом защит; напоминание за 2 ч до срока"
```

---

### Task 15: Блок «🛡 Защиты» в сводке, крон и README выпуска 2

**Files:**
- Create: `apps/worker/src/jobs/guard-summary.ts`, `apps/worker/src/jobs/guard-summary.test.ts`
- Modify: `apps/worker/src/jobs/drift.ts`, `deploy/crontab.sync2.txt`, `deploy/README.md`, `README.md`

- [ ] **Step 1: Падающий тест** — `apps/worker/src/jobs/guard-summary.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { formatGuardSummary, type GuardSummary } from "./guard-summary"

const s = (over: Partial<GuardSummary> = {}): GuardSummary => ({
  guardMode: "apply",
  timersAgeH: 2,
  timersStatus: "ok",
  ozonMinDaysLeft: 24,
  ozonAtRisk: 0,
  ozonNoMinPrice: 0,
  wbExpiresAt: "2026-11-19T09:00:00.000Z",
  wbDaysLeft: 29,
  templatesWaiting: 0,
  tasksOpen: 1,
  tasksAnswered: 0,
  ...over,
})

describe("блок «Защиты» суточной сводки", () => {
  it("всё в порядке — сроки и счётчики без тревог", () => {
    expect(formatGuardSummary(s())).toBe(
      [
        "🛡 Защиты",
        "Ozon, флаг мин. цены: ближайший срок через 24 дн., проверка 2 ч назад (ok)",
        "WB, мин. цены: до 19.11 12:00 МСК (29 дн.)",
        "Ozon «Хочу скидку»: без ответа 1, ждут исполнения 0",
        "Режим записи защит Ozon: apply",
      ].join("\n"),
    )
  })

  it("тревоги: флаг не проверялся, WB истёк, файл ждёт отметки, под угрозой и без min_price", () => {
    const text = formatGuardSummary(s({ timersAgeH: null, wbDaysLeft: -1, templatesWaiting: 1 }))
    expect(text).toContain("⚠️ ozon-guard timers ещё не запускался")
    expect(text).toContain("⚠️ истекли")
    expect(text).toContain("файл ждёт «Загрузил в ЛК»: 1")
    expect(formatGuardSummary(s({ ozonAtRisk: 3, ozonNoMinPrice: 2 }))).toContain("⚠️ под угрозой 3, без min_price 2")
    expect(formatGuardSummary(s({ wbExpiresAt: null, wbDaysLeft: null }))).toContain("⚠️ срок неизвестен")
  })
})
```
Run: `npx vitest run apps/worker/src/jobs/guard-summary.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `apps/worker/src/jobs/guard-summary.ts`:
```ts
import { activeDecisions, latestRun, loadChannels, type Db } from "@sync2/db"
import { errorText, type WriteMode } from "@sync2/shared"
import { loadWbMinState } from "../wb-min"
import { formatMsk } from "./compare-v1"
import { OZON_TIMERS_JOB } from "./ozon-timers"

export interface GuardSummary {
  guardMode: WriteMode
  timersAgeH: number | null
  timersStatus: string | null
  ozonMinDaysLeft: number | null
  ozonAtRisk: number
  ozonNoMinPrice: number
  wbExpiresAt: string | null
  wbDaysLeft: number | null
  templatesWaiting: number
  tasksOpen: number
  tasksAnswered: number
}

/** Блок «Защиты» суточной сводки drift — сроки и счётчики, без рекомендаций. */
export function formatGuardSummary(s: GuardSummary): string {
  const ozon =
    s.timersAgeH === null
      ? "⚠️ ozon-guard timers ещё не запускался"
      : [
          s.ozonMinDaysLeft === null ? "активных таймеров нет" : `ближайший срок через ${s.ozonMinDaysLeft} дн.`,
          s.ozonAtRisk > 0 || s.ozonNoMinPrice > 0 ? `⚠️ под угрозой ${s.ozonAtRisk}, без min_price ${s.ozonNoMinPrice}` : null,
          `проверка ${s.timersAgeH} ч назад (${s.timersStatus ?? "?"})`,
        ]
          .filter((x): x is string => x !== null)
          .join(", ")
  const wb =
    s.wbExpiresAt === null
      ? "⚠️ срок неизвестен"
      : `до ${formatMsk(s.wbExpiresAt)} (${s.wbDaysLeft} дн.)${s.wbDaysLeft !== null && s.wbDaysLeft < 0 ? " ⚠️ истекли" : ""}`
  return [
    "🛡 Защиты",
    `Ozon, флаг мин. цены: ${ozon}`,
    `WB, мин. цены: ${wb}${s.templatesWaiting > 0 ? `; файл ждёт «Загрузил в ЛК»: ${s.templatesWaiting}` : ""}`,
    `Ozon «Хочу скидку»: без ответа ${s.tasksOpen}, ждут исполнения ${s.tasksAnswered}`,
    `Режим записи защит Ozon: ${s.guardMode}`,
  ].join("\n")
}

export async function loadGuardSummary(db: Db, now: Date): Promise<GuardSummary> {
  const channels = await loadChannels(db)
  const run = await latestRun(db, OZON_TIMERS_JOB)
  const num = (k: string): number | null => (run && typeof run.counters[k] === "number" ? (run.counters[k] as number) : null)
  const wb = await loadWbMinState(db)
  const active = await activeDecisions(db)
  return {
    guardMode: channels.get("ozon")?.guardWriteMode ?? "off",
    timersAgeH: run ? Math.round((now.getTime() - Date.parse(run.startedAt)) / 3_600_000) : null,
    timersStatus: run?.status ?? null,
    ozonMinDaysLeft: num("ozonTimerMinDaysLeft"),
    ozonAtRisk: num("ozonTimerAtRisk") ?? 0,
    ozonNoMinPrice: num("ozonNoMinPrice") ?? 0,
    wbExpiresAt: wb.expiresAt,
    wbDaysLeft: wb.expiresAt === null ? null : Math.floor((Date.parse(wb.expiresAt) - now.getTime()) / 86_400_000),
    templatesWaiting: active.filter((d) => d.kind === "wb_min_template" && d.status === "open").length,
    tasksOpen: active.filter((d) => d.kind === "ozon_discount_task" && d.status === "open").length,
    tasksAnswered: active.filter((d) => d.kind === "ozon_discount_task" && d.status === "answered").length,
  }
}

/** Сбой сбора блока не роняет сводку остатков и цен — пометка вместо блока. */
export async function safeGuardBlock(load: () => Promise<string>): Promise<string> {
  try {
    return await load()
  } catch (e: unknown) {
    return `🛡 Защиты: не удалось собрать — ${errorText(e)}`
  }
}
```
`apps/worker/src/jobs/drift.ts`: импорт `import { formatGuardSummary, loadGuardSummary, safeGuardBlock } from "./guard-summary"`; после строки `const prices = await safePriceBlock(…)`:
```ts
  const guards = await safeGuardBlock(async () => formatGuardSummary(await loadGuardSummary(db, now)))
```
и в `joinSummaryBlocks(…, prices)` второй аргумент заменить на `` `${prices}\n\n${guards}` ``.

- [ ] **Step 3: Крон** — `deploy/crontab.sync2.txt`, после строки `ozon-guard timers`:
```
# «Хочу скидку» Ozon: ответы партнёров → approve/decline, новые заявки → в группу с нетто — в :14 и :44 (мимо тика, цен 4/34, orders 3,8,…)
14,44 * * * * cd /opt/sync2 && flock -w 240 /tmp/sync2.lock timeout 9m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts ozon-guard tasks >> logs/guard.log 2>&1
```

- [ ] **Step 4: `deploy/README.md`** — раздел `## Этап 3 — защиты: выпуск 2 (шаблон WB, «Хочу скидку»)`: предусловия (выпуск 1 работает, бот этапа 2 включён), команды Task 16 дословно, как партнёр присылает шаблон (ответом на напоминание или с подписью `/wbmin`), запасной путь без бота (`scp` шаблона в `/opt/sync2/logs/`, `wb-min-prices fill logs/<файл> --out=logs/wb-min.xlsx`, `scp` обратно, `wb-min-prices uploaded --confirm`), «Откат выпуска 2» — раздел «Откат» этого плана, варианты «Хочу скидку» и «Шаблон WB», дословно. `README.md` — команды `ozon-guard tasks`, `wb-min-prices …`, абзац про вопросы `ozon_discount_task` и `wb_min_template`.

- [ ] **Step 5: Прогон и коммит.**
```bash
npx vitest run apps/worker/src/jobs/guard-summary.test.ts && npm run typecheck && npm test && npm run test:db
git add apps/worker/src/jobs/guard-summary.ts apps/worker/src/jobs/guard-summary.test.ts apps/worker/src/jobs/drift.ts deploy/crontab.sync2.txt deploy/README.md README.md
git commit -m "sync2: этап 3, выпуск 2 — блок «Защиты» в суточной сводке, крон ozon-guard tasks :14/:44, README"
```
Затем ревью выпуска 2 (`superpowers:requesting-code-review`, диапазон `sync2-stage-3a..sync2-stage-3`).

---

### Task 16: Выпуск 2 в бой — шаблон WB через бота, «Хочу скидку» [«да»]

Правила — как в Task 6. **Предусловия:** выпуск 1 работает (Task 6), бот этапа 2 включён (Task 24 этапа 2: `SYNC2_BOT_POLLING=on`, оба ID в `TELEGRAM_APPROVERS`).

- [ ] **Step 1 [«да»]: слияние и выкладка.**
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git merge --no-ff sync2-stage-3 -m "sync2: этап 3, выпуск 2 — шаблон минимальных цен WB и «Хочу скидку»"
cd sync2 && npm run typecheck && npm test && npm run test:db && npm run deploy
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T decisions | tail -3; $T runs 3'
```
Expected: миграция 0006 применена; `decisions` печатает прежние вопросы цен по-новому; тики `ok`.

- [ ] **Step 2 [«да»]: срок текущих мин. цен WB — загрузка 26.09 12:36 МСК.**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T wb-min-prices uploaded --at=2026-09-26T09:36:00Z'
```
Expected: «загрузка 26.09 12:36 МСК → мин. цены WB действуют до 26.10 12:36 МСК», код 2 (предпросмотр). После «да» — та же команда с `--confirm`, затем `$T wb-min-prices status` — «срок … 26.10 12:36 МСК (N дн.)».

- [ ] **Step 3 [«да»]: строки крона** — `ozon-guard tasks` вставкой, как Task 6 Step 4 (копия — `logs/crontab.before-3b.txt`; проверка `grep -q 'cli.ts ozon-guard tasks'`; строка и комментарий — из `deploy/crontab.sync2.txt`). Строка бота уже без `#` (этап 2) — бот сам начнёт напоминать о шаблоне WB с 09:00 МСК за 6 дней до срока, т. е. 20.10.

- [ ] **Step 4 [«да»]: первый прогон «Хочу скидку».**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock -w 240 /tmp/sync2.lock $T ozon-guard tasks; $T decisions | grep ozon_discount_task'
```
Expected: `ok`, `tasksNew` — сколько заявок сейчас в ЛК; каждая — вопрос; через минуту бот присылает их в группу с кнопками (защиты Ozon в `apply` с выпуска 1). `tasksNoNet` > 0 — товары без прайса или ставки (решать по цене).

- [ ] **Step 5: первое заполнение шаблона WB — когда владелец решит (не позже 20.10).** Владелец скачивает в ЛК WB шаблон «Минимальные цены и блокировки для автоакций» и присылает в группу файлом с подписью `/wbmin` (или ответом на напоминание 20.10). Бот отвечает файлом «Минимальные цены WB — заполнено <дата>.xlsx» и замечаниями. Проверка владельцем: у неизменившихся с 26.09 карточек K совпадает с файлом 26.09 (9 164 → 8 248), M — «Нет»; пропуски — с причинами. **[«да»] владельца = загрузка файла в ЛК им самим**, затем кнопка «✅ Загрузил в ЛК». Проверка: `$T wb-min-prices status` — срок = нажатие + 30 дней; следующий скачанный шаблон показывает «осталось 30 дней».

- [ ] **Step 6: приёмка — 3 суток.** `runs 30 | grep -E 'ozon-(tasks|timers)'` без `failed`; каждый ответ на заявку исполнен (`decisions` — ни одного `answered` дольше 30 мин); сводка `drift` в 09:10 МСК содержит блок «🛡 Защиты» без ⚠️. Итог — в «Ход выполнения».

---

## Откат

Каждый вариант — одно «да» владельца. Команды — также в `sync2/deploy/README.md`.

**Флаг Ozon** (синк перестаёт продлевать; флаг держится до своего срока, дальше — вручную):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts guard-mode ozon dry-run'
```
Продлить вручную — с Mac: `node sync/scripts/ozon-min-price-flag.mjs --verify`, затем `--apply`. Убрать крон — `crontab /opt/sync2/logs/crontab.before-3a.txt`.

**«Хочу скидку»** (вопросы — без кнопок, ответы не исполняются): тот же `guard-mode ozon dry-run` (вместе с флагом) или только строка крона — закомментировать `cli.ts ozon-guard tasks` (`crontab /opt/sync2/logs/crontab.before-3b.txt`). Исполненные одобрения по журналу:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && set -a && . ./.env && set +a && psql "$DATABASE_URL" -X -A -F "	" -c "select w.created_at, w.external_sku, w.before, w.after, w.detail->>'"'"'action'"'"' from writes w where w.field = '"'"'discount_task'"'"' and w.applied order by w.created_at"'
```
Одобренная заявка отменяется только в ЛК Ozon (пока `edited_till` не прошёл).

**Шаблон WB** (бот перестаёт напоминать и принимать файлы): до исправления — строку бота не трогать (вопросы цен идут через него); напоминания выключаются выкладкой прежнего `main` (Task 16 Step 1 назад) или ответом «wb-min-prices uploaded --at=<дата через 30 дней> --confirm» как временной заглушкой срока. Загруженные в ЛК мин. цены действуют до своего срока, откатываются новым шаблоном в ЛК.

**Код этапа 3:** прежний `main` → `npm run deploy`; крон — `crontab /opt/sync2/logs/crontab.before-3a.txt`; миграции 0005/0006 не откатывать (колонка с default и расширенные CHECK старый код не читает).

---

## Готово, когда

- **Выпуск 1:** `sync2-stage-3a` в `main`, выложен; `guard-mode ozon apply`; крон `ozon-guard timers` 04:24 UTC; после первого боевого прогона все товары Ozon с ценой и `min_price` — флаг до ≈ +30 дней, `ozonTimerFailed`/`…PriceMoved` нет; трое суток ежедневных прогонов без `failed`, `ozonTimerMinDaysLeft` ≥ 23. Задача владельца на 20.10 по Ozon снята.
- **Выпуск 2:** `sync2-stage-3` в `main`, выложен; миграции 0005–0006; срок мин. цен WB в синке (26.10 → после загрузки нового файла +30 дней); бот напоминает о шаблоне и возвращает заполненный файл; заявки «Хочу скидку» приходят с нетто, ответы партнёров исполняются, пропавшие закрываются; блок «🛡 Защиты» в сводке.
- Все тесты зелёные (`typecheck`, `test`, `test:db`); откат — в `sync2/deploy/README.md`.

## Сроки — успеваем ли до 20.10

| Шаг | Зависит от | Оценка |
|---|---|---|
| Шаги A/B этапа 1.4 | приёмка 1.3b–1.4 | ≈ 30.09–02.10 |
| Этап 2, Task 23 (выкладка, цены `off`) | шаг B | ≈ 02–03.10 |
| **Выпуск 1 (Task 1–5 код + ревью)** | ветка `sync2-stage-2` — можно начинать сразу | 1–2 дня → готов ≈ 01–02.10 |
| **Task 6 — флаг Ozon в бою** | Task 23 этапа 2 | ≈ 03–06.10; флаг продлён до ≈ 02–05.11 |
| Этап 2, Task 24 (бот, `TELEGRAM_APPROVERS`) | Task 23 | ≈ 03–04.10 |
| Выпуск 2 (Task 7–15 код + ревью) | выпуск 1 | 3–4 дня → ≈ 08–10.10 |
| Task 16 — шаблон WB и «Хочу скидку» в бою | Task 24 этапа 2 | ≈ 10–13.10; напоминание о WB — 20.10 |

Запас до 20.10 — около двух недель для флага Ozon и неделя для выпуска 2. Если к **15.10** этап 2 не выложен — выпуск 1 не гнать под срок: 20.10 — ручное продление (Task 6 Step 6) и шаблон WB по образцу 26.09 (`wb-min-prices fill` на VPS, если выпуск 2 уже выложен, иначе вручную).

## Самопроверка по спеке

| Спека / решение | Где покрыто |
|---|---|
| §2 п. 13, решение п. 13: Ozon — раз в неделю продлить флаг | Task 2 (порог 23 дня при ежедневном прогоне = раз в неделю на товар), Task 3–6 |
| §7 `ozon-guard`: `timer/update` по всем товарам | Task 3 (`timer/update` пачками ≤ 1000 + включение погасшего), Task 4 (джоба), Task 5 (крон) |
| §7 `ozon-guard`: «`min_price` из расчёта» | джоба `prices` этапа 2 (Task 12, 17 этапа 2); здесь не пересчитывается — отступление с причиной |
| §2 п. 13, решение п. 13: «Хочу скидку» — в Telegram с расчётом нетто, в ЛК не одобрять | Task 12 (v2 + approve/decline), Task 13 (нетто, порог), Task 14 (вопросы, исполнение, закрытие, срок), Task 7 (текст «в ЛК не одобрять») |
| §7: `discounts-task/list` каждые 30 мин → `decision` с нетто → `approve`/`decline` | Task 14, Task 15 (крон :14/:44) |
| §2 п. 12, решение п. 12: WB мин. цена = прайс × (1 − уступка), по умолчанию 10 %, по товару, без блокировки | Task 8 (`wbMinPriceRub`, `planWbMinPrices`), Task 10 (`concession`), Task 9 (M = «Нет») |
| §6: мин. цена WB = `ceil_руб(прайс × (1 − уступка))` | Task 8 (целочисленно, 9 164 → 8 248) |
| §7: `sync2 wb-min-prices <шаблон.xlsx>` — два столбца по артикулу, остальное не трогает, пропуски — списком с причиной | Task 9 (только K/M, по заголовкам), Task 10 (`fill`, `skipsText`) |
| §7: напоминание при изменении прайса, новом товаре, автоакции | Task 8 (`wbMinReminder` «changes»), Task 10 (`agreedChangesSince` — и новые товары: их прайс пишется в историю; `autoactionsSince`), Task 11 |
| Решение, «Риски»: шаблон WB — ручной шаг; без загрузки защита не действует | Task 11 (кнопка «Загрузил в ЛК», срок от нажатия, напоминание 24 ч), Task 15 (срок в сводке) |
| §2 п. 14: ЯМ `minimumForBestseller` никогда | этап 2 (Task 13 этапа 2, тест сериализатора) — этапом 3 не трогается |
| §2 п. 15, решение п. 15: кнопки в группе, двое партнёров, видно кто решил, без ответа — ничего | Task 7 (кнопки по видам), Task 11, Task 14 (через бот этапа 2: `TELEGRAM_APPROVERS`, «Решено: кто, когда») |
| §3: запись только через выключатель; лимиты без слепых повторов | `executeWrites` + `guard_write_mode` (Task 1, 4, 14); повторы записи — `WRITE_RETRY_DELAYS_MS`, 429 — `RateLimitError` без долгих пауз |
| §4: `decisions` — частичный уникальный `(kind, subject)` по открытым | Task 7 (новые виды в тот же индекс; заявка — один вопрос навсегда через `decisionSubjects`) |
| §10: `runs` со счётчиками, `writes` — было → стало, контрактные тесты | Task 3, 4, 12, 14 (фикстуры в тестах, журнал `price_timer`/`discount_task`) |
| §11 этап 3: команда шаблона WB, `ozon-guard`, «Хочу скидку» | Task 1–16 |
| Постановка: продление Ozon — первой задачей, отдельно в бой до 20.10 | выпуск 1 = Task 1–6, указатель `sync2-stage-3a` |
| Постановка: dry-run/предпросмотр, запись по `--confirm` или кнопке, журнал `writes` | `guard-mode … apply --confirm` после плана; `wb-min-prices uploaded|concession --confirm`; кнопки; `writes` |

## Открытые вопросы к владельцу

1. **Карточки без прайса в шаблоне WB (≈ 300 не в наличии):** мин. цена от «Цены со скидкой» −10 % (как 26.09 «на все 382») или оставить пустой? **Рекомендация:** от цены WB — иначе 26.10 у них защита истечёт, а при поступлении товара автоакция уронит цену без нижней границы.
2. **Уступка по товару:** есть ли коллекционные образцы, которым нужна 0 % (мин. цена = прайс)? **Рекомендация:** пока 10 % на все; нужные — `wb-min-prices concession <nmId> 0 --reason=… --confirm` по одному, со следующим шаблоном.
3. **«Хочу скидку» — только «одобрить по цене заявки / отклонить»** или третья кнопка «встречная цена = цена равного нетто» (одобрение по порогу вместо цены заявки)? **Рекомендация:** две кнопки сейчас (спека §7); встречную — после месяца статистики заявок (сколько их ниже порога и что с ними делаем).
4. **Кнопки заявок появятся сразу с выпуском 2** — режим защит Ozon уже `apply` ради флага (выпуск 1). **Рекомендация:** да; чтобы сначала посмотреть заявки без кнопок — Task 16 Step 4 выполнить при `guard-mode ozon dry-run` на сутки (флаг от этого не погаснет: он продлён на 30 дней).
5. **Напоминание о шаблоне WB — за 6 дней до конца (20.10 для 26.10) и каждый день после, с 09:00 МСК.** **Рекомендация:** да — совпадает с вашим планом продлить 20.10.
6. **Продлевать флаг у всех товаров Ozon с ценой, в том числе без остатка** (26.09 так и было — 81/81)? **Рекомендация:** да — продление ничего не стоит, а товар без флага при поступлении попадёт в автоакцию без порога.
7. **Кнопка ЛК WB «Добавить все подходящие» снимает минимальные цены** — синк этого не видит (API нет), поймает только сторож цен постфактум. **Рекомендация:** не нажимать; если нажали — сразу прислать свежий шаблон `/wbmin`.
8. **Первый боевой прогон выпуска 1 — сразу всех (`--renew-below=30`)**, срок флага сдвигается с 26.10 на ≈ начало ноября. **Рекомендация:** да — это и есть замена ручного продления 20.10; дальше крон держит каждый товар не ниже 23 дней.

## Ход выполнения

(заполняется исполнителем: даты выпусков, счётчики первых прогонов, итоги приёмки)

## Решения владельца (29.09.2026) — обязательны для исполнителей

Владелец согласился со всеми рекомендациями по открытым вопросам: карточки без прайса — мин. цена от цены WB −10 %;
уступка 10 % на все, исключения — командой; «Хочу скидку» — две кнопки; кнопки заявок — сразу с выпуском 2;
напоминание о шаблоне WB за 6 дней и далее ежедневно; флаг Ozon — всем товарам с ценой, включая без остатка;
первый боевой прогон выпуска 1 продлевает флаг всем и заменяет ручное продление Ozon 20.10. Кнопку ЛК WB
«Добавить все подходящие» не нажимать.
