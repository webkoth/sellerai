# Синк v2 · этап 2 — цены: прайс, сторож WB, кнопки, расчёт, запись на четыре зеркала, коэффициент СПП

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sync2` держит цену на пяти площадках от согласованного прайса. Прайс (цена продавца WB на карточку, копейки, с историей) живёт в базе `sync2`; сторож раз в 30 минут сравнивает цену продавца WB с прайсом и выносит расхождение в группу магазина кнопками «принять как прайс / автоакция — не трогать / вернуть WB к прайсу»; нажимать могут только два партнёра. Ozon и ЯМ получают цену равного нетто, KIT и сайт — прайс × (1 − k), где k — медиана СПП магазина за 30 дней из финотчёта WB с гистерезисом 3 п.п.; пол — нетто WB + доставка, потолок — прайс. Запись — через тот же `executeWrites` и журнал `writes`, со своим режимом записи цен у каждой площадки; всё начинается в `dry-run`. Сайт перестаёт читать цены WB и берёт цену из синка через служебный API.

**Architecture:** Чистый домен в `packages/domain/src`: `pricing.ts` (перенос `computeTarget`/`fitBase` из `sync/src/pricing.ts` в копейки + ЯМ с доставкой + KIT/сайт + возврат WB), `price-plan.ts` (анти-флаппинг 2 %, кап 60 %), `price-watch.ts` (сторож), `spp.ts` (медиана и гистерезис), `agreed-csv.ts` (разбор прайса). База: миграция 0004 — `channels.price_write_mode`, `writes.detail` и `bigint` у `writes.before/after`, таблицы `agreed_prices` + `agreed_price_history`, `decisions`, `spp_coefficients`, `price_snapshots_raw`, `sync_state` (окно лимита цен WB, курсор Telegram). Площадки: читатели и писатели цен WB (`discounts-prices`), Ozon (`v5/product/info/prices`, `v1/product/import/prices`), ЯМ (`offer-prices`, `offer-prices/updates` без `minimumForBestseller`), KIT (`variants`, `variants/prices/bulk_update`), сайт (`GET/PUT /api/internal/prices`), финотчёт WB (`sales-reports/detailed`, поле `spp`). Воркер: джобы `prices` (крон раз в 30 мин: решения → сторож или возврат WB → зеркала), `spp` (раз в неделю), `bot` (крон раз в минуту: long polling `getUpdates`, отправка вопросов, напоминания; на площадки не пишет). CLI: `price import|set|show`, `price-mode … apply --confirm`, `price-plan`, `decisions`, `decide`, `prices [--only=]`, `spp [--show]`, `bot`. Сайт (отдельный репозиторий): `PRICE_SOURCE=wb|pool`, служебный `GET/PUT /api/internal/prices`, в `pool` синки WB цены не читают и не пишут.

**Tech Stack:** как в 1.1–1.4. `sync2`: TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Vitest 4 (проекты `unit`/`db`), Drizzle 0.45 + postgres.js, `tsx`, pino. Сайт: Next.js 16.2.6, Drizzle 0.45, zod 4, Vitest 4, Prettier (без `;`, двойные кавычки, `printWidth: 80`).

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md` §2 (правила 8–15), §4 (таблицы), §6 (цены), §7 (граница с защитами), §9 (Telegram), §11 этап 2. **Решение владельца:** `business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md` — п. 8–15, п. 12 (факт 26.09: прайс = `data/prices/agreed-2026-09-26.csv`), п. 17 (сайт берёт от синка только остаток и цену), п. 19. **Исходники v1:** `sync/src/pricing.ts`, `sync/src/commands/prices.ts`, `sync/src/clients.ts` (цены), `sync/scripts/ozon-min-price-flag.mjs`. **finstock (только чтение):** `packages/platforms/src/wb/finance-client.ts`.

---

## Факты, проверенные при написании плана (28.09.2026, только чтение)

- **Состояние `sync2` на VPS 147.45.171.40:** `SYNC_WRITE_MODE=dry-run`, режимы записи остатков `wb/ozon/ym/kit` — `dry-run`, `site` — `off` (шаги A и B этапа 1.4 ещё не выполнены). В `writes` 978 строк, все `field = stock`; база 225 МБ. Код 1.4 (`11d0eb5`) в `main` и выложен, тик раз в 5 минут в минуты `1,6,…,56`.
- **Старый синк:** крон `prices` выключен с 18.07 («цены только вручную»); `reconcile` 08:45 читает цены WB (`discounts-prices`, в комментарии крона: «у этого токена — 1 запрос в ~11 мин, X-Ratelimit-Reset 681») — на шаге B этапа 1.4 он закомментирован. Приём `/cost` (`intake`, единственный потребитель `getUpdates`) выключен с 03.09. Токен бота старого синка **совпадает** с токеном `sync2` (сверено по хешу) — `intake` должен оставаться выключенным: у одного токена может быть только один потребитель `getUpdates` (второй получает 409 Conflict).
- **Telegram:** бот `@KotelnikovArtifactBot`, webhook не задан (`url: ""`, очередь пуста) — long polling возможен; `can_read_all_group_messages: false` (режим приватности: в группе бот видит только команды вида `/id@KotelnikovArtifactBot`; нажатия кнопок `callback_query` приходят всегда). Группа `-1004395280612` — супергруппа из 3 участников: бот (админ), **Минас — `5710949139`** (создатель), третий участник (партнёр, не админ) — его ID нигде не записан (поиск по `sync/`, `sync2/`, `business-os/`). `tg-digest-bot` (pm2) работает с другим токеном.
- **Цены WB (`docs/api-reference/openapi/wildberries/02-products.yaml`):** `GET /api/v2/list/goods/filter?limit=1000&offset=N` — `listGoods[]{nmID, vendorCode, discount, sizes[]{sizeID, price, discountedPrice, clubDiscountedPrice}, editableSizePrice}`, `discountedPrice` — число с копейками; страницы до пустой (лишний запрос на пустую страницу — не нужен при ответе короче `limit`). `POST /api/v2/upload/task` — `{ data: [{ nmID, price (целые ₽), discount (целые %) }] }`, до 1000; цена со скидкой в 3 раза ниже прежней уходит в карантин. Лимит категории «Цены и скидки» для **базового** токена — 4 запроса в час, интервал 15 минут, всплеск 1 (на аккаунт, общий для чтения и записи). Сайт читает тот же метод сам: `sync-products` (:20 каждые 3 ч) и `sync-prices` (:30 каждые 3 ч).
- **Прайс против WB сейчас:** предпросмотр старого синка 28.09 12:29 UTC (`/opt/sellerai-sync/reports/reprice-2026-09-28.csv`, колонка «WB_витрина_неизм» = `discountedPrice`): из 78 позиций прайса 75 в наличии на WB; у **59** цена WB отличается от прайса больше чем на 1 % (медиана −5,4 %, от −16,7 % до +47,4 %); **7** товаров в наличии без прайса. Первый прогон сторожа откроет ≈ 66 вопросов.
- **Прайс `data/prices/agreed-2026-09-26.csv`:** 78 строк, одна на `nmID` (у каждой один штрихкод), разделитель `;`, BOM, колонки `nmID;vendorCode;barcode;категория_WB;остаток;согласованная_цена_продавца;уступка_WB;мин_цена_WB;источник`; цены с копейками (`20631.2`), уступка `0.1` у всех; в поле «источник» — кавычки и `;` внутри. Предметы: Обереги 41, Подвески бижутерные 15, Природные материалы для творчества 13, Браслеты 7, Шармы-подвески 1, Часы наручные 1.
- **Ставки модели v2** (`data/mappings/pricing.json`, 19.07): 5 предметов, `take_wb` = kgvpMarketplace + 2 % эквайринг; комиссии WB FBS на сегодня те же (`data/commissions/wb_commissions.json`: Браслеты/Подвески/Шармы 42, Обереги 33, Природные 43, Часы 48). Для «Шармы-подвески» и «Часы наручные» ставок Ozon/ЯМ нет. `base_policy`: запас 15 %, база кратна 100 ₽, мин. скидка 5 %, скидка WB 3–95 %, мин. разница Ozon 500 ₽; `guardrails`: 2 % / 60 % / 400.
- **Модель v1 на примере** браслета `2041383032873` (прайс 9 164 ₽, Браслеты): `fitBase` в копейках даёт базу 15 800 ₽ со скидкой 42 % — это текущая цена до скидки на WB (15 800 ₽, предпросмотр 28.09), нетто WB 5 131,84 ₽, Ozon 11 490 ₽ (порог равного нетто 11 404,09 ₽), ЯМ 12 190 ₽.
- **Финотчёт WB (`13-finances.yaml`):** `POST finance-api …/api/finance/v1/sales-reports/detailed`, тело `{ dateFrom, dateTo, period, limit ≤ 100000, rrdId }`, конец — 204; лимит базового токена — **2 запроса в сутки, интервал 12 ч, всплеск 1** на аккаунт. Поле `spp` — «Платформенные скидки, %» (число, `25.31`); продажа — `docTypeName = sellerOperName = "Продажа"`. finstock (`finance-client.ts`) читает этот метод, но `spp` не разбирает и листает до пустой страницы (второй запрос); finstock крутится на другом сервере (`201.34.139.11`, `sync-realization` вт/ср 09:00 МСК) — если с тем же токеном WB, суточный лимит общий (проверить отсюда нельзя).
- **Ozon `POST /v1/product/import/prices`:** `price`, `old_price`, `min_price` (строки), `min_price_for_auto_actions_enabled`, `auto_action_enabled`, `auto_add_to_ozon_actions_list_enabled`, `vat`; цену товара — не чаще 10 раз в час; при включённом автоприменении без минимальной цены — `action_price_enabled_min_price_missing`. Флаг минимальной цены продлевается отдельно `…/action/timer/update` (`ozon-min-price-flag.mjs`); у всех 81 товара истекает **26.10**. Чтение — `POST /v5/product/info/prices` (цены, `commissions.sales_percent_fbs`, `acquiring`).
- **ЯМ:** `POST /v2/businesses/{businessId}/offer-prices/updates` — до 500 офферов, `price{value, currencyId, discountBase}`; отсутствие `minimumForBestseller` стирает прежнее значение (это и нужно, решение п. 14). Чтение — `POST /v2/businesses/{businessId}/offer-prices` (`limit`/`pageToken` — только в строке запроса).
- **KIT:** `POST /v1/variants/prices/bulk_update` — до 5000, синхронно и атомарно (одна битая позиция — 400 со списком `errors`, не применено ничего), поля `price` (до скидки) и `manual_discount_price` — десятичные строки, `null` сбрасывает цену со скидкой. У варианта — `pricing{price, manual_discount_price, promotion_price, final_price}`. Комиссии с продаж у KIT нет — только эквайринг и доставка; действуют «−15 % за подписку» и промокод `ПЕРВЫЙЗАКАЗ` 3 %.
- **Сайт (`/Users/minas/projects/kotelnikovartifact`):** цена — `wb_products.price/discounted_price/discount` (numeric); писатели — `syncPrices` (`sync-prices`, `sync-full`) и `upsertProduct` (`sync-products`, при конфликте перезаписывает цену); оба берут `listAllPrices()` с WB. Каталог показывает только `discounted_price > 0`; корзина и заказ берут `discountedPrice`. Служебный API — Bearer `INTERNAL_API_TOKEN` (`lib/internal-auth.ts`), по образцу `app/api/internal/stocks/route.ts`.
- **Код `sync2`, мешающий ценам:** `writes.before/after` — `integer`; `writeStatsSince` и `barcodesAppliedSince` (`packages/db/src/journal.ts`) не фильтруют `field` — записи цен попали бы в сводку остатков `drift` («в пути», «повторные записи»); `deploy/deploy.sh` держит только `/tmp/sync2.lock` — крон бота под своей блокировкой пережил бы `npm ci` посреди прогона.
- **СПП и индекс цены** (`business-os/research/2026-09-26-wb-spp-indeks-cenovoy-privlekatelnosti.md`, вторичные источники): с апреля 2026 WB отключает софинансирование СПП, если цена продавца на WB выше цены того же товара на других площадках.

---

## Решения этапа

1. **Прайс в базе.** `agreed_prices` — одна строка на карточку WB (`nm_id`), штрихкод для справки, цена `price_minor` (копейки), уступка WB `concession_bp` (для шаблона этапа 3), источник (`import | button | cli`), кто утвердил, причина; каждое изменение — строка `agreed_price_history` (было → стало, решение). Наполнение — `price import data/prices/agreed-2026-09-26.csv --confirm` (только новые `nm_id`; расхождение с уже записанным — списком, не меняется). Правка — только кнопкой «принять» или `price set <nmId> <₽> --reason=… --confirm`.
2. **Сторож WB** — в джобе `prices` раз в 30 минут. Окно лимита цен WB — одно на аккаунт, 15 минут, **общее для чтения и записи**: хранится в `sync_state` (`slot:wb-prices`), занимается до запроса; прогон делает не больше одного запроса к `discounts-prices` — либо запись «вернуть», либо чтение. Ответ короче 1000 карточек — конец (пустая страница не запрашивается). 429 — без повторов, окно сдвигается по `X-Ratelimit-Retry`. Расхождение больше 1 % → вопрос; пока вопрос открыт — не спрашивать; цена вернулась к прайсу — вопрос закрывается сам; ответ «автоакция» глушит вопросы, пока цена WB в пределах 1 % от той, что назвали автоакцией. Товар в наличии без прайса → вопрос «принять цену WB как прайс».
3. **Кнопки — три.** «✅ Принять как прайс» (прайс := цена WB из вопроса), «🏷 Автоакция — не трогать» (ничего не пишется), «↩️ Вернуть WB к прайсу» (запись WB, показывается только при действующем `apply` цен WB). Приём — крон `bot` раз в минуту: `getUpdates` с `timeout 50` (long polling без демона), курсор — в `sync_state`, только из группы и только от `TELEGRAM_APPROVERS`; под сообщением — «Решено: кто, когда — ответ», затем итог. Напоминание — через 24 ч без ответа. Бот на площадки не пишет: решения исполняет следующий прогон `prices`. `/id@KotelnikovArtifactBot` — бот отвечает ID пользователя (так партнёр узнаёт свой ID). CLI `decide` — то же решение от владельца из терминала (пачкой для первых ≈ 66 вопросов).
4. **Расчёт (домен, копейки, доли — в базисных пунктах, 10 000 = 100 %).** Нетто WB = прайс × (1 − ставка WB). Ozon = ₽…90 вверх от порога равного нетто, `min_price` = порог, округлённый вверх до рубля (так было выставлено 19.07). ЯМ = ₽…90 вверх от цены, при которой цена − ставка − доставка (5 %, ≤ 1 000 ₽) ≥ нетто WB. Единая база B (`fitBase`: запас 15 % над самой дорогой финалкой, ≥ финалка Ozon + 500 ₽, мин. скидка 5 %, целая скидка WB) — зачёркнутая цена на **всех четырёх** зеркалах (Ozon `old_price`, ЯМ `discountBase`, KIT `price`, сайт `price`). KIT/сайт = min(₽…90 вверх от max(прайс × (1 − k), нетто WB + доставка), прайс). Ставка Ozon — живая с товара (`sales_percent_fbs` + эквайринг), иначе — по предмету.
5. **Запись.** Тот же `executeWrites` и журнал `writes` (`field = price`, `before/after` — цена в копейках, `detail` — зачёркнутая, `min_price`, скидка WB, НДС Ozon). Режим записи цен — **отдельная колонка `channels.price_write_mode`** (по умолчанию `off`), действующий режим — меньший из глобального `SYNC_WRITE_MODE` и её. Отдельная колонка, а не новый «вид канала», потому что `executeWrites` уже принимает режимы площадок параметром: цены получают свой переключатель и откат (`price-mode <c> dry-run`) без второй копии выключателя и без связи с остатками. `apply` — только `price-mode <c> apply --confirm` после свежего `prices` (≤ 45 мин) с печатью плана; первый боевой прогон зеркала — `prices --only=<nmId>` на одном товаре.
6. **Защиты записи:** анти-флаппинг — писать, если цена или зачёркнутая уходят от текущей больше чем на 2 % или `min_price` Ozon не равна цели; кап — изменение цены больше 60 % не пишется (алерт); больше 400 изменений за прогон по всем зеркалам — не пишется ничего (алерт). Проверка применения — следующим прогоном (через 30 мин, не раньше 3 мин): применённая запись, которой нет на площадке, — «цена не держится».
7. **Коэффициент СПП** — джоба `spp`, четверг 07:20 МСК (после публикации недельного отчёта; мимо вт/ср finstock): один запрос `sales-reports/detailed` за 30 дней (`period: weekly`, `limit 100000`, без второй страницы); медиана `spp` по единицам проданного (строки «Продажа/Продажа» по дате операции); меньше 10 продаж — k не меняется; новое значение применяется, если отличается от действующего на ≥ 300 bp (3 п.п.); первое — сразу. История — `spp_coefficients`, пересчёт не чаще раза в сутки (иначе второй запрос съест суточный лимит). Нет k — KIT и сайт не считаются (счётчик `skip_no-spp`).
8. **Сайт:** `PRICE_SOURCE=wb|pool` в `.env` сайта. В `pool` — `sync-prices` ничего не делает и в WB не ходит, `sync-products` цен не читает и не перезаписывает (новая карточка входит с ценой 0 и скрыта каталогом, пока синк не пришлёт цену); `PUT /api/internal/prices` пишет `price/discounted_price/discount` по `nmId`; в `wb` `PUT` отвечает 409 — второго писателя цены нет. `GET` отдаёт цены всех товаров и источник.
9. **Граница с этапом 3.** Не делается: шаблон минимальных цен WB, `ozon-guard` (`timer/update` раз в неделю), «Хочу скидку». Запись цены Ozon несёт `min_price`, `min_price_for_auto_actions_enabled: true`, автоакции `DISABLED` (спека §6) — но продление таймера флага остаётся этапу 3. `concession_bp` в прайсе хранится уже сейчас.
10. **Наблюдаемость:** `prices` — в `runs` со счётчиками и уведомлением о смене состояния (как `pool`); `bot` в `runs` не пишется (1 440 прогонов в сутки), только лог; суточная сводка `drift` получает блок «Цены» (открытые вопросы, записи цен за сутки, k, возраст последнего чтения WB).
11. **Все внешние шаги** (слияние, выкладка, импорт прайса, крон, `.env`, `price-mode … apply`, PR и слияние сайта, `PRICE_SOURCE=pool`) — только в задачах выкладки (23–27), каждый с «да» владельца. Выкладка — **после приёмки шага B этапа 1.4**.

### Отступления от спеки и постановки (с причинами)

- **Стартовый прайс — `data/prices/agreed-2026-09-26.csv`, а не `reports/reprice-2026-07-18.csv` (спека §6):** решение владельца 26.09 (решение п. 12, «Факт 26.09»).
- **Ключ прайса — `nm_id`, а не `barcode` (спека §4):** цена на WB ставится на карточку (`upload/task` по `nmID`), все размеры карточки стоят одинаково; штрихкод хранится для справки и журнала.
- **`price_targets` не заводится (спека §4):** цель и факт каждой записи уже лежат в `writes` (`before → after`, `detail`), снимок цен WB — в `price_snapshots_raw`; отдельная таблица целей дублировала бы журнал (≈ 15 тыс. строк в сутки). `decisions` — ключ `id`, частичный уникальный индекс `(kind, subject)` по открытым — как в спеке.
- **Кнопок три, а не две (спека §2 п. 8 «принять / автоакция»):** постановка добавляет «вернуть к прайсу», решение п. 8 — «принять / это автоакция»; нужны все три исхода. «Вернуть» — единственная запись цены на WB, и только по кнопке.
- **`min_price` Ozon = порог равного нетто, а не финалка × 0,95 (`ozon_min_price_factor` в коде v1):** 19.07 владелец выставил именно порог (`min_reco`), и решение п. 13 требует, чтобы акции не опускали нетто ниже WB.
- **Округление ₽…90 и зачёркнутая база — и на KIT/сайте** (спека называет их для `computeTarget`, про KIT/сайт молчит): одинаковые правила витрины на всех своих площадках; излишек округления уходит в нетто; потолок (прайс) побеждает округление. Вынесено в открытые вопросы 4–5.
- **Сторож — внутри джобы `prices`, а не отдельной джобой:** запись «вернуть» и чтение делят одно окно лимита; одна джоба под одной блокировкой не даёт им столкнуться.
- **Крон бота раз в минуту, а не «long polling в воркере» (спека §9):** у `sync2` нет постоянного процесса; cron + `getUpdates(timeout 50)` даёт ответ на нажатие за секунды и не требует pm2/systemd.

---

## Репозитории, ветки, проверки

| Задачи | Репозиторий | Ветка | Проверки перед коммитом |
|---|---|---|---|
| 1–21 | `/Users/minas/projects/sai_kotelnikovartifact`, worktree `/Users/minas/projects/sai_kotelnikovartifact-2` | `sync2-stage-2` от `main` | из `…-2/sync2`: `npm run typecheck && npm test && npm run test:db` |
| 22 | `/Users/minas/projects/kotelnikovartifact` (GitHub `webkoth/kotelnikovartifact-store`) | `feat/internal-prices` от `main` | `npm run lint && npm run typecheck && npm test` |
| 23–27 | оба + VPS 147.45.171.40 (`sync2`) и 201.34.133.76 (сайт) | — | по шагам, каждый внешний шаг — только с «да» владельца |

Подготовка `sync2` (один раз, перед Task 1):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git worktree add ../sai_kotelnikovartifact-2 -b sync2-stage-2 main
cd ../sai_kotelnikovartifact-2/sync2 && npx -y npm@11.16.0 ci
```
Все команды задач 1–21 — из `/Users/minas/projects/sai_kotelnikovartifact-2/sync2`, пути в `git add` — от этого каталога. Тестовая база — `sync2_test` (как в 1.1–1.4).

Подготовка сайта (один раз, перед Task 22):
```bash
cd /Users/minas/projects/kotelnikovartifact
git switch main && git pull --ff-only && git switch -c feat/internal-prices
```
**Слияние с `main` сайта = автодеплой на прод.** В Task 22 — ни `git push`, ни PR.

---

## Карта файлов

```
sai_kotelnikovartifact-2/sync2/                        (ветка sync2-stage-2)
  config/pricing.json                                  ставки по предметам, политика базы, доставка KIT/сайта
  packages/shared/src/
    prices.ts (+test)                                  bp, копейки, ₽…90, дрейф, форматы; WbPriceRow, MirrorPrice, SppSaleRow
    decisions.ts                                       виды/статусы/ответы вопросов, полезная нагрузка, источники прайса
    index.ts
  packages/domain/src/
    pricing.ts (+test)                                 fitWbBase, mirrorPrices, ymPriceForNet, ownStorePrice, wbReturnTarget
    price-plan.ts (+test)                              planPriceWrites: анти-флаппинг 2 %, кап 60 %
    price-watch.ts (+test)                             watchWbPrices: сторож
    spp.ts (+test)                                     sppMedian, nextSppCoefficient
    agreed-csv.ts (+test)                              parseAgreedCsv
    index.ts
  packages/db/
    migrations/0004_prices.sql (+meta)                 режим цен, writes.detail/bigint, прайс, решения, СПП, снимки цен, sync_state
    src/schema.ts, channels.ts, journal.ts, writes-store.ts, products.ts
    src/agreed-prices.ts, decisions.ts, sync-state.ts, spp-store.ts, price-snapshots.ts
    src/store-2.db.test.ts, src/journal.db.test.ts (правка)
    src/index.ts
  packages/platforms/src/
    writer.ts (+test)                                  PriceDetail, WriteOp.price
    wb/prices.ts (+test), wb/finance.ts (+test)        цены WB; продажи с СПП из финотчёта
    ozon/prices.ts (+test)                             чтение v5, запись import/prices
    ym/prices.ts (+test)                               чтение offer-prices, запись offer-prices/updates
    kit/client.ts, kit/stock-writer.ts, kit/prices.ts (+test)
    site/prices.ts (+test)                             GET/PUT /api/internal/prices
    index.ts
  apps/worker/src/
    pricing-config.ts (+test)                          разбор config/pricing.json
    price-senders.ts (+test)                           buildPriceSender, buildPriceSources
    telegram.ts (+test)                                Bot API, TELEGRAM_APPROVERS
    decision-text.ts (+test)                           тексты и кнопки вопросов
    notify-run.ts                                      notifyTransition (вынесено из cli.ts)
    apply-preview.ts (+test)                           checkPriceApplyPreview
    jobs/prices.ts (+db test)                          решения → сторож/возврат WB → зеркала
    jobs/spp.ts (+db test)                             коэффициент СПП
    jobs/bot.ts (+db test)                             кнопки, отправка, напоминания, /id
    jobs/price-summary.ts (+test), jobs/drift.ts       блок «Цены» в суточной сводке
    cli-prices.ts, cli.ts                              команды цен
  deploy/crontab.sync2.txt, deploy/README.md, deploy/deploy.sh
  .env.example, README.md

kotelnikovartifact/                                    (ветка feat/internal-prices)
  lib/env.ts                                           PRICE_SOURCE
  lib/price-source.ts                                  снимок и запись цен синка
  app/api/internal/prices/route.ts                     GET/PUT
  lib/wb/sync/prices.ts, products.ts, upsert-product.ts  в pool — без WB-цен
  scripts/check-stock-source.sh                        + проверка PRICE_SOURCE
  tests/unit/internal-prices-route.test.ts, tests/unit/lib/price-source.test.ts,
  tests/unit/lib/wb/sync/prices.test.ts, upsert-product.test.ts, tests/unit/scripts/check-stock-source.test.ts
```

---

### Task 1: Деньги и доли цен, типы цен и вопросов (`@sync2/shared`)

**Files:**
- Create: `packages/shared/src/prices.ts`, `packages/shared/src/prices.test.ts`, `packages/shared/src/decisions.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/shared/src/prices.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import {
  applyDiscountBp,
  ceilRub,
  ceilTo,
  driftBp,
  formatRub,
  formatSignedPctBp,
  fractionToBp,
  grossUpBp,
  minorToDecimalString,
  minorToRub,
  percentToBp,
  roundUpEnding90,
} from "./prices"

describe("доли в базисных пунктах", () => {
  it("дробь и процент площадки → bp; 100 % и выше — ошибка", () => {
    expect(fractionToBp(0.44)).toBe(4400)
    expect(fractionToBp(0.528)).toBe(5280)
    expect(() => fractionToBp(1)).toThrow(RangeError)
    expect(() => fractionToBp(-0.1)).toThrow(RangeError)
    expect(percentToBp(25.31)).toBe(2531)
    expect(() => percentToBp(100)).toThrow(RangeError)
  })

  it("скидка вниз до копейки, «догросс» вверх до копейки", () => {
    expect(applyDiscountBp(916400, 4400)).toBe(513184)
    expect(applyDiscountBp(916400, 2500)).toBe(687300)
    expect(grossUpBp(513184, 4400)).toBe(916400)
    expect(grossUpBp(513184, 5500)).toBe(1140409)
    expect(() => grossUpBp(1, 10_000)).toThrow(RangeError)
  })
})

describe("округления цены", () => {
  it("вверх до рубля и до шага", () => {
    expect(ceilRub(1140409)).toBe(1140500)
    expect(ceilRub(1140400)).toBe(1140400)
    expect(ceilTo(10_000, 1434118)).toBe(1440000)
  })

  it("вверх до «…90 ₽»: 9 840 → 9 890, 9 890 → 9 890, 9 891 → 9 990, 50 → 90", () => {
    expect(roundUpEnding90(984000)).toBe(989000)
    expect(roundUpEnding90(989000)).toBe(989000)
    expect(roundUpEnding90(989100)).toBe(999000)
    expect(roundUpEnding90(5000)).toBe(9000)
  })
})

describe("дрейф и форматы", () => {
  it("относительное отклонение от текущего в bp; текущий 0 — бесконечность", () => {
    expect(driftBp(916400, 869000)).toBe(517)
    expect(driftBp(100000, 102000)).toBe(200)
    expect(driftBp(0, 1)).toBe(Number.POSITIVE_INFINITY)
  })

  it("копейки → строка API, рубли числом, текст для людей", () => {
    expect(minorToDecimalString(2063120)).toBe("20631.20")
    expect(minorToDecimalString(5)).toBe("0.05")
    expect(() => minorToDecimalString(-1)).toThrow(RangeError)
    expect(minorToRub(2063120)).toBe(20631.2)
    expect(formatRub(916400)).toBe("9 164,00 ₽")
    expect(formatRub(-47400)).toBe("−474,00 ₽")
    expect(formatSignedPctBp(-517)).toBe("−5,2 %")
    expect(formatSignedPctBp(4740)).toBe("+47,4 %")
  })
})
```
Run: `npx vitest run packages/shared/src/prices.test.ts` → FAIL (нет модуля).

- [ ] **Step 2: Реализация** — `packages/shared/src/prices.ts`:
```ts
import type { Channel } from "./channels"

/**
 * Базисные пункты: 10 000 = 100 %. Доли (ставки, скидки, СПП) в синке — целыми bp, как деньги —
 * целыми копейками: вся арифметика цены целочисленная (этап 2 синка v2).
 */
export const BP = 10_000

/** Доля 0 ≤ f < 1 (0.44) → bp (4400). Ставка 100 % и выше делает цену бесконечной — это ошибка данных. */
export function fractionToBp(f: number): number {
  if (!Number.isFinite(f) || f < 0 || f >= 1) throw new RangeError(`доля вне [0, 1): ${f}`)
  return Math.round(f * BP)
}

/** Процент площадки (25.31) → bp (2531). */
export function percentToBp(pct: number): number {
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) throw new RangeError(`процент вне [0, 100): ${pct}`)
  return Math.round(pct * 100)
}

/** minor × (1 − bp), вниз до копейки. */
export function applyDiscountBp(minor: number, bp: number): number {
  return Math.floor((minor * (BP - bp)) / BP)
}

/** minor / (1 − bp), вверх до копейки: цена, с которой после удержания bp остаётся не меньше minor. */
export function grossUpBp(minor: number, bp: number): number {
  if (bp < 0 || bp >= BP) throw new RangeError(`удержание вне [0, 100 %): ${bp} bp`)
  return Math.ceil((minor * BP) / (BP - bp))
}

/** Вверх до целого рубля. */
export function ceilRub(minor: number): number {
  return Math.ceil(minor / 100) * 100
}

/** Вверх до шага step (копейки). */
export function ceilTo(step: number, minor: number): number {
  return Math.ceil(minor / step) * step
}

/**
 * Вверх до цены с окончанием «…90 ₽» (психологическое округление модели v2, одобрено 17.07):
 * 9 840 ₽ → 9 890 ₽, 9 891 ₽ → 9 990 ₽. В копейках: шаг 100 ₽ = 10 000, окончание 90 ₽ = 9 000.
 */
export function roundUpEnding90(minor: number): number {
  return Math.ceil((minor - 9_000) / 10_000) * 10_000 + 9_000
}

/** |target − current| / current в bp; current ≤ 0 — бесконечность (сравнивать не с чем). */
export function driftBp(current: number, target: number): number {
  if (current <= 0) return Number.POSITIVE_INFINITY
  return Math.round((Math.abs(target - current) * BP) / current)
}

/** Копейки → десятичная строка API (Ozon, KIT): 2063120 → "20631.20". */
export function minorToDecimalString(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new RangeError(`не копейки: ${minor}`)
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`
}

/** Копейки → рубли числом (ЯМ принимает числа): 2063120 → 20631.2. */
export function minorToRub(minor: number): number {
  return Number(minorToDecimalString(minor))
}

/** Для людей: 916400 → «9 164,00 ₽». */
export function formatRub(minor: number): string {
  const sign = minor < 0 ? "−" : ""
  const abs = Math.abs(minor)
  const rub = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${sign}${rub},${String(abs % 100).padStart(2, "0")} ₽`
}

/** Для людей: −517 → «−5,2 %», 4740 → «+47,4 %». */
export function formatSignedPctBp(bp: number): string {
  const sign = bp < 0 ? "−" : "+"
  return `${sign}${(Math.abs(bp) / 100).toFixed(1).replace(".", ",")} %`
}

/** Цена карточки на WB (`discounts-prices`, `list/goods/filter`). */
export interface WbPriceRow {
  nmId: number
  vendorCode: string | null
  /** Цена до скидки, целые рубли — так её принимает `upload/task`. */
  priceRub: number
  /** Скидка продавца, целые %. */
  discountPct: number
  /** Цена продавца со скидкой («Цена со скидкой» ЛК) — её сторож сравнивает с прайсом. */
  discountedMinor: number
  /** У размеров разные цены со скидкой — с прайсом карточки не сравнивается. */
  sizesDiffer: boolean
}

/** Текущая цена товара на зеркале — вход плана записи цен. */
export interface MirrorPrice {
  channel: Channel
  /** Ключ товара на площадке: offer_id Ozon, offerId ЯМ, id варианта KIT, nmId сайта строкой. */
  externalSku: string
  /** Цена, которую ставит продавец (без акций площадки за её счёт). */
  priceMinor: number
  /** Зачёркнутая цена; null — не задана. */
  baseMinor: number | null
  /** Ozon `min_price`; у остальных null. */
  minMinor: number | null
  /** Ozon: комиссия FBS + эквайринг этого товара, bp; у остальных null. */
  takeBp: number | null
  /** Ozon: НДС, как его вернула площадка (передаётся при записи без изменений); у остальных null. */
  vat: string | null
}

/** Проданная единица из финотчёта WB с процентом СПП — вход коэффициента СПП. */
export interface SppSaleRow {
  sppBp: number
  quantity: number
  /** Дата операции `ГГГГ-ММ-ДД` (московский день отчёта). */
  opDate: string
}
```
`packages/shared/src/decisions.ts`:
```ts
/** Вопросы партнёрам с кнопками (спека §9, решение п. 15). */
export const DECISION_KINDS = ["wb_price_drift", "wb_price_new"] as const
export type DecisionKind = (typeof DECISION_KINDS)[number]

/**
 * open — ждёт ответа; answered — ответ получен, исполнит `prices`; done — исполнено; failed — не
 * исполнено (текст в result); closed — закрыт без ответа (цена вернулась к прайсу, прайс задан иначе).
 */
export const DECISION_STATUSES = ["open", "answered", "done", "failed", "closed"] as const
export type DecisionStatus = (typeof DECISION_STATUSES)[number]

export const DECISION_ANSWERS = ["accept", "autoaction", "return"] as const
export type DecisionAnswer = (typeof DECISION_ANSWERS)[number]

/** Что видел партнёр в момент вопроса. Деньги — копейки; priceRub/discountPct — как на WB. */
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

/** Кто поменял прайс: импорт CSV, кнопка партнёра, команда владельца. */
export const AGREED_PRICE_SOURCES = ["import", "button", "cli"] as const
export type AgreedPriceSource = (typeof AGREED_PRICE_SOURCES)[number]
```
`packages/shared/src/index.ts` — добавить:
```ts
export * from "./decisions"
export * from "./prices"
```

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/shared/src/prices.test.ts && npm run typecheck
git add packages/shared/src/prices.ts packages/shared/src/prices.test.ts packages/shared/src/decisions.ts packages/shared/src/index.ts
git commit -m "sync2: деньги и доли цен в bp, типы цен и вопросов"
```

---

### Task 2: Расчёт цен зеркал — Ozon, ЯМ, единая база (`@sync2/domain/pricing`)

Перенос `computeTarget`/`fitBase` из `sync/src/pricing.ts` в копейки. Чего **не** повторяем из v1: якорь — прайс, а не живая витрина WB; WB в расчёте не пишется (запись WB — только кнопкой «вернуть», Task 3); `min_price` Ozon — порог равного нетто, а не финалка × 0,95; ЯМ — с доставкой покупателю.

**Files:**
- Create: `packages/domain/src/pricing.ts`, `packages/domain/src/pricing.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/domain/src/pricing.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { fitWbBase, mirrorPrices, ymNet, ymPriceForNet, type MirrorPriceInput, type PricePolicy, type SubjectRates } from "./pricing"

const POLICY: PricePolicy = {
  headroomBp: 1500,
  roundBaseToMinor: 10_000,
  minDiscountBp: 500,
  wbMinDiscountPct: 3,
  wbMaxDiscountPct: 95,
  ozonMinDiscountMinor: 50_000,
}
const BRACELETS: SubjectRates = { takeWbBp: 4400, takeOzonBp: 5500, takeYmBp: 5280 }
const input = (over: Partial<MirrorPriceInput> = {}): MirrorPriceInput => ({
  agreedMinor: 916400,
  rates: BRACELETS,
  ozonTakeBp: null,
  hasOzon: true,
  hasYm: true,
  sppBp: null,
  deliveryMinor: { kit: null, site: null },
  ...over,
})

describe("fitWbBase — целая скидка WB, цена со скидкой не сдвигается ни на копейку", () => {
  it("браслет 2041383032873: прайс 9 164 ₽, требуемая база 14 400 ₽ → 15 800 ₽ и 42 % (как на WB 28.09)", () => {
    expect(fitWbBase(916400, 1440000, 3, 95)).toEqual({ priceRub: 15800, discountPct: 42, exact: true })
    expect(15800 * (100 - 42)).toBe(916400)
  })

  it("требуемая база недостижима при скидке ≤ 95 % — неточная подгонка на пределе", () => {
    expect(fitWbBase(100000, 100_000_000, 3, 95)).toEqual({ priceRub: 20000, discountPct: 95, exact: false })
  })
})

describe("mirrorPrices — Ozon и ЯМ по равному нетто, единая база", () => {
  it("браслет: нетто WB 5 131,84 ₽; Ozon 11 490 ₽ (min 11 405 ₽); ЯМ 12 190 ₽; база 15 800 ₽", () => {
    const r = mirrorPrices(input(), POLICY)
    expect(r.netWbMinor).toBe(513184)
    expect(r.ozon).toEqual({ priceMinor: 1149000, oldMinor: 1580000, minMinor: 1140500 })
    expect(r.ym).toEqual({ priceMinor: 1219000, baseMinor: 1580000 })
    expect(r.baseMinor).toBe(1580000)
    expect(r.wbFit).toEqual({ priceRub: 15800, discountPct: 42, exact: true })
    expect(ymNet(1219000, 5280)).toBeGreaterThanOrEqual(513184)
  })

  it("живая ставка Ozon товара важнее ставки предмета", () => {
    const r = mirrorPrices(input({ rates: { ...BRACELETS, takeOzonBp: null }, ozonTakeBp: 5000 }), POLICY)
    expect(r.ozon).toMatchObject({ priceMinor: 1029000, minMinor: 1026400 })
  })

  it("нет ставки Ozon ни у товара, ни у предмета — Ozon пропущен с причиной", () => {
    const r = mirrorPrices(input({ rates: { ...BRACELETS, takeOzonBp: null } }), POLICY)
    expect(r.ozon).toBeNull()
    expect(r.skips).toContain("no-ozon-rate")
  })

  it("товара нет на площадке — ни цели, ни причины", () => {
    const r = mirrorPrices(input({ hasOzon: false, hasYm: false }), POLICY)
    expect(r.ozon).toBeNull()
    expect(r.ym).toBeNull()
    expect(r.skips).toEqual(["no-spp"])
  })

  it("нет ставок предмета — ничего не считается", () => {
    const r = mirrorPrices(input({ rates: null }), POLICY)
    expect(r).toMatchObject({ netWbMinor: null, baseMinor: null, ozon: null, ym: null, kit: null, site: null, skips: ["no-rates"] })
  })

  it("прайс не задан или не число — ничего не считается", () => {
    expect(mirrorPrices(input({ agreedMinor: 0 }), POLICY).skips).toEqual(["no-agreed-price"])
  })

  it("база не помещается в скидку WB 95 % — зеркала Ozon/ЯМ пропущены (base-overflow)", () => {
    const r = mirrorPrices(input({ agreedMinor: 100, rates: { takeWbBp: 100, takeOzonBp: 9900, takeYmBp: null }, hasYm: false }), POLICY)
    expect(r.ozon).toBeNull()
    expect(r.skips).toContain("base-overflow")
  })
})

describe("ЯМ — доставка покупателю 5 %, не больше 1 000 ₽", () => {
  it("до 20 000 ₽ доставка 5 %", () => {
    expect(ymPriceForNet(513184, 5280)).toBe(1219000)
  })

  it("дороже 20 000 ₽ доставка упирается в 1 000 ₽: метеорит 69 289,50 ₽ → 83 790 ₽", () => {
    const net = 3810922
    const p = ymPriceForNet(net, 5330)
    expect(p).toBe(8379000)
    expect(ymNet(p, 5330)).toBeGreaterThanOrEqual(net)
  })
})
```
Run: `npx vitest run packages/domain/src/pricing.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `packages/domain/src/pricing.ts`:
```ts
// Перенос sync/src/pricing.ts (computeTarget, fitBase — модель v2 «единая база + скидки по комиссиям»,
// 16.07.2026) в копейки и bp, этап 2 синка v2. Якорь — согласованный прайс (решение 25.09, п. 8), не живая
// цена WB; WB здесь не пишется — только цель для кнопки «вернуть» (wbReturnTarget).
import { BP, applyDiscountBp, ceilRub, ceilTo, grossUpBp, roundUpEnding90 } from "@sync2/shared"

export interface PricePolicy {
  /** Запас базы над самой дорогой финалкой (1500 = 15 %). */
  headroomBp: number
  /** Шаг базы (10 000 = 100 ₽). */
  roundBaseToMinor: number
  /** Минимальная скидка на Ozon/ЯМ (500 = 5 %). */
  minDiscountBp: number
  wbMinDiscountPct: number
  wbMaxDiscountPct: number
  /** Ozon: old_price − price не меньше (50 000 = 500 ₽). */
  ozonMinDiscountMinor: number
}

/** Удержание площадки с цены (комиссия + эквайринг), bp. null — ставки нет. */
export interface SubjectRates {
  takeWbBp: number
  takeOzonBp: number | null
  takeYmBp: number | null
}

/** ЯМ: доставка покупателю 5 % от цены, не больше 1 000 ₽ (решение 25.09, п. 9; спека §6). */
export const YM_DELIVERY_BP = 500
export const YM_DELIVERY_CAP_MINOR = 100_000

export interface WbFit {
  priceRub: number
  discountPct: number
  /** true — priceRub × (100 − discountPct) ровно равно прайсу в копейках. */
  exact: boolean
}

/**
 * fitBase v1 в копейках: наименьшая целая скидка d ≥ нужной, при которой цена до скидки — целые рубли и
 * priceRub × (100 − d) == прайс (копейки). Цена со скидкой на WB = priceRub × 100 × (100 − d) / 100 копеек.
 * Точного делителя до maxD нет — округлённая цена, цена со скидкой может уехать на копейки.
 */
export function fitWbBase(agreedMinor: number, requiredMinMinor: number, minD: number, maxD: number): WbFit {
  const need = Math.ceil((100 * (requiredMinMinor - agreedMinor)) / requiredMinMinor)
  const dStart = Math.max(minD, need)
  for (let d = dStart; d <= maxD; d++) {
    if (agreedMinor % (100 - d) === 0) return { priceRub: agreedMinor / (100 - d), discountPct: d, exact: true }
  }
  const d = Math.min(dStart, maxD)
  return { priceRub: Math.round(agreedMinor / (100 - d)), discountPct: d, exact: false }
}

/** Цена ЯМ, с которой нетто (цена − ставка − доставка) не ниже нетто WB, вверх до ₽…90. */
export function ymPriceForNet(netMinor: number, takeYmBp: number): number {
  const withPercentDelivery = grossUpBp(netMinor, takeYmBp + YM_DELIVERY_BP)
  const price =
    (withPercentDelivery * YM_DELIVERY_BP) / BP <= YM_DELIVERY_CAP_MINOR
      ? withPercentDelivery
      : grossUpBp(netMinor + YM_DELIVERY_CAP_MINOR, takeYmBp)
  return roundUpEnding90(price)
}

/** Нетто ЯМ с цены: цена − ставка − доставка (5 %, ≤ 1 000 ₽). */
export function ymNet(priceMinor: number, takeYmBp: number): number {
  return applyDiscountBp(priceMinor, takeYmBp) - Math.min(Math.floor((priceMinor * YM_DELIVERY_BP) / BP), YM_DELIVERY_CAP_MINOR)
}

/** Цена своей витрины (KIT, сайт) и зачёркнутая. */
export interface OwnStorePrice {
  priceMinor: number
  /** Единая база, если она выше цены; иначе null — без зачёркнутой. */
  baseMinor: number | null
}

/**
 * KIT и сайт (решение 25.09, п. 10): прайс × (1 − k), не ниже нетто WB + доставка, вверх до ₽…90, не выше
 * прайса — потолок побеждает округление и пол (пол выше прайса бывает только при дорогой доставке дешёвого
 * товара — тогда прайс).
 */
export function ownStorePrice(agreedMinor: number, netWbMinor: number, sppBp: number, deliveryMinor: number, baseMinor: number | null): OwnStorePrice {
  const raw = applyDiscountBp(agreedMinor, sppBp)
  const price = Math.min(roundUpEnding90(Math.max(raw, netWbMinor + deliveryMinor)), agreedMinor)
  return { priceMinor: price, baseMinor: baseMinor !== null && baseMinor > price ? baseMinor : null }
}

export interface MirrorPriceInput {
  agreedMinor: number
  rates: SubjectRates | null
  /** Живая ставка Ozon этого товара (комиссия FBS + эквайринг), bp; null — ставка предмета. */
  ozonTakeBp: number | null
  hasOzon: boolean
  hasYm: boolean
  /** Действующий коэффициент СПП, bp; null — ещё не посчитан. */
  sppBp: number | null
  /** Доставка за счёт продавца, копейки; null — владелец её не задал. */
  deliveryMinor: { kit: number | null; site: number | null }
}

export interface MirrorPrices {
  netWbMinor: number | null
  /** Единая база — зачёркнутая на всех зеркалах; null — не посчитана. */
  baseMinor: number | null
  wbFit: WbFit | null
  ozon: { priceMinor: number; oldMinor: number; minMinor: number } | null
  ym: { priceMinor: number; baseMinor: number } | null
  kit: OwnStorePrice | null
  site: OwnStorePrice | null
  /** Причины пропусков: no-agreed-price, no-rates, no-ozon-rate, no-ym-rate, base-overflow, no-spp, no-delivery-kit, no-delivery-site. */
  skips: string[]
}

/** Цели цены на четыре зеркала из прайса одной карточки. Чистая функция. */
export function mirrorPrices(input: MirrorPriceInput, policy: PricePolicy): MirrorPrices {
  const out: MirrorPrices = { netWbMinor: null, baseMinor: null, wbFit: null, ozon: null, ym: null, kit: null, site: null, skips: [] }
  if (!Number.isSafeInteger(input.agreedMinor) || input.agreedMinor <= 0) {
    out.skips.push("no-agreed-price")
    return out
  }
  if (!input.rates) {
    out.skips.push("no-rates")
    return out
  }
  const net = applyDiscountBp(input.agreedMinor, input.rates.takeWbBp)
  out.netWbMinor = net

  // Финалки зеркал: полная компенсация удержаний, излишек округления — в нетто продавца.
  let ozon: { priceMinor: number; minMinor: number } | null = null
  if (input.hasOzon) {
    const take = input.ozonTakeBp ?? input.rates.takeOzonBp
    if (take === null) out.skips.push("no-ozon-rate")
    else {
      const threshold = grossUpBp(net, take)
      ozon = { priceMinor: roundUpEnding90(threshold), minMinor: ceilRub(threshold) }
    }
  }
  let ymPrice: number | null = null
  if (input.hasYm) {
    if (input.rates.takeYmBp === null) out.skips.push("no-ym-rate")
    else ymPrice = ymPriceForNet(net, input.rates.takeYmBp)
  }

  // Требуемый минимум базы (v1): запас над самой дорогой финалкой, мин. скидка на Ozon/ЯМ, рублёвая разница Ozon.
  const finalMax = Math.max(input.agreedMinor, ozon?.priceMinor ?? 0, ymPrice ?? 0)
  let required = grossUpBp(finalMax, policy.headroomBp)
  if (ozon) required = Math.max(required, ozon.priceMinor + policy.ozonMinDiscountMinor, grossUpBp(ozon.priceMinor, policy.minDiscountBp))
  if (ymPrice !== null) required = Math.max(required, grossUpBp(ymPrice, policy.minDiscountBp))
  required = ceilTo(policy.roundBaseToMinor, required)
  const fit = fitWbBase(input.agreedMinor, required, policy.wbMinDiscountPct, policy.wbMaxDiscountPct)
  const base = fit.priceRub * 100
  if (base < required) {
    out.skips.push("base-overflow")
  } else {
    out.baseMinor = base
    out.wbFit = fit
    if (ozon) out.ozon = { priceMinor: ozon.priceMinor, oldMinor: base, minMinor: ozon.minMinor }
    if (ymPrice !== null) out.ym = { priceMinor: ymPrice, baseMinor: base }
  }

  if (input.sppBp === null) out.skips.push("no-spp")
  else {
    for (const c of ["kit", "site"] as const) {
      const delivery = input.deliveryMinor[c]
      if (delivery === null) {
        out.skips.push(`no-delivery-${c}`)
        continue
      }
      out[c] = ownStorePrice(input.agreedMinor, net, input.sppBp, delivery, out.baseMinor)
    }
  }
  return out
}
```
`packages/domain/src/index.ts` — добавить `export * from "./pricing"`.

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/domain/src/pricing.test.ts && npm run typecheck
git add packages/domain/src/pricing.ts packages/domain/src/pricing.test.ts packages/domain/src/index.ts
git commit -m "sync2: расчёт цен зеркал в копейках — перенос fitBase, Ozon и ЯМ по равному нетто, ЯМ с доставкой"
```

---

### Task 3: KIT и сайт от коэффициента СПП; цель кнопки «вернуть WB к прайсу»

**Files:**
- Modify: `packages/domain/src/pricing.ts`, `packages/domain/src/pricing.test.ts`

- [ ] **Step 1: Падающие тесты** — в конец `packages/domain/src/pricing.test.ts` (импорт дополнить `ownStorePrice`, `wbReturnTarget`):
```ts
describe("KIT и сайт — прайс × (1 − k), пол нетто WB + доставка, потолок прайс, ₽…90", () => {
  const withSpp = (sppBp: number) => input({ sppBp, deliveryMinor: { kit: 40_000, site: 40_000 } })

  it("k = 25 %: 6 873 ₽ → 6 890 ₽, зачёркнутая — единая база 15 800 ₽", () => {
    const r = mirrorPrices(withSpp(2500), POLICY)
    expect(r.kit).toEqual({ priceMinor: 689000, baseMinor: 1580000 })
    expect(r.site).toEqual({ priceMinor: 689000, baseMinor: 1580000 })
  })

  it("k = 50 %: ниже пола (5 131,84 + 400 ₽) — пол, округлённый до 5 590 ₽", () => {
    expect(mirrorPrices(withSpp(5000), POLICY).kit).toEqual({ priceMinor: 559000, baseMinor: 1580000 })
  })

  it("k = 0: округление выше прайса — прайс (потолок)", () => {
    expect(mirrorPrices(withSpp(0), POLICY).kit).toEqual({ priceMinor: 916400, baseMinor: 1580000 })
  })

  it("пол выше прайса (дорогая доставка дешёвого товара) — прайс", () => {
    expect(ownStorePrice(100_000, 56_000, 2500, 50_000, null)).toEqual({ priceMinor: 100_000, baseMinor: null })
  })

  it("нет k — KIT и сайт не считаются; нет доставки площадки — только она", () => {
    expect(mirrorPrices(input(), POLICY)).toMatchObject({ kit: null, site: null })
    const r = mirrorPrices(input({ sppBp: 2500, deliveryMinor: { kit: 40_000, site: null } }), POLICY)
    expect(r.kit).not.toBeNull()
    expect(r.site).toBeNull()
    expect(r.skips).toContain("no-delivery-site")
  })
})

describe("wbReturnTarget — вернуть цену продавца WB к прайсу", () => {
  const range = { wbMinDiscountPct: 3, wbMaxDiscountPct: 95 }

  it("цена до скидки на WB делит прайс — меняется только скидка", () => {
    expect(wbReturnTarget({ priceRub: 15800 }, 916400, null, range)).toEqual({ priceRub: 15800, discountPct: 42, exact: true })
  })

  it("не делит — запасной вариант (fitWbBase от текущей цены до скидки)", () => {
    const fallback = fitWbBase(916400, 1600000, 3, 95)
    expect(wbReturnTarget({ priceRub: 16000 }, 916400, fallback, range)).toEqual(fallback)
  })

  it("скидка вышла бы за 3–95 % — запасной вариант; его нет — null", () => {
    expect(wbReturnTarget({ priceRub: 9164 }, 916400, null, range)).toBeNull()
  })
})
```
Run: `npx vitest run packages/domain/src/pricing.test.ts` → FAIL (`wbReturnTarget` нет).

- [ ] **Step 2: Реализация** — в конец `packages/domain/src/pricing.ts`:
```ts
/**
 * Цель записи WB по кнопке «вернуть к прайсу». Сначала — оставить цену до скидки как есть и подобрать
 * целую скидку (автоакция WB меняет именно скидку); не выходит — запасной вариант (вызывающий передаёт
 * fitWbBase от текущей цены до скидки). null — вернуть нельзя (скидка вне 3–95 % и запасного нет).
 */
export function wbReturnTarget(
  current: { priceRub: number },
  agreedMinor: number,
  fallback: WbFit | null,
  policy: Pick<PricePolicy, "wbMinDiscountPct" | "wbMaxDiscountPct">,
): WbFit | null {
  const p = current.priceRub
  if (p > 0 && agreedMinor % p === 0) {
    const d = 100 - agreedMinor / p
    if (d >= policy.wbMinDiscountPct && d <= policy.wbMaxDiscountPct) return { priceRub: p, discountPct: d, exact: true }
  }
  return fallback
}
```

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/domain/src/pricing.test.ts && npm run typecheck
git add packages/domain/src/pricing.ts packages/domain/src/pricing.test.ts
git commit -m "sync2: KIT и сайт от коэффициента СПП с полом и потолком; цель возврата WB к прайсу"
```

---

### Task 4: План записи цен — анти-флаппинг 2 %, кап 60 % (`@sync2/domain/price-plan`)

**Files:**
- Create: `packages/domain/src/price-plan.ts`, `packages/domain/src/price-plan.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/domain/src/price-plan.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { MAX_PRICE_CHANGES_PER_RUN, PRICE_MAX_CHANGE_BP, PRICE_MIN_CHANGE_BP, planPriceWrites, priceKey, type CurrentPrice, type PriceTarget } from "./price-plan"

const t = (sku: string, priceMinor: number, baseMinor: number | null = null, minMinor: number | null = null): PriceTarget => ({
  channel: "ozon",
  barcode: `B-${sku}`,
  externalSku: sku,
  priceMinor,
  baseMinor,
  minMinor,
})
const cur = (entries: Array<[string, CurrentPrice]>) => new Map(entries.map(([sku, c]) => [priceKey("ozon", sku), c]))
const c = (priceMinor: number, baseMinor: number | null = null, minMinor: number | null = null): CurrentPrice => ({ priceMinor, baseMinor, minMinor })

describe("planPriceWrites", () => {
  it("пороги спеки: 2 %, 60 %, 400 изменений", () => {
    expect([PRICE_MIN_CHANGE_BP, PRICE_MAX_CHANGE_BP, MAX_PRICE_CHANGES_PER_RUN]).toEqual([200, 6000, 400])
  })

  it("цена ушла на 2 % и меньше — не пишем; больше 2 % — пишем с «было»", () => {
    const plan = planPriceWrites([t("A", 102000), t("B", 102100)], cur([["A", c(100000)], ["B", c(100000)]]))
    expect(plan.changes.map((x) => [x.externalSku, x.before.priceMinor, x.priceMinor])).toEqual([["B", 100000, 102100]])
  })

  it("зачёркнутая ушла больше 2 % или её нет — пишем; цель без зачёркнутой зачёркнутую площадки не трогает", () => {
    const plan = planPriceWrites(
      [t("A", 100000, 160000), t("B", 100000, 160000), t("C", 100000, null)],
      cur([["A", c(100000, 150000)], ["B", c(100000, null)], ["C", c(100000, 150000)]]),
    )
    expect(plan.changes.map((x) => x.externalSku)).toEqual(["A", "B"])
  })

  it("min_price Ozon отличается хоть на копейку — пишем", () => {
    const plan = planPriceWrites([t("A", 100000, 150000, 95001)], cur([["A", c(100000, 150000, 95000)]]))
    expect(plan.changes).toHaveLength(1)
  })

  it("изменение больше 60 % — не пишем, в capped с дрейфом; текущая 0 (новый товар сайта) — пишем", () => {
    const plan = planPriceWrites([t("A", 170000), t("B", 170000)], cur([["A", c(100000)], ["B", c(0)]]))
    expect(plan.capped.map((x) => [x.externalSku, x.driftBp])).toEqual([["A", 7000]])
    expect(plan.changes.map((x) => x.externalSku)).toEqual(["B"])
  })

  it("товара с таким ключом на площадке нет — в missing, не пишем", () => {
    const plan = planPriceWrites([t("A", 100000)], cur([]))
    expect(plan.missing.map((x) => x.externalSku)).toEqual(["A"])
    expect(plan.changes).toEqual([])
  })
})
```
Run: `npx vitest run packages/domain/src/price-plan.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `packages/domain/src/price-plan.ts`:
```ts
// План записи цен на зеркала (этап 2 синка v2, спека §6): анти-флаппинг 2 %, кап 60 %. Предел 400 изменений
// за прогон — по всем зеркалам сразу, его проверяет джоба prices (MAX_PRICE_CHANGES_PER_RUN).
import { driftBp, type Channel } from "@sync2/shared"

/** Меньше — не пишем: цена «дрожит» от пересчёта, а площадка считает каждую запись (Ozon — 10 раз в час). */
export const PRICE_MIN_CHANGE_BP = 200
/** Больше — не пишем, алерт: так двигается цена только при ошибке прайса, ставки или ключа. */
export const PRICE_MAX_CHANGE_BP = 6_000
/** Больше изменений за прогон по всем зеркалам — не пишем ничего, алерт (как prices_abort_if_changes_over v1). */
export const MAX_PRICE_CHANGES_PER_RUN = 400

export interface PriceTarget {
  channel: Channel
  barcode: string
  externalSku: string
  priceMinor: number
  /** Зачёркнутая; null — цель её не задаёт (зачёркнутая площадки не меняется). */
  baseMinor: number | null
  /** Ozon min_price; у остальных null. */
  minMinor: number | null
}

export interface CurrentPrice {
  priceMinor: number
  baseMinor: number | null
  minMinor: number | null
}

export interface PriceChange extends PriceTarget {
  before: CurrentPrice
}

export interface PricePlan {
  changes: PriceChange[]
  capped: Array<PriceChange & { driftBp: number }>
  missing: PriceTarget[]
}

export const priceKey = (channel: Channel, externalSku: string): string => `${channel}\u0000${externalSku}`

/** Нужна ли запись: цена или зачёркнутая ушли больше чем на 2 %, либо min_price не равна цели. */
export function needsPriceWrite(cur: CurrentPrice, t: PriceTarget): boolean {
  if (driftBp(cur.priceMinor, t.priceMinor) > PRICE_MIN_CHANGE_BP) return true
  if (t.baseMinor !== null && (cur.baseMinor === null || driftBp(cur.baseMinor, t.baseMinor) > PRICE_MIN_CHANGE_BP)) return true
  if (t.minMinor !== null && cur.minMinor !== t.minMinor) return true
  return false
}

/** Чистая функция: цели против текущих цен площадки (ключ — priceKey). */
export function planPriceWrites(targets: readonly PriceTarget[], current: ReadonlyMap<string, CurrentPrice>): PricePlan {
  const plan: PricePlan = { changes: [], capped: [], missing: [] }
  for (const t of targets) {
    const cur = current.get(priceKey(t.channel, t.externalSku))
    if (!cur) {
      plan.missing.push(t)
      continue
    }
    if (!needsPriceWrite(cur, t)) continue
    const drift = driftBp(cur.priceMinor, t.priceMinor)
    if (cur.priceMinor > 0 && drift > PRICE_MAX_CHANGE_BP) {
      plan.capped.push({ ...t, before: cur, driftBp: drift })
      continue
    }
    plan.changes.push({ ...t, before: cur })
  }
  return plan
}
```
`packages/domain/src/index.ts` — добавить `export * from "./price-plan"`.

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/domain/src/price-plan.test.ts && npm run typecheck
git add packages/domain/src/price-plan.ts packages/domain/src/price-plan.test.ts packages/domain/src/index.ts
git commit -m "sync2: план записи цен — анти-флаппинг 2 %, кап 60 %, товары без ключа"
```

---

### Task 5: Сторож WB (`@sync2/domain/price-watch`)

**Files:**
- Create: `packages/domain/src/price-watch.ts`, `packages/domain/src/price-watch.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/domain/src/price-watch.test.ts`:
```ts
import type { WbPriceRow } from "@sync2/shared"
import { describe, expect, it } from "vitest"
import { WATCH_DRIFT_BP, watchWbPrices, type OpenDecisionRef } from "./price-watch"

const row = (nmId: number, discountedMinor: number, over: Partial<WbPriceRow> = {}): WbPriceRow => ({
  nmId,
  vendorCode: `JW-${nmId}`,
  priceRub: 15800,
  discountPct: 45,
  discountedMinor,
  sizesDiffer: false,
  ...over,
})
const agreed = (entries: Array<[number, number]>) => new Map(entries.map(([nmId, priceMinor]) => [nmId, { nmId, priceMinor }]))
const run = (over: Partial<Parameters<typeof watchWbPrices>[0]> = {}) =>
  watchWbPrices({ rows: [], agreed: agreed([]), inStock: new Set(), open: [], muted: new Map(), ...over })

describe("watchWbPrices", () => {
  it("порог — 1 %", () => {
    expect(WATCH_DRIFT_BP).toBe(100)
  })

  it("цена WB ушла от прайса больше чем на 1 % — вопрос с тем, что видел партнёр; в пределах 1 % — молчим", () => {
    const r = run({ rows: [row(1, 869000), row(2, 912000)], agreed: agreed([[1, 916400], [2, 916400]]) })
    expect(r.open).toEqual([
      { kind: "wb_price_drift", nmId: 1, vendorCode: "JW-1", agreedMinor: 916400, observedMinor: 869000, priceRub: 15800, discountPct: 45 },
    ])
    expect(r.counters).toMatchObject({ compared: 2, drift: 1 })
  })

  it("вопрос уже открыт — повторно не спрашиваем; цена вернулась — открытый вопрос закрывается", () => {
    const open: OpenDecisionRef[] = [
      { id: 7, kind: "wb_price_drift", nmId: 1 },
      { id: 8, kind: "wb_price_drift", nmId: 2 },
    ]
    const r = run({ rows: [row(1, 869000), row(2, 916400)], agreed: agreed([[1, 916400], [2, 916400]]), open })
    expect(r.open).toEqual([])
    expect(r.close).toEqual([{ id: 8, reason: "цена WB вернулась к прайсу" }])
  })

  it("«автоакция» глушит, пока цена WB в пределах 1 % от названной; ушла дальше — снова вопрос", () => {
    const base = { agreed: agreed([[1, 916400], [2, 916400]]), muted: new Map([[1, 869000], [2, 869000]]) }
    const r = run({ ...base, rows: [row(1, 870000), row(2, 820000)] })
    expect(r.open.map((d) => d.nmId)).toEqual([2])
    expect(r.counters.muted).toBe(1)
  })

  it("товар в наличии без прайса — вопрос «принять как прайс»; не в наличии — молчим; уже спрошен — молчим", () => {
    const r = run({
      rows: [row(3, 500000), row(4, 500000), row(5, 500000)],
      inStock: new Set([3, 5]),
      open: [{ id: 9, kind: "wb_price_new", nmId: 5 }],
    })
    expect(r.open).toEqual([{ kind: "wb_price_new", nmId: 3, vendorCode: "JW-3", agreedMinor: null, observedMinor: 500000, priceRub: 15800, discountPct: 45 }])
    expect(r.counters.newWithoutPrice).toBe(2)
  })

  it("вопрос «без прайса», а прайс уже задан (CLI, импорт) — закрывается", () => {
    const r = run({ agreed: agreed([[5, 500000]]), open: [{ id: 9, kind: "wb_price_new", nmId: 5 }] })
    expect(r.close).toEqual([{ id: 9, reason: "прайс уже задан" }])
  })

  it("разные цены размеров — не сравниваем, считаем", () => {
    const r = run({ rows: [row(1, 869000, { sizesDiffer: true })], agreed: agreed([[1, 916400]]) })
    expect(r.open).toEqual([])
    expect(r.counters.sizesDiffer).toBe(1)
  })
})
```
Run: `npx vitest run packages/domain/src/price-watch.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `packages/domain/src/price-watch.ts`:
```ts
// Сторож цены продавца WB (решение 25.09, п. 8; спека §6): отклонение от прайса не копируется, а выносится
// на кнопки. Чистая функция: вход — снимок цен WB, прайс, открытые вопросы, «заглушки» автоакций.
import { driftBp, type DecisionKind, type WbPriceRow } from "@sync2/shared"

/** Расхождение цены WB с прайсом больше 1 % — вопрос (спека §6). */
export const WATCH_DRIFT_BP = 100

export interface WatchAgreed {
  nmId: number
  priceMinor: number
}

export interface OpenDecisionRef {
  id: number
  kind: DecisionKind
  nmId: number
}

export interface NewDecision {
  kind: DecisionKind
  nmId: number
  vendorCode: string | null
  agreedMinor: number | null
  observedMinor: number
  priceRub: number
  discountPct: number
}

export interface WatchResult {
  open: NewDecision[]
  close: Array<{ id: number; reason: string }>
  counters: { compared: number; drift: number; muted: number; sizesDiffer: number; newWithoutPrice: number }
}

export function watchWbPrices(input: {
  rows: readonly WbPriceRow[]
  agreed: ReadonlyMap<number, WatchAgreed>
  /** nmId с остатком в пуле — вопрос «без прайса» только про товары в наличии. */
  inStock: ReadonlySet<number>
  /** Открытые (без ответа) вопросы. */
  open: readonly OpenDecisionRef[]
  /** nmId → цена WB, которую партнёр последним ответом назвал автоакцией. */
  muted: ReadonlyMap<number, number>
}): WatchResult {
  const res: WatchResult = { open: [], close: [], counters: { compared: 0, drift: 0, muted: 0, sizesDiffer: 0, newWithoutPrice: 0 } }
  const openBy = new Map(input.open.map((d) => [`${d.kind}:${d.nmId}`, d]))
  for (const row of input.rows) {
    if (row.sizesDiffer) {
      res.counters.sizesDiffer++
      continue
    }
    const seen = { nmId: row.nmId, vendorCode: row.vendorCode, observedMinor: row.discountedMinor, priceRub: row.priceRub, discountPct: row.discountPct }
    const agreed = input.agreed.get(row.nmId)
    if (!agreed) {
      if (!input.inStock.has(row.nmId)) continue
      res.counters.newWithoutPrice++
      if (!openBy.has(`wb_price_new:${row.nmId}`)) res.open.push({ kind: "wb_price_new", agreedMinor: null, ...seen })
      continue
    }
    res.counters.compared++
    const openDrift = openBy.get(`wb_price_drift:${row.nmId}`)
    if (driftBp(agreed.priceMinor, row.discountedMinor) <= WATCH_DRIFT_BP) {
      if (openDrift) res.close.push({ id: openDrift.id, reason: "цена WB вернулась к прайсу" })
      continue
    }
    res.counters.drift++
    if (openDrift) continue
    const mutedAt = input.muted.get(row.nmId)
    if (mutedAt !== undefined && driftBp(mutedAt, row.discountedMinor) <= WATCH_DRIFT_BP) {
      res.counters.muted++
      continue
    }
    res.open.push({ kind: "wb_price_drift", agreedMinor: agreed.priceMinor, ...seen })
  }
  for (const d of input.open) if (d.kind === "wb_price_new" && input.agreed.has(d.nmId)) res.close.push({ id: d.id, reason: "прайс уже задан" })
  return res
}
```
Порядок ключей в `NewDecision` для `toEqual` не важен. `index.ts` — добавить `export * from "./price-watch"`.

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/domain/src/price-watch.test.ts && npm run typecheck
git add packages/domain/src/price-watch.ts packages/domain/src/price-watch.test.ts packages/domain/src/index.ts
git commit -m "sync2: сторож цены WB — вопрос при отклонении > 1 %, без повторов, заглушка автоакции, товары без прайса"
```

---

### Task 6: Коэффициент СПП — медиана и гистерезис (`@sync2/domain/spp`)

**Files:**
- Create: `packages/domain/src/spp.ts`, `packages/domain/src/spp.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/domain/src/spp.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { SPP_HYSTERESIS_BP, SPP_MIN_SALES, SPP_WINDOW_DAYS, nextSppCoefficient, sppMedian } from "./spp"

const sale = (sppBp: number, opDate = "2026-09-20", quantity = 1) => ({ sppBp, quantity, opDate })

describe("sppMedian — по единицам проданного в окне дат", () => {
  it("константы решения: 30 дней, от 10 продаж, гистерезис 3 п.п.", () => {
    expect([SPP_WINDOW_DAYS, SPP_MIN_SALES, SPP_HYSTERESIS_BP]).toEqual([30, 10, 300])
  })

  it("нечётное число — середина, чётное — среднее двух, округление", () => {
    expect(sppMedian([sale(2000), sale(3000), sale(2500)], "2026-09-01", "2026-09-30")).toEqual({ medianBp: 2500, sales: 3 })
    expect(sppMedian([sale(2000), sale(2501)], "2026-09-01", "2026-09-30")).toEqual({ medianBp: 2251, sales: 2 })
  })

  it("количество больше 1 — столько единиц; вне окна и нулевые — не считаются", () => {
    const r = sppMedian([sale(1000, "2026-09-20", 3), sale(3000), sale(9000, "2026-08-01"), sale(9000, "2026-09-20", 0)], "2026-09-01", "2026-09-30")
    expect(r).toEqual({ medianBp: 1000, sales: 4 })
  })

  it("продаж нет — медианы нет", () => {
    expect(sppMedian([], "2026-09-01", "2026-09-30")).toEqual({ medianBp: null, sales: 0 })
  })
})

describe("nextSppCoefficient — порог срабатывания 3 п.п.", () => {
  it("первое значение — сразу", () => {
    expect(nextSppCoefficient(null, { medianBp: 2500, sales: 40 })).toEqual({ activeBp: 2500, changed: true, reason: "first" })
  })

  it("разница 3 п.п. и больше — новое; меньше — прежнее", () => {
    expect(nextSppCoefficient(2500, { medianBp: 2800, sales: 40 })).toEqual({ activeBp: 2800, changed: true, reason: "hysteresis" })
    expect(nextSppCoefficient(2500, { medianBp: 2799, sales: 40 })).toEqual({ activeBp: 2500, changed: false, reason: "below-threshold" })
  })

  it("меньше 10 продаж или нет данных — k не меняется", () => {
    expect(nextSppCoefficient(2500, { medianBp: 4000, sales: 9 })).toEqual({ activeBp: 2500, changed: false, reason: "too-few-sales" })
    expect(nextSppCoefficient(null, { medianBp: null, sales: 0 })).toEqual({ activeBp: null, changed: false, reason: "no-data" })
  })
})
```
Run: `npx vitest run packages/domain/src/spp.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `packages/domain/src/spp.ts`:
```ts
// Коэффициент СПП для KIT и сайта (решение 25.09, п. 10; спека §6): медиана СПП магазина за 30 дней по
// выкупам из финотчёта WB, пересчёт раз в неделю, порог срабатывания 3 п.п., при < 10 выкупах — без изменений.
import type { SppSaleRow } from "@sync2/shared"

export const SPP_WINDOW_DAYS = 30
export const SPP_MIN_SALES = 10
export const SPP_HYSTERESIS_BP = 300

/** Медиана СПП (bp) по единицам проданного с датой операции в [fromDate, toDate] (ГГГГ-ММ-ДД включительно). */
export function sppMedian(rows: readonly SppSaleRow[], fromDate: string, toDate: string): { medianBp: number | null; sales: number } {
  const values: number[] = []
  for (const r of rows) {
    if (r.opDate < fromDate || r.opDate > toDate || r.quantity <= 0) continue
    for (let i = 0; i < r.quantity; i++) values.push(r.sppBp)
  }
  if (values.length === 0) return { medianBp: null, sales: 0 }
  values.sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  const medianBp = values.length % 2 === 1 ? values[mid]! : Math.round((values[mid - 1]! + values[mid]!) / 2)
  return { medianBp, sales: values.length }
}

export interface SppVerdict {
  activeBp: number | null
  changed: boolean
  reason: "first" | "hysteresis" | "below-threshold" | "too-few-sales" | "no-data"
}

/** Какой k действует после нового расчёта. */
export function nextSppCoefficient(activeBp: number | null, candidate: { medianBp: number | null; sales: number }): SppVerdict {
  if (candidate.medianBp === null) return { activeBp, changed: false, reason: "no-data" }
  if (candidate.sales < SPP_MIN_SALES) return { activeBp, changed: false, reason: "too-few-sales" }
  if (activeBp === null) return { activeBp: candidate.medianBp, changed: true, reason: "first" }
  if (Math.abs(candidate.medianBp - activeBp) >= SPP_HYSTERESIS_BP) return { activeBp: candidate.medianBp, changed: true, reason: "hysteresis" }
  return { activeBp, changed: false, reason: "below-threshold" }
}
```
`index.ts` — добавить `export * from "./spp"`.

- [ ] **Step 3: Прогон и коммит.**
```bash
npx vitest run packages/domain/src/spp.test.ts && npm run typecheck
git add packages/domain/src/spp.ts packages/domain/src/spp.test.ts packages/domain/src/index.ts
git commit -m "sync2: коэффициент СПП — медиана по выкупам за 30 дней, гистерезис 3 п.п., минимум 10 продаж"
```

---

### Task 7: База — миграция 0004, режим записи цен, журнал цен

**Files:**
- Modify: `packages/db/src/schema.ts`, `packages/db/src/channels.ts`, `packages/db/src/writes-store.ts`, `packages/db/src/journal.ts`, `packages/db/src/journal.db.test.ts`
- Create: `packages/db/migrations/0004_prices.sql` (+ `meta/` — генерирует drizzle-kit), `packages/db/src/store-2.db.test.ts`

- [ ] **Step 1: Падающий тест** — `packages/db/src/store-2.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadChannels } from "./channels"
import { seedChannels } from "./channels-seed"
import { barcodesAppliedSince, priceWritesAppliedBetween, writeStatsSince, writesOfRun } from "./journal"
import { channels, writes } from "./schema"
import { TEST_DATABASE_URL, expectConstraint, freshTestDb, insertRun } from "./test-db"
import { drizzleWriteStore } from "./writes-store"

describe.skipIf(!TEST_DATABASE_URL)("хранилище этапа 2 — режим цен и журнал", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Awaited<ReturnType<typeof loadChannels>>
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ids = await loadChannels(h.db)
  })
  afterAll(async () => h?.close())

  it("режим записи цен — свой у площадки, по умолчанию off; опечатку отсекает ограничение", async () => {
    expect([...ids.values()].every((c) => c.priceWriteMode === "off" && c.writeMode === "off")).toBe(true)
    await expectConstraint(h.db.update(channels).set({ priceWriteMode: "aply" }).where(eq(channels.code, "kit")), "channels_price_write_mode_check")
  })

  it("журнал цен: копейки за пределами int32, detail, поле field; сводка остатков цены не видит", async () => {
    const runId = "00000000-0000-4000-8000-000000002001"
    await insertRun(h.db, runId)
    const record = drizzleWriteStore(h.db, runId, ids)
    const base = { mode: "apply" as const, applied: true, response: null, error: null, uncertain: false }
    await record([
      { ...base, channel: "ozon", barcode: "A", field: "price", before: 3_000_000_000, after: 3_100_000_000, externalSku: "JW-A", price: { baseMinor: 3_500_000_000, minMinor: 3_000_000_100, vat: "0" } },
      { ...base, channel: "ozon", barcode: "B", field: "stock", before: 1, after: 2, externalSku: "JW-B" },
    ])
    const rows = await h.db.select().from(writes).where(eq(writes.runId, runId))
    const a = rows.find((r) => r.barcode === "A")!
    expect([a.before, a.after, a.detail]).toEqual([3_000_000_000, 3_100_000_000, { baseMinor: 3_500_000_000, minMinor: 3_000_000_100, vat: "0" }])
    expect(rows.find((r) => r.barcode === "B")!.detail).toBeNull()
    expect((await writesOfRun(h.db, runId)).map((w) => [w.barcode, w.field])).toEqual([["A", "price"], ["B", "stock"]])
    const since = "2000-01-01T00:00:00.000Z"
    expect((await writeStatsSince(h.db, since)).ozon).toMatchObject({ applied: 1, barcodes: 1 })
    expect((await writeStatsSince(h.db, since, "price")).ozon).toMatchObject({ applied: 1, barcodes: 1 })
    expect(await barcodesAppliedSince(h.db, ids.get("ozon")!.id, since)).toEqual(new Set(["B"]))
    const applied = await priceWritesAppliedBetween(h.db, since, "2100-01-01T00:00:00.000Z")
    expect(applied.map((w) => [w.channel, w.barcode, w.externalSku, w.after])).toEqual([["ozon", "A", "JW-A", 3_100_000_000]])
  })
})
```
В `packages/db/src/journal.db.test.ts` ожидания `writesOfRun` дополнить `field: "stock"` в обеих строках, ожидание `pruneJournal` — `priceSnapshots: 0`:
```ts
      { channel: "kit", barcode: "A", field: "stock", vendorCode: "JW-A", title: "Браслет", externalSku: null, before: 2, after: 3, mode: "apply", applied: false, uncertain: true, error: "таймаут" },
      { channel: "ozon", barcode: "Z", field: "stock", vendorCode: null, title: null, externalSku: "JW-Z", before: 1, after: 0, mode: "dry-run", applied: false, uncertain: false, error: null },
```
```ts
    expect(await pruneJournal(h.db, "2026-09-28T00:00:00.000Z")).toEqual({ writesPlan: 1, writesApply: 1, snapshots: 2, priceSnapshots: 0 })
```
Run: `npm run test:db -- packages/db/src/store-2.db.test.ts packages/db/src/journal.db.test.ts` → FAIL (нет колонок и функций).

- [ ] **Step 2: Схема.** `packages/db/src/schema.ts`:
  - импорт pg-core дополнить `date`; импорт `@sync2/shared` — `AGREED_PRICE_SOURCES, DECISION_ANSWERS, DECISION_KINDS, DECISION_STATUSES, type WbPriceRow`;
  - в `channels` после `writeMode`:
```ts
    /** Режим записи цен площадки (этап 2) — отдельно от остатков; действует меньший из него и SYNC_WRITE_MODE. */
    priceWriteMode: text("price_write_mode").notNull().default("off"),
```
    и в ограничения `channels` — `check("channels_price_write_mode_check", sql\`${t.priceWriteMode} in (${inList(WRITE_MODES)})\`),`;
  - в `writes`: `before: bigint("before", { mode: "number" }),`, `after: bigint("after", { mode: "number" }).notNull(),` (цена в копейках; остаток — то же целое), после `externalSku`:
```ts
    /** Цена (этап 2): зачёркнутая, min_price Ozon, скидка WB, НДС Ozon — то, что ушло в запрос помимо after. */
    detail: jsonb("detail"),
```
  - в конец файла:
```ts
/** Согласованный прайс: цена продавца WB на карточку (решение 25.09, п. 8). Изменения — в agreed_price_history. */
export const agreedPrices = pgTable(
  "agreed_prices",
  {
    nmId: bigint("nm_id", { mode: "number" }).primaryKey(),
    /** Штрихкод карточки для журнала и справки (у карточек с размерами — один из них). */
    barcode: text("barcode").notNull(),
    priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
    /** Уступка WB для минимальной цены автоакций (решение п. 12; шаблон — этап 3), bp. */
    concessionBp: integer("concession_bp").notNull().default(1000),
    source: text("source").notNull(),
    approvedBy: text("approved_by").notNull(),
    reason: text("reason"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("agreed_prices_price_check", sql`${t.priceMinor} > 0`),
    check("agreed_prices_concession_check", sql`${t.concessionBp} between 0 and 10000`),
    check("agreed_prices_source_check", sql`${t.source} in (${inList(AGREED_PRICE_SOURCES)})`),
  ],
)

/** История прайса — только дописывается. */
export const agreedPriceHistory = pgTable(
  "agreed_price_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    nmId: bigint("nm_id", { mode: "number" }).notNull(),
    priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
    prevPriceMinor: bigint("prev_price_minor", { mode: "number" }),
    concessionBp: integer("concession_bp").notNull(),
    source: text("source").notNull(),
    approvedBy: text("approved_by").notNull(),
    reason: text("reason"),
    decisionId: bigint("decision_id", { mode: "number" }).references(() => decisions.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("agreed_price_history_nm_idx").on(t.nmId, t.createdAt),
    check("agreed_price_history_source_check", sql`${t.source} in (${inList(AGREED_PRICE_SOURCES)})`),
  ],
)

/** Вопросы партнёрам на кнопках (спека §4, §9). Открытый вопрос на предмет — один: частичный уникальный индекс. */
export const decisions = pgTable(
  "decisions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind").notNull(),
    /** Предмет вопроса — nmId строкой. */
    subject: text("subject").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("open"),
    answer: text("answer"),
    /** Telegram ID нажавшего; null — ответ владельца из CLI. */
    answeredById: bigint("answered_by_id", { mode: "number" }),
    answeredByName: text("answered_by_name"),
    answeredAt: ts("answered_at"),
    result: text("result"),
    tgMessageId: bigint("tg_message_id", { mode: "number" }),
    sentAt: ts("sent_at"),
    remindedAt: ts("reminded_at"),
    /** Итог показан под сообщением в Telegram. */
    tgClosedAt: ts("tg_closed_at"),
    runId: uuid("run_id").references(() => runs.runId),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("decisions_kind_check", sql`${t.kind} in (${inList(DECISION_KINDS)})`),
    check("decisions_status_check", sql`${t.status} in (${inList(DECISION_STATUSES)})`),
    check("decisions_answer_check", sql`${t.answer} is null or ${t.answer} in (${inList(DECISION_ANSWERS)})`),
    uniqueIndex("decisions_kind_subject_open_idx").on(t.kind, t.subject).where(sql`${t.status} in ('open', 'answered')`),
    index("decisions_status_idx").on(t.status),
  ],
)

/** Коэффициент СПП: каждый расчёт (раз в неделю), действующее значение — active_bp последней строки. */
export const sppCoefficients = pgTable(
  "spp_coefficients",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    windowFrom: date("window_from", { mode: "string" }).notNull(),
    /** Московский день расчёта; один расчёт в день — второй запрос съел бы суточный лимит финотчёта. */
    windowTo: date("window_to", { mode: "string" }).notNull(),
    sales: integer("sales").notNull(),
    medianBp: integer("median_bp"),
    activeBp: integer("active_bp"),
    changed: boolean("changed").notNull(),
    reason: text("reason").notNull(),
    /** Страница финотчёта заполнена до предела — данные могли быть не все, k не менялся. */
    truncated: boolean("truncated").notNull().default(false),
    runId: uuid("run_id").notNull().references(() => runs.runId),
    computedAt: ts("computed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("spp_coefficients_window_to_idx").on(t.windowTo)],
)

/** Снимок цен площадки (сейчас — только WB, для сторожа и кнопки «вернуть»). Только дописывается. */
export const priceSnapshotsRaw = pgTable(
  "price_snapshots_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    takenAt: ts("taken_at").notNull(),
    runId: uuid("run_id").notNull().references(() => runs.runId),
    prices: jsonb("prices").$type<WbPriceRow[]>().notNull(),
  },
  (t) => [uniqueIndex("price_snapshots_channel_taken_idx").on(t.channelId, t.takenAt)],
)

/** Малое состояние синка: окна лимитов площадок (`slot:*`), курсор Telegram (`tg:offset`). */
export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})
```
```bash
npm run db:generate -- --name prices
cat packages/db/migrations/0004_prices.sql
```
Expected: `CREATE TABLE` для `agreed_prices`, `agreed_price_history`, `decisions`, `spp_coefficients`, `price_snapshots_raw`, `sync_state`; `ALTER TABLE "channels" ADD COLUMN "price_write_mode" text DEFAULT 'off' NOT NULL`; `ALTER TABLE "writes" ALTER COLUMN "before" SET DATA TYPE bigint`, то же для `"after"`; `ALTER TABLE "writes" ADD COLUMN "detail" jsonb`; внешние ключи, индексы, `CHECK`. Прежние миграции не менять. `ALTER … TYPE bigint` переписывает `writes` (на VPS ~1 тыс. строк — доли секунды).

- [ ] **Step 3: Площадки и журнал.** `packages/db/src/channels.ts` целиком:
```ts
import { isChannel, parseWriteMode, type Channel, type WriteMode } from "@sync2/shared"
import type { Db } from "./client"
import { channels } from "./schema"

export interface ChannelRow {
  id: number
  writeMode: WriteMode
  /** Режим записи цен (этап 2). */
  priceWriteMode: WriteMode
}

/** Площадки из базы: код → id и режимы записи. Неизвестный код или режим — ошибка, а не тихий пропуск. */
export async function loadChannels(db: Db): Promise<Map<Channel, ChannelRow>> {
  const out = new Map<Channel, ChannelRow>()
  for (const r of await db.select().from(channels)) {
    if (!isChannel(r.code)) throw new Error(`неизвестная площадка в таблице channels: ${r.code}`)
    out.set(r.code, { id: r.id, writeMode: parseWriteMode(r.writeMode, "off"), priceWriteMode: parseWriteMode(r.priceWriteMode, "off") })
  }
  return out
}
```
`packages/db/src/writes-store.ts`: в `WriteRecord` после `externalSku`:
```ts
  /** Цена (этап 2): PriceDetail из @sync2/platforms — в writes.detail; у остатка нет. */
  price?: unknown
```
и в `values(…)` после `externalSku: o.externalSku,` — `detail: o.price ?? null,` и `...(createdAt ? { createdAt } : {}),`; сигнатура — `drizzleWriteStore(db: Db, runId: string, channelRows: ReadonlyMap<Channel, ChannelRow>, createdAt?: string)`: джоба `prices` передаёт момент своего прогона, и проверка «цена держится» (окно по `created_at`) не зависит от часов базы — в том числе в тестах с подставным временем. Вызовы 1.4 (`pool`, `site-push-all`) не меняются.
`packages/db/src/journal.ts`:
  - импорт drizzle-orm дополнить `lte`, импорт схемы — `priceSnapshotsRaw`;
  - в `WriteRow` после `barcode` — `field: "stock" | "price"`; в `select` `writesOfRun` — `field: writes.field,`; в `out.push` — `field: r.field === "price" ? "price" : "stock",`;
  - `writeStatsSince` — третий параметр и условие:
```ts
export async function writeStatsSince(db: Db, sinceIso: string, field: "stock" | "price" = "stock"): Promise<Record<Channel, WriteStats>> {
```
```ts
    .where(and(eq(writes.mode, "apply"), eq(writes.field, field), gte(writes.createdAt, sinceIso)))
```
  - `barcodesAppliedSince` — условие дополнить `eq(writes.field, "stock"),` (запись цены не делает остаток «в пути»);
  - новая функция после `barcodesAppliedSince`:
```ts
/** Применённые записи цен в окне (fromIso, toIso] — проверка «цена держится» следующим прогоном prices (этап 2). */
export async function priceWritesAppliedBetween(
  db: Db,
  fromIso: string,
  toIso: string,
): Promise<Array<{ channel: Channel; barcode: string; externalSku: string | null; after: number }>> {
  const rows = await db
    .select({ code: channels.code, barcode: writes.barcode, externalSku: writes.externalSku, after: writes.after })
    .from(writes)
    .innerJoin(channels, eq(writes.channelId, channels.id))
    .where(and(eq(writes.field, "price"), eq(writes.mode, "apply"), eq(writes.applied, true), gt(writes.createdAt, fromIso), lte(writes.createdAt, toIso)))
    .orderBy(asc(writes.id))
  return rows.flatMap((r) => (isChannel(r.code) ? [{ channel: r.code, barcode: r.barcode, externalSku: r.externalSku, after: r.after }] : []))
}
```
  - `pruneJournal`: тип результата `{ writesPlan: number; writesApply: number; snapshots: number; priceSnapshots: number }`, перед `return`:
```ts
  const latestPrices = db
    .selectDistinctOn([priceSnapshotsRaw.channelId], { id: priceSnapshotsRaw.id })
    .from(priceSnapshotsRaw)
    .orderBy(priceSnapshotsRaw.channelId, desc(priceSnapshotsRaw.takenAt))
  const priceSnaps = await db
    .delete(priceSnapshotsRaw)
    .where(and(lt(priceSnapshotsRaw.takenAt, before(SNAPSHOTS_KEEP_DAYS)), notInArray(priceSnapshotsRaw.id, latestPrices)))
    .returning({ id: priceSnapshotsRaw.id })
```
    и `return { writesPlan: plan.length, writesApply: apply.length, snapshots: snaps.length, priceSnapshots: priceSnaps.length }`.

- [ ] **Step 4: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add packages/db/src/schema.ts packages/db/src/channels.ts packages/db/src/writes-store.ts packages/db/src/journal.ts packages/db/src/journal.db.test.ts packages/db/src/store-2.db.test.ts packages/db/migrations
git commit -m "sync2: миграция 0004 — режим записи цен, журнал цен (bigint, detail), прайс, вопросы, СПП, снимки цен, sync_state"
```
Сборщики остатков не меняются: `pool` читает `ChannelRow.writeMode`, записи остатков без `price` дают `detail = null`.

---

### Task 8: Прайс — разбор CSV и хранилище с историей

**Files:**
- Create: `packages/domain/src/agreed-csv.ts`, `packages/domain/src/agreed-csv.test.ts`, `packages/db/src/agreed-prices.ts`
- Modify: `packages/domain/src/index.ts`, `packages/db/src/index.ts`, `packages/db/src/store-2.db.test.ts`

- [ ] **Step 1: Падающие тесты.** `packages/domain/src/agreed-csv.test.ts`:
```ts
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { parseAgreedCsv, splitCsvLine } from "./agreed-csv"

const HEADER = "nmID;vendorCode;barcode;категория_WB;остаток;согласованная_цена_продавца;уступка_WB;мин_цена_WB;источник"

describe("parseAgreedCsv", () => {
  it("кавычки с «;» внутри, BOM, копейки", () => {
    expect(splitCsvLine('1;"а; б";"с ""кавычкой"""')).toEqual(["1", "а; б", 'с "кавычкой"'])
    const text = `﻿${HEADER}\n259678801;JW-NB-AGT-M-0002;2041383032873;Браслеты;2;9164.0;0.1;8248;"«Цена со скидкой»; снижения"\n270419874;JW-X;2041456329848;Обереги;1;20631.2;;;x\n`
    expect(parseAgreedCsv(text)).toEqual({
      rows: [
        { nmId: 259678801, barcode: "2041383032873", vendorCode: "JW-NB-AGT-M-0002", subject: "Браслеты", priceMinor: 916400, concessionBp: 1000 },
        { nmId: 270419874, barcode: "2041456329848", vendorCode: "JW-X", subject: "Обереги", priceMinor: 2063120, concessionBp: 1000 },
      ],
      errors: [],
    })
  })

  it("битая цена, повтор nmID, битая уступка — ошибки с номером строки; нет колонки — ошибка", () => {
    const text = `${HEADER}\n1;A;B1;S;1;abc;0.1;;\n2;A;B2;S;1;100;0.1;;\n2;A;B3;S;1;100;0.1;;\n3;A;B4;S;1;100;1.5;;\n`
    expect(parseAgreedCsv(text).errors).toEqual([
      'строка 2: цена "abc"',
      "строка 4: nmID 2 повторяется",
      'строка 5: уступка "1.5"',
    ])
    expect(parseAgreedCsv("nmID;vendorCode;barcode;категория_WB\n1;A;2;S\n").errors).toEqual(["нет колонки «согласованная_цена_продавца»"])
  })

  it("настоящий прайс 26.09: 78 позиций без ошибок", () => {
    const path = fileURLToPath(new URL("../../../../data/prices/agreed-2026-09-26.csv", import.meta.url))
    const r = parseAgreedCsv(readFileSync(path, "utf8"))
    expect(r.errors).toEqual([])
    expect(r.rows).toHaveLength(78)
    expect(r.rows[0]).toMatchObject({ nmId: 259678801, priceMinor: 916400, concessionBp: 1000 })
  })
})
```
В `packages/db/src/store-2.db.test.ts` — второй `describe`:
```ts
describe.skipIf(!TEST_DATABASE_URL)("хранилище этапа 2 — прайс", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  it("установка прайса — строка истории «было → стало», уступка сохраняется", async () => {
    const who = { source: "cli" as const, approvedBy: "владелец (CLI)", reason: "тест" }
    expect(await setAgreedPrice(h.db, { nmId: 1, barcode: "A", priceMinor: 916400, concessionBp: 0, ...who })).toEqual({ prevPriceMinor: null })
    expect(await setAgreedPrice(h.db, { nmId: 1, barcode: "A", priceMinor: 869000, ...who })).toEqual({ prevPriceMinor: 916400 })
    expect((await loadAgreedPrices(h.db)).get(1)).toMatchObject({ priceMinor: 869000, concessionBp: 0, source: "cli" })
    expect((await agreedPriceHistory(h.db, 1)).map((r) => [r.prevPriceMinor, r.priceMinor])).toEqual([
      [916400, 869000],
      [null, 916400],
    ])
    await expect(setAgreedPrice(h.db, { nmId: 2, barcode: "B", priceMinor: 0, ...who })).rejects.toThrow(RangeError)
  })

  it("импорт — только новые nmId; другая цена у уже записанного — конфликт без изменения", async () => {
    const who = { approvedBy: "владелец (CLI)", reason: "импорт agreed-2026-09-26.csv" }
    const rows = [
      { nmId: 1, barcode: "A", priceMinor: 916400, concessionBp: 1000 },
      { nmId: 3, barcode: "C", priceMinor: 500000, concessionBp: 1000 },
    ]
    expect(await importAgreedPrices(h.db, rows, who)).toEqual({ inserted: 1, unchanged: 0, conflicts: [{ nmId: 1, currentMinor: 869000, csvMinor: 916400 }] })
    expect((await loadAgreedPrices(h.db)).get(3)).toMatchObject({ priceMinor: 500000, source: "import" })
    expect(await importAgreedPrices(h.db, rows.slice(1), who)).toEqual({ inserted: 0, unchanged: 1, conflicts: [] })
  })
})
```
(импорт в начало файла: `import { agreedPriceHistory, importAgreedPrices, loadAgreedPrices, setAgreedPrice } from "./agreed-prices"`).
Run: `npx vitest run packages/domain/src/agreed-csv.test.ts`; `npm run test:db -- packages/db/src/store-2.db.test.ts` → FAIL.

- [ ] **Step 2: Разбор CSV** — `packages/domain/src/agreed-csv.ts`:
```ts
// Разбор прайса владельца (data/prices/agreed-2026-09-26.csv): «;», BOM, кавычки с «;» внутри, цены с копейками.
import { decimalStringToMinor, fractionToBp } from "@sync2/shared"

export interface AgreedCsvRow {
  nmId: number
  barcode: string
  vendorCode: string
  subject: string
  priceMinor: number
  concessionBp: number
}

/** Уступка по умолчанию — 10 % (решение 25.09, п. 12). */
export const DEFAULT_CONCESSION_BP = 1000

const COL = {
  nmId: "nmID",
  vendorCode: "vendorCode",
  barcode: "barcode",
  subject: "категория_WB",
  price: "согласованная_цена_продавца",
  concession: "уступка_WB",
} as const

/** Поля строки CSV: разделитель вне кавычек, "" внутри кавычек — одна кавычка. */
export function splitCsvLine(line: string, sep = ";"): string[] {
  const out: string[] = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      out.push(cur)
      cur = ""
    } else cur += ch
  }
  out.push(cur)
  return out
}

export function parseAgreedCsv(text: string): { rows: AgreedCsvRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
  const header = splitCsvLine(lines[0] ?? "").map((h) => h.trim())
  const idx = {} as Record<keyof typeof COL, number>
  for (const [key, name] of Object.entries(COL) as Array<[keyof typeof COL, string]>) {
    const i = header.indexOf(name)
    if (i < 0) return { rows: [], errors: [`нет колонки «${name}»`] }
    idx[key] = i
  }
  const rows: AgreedCsvRow[] = []
  const errors: string[] = []
  const seen = new Set<number>()
  for (let n = 1; n < lines.length; n++) {
    const line = lines[n]!
    if (line.trim() === "") continue
    const f = splitCsvLine(line).map((x) => x.trim())
    const at = `строка ${n + 1}`
    const nmId = Number(f[idx.nmId])
    if (!Number.isSafeInteger(nmId) || nmId <= 0) {
      errors.push(`${at}: nmID "${f[idx.nmId] ?? ""}"`)
      continue
    }
    if (seen.has(nmId)) {
      errors.push(`${at}: nmID ${nmId} повторяется`)
      continue
    }
    const barcode = f[idx.barcode] ?? ""
    if (!barcode) {
      errors.push(`${at}: нет штрихкода`)
      continue
    }
    let priceMinor: number
    try {
      priceMinor = decimalStringToMinor((f[idx.price] ?? "").replace(",", "."))
    } catch {
      errors.push(`${at}: цена "${f[idx.price] ?? ""}"`)
      continue
    }
    if (priceMinor <= 0) {
      errors.push(`${at}: цена "${f[idx.price] ?? ""}"`)
      continue
    }
    const rawConcession = (f[idx.concession] ?? "").replace(",", ".")
    let concessionBp = DEFAULT_CONCESSION_BP
    if (rawConcession !== "") {
      try {
        concessionBp = fractionToBp(Number(rawConcession))
      } catch {
        errors.push(`${at}: уступка "${f[idx.concession] ?? ""}"`)
        continue
      }
    }
    seen.add(nmId)
    rows.push({ nmId, barcode, vendorCode: f[idx.vendorCode] ?? "", subject: f[idx.subject] ?? "", priceMinor, concessionBp })
  }
  return { rows, errors }
}
```
`packages/domain/src/index.ts` — добавить `export * from "./agreed-csv"`.

- [ ] **Step 3: Хранилище** — `packages/db/src/agreed-prices.ts`:
```ts
import { desc, eq } from "drizzle-orm"
import type { AgreedPriceSource } from "@sync2/shared"
import type { Db } from "./client"
import { agreedPriceHistory as history, agreedPrices } from "./schema"
import { toIso } from "./time"

export interface AgreedPriceRow {
  nmId: number
  barcode: string
  priceMinor: number
  concessionBp: number
  source: AgreedPriceSource
  approvedBy: string
  reason: string | null
  updatedAt: string
}

export async function loadAgreedPrices(db: Db): Promise<Map<number, AgreedPriceRow>> {
  const rows = await db.select().from(agreedPrices)
  return new Map(
    rows.map((r) => [
      r.nmId,
      { nmId: r.nmId, barcode: r.barcode, priceMinor: r.priceMinor, concessionBp: r.concessionBp, source: r.source as AgreedPriceSource, approvedBy: r.approvedBy, reason: r.reason, updatedAt: toIso(r.updatedAt) },
    ]),
  )
}

export interface SetAgreedPrice {
  nmId: number
  barcode: string
  priceMinor: number
  /** Не задана — прежняя уступка карточки или 10 %. */
  concessionBp?: number
  source: AgreedPriceSource
  approvedBy: string
  reason: string | null
  decisionId?: number | null
}

/**
 * Единственный путь изменения прайса (решение 1 этапа): текущая строка под блокировкой, строка истории
 * «было → стало», новая текущая — в одной транзакции.
 */
export async function setAgreedPrice(db: Db, input: SetAgreedPrice): Promise<{ prevPriceMinor: number | null }> {
  if (!Number.isSafeInteger(input.priceMinor) || input.priceMinor <= 0) throw new RangeError(`прайс не копейки > 0: ${input.priceMinor}`)
  return db.transaction(async (tx) => {
    const [prev] = await tx.select().from(agreedPrices).where(eq(agreedPrices.nmId, input.nmId)).for("update")
    const concessionBp = input.concessionBp ?? prev?.concessionBp ?? 1000
    await tx.insert(history).values({
      nmId: input.nmId,
      priceMinor: input.priceMinor,
      prevPriceMinor: prev?.priceMinor ?? null,
      concessionBp,
      source: input.source,
      approvedBy: input.approvedBy,
      reason: input.reason,
      decisionId: input.decisionId ?? null,
    })
    const row = { barcode: input.barcode, priceMinor: input.priceMinor, concessionBp, source: input.source, approvedBy: input.approvedBy, reason: input.reason }
    await tx
      .insert(agreedPrices)
      .values({ nmId: input.nmId, ...row })
      .onConflictDoUpdate({ target: agreedPrices.nmId, set: { ...row, updatedAt: new Date().toISOString() } })
    return { prevPriceMinor: prev?.priceMinor ?? null }
  })
}

/** История карточки, новые сверху. */
export async function agreedPriceHistory(db: Db, nmId: number) {
  const rows = await db.select().from(history).where(eq(history.nmId, nmId)).orderBy(desc(history.id))
  return rows.map((r) => ({ priceMinor: r.priceMinor, prevPriceMinor: r.prevPriceMinor, source: r.source, approvedBy: r.approvedBy, reason: r.reason, decisionId: r.decisionId, createdAt: toIso(r.createdAt) }))
}

/** Строка импорта — структурно совместима с AgreedCsvRow из @sync2/domain (db от domain не зависит). */
export interface ImportAgreedRow {
  nmId: number
  barcode: string
  priceMinor: number
  concessionBp: number
}

/**
 * Импорт прайса: новые nmId — записываются (источник import); уже записанный с той же ценой — без изменений;
 * с другой — конфликт списком, прайс не меняется (правка — только кнопкой или `price set`).
 */
export async function importAgreedPrices(
  db: Db,
  rows: readonly ImportAgreedRow[],
  who: { approvedBy: string; reason: string },
): Promise<{ inserted: number; unchanged: number; conflicts: Array<{ nmId: number; currentMinor: number; csvMinor: number }> }> {
  const current = await loadAgreedPrices(db)
  const out = { inserted: 0, unchanged: 0, conflicts: [] as Array<{ nmId: number; currentMinor: number; csvMinor: number }> }
  const done = new Set<number>()
  for (const r of rows) {
    if (done.has(r.nmId)) continue
    done.add(r.nmId)
    const cur = current.get(r.nmId)
    if (cur) {
      if (cur.priceMinor === r.priceMinor) out.unchanged++
      else out.conflicts.push({ nmId: r.nmId, currentMinor: cur.priceMinor, csvMinor: r.priceMinor })
      continue
    }
    await setAgreedPrice(db, { ...r, source: "import", approvedBy: who.approvedBy, reason: who.reason })
    out.inserted++
  }
  return out
}
```
Повтор nmId в строках уже отсекает `parseAgreedCsv`; `done` — страховка для вызова не из CSV.
`packages/db/src/index.ts` — добавить `export * from "./agreed-prices"`.

- [ ] **Step 4: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add packages/domain/src/agreed-csv.ts packages/domain/src/agreed-csv.test.ts packages/domain/src/index.ts packages/db/src/agreed-prices.ts packages/db/src/index.ts packages/db/src/store-2.db.test.ts
git commit -m "sync2: прайс — разбор CSV владельца, хранилище с историей, импорт без перезаписи"
```

---

### Task 9: Вопросы, окно лимита, СПП, снимки цен WB, справочник товаров — хранилища

**Files:**
- Create: `packages/db/src/decisions.ts`, `packages/db/src/sync-state.ts`, `packages/db/src/spp-store.ts`, `packages/db/src/price-snapshots.ts`
- Modify: `packages/db/src/products.ts`, `packages/db/src/index.ts`, `packages/db/src/store-2.db.test.ts`

- [ ] **Step 1: Падающие тесты** — в `packages/db/src/store-2.db.test.ts` третий `describe` (импорты — в начало файла):
```ts
import {
  activeDecisions,
  answerDecision,
  decisionById,
  decisionsToRemind,
  decisionsToShowOutcome,
  finishDecision,
  lastAutoactionPrices,
  markDecisionSent,
  markReminded,
  markTgClosed,
  openDecisions,
  unsentDecisions,
} from "./decisions"
import { insertWbPriceSnapshot, latestWbPriceSnapshot } from "./price-snapshots"
import { inStockNmIds, loadProducts, upsertProducts } from "./products"
import { savePoolRun } from "./pool-store"
import { activeSpp, saveSpp, sppComputedFor, sppHistory } from "./spp-store"
import { getState, pushSlot, setState, takeSlot } from "./sync-state"
```
```ts
describe.skipIf(!TEST_DATABASE_URL)("хранилище этапа 2 — вопросы, окно лимита, СПП, снимки, товары", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  const runId = "00000000-0000-4000-8000-000000002101"
  const payload = (nmId: number, observedMinor = 869000) => ({ nmId, vendorCode: `JW-${nmId}`, title: null, agreedMinor: 916400, observedMinor, priceRub: 15800, discountPct: 45 })
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, runId)
  })
  afterAll(async () => h?.close())

  it("открытый вопрос на предмет — один; ответ — только открытому; исход и Telegram-пометки", async () => {
    const q = (nmId: number) => ({ kind: "wb_price_drift" as const, subject: String(nmId), payload: payload(nmId) })
    expect(await openDecisions(h.db, [q(1), q(2)], runId)).toBe(2)
    expect(await openDecisions(h.db, [q(1)], runId)).toBe(0)
    const [d1, d2] = await activeDecisions(h.db)
    expect((await unsentDecisions(h.db, 10)).map((d) => d.id)).toEqual([d1!.id, d2!.id])
    await markDecisionSent(h.db, d1!.id, 555, "2026-09-28T10:00:00.000Z")
    expect((await unsentDecisions(h.db, 10)).map((d) => d.id)).toEqual([d2!.id])

    const answered = await answerDecision(h.db, d1!.id, "autoaction", { id: 5710949139, name: "Минас" }, "2026-09-28T10:05:00.000Z")
    expect(answered).toMatchObject({ status: "answered", answer: "autoaction", answeredById: 5710949139, answeredByName: "Минас", tgMessageId: 555 })
    expect(await answerDecision(h.db, d1!.id, "accept", { id: 1, name: "другой" }, "2026-09-28T10:06:00.000Z")).toBeNull()

    await finishDecision(h.db, d1!.id, "done", "автоакция: прайс не меняется", "2026-09-28T10:30:00.000Z")
    expect(await decisionById(h.db, d1!.id)).toMatchObject({ status: "done", result: "автоакция: прайс не меняется" })
    expect(await lastAutoactionPrices(h.db)).toEqual(new Map([[1, 869000]]))
    expect((await decisionsToShowOutcome(h.db, 10)).map((d) => d.id)).toEqual([d1!.id])
    await markTgClosed(h.db, d1!.id, "2026-09-28T10:31:00.000Z")
    expect(await decisionsToShowOutcome(h.db, 10)).toEqual([])
    expect(await openDecisions(h.db, [q(1)], runId)).toBe(1)
  })

  it("напоминание — открытым, отправленным больше суток назад и не напоминавшимся сутки", async () => {
    await openDecisions(h.db, [{ kind: "wb_price_new", subject: "7", payload: { ...payload(7), agreedMinor: null } }], runId)
    const d = (await activeDecisions(h.db)).find((x) => x.subject === "7")
    await markDecisionSent(h.db, d!.id, 777, "2026-09-27T09:00:00.000Z")
    expect((await decisionsToRemind(h.db, "2026-09-28T08:59:00.000Z")).map((x) => x.id)).toEqual([])
    expect((await decisionsToRemind(h.db, "2026-09-28T09:01:00.000Z")).map((x) => x.id)).toEqual([d!.id])
    await markReminded(h.db, d!.id, "2026-09-28T09:01:00.000Z")
    expect(await decisionsToRemind(h.db, "2026-09-28T12:00:00.000Z")).toEqual([])
  })

  it("окно лимита цен WB: занять, занято, свободно через 15 мин; площадка сдвинула — ждать", async () => {
    const at = (min: number) => new Date(Date.parse("2026-09-28T10:00:00.000Z") + min * 60_000).toISOString()
    const slot = "slot:wb-prices"
    expect(await takeSlot(h.db, slot, at(0), 15 * 60_000)).toBe(true)
    expect(await takeSlot(h.db, slot, at(5), 15 * 60_000)).toBe(false)
    expect(await takeSlot(h.db, slot, at(15), 15 * 60_000)).toBe(true)
    await pushSlot(h.db, slot, at(60))
    expect(await takeSlot(h.db, slot, at(31), 15 * 60_000)).toBe(false)
    expect(await takeSlot(h.db, slot, at(60), 15 * 60_000)).toBe(true)
    await setState(h.db, "tg:offset", { offset: 42 })
    expect(await getState<{ offset: number }>(h.db, "tg:offset")).toEqual({ offset: 42 })
    expect(await getState(h.db, "нет")).toBeNull()
  })

  it("СПП: действующий k — последней строки; один расчёт на день", async () => {
    expect(await activeSpp(h.db)).toBeNull()
    const row = { windowFrom: "2026-09-01", windowTo: "2026-10-01", sales: 40, medianBp: 2500, activeBp: 2500, changed: true, reason: "first", truncated: false, runId }
    await saveSpp(h.db, row)
    await saveSpp(h.db, { ...row, windowTo: "2026-10-08", medianBp: 2600, changed: false, reason: "below-threshold" })
    expect(await activeSpp(h.db)).toBe(2500)
    expect(await sppComputedFor(h.db, "2026-10-08")).toBe(true)
    expect(await sppComputedFor(h.db, "2026-10-09")).toBe(false)
    expect((await sppHistory(h.db, 10)).map((r) => r.windowTo)).toEqual(["2026-10-08", "2026-10-01"])
  })

  it("снимок цен WB: последний по площадке", async () => {
    const ids = await loadChannels(h.db)
    const wb = ids.get("wb")!.id
    const p = { nmId: 1, vendorCode: "JW-1", priceRub: 15800, discountPct: 45, discountedMinor: 869000, sizesDiffer: false }
    await insertWbPriceSnapshot(h.db, { channelId: wb, runId, takenAt: "2026-09-28T10:00:00.000Z", prices: [p] })
    await insertWbPriceSnapshot(h.db, { channelId: wb, runId, takenAt: "2026-09-28T10:30:00.000Z", prices: [{ ...p, discountPct: 42, discountedMinor: 916400 }] })
    expect(await latestWbPriceSnapshot(h.db, wb)).toEqual({ takenAt: "2026-09-28T10:30:00.000Z", prices: [{ ...p, discountPct: 42, discountedMinor: 916400 }] })
  })

  it("справочник: товары с nmId и предметом; в наличии — nmId с базой пула > 0", async () => {
    await upsertProducts(h.db, [
      { barcode: "A", vendorCode: "JW-A", nmId: 10, title: "Браслет", subject: "Браслеты" },
      { barcode: "B", vendorCode: "JW-B", nmId: 11, title: "Оберег", subject: "Обереги" },
    ])
    await savePoolRun(h.db, {
      runId,
      items: [
        { barcode: "A", base: 2, wbExpected: 2, expectedAt: null, wbSnapshotAt: null },
        { barcode: "B", base: 0, wbExpected: 0, expectedAt: null, wbSnapshotAt: null },
      ],
      events: [],
    })
    expect((await loadProducts(h.db)).find((p) => p.barcode === "A")).toEqual({ barcode: "A", nmId: 10, vendorCode: "JW-A", title: "Браслет", wbSubject: "Браслеты" })
    expect(await inStockNmIds(h.db)).toEqual(new Set([10]))
  })
})
```
Форма элемента пула — `PoolItemState` (`packages/domain/src/pool.ts`: `barcode, base, wbExpected, expectedAt, wbSnapshotAt`), `savePoolRun(db, { runId, items, events })` — `packages/db/src/pool-store.ts`.
Run: `npm run test:db -- packages/db/src/store-2.db.test.ts` → FAIL.

- [ ] **Step 2: Вопросы** — `packages/db/src/decisions.ts`:
```ts
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm"
import type { DecisionAnswer, DecisionKind, DecisionPayload, DecisionStatus } from "@sync2/shared"
import type { Db } from "./client"
import { decisions } from "./schema"
import { toIso, toIsoOrNull } from "./time"

export interface DecisionRow {
  id: number
  kind: DecisionKind
  subject: string
  payload: DecisionPayload
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

/** Напоминание — через сутки без ответа (спека §2, п. 15). */
export const REMIND_AFTER_MS = 24 * 60 * 60 * 1000

function toRow(r: typeof decisions.$inferSelect): DecisionRow {
  return {
    id: r.id,
    kind: r.kind as DecisionKind,
    subject: r.subject,
    payload: r.payload as DecisionPayload,
    status: r.status as DecisionStatus,
    answer: r.answer as DecisionAnswer | null,
    answeredById: r.answeredById,
    answeredByName: r.answeredByName,
    answeredAt: toIsoOrNull(r.answeredAt),
    result: r.result,
    tgMessageId: r.tgMessageId,
    sentAt: toIsoOrNull(r.sentAt),
    remindedAt: toIsoOrNull(r.remindedAt),
    tgClosedAt: toIsoOrNull(r.tgClosedAt),
    createdAt: toIso(r.createdAt),
  }
}

/** Новые вопросы; повтор открытого по тому же предмету отсекает частичный уникальный индекс. Возвращает число новых. */
export async function openDecisions(db: Db, items: ReadonlyArray<{ kind: DecisionKind; subject: string; payload: DecisionPayload }>, runId: string): Promise<number> {
  if (items.length === 0) return 0
  const inserted = await db
    .insert(decisions)
    .values(items.map((i) => ({ kind: i.kind, subject: i.subject, payload: i.payload, runId })))
    .onConflictDoNothing()
    .returning({ id: decisions.id })
  return inserted.length
}

/** Вопросы без исхода: open и answered. */
export async function activeDecisions(db: Db): Promise<DecisionRow[]> {
  return (await db.select().from(decisions).where(inArray(decisions.status, ["open", "answered"])).orderBy(asc(decisions.id))).map(toRow)
}

export async function decisionById(db: Db, id: number): Promise<DecisionRow | null> {
  const [r] = await db.select().from(decisions).where(eq(decisions.id, id))
  return r ? toRow(r) : null
}

/** Ответ — только открытому вопросу (второе нажатие и гонка двух партнёров отсекаются условием). null — уже решён. */
export async function answerDecision(db: Db, id: number, answer: DecisionAnswer, by: { id: number | null; name: string }, atIso: string): Promise<DecisionRow | null> {
  const [r] = await db
    .update(decisions)
    .set({ status: "answered", answer, answeredById: by.id, answeredByName: by.name, answeredAt: atIso, updatedAt: atIso })
    .where(and(eq(decisions.id, id), eq(decisions.status, "open")))
    .returning()
  return r ? toRow(r) : null
}

export async function finishDecision(db: Db, id: number, status: "done" | "failed" | "closed", result: string, atIso: string): Promise<void> {
  await db.update(decisions).set({ status, result, updatedAt: atIso }).where(eq(decisions.id, id))
}

/** nmId → цена WB, которую последним исполненным ответом назвали автоакцией (заглушка сторожа). */
export async function lastAutoactionPrices(db: Db): Promise<Map<number, number>> {
  const rows = await db
    .selectDistinctOn([decisions.subject], { payload: decisions.payload })
    .from(decisions)
    .where(and(eq(decisions.kind, "wb_price_drift"), eq(decisions.answer, "autoaction"), eq(decisions.status, "done")))
    .orderBy(decisions.subject, desc(decisions.answeredAt))
  return new Map(rows.map((r) => [(r.payload as DecisionPayload).nmId, (r.payload as DecisionPayload).observedMinor]))
}

export async function unsentDecisions(db: Db, limit: number): Promise<DecisionRow[]> {
  return (await db.select().from(decisions).where(and(eq(decisions.status, "open"), isNull(decisions.tgMessageId))).orderBy(asc(decisions.id)).limit(limit)).map(toRow)
}

export async function markDecisionSent(db: Db, id: number, messageId: number, atIso: string): Promise<void> {
  await db.update(decisions).set({ tgMessageId: messageId, sentAt: atIso, updatedAt: atIso }).where(eq(decisions.id, id))
}

/** Исход есть, сообщение в группе есть, а итог под ним ещё не показан. */
export async function decisionsToShowOutcome(db: Db, limit: number): Promise<DecisionRow[]> {
  return (
    await db
      .select()
      .from(decisions)
      .where(and(inArray(decisions.status, ["done", "failed", "closed"]), isNotNull(decisions.tgMessageId), isNull(decisions.tgClosedAt)))
      .orderBy(asc(decisions.id))
      .limit(limit)
  ).map(toRow)
}

export async function markTgClosed(db: Db, id: number, atIso: string): Promise<void> {
  await db.update(decisions).set({ tgClosedAt: atIso, updatedAt: atIso }).where(eq(decisions.id, id))
}

export async function decisionsToRemind(db: Db, nowIso: string): Promise<DecisionRow[]> {
  const edge = new Date(Date.parse(nowIso) - REMIND_AFTER_MS).toISOString()
  return (
    await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.status, "open"), isNotNull(decisions.tgMessageId), lt(decisions.sentAt, edge), or(isNull(decisions.remindedAt), lt(decisions.remindedAt, edge))))
      .orderBy(asc(decisions.id))
  ).map(toRow)
}

export async function markReminded(db: Db, id: number, atIso: string): Promise<void> {
  await db.update(decisions).set({ remindedAt: atIso, updatedAt: atIso }).where(eq(decisions.id, id))
}
```

- [ ] **Step 3: Окно лимита и курсор** — `packages/db/src/sync-state.ts`:
```ts
import { eq, sql } from "drizzle-orm"
import type { Db } from "./client"
import { syncState } from "./schema"

/** Окно лимита «Цены и скидки» WB: базовый токен — 4 запроса в час, интервал 15 мин (02-products.yaml), общее для чтения и записи. */
export const WB_PRICES_SLOT = "slot:wb-prices"
export const WB_PRICES_INTERVAL_MS = 15 * 60_000
/** Последний обработанный update_id Telegram. */
export const TG_OFFSET_KEY = "tg:offset"

export async function getState<T>(db: Db, key: string): Promise<T | null> {
  const [r] = await db.select({ value: syncState.value }).from(syncState).where(eq(syncState.key, key))
  return r ? (r.value as T) : null
}

export async function setState(db: Db, key: string, value: unknown): Promise<void> {
  await db.insert(syncState).values({ key, value }).onConflictDoUpdate({ target: syncState.key, set: { value, updatedAt: sql`now()` } })
}

/**
 * Занять окно лимита до запроса: записи нет или nextAt ≤ now — nextAt := now + interval, true; иначе false.
 * Одним запросом: два процесса не займут одно окно. Занятое окно не освобождается даже при сбое запроса —
 * площадка тоже посчитала попытку.
 */
export async function takeSlot(db: Db, key: string, nowIso: string, intervalMs: number): Promise<boolean> {
  const value = { nextAt: new Date(Date.parse(nowIso) + intervalMs).toISOString() }
  const rows = await db
    .insert(syncState)
    .values({ key, value })
    .onConflictDoUpdate({
      target: syncState.key,
      set: { value, updatedAt: sql`now()` },
      setWhere: sql`(${syncState.value}->>'nextAt')::timestamptz <= ${nowIso}::timestamptz`,
    })
    .returning({ key: syncState.key })
  return rows.length > 0
}

/** Площадка сказала, когда можно (429 с X-Ratelimit-Retry): окно не раньше untilIso. */
export async function pushSlot(db: Db, key: string, untilIso: string): Promise<void> {
  await db
    .insert(syncState)
    .values({ key, value: { nextAt: untilIso } })
    .onConflictDoUpdate({
      target: syncState.key,
      set: {
        value: sql`jsonb_build_object('nextAt', to_char(greatest((${syncState.value}->>'nextAt')::timestamptz, ${untilIso}::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`,
        updatedAt: sql`now()`,
      },
    })
}
```

- [ ] **Step 4: СПП и снимки цен** — `packages/db/src/spp-store.ts`:
```ts
import { desc, eq } from "drizzle-orm"
import type { Db } from "./client"
import { sppCoefficients } from "./schema"
import { toIso } from "./time"

export interface SppRow {
  windowFrom: string
  windowTo: string
  sales: number
  medianBp: number | null
  activeBp: number | null
  changed: boolean
  reason: string
  truncated: boolean
  computedAt: string
}

/** Действующий коэффициент — active_bp последнего расчёта; расчётов нет — null. */
export async function activeSpp(db: Db): Promise<number | null> {
  const [r] = await db.select({ activeBp: sppCoefficients.activeBp }).from(sppCoefficients).orderBy(desc(sppCoefficients.windowTo)).limit(1)
  return r?.activeBp ?? null
}

export async function sppHistory(db: Db, limit: number): Promise<SppRow[]> {
  const rows = await db.select().from(sppCoefficients).orderBy(desc(sppCoefficients.windowTo)).limit(limit)
  return rows.map((r) => ({ windowFrom: r.windowFrom, windowTo: r.windowTo, sales: r.sales, medianBp: r.medianBp, activeBp: r.activeBp, changed: r.changed, reason: r.reason, truncated: r.truncated, computedAt: toIso(r.computedAt) }))
}

export async function sppComputedFor(db: Db, windowTo: string): Promise<boolean> {
  return (await db.select({ id: sppCoefficients.id }).from(sppCoefficients).where(eq(sppCoefficients.windowTo, windowTo))).length > 0
}

export async function saveSpp(db: Db, row: Omit<SppRow, "computedAt"> & { runId: string }): Promise<void> {
  await db.insert(sppCoefficients).values(row)
}
```
`packages/db/src/price-snapshots.ts`:
```ts
import { desc, eq } from "drizzle-orm"
import type { WbPriceRow } from "@sync2/shared"
import type { Db } from "./client"
import { priceSnapshotsRaw } from "./schema"
import { toIso } from "./time"

/** Снимок цен WB (сторож). Повтор с тем же моментом отсечёт уникальный индекс. */
export async function insertWbPriceSnapshot(db: Db, snap: { channelId: number; runId: string; takenAt: string; prices: WbPriceRow[] }): Promise<void> {
  await db.insert(priceSnapshotsRaw).values(snap)
}

export async function latestWbPriceSnapshot(db: Db, channelId: number): Promise<{ takenAt: string; prices: WbPriceRow[] } | null> {
  const [r] = await db
    .select({ takenAt: priceSnapshotsRaw.takenAt, prices: priceSnapshotsRaw.prices })
    .from(priceSnapshotsRaw)
    .where(eq(priceSnapshotsRaw.channelId, channelId))
    .orderBy(desc(priceSnapshotsRaw.takenAt))
    .limit(1)
  return r ? { takenAt: toIso(r.takenAt), prices: r.prices } : null
}
```

- [ ] **Step 5: Справочник** — в конец `packages/db/src/products.ts` (импорт схемы дополнить `poolItems`, drizzle-orm — `and, eq, gt`):
```ts
export interface ProductInfo {
  barcode: string
  nmId: number | null
  vendorCode: string | null
  title: string
  wbSubject: string | null
}

/** Весь справочник: штрихкод → карточка WB и предмет (ставки цен — по предмету). */
export async function loadProducts(db: Db): Promise<ProductInfo[]> {
  return db
    .select({ barcode: products.barcode, nmId: products.nmId, vendorCode: products.vendorCode, title: products.title, wbSubject: products.wbSubject })
    .from(products)
}

/** Карточки WB с остатком в пуле — сторож спрашивает прайс только у товаров в наличии. */
export async function inStockNmIds(db: Db): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ nmId: products.nmId })
    .from(poolItems)
    .innerJoin(products, eq(products.barcode, poolItems.barcode))
    .where(and(gt(poolItems.base, 0), isNotNull(products.nmId)))
  return new Set(rows.flatMap((r) => (r.nmId === null ? [] : [r.nmId])))
}
```
`packages/db/src/index.ts` — добавить `export * from "./decisions"`, `"./sync-state"`, `"./spp-store"`, `"./price-snapshots"`.

- [ ] **Step 6: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add packages/db/src/decisions.ts packages/db/src/sync-state.ts packages/db/src/spp-store.ts packages/db/src/price-snapshots.ts packages/db/src/products.ts packages/db/src/index.ts packages/db/src/store-2.db.test.ts
git commit -m "sync2: хранилища вопросов, окна лимита цен WB и курсора Telegram, СПП, снимков цен, справочник для цен"
```

---

### Task 10: Запись цены через `executeWrites` — `WriteOp.price`

**Files:**
- Modify: `packages/platforms/src/writer.ts`, `packages/platforms/src/writer.test.ts`

- [ ] **Step 1: Падающий тест** — в конец `describe("executeWrites"` в `writer.test.ts`:
```ts
  it("цена: детали записи доходят до отправителя, в итог и в журнал; режим — переданный площадке", async () => {
    const price: WriteOp = {
      channel: "ozon",
      barcode: "A",
      field: "price",
      before: 1140000,
      after: 1149000,
      externalSku: "JW-A",
      price: { baseMinor: 1580000, minMinor: 1140500, vat: "0" },
    }
    const { outcomes, recorded, send } = await run([price], "apply", allModes("apply"))
    expect(send).toHaveBeenCalledWith("ozon", [expect.objectContaining({ field: "price", price: { baseMinor: 1580000, minMinor: 1140500, vat: "0" } })])
    expect(outcomes[0]).toMatchObject({ field: "price", applied: true, price: { baseMinor: 1580000 } })
    expect(recorded[0]).toMatchObject({ price: { baseMinor: 1580000, minMinor: 1140500, vat: "0" } })
  })
```
Помощник `run(…)` файла возвращает `{ outcomes, recorded, send }` — `recorded` то, что получил журнал.
Run: `npx vitest run packages/platforms/src/writer.test.ts` → FAIL (typecheck: нет поля `price`).

- [ ] **Step 2: Реализация** — `packages/platforms/src/writer.ts`, перед `WriteOp`:
```ts
/**
 * Что уходит в запрос записи цены помимо `after` (этап 2). Копейки; WB — целые рубли × 100.
 * Журнал хранит это в writes.detail.
 */
export interface PriceDetail {
  /** Зачёркнутая: Ozon old_price, ЯМ discountBase, KIT price, сайт price, WB — цена до скидки. null — не задаётся. */
  baseMinor: number | null
  /** Ozon min_price; у остальных null. */
  minMinor: number | null
  /** Только WB: целая скидка продавца, %. */
  discountPct?: number
  /** Только Ozon: НДС товара, как его вернула площадка. */
  vat?: string
}
```
в `WriteOp` после `externalSku`:
```ts
  /** Только field = "price": зачёркнутая, min_price, скидка WB, НДС. У остатка отсутствует. */
  price?: PriceDetail
```
`executeWrites` не меняется: `{ ...o }` переносит `price` в итог, `record` получает его, `drizzleWriteStore` пишет в `writes.detail` (Task 7).

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/writer.test.ts && npm run typecheck && npm test
git add packages/platforms/src/writer.ts packages/platforms/src/writer.test.ts
git commit -m "sync2: WriteOp.price — детали записи цены через тот же выключатель и журнал"
```

---

### Task 11: WB — цены (сторож, «вернуть») и продажи с СПП из финотчёта

**Files:**
- Create: `packages/platforms/src/wb/prices.ts`, `wb/prices.test.ts`, `wb/finance.ts`, `wb/finance.test.ts`
- Modify: `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающие тесты.** `packages/platforms/src/wb/prices.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { RateLimitError } from "../errors"
import type { WriteOp } from "../writer"
import { WB_PRICES_PAGE, fetchWbPrices, mapWbGoods, writeWbPrices } from "./prices"

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })
const goods = (nmID: number, price: number, discount: number, discounted: number[]) => ({
  nmID,
  vendorCode: `JW-${nmID}`,
  discount,
  sizes: discounted.map((d, i) => ({ sizeID: i + 1, price, discountedPrice: d, clubDiscountedPrice: d })),
})
afterEach(() => vi.unstubAllGlobals())

describe("mapWbGoods", () => {
  it("цена со скидкой с копейками → копейки; разные цены размеров — признак", () => {
    expect(mapWbGoods([goods(1, 15800, 42, [9164]), goods(2, 25788, 20, [20631.2, 20631.2]), goods(3, 1000, 10, [900, 800])])).toEqual([
      { nmId: 1, vendorCode: "JW-1", priceRub: 15800, discountPct: 42, discountedMinor: 916400, sizesDiffer: false },
      { nmId: 2, vendorCode: "JW-2", priceRub: 25788, discountPct: 20, discountedMinor: 2063120, sizesDiffer: false },
      { nmId: 3, vendorCode: "JW-3", priceRub: 1000, discountPct: 10, discountedMinor: 90000, sizesDiffer: true },
    ])
  })
})

describe("fetchWbPrices", () => {
  it("страница короче 1000 — один запрос, пустую не запрашиваем", async () => {
    const f = vi.fn(async () => json({ data: { listGoods: [goods(1, 15800, 42, [9164])] }, error: false, errorText: "" }))
    vi.stubGlobal("fetch", f)
    expect(await fetchWbPrices("t")).toHaveLength(1)
    expect(f).toHaveBeenCalledTimes(1)
    expect(String(f.mock.calls[0]![0])).toBe(`https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=${WB_PRICES_PAGE}&offset=0`)
  })

  it("429 — сразу ошибка лимита со сроком, без повторов (окно считает джоба)", async () => {
    const f = vi.fn(async () => json({ title: "too many requests" }, 429, { "X-Ratelimit-Retry": "681" }))
    vi.stubGlobal("fetch", f)
    const err = await fetchWbPrices("t").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RateLimitError)
    expect((err as RateLimitError).resetSeconds).toBe(681)
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe("writeWbPrices — только по кнопке «вернуть к прайсу»", () => {
  const op = (nmId: number, priceRub: number, discountPct: number): WriteOp => ({
    channel: "wb",
    barcode: `B${nmId}`,
    field: "price",
    before: 869000,
    after: priceRub * (100 - discountPct),
    externalSku: String(nmId),
    price: { baseMinor: priceRub * 100, minMinor: null, discountPct },
  })

  it("upload/task: nmID, цена в рублях, целая скидка; id загрузки — в ответ", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => json({ data: { id: 777, alreadyExists: false }, error: false, errorText: "" }))
    vi.stubGlobal("fetch", f)
    const r = await writeWbPrices({ token: "t" }, [op(259678801, 15800, 42)])
    expect(r).toEqual([{ barcode: "B259678801", field: "price", ok: true, response: { uploadId: 777, alreadyExists: false } }])
    expect(JSON.parse(String(f.mock.calls[0]![1]!.body))).toEqual({ data: [{ nmID: 259678801, price: 15800, discount: 42 }] })
  })

  it("«цены и скидки уже установлены» — успех; нет скидки в деталях — отказ до сети", async () => {
    const f = vi.fn(async () => json({ data: null, error: true, errorText: "The specified prices and discounts are already set" }, 400))
    vi.stubGlobal("fetch", f)
    const noDetail: WriteOp = { ...op(2, 1000, 10), price: { baseMinor: 100000, minMinor: null } }
    const r = await writeWbPrices({ token: "t" }, [op(1, 15800, 42), noDetail])
    expect(r.find((x) => x.barcode === "B1")).toMatchObject({ ok: true, response: { alreadySet: true } })
    expect(r.find((x) => x.barcode === "B2")).toMatchObject({ ok: false, uncertain: false })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it("5xx — итог неизвестен", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 502)))
    const r = await writeWbPrices({ token: "t", retryDelaysMs: [0] }, [op(1, 15800, 42)])
    expect(r[0]).toMatchObject({ ok: false, uncertain: true })
  })
})
```
`packages/platforms/src/wb/finance.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { FINANCE_PAGE_LIMIT, fetchWbSppSales, mapSppSales } from "./finance"

afterEach(() => vi.unstubAllGlobals())

describe("продажи с СПП из финотчёта WB", () => {
  it("только «Продажа/Продажа» с количеством и СПП; дата — rrDate, иначе saleDt", () => {
    expect(
      mapSppSales([
        { docTypeName: "Продажа", sellerOperName: "Продажа", quantity: 1, spp: 25.31, rrDate: "2026-09-20" },
        { docTypeName: "Продажа", sellerOperName: "Продажа", quantity: 2, spp: 0, saleDt: "2026-09-21T10:00:00Z" },
        { docTypeName: "Возврат", sellerOperName: "Возврат", quantity: 1, spp: 30, rrDate: "2026-09-20" },
        { docTypeName: "", sellerOperName: "Логистика", quantity: 0, spp: 0, rrDate: "2026-09-20" },
        { docTypeName: "Продажа", sellerOperName: "Продажа", quantity: 1, spp: null, rrDate: "2026-09-20" },
      ]),
    ).toEqual([
      { sppBp: 2531, quantity: 1, opDate: "2026-09-20" },
      { sppBp: 0, quantity: 2, opDate: "2026-09-21" },
    ])
  })

  it("один POST за период без повторов; 204 — пусто; полная страница — truncated", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", f)
    expect(await fetchWbSppSales("t", "2026-08-29", "2026-09-28")).toEqual({ rows: [], truncated: false })
    expect(String(f.mock.calls[0]![0])).toBe("https://finance-api.wildberries.ru/api/finance/v1/sales-reports/detailed")
    expect(JSON.parse(String(f.mock.calls[0]![1]!.body))).toEqual({ dateFrom: "2026-08-29", dateTo: "2026-09-28", period: "weekly", limit: FINANCE_PAGE_LIMIT, rrdId: 0 })
    const full = Array.from({ length: FINANCE_PAGE_LIMIT }, () => ({ docTypeName: "", sellerOperName: "Логистика", quantity: 0 }))
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(full), { status: 200 })))
    expect((await fetchWbSppSales("t", "2026-08-29", "2026-09-28")).truncated).toBe(true)
  })
})
```
Run: `npx vitest run packages/platforms/src/wb/prices.test.ts packages/platforms/src/wb/finance.test.ts` → FAIL.

- [ ] **Step 2: Цены WB** — `packages/platforms/src/wb/prices.ts`:
```ts
// Цены WB (этап 2 синка v2): чтение — сторож, запись — только кнопка «вернуть к прайсу».
// Спецификация: docs/api-reference/openapi/wildberries/02-products.yaml, «Цены и скидки».
import { errorText, rubToMinor, type WbPriceRow } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { requestJson } from "../http"
import { chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"

export const WB_PRICES_BASE = "https://discounts-prices-api.wildberries.ru"
export const WB_PRICES_PAGE = 1000
export const WB_PRICES_UPLOAD_MAX = 1000
/** Потолок страниц — на патологию: у магазина ~400 карточек, это одна страница. */
const MAX_PAGES = 50

export interface WbGoodsList {
  nmID: number
  vendorCode?: string | null
  discount?: number | null
  sizes?: Array<{ sizeID?: number | null; price?: number | null; discountedPrice?: number | null }> | null
}

interface WbGoodsResponse {
  data?: { listGoods?: WbGoodsList[] | null } | null
  error?: boolean
  errorText?: string
}

export function mapWbGoods(list: readonly WbGoodsList[]): WbPriceRow[] {
  const out: WbPriceRow[] = []
  for (const g of list) {
    const sizes = g.sizes ?? []
    const first = sizes[0]
    if (!first || typeof first.price !== "number") continue
    const discountPct = g.discount ?? 0
    const discounted = (s: { price?: number | null; discountedPrice?: number | null }) =>
      rubToMinor(s.discountedPrice ?? ((s.price ?? 0) * (100 - discountPct)) / 100)
    const firstMinor = discounted(first)
    out.push({
      nmId: g.nmID,
      vendorCode: g.vendorCode ?? null,
      priceRub: first.price,
      discountPct,
      discountedMinor: firstMinor,
      sizesDiffer: sizes.some((s) => discounted(s) !== firstMinor),
    })
  }
  return out
}

/**
 * Цены всех карточек (`GET list/goods/filter` по 1000). Каждая страница — запрос из окна «Цены и скидки»
 * (базовый токен: 4 в час, интервал 15 мин), поэтому страница короче limit — конец без запроса пустой, а
 * повторов на 429 нет: окно ведёт джоба prices (sync_state), RateLimitError несёт resetSeconds.
 */
export async function fetchWbPrices(token: string, retryDelaysMs: number[] = []): Promise<WbPriceRow[]> {
  const all: WbGoodsList[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${WB_PRICES_BASE}/api/v2/list/goods/filter?limit=${WB_PRICES_PAGE}&offset=${page * WB_PRICES_PAGE}`
    const body = await requestJson<WbGoodsResponse>("wb", url, { token, retryDelaysMs })
    if (body.error) throw new PlatformApiError("wb", 200, `WB цены: ${body.errorText ?? "ошибка без текста"}`, body)
    const got = body.data?.listGoods ?? []
    all.push(...got)
    if (got.length < WB_PRICES_PAGE) return mapWbGoods(all)
  }
  throw new Error(`WB цены: больше ${MAX_PAGES} страниц — список неполный`)
}

/** Ответ «такие цены и скидки уже установлены» — цель уже на площадке, не ошибка. */
const ALREADY_SET = /already set/i

interface WbUploadResponse {
  data?: { id?: number; alreadyExists?: boolean } | null
  error?: boolean
  errorText?: string
}

/**
 * `POST upload/task`: nmID, цена до скидки (целые ₽), целая скидка. Применяется площадкой не сразу —
 * «применено» здесь значит «загрузка принята» (id в ответе); проверяет следующее чтение сторожа. Нет цены
 * до скидки в целых рублях или скидки — отказ до сети.
 */
export async function writeWbPrices(cfg: { token: string; retryDelaysMs?: number[] }, ops: WriteOp[]): Promise<SendResult[]> {
  const results: SendResult[] = []
  const ready: WriteOp[] = []
  for (const op of ops) {
    const base = op.price?.baseMinor
    if (op.field !== "price" || base === null || base === undefined || base % 100 !== 0 || op.price?.discountPct === undefined) {
      results.push(failed(op, "WB: нет цены до скидки в целых рублях или скидки — запись невозможна"))
    } else ready.push(op)
  }
  const { valid, rejected } = splitByKey(ready, (o) => o.externalSku)
  results.push(...rejected)
  for (const batch of chunk(valid, WB_PRICES_UPLOAD_MAX)) {
    try {
      const body = await requestJson<WbUploadResponse>("wb", `${WB_PRICES_BASE}/api/v2/upload/task`, {
        token: cfg.token,
        method: "POST",
        body: { data: batch.map(({ op, key }) => ({ nmID: Number(key), price: op.price!.baseMinor! / 100, discount: op.price!.discountPct! })) },
        retryDelaysMs: cfg.retryDelaysMs ?? [],
      })
      if (body.error) {
        for (const { op } of batch) results.push(failed(op, `WB: ${body.errorText ?? "ошибка без текста"}`, { response: body }))
        continue
      }
      for (const { op } of batch) results.push(succeeded(op, { uploadId: body.data?.id ?? null, alreadyExists: body.data?.alreadyExists ?? false }))
    } catch (e) {
      if (e instanceof PlatformApiError && e.status === 400 && ALREADY_SET.test(JSON.stringify(e.body ?? ""))) {
        for (const { op } of batch) results.push(succeeded(op, { alreadySet: true }))
        continue
      }
      for (const { op } of batch) results.push(failed(op, `WB: цена не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
    }
  }
  return results
}
```
- [ ] **Step 3: Продажи с СПП** — `packages/platforms/src/wb/finance.ts`:
```ts
// Продажи с процентом СПП из финотчёта WB (этап 2, коэффициент СПП). Метод и поля — 13-finances.yaml;
// образец чтения — finstock packages/platforms/src/wb/finance-client.ts (там spp не разбирается).
import { percentToBp, type SppSaleRow } from "@sync2/shared"
import { requestJsonOrNull } from "../http"

const FINANCE = "https://finance-api.wildberries.ru"
export const FINANCE_PAGE_LIMIT = 100_000

export interface WbFinanceSppRow {
  docTypeName?: string | null
  sellerOperName?: string | null
  quantity?: number | null
  /** «Платформенные скидки, %». */
  spp?: number | null
  rrDate?: string | null
  saleDt?: string | null
}

/** Выкупы с СПП: строки «Продажа/Продажа» с количеством > 0 и СПП в [0, 100). */
export function mapSppSales(rows: readonly WbFinanceSppRow[]): SppSaleRow[] {
  const out: SppSaleRow[] = []
  for (const r of rows) {
    if (r.docTypeName !== "Продажа" || r.sellerOperName !== "Продажа") continue
    const quantity = r.quantity ?? 0
    const opDate = r.rrDate ?? r.saleDt?.slice(0, 10) ?? null
    if (quantity <= 0 || !opDate || typeof r.spp !== "number" || r.spp < 0 || r.spp >= 100) continue
    out.push({ sppBp: percentToBp(r.spp), quantity, opDate })
  }
  return out
}

/**
 * Одна страница детализации за [from, to] (ГГГГ-ММ-ДД): у базового токена 2 запроса в сутки с интервалом
 * 12 ч на аккаунт — ни второй страницы, ни запроса ради пустой, ни повторов. Полная страница — truncated:
 * данные могли быть не все, джоба spp коэффициент не меняет.
 */
export async function fetchWbSppSales(token: string, from: string, to: string): Promise<{ rows: SppSaleRow[]; truncated: boolean }> {
  const page = await requestJsonOrNull<WbFinanceSppRow[]>("wb", `${FINANCE}/api/finance/v1/sales-reports/detailed`, {
    token,
    method: "POST",
    body: { dateFrom: from, dateTo: to, period: "weekly", limit: FINANCE_PAGE_LIMIT, rrdId: 0 },
    retryDelaysMs: [],
    timeoutMs: 120_000,
  })
  const rows = page ?? []
  return { rows: mapSppSales(rows), truncated: rows.length >= FINANCE_PAGE_LIMIT }
}
```
`packages/platforms/src/index.ts` — добавить:
```ts
export { fetchWbPrices, mapWbGoods, writeWbPrices, WB_PRICES_PAGE } from "./wb/prices"
export { fetchWbSppSales, mapSppSales, FINANCE_PAGE_LIMIT } from "./wb/finance"
```

- [ ] **Step 4: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/wb && npm run typecheck
git add packages/platforms/src/wb/prices.ts packages/platforms/src/wb/prices.test.ts packages/platforms/src/wb/finance.ts packages/platforms/src/wb/finance.test.ts packages/platforms/src/index.ts
git commit -m "sync2: WB — чтение цен без лишних запросов, запись upload/task по кнопке, продажи с СПП из финотчёта одним запросом"
```

---

### Task 12: Ozon — чтение цен со ставкой товара, запись с `min_price` и выключенными автоакциями

**Files:**
- Create: `packages/platforms/src/ozon/prices.ts`, `ozon/prices.test.ts`
- Modify: `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/platforms/src/ozon/prices.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { fetchOzonPrices, mapOzonPrices, writeOzonPrices } from "./prices"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const cfg = { clientId: "5332036", apiKey: "k", retryDelaysMs: [0] }
afterEach(() => vi.unstubAllGlobals())

const item = (offer_id: string, price: number) => ({
  offer_id,
  price: { price, old_price: 15800, min_price: 11405, vat: 0, marketing_seller_price: price - 500 },
  commissions: { sales_percent_fbs: 54 },
  acquiring: price / 100,
})

describe("чтение цен Ozon (v5)", () => {
  it("цена продавца, зачёркнутая, min_price, НДС, ставка товара = комиссия FBS + эквайринг", () => {
    expect(mapOzonPrices([item("JW-A", 11490)], 100)).toEqual([
      { channel: "ozon", externalSku: "JW-A", priceMinor: 1149000, baseMinor: 1580000, minMinor: 1140500, takeBp: 5500, vat: "0" },
    ])
    expect(mapOzonPrices([{ offer_id: "JW-B", price: { price: 1000, old_price: 0, min_price: 0, vat: 0 }, commissions: { sales_percent_fbs: 0 }, acquiring: 0 }], 100)).toEqual([
      { channel: "ozon", externalSku: "JW-B", priceMinor: 100000, baseMinor: null, minMinor: null, takeBp: null, vat: "0" },
    ])
  })

  it("курсор до неполной страницы", async () => {
    const f = vi.fn(async (_u: string, i?: RequestInit) => {
      const body = JSON.parse(String(i?.body)) as { cursor?: string }
      return json(body.cursor ? { items: [item("JW-2", 1000)], cursor: "" } : { items: Array.from({ length: 1000 }, (_, n) => item(`JW-${n}`, 1000)), cursor: "c1" })
    })
    vi.stubGlobal("fetch", f)
    expect(await fetchOzonPrices(cfg, { acquiringFallbackBp: 100 })).toHaveLength(1001)
    expect(f).toHaveBeenCalledTimes(2)
  })
})

describe("запись цен Ozon", () => {
  const op: WriteOp = { channel: "ozon", barcode: "A", field: "price", before: 1140000, after: 1149000, externalSku: "JW-A", price: { baseMinor: 1580000, minMinor: 1140500, vat: "0" } }

  it("price/old_price/min_price строками, флаг минимальной цены, автоакции выключены", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => json({ result: [{ offer_id: "JW-A", updated: true, errors: [] }] }))
    vi.stubGlobal("fetch", f)
    expect(await writeOzonPrices(cfg, [op])).toEqual([{ barcode: "A", field: "price", ok: true, response: { offer_id: "JW-A", updated: true, errors: [] } }])
    expect(String(f.mock.calls[0]![0])).toBe("https://api-seller.ozon.ru/v1/product/import/prices")
    expect(JSON.parse(String(f.mock.calls[0]![1]!.body))).toEqual({
      prices: [
        {
          offer_id: "JW-A",
          price: "11490.00",
          old_price: "15800.00",
          min_price: "11405.00",
          min_price_for_auto_actions_enabled: true,
          auto_action_enabled: "DISABLED",
          auto_add_to_ozon_actions_list_enabled: "DISABLED",
          price_strategy_enabled: "UNKNOWN",
          currency_code: "RUB",
          vat: "0",
        },
      ],
    })
  })

  it("отказ позиции — коды Ozon; нет зачёркнутой или min_price — отказ до сети", async () => {
    const f = vi.fn(async () => json({ result: [{ offer_id: "JW-A", updated: false, errors: [{ code: "action_price_enabled_min_price_missing" }] }] }))
    vi.stubGlobal("fetch", f)
    const r = await writeOzonPrices(cfg, [op, { ...op, barcode: "B", externalSku: "JW-B", price: { baseMinor: null, minMinor: null } }])
    expect(r.find((x) => x.barcode === "A")).toMatchObject({ ok: false, uncertain: false, error: "Ozon: action_price_enabled_min_price_missing" })
    expect(r.find((x) => x.barcode === "B")).toMatchObject({ ok: false, uncertain: false })
    expect(f).toHaveBeenCalledTimes(1)
  })
})
```
Run: `npx vitest run packages/platforms/src/ozon/prices.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `packages/platforms/src/ozon/prices.ts`:
```ts
// Цены Ozon (этап 2 синка v2). Чтение — POST /v5/product/info/prices; запись — POST /v1/product/import/prices
// (образец — sync/src/clients.ts writeOzonPrices и sync/scripts/ozon-min-price-flag.mjs, описание — swagger_ozon.json).
import { BP, errorText, minorToDecimalString, percentToBp, rubToMinor, type MirrorPrice } from "@sync2/shared"
import { requestJson, requestJsonWithMeta } from "../http"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { BASE, ozonAuth, type OzonCredentials } from "./client"

const PAGE = 1000
const MAX_PAGES = 100
/** Позиций в запросе записи — как у v1 (спецификация допускает 1000; цену товара — не чаще 10 раз в час). */
export const OZON_PRICES_BATCH = 100

interface OzonV5PriceItem {
  offer_id?: string | null
  price?: { price?: number | null; old_price?: number | null; min_price?: number | null; vat?: number | null } | null
  commissions?: { sales_percent_fbs?: number | null } | null
  /** Максимальная комиссия за эквайринг, рубли. */
  acquiring?: number | null
}

/**
 * Цена продавца `price` (не marketing_seller_price: её двигают акции Ozon за его счёт — сравнение с ней дало
 * бы флаппинг). Ставка товара — sales_percent_fbs + эквайринг долей цены; эквайринга нет — запасная доля.
 */
export function mapOzonPrices(items: readonly OzonV5PriceItem[], acquiringFallbackBp: number): MirrorPrice[] {
  const out: MirrorPrice[] = []
  for (const it of items) {
    const p = it.price
    if (!it.offer_id || !p || typeof p.price !== "number" || p.price <= 0) continue
    const priceMinor = rubToMinor(p.price)
    const sales = it.commissions?.sales_percent_fbs
    const acquiringBp = typeof it.acquiring === "number" && it.acquiring > 0 ? Math.round((rubToMinor(it.acquiring) * BP) / priceMinor) : acquiringFallbackBp
    out.push({
      channel: "ozon",
      externalSku: it.offer_id,
      priceMinor,
      baseMinor: p.old_price ? rubToMinor(p.old_price) : null,
      minMinor: p.min_price ? rubToMinor(p.min_price) : null,
      takeBp: typeof sales === "number" && sales > 0 ? percentToBp(sales) + acquiringBp : null,
      vat: p.vat === null || p.vat === undefined ? null : String(p.vat),
    })
  }
  return out
}

export async function fetchOzonPrices(credentials: OzonCredentials, opts: { acquiringFallbackBp: number }): Promise<MirrorPrice[]> {
  const all: OzonV5PriceItem[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<{ items?: OzonV5PriceItem[] | null; cursor?: string | null }>("ozon", `${BASE}/v5/product/info/prices`, {
      ...ozonAuth(credentials),
      method: "POST",
      body: { filter: { visibility: "ALL" }, limit: PAGE, ...(cursor ? { cursor } : {}) },
    })
    const items = body.items ?? []
    all.push(...items)
    if (items.length < PAGE || !body.cursor || body.cursor === cursor) return mapOzonPrices(all, opts.acquiringFallbackBp)
    cursor = body.cursor
  }
  throw new Error(`Ozon цены: больше ${MAX_PAGES} страниц — список неполный`)
}

interface OzonPriceUpdateRow {
  offer_id?: string
  updated?: boolean
  errors?: Array<{ code?: string; message?: string }> | null
}

/**
 * Цена, зачёркнутая и min_price (порог равного нетто) абсолютными значениями — повтор безопасен.
 * min_price_for_auto_actions_enabled: true, автоакции и автодобавление — DISABLED (спека §6); продление
 * таймера флага — этап 3 (ozon-guard). НДС — как вернула площадка.
 */
export async function writeOzonPrices(cfg: OzonCredentials & { retryDelaysMs?: number[] }, ops: WriteOp[]): Promise<SendResult[]> {
  const results: SendResult[] = []
  const ready: WriteOp[] = []
  for (const op of ops) {
    if (op.field !== "price" || op.price?.baseMinor == null || op.price.minMinor == null) results.push(failed(op, "Ozon: нет зачёркнутой или min_price — запись невозможна"))
    else ready.push(op)
  }
  const { valid, rejected } = splitByKey(ready, (o) => o.externalSku)
  results.push(...rejected)
  for (const batch of chunk(valid, OZON_PRICES_BATCH)) {
    let rows: OzonPriceUpdateRow[]
    try {
      const r = await requestJsonWithMeta<{ result?: OzonPriceUpdateRow[] | null }>("ozon", `${BASE}/v1/product/import/prices`, {
        ...ozonAuth(cfg),
        method: "POST",
        body: {
          prices: batch.map(({ op, key }) => ({
            offer_id: key,
            price: minorToDecimalString(op.after),
            old_price: minorToDecimalString(op.price!.baseMinor!),
            min_price: minorToDecimalString(op.price!.minMinor!),
            min_price_for_auto_actions_enabled: true,
            auto_action_enabled: "DISABLED",
            auto_add_to_ozon_actions_list_enabled: "DISABLED",
            price_strategy_enabled: "UNKNOWN",
            currency_code: "RUB",
            ...(op.price!.vat !== undefined ? { vat: op.price!.vat } : {}),
          })),
        },
        retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
        timeoutMs: WRITE_TIMEOUT_MS,
        maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS,
      })
      rows = r.body.result ?? []
    } catch (e) {
      for (const { op } of batch) results.push(failed(op, `Ozon: цена не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
      continue
    }
    const byOffer = new Map(rows.map((r) => [String(r.offer_id ?? ""), r]))
    for (const { op, key } of batch) {
      const row = byOffer.get(key)
      if (!row) results.push(failed(op, `Ozon: нет итога по offer_id ${key}`, { uncertain: true }))
      else if (row.updated) results.push(succeeded(op, row))
      else results.push(failed(op, `Ozon: ${(row.errors ?? []).map((x) => x.code ?? x.message ?? "?").join(", ") || "не обновлено"}`, { response: row }))
    }
  }
  return results
}
```
`index.ts` — `export { fetchOzonPrices, mapOzonPrices, writeOzonPrices } from "./ozon/prices"`.

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/ozon && npm run typecheck
git add packages/platforms/src/ozon/prices.ts packages/platforms/src/ozon/prices.test.ts packages/platforms/src/index.ts
git commit -m "sync2: Ozon — чтение цен со ставкой товара, запись цены с min_price и выключенными автоакциями"
```

---

### Task 13: ЯМ — чтение и запись цен без `minimumForBestseller`

**Files:**
- Create: `packages/platforms/src/ym/prices.ts`, `ym/prices.test.ts`
- Modify: `packages/platforms/src/ym/client.ts` (экспорт `pagedUrl`, `nextSnapshotPage`), `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/platforms/src/ym/prices.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { fetchYmPrices, writeYmPrices, ymPricesBody } from "./prices"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const cfg = { apiKey: "k", businessId: "187548892", campaignId: "149197829", retryDelaysMs: [0] }
const op = (offer: string, after: number, base: number | null): WriteOp => ({ channel: "ym", barcode: `B-${offer}`, field: "price", before: 1200000, after, externalSku: offer, price: { baseMinor: base, minMinor: null } })
afterEach(() => vi.unstubAllGlobals())

describe("цены ЯМ", () => {
  it("тело записи: value и discountBase рублями, валюта RUR, minimumForBestseller не передаётся НИКОГДА (решение п. 14)", () => {
    const body = ymPricesBody([{ op: op("JW-A", 1219000, 1580000), key: "JW-A" }])
    expect(body).toEqual({ offers: [{ offerId: "JW-A", price: { value: 12190, currencyId: "RUR", discountBase: 15800 } }] })
    expect(JSON.stringify(body)).not.toContain("minimumForBestseller")
  })

  it("чтение: страницы по pageToken в строке запроса; цена и зачёркнутая → копейки", async () => {
    const f = vi.fn(async (u: string) =>
      json(
        new URL(u).searchParams.get("pageToken")
          ? { status: "OK", result: { offers: [{ offerId: "JW-B", price: { value: 5000 } }], paging: {} } }
          : { status: "OK", result: { offers: [{ offerId: "JW-A", price: { value: 12190, discountBase: 15800, minimumForBestseller: 11000 } }], paging: { nextPageToken: "p2" } } },
      ),
    )
    vi.stubGlobal("fetch", f)
    expect(await fetchYmPrices(cfg)).toEqual([
      { channel: "ym", externalSku: "JW-A", priceMinor: 1219000, baseMinor: 1580000, minMinor: null, takeBp: null, vat: null },
      { channel: "ym", externalSku: "JW-B", priceMinor: 500000, baseMinor: null, minMinor: null, takeBp: null, vat: null },
    ])
    expect(String(f.mock.calls[0]![0])).toContain("/v2/businesses/187548892/offer-prices?limit=")
  })

  it("запись: status OK — применено; без зачёркнутой — отказ до сети; 4xx — отказ без неопределённости", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ status: "OK" })))
    const r = await writeYmPrices(cfg, [op("JW-A", 1219000, 1580000), op("JW-B", 500000, null)])
    expect(r.find((x) => x.barcode === "B-JW-A")).toMatchObject({ ok: true })
    expect(r.find((x) => x.barcode === "B-JW-B")).toMatchObject({ ok: false, uncertain: false })
    vi.stubGlobal("fetch", vi.fn(async () => json({ status: "ERROR", errors: [{ code: "BAD_REQUEST" }] }, 400)))
    expect((await writeYmPrices(cfg, [op("JW-A", 1219000, 1580000)]))[0]).toMatchObject({ ok: false, uncertain: false })
  })
})
```
Run: `npx vitest run packages/platforms/src/ym/prices.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** В `packages/platforms/src/ym/client.ts` у `function nextSnapshotPage` и `function pagedUrl` добавить `export` (логика не меняется). `packages/platforms/src/ym/prices.ts`:
```ts
// Цены ЯМ на уровне бизнеса (этап 2 синка v2): чтение — POST /v2/businesses/{businessId}/offer-prices,
// запись — POST …/offer-prices/updates (образец — sync/src/clients.ts writeYmPrices; openapi.yaml).
import { errorText, minorToRub, rubToMinor, type MirrorPrice } from "@sync2/shared"
import { requestJson } from "../http"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { BASE, nextSnapshotPage, pagedUrl, ymAuth, type YmCredentials } from "./client"

const PAGE = 200
const MAX_PAGES = 1000
/** maxItems UpdateBusinessPricesRequest.offers. */
export const YM_PRICES_BATCH = 500

interface YmOfferPrice {
  offerId?: string | null
  price?: { value?: number | null; discountBase?: number | null } | null
}

export async function fetchYmPrices(credentials: YmCredentials): Promise<MirrorPrice[]> {
  const out: MirrorPrice[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await requestJson<{ result?: { offers?: YmOfferPrice[] | null; paging?: { nextPageToken?: string | null } | null } | null }>(
      "ym",
      pagedUrl(`/v2/businesses/${credentials.businessId}/offer-prices`, PAGE, pageToken),
      { ...ymAuth(credentials), method: "POST", body: {} },
    )
    const offers = body.result?.offers ?? []
    for (const o of offers) {
      if (!o.offerId || typeof o.price?.value !== "number" || o.price.value <= 0) continue
      out.push({
        channel: "ym",
        externalSku: o.offerId,
        priceMinor: rubToMinor(o.price.value),
        baseMinor: o.price.discountBase ? rubToMinor(o.price.discountBase) : null,
        minMinor: null,
        takeBp: null,
        vat: null,
      })
    }
    const next = nextSnapshotPage("цены", body.result?.paging?.nextPageToken, pageToken, offers.length)
    if (!next) return out
    pageToken = next
  }
  throw new Error(`ЯМ цены: больше ${MAX_PAGES} страниц — список неполный`)
}

/**
 * Тело записи. `discountBase` — всегда (спека §6), `minimumForBestseller` — никогда: его отсутствие стирает
 * значение, и товар не попадает в «Бестселлеры» по минимальной цене (решение 25.09, п. 14).
 */
export function ymPricesBody(batch: ReadonlyArray<{ op: WriteOp; key: string }>) {
  return {
    offers: batch.map(({ op, key }) => ({
      offerId: key,
      price: { value: minorToRub(op.after), currencyId: "RUR", discountBase: minorToRub(op.price!.baseMinor!) },
    })),
  }
}

/** Ответ — пустой ApiResponse: без итогов по позициям; status OK — применено вся пачка (площадка обновляет каталог до нескольких минут). */
export async function writeYmPrices(cfg: YmCredentials & { retryDelaysMs?: number[] }, ops: WriteOp[]): Promise<SendResult[]> {
  const results: SendResult[] = []
  const ready: WriteOp[] = []
  for (const op of ops) {
    if (op.field !== "price" || op.price?.baseMinor == null) results.push(failed(op, "ЯМ: нет зачёркнутой (discountBase) — запись невозможна"))
    else ready.push(op)
  }
  const { valid, rejected } = splitByKey(ready, (o) => o.externalSku)
  results.push(...rejected)
  for (const batch of chunk(valid, YM_PRICES_BATCH)) {
    try {
      const body = await requestJson<{ status?: string }>("ym", `${BASE}/v2/businesses/${cfg.businessId}/offer-prices/updates`, {
        ...ymAuth(cfg),
        method: "POST",
        body: ymPricesBody(batch),
        retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
        timeoutMs: WRITE_TIMEOUT_MS,
        maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS,
      })
      for (const { op } of batch) results.push(body.status === "OK" ? succeeded(op, body) : failed(op, `ЯМ: статус ${body.status ?? "?"}`, { response: body, uncertain: true }))
    } catch (e) {
      for (const { op } of batch) results.push(failed(op, `ЯМ: цена не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
    }
  }
  return results
}
```
`index.ts` — `export { fetchYmPrices, writeYmPrices, ymPricesBody } from "./ym/prices"`.

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/ym && npm run typecheck
git add packages/platforms/src/ym/client.ts packages/platforms/src/ym/prices.ts packages/platforms/src/ym/prices.test.ts packages/platforms/src/index.ts
git commit -m "sync2: ЯМ — цены на уровне бизнеса: чтение с pageToken в query, запись с discountBase и без minimumForBestseller"
```

---

### Task 14: KIT — цены вариантов

**Files:**
- Create: `packages/platforms/src/kit/prices.ts`, `kit/prices.test.ts`
- Modify: `packages/platforms/src/kit/client.ts` (`KitVariant.pricing`), `packages/platforms/src/kit/stock-writer.ts` (экспорт `kitItemErrors`), `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/platforms/src/kit/prices.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { resetKitPaceForTests } from "./client"
import { mapKitPrices, writeKitPrices } from "./prices"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const cfg = { token: "t", retryDelaysMs: [0] }
const op = (id: string, after: number, base: number | null): WriteOp => ({ channel: "kit", barcode: `B-${id}`, field: "price", before: 916400, after, externalSku: id, price: { baseMinor: base, minMinor: null } })
beforeEach(() => resetKitPaceForTests())
afterEach(() => vi.unstubAllGlobals())

describe("цены KIT", () => {
  it("цена продажи — ручная со скидкой, иначе до скидки; зачёркнутая — до скидки при ручной", () => {
    expect(
      mapKitPrices([
        { id: "v1", barcode: "A", pricing: { price: "15800", manual_discount_price: "6890.00", final_price: "6890" } },
        { id: "v2", barcode: "B", pricing: { price: "9164.00", manual_discount_price: null } },
        { id: "v3", barcode: "C", pricing: null },
      ]),
    ).toEqual([
      { channel: "kit", externalSku: "v1", priceMinor: 689000, baseMinor: 1580000, minMinor: null, takeBp: null, vat: null },
      { channel: "kit", externalSku: "v2", priceMinor: 916400, baseMinor: null, minMinor: null, takeBp: null, vat: null },
    ])
  })

  it("запись: price — зачёркнутая, manual_discount_price — цель; без зачёркнутой — сброс цены со скидкой", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", f)
    const r = await writeKitPrices(cfg, [op("v1", 689000, 1580000), op("v2", 916400, null)])
    expect(r.every((x) => x.ok)).toBe(true)
    expect(String(f.mock.calls[0]![0])).toBe("https://api.kit.yandex.net/v1/variants/prices/bulk_update")
    expect(JSON.parse(String(f.mock.calls[0]![1]!.body))).toEqual({
      items: [
        { variant_id: "v1", price: "15800.00", manual_discount_price: "6890.00" },
        { variant_id: "v2", price: "9164.00", manual_discount_price: null },
      ],
    })
  })

  it("атомарный 400 со списком битых — они отказ, остальные — один повтор без них", async () => {
    let calls = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (++calls === 1 ? json({ errors: [{ variant_id: "v2", code: "NOT_FOUND" }] }, 400) : new Response(null, { status: 204 }))),
    )
    const r = await writeKitPrices(cfg, [op("v1", 689000, 1580000), op("v2", 916400, null)])
    expect(r.find((x) => x.barcode === "B-v2")).toMatchObject({ ok: false, error: "KIT: NOT_FOUND", uncertain: false })
    expect(r.find((x) => x.barcode === "B-v1")).toMatchObject({ ok: true })
  })
})
```
Run: `npx vitest run packages/platforms/src/kit/prices.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `packages/platforms/src/kit/client.ts`, в `KitVariant` после `stocks`:
```ts
  /** Цены варианта (kit-swagger VariantPricing): десятичные строки. Этап 2 синка v2. */
  pricing?: { price?: string | null; manual_discount_price?: string | null; promotion_price?: string | null; final_price?: string | null } | null
```
`packages/platforms/src/kit/stock-writer.ts`: `function itemErrors` → `export function kitItemErrors` (и вызов внутри `sendBatch`). `packages/platforms/src/kit/prices.ts`:
```ts
// Цены KIT (этап 2 синка v2): чтение — варианты (`pricing`), запись — POST /v1/variants/prices/bulk_update
// (kit-swagger.openapi.json: до 5000, синхронно и атомарно, 204 — успех).
import { decimalStringToMinor, errorText, minorToDecimalString, type MirrorPrice } from "@sync2/shared"
import { PlatformApiError } from "../errors"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { fetchKitVariants, kitRequestOrNull, type KitCredentials, type KitVariant } from "./client"
import { KIT_BULK_MAX, kitItemErrors } from "./stock-writer"

/** Цена продажи — ручная цена со скидкой, если задана, иначе цена до скидки. promotion_price (акции KIT) не наша. */
export function mapKitPrices(variants: readonly KitVariant[]): MirrorPrice[] {
  const out: MirrorPrice[] = []
  for (const v of variants) {
    const p = v.pricing
    if (!p?.price) continue
    const base = decimalStringToMinor(p.price)
    const manual = p.manual_discount_price ? decimalStringToMinor(p.manual_discount_price) : null
    out.push({ channel: "kit", externalSku: v.id, priceMinor: manual ?? base, baseMinor: manual !== null ? base : null, minMinor: null, takeBp: null, vat: null })
  }
  return out
}

export async function fetchKitPrices(credentials: KitCredentials): Promise<MirrorPrice[]> {
  return mapKitPrices(await fetchKitVariants(credentials))
}

type Keyed = { op: WriteOp; key: string }

function item({ op, key }: Keyed) {
  const base = op.price?.baseMinor ?? null
  const discounted = base !== null && base > op.after
  return { variant_id: key, price: minorToDecimalString(discounted ? base : op.after), manual_discount_price: discounted ? minorToDecimalString(op.after) : null }
}

async function sendBatch(cfg: KitCredentials & { retryDelaysMs?: number[] }, batch: Keyed[], retryWithoutInvalid: boolean): Promise<SendResult[]> {
  if (batch.length === 0) return []
  try {
    await kitRequestOrNull(cfg, "/v1/variants/prices/bulk_update", {
      method: "POST",
      body: { items: batch.map(item) },
      retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
      timeoutMs: WRITE_TIMEOUT_MS,
      maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS,
    })
    return batch.map((k) => succeeded(k.op, item(k)))
  } catch (e) {
    const invalid = e instanceof PlatformApiError && e.status === 400 ? kitItemErrors(e.body) : new Map<string, string>()
    if (retryWithoutInvalid && invalid.size > 0) {
      const bad = batch.filter(({ key }) => invalid.has(key))
      const good = batch.filter(({ key }) => !invalid.has(key))
      return [...bad.map(({ op, key }) => failed(op, `KIT: ${invalid.get(key)}`)), ...(await sendBatch(cfg, good, false))]
    }
    return batch.map(({ op }) => failed(op, `KIT: цена не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
  }
}

/** Зачёркнутая — `price`, цель — `manual_discount_price`; без зачёркнутой — цель в `price` и сброс ручной скидки. */
export async function writeKitPrices(cfg: KitCredentials & { retryDelaysMs?: number[] }, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  for (const batch of chunk(valid, KIT_BULK_MAX)) results.push(...(await sendBatch(cfg, batch, true)))
  return results
}
```
`index.ts` — `export { fetchKitPrices, mapKitPrices, writeKitPrices } from "./kit/prices"`.

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/kit && npm run typecheck
git add packages/platforms/src/kit packages/platforms/src/index.ts
git commit -m "sync2: KIT — цены вариантов: чтение pricing, запись prices/bulk_update с зачёркнутой и повтором без битых"
```

---

### Task 15: Сайт — служебный API цен (клиент `sync2`)

**Files:**
- Create: `packages/platforms/src/site/prices.ts`, `site/prices.test.ts`
- Modify: `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающий тест** — `packages/platforms/src/site/prices.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { fetchSitePrices, writeSitePrices } from "./prices"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const cfg = { baseUrl: "https://kotelnikovartifact.ru", token: "s".repeat(40) }
const op = (nmId: number, after: number, base: number | null): WriteOp => ({ channel: "site", barcode: `B${nmId}`, field: "price", before: 916400, after, externalSku: String(nmId), price: { baseMinor: base, minMinor: null } })
afterEach(() => vi.unstubAllGlobals())

describe("цены сайта", () => {
  it("GET: источник и цены по nmId; зачёркнутая — только если выше цены", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ source: "pool", items: [{ nmId: 1, priceKopecks: 1580000, discountedPriceKopecks: 689000 }, { nmId: 2, priceKopecks: 0, discountedPriceKopecks: 0 }] })),
    )
    expect(await fetchSitePrices(cfg)).toEqual({
      source: "pool",
      prices: [
        { channel: "site", externalSku: "1", priceMinor: 689000, baseMinor: 1580000, minMinor: null, takeBp: null, vat: null },
        { channel: "site", externalSku: "2", priceMinor: 0, baseMinor: null, minMinor: null, takeBp: null, vat: null },
      ],
    })
  })

  it("PUT по nmId в копейках; неизвестный nmId — отказ; 409 (витрина не на пуле) — отказ без неопределённости", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => json({ updated: 1, unknown: [2], source: "pool" }))
    vi.stubGlobal("fetch", f)
    const r = await writeSitePrices(cfg, [op(1, 689000, 1580000), op(2, 500000, null)])
    expect(JSON.parse(String(f.mock.calls[0]![1]!.body))).toEqual({
      items: [
        { nmId: 1, priceKopecks: 1580000, discountedPriceKopecks: 689000 },
        { nmId: 2, priceKopecks: 500000, discountedPriceKopecks: 500000 },
      ],
    })
    expect(r.find((x) => x.barcode === "B1")).toMatchObject({ ok: true })
    expect(r.find((x) => x.barcode === "B2")).toMatchObject({ ok: false, error: "сайт не знает nmId 2" })
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "price_source_not_pool", source: "wb" }, 409)))
    expect((await writeSitePrices(cfg, [op(1, 689000, 1580000)]))[0]).toMatchObject({ ok: false, uncertain: false })
  })
})
```
Run: `npx vitest run packages/platforms/src/site/prices.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `packages/platforms/src/site/prices.ts`:
```ts
// Цены сайта (этап 2 синка v2): GET/PUT /api/internal/prices сайта kotelnikovartifact (ветка feat/internal-prices).
// Ключ — nmId карточки WB (цена у сайта — на товар, как у WB). Копейки в обе стороны.
import { errorText, type MirrorPrice } from "@sync2/shared"
import { WRITE_MAX_RETRY_AFTER_MS, WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, splitByKey, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { siteRequest, type SiteCredentials } from "./client"

/** Откуда витрина берёт цену (PRICE_SOURCE сайта): wb — сама с WB; pool — от синка. */
export type SitePriceSource = "wb" | "pool"

export interface SitePriceItem {
  nmId: number
  priceKopecks: number
  discountedPriceKopecks: number
}

/** Позиций в одном PUT — предел схемы сайта. */
export const SITE_PRICES_PUT_MAX = 5000

export async function fetchSitePrices(credentials: SiteCredentials): Promise<{ source: SitePriceSource; prices: MirrorPrice[] }> {
  const body = await siteRequest<{ source?: unknown; items?: SitePriceItem[] | null }>(credentials, "/api/internal/prices")
  if (body.source !== "wb" && body.source !== "pool") throw new Error(`сайт: неизвестный источник цены «${String(body.source)}»`)
  if (!Array.isArray(body.items)) throw new Error("сайт: ответ цен без списка items")
  return {
    source: body.source,
    prices: body.items.map((i) => ({
      channel: "site",
      externalSku: String(i.nmId),
      priceMinor: i.discountedPriceKopecks,
      baseMinor: i.priceKopecks > i.discountedPriceKopecks ? i.priceKopecks : null,
      minMinor: null,
      takeBp: null,
      vat: null,
    })),
  }
}

/** PUT абсолютных цен; сайт принимает только при PRICE_SOURCE=pool (иначе 409 — второй писатель цены запрещён). */
export async function writeSitePrices(credentials: SiteCredentials, ops: WriteOp[]): Promise<SendResult[]> {
  const { valid, rejected } = splitByKey(ops, (o) => o.externalSku)
  const results: SendResult[] = [...rejected]
  for (const batch of chunk(valid, SITE_PRICES_PUT_MAX)) {
    let r: { updated?: number; unknown?: number[] | null }
    try {
      r = await siteRequest<{ updated?: number; unknown?: number[] | null }>(credentials, "/api/internal/prices", {
        method: "PUT",
        body: { items: batch.map(({ op, key }) => ({ nmId: Number(key), priceKopecks: op.price?.baseMinor ?? op.after, discountedPriceKopecks: op.after })) },
        retryDelaysMs: [...WRITE_RETRY_DELAYS_MS],
        timeoutMs: WRITE_TIMEOUT_MS,
        maxRetryAfterMs: WRITE_MAX_RETRY_AFTER_MS,
      })
    } catch (e) {
      for (const { op } of batch) results.push(failed(op, `сайт: цена не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
      continue
    }
    const unknown = new Set((r.unknown ?? []).map(String))
    for (const { op, key } of batch) results.push(unknown.has(key) ? failed(op, `сайт не знает nmId ${key}`) : succeeded(op))
  }
  return results
}
```
`index.ts` — `export { fetchSitePrices, writeSitePrices, type SitePriceSource } from "./site/prices"`.

- [ ] **Step 3: Проверки и коммит.**
```bash
npx vitest run packages/platforms/src/site && npm run typecheck
git add packages/platforms/src/site/prices.ts packages/platforms/src/site/prices.test.ts packages/platforms/src/index.ts
git commit -m "sync2: сайт — клиент служебного API цен (GET/PUT /api/internal/prices, ключ nmId)"
```

---

### Task 16: Воркер — конфиг цен, источники и отправители цен

**Files:**
- Create: `config/pricing.json`, `apps/worker/src/pricing-config.ts`, `pricing-config.test.ts`, `apps/worker/src/price-senders.ts`, `price-senders.test.ts`
- Modify: `apps/worker/src/jobs/prices.ts` (создаётся в Task 17 — здесь только тип `PriceSources`, см. Step 3)

- [ ] **Step 1: Конфиг** — `config/pricing.json` (ставки 5 предметов — из `data/mappings/pricing.json` 19.07; «Шармы-подвески», «Часы наручные» — `take_wb` из `data/commissions/wb_commissions.json`: kgvpMarketplace 42 и 48 + 2 % эквайринг, Ozon/ЯМ — нет, открытый вопрос 3; доставка KIT/сайта — `null` до ответа владельца, открытый вопрос 2):
```json
{
  "_meta": {
    "source": "data/mappings/pricing.json (модель v2, 19.07.2026) + data/commissions/wb_commissions.json (kgvpMarketplace + 2 % эквайринг) — этап 2 синка v2",
    "updated": "2026-09-28",
    "units": "доли 0..1, рубли; в коде — bp и копейки"
  },
  "policy": {
    "headroom": 0.15,
    "round_base_to_rub": 100,
    "min_discount": 0.05,
    "wb_min_discount_pct": 3,
    "wb_max_discount_pct": 95,
    "ozon_min_discount_rub": 500
  },
  "ozon_acquiring_fallback": 0.01,
  "delivery_rub": { "kit": null, "site": null },
  "by_subject": {
    "Браслеты": { "take_wb": 0.44, "take_ozon": 0.55, "take_ym": 0.528 },
    "Природные материалы для творчества": { "take_wb": 0.45, "take_ozon": 0.52, "take_ym": 0.533 },
    "Подвески бижутерные": { "take_wb": 0.44, "take_ozon": 0.55, "take_ym": 0.551 },
    "Обереги": { "take_wb": 0.35, "take_ozon": 0.52, "take_ym": 0.496 },
    "Кольца": { "take_wb": 0.44, "take_ozon": 0.55, "take_ym": 0.526 },
    "Шармы-подвески": { "take_wb": 0.44, "take_ozon": null, "take_ym": null },
    "Часы наручные": { "take_wb": 0.5, "take_ozon": null, "take_ym": null }
  }
}
```

- [ ] **Step 2: Падающие тесты.** `apps/worker/src/pricing-config.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { loadPricingConfig, parsePricingConfig } from "./pricing-config"

describe("config/pricing.json", () => {
  it("настоящий файл: доли → bp, рубли → копейки, доставка не задана", () => {
    const c = loadPricingConfig()
    expect(c.policy).toEqual({ headroomBp: 1500, roundBaseToMinor: 10_000, minDiscountBp: 500, wbMinDiscountPct: 3, wbMaxDiscountPct: 95, ozonMinDiscountMinor: 50_000 })
    expect(c.rates.get("Браслеты")).toEqual({ takeWbBp: 4400, takeOzonBp: 5500, takeYmBp: 5280 })
    expect(c.rates.get("Часы наручные")).toEqual({ takeWbBp: 5000, takeOzonBp: null, takeYmBp: null })
    expect(c.ozonAcquiringFallbackBp).toBe(100)
    expect(c.deliveryMinor).toEqual({ kit: null, site: null })
  })

  it("доставка в рублях → копейки; ставка 100 % и выше или не число — ошибка с именем поля", () => {
    const raw = JSON.parse(JSON.stringify({ ...loadRaw(), delivery_rub: { kit: 450, site: 390.5 } }))
    expect(parsePricingConfig(raw).deliveryMinor).toEqual({ kit: 45_000, site: 39_050 })
    expect(() => parsePricingConfig({ ...loadRaw(), by_subject: { X: { take_wb: 1.2 } } })).toThrow(/X\.take_wb/)
    expect(() => parsePricingConfig({ ...loadRaw(), policy: { ...loadRaw().policy, headroom: "15%" } })).toThrow(/policy\.headroom/)
  })
})

function loadRaw(): { policy: Record<string, unknown> } & Record<string, unknown> {
  return JSON.parse(JSON.stringify({ policy: { headroom: 0.15, round_base_to_rub: 100, min_discount: 0.05, wb_min_discount_pct: 3, wb_max_discount_pct: 95, ozon_min_discount_rub: 500 }, ozon_acquiring_fallback: 0.01, delivery_rub: { kit: null, site: null }, by_subject: {} }))
}
```
`apps/worker/src/price-senders.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "@sync2/platforms"
import type { ChannelsConfig } from "./channels-config"
import { buildPriceSender, buildPriceSources } from "./price-senders"
import { loadPricingConfig } from "./pricing-config"

const cfg: ChannelsConfig = {
  wb: { token: "w", warehouseId: 1408913 },
  ozon: { clientId: "c", apiKey: "k", warehouseId: 1 },
  ym: { apiKey: "y", businessId: "187548892", campaignId: "149197829", warehouseIds: [2369574] },
  kit: { token: "t", warehouseId: "wh" },
  site: null,
  siteError: null,
}
const op = (channel: WriteOp["channel"]): WriteOp => ({ channel, barcode: "A", field: "price", before: 1, after: 100000, externalSku: channel === "wb" ? "1" : "K", price: { baseMinor: 150000, minMinor: 95000, discountPct: 33 } })
afterEach(() => vi.unstubAllGlobals())

describe("отправитель цен", () => {
  it("каждая площадка — в свой метод цен", async () => {
    const f = vi.fn(async (_u: string) => new Response(JSON.stringify({ data: { id: 1 }, result: [{ offer_id: "K", updated: true }], status: "OK" }), { status: 200 }))
    vi.stubGlobal("fetch", f)
    const send = buildPriceSender(cfg)
    await send("wb", [op("wb")])
    await send("ozon", [op("ozon")])
    await send("ym", [op("ym")])
    expect(f.mock.calls.map(([u]) => new URL(String(u)).pathname)).toEqual([
      "/api/v2/upload/task",
      "/v1/product/import/prices",
      "/v2/businesses/187548892/offer-prices/updates",
    ])
  })

  it("сайт не подключён — ошибка на всю пачку, источника сайта нет", async () => {
    await expect(buildPriceSender(cfg)("site", [op("site")])).rejects.toThrow(/SITE_API_TOKEN/)
    expect(buildPriceSources(cfg, loadPricingConfig()).site).toBeNull()
  })
})
```
Run: `npx vitest run apps/worker/src/pricing-config.test.ts apps/worker/src/price-senders.test.ts` → FAIL.

- [ ] **Step 3: Реализация.** `apps/worker/src/pricing-config.ts`:
```ts
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { PricePolicy, SubjectRates } from "@sync2/domain"
import { errorText, fractionToBp } from "@sync2/shared"

/** Ставки и политика цен (этап 2): доли → bp, рубли → копейки на входе; дальше только целые. */
export interface PricingConfig {
  policy: PricePolicy
  ozonAcquiringFallbackBp: number
  deliveryMinor: { kit: number | null; site: number | null }
  /** Предмет WB (products.wb_subject) → удержания площадок. */
  rates: ReadonlyMap<string, SubjectRates>
}

export const DEFAULT_PRICING_CONFIG_PATH = fileURLToPath(new URL("../../../config/pricing.json", import.meta.url))

function num(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`pricing.json: ${name} — не число`)
  return v
}

function bp(v: unknown, name: string): number {
  const n = num(v, name)
  try {
    return fractionToBp(n)
  } catch (e) {
    throw new Error(`pricing.json: ${name} — ${errorText(e)}`)
  }
}

const bpOrNull = (v: unknown, name: string): number | null => (v === null || v === undefined ? null : bp(v, name))

function rubOrNull(v: unknown, name: string): number | null {
  if (v === null || v === undefined) return null
  const n = num(v, name)
  if (n < 0) throw new Error(`pricing.json: ${name} — меньше нуля`)
  return Math.round(n * 100)
}

export function parsePricingConfig(raw: unknown): PricingConfig {
  const o = (raw ?? {}) as {
    policy?: Record<string, unknown>
    ozon_acquiring_fallback?: unknown
    delivery_rub?: Record<string, unknown>
    by_subject?: Record<string, Record<string, unknown>>
  }
  const p = o.policy ?? {}
  const policy: PricePolicy = {
    headroomBp: bp(p.headroom, "policy.headroom"),
    roundBaseToMinor: Math.round(num(p.round_base_to_rub, "policy.round_base_to_rub") * 100),
    minDiscountBp: bp(p.min_discount, "policy.min_discount"),
    wbMinDiscountPct: num(p.wb_min_discount_pct, "policy.wb_min_discount_pct"),
    wbMaxDiscountPct: num(p.wb_max_discount_pct, "policy.wb_max_discount_pct"),
    ozonMinDiscountMinor: Math.round(num(p.ozon_min_discount_rub, "policy.ozon_min_discount_rub") * 100),
  }
  const rates = new Map<string, SubjectRates>()
  for (const [subject, r] of Object.entries(o.by_subject ?? {})) {
    rates.set(subject, {
      takeWbBp: bp(r.take_wb, `${subject}.take_wb`),
      takeOzonBp: bpOrNull(r.take_ozon, `${subject}.take_ozon`),
      takeYmBp: bpOrNull(r.take_ym, `${subject}.take_ym`),
    })
  }
  return {
    policy,
    ozonAcquiringFallbackBp: bp(o.ozon_acquiring_fallback, "ozon_acquiring_fallback"),
    deliveryMinor: { kit: rubOrNull(o.delivery_rub?.kit, "delivery_rub.kit"), site: rubOrNull(o.delivery_rub?.site, "delivery_rub.site") },
    rates,
  }
}

export function loadPricingConfig(path: string = DEFAULT_PRICING_CONFIG_PATH): PricingConfig {
  return parsePricingConfig(JSON.parse(readFileSync(path, "utf8")))
}
```
`apps/worker/src/price-senders.ts`:
```ts
import {
  fetchKitPrices,
  fetchOzonPrices,
  fetchSitePrices,
  fetchWbPrices,
  fetchYmPrices,
  writeKitPrices,
  writeOzonPrices,
  writeSitePrices,
  writeWbPrices,
  writeYmPrices,
  type Sender,
} from "@sync2/platforms"
import type { ChannelsConfig } from "./channels-config"
import type { PriceSources } from "./jobs/prices"
import type { PricingConfig } from "./pricing-config"

/** Отправитель цен для executeWrites (этап 2): площадка → её писатель цены. Сайт без токена — ошибка на пачку. */
export function buildPriceSender(cfg: ChannelsConfig): Sender {
  return async (channel, ops) => {
    switch (channel) {
      case "wb":
        return writeWbPrices({ token: cfg.wb.token }, ops)
      case "ozon":
        return writeOzonPrices(cfg.ozon, ops)
      case "ym":
        return writeYmPrices(cfg.ym, ops)
      case "kit":
        return writeKitPrices(cfg.kit, ops)
      case "site": {
        if (!cfg.site) throw new Error(`SITE_API_TOKEN не задан${cfg.siteError ? ` (${cfg.siteError})` : ""} — запись цен сайта невозможна`)
        return writeSitePrices(cfg.site, ops)
      }
    }
  }
}

/** Чтение текущих цен площадок для джобы prices. */
export function buildPriceSources(cfg: ChannelsConfig, pricing: PricingConfig): PriceSources {
  const site = cfg.site
  return {
    wb: () => fetchWbPrices(cfg.wb.token),
    ozon: () => fetchOzonPrices(cfg.ozon, { acquiringFallbackBp: pricing.ozonAcquiringFallbackBp }),
    ym: () => fetchYmPrices(cfg.ym),
    kit: () => fetchKitPrices(cfg.kit),
    site: site ? () => fetchSitePrices(site) : null,
  }
}
```
Тип `PriceSources` объявлен в `apps/worker/src/jobs/prices.ts` (Task 17); чтобы Task 16 собиралась отдельно, создать этот файл сейчас с одним типом:
```ts
import type { MirrorPrice, WbPriceRow } from "@sync2/shared"

export interface PriceSources {
  wb: () => Promise<WbPriceRow[]>
  ozon: () => Promise<MirrorPrice[]>
  ym: () => Promise<MirrorPrice[]>
  kit: () => Promise<MirrorPrice[]>
  /** null — сайт не подключён. source ≠ pool — запись цен сайта блокируется. */
  site: (() => Promise<{ source: "wb" | "pool"; prices: MirrorPrice[] }>) | null
}
```

- [ ] **Step 4: Проверки и коммит.**
```bash
npx vitest run apps/worker/src/pricing-config.test.ts apps/worker/src/price-senders.test.ts && npm run typecheck
git add config/pricing.json apps/worker/src/pricing-config.ts apps/worker/src/pricing-config.test.ts apps/worker/src/price-senders.ts apps/worker/src/price-senders.test.ts apps/worker/src/jobs/prices.ts
git commit -m "sync2: конфиг цен (ставки по предметам, политика базы, доставка), источники и отправители цен"
```

---

### Task 17: Джоба `prices` — решения, сторож или возврат WB, зеркала

**Files:**
- Modify: `apps/worker/src/jobs/prices.ts` (целиком)
- Create: `apps/worker/src/jobs/prices.db.test.ts`

- [ ] **Step 1: Падающий тест** — `apps/worker/src/jobs/prices.db.test.ts`:
```ts
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  activeDecisions,
  agreedPriceHistory,
  answerDecision,
  channels,
  decisionById,
  insertStockSnapshot,
  loadAgreedPrices,
  loadChannels,
  savePoolRun,
  saveSpp,
  seedChannels,
  setAgreedPrice,
  upsertProducts,
  writes,
} from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { SendResult, WriteOp } from "@sync2/platforms"
import type { Channel, MirrorPrice, WbPriceRow, WriteMode } from "@sync2/shared"
import { loadPricingConfig } from "../pricing-config"
import { runPrices, type PriceSources, type PricesDeps } from "./prices"

const NM = 259678801
const CONFIG = { ...loadPricingConfig(), deliveryMinor: { kit: 40_000, site: 40_000 } }
const at = (min: number) => new Date(Date.parse("2026-10-01T09:03:00.000Z") + min * 60_000)
const okSend = () => vi.fn(async (_c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true })))
const wbRow = (discountedMinor: number, priceRub = 15800, discountPct = 45): WbPriceRow => ({ nmId: NM, vendorCode: "JW-A", priceRub, discountPct, discountedMinor, sizesDiffer: false })
const mp = (channel: Channel, externalSku: string, priceMinor: number, baseMinor: number | null = null, extra: Partial<MirrorPrice> = {}): MirrorPrice => ({
  channel,
  externalSku,
  priceMinor,
  baseMinor,
  minMinor: null,
  takeBp: null,
  vat: null,
  ...extra,
})

function fakeSources(o: { wb?: WbPriceRow[]; ozon?: MirrorPrice[]; ym?: MirrorPrice[]; kit?: MirrorPrice[]; site?: { source: "wb" | "pool"; prices: MirrorPrice[] } } = {}) {
  return {
    wb: vi.fn(async () => o.wb ?? []),
    ozon: vi.fn(async () => o.ozon ?? []),
    ym: vi.fn(async () => o.ym ?? []),
    kit: vi.fn(async () => o.kit ?? []),
    site: vi.fn(async () => o.site ?? { source: "pool" as const, prices: [] }),
  }
}

/** Своя база на describe: браслет NM (Браслеты), прайс 9 164 ₽, в наличии 2, ключи на Ozon/ЯМ/KIT. */
function harness() {
  const ctx = {} as { h: Awaited<ReturnType<typeof freshTestDb>>; ids: Awaited<ReturnType<typeof loadChannels>> }
  let n = 0
  const nextRun = async () => {
    const id = `00000000-0000-4000-8000-${String(3000 + ++n).padStart(12, "0")}`
    await insertRun(ctx.h.db, id)
    return id
  }
  const setup = async () => {
    ctx.h = await freshTestDb()
    await seedChannels(ctx.h.db)
    ctx.ids = await loadChannels(ctx.h.db)
    await upsertProducts(ctx.h.db, [{ barcode: "A", vendorCode: "JW-A", nmId: NM, title: "Браслет", subject: "Браслеты" }])
    await setAgreedPrice(ctx.h.db, { nmId: NM, barcode: "A", priceMinor: 916400, source: "import", approvedBy: "тест", reason: null })
    const r0 = await nextRun()
    await savePoolRun(ctx.h.db, { runId: r0, items: [{ barcode: "A", base: 2, wbExpected: 2, expectedAt: null, wbSnapshotAt: null }], events: [] })
    for (const [c, key] of [["ozon", "JW-A"], ["ym", "JW-A"], ["kit", "var-A"]] as const) {
      await insertStockSnapshot(ctx.h.db, { channelId: ctx.ids.get(c)!.id, runId: r0, takenAt: "2026-10-01T09:00:00.000Z", stocks: [{ barcode: "A", externalSku: key, quantity: 2, warehouse: null }] })
    }
  }
  const priceMode = (c: Channel, m: WriteMode) => ctx.h.db.update(channels).set({ priceWriteMode: m }).where(eq(channels.code, c))
  const prices = async (minute: number, sources: PriceSources, send = okSend(), extra: Partial<PricesDeps> = {}) => {
    const pid = await nextRun()
    const r = await runPrices({ db: ctx.h.db, now: () => at(minute), runId: pid, globalMode: "apply", config: CONFIG, sources, send, ...extra })
    return { pid, r }
  }
  const journal = async (pid: string, c: Channel) =>
    (await ctx.h.db.select().from(writes).where(and(eq(writes.runId, pid), eq(writes.channelId, ctx.ids.get(c)!.id)))).map((w) => ({
      after: w.after,
      mode: w.mode,
      applied: w.applied,
      detail: w.detail,
    }))
  return { ctx, nextRun, setup, priceMode, prices, journal }
}

describe.skipIf(!TEST_DATABASE_URL)("runPrices — сторож WB и решения", () => {
  const { ctx, setup, priceMode, prices } = harness()
  beforeAll(setup)
  afterAll(async () => ctx.h?.close())

  it("цена WB ушла от прайса — вопрос с тем, что видел партнёр; через 5 мин окно лимита занято — WB не читается", async () => {
    const src = fakeSources({ wb: [wbRow(869000)] })
    const { r } = await prices(0, src)
    expect(r.status).toBe("ok")
    expect(r.counters).toMatchObject({ wbWatched: 1, wbDrift: 1, decisionsOpened: 1 })
    const [d] = await activeDecisions(ctx.h.db)
    expect(d).toMatchObject({ kind: "wb_price_drift", subject: String(NM), status: "open", payload: { agreedMinor: 916400, observedMinor: 869000, title: "Браслет" } })
    const again = await prices(5, src)
    expect(src.wb).toHaveBeenCalledTimes(1)
    expect(again.r.counters.wbSlotBusy).toBe(1)
  })

  it("«принять» — прайс = цена из вопроса, в истории номер решения; сторож после этого молчит", async () => {
    const [d] = await activeDecisions(ctx.h.db)
    await answerDecision(ctx.h.db, d!.id, "accept", { id: 5710949139, name: "Минас" }, at(10).toISOString())
    const { r } = await prices(16, fakeSources({ wb: [wbRow(869000)] }))
    expect(r.counters).toMatchObject({ decisionsAccepted: 1, wbDrift: 0, decisionsOpened: 0 })
    expect((await loadAgreedPrices(ctx.h.db)).get(NM)).toMatchObject({ priceMinor: 869000, source: "button", approvedBy: "Минас" })
    expect((await agreedPriceHistory(ctx.h.db, NM))[0]).toMatchObject({ priceMinor: 869000, prevPriceMinor: 916400, decisionId: d!.id })
    expect(await decisionById(ctx.h.db, d!.id)).toMatchObject({ status: "done" })
  })

  it("«вернуть» при apply цен WB — запись по последнему снимку вместо чтения; при dry-run — вопрос не исполнен", async () => {
    await prices(32, fakeSources({ wb: [wbRow(821600, 15800, 48)] }))
    const d = (await activeDecisions(ctx.h.db)).find((x) => x.status === "open")!
    await answerDecision(ctx.h.db, d.id, "return", { id: 5710949139, name: "Минас" }, at(40).toISOString())
    await priceMode("wb", "apply")
    const send = okSend()
    const src = fakeSources()
    const { r } = await prices(48, src, send)
    expect(src.wb).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith("wb", [
      { channel: "wb", barcode: "A", field: "price", before: 821600, after: 869000, externalSku: String(NM), price: { baseMinor: 1580000, minMinor: null, discountPct: 45 } },
    ])
    expect(r.counters.wbReturned).toBe(1)
    expect(await decisionById(ctx.h.db, d.id)).toMatchObject({ status: "done" })

    await priceMode("wb", "dry-run")
    await prices(64, fakeSources({ wb: [wbRow(821600, 15800, 48)] }))
    const d2 = (await activeDecisions(ctx.h.db)).find((x) => x.status === "open")!
    await answerDecision(ctx.h.db, d2.id, "return", { id: 5710949139, name: "Минас" }, at(70).toISOString())
    const second = await prices(80, fakeSources())
    expect(second.r.counters.wbReturnDisabled).toBe(1)
    expect(await decisionById(ctx.h.db, d2.id)).toMatchObject({ status: "failed" })
  })
})

describe.skipIf(!TEST_DATABASE_URL)("runPrices — зеркала", () => {
  const { ctx, nextRun, setup, priceMode, prices, journal } = harness()
  const mirrors = (ozonPrice: number) =>
    fakeSources({
      ozon: [mp("ozon", "JW-A", ozonPrice, 1580000, { minMinor: 1140500, takeBp: 5500, vat: "0" })],
      ym: [mp("ym", "JW-A", 1219000, 1580000)],
      kit: [mp("kit", "var-A", 916400)],
      site: { source: "pool", prices: [mp("site", String(NM), 916400, 1580000)] },
    })
  beforeAll(async () => {
    await setup()
    await saveSpp(ctx.h.db, { windowFrom: "2026-09-01", windowTo: "2026-10-01", sales: 40, medianBp: 2500, activeBp: 2500, changed: true, reason: "first", truncated: false, runId: await nextRun() })
    await priceMode("ozon", "apply")
    for (const c of ["ym", "kit", "site"] as const) await priceMode(c, "dry-run")
  })
  afterAll(async () => ctx.h?.close())

  it("цели от прайса и k; в сеть — только Ozon (apply); KIT и сайт — dry-run с деталями; ЯМ в пределах 2 % — без записи", async () => {
    const send = okSend()
    const { pid, r } = await prices(0, mirrors(1100000), send)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith("ozon", [
      { channel: "ozon", barcode: "A", field: "price", before: 1100000, after: 1149000, externalSku: "JW-A", price: { baseMinor: 1580000, minMinor: 1140500, vat: "0" } },
    ])
    expect(await journal(pid, "ozon")).toEqual([{ after: 1149000, mode: "apply", applied: true, detail: { baseMinor: 1580000, minMinor: 1140500, vat: "0" } }])
    expect(await journal(pid, "kit")).toEqual([{ after: 689000, mode: "dry-run", applied: false, detail: { baseMinor: 1580000, minMinor: null } }])
    expect(await journal(pid, "site")).toEqual([{ after: 689000, mode: "dry-run", applied: false, detail: { baseMinor: 1580000, minMinor: null } }])
    expect(await journal(pid, "ym")).toEqual([])
    expect(r.counters).toMatchObject({ ozonPriceApplied: 1, kitPricePlanned: 1, sitePricePlanned: 1, ymPricesRead: 1 })
    expect(r.status).toBe("ok")
  })

  it("через 30 мин Ozon показывает прежнюю цену — «цена не держится», запись повторяется", async () => {
    const { r } = await prices(30, mirrors(1100000))
    expect(r.status).toBe("partial")
    expect(r.counters.ozonPriceNotHeld).toBe(1)
    expect(r.counters.ozonPriceApplied).toBe(1)
  })

  it("изменений больше предела — не пишется ничего", async () => {
    const send = okSend()
    const { r } = await prices(60, mirrors(1000000), send, { maxChanges: 1 })
    expect(send).not.toHaveBeenCalled()
    expect(r.counters.pricesAborted).toBe(3)
    expect(r.status).toBe("partial")
  })

  it("витрина сайта не на пуле при apply цен сайта — сайт не пишется", async () => {
    await priceMode("site", "apply")
    const src = fakeSources({ site: { source: "wb", prices: [mp("site", String(NM), 916400, 1580000)] } })
    const send = okSend()
    const { r } = await prices(90, src, send)
    expect(r.counters.sitePriceBlocked).toBe(1)
    expect(send).not.toHaveBeenCalledWith("site", expect.anything())
    await priceMode("site", "dry-run")
  })
})

describe.skipIf(!TEST_DATABASE_URL)("runPrices — без коэффициента СПП и только выбранные карточки", () => {
  const { ctx, setup, priceMode, prices } = harness()
  beforeAll(async () => {
    await setup()
    for (const c of ["ozon", "ym", "kit", "site"] as const) await priceMode(c, "dry-run")
  })
  afterAll(async () => ctx.h?.close())

  it("k не посчитан — KIT и сайт не считаются, Ozon и ЯМ считаются", async () => {
    const { r } = await prices(0, fakeSources({ ozon: [mp("ozon", "JW-A", 1000000, 1580000)], ym: [mp("ym", "JW-A", 1000000, 1580000)], kit: [mp("kit", "var-A", 916400)] }))
    expect(r.counters["skip_no-spp"]).toBe(1)
    expect(r.counters).toMatchObject({ ozonPricePlanned: 1, ymPricePlanned: 1 })
    expect(r.counters.kitPricePlanned).toBeUndefined()
  })

  it("--only: карточки не из списка не считаются", async () => {
    const { r } = await prices(30, fakeSources({ ozon: [mp("ozon", "JW-A", 1000000, 1580000)] }), okSend(), { onlyNmIds: new Set([1]) })
    expect(r.counters.ozonPricePlanned).toBeUndefined()
  })
})
```
Run: `npm run test:db -- apps/worker/src/jobs/prices.db.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `apps/worker/src/jobs/prices.ts` целиком:
```ts
import {
  MAX_PRICE_CHANGES_PER_RUN,
  PRICE_MIN_CHANGE_BP,
  fitWbBase,
  mirrorPrices,
  planPriceWrites,
  priceKey,
  watchWbPrices,
  wbReturnTarget,
  type CurrentPrice,
  type PriceChange,
  type PriceTarget,
} from "@sync2/domain"
import {
  WB_PRICES_INTERVAL_MS,
  WB_PRICES_SLOT,
  activeDecisions,
  activeSpp,
  drizzleWriteStore,
  finishDecision,
  inStockNmIds,
  insertWbPriceSnapshot,
  lastAutoactionPrices,
  latestStockSnapshots,
  latestWbPriceSnapshot,
  loadAgreedPrices,
  loadChannels,
  loadProducts,
  openDecisions,
  priceWritesAppliedBetween,
  pushSlot,
  setAgreedPrice,
  takeSlot,
  type Db,
  type DecisionRow,
} from "@sync2/db"
import { RateLimitError, WriteJournalError, effectiveMode, executeWrites, type Sender, type WriteOp, type WriteOutcome } from "@sync2/platforms"
import { CHANNEL_LABELS, driftBp, errorText, formatRub, type Channel, type MirrorPrice, type WbPriceRow, type WriteMode } from "@sync2/shared"
import type { PricingConfig } from "../pricing-config"

/** Зеркала, чью цену считает и пишет синк (решение 25.09, п. 9–10). WB пишется только кнопкой «вернуть». */
export const MIRROR_PRICE_CHANNELS = ["ozon", "ym", "kit", "site"] as const
export type MirrorPriceChannel = (typeof MIRROR_PRICE_CHANNELS)[number]
/** Сторож не читал цены WB дольше — предупреждение (окно 15 мин, крон раз в 30 мин: норма ≤ 30). */
export const WB_WATCH_STALE_MIN = 180
/** Проверка «цена держится»: записи не моложе 3 мин (спека §6) и не старше 75 мин (последний прогон-два). */
export const VERIFY_MIN_AGE_MS = 3 * 60_000
export const VERIFY_MAX_AGE_MS = 75 * 60_000
const MAX_SHOWN = 5
const LABEL = CHANNEL_LABELS

export interface PriceSources {
  wb: () => Promise<WbPriceRow[]>
  ozon: () => Promise<MirrorPrice[]>
  ym: () => Promise<MirrorPrice[]>
  kit: () => Promise<MirrorPrice[]>
  /** null — сайт не подключён. source ≠ pool — запись цен сайта блокируется. */
  site: (() => Promise<{ source: "wb" | "pool"; prices: MirrorPrice[] }>) | null
}

export interface PricesDeps {
  db: Db
  now: () => Date
  runId: string
  globalMode: WriteMode
  config: PricingConfig
  sources: PriceSources
  send: Sender
  /** Только эти nmId (`prices --only=`, первый боевой прогон на одном товаре). */
  onlyNmIds?: ReadonlySet<number>
  /** Предел изменений за прогон по всем зеркалам; по умолчанию MAX_PRICE_CHANGES_PER_RUN (тесты — меньше). */
  maxChanges?: number
}

export interface PricesJobResult {
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}

const shown = (items: string[]) => items.slice(0, MAX_SHOWN).join("; ") + (items.length > MAX_SHOWN ? `; … ещё ${items.length - MAX_SHOWN}` : "")

function toOp(c: MirrorPriceChannel, ch: PriceChange, rows: ReadonlyMap<string, MirrorPrice>): WriteOp {
  const vat = c === "ozon" ? rows.get(priceKey(c, ch.externalSku))?.vat : null
  return {
    channel: c,
    barcode: ch.barcode,
    field: "price",
    before: ch.before.priceMinor,
    after: ch.priceMinor,
    externalSku: ch.externalSku,
    price: { baseMinor: ch.baseMinor, minMinor: ch.minMinor, ...(vat ? { vat } : {}) },
  }
}

/**
 * Прогон цен (этап 2 синка v2):
 * 1. ответы партнёров «принять» / «автоакция» — исполняются (прайс с историей);
 * 2. WB — одно окно лимита «Цены и скидки» на прогон: запись «вернуть к прайсу» (если ответ есть и цены WB
 *    в apply) либо чтение сторожа → вопросы;
 * 3. зеркала — цели от прайса, k СПП и ставок; проверка прошлых записей; анти-флаппинг 2 %, кап 60 %;
 *    больше maxChanges изменений — не пишется ничего; запись через executeWrites с режимами цен.
 * Площадка с режимом цен off не читается и не планируется.
 */
export async function runPrices(deps: PricesDeps): Promise<PricesJobResult> {
  const { db, runId, config } = deps
  const now = deps.now()
  const nowIso = now.toISOString()
  const counters: Record<string, number> = {}
  const problems: string[] = []
  const add = (key: string, n = 1) => {
    counters[key] = (counters[key] ?? 0) + n
  }

  const channels = await loadChannels(db)
  const missing = (["wb", ...MIRROR_PRICE_CHANNELS] as Channel[]).filter((c) => !channels.has(c))
  if (missing.length > 0) throw new Error(`площадки не заведены — выполните seed-channels (нет: ${missing.join(", ")})`)
  const wbId = channels.get("wb")!.id
  const priceModes = Object.fromEntries([...channels].map(([c, row]) => [c, row.priceWriteMode])) as Record<Channel, WriteMode>
  const effective = (c: Channel) => effectiveMode(deps.globalMode, priceModes[c])
  const record = drizzleWriteStore(db, runId, channels, nowIso)
  const write = async (c: Channel, ops: WriteOp[]): Promise<WriteOutcome[]> => {
    if (ops.length === 0) return []
    try {
      return await executeWrites(ops, { globalMode: deps.globalMode, channelModes: priceModes, send: deps.send, record })
    } catch (e: unknown) {
      if (!(e instanceof WriteJournalError)) throw e
      add("journalErrors")
      problems.push(`журнал записей цен ${LABEL[c]} не сохранён: ${errorText(e.cause)}`)
      return e.outcomes
    }
  }

  const products = await loadProducts(db)
  const byBarcode = new Map(products.map((p) => [p.barcode, p]))
  const barcodesOfNm = new Map<number, string[]>()
  for (const p of products) if (p.nmId !== null) barcodesOfNm.set(p.nmId, [...(barcodesOfNm.get(p.nmId) ?? []), p.barcode])

  // ── 1. Ответы «принять» и «автоакция» ──
  const active = await activeDecisions(db)
  const agreedBefore = await loadAgreedPrices(db)
  for (const d of active) {
    if (d.status !== "answered" || d.answer === "return") continue
    if (d.answer === "autoaction") {
      await finishDecision(db, d.id, "done", "автоакция: прайс не меняется; вопрос не повторится, пока цена WB в пределах 1 %", nowIso)
      add("decisionsAutoaction")
      continue
    }
    const nmId = d.payload.nmId
    const barcode = agreedBefore.get(nmId)?.barcode ?? barcodesOfNm.get(nmId)?.[0]
    if (!barcode) {
      await finishDecision(db, d.id, "failed", "карточки нет в справочнике — прайс не записан", nowIso)
      problems.push(`решение #${d.id}: карточки nm ${nmId} нет в справочнике`)
      continue
    }
    await setAgreedPrice(db, { nmId, barcode, priceMinor: d.payload.observedMinor, source: "button", approvedBy: d.answeredByName ?? "?", reason: `решение #${d.id}`, decisionId: d.id })
    await finishDecision(db, d.id, "done", `прайс ${formatRub(d.payload.observedMinor)}`, nowIso)
    add("decisionsAccepted")
  }
  const agreed = await loadAgreedPrices(db)

  // ── 2. WB: одно окно лимита — «вернуть» или сторож ──
  const returns = active.filter((d) => d.status === "answered" && d.answer === "return")
  if (returns.length > 0 && effective("wb") !== "apply") {
    for (const d of returns) await finishDecision(db, d.id, "failed", "запись цен WB выключена (price-mode wb) — вернуть нельзя, решите заново", nowIso)
    add("wbReturnDisabled", returns.length)
  }
  const pendingReturns = effective("wb") === "apply" ? returns : []
  const lastWb = await latestWbPriceSnapshot(db, wbId)
  if (!(await takeSlot(db, WB_PRICES_SLOT, nowIso, WB_PRICES_INTERVAL_MS))) {
    add("wbSlotBusy")
  } else if (pendingReturns.length > 0 && lastWb) {
    const current = new Map(lastWb.prices.map((r) => [r.nmId, r]))
    const ops: WriteOp[] = []
    const decisionOf = new Map<string, DecisionRow>()
    for (const d of pendingReturns) {
      const a = agreed.get(d.payload.nmId)
      const cur = current.get(d.payload.nmId)
      const fallback = a && cur ? fitWbBase(a.priceMinor, cur.priceRub * 100, config.policy.wbMinDiscountPct, config.policy.wbMaxDiscountPct) : null
      const fit = a && cur ? wbReturnTarget(cur, a.priceMinor, fallback, config.policy) : null
      if (!a || !cur || !fit) {
        await finishDecision(db, d.id, "failed", !a ? "прайса нет" : !cur ? "карточки нет в последнем снимке цен WB" : "не подобрать цену и скидку WB под прайс", nowIso)
        add("wbReturnFailed")
        continue
      }
      ops.push({
        channel: "wb",
        barcode: a.barcode,
        field: "price",
        before: cur.discountedMinor,
        after: fit.priceRub * (100 - fit.discountPct),
        externalSku: String(a.nmId),
        price: { baseMinor: fit.priceRub * 100, minMinor: null, discountPct: fit.discountPct },
      })
      decisionOf.set(a.barcode, d)
    }
    for (const o of await write("wb", ops)) {
      const d = decisionOf.get(o.barcode)!
      if (o.applied) {
        await finishDecision(db, d.id, "done", `WB: загружено ${formatRub(o.after)} (цена ${(o.price?.baseMinor ?? 0) / 100} ₽, скидка ${o.price?.discountPct ?? "?"} %) — проверит следующее чтение`, nowIso)
        add("wbReturned")
      } else {
        await finishDecision(db, d.id, "failed", `WB: ${o.error ?? `режим ${o.mode}`}`, nowIso)
        add("wbReturnFailed")
        problems.push(`WB: возврат к прайсу не прошёл — ${o.barcode}: ${o.error ?? o.mode}`)
      }
    }
  } else {
    try {
      const rows = await deps.sources.wb()
      await insertWbPriceSnapshot(db, { channelId: wbId, runId, takenAt: nowIso, prices: rows })
      const w = watchWbPrices({
        rows,
        agreed: new Map([...agreed].map(([nmId, a]) => [nmId, { nmId, priceMinor: a.priceMinor }])),
        inStock: await inStockNmIds(db),
        open: active.filter((d) => d.status === "open").map((d) => ({ id: d.id, kind: d.kind, nmId: d.payload.nmId })),
        muted: await lastAutoactionPrices(db),
      })
      const titleOf = (nmId: number) => products.find((p) => p.nmId === nmId)?.title ?? null
      counters.decisionsOpened = await openDecisions(
        db,
        w.open.map((q) => ({
          kind: q.kind,
          subject: String(q.nmId),
          payload: { nmId: q.nmId, vendorCode: q.vendorCode, title: titleOf(q.nmId), agreedMinor: q.agreedMinor, observedMinor: q.observedMinor, priceRub: q.priceRub, discountPct: q.discountPct },
        })),
        runId,
      )
      for (const c of w.close) await finishDecision(db, c.id, "closed", c.reason, nowIso)
      if (w.close.length > 0) counters.decisionsClosed = w.close.length
      Object.assign(counters, { wbWatched: rows.length, wbDrift: w.counters.drift, wbMuted: w.counters.muted, wbNewWithoutPrice: w.counters.newWithoutPrice })
      if (w.counters.sizesDiffer > 0) counters.wbSizesDiffer = w.counters.sizesDiffer
    } catch (e: unknown) {
      add("wbWatchFailed")
      if (e instanceof RateLimitError) {
        add("wbRateLimited")
        if (e.resetSeconds !== null) await pushSlot(db, WB_PRICES_SLOT, new Date(now.getTime() + e.resetSeconds * 1000).toISOString())
      } else problems.push(`WB: цены не прочитаны — ${errorText(e)}`)
    }
  }
  const latestWb = await latestWbPriceSnapshot(db, wbId)
  if (latestWb) {
    const age = Math.round((now.getTime() - Date.parse(latestWb.takenAt)) / 60_000)
    counters.wbWatchAgeMin = age
    if (age > WB_WATCH_STALE_MIN) problems.push(`WB: сторож не читал цены ${age} мин (лимит «Цены и скидки» или сбой)`)
  }

  // ── 3. Зеркала ──
  const sppBp = await activeSpp(db)
  const snaps = await latestStockSnapshots(db)
  const keysOf = (c: "ozon" | "ym" | "kit") => {
    const m = new Map<string, string>()
    for (const s of snaps.get(channels.get(c)!.id)?.stocks ?? []) if (s.externalSku && !m.has(s.barcode)) m.set(s.barcode, s.externalSku)
    return m
  }
  const keys = { ozon: keysOf("ozon"), ym: keysOf("ym"), kit: keysOf("kit") }
  const current = new Map<string, CurrentPrice>()
  const rowsByKey = new Map<string, MirrorPrice>()
  const readOk = new Set<MirrorPriceChannel>()
  let siteSource: "wb" | "pool" | null = null
  for (const c of MIRROR_PRICE_CHANNELS) {
    if (effective(c) === "off") continue
    try {
      let rows: MirrorPrice[]
      if (c === "site") {
        if (!deps.sources.site) continue
        const r = await deps.sources.site()
        siteSource = r.source
        rows = r.prices
      } else rows = await deps.sources[c]()
      for (const r of rows) {
        current.set(priceKey(c, r.externalSku), { priceMinor: r.priceMinor, baseMinor: r.baseMinor, minMinor: r.minMinor })
        rowsByKey.set(priceKey(c, r.externalSku), r)
      }
      counters[`${c}PricesRead`] = rows.length
      readOk.add(c)
    } catch (e: unknown) {
      counters[`${c}PricesFailed`] = 1
      problems.push(`${LABEL[c]}: цены не прочитаны — ${errorText(e)}`)
    }
  }

  const targets: PriceTarget[] = []
  if (readOk.size > 0) {
    for (const [nmId, a] of agreed) {
      if (deps.onlyNmIds && !deps.onlyNmIds.has(nmId)) continue
      const barcodes = barcodesOfNm.get(nmId) ?? [a.barcode]
      const subject = byBarcode.get(a.barcode)?.wbSubject ?? barcodes.map((b) => byBarcode.get(b)?.wbSubject ?? null).find((s) => s !== null) ?? null
      const rates = subject ? (config.rates.get(subject) ?? null) : null
      const keyed = (c: "ozon" | "ym" | "kit") =>
        readOk.has(c)
          ? barcodes.flatMap((b) => {
              const key = keys[c].get(b)
              return key ? [{ barcode: b, key }] : []
            })
          : []
      const oz = keyed("ozon")
      const ym = keyed("ym")
      const kit = keyed("kit")
      const ozonTakeBp = oz.map((k) => rowsByKey.get(priceKey("ozon", k.key))?.takeBp ?? null).find((t) => t !== null) ?? null
      const m = mirrorPrices({ agreedMinor: a.priceMinor, rates, ozonTakeBp, hasOzon: oz.length > 0, hasYm: ym.length > 0, sppBp, deliveryMinor: config.deliveryMinor }, config.policy)
      for (const s of m.skips) add(`skip_${s}`)
      if (m.ozon) for (const k of oz) targets.push({ channel: "ozon", barcode: k.barcode, externalSku: k.key, priceMinor: m.ozon.priceMinor, baseMinor: m.ozon.oldMinor, minMinor: m.ozon.minMinor })
      if (m.ym) for (const k of ym) targets.push({ channel: "ym", barcode: k.barcode, externalSku: k.key, priceMinor: m.ym.priceMinor, baseMinor: m.ym.baseMinor, minMinor: null })
      if (m.kit) for (const k of kit) targets.push({ channel: "kit", barcode: k.barcode, externalSku: k.key, priceMinor: m.kit.priceMinor, baseMinor: m.kit.baseMinor, minMinor: null })
      if (m.site && readOk.has("site")) targets.push({ channel: "site", barcode: a.barcode, externalSku: String(nmId), priceMinor: m.site.priceMinor, baseMinor: m.site.baseMinor, minMinor: null })
    }
  }

  const recent = await priceWritesAppliedBetween(db, new Date(now.getTime() - VERIFY_MAX_AGE_MS).toISOString(), new Date(now.getTime() - VERIFY_MIN_AGE_MS).toISOString())
  const plans = new Map<MirrorPriceChannel, PriceChange[]>()
  for (const c of MIRROR_PRICE_CHANNELS) {
    if (!readOk.has(c)) continue
    const notHeld = recent.filter((w) => {
      if (w.channel !== c || w.externalSku === null) return false
      const cur = current.get(priceKey(c, w.externalSku))
      return cur !== undefined && driftBp(w.after, cur.priceMinor) > PRICE_MIN_CHANGE_BP
    })
    if (notHeld.length > 0) {
      counters[`${c}PriceNotHeld`] = notHeld.length
      problems.push(`${LABEL[c]}: цена не держится после записи — ${shown(notHeld.map((w) => w.barcode))}`)
    }
    if (c === "site" && effective("site") === "apply" && siteSource !== "pool") {
      counters.sitePriceBlocked = 1
      problems.push("сайт: витрина берёт цену не из синка (PRICE_SOURCE≠pool) — запись цен сайта не делалась")
      continue
    }
    const plan = planPriceWrites(targets.filter((t) => t.channel === c), current)
    if (plan.missing.length > 0) counters[`${c}PriceNoOffer`] = plan.missing.length
    if (plan.capped.length > 0) {
      counters[`${c}PriceCapped`] = plan.capped.length
      problems.push(`${LABEL[c]}: изменение цены больше 60 % — не записано: ${shown(plan.capped.map((x) => `${x.barcode} ${formatRub(x.before.priceMinor)} → ${formatRub(x.priceMinor)}`))}`)
    }
    plans.set(c, plan.changes)
  }

  const total = [...plans.values()].reduce((n, p) => n + p.length, 0)
  const maxChanges = deps.maxChanges ?? MAX_PRICE_CHANGES_PER_RUN
  if (total > maxChanges) {
    counters.pricesAborted = total
    problems.push(`цены: ${total} изменений за прогон при пределе ${maxChanges} — не записано ничего; см. price-plan и ставки`)
  } else {
    for (const [c, changes] of plans) {
      const outs = await write(c, changes.map((ch) => toOp(c, ch, rowsByKey)))
      if (outs.length > 0) counters[`${c}PricePlanned`] = outs.length
      const applied = outs.filter((o) => o.applied).length
      if (applied > 0) counters[`${c}PriceApplied`] = applied
      const failedOuts = outs.filter((o) => o.mode === "apply" && o.error !== null)
      if (failedOuts.length > 0) {
        counters[`${c}PriceFailed`] = failedOuts.length
        problems.push(`${LABEL[c]}: ошибки записи цен — ${shown(failedOuts.map((o) => `${o.barcode}: ${o.error}`))}`)
      }
    }
  }

  return problems.length > 0 ? { status: "partial", counters, error: problems.join("; ") } : { status: "ok", counters }
}
```

- [ ] **Step 3: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add apps/worker/src/jobs/prices.ts apps/worker/src/jobs/prices.db.test.ts
git commit -m "sync2: джоба prices — ответы партнёров, сторож или возврат WB в одном окне лимита, цены зеркал с анти-флаппингом, капом и пределом"
```

---

### Task 18: Джоба `spp` — коэффициент СПП раз в неделю

**Files:**
- Create: `apps/worker/src/jobs/spp.ts`, `apps/worker/src/jobs/spp.db.test.ts`

- [ ] **Step 1: Падающий тест** — `apps/worker/src/jobs/spp.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { activeSpp, sppHistory } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import { RateLimitError } from "@sync2/platforms"
import type { SppSaleRow } from "@sync2/shared"
import { moscowDate, runSpp, shiftDate } from "./spp"

const sales = (sppBp: number, n: number, opDate = "2026-09-25"): SppSaleRow[] => Array.from({ length: n }, () => ({ sppBp, quantity: 1, opDate }))

describe("даты окна", () => {
  it("московский день и сдвиг", () => {
    expect(moscowDate(new Date("2026-10-01T21:30:00.000Z"))).toBe("2026-10-02")
    expect(shiftDate("2026-10-01", -30)).toBe("2026-09-01")
  })
})

describe.skipIf(!TEST_DATABASE_URL)("runSpp", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let n = 0
  const run = async (at: string, fetchSales: Parameters<typeof runSpp>[0]["fetchSales"]) => {
    const runId = `00000000-0000-4000-8000-${String(4000 + ++n).padStart(12, "0")}`
    await insertRun(h.db, runId)
    return runSpp({ db: h.db, now: () => new Date(at), runId, fetchSales })
  }
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  it("первый расчёт — k сразу; окно — 30 дней до московского сегодня", async () => {
    const fetchSales = vi.fn(async () => ({ rows: sales(2500, 12), truncated: false }))
    const r = await run("2026-10-01T04:20:00.000Z", fetchSales)
    expect(fetchSales).toHaveBeenCalledWith("2026-09-01", "2026-10-01")
    expect(r).toEqual({ status: "ok", counters: { sales: 12, changed: 1, medianBp: 2500, activeBp: 2500 } })
    expect(await activeSpp(h.db)).toBe(2500)
  })

  it("второй раз в тот же день — без запроса к WB (суточный лимит финотчёта)", async () => {
    const fetchSales = vi.fn(async () => ({ rows: [], truncated: false }))
    expect(await run("2026-10-01T10:00:00.000Z", fetchSales)).toEqual({ status: "ok", counters: { alreadyComputed: 1 } })
    expect(fetchSales).not.toHaveBeenCalled()
  })

  it("через неделю медиана сдвинулась меньше чем на 3 п.п. — k прежний; история пишется", async () => {
    const r = await run("2026-10-08T04:20:00.000Z", async () => ({ rows: sales(2700, 12, "2026-10-05"), truncated: false }))
    expect(r.counters).toMatchObject({ medianBp: 2700, activeBp: 2500, changed: 0 })
    expect((await sppHistory(h.db, 5)).map((x) => [x.windowTo, x.reason])).toEqual([["2026-10-08", "below-threshold"], ["2026-10-01", "first"]])
  })

  it("лимит WB — partial без строки истории; полная страница — k не меняется", async () => {
    const limited = await run("2026-10-15T04:20:00.000Z", async () => {
      throw new RateLimitError("wb", 43200, "лимит")
    })
    expect(limited).toMatchObject({ status: "partial", counters: { fetchFailed: 1, rateLimited: 1 } })
    const truncated = await run("2026-10-16T04:20:00.000Z", async () => ({ rows: sales(4000, 50, "2026-10-10"), truncated: true }))
    expect(truncated.status).toBe("partial")
    expect(await activeSpp(h.db)).toBe(2500)
  })
})
```
Run: `npm run test:db -- apps/worker/src/jobs/spp.db.test.ts` → FAIL.

- [ ] **Step 2: Реализация** — `apps/worker/src/jobs/spp.ts`:
```ts
import { activeSpp, saveSpp, sppComputedFor, type Db } from "@sync2/db"
import { SPP_WINDOW_DAYS, nextSppCoefficient, sppMedian, type SppVerdict } from "@sync2/domain"
import { RateLimitError } from "@sync2/platforms"
import { errorText, type SppSaleRow } from "@sync2/shared"

export interface SppDeps {
  db: Db
  now: () => Date
  runId: string
  /** Выкупы с СПП за [from, to] — fetchWbSppSales (один запрос финотчёта). */
  fetchSales: (from: string, to: string) => Promise<{ rows: SppSaleRow[]; truncated: boolean }>
}

/** Московский день (UTC+3 без перехода на летнее время) — отчёты WB живут по Москве. */
export function moscowDate(at: Date): string {
  return new Date(at.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Коэффициент СПП (решение 25.09, п. 10): медиана по выкупам за 30 дней, порог 3 п.п., < 10 выкупов — без
 * изменений. Один расчёт на московский день: второй запрос съел бы суточный лимит финотчёта (общий с finstock).
 */
export async function runSpp(deps: SppDeps): Promise<{ status: "ok" | "partial"; counters: Record<string, number>; error?: string }> {
  const to = moscowDate(deps.now())
  const from = shiftDate(to, -SPP_WINDOW_DAYS)
  if (await sppComputedFor(deps.db, to)) return { status: "ok", counters: { alreadyComputed: 1 } }
  let sales: { rows: SppSaleRow[]; truncated: boolean }
  try {
    sales = await deps.fetchSales(from, to)
  } catch (e: unknown) {
    const limited = e instanceof RateLimitError
    return {
      status: "partial",
      counters: { fetchFailed: 1, ...(limited ? { rateLimited: 1 } : {}) },
      error: limited
        ? "финотчёт WB: лимит (2 запроса в сутки на аккаунт, общий с finstock) — k не менялся; повтор — `spp` завтра или следующий четверг"
        : `финотчёт WB не прочитан — ${errorText(e)}; k не менялся`,
    }
  }
  const candidate = sppMedian(sales.rows, from, to)
  const active = await activeSpp(deps.db)
  const verdict: Omit<SppVerdict, "reason"> & { reason: SppVerdict["reason"] | "truncated" } = sales.truncated
    ? { activeBp: active, changed: false, reason: "truncated" }
    : nextSppCoefficient(active, candidate)
  await saveSpp(deps.db, {
    windowFrom: from,
    windowTo: to,
    sales: candidate.sales,
    medianBp: candidate.medianBp,
    activeBp: verdict.activeBp,
    changed: verdict.changed,
    reason: verdict.reason,
    truncated: sales.truncated,
    runId: deps.runId,
  })
  const counters: Record<string, number> = { sales: candidate.sales, changed: verdict.changed ? 1 : 0 }
  if (candidate.medianBp !== null) counters.medianBp = candidate.medianBp
  if (verdict.activeBp !== null) counters.activeBp = verdict.activeBp
  if (sales.truncated) return { status: "partial", counters, error: "финотчёт WB: страница заполнена до предела — данные могли быть не все, k не менялся" }
  return { status: "ok", counters }
}
```
Порядок ключей счётчиков в первом тесте (`toEqual`) не важен.

- [ ] **Step 3: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add apps/worker/src/jobs/spp.ts apps/worker/src/jobs/spp.db.test.ts
git commit -m "sync2: джоба spp — медиана СПП за 30 дней раз в неделю, один запрос финотчёта в сутки, гистерезис"
```

---

### Task 19: Telegram — кнопки, отправка вопросов, напоминания, `/id` (джоба `bot`)

**Files:**
- Create: `apps/worker/src/telegram.ts`, `telegram.test.ts`, `apps/worker/src/decision-text.ts`, `decision-text.test.ts`, `apps/worker/src/jobs/bot.ts`, `jobs/bot.db.test.ts`

- [ ] **Step 1: Падающие тесты.** `apps/worker/src/telegram.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest"
import { createTelegramApi, parseApprovers } from "./telegram"

const ok = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200 })

describe("Telegram Bot API", () => {
  it("sendMessage — кнопки inline_keyboard и ответ на сообщение; вернуть message_id", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => ok({ message_id: 55 }))
    const tg = createTelegramApi("SECRET", f as unknown as typeof fetch)
    expect(await tg.sendMessage("-100", "текст", { keyboard: [[{ text: "Да", callback_data: "d:1:a" }]], replyTo: 7 })).toBe(55)
    expect(JSON.parse(String(f.mock.calls[0]![1]!.body))).toEqual({
      chat_id: "-100",
      text: "текст",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "Да", callback_data: "d:1:a" }]] },
      reply_parameters: { message_id: 7, allow_sending_without_reply: true },
    })
  })

  it("ошибка без токена в тексте; «message is not modified» при правке — не ошибка", async () => {
    const tg = createTelegramApi("SECRET", (async () => new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 })) as unknown as typeof fetch)
    const err = await tg.sendMessage("-100", "x").catch((e: unknown) => e as Error)
    expect(err.message).toBe("Telegram sendMessage: 400 Bad Request: chat not found")
    expect(err.message).not.toContain("SECRET")
    const same = createTelegramApi("SECRET", (async () => new Response(JSON.stringify({ ok: false, description: "Bad Request: message is not modified" }), { status: 400 })) as unknown as typeof fetch)
    await expect(same.editMessageText("-100", 1, "x")).resolves.toBeUndefined()
  })

  it("TELEGRAM_APPROVERS — ID через запятую; мусор — ошибка; пусто — никого", () => {
    expect(parseApprovers("5710949139, 123")).toEqual(new Set([5710949139, 123]))
    expect(parseApprovers(undefined)).toEqual(new Set())
    expect(() => parseApprovers("5710949139,@partner")).toThrow(/TELEGRAM_APPROVERS/)
  })
})
```
`apps/worker/src/decision-text.test.ts`:
```ts
import type { DecisionRow } from "@sync2/db"
import { describe, expect, it } from "vitest"
import { allowedAnswers, callbackData, decisionKeyboard, fullText, parseCallbackData } from "./decision-text"

const d = (over: Partial<DecisionRow> = {}): DecisionRow => ({
  id: 12,
  kind: "wb_price_drift",
  subject: "259678801",
  payload: { nmId: 259678801, vendorCode: "JW-NB-AGT-M-0002", title: "Браслет «Мудрость Будды»", agreedMinor: 916400, observedMinor: 869000, priceRub: 15800, discountPct: 45 },
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
  createdAt: "2026-10-01T09:03:00.000Z",
  ...over,
})

describe("тексты и кнопки вопросов", () => {
  it("расхождение: прайс → WB с процентом; кнопок три, «вернуть» — только при apply цен WB", () => {
    expect(fullText(d())).toContain("Прайс: 9 164,00 ₽ → на WB: 8 690,00 ₽ (−5,2 %)")
    expect(decisionKeyboard(d(), true).map((row) => row[0]!.callback_data)).toEqual(["d:12:a", "d:12:x", "d:12:r"])
    expect(decisionKeyboard(d(), false)).toHaveLength(2)
    expect(allowedAnswers("wb_price_new", true)).toEqual(["accept"])
  })

  it("данные кнопки — туда и обратно; мусор — null", () => {
    expect(parseCallbackData(callbackData(12, "return"))).toEqual({ id: 12, answer: "return" })
    expect(parseCallbackData("d:12:z")).toBeNull()
    expect(parseCallbackData(undefined)).toBeNull()
  })

  it("под вопросом — кто и когда решил, затем итог", () => {
    const text = fullText(d({ status: "done", answer: "autoaction", answeredByName: "Минас", answeredAt: "2026-10-01T12:04:00.000Z", result: "автоакция: прайс не меняется" }))
    expect(text).toContain("Решено: Минас, 01.10 15:04 МСК — 🏷 Автоакция — не трогать")
    expect(text).toContain("Итог: автоакция: прайс не меняется")
  })
})
```
`apps/worker/src/jobs/bot.db.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { activeDecisions, decisionById, finishDecision, getState, openDecisions, TG_OFFSET_KEY } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { InlineButton, TelegramApi, TgUpdate } from "../telegram"
import { runBot } from "./bot"

const CHAT = "-1004395280612"
const MINAS = { id: 5710949139, first_name: "Минас" }
const STRANGER = { id: 42, first_name: "Чужой" }

function fakeTg(updates: TgUpdate[][] = []) {
  let nextId = 100
  const log = {
    sent: [] as Array<{ chatId: string; text: string; keyboard?: InlineButton[][]; replyTo?: number }>,
    edited: [] as Array<{ messageId: number; text: string }>,
    answers: [] as Array<{ text: string; alert: boolean }>,
    polls: [] as number[],
  }
  const api: TelegramApi = {
    async getUpdates(offset) {
      log.polls.push(offset)
      return updates.shift() ?? []
    },
    async sendMessage(chatId, text, opts = {}) {
      log.sent.push({ chatId, text, ...opts })
      return nextId++
    },
    async editMessageText(_chatId, messageId, text) {
      log.edited.push({ messageId, text })
    },
    async answerCallbackQuery(_id, text, alert = false) {
      log.answers.push({ text, alert })
    },
  }
  return { api, log }
}
const press = (updateId: number, from: { id: number; first_name: string }, data: string, messageId = 100): TgUpdate => ({
  update_id: updateId,
  callback_query: { id: `q${updateId}`, from, data, message: { message_id: messageId, chat: { id: Number(CHAT) } } },
})

describe.skipIf(!TEST_DATABASE_URL)("runBot", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  const runId = "00000000-0000-4000-8000-000000005001"
  const bot = (tg: TelegramApi, at = "2026-10-01T09:04:00.000Z", wbReturnEnabled = true) =>
    runBot({ db: h.db, tg, chatId: CHAT, approvers: new Set([MINAS.id]), now: () => new Date(at), pollTimeoutSec: 0, wbReturnEnabled })
  beforeAll(async () => {
    h = await freshTestDb()
    await insertRun(h.db, runId)
    await openDecisions(h.db, [{ kind: "wb_price_drift", subject: "1", payload: { nmId: 1, vendorCode: "JW-1", title: "Браслет", agreedMinor: 916400, observedMinor: 869000, priceRub: 15800, discountPct: 45 } }], runId)
  })
  afterAll(async () => h?.close())

  it("новый вопрос уходит в группу с кнопками, номер сообщения запоминается", async () => {
    const { api, log } = fakeTg()
    expect(await bot(api)).toMatchObject({ sent: 1 })
    expect(log.sent[0]).toMatchObject({ chatId: CHAT })
    expect(log.sent[0]!.keyboard).toHaveLength(3)
    const [d] = await activeDecisions(h.db)
    expect(d!.tgMessageId).toBe(100)
  })

  it("чужой — отказ всплывающим окном, вопрос открыт; партнёр — решено, под сообщением кто и когда; курсор сдвинут", async () => {
    const [d] = await activeDecisions(h.db)
    const { api, log } = fakeTg([[press(10, STRANGER, `d:${d!.id}:a`), press(11, MINAS, `d:${d!.id}:x`), press(12, MINAS, `d:${d!.id}:a`)]])
    expect(await bot(api)).toMatchObject({ rejected: 1, answered: 1 })
    expect(log.answers).toEqual([
      { text: "Нажимать могут только партнёры магазина", alert: true },
      { text: "Принято: 🏷 Автоакция — не трогать", alert: false },
      { text: "Вопрос уже решён", alert: false },
    ])
    expect(log.edited[0]!.text).toContain("Решено: Минас, 01.10 12:04 МСК — 🏷 Автоакция — не трогать")
    expect(await decisionById(h.db, d!.id)).toMatchObject({ status: "answered", answer: "autoaction", answeredById: MINAS.id })
    expect(await getState(h.db, TG_OFFSET_KEY)).toEqual({ offset: 12 })
    expect(log.polls).toEqual([1])
  })

  it("исход вопроса (исполнил prices) — дописывается под сообщением один раз", async () => {
    const [d] = await activeDecisions(h.db)
    await finishDecision(h.db, d!.id, "done", "автоакция: прайс не меняется", "2026-10-01T09:33:00.000Z")
    const { api, log } = fakeTg()
    expect(await bot(api)).toMatchObject({ closed: 1 })
    expect(log.edited[0]!.text).toContain("Итог: автоакция: прайс не меняется")
    const again = fakeTg()
    await bot(again.api)
    expect(again.log.edited).toEqual([])
  })

  it("«вернуть» при выключенной записи цен WB — отказ; /id — ответ с ID", async () => {
    await openDecisions(h.db, [{ kind: "wb_price_drift", subject: "2", payload: { nmId: 2, vendorCode: null, title: null, agreedMinor: 100000, observedMinor: 90000, priceRub: 1000, discountPct: 10 } }], runId)
    const first = fakeTg()
    await bot(first.api, "2026-10-01T10:00:00.000Z", false)
    const d = (await activeDecisions(h.db)).find((x) => x.subject === "2")!
    const { api, log } = fakeTg([
      [
        press(20, MINAS, `d:${d.id}:r`, d.tgMessageId!),
        { update_id: 21, message: { message_id: 9, chat: { id: Number(CHAT) }, from: { id: 777, first_name: "Партнёр" }, text: "/id@KotelnikovArtifactBot" } },
      ],
    ])
    await bot(api, "2026-10-01T10:01:00.000Z", false)
    expect(log.answers[0]).toEqual({ text: "Запись цен WB выключена — вернуть сейчас нельзя", alert: true })
    expect(await decisionById(h.db, d.id)).toMatchObject({ status: "open" })
    expect(log.sent).toEqual([{ chatId: CHAT, text: "Ваш Telegram ID: 777 (Партнёр)", replyTo: 9 }])
  })

  it("напоминание — через сутки без ответа, один раз в сутки", async () => {
    const d = (await activeDecisions(h.db)).find((x) => x.subject === "2")!
    const { api, log } = fakeTg()
    await bot(api, "2026-10-02T10:05:00.000Z", false)
    expect(log.sent).toEqual([expect.objectContaining({ replyTo: d.tgMessageId, text: expect.stringContaining("Напоминание") })])
    const again = fakeTg()
    await bot(again.api, "2026-10-02T11:00:00.000Z", false)
    expect(again.log.sent).toEqual([])
  })
})
```
Run: `npx vitest run apps/worker/src/telegram.test.ts apps/worker/src/decision-text.test.ts`; `npm run test:db -- apps/worker/src/jobs/bot.db.test.ts` → FAIL.

- [ ] **Step 2: Bot API** — `apps/worker/src/telegram.ts`:
```ts
// Telegram Bot API для кнопок (этап 2): long polling getUpdates (webhook не задан, публичного HTTPS на VPS нет),
// сообщения с inline-кнопками, правка сообщения, ответ на нажатие. Токен — только в пути запроса,
// в текстах ошибок его нет.

export interface InlineButton {
  text: string
  callback_data: string
}

export interface TgUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

export interface TgMessage {
  message_id: number
  chat: { id: number }
  from?: TgUser
  text?: string
}

export interface TgCallbackQuery {
  id: string
  from: TgUser
  message?: TgMessage
  data?: string
}

export interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

export interface TelegramApi {
  /** offset — первый ещё не обработанный update_id; timeoutSec — long polling. */
  getUpdates(offset: number, timeoutSec: number): Promise<TgUpdate[]>
  sendMessage(chatId: string, text: string, opts?: { keyboard?: InlineButton[][]; replyTo?: number }): Promise<number>
  /** Правка текста; кнопки снимаются. «Текст не изменился» — не ошибка. */
  editMessageText(chatId: string, messageId: number, text: string): Promise<void>
  answerCallbackQuery(callbackQueryId: string, text: string, showAlert?: boolean): Promise<void>
}

export function createTelegramApi(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  const call = async <T>(method: string, body: unknown, timeoutMs: number): Promise<T> => {
    let r: Response
    try {
      r = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (e: unknown) {
      throw new Error(`Telegram ${method}: сеть — ${e instanceof Error ? e.name : "ошибка"}`)
    }
    const j = (await r.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null
    if (!r.ok || !j?.ok) throw new Error(`Telegram ${method}: ${r.status} ${j?.description ?? ""}`.trim())
    return j.result as T
  }
  return {
    getUpdates: (offset, timeoutSec) =>
      call<TgUpdate[]>("getUpdates", { offset, timeout: timeoutSec, allowed_updates: ["message", "callback_query"] }, (timeoutSec + 10) * 1000),
    sendMessage: async (chatId, text, opts = {}) =>
      (
        await call<{ message_id: number }>(
          "sendMessage",
          {
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
            ...(opts.keyboard ? { reply_markup: { inline_keyboard: opts.keyboard } } : {}),
            ...(opts.replyTo ? { reply_parameters: { message_id: opts.replyTo, allow_sending_without_reply: true } } : {}),
          },
          15_000,
        )
      ).message_id,
    editMessageText: async (chatId, messageId, text) => {
      try {
        await call("editMessageText", { chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: [] } }, 15_000)
      } catch (e: unknown) {
        if (!(e instanceof Error && e.message.includes("message is not modified"))) throw e
      }
    },
    answerCallbackQuery: async (id, text, showAlert = false) => {
      await call("answerCallbackQuery", { callback_query_id: id, text, show_alert: showAlert }, 15_000)
    },
  }
}

/** TELEGRAM_APPROVERS — Telegram ID двух партнёров через запятую (решение п. 15). Пусто — не нажмёт никто. */
export function parseApprovers(raw: string | undefined): Set<number> {
  const out = new Set<number>()
  for (const part of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const n = Number(part)
    if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`TELEGRAM_APPROVERS: «${part}» — не Telegram ID`)
    out.add(n)
  }
  return out
}
```

- [ ] **Step 3: Тексты** — `apps/worker/src/decision-text.ts`:
```ts
import type { DecisionRow } from "@sync2/db"
import { formatRub, formatSignedPctBp, type DecisionAnswer, type DecisionKind } from "@sync2/shared"
import { formatMsk } from "./jobs/compare-v1"
import type { InlineButton, TgUser } from "./telegram"

export const ANSWER_LABELS: Record<DecisionAnswer, string> = {
  accept: "✅ Принять как прайс",
  autoaction: "🏷 Автоакция — не трогать",
  return: "↩️ Вернуть WB к прайсу",
}
const CODE: Record<DecisionAnswer, string> = { accept: "a", autoaction: "x", return: "r" }
const BY_CODE: Record<string, DecisionAnswer> = { a: "accept", x: "autoaction", r: "return" }

/** callback_data ≤ 64 байт: «d:<id>:<a|x|r>». */
export function callbackData(id: number, answer: DecisionAnswer): string {
  return `d:${id}:${CODE[answer]}`
}

export function parseCallbackData(data: string | undefined): { id: number; answer: DecisionAnswer } | null {
  const m = /^d:(\d+):([axr])$/.exec(data ?? "")
  return m ? { id: Number(m[1]), answer: BY_CODE[m[2]!]! } : null
}

/** «Вернуть» — только про расхождение и только при действующем apply цен WB. */
export function allowedAnswers(kind: DecisionKind, wbReturnEnabled: boolean): DecisionAnswer[] {
  if (kind === "wb_price_new") return ["accept"]
  return wbReturnEnabled ? ["accept", "autoaction", "return"] : ["accept", "autoaction"]
}

export function decisionKeyboard(d: Pick<DecisionRow, "id" | "kind">, wbReturnEnabled: boolean): InlineButton[][] {
  return allowedAnswers(d.kind, wbReturnEnabled).map((a) => [{ text: ANSWER_LABELS[a], callback_data: callbackData(d.id, a) }])
}

export function decisionText(d: Pick<DecisionRow, "kind" | "payload">): string {
  const p = d.payload
  const head = [p.title ?? "(без названия)", `Арт. ${p.vendorCode ?? "—"} · nm ${p.nmId}`]
  const wbLine = `Цена продавца на WB: ${formatRub(p.observedMinor)} (до скидки ${p.priceRub} ₽, скидка ${p.discountPct} %)`
  if (d.kind === "wb_price_new") return ["🆕 WB: товар в наличии без прайса", ...head, wbLine, "Принять эту цену как прайс?"].join("\n")
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

export function reminderText(d: Pick<DecisionRow, "payload">): string {
  return `⏰ Напоминание: вопрос по nm ${d.payload.nmId} без ответа больше суток — без ответа ничего не применяется`
}

export function userName(u: TgUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || (u.username ? `@${u.username}` : String(u.id))
}
```

- [ ] **Step 4: Джоба** — `apps/worker/src/jobs/bot.ts`:
```ts
import {
  TG_OFFSET_KEY,
  answerDecision,
  decisionById,
  decisionsToRemind,
  decisionsToShowOutcome,
  getState,
  markDecisionSent,
  markReminded,
  markTgClosed,
  setState,
  unsentDecisions,
  type Db,
} from "@sync2/db"
import { ANSWER_LABELS, allowedAnswers, decisionKeyboard, fullText, parseCallbackData, reminderText, userName } from "../decision-text"
import type { TelegramApi, TgCallbackQuery, TgUpdate } from "../telegram"

/** Long polling внутри минутного крона: 50 с ожидания + запуск tsx укладываются в timeout 58s. */
export const BOT_POLL_TIMEOUT_SEC = 50
/** Вопросов в группу за прогон — первый сторож откроет десятки, группа не должна получить их разом. */
export const BOT_MAX_SEND_PER_RUN = 10

export interface BotDeps {
  db: Db
  tg: TelegramApi
  chatId: string
  approvers: ReadonlySet<number>
  now: () => Date
  pollTimeoutSec: number
  /** Действующий режим записи цен WB — apply: кнопка «вернуть» показывается и принимается. */
  wbReturnEnabled: boolean
}

type Add = (key: string) => void

/**
 * Один прогон бота (крон раз в минуту): вопросы в группу, итоги под сообщениями, напоминания, затем long
 * polling нажатий и `/id`. На площадки не пишет — ответ исполняет следующий прогон prices.
 */
export async function runBot(deps: BotDeps): Promise<Record<string, number>> {
  const { db, tg } = deps
  const counters: Record<string, number> = {}
  const add: Add = (key) => {
    counters[key] = (counters[key] ?? 0) + 1
  }
  const nowIso = () => deps.now().toISOString()

  for (const d of await unsentDecisions(db, BOT_MAX_SEND_PER_RUN)) {
    await markDecisionSent(db, d.id, await tg.sendMessage(deps.chatId, fullText(d), { keyboard: decisionKeyboard(d, deps.wbReturnEnabled) }), nowIso())
    add("sent")
  }
  for (const d of await decisionsToShowOutcome(db, BOT_MAX_SEND_PER_RUN)) {
    await tg.editMessageText(deps.chatId, d.tgMessageId!, fullText(d))
    await markTgClosed(db, d.id, nowIso())
    add("closed")
  }
  for (const d of await decisionsToRemind(db, nowIso())) {
    await tg.sendMessage(deps.chatId, reminderText(d), { replyTo: d.tgMessageId! })
    await markReminded(db, d.id, nowIso())
    add("reminded")
  }

  const offset = (await getState<{ offset: number }>(db, TG_OFFSET_KEY))?.offset ?? 0
  for (const u of await tg.getUpdates(offset + 1, deps.pollTimeoutSec)) {
    try {
      await handleUpdate(deps, u, add)
    } catch {
      // Нажатие устарело, Telegram отказал — не зацикливаемся на одном обновлении: курсор идёт дальше.
      add("updateFailed")
    }
    await setState(db, TG_OFFSET_KEY, { offset: u.update_id })
  }
  return counters
}

async function handleUpdate(deps: BotDeps, u: TgUpdate, add: Add): Promise<void> {
  if (u.callback_query) return handleCallback(deps, u.callback_query, add)
  const m = u.message
  if (m?.from && /^\/id(@\w+)?$/.test((m.text ?? "").trim())) {
    await deps.tg.sendMessage(String(m.chat.id), `Ваш Telegram ID: ${m.from.id} (${userName(m.from)})`, { replyTo: m.message_id })
    add("idReplies")
  }
}

async function handleCallback(deps: BotDeps, q: TgCallbackQuery, add: Add): Promise<void> {
  const { tg, db } = deps
  const parsed = parseCallbackData(q.data)
  if (!parsed) {
    await tg.answerCallbackQuery(q.id, "Непонятная кнопка")
    return
  }
  if (String(q.message?.chat.id ?? "") !== deps.chatId) {
    await tg.answerCallbackQuery(q.id, "Кнопка не из группы магазина", true)
    add("rejected")
    return
  }
  if (!deps.approvers.has(q.from.id)) {
    await tg.answerCallbackQuery(q.id, "Нажимать могут только партнёры магазина", true)
    add("rejected")
    return
  }
  const d = await decisionById(db, parsed.id)
  if (!d || d.status !== "open") {
    await tg.answerCallbackQuery(q.id, "Вопрос уже решён")
    return
  }
  if (!allowedAnswers(d.kind, deps.wbReturnEnabled).includes(parsed.answer)) {
    await tg.answerCallbackQuery(q.id, parsed.answer === "return" ? "Запись цен WB выключена — вернуть сейчас нельзя" : "Этот ответ к вопросу не подходит", true)
    return
  }
  const answered = await answerDecision(db, d.id, parsed.answer, { id: q.from.id, name: userName(q.from) }, deps.now().toISOString())
  if (!answered) {
    await tg.answerCallbackQuery(q.id, "Вопрос уже решён")
    return
  }
  await tg.answerCallbackQuery(q.id, `Принято: ${ANSWER_LABELS[parsed.answer]}`)
  if (answered.tgMessageId) await tg.editMessageText(deps.chatId, answered.tgMessageId, fullText(answered))
  add("answered")
}
```

- [ ] **Step 5: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
git add apps/worker/src/telegram.ts apps/worker/src/telegram.test.ts apps/worker/src/decision-text.ts apps/worker/src/decision-text.test.ts apps/worker/src/jobs/bot.ts apps/worker/src/jobs/bot.db.test.ts
git commit -m "sync2: Telegram — вопросы с кнопками, приём нажатий только от партнёров, итоги под сообщениями, напоминания, /id"
```

---

### Task 20: CLI цен, предпросмотр `apply`, блок «Цены» в суточной сводке

**Files:**
- Create: `apps/worker/src/notify-run.ts`, `apps/worker/src/cli-prices.ts`, `apps/worker/src/jobs/price-summary.ts`, `jobs/price-summary.test.ts`
- Modify: `apps/worker/src/cli.ts`, `apps/worker/src/apply-preview.ts`, `apply-preview.test.ts`, `apps/worker/src/jobs/drift.ts`

- [ ] **Step 1: Падающие тесты.** В `apps/worker/src/apply-preview.test.ts` (импорт дополнить `checkPriceApplyPreview`):
```ts
describe("checkPriceApplyPreview", () => {
  const now = new Date("2026-10-01T10:00:00.000Z")
  const run = (counters: Record<string, number>, startedAt = "2026-10-01T09:33:00.000Z", status: "ok" | "partial" | "failed" = "ok") => ({ runId: "r", status, startedAt, counters })

  it("свежий prices, площадка прочитана, без предела и капа — можно", () => {
    expect(checkPriceApplyPreview(run({ ozonPricesRead: 81, ozonPricePlanned: 60 }), "ozon", now)).toEqual({ ok: true })
    expect(checkPriceApplyPreview(run({}), "wb", now)).toEqual({ ok: true })
  })

  it("нет прогона, старый, упал, площадка не читалась, предел или кап — нельзя", () => {
    expect(checkPriceApplyPreview(null, "ozon", now)).toMatchObject({ ok: false })
    expect(checkPriceApplyPreview(run({ ozonPricesRead: 1 }, "2026-10-01T09:00:00.000Z"), "ozon", now)).toMatchObject({ ok: false, reason: expect.stringContaining("устарел") })
    expect(checkPriceApplyPreview(run({}, undefined, "failed"), "ozon", now)).toMatchObject({ ok: false })
    expect(checkPriceApplyPreview(run({}), "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("dry-run") })
    expect(checkPriceApplyPreview(run({ kitPricesRead: 5, pricesAborted: 401 }), "kit", now)).toMatchObject({ ok: false })
    expect(checkPriceApplyPreview(run({ kitPricesRead: 5, kitPriceCapped: 1 }), "kit", now)).toMatchObject({ ok: false, reason: expect.stringContaining("60 %") })
  })
})
```
`apps/worker/src/jobs/price-summary.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { formatPriceSummary } from "./price-summary"

const stats = (applied: number, failed: number) => ({ applied, failed, barcodes: applied + failed, repeated: [] })

describe("блок «Цены» суточной сводки", () => {
  it("вопросы, записи, режимы, k и возраст чтения WB", () => {
    expect(
      formatPriceSummary({
        open: 3,
        answered: 1,
        stats: { wb: stats(1, 0), ozon: stats(12, 1), ym: stats(0, 0), kit: stats(40, 0), site: stats(78, 0) },
        modes: { wb: "dry-run", ozon: "apply", ym: "dry-run", kit: "apply", site: "apply" },
        sppBp: 2531,
        wbWatchAgeMin: 12,
      }),
    ).toBe(
      [
        "💰 Цены",
        "Вопросов без ответа: 3, ждут исполнения: 1",
        "Записи цен за сутки (применено/ошибок): WB 1/0 · Ozon 12/1 · ЯМ 0/0 · KIT 40/0 · сайт 78/0",
        "Режимы записи цен: WB dry-run · Ozon apply · ЯМ dry-run · KIT apply · сайт apply",
        "k СПП: 25,31 %",
        "Цены WB читались: 12 мин назад",
      ].join("\n"),
    )
  })

  it("k нет, WB ни разу не читались — видно сразу", () => {
    const text = formatPriceSummary({
      open: 0,
      answered: 0,
      stats: { wb: stats(0, 0), ozon: stats(0, 0), ym: stats(0, 0), kit: stats(0, 0), site: stats(0, 0) },
      modes: { wb: "off", ozon: "off", ym: "off", kit: "off", site: "off" },
      sppBp: null,
      wbWatchAgeMin: null,
    })
    expect(text).toContain("k СПП: не посчитан")
    expect(text).toContain("Цены WB читались: ⚠️ ни разу")
  })
})
```
Run: `npx vitest run apps/worker/src/apply-preview.test.ts apps/worker/src/jobs/price-summary.test.ts` → FAIL.

- [ ] **Step 2: Предпросмотр apply цен** — в конец `apps/worker/src/apply-preview.ts`:
```ts
/** План цен старше этого для «включать apply» не годится — сначала prices (крон раз в 30 мин). */
export const PRICE_APPLY_PREVIEW_MAX_AGE_MIN = 45

/**
 * Можно ли включать apply цен площадки (решение 5 этапа 2): последний prices свежий и не упал; зеркало в нём
 * читалось (было в dry-run) — иначе плана нет; нет предела изменений и изменений больше 60 %.
 */
export function checkPriceApplyPreview(run: RunInfo | null, channel: Channel, now: Date): { ok: true } | { ok: false; reason: string } {
  if (!run) return { ok: false, reason: "prices ещё не запускался — сначала prices" }
  if (run.status !== "ok" && run.status !== "partial") return { ok: false, reason: `последний prices — ${run.status}` }
  const ageMin = Math.round((now.getTime() - Date.parse(run.startedAt)) / 60_000)
  if (ageMin > PRICE_APPLY_PREVIEW_MAX_AGE_MIN) return { ok: false, reason: `последний prices ${ageMin} мин назад — план устарел, сначала prices` }
  if (channel !== "wb" && !(`${channel}PricesRead` in run.counters)) {
    return { ok: false, reason: `цены ${channel} не читались в последнем prices — сначала price-mode ${channel} dry-run и prices` }
  }
  if ("pricesAborted" in run.counters) return { ok: false, reason: "последний prices отклонён пределом изменений — разобрать до apply" }
  if (`${channel}PriceCapped` in run.counters) return { ok: false, reason: `в плане ${channel} есть изменения больше 60 % — разобрать до apply` }
  return { ok: true }
}
```

- [ ] **Step 3: Уведомление о смене состояния — в отдельный модуль.** `apps/worker/src/notify-run.ts`:
```ts
import { sameStatusStreak, type Db } from "@sync2/db"
import type { Logger } from "./log"
import type { Notifier } from "./notify"
import type { RunOutcome } from "./run"
import { decideNotification, describeOutcome } from "./transition"

/**
 * Уведомление о прогоне джобы — решение в decideNotification (transition.ts), здесь только данные из журнала
 * и отправка. Не доставлено — warn в лог. Вынесено из cli.ts (этап 2): нужно и командам цен.
 */
export async function notifyTransition(db: Db, log: Logger, notifier: Notifier, job: string, prev: RunOutcome["status"] | null, outcome: RunOutcome): Promise<void> {
  const streak = outcome.status === "ok" ? 0 : await sameStatusStreak(db, job, outcome.status)
  const text = decideNotification({ job, prev, cur: { status: outcome.status, detail: describeOutcome(outcome) }, streak })
  if (text === null) return
  if (!(await notifier.send(text))) log.warn({ job, text }, "уведомление в Telegram не доставлено")
}
```
В `cli.ts`: удалить локальную `notifyTransition`, импортировать её из `./notify-run`; из импорта `@sync2/db` убрать `sameStatusStreak`, из импорта `./transition` — `decideNotification, describeOutcome` (остаётся `writeFailureAlerts`).

- [ ] **Step 4: Команды цен** — `apps/worker/src/cli-prices.ts`:
```ts
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { eq } from "drizzle-orm"
import {
  activeDecisions,
  activeSpp,
  agreedPriceHistory,
  answerDecision,
  channels,
  drizzleRunStore,
  importAgreedPrices,
  lastRunStatus,
  latestRun,
  loadAgreedPrices,
  loadChannels,
  loadProducts,
  setAgreedPrice,
  sppHistory,
  writesOfRun,
  type Db,
  type RunInfo,
  type WriteRow,
} from "@sync2/db"
import { parseAgreedCsv } from "@sync2/domain"
import { effectiveMode, fetchWbSppSales } from "@sync2/platforms"
import { DECISION_ANSWERS, decimalStringToMinor, errorText, formatRub, isChannel, type Config, type DecisionAnswer } from "@sync2/shared"
import { checkPriceApplyPreview } from "./apply-preview"
import { loadChannelsConfig } from "./channels-config"
import { BOT_POLL_TIMEOUT_SEC, runBot } from "./jobs/bot"
import { runPrices } from "./jobs/prices"
import { runSpp } from "./jobs/spp"
import type { Logger } from "./log"
import type { Notifier } from "./notify"
import { notifyTransition } from "./notify-run"
import { buildPriceSender, buildPriceSources } from "./price-senders"
import { loadPricingConfig } from "./pricing-config"
import { withRun } from "./run"
import { createTelegramApi, parseApprovers } from "./telegram"

export const PRICE_COMMANDS: ReadonlySet<string> = new Set(["prices", "spp", "bot", "price", "price-mode", "price-plan", "decisions", "decide"])

/** Флаги команд цен; `--only=…` и `--reason=…` — со значением через «=». */
export const PRICE_FLAGS: Record<string, readonly string[]> = {
  prices: ["--only"],
  spp: ["--show"],
  price: ["--confirm", "--reason"],
  "price-mode": ["--confirm"],
  decide: ["--confirm"],
}

export const PRICE_USAGE = `
Цены (этап 2):
  prices [--only=<nmId,…>]
                         решения партнёров, сторож WB или возврат WB, цены зеркал по режимам цен
  price-mode <площадка> <off|dry-run|apply> [--confirm]
                         режим записи цен; apply — после плана свежего prices и с --confirm
  price-plan [<площадка>]
                         план/итог записей цен последнего prices
  price import <csv> [--confirm]
                         импорт прайса: без --confirm — предпросмотр; уже записанные не меняются
  price set <nmId> <рубли> --reason=<причина> [--confirm]
                         изменить прайс карточки (с историей)
  price show [<nmId>]    прайс целиком или история карточки
  decisions              вопросы без исхода
  decide <id|all-drift> <accept|autoaction|return> [--confirm]
                         ответ владельца из терминала (return — только по одному вопросу)
  spp [--show]           коэффициент СПП из финотчёта WB (раз в сутки); --show — история без запроса
  bot                    Telegram: вопросы в группу, нажатия, напоминания, /id (крон раз в минуту)`

export interface PriceCliContext {
  db: Db
  log: Logger
  config: Config
  notifier: Notifier
  env: NodeJS.ProcessEnv
}

const CLI_APPROVER = "владелец (CLI)"
const flagValue = (flags: readonly string[], name: string): string | null => {
  const f = flags.find((x) => x.startsWith(`${name}=`))
  return f ? f.slice(name.length + 1) : null
}

function printPricePlan(run: RunInfo, rows: WriteRow[]): void {
  console.log(`prices ${run.startedAt} ${run.status} ${JSON.stringify(run.counters)}`)
  const priceRows = rows.filter((w) => w.field === "price")
  if (priceRows.length === 0) {
    console.log("записей цен в плане нет")
    return
  }
  for (const w of priceRows) {
    const state = w.applied ? "применено" : w.uncertain ? `итог неизвестен: ${w.error ?? ""}` : w.error ? `ошибка: ${w.error}` : w.mode
    const move = `${w.before === null ? "—" : formatRub(w.before)} → ${formatRub(w.after)}`
    console.log([w.channel, w.barcode, w.vendorCode ?? "", w.externalSku ?? "—", move, state, (w.title ?? "").slice(0, 40)].join("\t"))
  }
}

async function runPriceSub(db: Db, sub: string | undefined, a1: string | undefined, a2: string | undefined, flags: readonly string[]): Promise<number> {
  const confirm = flags.includes("--confirm")
  if (sub === "import") {
    if (!a1) {
      console.error("не указан файл CSV")
      return 2
    }
    const parsed = parseAgreedCsv(readFileSync(a1, "utf8"))
    if (parsed.errors.length > 0) {
      for (const e of parsed.errors) console.error(e)
      return 2
    }
    const current = await loadAgreedPrices(db)
    const fresh = parsed.rows.filter((r) => !current.has(r.nmId))
    const conflicts = parsed.rows.filter((r) => current.has(r.nmId) && current.get(r.nmId)!.priceMinor !== r.priceMinor)
    console.log(`в файле ${parsed.rows.length}, новых ${fresh.length}, уже записано ${parsed.rows.length - fresh.length}, расходится с записанным ${conflicts.length}`)
    for (const r of fresh.slice(0, 10)) console.log(`+ ${r.nmId}\t${r.barcode}\t${r.subject}\t${formatRub(r.priceMinor)}`)
    for (const r of conflicts) console.log(`≠ ${r.nmId}\tв базе ${formatRub(current.get(r.nmId)!.priceMinor)}\tв файле ${formatRub(r.priceMinor)} — не меняется (price set)`)
    if (!confirm) {
      console.error("импорт не выполнен: посмотрите список и повторите с --confirm")
      return 2
    }
    const r = await importAgreedPrices(db, parsed.rows, { approvedBy: CLI_APPROVER, reason: `импорт ${basename(a1)}` })
    console.log(`записано ${r.inserted}, без изменений ${r.unchanged}, конфликтов ${r.conflicts.length}`)
    return 0
  }
  if (sub === "set") {
    const nmId = Number(a1)
    const reason = flagValue(flags, "--reason")
    if (!Number.isSafeInteger(nmId) || nmId <= 0 || !a2 || !reason) {
      console.error("price set <nmId> <рубли> --reason=<причина> [--confirm]")
      return 2
    }
    let priceMinor: number
    try {
      priceMinor = decimalStringToMinor(a2.replace(",", "."))
    } catch {
      console.error(`цена «${a2}» — не число`)
      return 2
    }
    if (priceMinor <= 0) {
      console.error("прайс должен быть больше нуля")
      return 2
    }
    const current = (await loadAgreedPrices(db)).get(nmId)
    const barcode = current?.barcode ?? (await loadProducts(db)).find((p) => p.nmId === nmId)?.barcode
    if (!barcode) {
      console.error(`карточки nm ${nmId} нет в справочнике`)
      return 2
    }
    console.log(`nm ${nmId} (${barcode}): прайс ${current ? formatRub(current.priceMinor) : "—"} → ${formatRub(priceMinor)}; причина: ${reason}`)
    if (!confirm) {
      console.error("не записано: повторите с --confirm")
      return 2
    }
    await setAgreedPrice(db, { nmId, barcode, priceMinor, source: "cli", approvedBy: CLI_APPROVER, reason })
    console.log("записано")
    return 0
  }
  if (sub === "show") {
    if (a1) {
      for (const h of await agreedPriceHistory(db, Number(a1))) {
        console.log([h.createdAt, h.prevPriceMinor === null ? "—" : formatRub(h.prevPriceMinor), "→", formatRub(h.priceMinor), h.source, h.approvedBy, h.reason ?? "", h.decisionId ? `#${h.decisionId}` : ""].join("\t"))
      }
      return 0
    }
    const rows = [...(await loadAgreedPrices(db)).values()].sort((a, b) => a.nmId - b.nmId)
    for (const r of rows) console.log([r.nmId, r.barcode, formatRub(r.priceMinor), `уступка ${r.concessionBp / 100} %`, r.source, r.approvedBy, r.updatedAt].join("\t"))
    const k = await activeSpp(db)
    console.log(`позиций: ${rows.length}; k СПП: ${k === null ? "не посчитан" : `${k / 100} %`}`)
    return 0
  }
  console.error("price import <csv> [--confirm] | price set <nmId> <рубли> --reason=<причина> [--confirm] | price show [<nmId>]")
  return 2
}

export async function runPriceCommand(ctx: PriceCliContext, pos: readonly string[], flags: readonly string[]): Promise<number> {
  const [cmd, arg, arg2, arg3] = pos
  const { db, log, config, notifier, env } = ctx
  switch (cmd) {
    case "prices": {
      const only = flagValue(flags, "--only")
      const onlyNmIds = only === null ? undefined : new Set(only.split(",").map((s) => Number(s.trim())))
      if (onlyNmIds && [...onlyNmIds].some((n) => !Number.isSafeInteger(n) || n <= 0)) {
        console.error(`--only: nmId через запятую, получено «${only}»`)
        return 2
      }
      const prev = await lastRunStatus(db, "prices")
      const outcome = await withRun("prices", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (run) => {
        const chCfg = loadChannelsConfig(env)
        const pricing = loadPricingConfig()
        const r = await runPrices({
          db,
          now: () => new Date(),
          runId: run.runId,
          globalMode: config.writeMode,
          config: pricing,
          sources: buildPriceSources(chCfg, pricing),
          send: buildPriceSender(chCfg),
          ...(onlyNmIds ? { onlyNmIds } : {}),
        })
        return { status: r.status, counters: r.counters, error: r.error }
      })
      await notifyTransition(db, log, notifier, "prices", prev, outcome)
      return outcome.status === "failed" ? 1 : 0
    }
    case "spp": {
      if (flags.includes("--show")) {
        const k = await activeSpp(db)
        console.log(`действующий k: ${k === null ? "не посчитан" : `${k} bp`}`)
        for (const r of await sppHistory(db, 12)) {
          console.log([r.windowTo, `продаж ${r.sales}`, `медиана ${r.medianBp ?? "—"}`, `k ${r.activeBp ?? "—"}`, r.changed ? "сменён" : "без смены", r.reason].join("\t"))
        }
        return 0
      }
      const prev = await lastRunStatus(db, "spp")
      const outcome = await withRun("spp", { store: drizzleRunStore(db), log, writeMode: config.writeMode }, async (run) => {
        const token = loadChannelsConfig(env).wb.token
        const r = await runSpp({ db, now: () => new Date(), runId: run.runId, fetchSales: (from, to) => fetchWbSppSales(token, from, to) })
        return { status: r.status, counters: r.counters, error: r.error }
      })
      await notifyTransition(db, log, notifier, "spp", prev, outcome)
      return outcome.status === "failed" ? 1 : 0
    }
    case "bot": {
      const token = env.TELEGRAM_BOT_TOKEN?.trim()
      const chatId = env.TELEGRAM_CHAT_ID?.trim()
      if (!token || !chatId) {
        console.error("TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не задан")
        return 2
      }
      try {
        const chs = await loadChannels(db)
        const wbReturnEnabled = effectiveMode(config.writeMode, chs.get("wb")?.priceWriteMode ?? "off") === "apply"
        const counters = await runBot({ db, tg: createTelegramApi(token), chatId, approvers: parseApprovers(env.TELEGRAM_APPROVERS), now: () => new Date(), pollTimeoutSec: BOT_POLL_TIMEOUT_SEC, wbReturnEnabled })
        if (Object.keys(counters).length > 0) log.info({ job: "bot", counters }, "бот")
        return 0
      } catch (e: unknown) {
        log.error({ job: "bot", err: errorText(e) }, "бот: сбой")
        return 1
      }
    }
    case "price":
      return runPriceSub(db, arg, arg2, arg3, flags)
    case "price-mode": {
      if (!arg || !isChannel(arg)) {
        console.error(`неизвестная площадка: ${arg}${PRICE_USAGE}`)
        return 2
      }
      if (arg2 !== "off" && arg2 !== "dry-run" && arg2 !== "apply") {
        console.error(`неизвестный режим: ${arg2} (ожидается off | dry-run | apply)`)
        return 2
      }
      if (arg2 === "apply") {
        const run = await latestRun(db, "prices")
        if (run) printPricePlan(run, (await writesOfRun(db, run.runId)).filter((w) => w.channel === arg))
        const verdict = checkPriceApplyPreview(run, arg, new Date())
        if (!verdict.ok) {
          console.error(`apply цен не включён: ${verdict.reason}`)
          return 2
        }
        if (!flags.includes("--confirm")) {
          console.error(`apply цен не включён: посмотрите план ${arg} выше и повторите с --confirm`)
          return 2
        }
      } else if (flags.includes("--confirm")) {
        console.error("--confirm нужен только для apply")
        return 2
      }
      const updated = await db.update(channels).set({ priceWriteMode: arg2 }).where(eq(channels.code, arg)).returning({ code: channels.code })
      if (updated.length === 0) {
        console.error(`площадка ${arg} не заведена в базе — выполните seed-channels`)
        return 2
      }
      for (const r of await db.select({ code: channels.code, stock: channels.writeMode, price: channels.priceWriteMode }).from(channels).orderBy(channels.code)) {
        console.log(`${r.code}\tостатки ${r.stock}\tцены ${r.price}`)
      }
      return 0
    }
    case "price-plan": {
      if (arg && !isChannel(arg)) {
        console.error(`неизвестная площадка: ${arg}`)
        return 2
      }
      const run = await latestRun(db, "prices")
      if (!run) {
        console.error("prices ещё не запускался")
        return 2
      }
      const rows = await writesOfRun(db, run.runId)
      printPricePlan(run, arg ? rows.filter((w) => w.channel === arg) : rows)
      return 0
    }
    case "decisions": {
      const list = await activeDecisions(db)
      for (const d of list) {
        const agreed = d.payload.agreedMinor === null ? "—" : formatRub(d.payload.agreedMinor)
        console.log([`#${d.id}`, d.kind, `nm ${d.payload.nmId}`, d.status, d.answer ?? "", `${agreed} → ${formatRub(d.payload.observedMinor)}`, d.tgMessageId ? "в группе" : "не отправлен", (d.payload.title ?? "").slice(0, 30)].join("\t"))
      }
      console.log(`без исхода: ${list.length}`)
      return 0
    }
    case "decide": {
      if (!arg || !arg2 || !(DECISION_ANSWERS as readonly string[]).includes(arg2) || (arg === "all-drift" && arg2 === "return")) {
        console.error("decide <id|all-drift> <accept|autoaction|return> [--confirm] (return — только по одному вопросу)")
        return 2
      }
      const answer = arg2 as DecisionAnswer
      const open = (await activeDecisions(db)).filter((d) => d.status === "open")
      const targets = arg === "all-drift" ? open.filter((d) => d.kind === "wb_price_drift") : open.filter((d) => d.id === Number(arg))
      if (targets.length === 0) {
        console.error("открытых вопросов с таким номером нет")
        return 2
      }
      if (targets.some((d) => d.kind === "wb_price_new" && answer !== "accept")) {
        console.error("на вопрос «без прайса» ответ только accept")
        return 2
      }
      for (const d of targets) {
        const agreed = d.payload.agreedMinor === null ? "—" : formatRub(d.payload.agreedMinor)
        console.log(`#${d.id}\tnm ${d.payload.nmId}\t${agreed} → ${formatRub(d.payload.observedMinor)}\t${answer}`)
      }
      if (!flags.includes("--confirm")) {
        console.error(`ответ не записан: ${targets.length} вопросов выше — повторите с --confirm`)
        return 2
      }
      let n = 0
      for (const d of targets) if (await answerDecision(db, d.id, answer, { id: null, name: CLI_APPROVER }, new Date().toISOString())) n++
      console.log(`отвечено ${n}; исполнит следующий prices`)
      return 0
    }
    default:
      console.error(`неизвестная команда цен: ${cmd}`)
      return 2
  }
}
```
Правки `apps/worker/src/cli.ts`:
  - импорт: `import { PRICE_COMMANDS, PRICE_FLAGS, PRICE_USAGE, runPriceCommand } from "./cli-prices"`;
  - `USAGE` — дописать `${PRICE_USAGE}` в конец шаблонной строки;
  - разбор аргументов:
```ts
  const positional = argv.filter((a) => !a.startsWith("--"))
  const [cmd, arg, arg2] = positional
  const flags = argv.filter((a) => a.startsWith("--"))
```
  - проверка флагов — по имени до «=» и с флагами цен:
```ts
  for (const flag of flags) {
    const name = flag.includes("=") ? flag.slice(0, flag.indexOf("=")) : flag
    if (!(ALLOWED_FLAGS[cmd] ?? PRICE_FLAGS[cmd] ?? []).includes(name)) {
      console.error(`неизвестный флаг для ${cmd}: ${flag}\n\n${USAGE}`)
      return 2
    }
  }
```
  - первой строкой внутри `try { … }` перед `switch (cmd)`:
```ts
    if (PRICE_COMMANDS.has(cmd)) return await runPriceCommand({ db, log, config, notifier, env: process.env }, positional, flags)
```

- [ ] **Step 5: Сводка** — `apps/worker/src/jobs/price-summary.ts`:
```ts
import { activeDecisions, activeSpp, latestWbPriceSnapshot, loadChannels, writeStatsSince, type Db, type WriteStats } from "@sync2/db"
import { CHANNELS, CHANNEL_LABELS, type Channel, type WriteMode } from "@sync2/shared"

export interface PriceSummary {
  open: number
  answered: number
  stats: Record<Channel, WriteStats>
  modes: Record<Channel, WriteMode>
  sppBp: number | null
  wbWatchAgeMin: number | null
}

/** Блок «Цены» суточной сводки drift — числа, без рекомендаций. */
export function formatPriceSummary(s: PriceSummary): string {
  const writes = CHANNELS.map((c) => `${CHANNEL_LABELS[c]} ${s.stats[c].applied}/${s.stats[c].failed}`).join(" · ")
  const modes = CHANNELS.map((c) => `${CHANNEL_LABELS[c]} ${s.modes[c]}`).join(" · ")
  return [
    "💰 Цены",
    `Вопросов без ответа: ${s.open}, ждут исполнения: ${s.answered}`,
    `Записи цен за сутки (применено/ошибок): ${writes}`,
    `Режимы записи цен: ${modes}`,
    `k СПП: ${s.sppBp === null ? "не посчитан" : `${(s.sppBp / 100).toFixed(2).replace(".", ",")} %`}`,
    `Цены WB читались: ${s.wbWatchAgeMin === null ? "⚠️ ни разу" : `${s.wbWatchAgeMin} мин назад`}`,
  ].join("\n")
}

export async function loadPriceSummary(db: Db, now: Date, sinceIso: string): Promise<PriceSummary> {
  const channels = await loadChannels(db)
  const active = await activeDecisions(db)
  const wbId = channels.get("wb")?.id
  const lastWb = wbId === undefined ? null : await latestWbPriceSnapshot(db, wbId)
  return {
    open: active.filter((d) => d.status === "open").length,
    answered: active.filter((d) => d.status === "answered").length,
    stats: await writeStatsSince(db, sinceIso, "price"),
    modes: Object.fromEntries(CHANNELS.map((c) => [c, channels.get(c)?.priceWriteMode ?? "off"])) as Record<Channel, WriteMode>,
    sppBp: await activeSpp(db),
    wbWatchAgeMin: lastWb ? Math.round((now.getTime() - Date.parse(lastWb.takenAt)) / 60_000) : null,
  }
}
```
`apps/worker/src/jobs/drift.ts`, в `runDrift` — после `const text = formatDrift(…)` заменить формирование текста на:
```ts
  const full = `${formatDrift(drifts, stats, { now, lastPoolRecalcAt, failedRuns, stuckRuns })}\n\n${formatPriceSummary(await loadPriceSummary(db, now, since))}`
  const text = full.length <= MAX_TELEGRAM_TEXT ? full : full.slice(0, MAX_TELEGRAM_TEXT - TRUNCATED_MARK.length) + TRUNCATED_MARK
```
(импорт `formatPriceSummary, loadPriceSummary` из `./price-summary`). Ожидания существующих тестов `formatDrift` не меняются — функция та же.

- [ ] **Step 6: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
npm run cli -- help | grep -E "price-mode|decide|spp"
git add apps/worker/src/notify-run.ts apps/worker/src/cli-prices.ts apps/worker/src/cli.ts apps/worker/src/apply-preview.ts apps/worker/src/apply-preview.test.ts apps/worker/src/jobs/price-summary.ts apps/worker/src/jobs/price-summary.test.ts apps/worker/src/jobs/drift.ts
git commit -m "sync2: CLI цен — prices, price import/set/show, price-mode с предпросмотром, price-plan, decisions/decide, spp, bot; блок «Цены» в сводке"
```
Expected `help`: строки `price-mode`, `decide`, `spp`.

---

### Task 21: Крон, выкладка, `.env`, README — этап 2

**Files:**
- Modify: `deploy/crontab.sync2.txt`, `deploy/deploy.sh`, `deploy/README.md`, `.env.example`, `README.md`

- [ ] **Step 1: Крон** — `deploy/crontab.sync2.txt` целиком (строка `compare-v1` снята на шаге B этапа 1.4 — этап 2 выкладывается после него):
```
# >>> sync2 (этап 2) — блок целиком заменяется при выкладке (deploy/README.md, «Этап 2»)
# tick каждые 5 минут в минуты 1,6,…,56; timeout 9m; при занятой блокировке пропускается (flock -n) — штатно.
1-59/5 * * * * cd /opt/sync2 && flock -n /tmp/sync2.lock timeout 9m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts tick >> logs/tick.log 2>&1
# цены: ответы партнёров, сторож WB (окно лимита 15 мин) или возврат WB, зеркала — в минуты 3 и 33; тик ждёт до 4 мин
3,33 * * * * cd /opt/sync2 && flock -w 240 /tmp/sync2.lock timeout 9m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts prices >> logs/prices.log 2>&1
# бот: вопросы в группу, нажатия, напоминания, /id — каждую минуту, long polling 50 с; своя блокировка, на площадки не пишет
* * * * * cd /opt/sync2 && flock -n /tmp/sync2-bot.lock timeout 58s node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts bot >> logs/bot.log 2>&1
# коэффициент СПП — четверг 07:20 МСК (финотчёт WB: 2 запроса в сутки на аккаунт; finstock — вт/ср 09:00 МСК)
20 4 * * 4 cd /opt/sync2 && timeout 5m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts spp >> logs/spp.log 2>&1
# пул ↔ площадки, записи за сутки и блок «Цены» — 09:10 МСК
10 6 * * * cd /opt/sync2 && timeout 5m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts drift >> logs/drift.log 2>&1
# ретенция журнала writes и снимков (остатков и цен) — 06:17 МСК, под блокировкой тика
17 3 * * * cd /opt/sync2 && flock -w 120 /tmp/sync2.lock timeout 5m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts prune >> logs/prune.log 2>&1
# <<< sync2
```
- [ ] **Step 2: Выкладка держит и блокировку бота** — `deploy/deploy.sh`, строка серверной части:
```bash
ssh "$HOST" "flock -w 600 /tmp/sync2.lock flock -w 120 /tmp/sync2-bot.lock bash -s -- $DIR" <<'REMOTE'
```
и комментарий над ней дополнить: «…и блокировкой бота (`/tmp/sync2-bot.lock`, крон раз в минуту): `npm ci` не меняет `node_modules` под идущим прогоном бота».
- [ ] **Step 3: `.env.example`** — в конец:
```
# Этап 2 — кнопки в группе: Telegram ID двух партнёров через запятую (узнать — /id@KotelnikovArtifactBot в группе).
# Пусто — нажать не сможет никто (вопросы приходят, решить можно только `decide` из терминала).
TELEGRAM_APPROVERS=5710949139
```
- [ ] **Step 4: `deploy/README.md`** — раздел «## Этап 2 — цены» (после раздела этапа 1.4): порядок из задач 23–27 этого плана с командами как есть; «Проверка после выкладки» (`price show | tail -1`, `price-mode` печатает цены `off` у всех, `spp --show`); «Крон» — замена блока `# >>> sync2` … `# <<< sync2` той же идемпотентной командой, что в 1.4 (`sed '/^# >>> sync2/,/^# <<< sync2/d'` + шаблон); «Откат цен» — раздел «Откат» этого плана. `README.md` — в список команд добавить блок `PRICE_USAGE` и одну строку: «Цены — план `docs/superpowers/plans/2026-09-28-sync2-stage-2-ceny.md`».
- [ ] **Step 5: Проверки и коммит.**
```bash
npm run typecheck && npm test && npm run test:db
bash -n deploy/deploy.sh
git add deploy/crontab.sync2.txt deploy/deploy.sh deploy/README.md .env.example README.md
git commit -m "sync2: этап 2 — крон prices/bot/spp, выкладка под блокировкой бота, TELEGRAM_APPROVERS, README"
```

---

### Task 22: Сайт — ветка `feat/internal-prices`: цена витрины от синка

Репозиторий `/Users/minas/projects/kotelnikovartifact`, ветка `feat/internal-prices`. Перед кодом — `AGENTS.md` сайта (Next 16: сверять API с `node_modules/next/dist/docs/`). Прод остаётся на `PRICE_SOURCE=wb` (по умолчанию) — витрина не меняется до Task 26.

**Files:**
- Modify: `lib/env.ts`, `lib/wb/sync/prices.ts`, `lib/wb/sync/products.ts`, `lib/wb/sync/upsert-product.ts`, `scripts/check-stock-source.sh`
- Create: `lib/price-source.ts`, `app/api/internal/prices/route.ts`
- Tests: `tests/unit/lib/price-source.test.ts`, `tests/unit/internal-prices-route.test.ts` (новые); `tests/unit/lib/wb/sync/prices.test.ts`, `tests/unit/lib/wb/sync/products.test.ts`, `tests/unit/lib/wb/sync/upsert-product.test.ts`, `tests/unit/scripts/check-stock-source.test.ts` (дополнить)

- [ ] **Step 1: Падающие тесты.** `tests/unit/lib/price-source.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/client", () => ({ db: {} }))

import { discountPercent, kopecksToNumeric, numericToKopecks } from "@/lib/price-source"

describe("цена витрины от синка — копейки и numeric(10,2)", () => {
  it("копейки ↔ numeric", () => {
    expect(kopecksToNumeric(2063120)).toBe("20631.20")
    expect(kopecksToNumeric(5)).toBe("0.05")
    expect(numericToKopecks("20631.20")).toBe(2063120)
    expect(numericToKopecks("9164")).toBe(916400)
    expect(numericToKopecks("0")).toBe(0)
    expect(numericToKopecks(null)).toBe(0)
  })

  it("скидка от зачёркнутой, %", () => {
    expect(discountPercent(1580000, 689000)).toBe("56.39")
    expect(discountPercent(916400, 916400)).toBe("0.00")
    expect(discountPercent(0, 0)).toBe("0.00")
  })
})
```
`tests/unit/internal-prices-route.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"

const { snapshotMock, upsertMock, revalidateMock } = vi.hoisted(() => ({
  snapshotMock: vi.fn(),
  upsertMock: vi.fn(),
  revalidateMock: vi.fn(async () => undefined),
}))
vi.mock("@/lib/price-source", () => ({
  sitePriceSnapshot: snapshotMock,
  upsertPoolPrices: upsertMock,
}))
vi.mock("@/lib/wb/sync/revalidate", () => ({ revalidate: revalidateMock }))

import { GET, PUT } from "@/app/api/internal/prices/route"

const TOKEN = process.env.INTERNAL_API_TOKEN!
const url = "http://localhost/api/internal/prices"
const get = (auth: string | null = `Bearer ${TOKEN}`) =>
  GET(new Request(url, { headers: auth ? { authorization: auth } : {} }))
const put = (body: unknown) =>
  PUT(
    new Request(url, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    })
  )
const item = { nmId: 259678801, priceKopecks: 1580000, discountedPriceKopecks: 689000 }

afterEach(() => {
  vi.unstubAllEnvs()
  snapshotMock.mockReset()
  upsertMock.mockReset()
  revalidateMock.mockClear()
})

describe("GET /api/internal/prices", () => {
  it("без токена — 401", async () => {
    expect((await get(null)).status).toBe(401)
  })

  it("источник цены и цены всех товаров", async () => {
    snapshotMock.mockResolvedValue([item])
    const res = await get()
    expect(res.headers.get("cache-control")).toBe("no-store")
    await expect(res.json()).resolves.toEqual({ source: "wb", items: [item] })
  })
})

describe("PUT /api/internal/prices", () => {
  it("PRICE_SOURCE=wb — 409: второго писателя цены нет", async () => {
    const res = await put({ items: [item] })
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: "price_source_not_pool", source: "wb" })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it("PRICE_SOURCE=pool — запись, неизвестные nmId списком, ревалидация каталога", async () => {
    vi.stubEnv("PRICE_SOURCE", "pool")
    upsertMock.mockResolvedValue({ updated: 1, unknown: [5] })
    const res = await put({ items: [item, { ...item, nmId: 5 }] })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ updated: 1, unknown: [5], source: "pool" })
    expect(upsertMock).toHaveBeenCalledWith([item, { ...item, nmId: 5 }])
    expect(revalidateMock).toHaveBeenCalledWith("/catalog")
  })

  it("цена со скидкой выше зачёркнутой, дубль nmId, опечатка PRICE_SOURCE — отказ", async () => {
    vi.stubEnv("PRICE_SOURCE", "pool")
    expect((await put({ items: [{ ...item, discountedPriceKopecks: 1580001 }] })).status).toBe(400)
    expect((await put({ items: [item, item] })).status).toBe(400)
    vi.stubEnv("PRICE_SOURCE", "pol")
    expect((await put({ items: [item] })).status).toBe(500)
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
```
В `tests/unit/lib/wb/sync/prices.test.ts`, в `describe("syncPrices"`:
```ts
  it("PRICE_SOURCE=pool — цену пишет синк v2: WB не читается, база не меняется", async () => {
    vi.stubEnv("PRICE_SOURCE", "pool")
    const stats = await syncPrices({ writeMode: "live" })
    vi.unstubAllEnvs()
    expect(listAllPricesMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(stats).toEqual({ processed: 0, updated: 0, errors: 0 })
  })
```
В `tests/unit/lib/wb/sync/products.test.ts` (импорт `import { listAllPrices } from "@/lib/wb/api/prices-client"` — модуль уже замокан в файле):
```ts
  it("PRICE_SOURCE=pool — цены WB не запрашиваются", async () => {
    vi.stubEnv("PRICE_SOURCE", "pool")
    vi.mocked(listAllPrices).mockClear()
    await syncProducts({ writeMode: "live" })
    vi.unstubAllEnvs()
    expect(listAllPrices).not.toHaveBeenCalled()
  })
```
В `tests/unit/lib/wb/sync/upsert-product.test.ts`, в `describe("upsertProduct"`:
```ts
  it("PRICE_SOURCE=pool: цену не пишет — новая карточка с нулём (скрыта каталогом), при конфликте цена не трогается", async () => {
    vi.stubEnv("PRICE_SOURCE", "pool")
    await upsertProduct(
      { nmID: 49, brand: "B", title: "x", rating: 0, sizes: [] } as never,
      {
        writeMode: "live",
        priceData: { nmID: 49, discount: 45, sizes: [{ price: 15800, discountedPrice: 8690 }] } as never,
        totalStocks: 1,
      }
    )
    expect(valuesFor("wbProducts")[0]).toEqual(
      expect.objectContaining({ price: "0", discountedPrice: "0", discount: "0" })
    )
    const set = onConflictSets.find((c) => c.table === "wbProducts")?.set
    expect(set).not.toHaveProperty("price")
    expect(set).not.toHaveProperty("discountedPrice")
    expect(set).not.toHaveProperty("discount")
  })
```
(тест «STOCK_SOURCE=wb … до байта» с порядком ключей `set` остаётся как есть — ветка `wb` не меняется). В `tests/unit/scripts/check-stock-source.test.ts`:
```ts
  it("PRICE_SOURCE: wb, pool, пусто — выкладка идёт; опечатка — отказ с именем переменной", () => {
    for (const text of ["PRICE_SOURCE=pool\n", "PRICE_SOURCE=wb\nSTOCK_SOURCE=pool\n", "PRICE_SOURCE=\n"]) {
      expect(check(text).status).toBe(0)
    }
    const r = check("STOCK_SOURCE=pool\nPRICE_SOURCE=pol\n")
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('PRICE_SOURCE="pol"')
  })
```
Run: `npx vitest run tests/unit/lib/price-source.test.ts tests/unit/internal-prices-route.test.ts tests/unit/lib/wb/sync tests/unit/scripts/check-stock-source.test.ts` → FAIL.

- [ ] **Step 2: Переключатель** — в конец `lib/env.ts`:
```ts
/**
 * Источник цены витрины (синк v2, этап 2):
 * - `wb` — как было: цену пишут синки WB (sync-prices, sync-products) из
 *   discounts-prices WB;
 * - `pool` — цену пишет только sync2 (PUT /api/internal/prices): прайс ×
 *   (1 − СПП), пол и потолок; синки WB цены не читают и не пишут.
 *
 * Как STOCK_SOURCE: не в serverSchema, читается на каждый вызов, опечатка
 * ломает только чтение цены с понятной ошибкой.
 */
export const PRICE_SOURCES = ["wb", "pool"] as const
export type PriceSource = (typeof PRICE_SOURCES)[number]

export function getPriceSource(): PriceSource {
  const raw = process.env.PRICE_SOURCE?.trim() ?? ""
  if (raw === "") return "wb"
  if ((PRICE_SOURCES as readonly string[]).includes(raw)) {
    return raw as PriceSource
  }
  throw new Error(
    `PRICE_SOURCE: "${raw}" — ожидается ${PRICE_SOURCES.join(" | ")}`
  )
}
```

- [ ] **Step 3: Цена от синка** — `lib/price-source.ts`:
```ts
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { wbProducts } from "@/lib/db/schema"

/*
 * Цена витрины от синка v2 (этап 2, PRICE_SOURCE=pool). Синк шлёт копейки по
 * nmId; здесь они ложатся в wb_products.price/discounted_price/discount —
 * те же колонки, что раньше писали синки WB, поэтому каталог, корзина и
 * заказ не меняются.
 */

export type PoolPriceItem = {
  nmId: number
  priceKopecks: number
  discountedPriceKopecks: number
}

/** 2063120 → "20631.20" (numeric(10,2) без плавающей точки). */
export function kopecksToNumeric(kopecks: number): string {
  return `${Math.floor(kopecks / 100)}.${String(kopecks % 100).padStart(2, "0")}`
}

/** "20631.20" → 2063120; пусто или мусор — 0 (товар без цены каталог не показывает). */
export function numericToKopecks(value: string | null): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?/.exec((value ?? "0").trim())
  if (!m) return 0
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"))
}

/** Скидка от зачёркнутой в процентах, два знака: numeric(5,2). */
export function discountPercent(priceKopecks: number, discountedKopecks: number): string {
  if (priceKopecks <= 0 || discountedKopecks >= priceKopecks) return "0.00"
  return (Math.round(((priceKopecks - discountedKopecks) * 10_000) / priceKopecks) / 100).toFixed(2)
}

/** Цены всех товаров сайта в копейках — для сверки и плана в sync2 (GET /api/internal/prices). */
export async function sitePriceSnapshot(): Promise<PoolPriceItem[]> {
  const rows = await db
    .select({
      nmId: wbProducts.nmId,
      price: wbProducts.price,
      discountedPrice: wbProducts.discountedPrice,
    })
    .from(wbProducts)
  return rows.map((r) => ({
    nmId: r.nmId,
    priceKopecks: numericToKopecks(r.price),
    discountedPriceKopecks: numericToKopecks(r.discountedPrice),
  }))
}

/** Абсолютные цены по nmId одной транзакцией; nmId, которого нет в каталоге, — в unknown. */
export async function upsertPoolPrices(
  items: PoolPriceItem[]
): Promise<{ updated: number; unknown: number[] }> {
  return db.transaction(async (tx) => {
    const syncedAt = new Date().toISOString()
    let updated = 0
    const unknown: number[] = []
    for (const item of items) {
      const rows = await tx
        .update(wbProducts)
        .set({
          price: kopecksToNumeric(item.priceKopecks),
          discountedPrice: kopecksToNumeric(item.discountedPriceKopecks),
          discount: discountPercent(item.priceKopecks, item.discountedPriceKopecks),
          syncedAt,
        })
        .where(eq(wbProducts.nmId, item.nmId))
        .returning({ id: wbProducts.id })
      if (rows.length === 0) unknown.push(item.nmId)
      else updated++
    }
    return { updated, unknown }
  })
}
```

- [ ] **Step 4: Служебный API** — `app/api/internal/prices/route.ts`:
```ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { getPriceSource, type PriceSource } from "@/lib/env"
import { requireInternalAuth } from "@/lib/internal-auth"
import { sitePriceSnapshot, upsertPoolPrices } from "@/lib/price-source"
import { revalidate } from "@/lib/wb/sync/revalidate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store" }
/** Позиций в одном PUT — sync2 режет запись на пачки этого размера (SITE_PRICES_PUT_MAX). */
const PUT_MAX_ITEMS = 5000
const MAX_ISSUES_IN_RESPONSE = 20
const kopecks = z.number().int().positive().max(9_999_999_999)

const putSchema = z.object({
  items: z
    .array(
      z
        .object({
          nmId: z.number().int().positive(),
          priceKopecks: kopecks,
          discountedPriceKopecks: kopecks,
        })
        .refine((i) => i.discountedPriceKopecks <= i.priceKopecks, {
          message: "discountedPriceKopecks больше priceKopecks",
        })
    )
    .min(1)
    .max(PUT_MAX_ITEMS),
})

function duplicates(ids: number[]): number[] {
  const seen = new Set<number>()
  const dup = new Set<number>()
  for (const id of ids) {
    if (seen.has(id)) dup.add(id)
    seen.add(id)
  }
  return [...dup]
}

/** Цены всех товаров сайта (копейки) и откуда витрина их сейчас берёт. */
export async function GET(req: Request) {
  const denied = requireInternalAuth(req)
  if (denied) return denied
  try {
    const source = getPriceSource()
    const items = await sitePriceSnapshot()
    return NextResponse.json({ source, items }, { headers: NO_STORE })
  } catch (err) {
    console.error("internal prices snapshot failed", err)
    return NextResponse.json(
      { error: "db_error" },
      { status: 500, headers: NO_STORE }
    )
  }
}

/**
 * Абсолютные цены от sync2 — только при PRICE_SOURCE=pool: в wb цену пишут
 * синки WB, и второй писатель перетёр бы её (409). Повтор безопасен.
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
    const { issues } = parsed.error
    return NextResponse.json(
      {
        error: "validation",
        issues: issues.slice(0, MAX_ISSUES_IN_RESPONSE),
        issuesTotal: issues.length,
      },
      { status: 400, headers: NO_STORE }
    )
  }
  const items = parsed.data.items
  const dup = duplicates(items.map((i) => i.nmId))
  if (dup.length > 0) {
    return NextResponse.json(
      { error: "duplicate_nm_ids", nmIds: dup.slice(0, MAX_ISSUES_IN_RESPONSE) },
      { status: 400, headers: NO_STORE }
    )
  }

  let source: PriceSource
  try {
    source = getPriceSource()
  } catch (err) {
    console.error("internal prices: PRICE_SOURCE", err)
    return NextResponse.json(
      { error: "config_error" },
      { status: 500, headers: NO_STORE }
    )
  }
  if (source !== "pool") {
    return NextResponse.json(
      { error: "price_source_not_pool", source },
      { status: 409, headers: NO_STORE }
    )
  }

  let result: Awaited<ReturnType<typeof upsertPoolPrices>>
  try {
    result = await upsertPoolPrices(items)
  } catch (err) {
    console.error("internal prices upsert failed", err)
    return NextResponse.json(
      { error: "db_error" },
      { status: 500, headers: NO_STORE }
    )
  }
  if (result.updated > 0) await revalidate("/catalog")
  return NextResponse.json(
    { updated: result.updated, unknown: result.unknown, source },
    { headers: NO_STORE }
  )
}
```

- [ ] **Step 5: Синки WB в `pool` цену не трогают.** `lib/wb/sync/prices.ts`: импорт `import { getPriceSource } from "@/lib/env"`; сразу после `logger.info({ event: "sync.prices.start", … })`:
```ts
  // PRICE_SOURCE=pool: цену витрины пишет sync2 (PUT /api/internal/prices).
  // WB не читаем вовсе — окно лимита «Цены и скидки» общее на аккаунт, его
  // тратит сторож цен синка.
  if (getPriceSource() === "pool") {
    logger.info(
      { event: "sync.prices.skip", reason: "PRICE_SOURCE=pool" },
      "Prices come from sync v2"
    )
    return stats
  }
```
`lib/wb/sync/products.ts`: импорт `getPriceSource` из `@/lib/env`; строку `const prices = await listAllPrices()` заменить на:
```ts
  // PRICE_SOURCE=pool — цены WB не нужны (их не пишет upsertProduct) и не
  // запрашиваются: окно лимита «Цены и скидки» общее с сторожем цен sync2.
  const prices = getPriceSource() === "pool" ? [] : await listAllPrices()
```
`lib/wb/sync/upsert-product.ts`: импорт `import { getPriceSource, getStockSource } from "@/lib/env"`; после блока `aggregates`:
```ts
  // PRICE_SOURCE (lib/env.ts): в wb цену пишет этот синк, как раньше; в pool —
  // только sync2 через PUT /api/internal/prices. Новая карточка в pool входит с
  // ценой 0 — каталог её не показывает (discounted_price > 0), пока синк не
  // пришлёт цену.
  const pricesFromWb = getPriceSource() === "wb"
  const prices = pricesFromWb
    ? {
        price: String(price),
        discountedPrice: String(discountedPrice),
        discount: String(discount),
      }
    : { price: "0", discountedPrice: "0", discount: "0" }
```
в `.values({ … })` три строки `price: …, discountedPrice: …, discount: …` заменить на `...prices,`; в `set` `onConflictDoUpdate` три строки `price: sql\`excluded.price\`, …` заменить (на том же месте — порядок ключей ветки `wb` не меняется) на:
```ts
        ...(pricesFromWb
          ? {
              price: sql`excluded.price`,
              discountedPrice: sql`excluded.discounted_price`,
              discount: sql`excluded.discount`,
            }
          : {}),
```

- [ ] **Step 6: Проверка переключателей в выкладке** — `scripts/check-stock-source.sh` целиком:
```bash
#!/usr/bin/env bash
# Проверка переключателей витрины в .env до сборки (синк v2): STOCK_SOURCE (этап 1.4)
# и PRICE_SOURCE (этап 2). Опечатка роняет чтение остатка или цены на каждой странице
# витрины (lib/env.ts) — ловим её до `npm run build` и `pm2 reload`: прод остаётся на
# прежней версии.
#
# .env разбирается тем же dotenv, которым его читают витрина и воркеры: свой разбор
# на grep/sed расходился бы с ним в краях (кавычки с `#`, пробел внутри значения,
# форма `KEY: value`). dotenv берётся из node_modules текущего каталога: в deploy.sh
# проверка идёт до `npm ci`, то есть на прежних node_modules — это допустимо.
# Нет файла или переменной — витрина берёт `wb` по умолчанию, выкладка идёт.
# Использование: bash scripts/check-stock-source.sh [путь к .env]
set -euo pipefail
env_file="${1:-.env}"

if [ ! -e "$env_file" ]; then
  echo "==> $env_file нет — STOCK_SOURCE=wb (по умолчанию)"
  echo "==> $env_file нет — PRICE_SOURCE=wb (по умолчанию)"
  exit 0
fi

# Значение переменной $1 как есть, после trim — ровно как его видят getStockSource()/getPriceSource().
read_var() {
  node -e '
const fs = require("fs")
let dotenv
try {
  dotenv = require(require.resolve("dotenv", { paths: [process.cwd()] }))
} catch {
  console.error(`==> Нет node_modules/dotenv в ${process.cwd()} — нечем разобрать .env`)
  process.exit(2)
}
const value = dotenv.parse(fs.readFileSync(process.argv[1]))[process.argv[2]]
process.stdout.write((value ?? "").trim())
' "$env_file" "$1"
}

for name in STOCK_SOURCE PRICE_SOURCE; do
  if ! value=$(read_var "$name"); then
    echo "==> Не удалось проверить $name в $env_file (dotenv). Выкладка остановлена." >&2
    exit 1
  fi
  case "$value" in
    "" | wb | pool)
      echo "==> $name=${value:-wb (по умолчанию)}"
      ;;
    *)
      echo "==> $name=\"$value\" в $env_file — ожидается wb | pool. Выкладка остановлена." >&2
      exit 1
      ;;
  esac
done
```

- [ ] **Step 7: Проверки и коммит.**
```bash
npx prettier --write lib/env.ts lib/price-source.ts app/api/internal/prices/route.ts lib/wb/sync/prices.ts lib/wb/sync/products.ts lib/wb/sync/upsert-product.ts tests/unit/lib/price-source.test.ts tests/unit/internal-prices-route.test.ts tests/unit/lib/wb/sync/prices.test.ts tests/unit/lib/wb/sync/products.test.ts tests/unit/lib/wb/sync/upsert-product.test.ts tests/unit/scripts/check-stock-source.test.ts
npm run lint && npm run typecheck && npm test
git add lib/env.ts lib/price-source.ts app/api/internal/prices/route.ts lib/wb/sync/prices.ts lib/wb/sync/products.ts lib/wb/sync/upsert-product.ts scripts/check-stock-source.sh tests/unit/lib/price-source.test.ts tests/unit/internal-prices-route.test.ts tests/unit/lib/wb/sync/prices.test.ts tests/unit/lib/wb/sync/products.test.ts tests/unit/lib/wb/sync/upsert-product.test.ts tests/unit/scripts/check-stock-source.test.ts
git commit -m "feat(price-source): цена витрины от синка v2 — PRICE_SOURCE, служебный GET/PUT /api/internal/prices, синки WB в pool цену не читают и не пишут"
```
Ветка не пушится до Task 26.

---

## Запись на площадки (этап 2)

Перед каждым шагом с пометкой **[«да»]** — показать владельцу команду и что она изменит, дождаться явного «да». Токены не печатаются. Не выполнять в минуты кронов `sync2` (`1,6,…,56` — тик, `3,33` — цены). Везде ниже `T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"` в `/opt/sync2`. **Предусловие:** шаг B этапа 1.4 выполнен и принят (старый синк `orders/stocks/reconcile` закомментирован, `compare-v1` снят).

### Task 23: Выкладка `sync2` — режимы цен `off`, прайс в базе

- [ ] **Step 1 [«да»]: слияние и выкладка** (после ревью `superpowers:requesting-code-review`):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git merge --no-ff sync2-stage-2 -m "sync2: этап 2 — цены"
cd sync2 && npm run typecheck && npm test && npm run test:db && npm run deploy
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T price-mode wb off; $T spp --show; $T runs 3'
```
Expected: миграция 0004 применена; `price-mode` печатает `цены off` у всех пяти, остатки — как после шага B; `spp --show` — «не посчитан»; тики `ok`.
Откат: прежний `main` → `npm run deploy` (миграцию 0004 не откатывать — новые колонки со значениями по умолчанию, старый код их не читает).

- [ ] **Step 2 [«да»]: `.env` — одобряющие** (пока только Минас; ID партнёра — после Step 2 Task 24):
```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
cp .env logs/.env.bak-2
grep -q '^TELEGRAM_APPROVERS=' .env || echo 'TELEGRAM_APPROVERS=5710949139' >> .env
grep -E '^(TELEGRAM_APPROVERS|SYNC_WRITE_MODE)=' .env
REMOTE
```

- [ ] **Step 3 [«да»]: импорт прайса.**
```bash
scp /Users/minas/projects/sai_kotelnikovartifact/data/prices/agreed-2026-09-26.csv root@147.45.171.40:/opt/sync2/logs/
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T price import logs/agreed-2026-09-26.csv; echo "код $?"'
```
Expected: «в файле 78, новых 78, уже записано 0, расходится с записанным 0», код 2 (предпросмотр). После «да»:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T price import logs/agreed-2026-09-26.csv --confirm && $T price show | tail -1'
```
Expected: «записано 78, без изменений 0, конфликтов 0»; «позиций: 78; k СПП: не посчитан».

### Task 24: Первый сторож, разбор вопросов, бот и коэффициент СПП

- [ ] **Step 1 [«да»]: первый прогон `prices` руками** (цены всех площадок `off` — только сторож WB):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock -w 240 /tmp/sync2.lock $T prices; $T runs 1; $T decisions | tail -25'
```
Expected: `prices ok|partial`, `wbWatched` ≈ 382, `wbDrift` ≈ 59, `wbNewWithoutPrice` ≈ 7, `decisionsOpened` ≈ 66 (факт 28.09); вопросы в базе, **в группу не ушли** (бота в кроне ещё нет). `wbRateLimited` — окно цен WB заняли сайт или старый синк: повторить через 15 минут.

- [ ] **Step 2 [«да» на каждую команду]: разбор первых вопросов из терминала** — по ответу владельца на открытый вопрос 6: список `$T decisions` владельцу; пачкой — `$T decide all-drift autoaction` (предпросмотр) → `--confirm`; отдельные — `$T decide <id> accept --confirm`; «без прайса» — `$T decide <id> accept --confirm` по каждому. Следующий `prices` исполнит ответы (прайс меняется только у «принять»).

- [ ] **Step 3 [«да»]: крон этапа 2** (бот, цены, СПП; блок заменяется целиком, как в 1.4):
```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
crontab -l > logs/crontab.before-2.txt
{ sed '/^# >>> sync2/,/^# <<< sync2/d' logs/crontab.before-2.txt; cat deploy/crontab.sync2.txt; } | crontab -
test "$(crontab -l | grep -c '^# >>> sync2')" = 1
crontab -l | grep -E 'cli.ts (tick|prices|bot|spp|drift|prune)'
REMOTE
```
Expected: шесть строк `sync2`; строки старого синка не тронуты. Откат: `ssh root@147.45.171.40 'crontab /opt/sync2/logs/crontab.before-2.txt'`.
Через 2–3 минуты: в группе — оставшиеся открытые вопросы (не больше 10 в минуту) с двумя кнопками (цены WB не в `apply` — «вернуть» не показывается); `tail logs/bot.log` — без `сбой`.

- [ ] **Step 4: ID партнёра.** Партнёр пишет в группе `/id@KotelnikovArtifactBot` → бот отвечает «Ваш Telegram ID: …». **[«да»]** дописать в `.env`: `sed -i 's/^TELEGRAM_APPROVERS=.*/TELEGRAM_APPROVERS=5710949139,<ID партнёра>/' /opt/sync2/.env` (следующий минутный прогон бота читает `.env` заново). Проверка: партнёр нажимает кнопку на одном вопросе → под сообщением «Решено: <имя>, <время> МСК — …», через ≤ 30 мин — «Итог: …».

- [ ] **Step 5 [«да»]: первый коэффициент СПП** — не во вторник/среду 06:00–07:00 UTC (окно finstock) и не повторно в тот же день:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T spp; $T spp --show'
```
Expected: `ok`, «продаж N» (N ≥ 10), медиана и действующий k (bp). `rateLimited` — суточный лимит финотчёта уже израсходован (finstock): повтор завтра.

### Task 25: Приёмка в `dry-run` — трое суток

- [ ] **Step 1 [«да»]: зеркала в `dry-run`, WB — `dry-run`** (записи нет, план — в журнале):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; for c in wb ozon ym kit site; do $T price-mode $c dry-run; done'
```
- [ ] **Step 2: ежедневно** — `$T runs 20 | grep prices`, `$T price-plan ozon|ym|kit|site`, `$T decisions`, сводка `drift` в 09:10 МСК (блок «Цены»). Сверить план Ozon/ЯМ с предпросмотром старого синка (`/opt/sellerai-sync/reports/reprice-2026-09-28.csv`, колонки `Ozon_стало`/`ЯМ_стало`): при том же прайсе цели совпадают до округления; расхождения — объяснить (живая ставка Ozon, доставка ЯМ).
- [ ] **Step 3: критерии приёмки** (итог — в «Ход выполнения» этого плана): `prices` без `failed`; `pricesAborted` нет; каждый `…PriceCapped` объяснён; `…PricesFailed` — только разовые; `skip_no-rates` — только «Шармы-подвески»/«Часы наручные» (или закрыто ответом на вопрос 3); `skip_no-delivery-*` — закрыто ответом на вопрос 2 и правкой `config/pricing.json` (выкладка — Task 23 Step 1); кнопки нажали оба партнёра; владелец посмотрел план каждой площадки и сказал «да» на Task 26–27.

### Task 26: Сайт — PR, выкладка, переключение цены витрины

- [ ] **Step 1 [«да»]: PR сайта** (после ревью):
```bash
cd /Users/minas/projects/kotelnikovartifact
git push -u origin feat/internal-prices
gh pr create --repo webkoth/kotelnikovartifact-store --base main --head feat/internal-prices \
  --title "Цена витрины от синка v2: PRICE_SOURCE, служебный GET/PUT /api/internal/prices (этап 2)" \
  --body "PRICE_SOURCE=wb|pool; в pool цену пишет только sync2 (PUT /api/internal/prices, 409 в wb), sync-prices и sync-products цены WB не читают и не пишут; проверка PRICE_SOURCE в выкладке. На проде остаётся PRICE_SOURCE=wb — витрина не меняется. План: sai_kotelnikovartifact/docs/superpowers/plans/2026-09-28-sync2-stage-2-ceny.md"
gh pr checks --watch --repo webkoth/kotelnikovartifact-store
```
- [ ] **Step 2 [СТОП — «да» владельца на merge]: слияние = выкладка сайта.**
```bash
gh pr merge --merge --repo webkoth/kotelnikovartifact-store feat/internal-prices
gh run watch --repo webkoth/kotelnikovartifact-store $(gh run list --repo webkoth/kotelnikovartifact-store --branch main --limit 1 --json databaseId -q '.[0].databaseId')
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock -w 240 /tmp/sync2.lock $T prices; $T runs 1'
```
Expected: в логе выкладки `==> STOCK_SOURCE=pool`, `==> PRICE_SOURCE=wb (по умолчанию)`, `Deploy complete`; `prices` — `sitePricesRead` ≈ 421, `sitePricePlanned` ≈ 78 (`dry-run`).
- [ ] **Step 3 [«да»]: витрина на цене синка** — сразу после прогона `prices` в :03/:33:
```bash
ssh root@201.34.133.76 'bash -s' <<'REMOTE'
set -euo pipefail
cd /var/www/kotelnika-store
cp .env .env.bak-prices
grep -q '^PRICE_SOURCE=' .env && sed -i 's/^PRICE_SOURCE=.*/PRICE_SOURCE=pool/' .env || echo 'PRICE_SOURCE=pool' >> .env
bash scripts/check-stock-source.sh .env
pm2 reload ecosystem.config.cjs --update-env
REMOTE
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock -w 240 /tmp/sync2.lock $T prices && $T price-mode site apply --confirm && flock -w 240 /tmp/sync2.lock $T prices; $T price-plan site | head -5'
```
Expected: `==> PRICE_SOURCE=pool`; `price-mode` печатает план сайта и `site … цены apply`; второй `prices` — `sitePriceApplied` ≈ 78; `price-plan site` — «применено». Проверка глазами: карточка браслета `2041383032873` на kotelnikovartifact.ru — цена = прайс × (1 − k) по ₽…90 (при k 25 % — 6 890 ₽), зачёркнутая 15 800 ₽. Откат — раздел «Откат», вариант «Сайт».

### Task 27: Зеркала в `apply` по одному — KIT, Ozon, ЯМ; WB «вернуть» — по решению владельца

Для каждой площадки `<c>` в порядке `kit` → `ozon` → `ym` (каждая — отдельное «да», сразу после прогона `prices` в :03/:33, чтобы до следующего было 25 минут на проверку):
- [ ] **Step 1 [«да»]:** `flock -w 240 /tmp/sync2.lock $T prices && $T price-mode <c> apply --confirm` (печатает план `<c>`, отказывает при старом прогоне, пределе, капе).
- [ ] **Step 2 [«да»]: одна карточка** — `flock -w 240 /tmp/sync2.lock $T prices --only=259678801 && $T price-plan <c>`; проверить в ЛК площадки цену, зачёркнутую, у Ozon — минимальную цену и выключенные автоакции. Не так — `$T price-mode <c> dry-run` до следующего прогона (вариант «Зеркало» отката).
- [ ] **Step 3:** следующий прогон крона пишет остальные; через 30 мин — `…PriceNotHeld` нет; сутки — `drift`, блок «Цены»: ошибок 0.
- [ ] **Step 4 [«да», по решению владельца]: кнопка «вернуть»** — `$T price-mode wb apply --confirm`: с этого прогона бот показывает третью кнопку; запись WB — только по нажатию, одна загрузка на окно 15 мин.

---

## Откат

Каждый вариант — одно «да» владельца. Команды — также в `sync2/deploy/README.md`, «Откат этапа 2».

**Зеркало** (Ozon, ЯМ или KIT перестаёт получать цены от синка; цены на площадке остаются последними записанными):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && flock -w 240 /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts price-mode <c> dry-run'
```
Вернуть цены «как было до синка» — по журналу (`before` первой применённой записи каждой позиции) и с «да» владельца на каждую площадку:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && set -a && . ./.env && set +a && psql "$DATABASE_URL" -X -A -F "	" -c "select distinct on (w.barcode) w.barcode, w.external_sku, w.before, w.after, w.detail, w.created_at from writes w join channels c on c.id = w.channel_id where c.code = '"'"'<c>'"'"' and w.field = '"'"'price'"'"' and w.mode = '"'"'apply'"'"' and w.applied order by w.barcode, w.created_at"'
```
— прежняя цена в `before`; запись обратно — вручную в ЛК или разовой командой по отдельному «да».

**Сайт** (витрина снова берёт цену с WB):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && flock -w 240 /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts price-mode site dry-run'
ssh root@201.34.133.76 'bash -s' <<'REMOTE'
set -euo pipefail
cd /var/www/kotelnika-store
sed -i 's/^PRICE_SOURCE=.*/PRICE_SOURCE=wb/' .env
bash scripts/check-stock-source.sh .env
pm2 reload ecosystem.config.cjs --update-env
npm run wb:sync:prices
REMOTE
```

**Кнопки** (бот молчит, вопросы копятся в базе): закомментировать строку `cli.ts bot` в кроне. **Сторож и все цены:** закомментировать строку `cli.ts prices`; режимы цен — `off`. **Код этапа 2:** прежний `main` → `npm run deploy`, крон — `crontab /opt/sync2/logs/crontab.before-2.txt`; миграцию 0004 не откатывать.

---

## Готово, когда

- `sync2` этапа 2 в `main`, выложен; крон: `tick`, `prices` (3,33), `bot` (каждую минуту), `spp` (чт 04:20 UTC), `drift`, `prune`; все тесты зелёные (`sync2`: `typecheck`, `test`, `test:db`; сайт: `lint`, `typecheck`, `test`).
- Прайс 78 позиций в базе с историей; первые вопросы сторожа разобраны; вопросы приходят в группу, нажимают только два партнёра, под сообщением — кто, когда и итог.
- Коэффициент СПП посчитан, `spp --show` — история.
- Сайт на `PRICE_SOURCE=pool`, цены сайта от синка; KIT, Ozon, ЯМ — `apply` цен; сутки без `…PriceFailed`, `…PriceNotHeld`, `pricesAborted`; WB — по решению владельца (`apply` для кнопки «вернуть» или `dry-run`).
- Откат — в `sync2/deploy/README.md`.

## Самопроверка по спеке

| Спека / решение | Где покрыто |
|---|---|
| §2 п. 8, решение п. 8: якорь — прайс, дрейф WB не копируется, «принять / автоакция» | Task 5 (сторож), Task 17 (решения, прайс только кнопкой/CLI), Task 19 (кнопки) |
| §2 п. 9, решение п. 9: Ozon, ЯМ — равное нетто; ЯМ + доставка 5 % ≤ 1 000 ₽ | Task 2 (`mirrorPrices`, `ymPriceForNet`) |
| §2 п. 10, решение п. 10: KIT/сайт = прайс × (1 − k), k — медиана СПП за 30 дней, раз в неделю, 3 п.п., пол нетто WB + доставка, потолок прайс | Task 3, Task 6, Task 11 (`spp` из финотчёта), Task 18, Task 21 (крон чт) |
| решение п. 11: скидки площадок нетто не меняют | цель Ozon — `price` продавца, не `marketing_seller_price` (Task 12); `promotion_price` KIT не наша (Task 14) |
| §2 п. 14, решение п. 14: ЯМ `minimumForBestseller` никогда | Task 13 (сериализатор + тест) |
| §2 п. 15, решение п. 15: кнопки в группе, двое партнёров, видно кто решил, без ответа ничего, напоминание 24 ч | Task 19, Task 9 (`decisionsToRemind`), `.env` `TELEGRAM_APPROVERS` (Task 21, 23–24) |
| §4 таблицы `agreed_prices` + история, `decisions` (частичный уникальный), `spp_coefficients`, `writes` было → стало | Task 7–9 (`price_targets` заменён журналом — отступление) |
| §6 прайс: стартовое наполнение, правка только кнопкой или `price set … --reason` | Task 8, Task 20, Task 23 (прайс 26.09 — отступление) |
| §6 сторож раз в 30 мин в пределах лимита цен, > 1 %, повторно не спрашивать | Task 5, Task 9 (`takeSlot`), Task 17, Task 21 |
| §6 расчёт: перенос `computeTarget`/`fitBase`/₽…90 в копейки | Task 1–3 |
| §6 запись: Ozon `price/old_price/min_price` + флаг + автоакции DISABLED; ЯМ бизнес-уровень с `discountBase`; KIT `prices/bulk_update`; сайт служебный API; анти-флаппинг 2 %, кап 60 %, abort > 400, проверка перечитыванием не раньше 3 мин | Task 4, 12–15, 17 (`VERIFY_MIN_AGE_MS`, `maxChanges`) |
| §6 коэффициент СПП: `sales-reports/detailed` (2 запроса/сутки), медиана `spp` по выкупам, < 10 — без изменений | Task 6, 11, 18 |
| §3 запись только через выключатель; лимиты по спецификации, без слепых повторов 429 | `executeWrites` + `price_write_mode` (Task 7, 17), `retryDelaysMs: []` у WB и финотчёта (Task 11), окно лимита в `sync_state` |
| §9 приём нажатий — long polling `getUpdates`, только из `TELEGRAM_APPROVERS`, «решено: кто, когда» | Task 19 (крон раз в минуту — отступление) |
| §10 журнал `writes`, `runs` со счётчиками, контрактные тесты | Task 7, 11–15, 17 |
| §11 этап 2: «отключить чтение цен WB на сайте» | Task 22 (`PRICE_SOURCE=pool`: `sync-prices`, `sync-products` WB-цены не читают), Task 26 |
| Решение: «План Ц в finstock — только экран, читает прайс синка» | прайс в `agreed_prices` (Task 7–8); экран — в плане finstock |
| §7 граница: шаблон WB, `ozon-guard`, «Хочу скидку» | вне плана (этап 3); `concession_bp` уже хранится |

## Открытые вопросы к владельцу

1. **Telegram ID партнёра** для `TELEGRAM_APPROVERS` (в группе трое: бот, Минас `5710949139`, партнёр — его ID нигде не записан). Рекомендация: после Task 24 Step 3 партнёр пишет в группе `/id@KotelnikovArtifactBot`, ID — в `.env` (Task 24 Step 4).
2. **Доставка на KIT и сайте для пола «нетто WB + доставка»** — сколько рублей на заказ закладывать (KIT обещает бесплатную доставку). До ответа KIT и сайт не считаются (`skip_no-delivery-*`). Рекомендация: средняя фактическая стоимость отправки за последние заказы; если её нет — 500 ₽ на оба как осторожная оценка, пересмотр через месяц.
3. **Ставки Ozon/ЯМ для «Шармы-подвески» (1 товар) и «Часы наручные» (1 товар)** — в модели v2 их нет. Рекомендация: шармы — как «Подвески бижутерные» (Ozon 0,55, ЯМ 0,551); часы — не зеркалить цену на Ozon/ЯМ до живой ставки (Ozon возьмёт живую ставку товара сам, если он там есть).
4. **Зачёркнутая цена на KIT и сайте = единая база** (как `old_price` Ozon и `discountBase` ЯМ; для браслета — 15 800 ₽ при цене 6 890 ₽) — да/нет? Рекомендация: да — та же зачёркнутая, что сейчас показывает сайт (он копирует цену до скидки WB), и одна на всех площадках.
5. **Округление ₽…90 вверх на KIT и сайте** (потолок — прайс) — да/нет? Рекомендация: да — как на Ozon/ЯМ с июля; излишек до 99 ₽ уходит в нетто.
6. **Первые ≈ 66 вопросов** (59 цен WB ниже/выше прайса, медиана −5,4 %, и 7 товаров без прайса; факт 28.09). Рекомендация: до включения бота (Task 24 Step 2) разобрать из терминала: всё в пределах уступки −10 % — `decide all-drift autoaction` (это автоакции после снятия блокировки 26.09); −16,7 % и +47,4 % — по одному; 7 товаров без прайса — `accept` (их цена WB становится прайсом).
7. **Срок 26.10: истекают минимальные цены WB (шаблон 26.09) и флаг Ozon (81/81).** Этап 2 при выкладке после шага B (~01–02.10) и трёх сутках приёмки даёт боевые цены ≈ 08–10.10; этап 3 (шаблон, `ozon-guard`, «Хочу скидку») после него — план + код + приёмка ≈ 7–10 дней, то есть впритык к 24.10. Рекомендация: не гнать этап 3 под срок — 20.10 продлить вручную старыми средствами (`node sync/scripts/ozon-min-price-flag.mjs --apply` и шаблон WB −10 % через ЛК, по образцу 26.09) с предпросмотром и «да»; если этап 3 принят раньше 20.10 — продлевает он. Задача в business-os к 20.10.
8. **Промокоды и акции KIT** («−15 % за подписку», `ПЕРВЫЙЗАКАЗ` 3 %) опускают цену покупателя ниже пола «нетто WB + доставка». Рекомендация: пол промо не учитывает — промо осознанный маркетинг KIT; если нужно, чтобы с промо нетто не падало ниже WB, — поднять доставку в `config/pricing.json` на размер скидки.
9. **«Звёздные товары» Ozon (1,5 % с оборота)** в ставку Ozon не заложены (решение по ним с июля не принято). Рекомендация: проверить в ЛК Ozon (Продвижение → Механики лояльности); если программа включена — +0,015 к `take_ozon` в `config/pricing.json` (иначе нетто Ozon на 1,5 % ниже WB).
10. **Цена WB выше цены на других площадках отключает софинансирование СПП** (вторичные источники, исследование 26.09). По формуле цена KIT/сайта ≈ цена покупателя WB, Ozon/ЯМ — выше цены продавца WB; отдельного правила «WB ≤ остальных» план не вводит. Рекомендация: не вводить до подтверждения первоисточником; смотреть недельную медиану СПП в `spp --show` — резкое падение k — сигнал.

## Решения владельца (28.09.2026) — обязательны для исполнителей

Владелец согласился со всеми рекомендациями по открытым вопросам:
1. ID партнёра — через `/id@KotelnikovArtifactBot` в группе на Task 24.
2. Доставка KIT и сайта — средняя фактическая; пока её нет — **500 ₽ на оба** в `config/pricing.json` (пересмотр через месяц). KIT и сайт считаются с этим значением.
3. Шармы — как «Подвески бижутерные»; часы — цену на Ozon/ЯМ не зеркалить до живой ставки.
4. Зачёркнутая на KIT и сайте = единая база — да.
5. Округление ₽…90 вверх на KIT и сайте — да.
6. Первые вопросы — разобрать из терминала до включения бота по рекомендации.
7. Срок 26.10 — продлить вручную 20.10 старыми средствами с предпросмотром; этап 3 под срок не гнать.
8. Пол промо KIT не учитывает.
9. «Звёздные товары» Ozon — проверить в ЛК; до проверки ставка без них (+0,015 не добавляется).
10. Правило «WB ≤ остальных» не вводить; следить за k.
