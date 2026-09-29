# Синк v2 · этап 4 — карточки: создание на зеркалах, правки с подтверждением, KIT без, видео, разведение размеров

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Карточка WB становится единственным местом, где владелец правит контент; вручную на зеркалах не заводится ничего (решение владельца 29.09, п. 5). Джоба `cards` раз в час читает карточки WB, хранит версии контента и: (1) **создаёт** недостающие карточки на Ozon, ЯМ и KIT для товаров в наличии — автоматически для всех замапленных предметов, включая серьги, часы и карточки с «серебром 925» (решение 29.09, п. 1); отказ модерации (в т.ч. запрос УИН ГИИС ДМДК) — вопрос в Telegram с текстом отказа, карточка не пересоздаётся; (2) **правки** контента WB переносит на KIT сразу, а на Ozon и ЯМ — вопросом «было → станет» с кнопками (бот этапа 2), включая габариты Ozon; (3) **видео** WB (HLS) собирает в mp4 на VPS (ffmpeg), публикует постоянной ссылкой `https://kotelnikovartifact.ru/video/…mp4` и прикрепляет на Ozon, ЯМ и KIT — видео не задерживает создание и догружается следующим прогоном; (4) **многоразмерные** карточки разводит на варианты Ozon/ЯМ вопросом, существующий оффер с продажами остаётся. Темп: первый прогон — одна карточка на площадку, дальше все недостающие разом (потолок 40 на площадку за прогон, у Ozon — суточный лимит). Всё — через `executeWrites`, журнал `writes` и режим записи карточек `channels.card_write_mode` (по умолчанию `off`); синк никогда не удаляет и не архивирует карточки.

**Architecture:** Домен (`packages/domain/src`): `card-content.ts` (канон и хеш контента WB, включая ссылку на видео; санитайзер FB_ORIGINAL/CJK; диф полей для людей), `card-route.ts` (категории WB → Ozon/ЯМ/KIT из `config/card-categories.json`, разбор «Оберегов» по названию), `card-plan.ts` (создания, правки, базовая линия, пропуски с причинами, разведение размеров). База: миграция 0008 — `channels.card_write_mode`, `writes.field` += `card_create`, `card_content`, `card_video`, `listings` (+ `nm_id`, `seen_at`, `last_error`, `created_run_id`, CHECK статуса), новые `wb_cards`, `wb_card_versions`, `wb_card_videos`; миграция 0009 — виды вопросов `card_edit`, `card_rejected` и ответы `apply_edit`, `skip_edit`, `ack`. Площадки: WB — полный контент `content/v2/get/cards/list`; Ozon — `v3/product/list` (ключи с архивом), `v4/product/info/attributes` (видео, основа переимпорта), `v3/product/info/list` (модерация), `v1/description-category/attribute/values/search`, `v3/product/import` + `v1/product/import/info`, `v1/product/attributes/update` (в т.ч. видео — complex_id 100001), `v1/product/pictures/import`, `v4/product/info/limit`; ЯМ — `offer-mappings` (с архивом, видео), `offer-mappings/update`, `offer-cards` (модерация), `tariffs/calculate` (живая ставка предметов без ставки), первый остаток `PUT offers/stocks`; KIT — `v1/characteristics`, `v1/files`, `v1/videos/from_url`, `v1/products`, `v1/variants`. Воркер: видео (`video/hls.ts` — ffmpeg/ffprobe, `video/publish.ts` — rsync на сервер сайта под `rrsync`), джоба `cards` (крон :19), отправитель карточек, вопросы `card_edit`/`card_rejected` в боте, живая ставка ЯМ в джобе `prices` этапа 2, CLI `cards run|plan|diff|baseline|retry`, `card-mode`, блок «🗂 Карточки» в сводке `drift`.

**Tech Stack:** как в 1.1–3: TypeScript strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`), Vitest 4 (проекты `unit`/`db`), Drizzle 0.45 + postgres.js, `tsx`, pino; `node:crypto` (sha256 — в домене, чистая функция), глобальные `fetch`/`FormData`/`Blob` Node 22 (фото в KIT), `node:child_process` `execFile` — `ffmpeg`/`ffprobe` (пакет Ubuntu `ffmpeg` 6.1.1 на VPS ставится при выкладке) и `rsync` 3.2.7 (есть на VPS; на сервере сайта — `rrsync`). Новых npm-зависимостей нет.

**Спека:** `docs/superpowers/specs/2026-09-25-sync-v2-design.md` §2 п. 16–17, §4 (`listings`: `offer_id`, статус карточки, хеш контента), §8 (карточки), §9 (Telegram), §11 этап 4 «создание, правки с подтверждением, KIT без». **Решение владельца:** `business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md` — п. 16 (создание автоматически, только в наличии; незамапленная категория — стоп и алерт), п. 17 (Ozon/ЯМ — «было → станет», KIT — без подтверждения, сайт берёт контент сам), п. 18 (развести размеры на варианты Ozon/ЯМ), п. 15 (кнопки — двое партнёров), **п. 21 и раздел «Решения владельца (29.09.2026)» в конце плана** (серебро 925 выкладывается везде — решение 17.09 отменено; видео переносится; габариты Ozon — из WB и вопросом; темп; ничего вручную — серьги и часы через API; шармы на Ozon — «Подвеска»). **Исходники:** старый синк `sync/src/cards-ozon.ts`, `cards-ym.ts`, `commands/cards.ts` (OFF с 19.07), рабочий конвейер нового кабинета Ozon `data/ozon-import/02-transform.py` (18.07, 64/64 прошли модерацию), перенос видео на Ozon 28.09 (`business-os/execution/2026-09-28-ozon-video-spisok.md`), `data/mappings/category-map.json` (03.06), `attribute-map.json`, `ozon-card-templates.json`. **Код этапов 2–3** — ветка `sync2-stage-3` (`def3626`, worktree `/Users/minas/projects/sai_kotelnikovartifact-3`), сигнатуры ниже взяты оттуда.

---

## Факты, проверенные при написании плана (29.09.2026, только чтение)

- **VPS 147.45.171.40, `/opt/sync2` (29.09 13:46–13:56 UTC):** применены миграции 0000–0003 (в `channels` нет `price_write_mode` — этапы 2–3 не выложены). Таблица `listings` пуста (0 строк): она заведена в 1.1 и ни разу не заполнялась. Справочник `products` — **421 штрихкод, 388 карточек WB** (`nm_id`), артикулы уникальны между карточками (0 артикулов на двух `nm_id`).
- **В наличии (пул = снимок WB FBS 13:56 UTC): 86 штрихкодов, 83 карточки.** Снимки зеркал: Ozon 81 оффер, ЯМ 83, KIT 393 варианта, сайт 421; все строки сопоставлены штрихкоду WB. `externalSku`: Ozon и ЯМ — артикул WB в 81/81 и 83/83; KIT — id варианта.
- **Нет на зеркале среди товаров в наличии (29.09, 13:56 UTC):**

  | Площадка | Нет (штрихкодов / карточек) | Из них — разведение размеров (вопрос) | Останется к созданию автоматически | Нет по всему каталогу |
  |---|---|---|---|---|
  | Ozon | 27 / 26 | 3 (`JW-NB-AGT-M-0073` ×2, `6363638900098`) | **24** (в т.ч. часы `6565542`, `JW-NB-AGT-M-0029` с «серебром 925») | 307 из 388 |
  | ЯМ | 26 / 25 | 3 (`JW-NB-AGT-M-0073` ×2, `6363638900098`) | **23** (в т.ч. часы `6565542`) | 305 из 388 |
  | KIT | 17 / 17 | — (в KIT размеры уже вариантами) | **17** (14 оберегов, подвеска `888656432241`, минералы `87690321`, `555978675645`) | 28 из 388 |

  Остальные недостающие — обереги, подвески и минералы (в основном серии сентября `333…`, `555…`, `888…`, `7775543211`, `9997465365`). Создаются только товары в наличии (п. 16), ограничения «серебро», «часы», «серьги» сняты решением 29.09. Серьги-пусеты `7575443412`, `8787554322` (предмет WB «Обереги», маршрут «серьги» по названию) — в наличии не были 29.09.
- **Многоразмерные:** в каталоге WB 17 карточек с несколькими штрихкодами (16 браслетов, кольцо `8978785664` на 7 размеров). На Ozon/ЯМ у 8 из них один оффер на артикул (`JW-NB-AGT-M-0002`, `-0033`, `-0041`, `-0047`, `-0073`, `6363638900098`, `4535657887`, `8978785664`). Больше одного размера в наличии сейчас у двух: `JW-NB-AGT-M-0073` (3 размера: 1+2+3 шт.) и `6363638900098` (2+3 шт.); у `JW-NB-AGT-M-0047` в наличии один размер (2 шт.). **Один артикул на зеркалах держит разные размеры:** `JW-NB-AGT-M-0073` на Ozon — штрихкод `2042770600705`, на ЯМ — `2042770600712`; `6363638900098` на Ozon — `2047852179018`, на ЯМ — `2047852183152`. В KIT каждый размер уже отдельный вариант продукта (`group_id` продукта = `nm_id`, группировка по характеристике «Размер»). Пример размеров WB: `4535657887` — `techSize` 19/20/21, `wbSize` 1/2/3.
- **⚠️ Сбой каталога WB 29.09 13:51 UTC (к этапу 1.4, до шага B):** тик `ingest` получил из `content/v2/get/cards/list` 386 штрихкодов вместо 421 — пропали 35 штрихкодов **в наличии** (34 карточки, по 1 шт.); у всех карточек WB в этот момент `updatedAt` = 13:51:1x (массовое обновление карточек на стороне WB/ЛК — курсор по `updatedAt` пропускает карточки, обновлённые во время чтения). Ворота `MIN_CATALOG_SHARE = 0.9` пропустили каталог (386/421 = 91,7 %), `pool` записал `wb_signal` −35 по 34 штрихкодам; в 13:56 каталог вернулся (421), пул восстановился (+35). В dry-run это безвредно; **в apply 35 товаров в наличии были бы обнулены на всех зеркалах на 5 минут.** Этапа 4 это касается так: чтение карточек не считает пропавшую карточку удалённой (синк ничего не удаляет) и не ставит ей базовую линию. Исправление ворот `ingest` — отдельная задача этапа 1.4 (см. «Открытые вопросы», п. 1).
- **WB, контент (`content/v2/get/cards/list`, фикстура `sync2/packages/platforms/src/wb/fixtures/cards-list-sample.json` и живое чтение 29.09):** поля `nmID, vendorCode, brand, subjectName, title, description, characteristics[{id, name, value}]` (value — массив строк или число: «Ширина предмета»: 2), `photos[{big, hq, …}]` (только **webp**: `…/images/big/1.jpg` отвечает 404), `video` — **HLS-плейлист `…/hls/1440p/index.m3u8`** (Ozon/ЯМ/KIT берут файл mp4/mov — видео этапом 4 не переносится), `dimensions{length, width, height (см), weightBrutto (кг)}`, `sizes[{chrtID, techSize, wbSize, skus}]` (у карточки без размеров `techSize: "0"`, `wbSize: ""`), `updatedAt` (меняется и без правки контента — 13:51:1x у всех). ТН ВЭД — характеристики `15000001` «ТНВЭД» и `15004139` «Код ТН ВЭД». «Серебро 925» — в характеристике «Состав бижутерии» и в описаниях (`JW-NB-AGT-M-0029`).
- **Ozon (swagger `docs/api-reference/openapi/ozon/swagger_ozon.json`, память 18.07 и 04.09):** `POST /v3/product/import` — до 100 товаров, «при обновлении передайте всю информацию», суточные лимиты создания/обновления (`POST /v4/product/info/limit`), 429 с `Item-Retry-After`; статус — `POST /v1/product/import/info {task_id}` → `result.items[{offer_id, product_id, status: pending|imported|failed|skipped, errors[]}]`. `POST /v1/product/attributes/update` — меняет только переданные атрибуты, удалить нельзя, тоже через `task_id`. `POST /v1/product/pictures/import {product_id, images}` — каждый вызов заменяет все фото (до 30). `POST /v3/product/list {filter: {visibility}, last_id, limit ≤ 1000}` → `result.items[{product_id, offer_id, archived}]`. `offer_id` ≤ 50 символов. Атрибуты: 4180 «Название», 4191 «Аннотация», 9048 «Название модели (для объединения в одну карточку)» (обязательный), 5326 «Размер изделия» (`is_aspect`, словарь 936) у Браслета и Кольца, 23536 «Нужен код маркировки» (обязательный с 04.09, `false`), 85 Бренд — **только `dictionary_value_id` 973067008** (строка рядом даёт ошибку, 19.07), 4389 Страна. Модерация: FB_ORIGINAL режет «подлинный/оригинальный», FB_JEWELRY — «серебро/925»; WEBP с WB Ozon принимает (18.07). Рабочий набор атрибутов нового кабинета — `data/ozon-import/02-transform.py` (18.07): категории Браслет/Кольцо/Подвеска (17027899), «Магический амулет, оберег» (87515080/93733), «Минерал, кристалл коллекционный» (17028994/970801724); оберег-метеорит-образец → минерал, браслет-оберег → браслет; `vat: "0"`.
- **ЯМ (`docs/api-reference/openapi/yandex-market/openapi.yaml`, справка `step-by-step/assortment-add-goods` 29.09):** `POST /v2/businesses/{businessId}/offer-mappings/update` — до 500 офферов (предупреждение «скоро уменьшим»), лимит 10 000 офферов/мин; ответ `results[{offerId, errors[], warnings[]}]`, **ошибка у одного оффера — не обновится вся пачка**; обязательные для нового: `offerId, name (≤ 256), marketCategoryId, pictures, vendor, description (≤ 6000)`; поля, которые не меняются, можно не передавать; `parameterValues` — только вместе с `marketCategoryId`. **SKU нельзя освободить и использовать заново.** Чтение каталога — `POST /v2/businesses/{businessId}/offer-mappings` (фильтр `archived: true` отдаёт архив; `limit`/`page_token` — в строке запроса). **Варианты на одной карточке:** одинаковая характеристика `200` «Название группы вариантов» + различие по `distinctive`-характеристикам. Категория «Браслеты» 67678046 (живое чтение `v2/category/67678046/parameters`, 29.09): `32835410` «Размер браслета» — ENUM, `distinctive`, свои значения разрешены; `200` — TEXT. Старый синк 04.09 создал 18 офферов: `offer-mappings/update` + цена + остаток — после записи остатка оффер попал в магазин 149197829. В бизнесе 191766894 два магазина: 149197829 (ИП, рабочий) и 148697627 (СМЗ, закрывается).
- **KIT (`docs/api-reference/openapi/yandex-kit/kit-swagger.openapi.json`, живое чтение 29.09):** `POST /v1/products {category_ids}` (одна категория), настройки группировки — `PATCH /v1/products/{id} {settings: {grouping_characteristic_ids, splitting_characteristic_ids}}`; `POST /v1/variants {product_id, name, sku, barcode, description, brand, status, characteristics[{characteristic_id, value, values}], media[{type, display_sequence, image_id}], pricing{price, manual_discount_price}, cargo_boxes[{length, width, height (см), weight (г), display_sequence}], vat, requires_marking}`; `PATCH /v1/variants/{id}` (`application/merge-patch+json`) — `characteristics`, `media`, `cargo_boxes` **заменяются целиком**. Фото — только `image_id` из `POST /v1/files` (multipart, до 100 МБ, **дедупликация по содержимому** — повторная загрузка того же фото отдаёт прежний id; форматы не ограничены описанием). Запросы — строго по одному (~1,1 с, `kit/client.ts`). Категории (ACTIVE): Браслеты `01a05c9a-e6ea-7170-be89-106aa6cc1d3f`, Кольца `01a05c9a-e6f0-7a1d-bdaf-4a4aa37a26f4`, Подвески `01a05c99-a259-732e-b650-42e7ebf5283a`, Шармы-подвески `01a05c9d-4fe9-71d5-8e1b-50987a5dc17c`, Серьги `01a05c9d-4ff3-757a-95e0-e65c3bd83c1f`, Часы `01a05c9a-e6e3-7a34-9d8c-28a8467c1750`, Обереги `01a05c99-a266-7823-ac54-2e63eaedb332`, Коллекционные образцы `01a05c99-a275-75a4-a298-506acd89e5f9`. Характеристики KIT названы как у WB (41 шт., «Цвет», «Комплектация», «Материал изделия», …); «Размер» — `01a05c99-a58f-7992-9b2a-417072ec9fa2` (STRING, SINGLE). Пример варианта: `sku` = артикул WB, `barcode` = штрихкод WB, `vat: -1`, склад остатка — `01980d4c-1b53-7aa1-ab23-1b7c23604704`.
- **Видео (29.09, только чтение):** на VPS 147.45.171.40 **нет `ffmpeg`/`ffprobe`** (кандидат пакета Ubuntu 24.04 — `7:6.1.1-3ubuntu5`), `rsync` 3.2.7 и `/usr/bin/rrsync` есть; nginx слушает только :80 (чужие проекты), :443 занят `xray` — отдавать mp4 с VPS по HTTPS нельзя. Сервер сайта 201.34.133.76: nginx `kotelnikovartifact.ru` (Let's Encrypt) уже отдаёт `location ^~ /video/ { alias /var/www/media/video/; }` — **39 mp4 (212 МБ), собранных 28.09 для Ozon** (`https://kotelnikovartifact.ru/video/<артикул>.mp4` → 200 `video/mp4`, 3,5–8,6 МБ), `rsync` 3.4.1 и `rrsync` есть, `ffmpeg` нет; ключа VPS синка на сервере сайта нет. WB: `video` карточки — `…/hls/1440p/index.m3u8`, VOD, сегменты `N.ts` по ~3 с; прямого mp4 на CDN нет (`…/mp4/…/1.mp4` → 404).
- **Видео на площадках:** Ozon — атрибуты-комплекс `complex_id 100001`: 21841 «Озон.Видео: ссылка» (MP4/MOV, 8 с – 5 мин, до 2 ГБ), 21837 «Озон.Видео: название» (живое чтение атрибутов 29.09); ставится `v1/product/attributes/update` — так 28.09 прикреплены 39 роликов (задание 5717452722, 39/39 `imported`). ЯМ — `offer.videos: [URL]` в `offer-mappings/update`: прямая постоянная ссылка; «чтобы заменить видео — новая ссылка, старая удаляется; по старой ссылке не обновится». KIT — `POST /v1/videos/from_url {url}` → `video_id` (mp4/mov/webm, до 100 МБ, дедупликация по содержимому), в `media` варианта одно видео и хотя бы одно фото; `PATCH` заменяет `media` целиком.
- **Серьги и часы (живое чтение 29.09):** Ozon «Серьги» — 17027899/87593412, обязательные 85, 8229, 9048, 9163, 22232, 23536 (как подвеска), материал 5309; «Часы наручные» — 17027904/91758, обязательные те же, атрибута материала среди обязательных нет. ЯМ: «Серьги бижутерные» 66257495 (distinctive «Размер» 23681530, группа 200), «Наручные часы» 91259 (`v2/category/91259/parameters` отвечает `INTERNAL_ERROR` дважды; `tariffs/calculate` по 91259 работает: FEE 50,5 %, перевод платежа 2,8 %, доставка 5 % ≤ 1 000 ₽). Ставки в `config/pricing.json`: у «Часы наручные» `take_ozon` и `take_ym` — `null`. WB-часы `6565542` (nm 431548944): ТН ВЭД 9102110000, страна «Китай», вес брутто 0,5 кг, есть видео.
- **Уроки старого синка:** `cards-ym` искал «нет карточки» только по штрихкоду и создавал офферы с `offerId` = штрихкод → дубли (105 архивированы 19.07) — `cards` выключен с 19.07; 04.09 ключ переведён на артикул, но проверка архива не делалась. 04.09: 18 карточек Ozon упали на новом обязательном 23536; 6 — на FB_JEWELRY («серебро 925 пробы» в описании). `category-map.json` (03.06) — ЯМ-магазин СМЗ 148697627 и обереги на Ozon в бижутерии; рабочие категории нового кабинета — в `02-transform.py`. `02-transform.py` ставил «Страну» Ozon = Россия всем товарам — у части карточек WB «Китай», «Египет», «Аргентина», «Швеция».
- **Код этапа 3 (`sync2-stage-3`, `def3626`):** `WRITE_FIELDS = ["stock","price","price_timer","discount_task"]` (`packages/shared/src/write-fields.ts`); `WriteOp` несёт `price?/timer?/discountTask?` (`packages/platforms/src/writer.ts`), `drizzleWriteStore` пишет их в `writes.detail`; `writes.after` — `bigint` NOT NULL, уникальный ключ `(run_id, channel_id, barcode, field)`, `executeWrites` отказывает дублю ключа до сети. `ChannelRow {id, writeMode, priceWriteMode, guardWriteMode}`; режим пишется `db.update(channels)`. `DecisionRow` — размеченное объединение по `kind` (`PayloadOf<K>`), `allowedAnswers(kind, wbReturnEnabled, ozonTasksEnabled)`, `parseCallbackData` — `^d:(\d+):([axronu])$`, `decisionText/reminderText/decisionListLine` — `switch` по виду; бот (`jobs/bot.ts`) шлёт до 10 вопросов за прогон, кнопки — только ID из `TELEGRAM_APPROVERS`. Миграции 0005–0007. `mirrorPrices()` (`packages/domain/src/pricing.ts`) считает цели Ozon/ЯМ/KIT из прайса (`agreed_prices`), ставок (`config/pricing.json`), СПП и цены WB до скидки. Журнал и джобы — `withRun`, `notifyTransition`, `lastRunStatus`, `latestRun`, `writesOfRun`.

---

## Решения этапа

1. **Источник контента — карточка WB:** название, описание, характеристики (кроме ТН ВЭД `15000001`/`15004139` — у Ozon свой код по маршруту, ЯМ и KIT его не берут), фото (в порядке WB), габариты и вес, бренд, размеры, **ссылка на видео** (HLS). Контент канонизируется (характеристики и их значения сортируются, порядок фото значим) и хешируется sha256; `updatedAt` WB в хеш не входит — массовые «касания» WB без правки контента не дают ни одной правки зеркал. Версии — `wb_card_versions` (одна строка на `(nm_id, хеш)`), текущая — `wb_cards`. Адаптация под площадку — в мапперах площадки: санитайзер FB_ORIGINAL и CJK для Ozon/ЯМ, длины (ЯМ: название 256, описание 6000; Ozon: описание 6000), обязательные поля и словари Ozon (перенос `02-transform.py`), единицы Ozon (см → мм, кг → г, `dimension_unit: "mm"`, `weight_unit: "g"`).
2. **Ключ на зеркале — артикул WB (`offer_id` = `vendorCode`), никогда не штрихкод** (урок v1: дубли ЯМ). Размеры многоразмерной карточки: первый (или уже выложенный) — `vendorCode`, остальные — `vendorCode-<techSize>` (`JW-NB-AGT-M-0073-20`); нет `techSize` — `vendorCode-<штрихкод>`. KIT: вариант на штрихкод, `sku` = артикул, ключ записи — id варианта. «Нет на площадке» проверяется **по трём ключам вместе с архивом:** штрихкод у любого оффера, `offer_id` среди живых и архивных — совпадение без сопоставления = пропуск «разобрать вручную»; синк не создаёт заново и не разархивирует.
3. **Создание — автоматически** (п. 16) для штрихкода в наличии (пул > 0), если предмет WB замаплен (`sync2/config/card-categories.json`: серьги и часы — тоже, шармы на Ozon — «Подвеска») и есть прайс (цена создания — `mirrorPrices` этапа 2). **«Серебро 925» не ограничение** (решение 29.09, п. 1). **Часы:** ставок в `config/pricing.json` нет — Ozon создаётся по наибольшей ставке Ozon из конфига (55 %, цена заведомо не ниже нужной), дальше цену ведёт `prices` по живой ставке товара Ozon (этап 2 её уже читает); ЯМ — ставка из `tariffs/calculate` (FEE + перевод платежа), хранится в `sync_state` и подхватывается `prices`. Иначе — пропуск с причиной: в `runs.error` (партиал, уведомление о смене состояния) и в блоке «🗂 Карточки». **Отказ модерации** (Ozon: ошибки `import/info` или статус модерации `v3/product/info/list`; ЯМ: ошибки `offer-cards`) — листинг `failed`, **вопрос `card_rejected`** в группу с текстом отказа и пометкой, если просят УИН ГИИС ДМДК; кнопка «✅ Принято»; карточка не пересоздаётся, пока не изменится контент WB или владелец не скажет `cards retry`. После создания площадку подхватывают остальные джобы: снимок `ingest` → листинг `active`, остаток — `pool`, цена и флаг Ozon — `prices`/`ozon-timers`. ЯМ: оффер попадает в магазин записью остатка — создание пишет первый остаток пула (как v1 04.09).
4. **Правки:** хеш контента WB против `listings.content_hash`. **Первый прогон — базовая линия:** существующим листингам без хеша ставится текущий хеш, правок не шлётся. Дальше изменение на WB → план по полям. **KIT — сразу** (`PATCH /v1/variants/{id}`: название, описание, характеристики, фото, габариты, видео; SEO-поля не трогаются). **Ozon и ЯМ — один вопрос `card_edit` на карточку** («было → станет» по полям) с кнопками «✅ Применить на Ozon и ЯМ» / «⏭ Не применять»; ответ исполняет ближайший прогон. Ozon: название (4180), описание (4191), цвет (10096/10097) — `attributes/update`; фото — `pictures/import`; видео — `attributes/update` (комплекс 100001); **габариты — переимпорт `v3/product/import` из полной карточки самого Ozon** (`v4/product/info/attributes`: все атрибуты, комплексы, фото, категория) с новыми габаритами и текущими ценами (`v5/product/info/prices`) — частичного метода для габаритов у Ozon нет, а пересборка из WB задела бы категорийные атрибуты. ЯМ — `offer-mappings/update` без `marketCategoryId`. «Не применять» — зеркало как есть, листинг принимает новый хеш, не переспрашивается. На WB новая правка до ответа — вопрос закрывается «устарел», прогон задаёт новый. Сайт — ничего (п. 17).
5. **Видео (решение 29.09, п. 2):** джоба собирает HLS WB в mp4 на VPS (`ffmpeg -c copy -bsf:a aac_adtstoasc -movflags +faststart`; при отказе копирования — перекодирование H.264/AAC), проверяет `ffprobe` (длительность 8 с – 5 мин, размер ≤ 100 МБ — общий предел трёх площадок), публикует на сервер сайта `rsync` по отдельному ключу, ограниченному `rrsync -wo /var/www/media/video/` (запись только в эту папку), и проверяет ссылку `HEAD` → 200 `video/mp4`. Имя файла — `<артикул>-<8 символов хеша ссылки WB>.mp4`: новая ссылка на каждое новое видео (требование ЯМ). Прикрепление: Ozon — комплекс 100001, ЯМ — `videos`, KIT — `videos/from_url` + `media` варианта (фото + видео). Видео **не задерживает создание**: карточка создаётся без него, первое видео прикрепляется автоматически следующим прогоном туда, где у товара площадки видео нет (присутствие читается живьём: Ozon — 21841 в `v4/product/info/attributes`, ЯМ — `mediaFiles.videos`/`videos`, KIT — `media` с `VIDEO`); замена видео на Ozon/ЯМ — полем «Видео» вопроса `card_edit`, в KIT — сразу. Пределы: 20 сборок за прогон, таймаут `ffmpeg` 3 мин, папка `/opt/sync2/media/video` — только последние версии.
6. **Многоразмерные (п. 18) — разведение вопросом:** существующий оффер с продажами и отзывами **остаётся** своим размером; недостающие размеры в наличии создаются офферами `vendorCode-<techSize>` и объединяются: Ozon — одинаковый 9048 (= артикул) + 5326 «Размер изделия» (существующему — `attributes/update`); ЯМ — 200 «Название группы вариантов» = артикул + размер категории (браслеты — 32835410; существующему — `offer-mappings/update` с его текущей `marketCategoryId`). «⏭ Оставить один оффер» — больше не спрашивать. Новая многоразмерная карточка без офферов на площадке создаётся сразу вариантами (п. 16). Размеры разводятся там, где известен атрибут размера: Ozon — Браслет/Кольцо, ЯМ — Браслеты; иначе пропуск с причиной. По одной карточке (решение 29.09, п. 9).
7. **Запись — только через `executeWrites`**, поля `card_create` и `card_content`; `before`/`after` — первые 48 бит хеша контента WB, `detail` — `CardWriteDetail` (вид записи: создание, контент, группа размера, видео, переимпорт; поля; тело площадки). Режим — **`channels.card_write_mode`** (по умолчанию `off`), действует меньший из него и `SYNC_WRITE_MODE`; `apply` — `card-mode <площадка> apply --confirm` после свежего (≤ 3 ч) прогона `cards`. Выборочный прогон `cards run --only=<артикул,…>` без `--confirm` — dry-run.
8. **Темп и предохранители (решение 29.09, п. 4):** первый боевой прогон — одна карточка на площадку (`--only`, Task 18); дальше **все недостающие разом**: потолок 40 созданий на площадку за прогон (29.09 недостаёт 24/23/17 — хватает с запасом; потолок ловит только сбой ключей), у Ozon — суточный лимит `v4/product/info/limit` (остаток — на следующие сутки); 20 правок KIT, 10 новых вопросов, 20 сборок видео за прогон; изменился контент у > 25 карточек сразу («массовая правка WB») — правки зеркал не отправляются, алерт с двумя путями (`cards baseline --confirm` / `cards run --allow-mass --confirm`). **Удаления и архивации нет ни в одном коде этапа.** Незамапленный предмет — стоп по карточке и алерт. Созданное, не появившееся на площадке за 24 ч, — алерт.
9. **Частота — раз в час** (`19 * * * *`, мимо тика 1,6,…,56, цен 4/34, «Хочу скидку» 14/44, старого `orders` 3,8,…). Ответ на вопрос исполняется в пределах часа.
10. **Порядок выкладки:** после шага B этапа 1.4, выкладки этапа 2 (прайс) и бота этапа 2 (кнопки); на VPS ставится `ffmpeg`, на сервер сайта — ключ `rrsync` (оба шага — с «да» владельца). Первый боевой прогон — одна карточка на площадку (KIT → Ozon → ЯМ), затем крон; разведение размеров — по одной карточке.

### Отступления от спеки и постановки (с причинами)

- **Ключ размеров — `vendorCode-<techSize>`, а не штрихкод (спека §8: «иначе баркод»):** постановка запрещает штрихкод как ключ (урок v1), а читаемый ключ размера виден в ЛК и журнале; `offer_id` Ozon ≤ 50 символов — укладывается.
- **Базовая линия на первом прогоне (спека молчит):** WB-контент, из которого сделаны нынешние 81/83/393 карточки, неизвестен; сравнение «с нуля» дало бы 400+ правок в первый час.
- **Габариты Ozon — переимпорт из карточки Ozon, а не из WB:** v3/product/import требует всю информацию о товаре; взять её у самого Ozon — единственный способ поменять габариты, не тронув остальное.
- **Один вопрос на карточку для Ozon и ЯМ вместе:** вдвое меньше сообщений, решение одно.
- **Разведение размеров — вопросом, не автоматически:** трогает существующий оффер с продажами и отзывами; п. 16 про автоматическое создание касается новых карточек.
- **Решение 17.09 «серебро 925 на зеркала не идёт» (спека §2 п. 16, §8) отменено владельцем 29.09** — в коде этапа ограничения нет.

---

## Репозитории, ветки, проверки

| Задачи | Репозиторий | Ветка | Проверки перед коммитом |
|---|---|---|---|
| 1–16 | `/Users/minas/projects/sai_kotelnikovartifact`, worktree `/Users/minas/projects/sai_kotelnikovartifact-4` | `sync2-stage-4` | из `…-4/sync2`: `npm run typecheck && npm test && npm run test:db` |
| 17–19 | то же + VPS 147.45.171.40 и сервер сайта 201.34.133.76 (только ключ `rrsync`) | `main` | по шагам, каждый внешний шаг — только с «да» владельца |

Подготовка (один раз, перед Task 1):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git worktree add ../sai_kotelnikovartifact-4 -b sync2-stage-4 sync2-stage-3
cd ../sai_kotelnikovartifact-4/sync2 && npx -y npm@11.16.0 ci
```
Этап 3 влили в `main`, пока идёт этап 4, — перенести ветку (коммиты этапов 2–3 уже в `main` и выпадут):
```bash
cd /Users/minas/projects/sai_kotelnikovartifact-4 && git rebase main
```
Все команды задач — из `/Users/minas/projects/sai_kotelnikovartifact-4/sync2`, пути в `git add` — от этого каталога. Тестовая база — `sync2_test`. В основном worktree (`main`) много чужих незакоммиченных правок вне `sync2/` — слияние в Task 17 их не трогает; `stash`, `reset`, `checkout .` там не делать.

---

## Карта файлов

```
sai_kotelnikovartifact-4/sync2/                          (ветка sync2-stage-4)
  config/card-categories.json                          предмет WB → маршрут; маршрут → Ozon/ЯМ/KIT (с серьгами и часами)  [3]
  packages/shared/src/
    cards.ts (+test)                                   контент WB (с видео), площадки карточек, маршруты, поля, листинги  [1]
    write-fields.ts (+test)                            + card_create, card_content                             [1]
    decisions.ts                                       + card_edit, card_rejected, apply_edit/skip_edit/ack     [11]
    index.ts
  packages/domain/src/
    card-content.ts (+test), testing/card-fixture.ts   хеш, санитайзер, диф для людей                           [2]
    card-route.ts (+test)                              разбор config, маршрут карточки                         [3]
    card-plan.ts (+test)                               создания, правки, базовая линия, пропуски, размеры       [4]
    index.ts
  packages/db/
    migrations/0008_cards.sql, 0009_card_decisions.sql (+meta)                                                  [1, 11]
    src/schema.ts, channels.ts, writes-store.ts                                                                 [1]
    src/cards-store.ts                                 версии WB, листинги, статусы, хеши, видео WB             [9, 13]
    src/products.ts                                    inStockBarcodes                                          [9]
    src/sync-state.ts                                  YM_LIVE_TAKE_KEY                                         [15]
    src/decisions.ts                                   CardEditDecisionRow, CardRejectedDecisionRow, declinedSplitNmIds  [11, 14]
    src/store-4.db.test.ts                                                                                      [1, 9, 11, 13, 14]
  packages/platforms/src/
    writer.ts                                          CardWriteDetail, WriteOp.card                            [1]
    wb/card-content.ts (+test)                         полный контент карточек WB (с видео)                     [5]
    ozon/card-mapper.ts (+test)                        перенос 02-transform.py, серьги/часы, правка, группа, видео, переимпорт  [6]
    ozon/cards.ts (+test)                              ключи с архивом, полные карточки, модерация, словарь, лимит, запись  [6]
    ym/cards.ts (+test)                                ключи (видео), маппер, модерация, тарифы, запись + первый остаток  [7]
    kit/client.ts                                      kitUploadFile                                            [8]
    kit/cards.ts (+test)                               ключи (видео), характеристики, фото, видео, продукт+вариант, PATCH  [8]
    index.ts
  apps/worker/src/
    card-config.ts (+test)                             загрузка config/card-categories.json                     [3]
    video/hls.ts (+test), video/publish.ts (+test)     сборка mp4 ffmpeg/ffprobe, публикация rsync, проверка ссылки  [13]
    card-senders.ts (+test)                            отправитель карточек для executeWrites                    [10]
    jobs/cards.ts (+db test)                           джоба cards                                              [10, 11, 13, 14, 15]
    jobs/prices.ts                                     живая ставка ЯМ для предметов без ставки                  [15]
    decision-text.ts (+test)                           card_edit, card_rejected: текст, кнопки, напоминание     [11]
    jobs/bot.ts, cli-prices.ts                         cardEditsEnabled                                         [11]
    apply-preview.ts (+test)                           checkCardApplyPreview                                    [12]
    cli-cards.ts (+test), cli.ts                       cards run|plan|diff|baseline|retry, card-mode            [12]
    jobs/card-summary.ts (+test), jobs/drift.ts        блок «🗂 Карточки»                                       [16]
  deploy/crontab.sync2.txt, deploy/README.md, README.md, .env.example                                           [16]
```

---

## Часть A — модель данных и домен (без сети)

### Task 1: Типы карточек, поля журнала, режим записи карточек, таблицы (миграция 0008)

**Files:**
- Create: `packages/shared/src/cards.ts`, `packages/shared/src/cards.test.ts`, `packages/db/src/store-4.db.test.ts`, `packages/db/migrations/0008_cards.sql` (+ `meta/0008_snapshot.json`, `meta/_journal.json` — генерирует drizzle-kit)
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/write-fields.ts`, `packages/shared/src/write-fields.test.ts`, `packages/db/src/schema.ts`, `packages/db/src/channels.ts`, `packages/db/src/writes-store.ts`, `packages/platforms/src/writer.ts`

- [ ] **Step 1: Падающие тесты.** `packages/shared/src/cards.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { CARD_CHANNELS, isCardChannel, sizeLabel } from "./cards"

describe("карточки: общие типы", () => {
  it("площадки карточек — Ozon, ЯМ, KIT; WB и сайт — нет", () => {
    expect(CARD_CHANNELS).toEqual(["ozon", "ym", "kit"])
    expect(isCardChannel("kit")).toBe(true)
    expect(isCardChannel("site")).toBe(false)
    expect(isCardChannel("wb")).toBe(false)
  })

  it("подпись размера: techSize, иначе wbSize; «0» и пусто — размера нет", () => {
    expect(sizeLabel({ techSize: "19", wbSize: "1" })).toBe("19")
    expect(sizeLabel({ techSize: "0", wbSize: "" })).toBeNull()
    expect(sizeLabel({ techSize: " ", wbSize: "M" })).toBe("M")
  })
})
```
`packages/shared/src/write-fields.test.ts` — ожидание списка заменить:
```ts
    expect(WRITE_FIELDS).toEqual(["stock", "price", "price_timer", "discount_task", "card_create", "card_content", "card_video"])
```
`packages/db/src/store-4.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { loadChannels } from "./channels"
import { seedChannels } from "./channels-seed"
import { channels, listings, products, wbCardVersions, writes } from "./schema"
import { TEST_DATABASE_URL, expectConstraint, freshTestDb, insertRun } from "./test-db"
import { drizzleWriteStore } from "./writes-store"

describe.skipIf(!TEST_DATABASE_URL)("этап 4: режим карточек, листинги, версии WB, поля журнала", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  const RUN = "00000000-0000-4000-8000-000000008001"
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, RUN)
    await h.db.insert(products).values({ barcode: "2042770600705", vendorCode: "JW-NB-AGT-M-0073", nmId: 327127352, title: "Браслет Синергия" })
  })
  afterAll(async () => h?.close())

  it("card_write_mode по умолчанию off у всех площадок, опечатка не пишется", async () => {
    const chs = await loadChannels(h.db)
    expect([...chs.values()].every((c) => c.cardWriteMode === "off")).toBe(true)
    await expectConstraint(h.db.update(channels).set({ cardWriteMode: "aply" }).where(eq(channels.code, "kit")), "channels_card_write_mode_check")
  })

  it("журнал принимает card_create с detail из card; чужое поле — отказ", async () => {
    const chs = await loadChannels(h.db)
    await drizzleWriteStore(h.db, RUN, chs, "2026-10-12T16:19:00.000Z")([
      {
        channel: "kit",
        barcode: "2042770600705",
        field: "card_create",
        before: null,
        after: 0xabcdef012345,
        mode: "dry-run",
        applied: false,
        response: null,
        error: null,
        uncertain: false,
        externalSku: null,
        card: { kind: "create", nmId: 327127352, vendorCode: "JW-NB-AGT-M-0073", offerId: "JW-NB-AGT-M-0073", fields: ["title"], payload: {}, productRef: null, decisionId: null },
      },
    ])
    const [w] = await h.db.select().from(writes).where(eq(writes.runId, RUN))
    expect(w).toMatchObject({ field: "card_create", after: 0xabcdef012345 })
    expect(w!.detail).toMatchObject({ kind: "create", nmId: 327127352 })
    await expectConstraint(
      h.db.insert(writes).values({ runId: RUN, channelId: chs.get("kit")!.id, barcode: "X", field: "card_delete", after: 1, mode: "off", applied: false }),
      "writes_field_check",
    )
  })

  it("листинг: статус из закрытого списка; версия WB — одна на (nm_id, хеш)", async () => {
    const chs = await loadChannels(h.db)
    await expectConstraint(
      h.db.insert(listings).values({ channelId: chs.get("ozon")!.id, barcode: "2042770600705", externalId: "JW-NB-AGT-M-0073", status: "deleted" }),
      "listings_status_check",
    )
    const v = { nmId: 327127352, contentHash: "a".repeat(64), content: { nmId: 327127352 } as never }
    await h.db.insert(wbCardVersions).values(v)
    await expectConstraint(h.db.insert(wbCardVersions).values(v), "wb_card_versions_nm_hash_idx")
  })
})
```
Run: `npx vitest run packages/shared/src/cards.test.ts packages/shared/src/write-fields.test.ts` → FAIL (нет модуля, старый список); `npm run test:db -- packages/db/src/store-4.db.test.ts` → FAIL (нет колонки `card_write_mode`).

- [ ] **Step 2: Реализация.** `packages/shared/src/cards.ts`:
```ts
/**
 * Карточки (этап 4 синка v2): контент WB — мастер (решение 25.09, п. 16–18). Синк выкладывает карточки на Ozon,
 * ЯМ и KIT; сайт берёт контент с WB сам (п. 17).
 */
export const CARD_CHANNELS = ["ozon", "ym", "kit"] as const
export type CardChannel = (typeof CARD_CHANNELS)[number]

export function isCardChannel(value: string): value is CardChannel {
  return (CARD_CHANNELS as readonly string[]).includes(value)
}

/** Размер карточки WB. У карточки без размеров techSize «0», wbSize пустой. */
export interface WbCardSize {
  chrtId: number | null
  techSize: string
  wbSize: string
  barcodes: string[]
}

/** Подпись размера для зеркал: techSize (у браслетов — обхват, «19»), иначе wbSize; «0» и пусто — размера нет. */
export function sizeLabel(s: Pick<WbCardSize, "techSize" | "wbSize">): string | null {
  const tech = s.techSize.trim()
  if (tech !== "" && tech !== "0") return tech
  const wb = s.wbSize.trim()
  return wb !== "" && wb !== "0" ? wb : null
}

export interface WbCharacteristic {
  id: number
  name: string
  /** Значения строками: WB отдаёт то массив строк, то число («Ширина предмета»: 2). */
  values: string[]
}

/** Габариты упаковки WB: сантиметры и килограммы (weightBrutto), как в content-api. */
export interface WbDimensions {
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
}

/**
 * Контент карточки WB, который зеркалится (решение этапа 4, п. 1). Видео — ссылка на HLS-плейлист WB (m3u8): синк
 * собирает из него mp4 и прикрепляет на площадки (решение владельца 29.09, п. 2).
 */
export interface WbCardContent {
  nmId: number
  vendorCode: string
  brand: string
  subject: string
  title: string
  description: string
  characteristics: WbCharacteristic[]
  /** Фото в порядке карточки (big, webp). */
  photos: string[]
  dimensions: WbDimensions | null
  sizes: WbCardSize[]
  /** HLS-плейлист видео WB (`…/hls/1440p/index.m3u8`); null — видео нет. */
  video: string | null
}

export const CARD_FIELDS = ["title", "description", "characteristics", "photos", "dimensions", "sizes", "video"] as const
export type CardField = (typeof CARD_FIELDS)[number]

export const CARD_FIELD_LABELS: Record<CardField, string> = {
  title: "Название",
  description: "Описание",
  characteristics: "Характеристики",
  photos: "Фото",
  dimensions: "Габариты и вес",
  sizes: "Размеры",
  video: "Видео",
}

/** Изменение поля для вопроса «было → станет»: строки уже для людей (укорочены). */
export interface CardFieldChange {
  field: CardField
  before: string
  after: string
}

/** Товар на площадке: active — виден в снимке остатков; pending — создан синком, ещё не виден; failed — создание отклонено. */
export const LISTING_STATUSES = ["active", "pending", "failed"] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]

/** Маршрут карточки: вид изделия, по которому выбираются категории площадок (config/card-categories.json). */
export const CARD_SLUGS = ["braslet", "kolco", "podveska", "sharm", "amulet", "mineral", "sergi", "chasy"] as const
export type CardSlug = (typeof CARD_SLUGS)[number]

export interface OzonRoute {
  categoryId: number
  typeId: number
  /** Атрибут материала типа: 5309 (бижутерия, серьги), 7405 (оберег), 6383 (минерал); null — не передаётся (часы). */
  materialAttrId: number | null
  /** Есть атрибут 5326 «Размер изделия» — размеры разводятся на варианты. */
  sizeAttr: boolean
  /** ТН ВЭД (22232) — из характеристики WB через словарь Ozon (часы: 9102110000), а не по виду изделия. */
  tnvedFromWb: boolean
}
export interface YmRoute {
  marketCategoryId: number
  /** distinctive-характеристика размера категории; null — размеры на ЯМ не разводятся. */
  sizeParamId: number | null
}
export interface KitRoute {
  categoryId: string
}
export type Routed<T> = { ok: true; route: T } | { ok: false; reason: string }
export interface CardRoute {
  slug: CardSlug | null
  ozon: Routed<OzonRoute>
  ym: Routed<YmRoute>
  kit: Routed<KitRoute>
}

/** Оффер размера при разведении многоразмерной карточки (п. 18). */
export interface CardSizeOffer {
  channel: "ozon" | "ym"
  offerId: string
  barcode: string
  size: string | null
}
```
`packages/shared/src/index.ts` — добавить `export * from "./cards"`.

`packages/shared/src/write-fields.ts` — целиком:
```ts
/**
 * Что пишется на площадку — поле журнала writes. price_timer — продление флага минимальной цены Ozon,
 * discount_task — ответ на заявку Ozon «Хочу скидку» (этап 3); card_create — создание карточки на зеркале,
 * card_content — правка её контента, card_video — видео товара (этап 4; отдельное поле: правка и видео одного товара
 * идут одной записью, а ключ журнала — (прогон, площадка, штрихкод, поле)). Список — единый для CHECK базы и типов.
 */
export const WRITE_FIELDS = ["stock", "price", "price_timer", "discount_task", "card_create", "card_content", "card_video"] as const
export type WriteField = (typeof WRITE_FIELDS)[number]

export function isWriteField(value: string): value is WriteField {
  return (WRITE_FIELDS as readonly string[]).includes(value)
}
```

`packages/db/src/schema.ts`:
- в импорт из `"@sync2/shared"` добавить `LISTING_STATUSES` и `type WbCardContent`;
- в `channels` после `guardWriteMode`:
```ts
    /** Режим записи карточек площадки (этап 4): создание и правки контента Ozon/ЯМ/KIT; действует меньший из него и SYNC_WRITE_MODE. */
    cardWriteMode: text("card_write_mode").notNull().default("off"),
```
- в ограничения `channels` после `channels_guard_write_mode_check`:
```ts
    check("channels_card_write_mode_check", sql`${t.cardWriteMode} in (${inList(WRITE_MODES)})`),
```
- `listings` — целиком:
```ts
/**
 * Товар на площадке (этап 4 заполняет): чем он там называется и в каком состоянии. content_hash — хеш контента WB,
 * с которого товар последний раз синхронизирован (null — ещё не было ни синхронизации, ни базовой линии).
 */
export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    barcode: text("barcode").notNull().references(() => products.barcode),
    /** offer_id Ozon/ЯМ, id варианта KIT. */
    externalId: text("external_id").notNull(),
    status: text("status").notNull().default("active"),
    contentHash: text("content_hash"),
    nmId: bigint("nm_id", { mode: "number" }),
    /** Последний снимок остатков площадки, где товар был. */
    seenAt: ts("seen_at"),
    /** Отказ площадки при создании (status failed) — повтор только после правки WB или `cards retry`. */
    lastError: text("last_error"),
    /** Прогон cards, создавший товар; null — товар был на площадке до синка. */
    createdRunId: uuid("created_run_id").references(() => runs.runId),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("listings_channel_barcode_idx").on(t.channelId, t.barcode),
    check("listings_status_check", sql`${t.status} in (${inList(LISTING_STATUSES)})`),
  ],
)
```
- в конец файла:
```ts
/** Карточка WB: текущий хеш контента (этап 4); сам контент — в wb_card_versions. */
export const wbCards = pgTable("wb_cards", {
  nmId: bigint("nm_id", { mode: "number" }).primaryKey(),
  vendorCode: text("vendor_code").notNull(),
  contentHash: text("content_hash").notNull(),
  /** Последнее чтение каталога, где карточка была: пропавшая из чтения карточка не удаляется и не правится. */
  seenAt: ts("seen_at").notNull(),
  /** Когда хеш последний раз изменился. */
  changedAt: ts("changed_at").notNull(),
})

/** Версии контента WB — одна строка на (nm_id, хеш), только дописывается: «было» для вопросов о правке. */
export const wbCardVersions = pgTable(
  "wb_card_versions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    nmId: bigint("nm_id", { mode: "number" }).notNull(),
    contentHash: text("content_hash").notNull(),
    content: jsonb("content").$type<WbCardContent>().notNull(),
    runId: uuid("run_id").references(() => runs.runId),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("wb_card_versions_nm_hash_idx").on(t.nmId, t.contentHash)],
)

/** Видео карточки WB, собранное в mp4 и опубликованное на сервере сайта (этап 4, решение 29.09 п. 2). */
export const wbCardVideos = pgTable(
  "wb_card_videos",
  {
    nmId: bigint("nm_id", { mode: "number" }).primaryKey(),
    /** HLS-плейлист WB, из которого собран файл: сменился — собирается заново под новым именем. */
    sourceUrl: text("source_url").notNull(),
    fileName: text("file_name").notNull(),
    /** Постоянная ссылка https://kotelnikovartifact.ru/video/<файл>; null — не опубликовано. */
    publicUrl: text("public_url"),
    status: text("status").notNull(),
    durationSec: integer("duration_sec"),
    bytes: bigint("bytes", { mode: "number" }),
    error: text("error"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [check("wb_card_videos_status_check", sql`${t.status} in ('ready', 'failed', 'unfit')`)],
)
```
- комментарий у `writes.before`: `/** Остаток — штуки; цена — копейки; таймер Ozon — unix-секунды; карточка — первые 48 бит хеша контента WB; поэтому bigint. */`.

`packages/db/src/channels.ts` — в `ChannelRow` после `guardWriteMode`:
```ts
  /** Режим записи карточек (этап 4). */
  cardWriteMode: WriteMode
```
и в `out.set(...)` после `guardWriteMode`:
```ts
      cardWriteMode: parseWriteMode(r.cardWriteMode, "off"),
```

`packages/db/src/writes-store.ts` — в `WriteRecord` после `discountTask?`:
```ts
  /** Карточка (этап 4): CardWriteDetail из @sync2/platforms — в writes.detail. */
  card?: unknown
```
и строка `detail:` — `detail: o.price ?? o.timer ?? o.discountTask ?? o.card ?? null,`.

`packages/platforms/src/writer.ts`:
- импорт из `"@sync2/shared"` дополнить `type CardField`;
- после `OzonDiscountDetail`:
```ts
/**
 * Карточка (этап 4): что уходит на площадку. after/before операции — первые 48 бит хеша контента WB (к/от).
 * create — новый товар; content — правка контента; group — атрибуты варианта размера существующему офферу (п. 18);
 * video — прикрепить видео (mp4 по публичной ссылке); reimport — Ozon: переимпорт полной карточки Ozon с новыми габаритами.
 */
export interface CardWriteDetail {
  kind: "create" | "content" | "group" | "video" | "reimport"
  nmId: number
  vendorCode: string
  /** offer_id Ozon/ЯМ; у KIT — артикул (sku). Ключ записи правки KIT — id варианта в WriteOp.externalSku. */
  offerId: string
  fields: CardField[]
  /** Тело площадки для позиции — собирает маппер площадки (ozon/card-mapper.ts, ym/cards.ts, kit/cards.ts). */
  payload: unknown
  /** Ozon — product_id (фото правятся по нему); KIT — id продукта карточки (null — создать продукт). */
  productRef: string | null
  /** ЯМ-создание: остаток пула — оффер попадает в магазин записью остатка (как старый синк 04.09). */
  initialStock?: number
  /** Вопрос, чей ответ исполняется (правки и размеры Ozon/ЯМ); создание и KIT — null. */
  decisionId: number | null
}
```
- в `WriteOp` после `discountTask?`:
```ts
  /** Только field = "card_create" | "card_content" | "card_video" (этап 4). */
  card?: CardWriteDetail
```

Миграция:
```bash
npm run db:generate -- --name cards
```
Expected: `packages/db/migrations/0008_cards.sql` ровно с операторами (порядок может отличаться): `CREATE TABLE "wb_card_versions"` (`id` bigserial PK, `nm_id` bigint NOT NULL, `content_hash` text NOT NULL, `content` jsonb NOT NULL, `run_id` uuid, `first_seen_at` timestamptz DEFAULT now() NOT NULL); `CREATE TABLE "wb_cards"` (`nm_id` bigint PK, `vendor_code` text NOT NULL, `content_hash` text NOT NULL, `seen_at`, `changed_at` timestamptz NOT NULL); `CREATE TABLE "wb_card_videos"` (`nm_id` bigint PK, `source_url`, `file_name`, `status` text NOT NULL, `public_url`, `error` text, `duration_sec` integer, `bytes` bigint, `updated_at` timestamptz DEFAULT now() NOT NULL) с `wb_card_videos_status_check`; `ALTER TABLE "channels" ADD COLUMN "card_write_mode" text DEFAULT 'off' NOT NULL`; `ALTER TABLE "listings" ADD COLUMN` `nm_id` bigint, `seen_at` timestamptz, `last_error` text, `created_run_id` uuid; два FK на `runs("run_id")` (`listings_created_run_id_runs_run_id_fk`, `wb_card_versions_run_id_runs_run_id_fk`); `CREATE UNIQUE INDEX "wb_card_versions_nm_hash_idx"`; `ADD CONSTRAINT "channels_card_write_mode_check"`, `"listings_status_check"`; `DROP CONSTRAINT "writes_field_check"` и новый `writes_field_check` с `'card_create', 'card_content', 'card_video'`. Лишний оператор (переименование, DROP таблицы) — стоп, разобраться до коммита. На VPS `listings` пуста (факт 29.09) — CHECK статуса накатывается без данных.

- [ ] **Step 3: Проверка и коммит.**
```bash
npx vitest run packages/shared/src && npm run test:db -- packages/db/src/store-4.db.test.ts && npm run typecheck && npm test && npm run test:db
git add packages/shared/src/cards.ts packages/shared/src/cards.test.ts packages/shared/src/index.ts packages/shared/src/write-fields.ts packages/shared/src/write-fields.test.ts packages/db/src/schema.ts packages/db/src/channels.ts packages/db/src/writes-store.ts packages/db/src/store-4.db.test.ts packages/db/migrations packages/platforms/src/writer.ts
git commit -m "sync2: этап 4 — типы карточек (с видео), поля журнала card_create/card_content, режим записи карточек, wb_cards, версии, видео WB (миграция 0008)"
```

---

### Task 2: Контент карточки — хеш, санитайзер, диф для людей (`@sync2/domain/card-content`)

**Files:**
- Create: `packages/domain/src/card-content.ts`, `packages/domain/src/card-content.test.ts`, `packages/domain/src/testing/card-fixture.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Падающие тесты.** Общая заготовка карточки для тестов домена (не тест — vitest её не запускает, в `index.ts` не экспортируется) — `packages/domain/src/testing/card-fixture.ts`:
```ts
import type { WbCardContent } from "@sync2/shared"

/** Карточка WB 1532076295 (фикстура cards-list-sample.json, сокращена) — для тестов домена карточек. */
export const card = (over: Partial<WbCardContent> = {}): WbCardContent => ({
  nmId: 1532076295,
  vendorCode: "87576556434",
  brand: "KOTELNIKOVARTIFACT",
  subject: "Обереги",
  title: "Метеорит Сихотэ-Алинь коллекционный образец 4,6 гр, оберег",
  description: "Перед Вами индивидуальный образец - метеорит Сихотэ-Алинь весом 4,6 гр.",
  characteristics: [
    { id: 14177449, name: "Цвет", values: ["графит"] },
    { id: 59611, name: "Назначение подарка", values: ["Мужчине", "Женщине"] },
    { id: 15000001, name: "ТНВЭД", values: ["7117190000"] },
  ],
  photos: ["https://basket-48.wbbasket.ru/vol15320/part1532076/1532076295/images/big/1.webp", "https://basket-48.wbbasket.ru/vol15320/part1532076/1532076295/images/big/2.webp"],
  dimensions: { lengthCm: 25, widthCm: 15, heightCm: 6, weightKg: 0.01 },
  sizes: [{ chrtId: 2582121787, techSize: "0", wbSize: "", barcodes: ["2056117304256"] }],
  video: "https://videonme-basket-09.wbbasket.ru/vol103/part153207/1532076295/hls/1440p/index.m3u8",
  ...over,
})
```
`packages/domain/src/card-content.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { cardContentHash, diffCardContent, hashToNumber, sanitizeCardForMirror, sanitizeMirrorText } from "./card-content"
import { card } from "./testing/card-fixture"

describe("хеш контента", () => {
  it("не зависит от порядка характеристик и их значений, ТН ВЭД не учитывается; порядок фото — учитывается", () => {
    const a = card()
    const b = card({
      characteristics: [
        { id: 59611, name: "Назначение подарка", values: ["Женщине", "Мужчине"] },
        { id: 14177449, name: "Цвет", values: ["графит"] },
        { id: 15004139, name: "Код ТН ВЭД", values: ["9601900000"] },
      ],
    })
    expect(cardContentHash(b)).toBe(cardContentHash(a))
    expect(cardContentHash(card({ photos: [...a.photos].reverse() }))).not.toBe(cardContentHash(a))
    expect(cardContentHash(card({ title: `${a.title} ` }))).toBe(cardContentHash(a))
    expect(cardContentHash(card({ video: null }))).not.toBe(cardContentHash(a))
    expect(cardContentHash(a)).toMatch(/^[0-9a-f]{64}$/)
  })

  it("число из хеша — первые 48 бит, безопасное целое", () => {
    expect(hashToNumber("abcdef012345" + "0".repeat(52))).toBe(0xabcdef012345)
    expect(() => hashToNumber("xyz")).toThrow(/не хеш/)
  })
})

describe("санитайзер зеркал (FB_ORIGINAL, CJK)", () => {
  it("подлинность и оригинальность — без заявлений, иероглифы — прочь, пробелы — одиночные", () => {
    expect(sanitizeMirrorText("Сертификат подлинности, фирменная коробочка")).toBe("Сертификат, фирменная коробочка")
    expect(sanitizeMirrorText("Подлинность гарантирована.")).toBe("Происхождение подтверждено.")
    expect(sanitizeMirrorText("Подлинность подтверждается сертификатом")).toBe("Происхождение подтверждается сертификатом")
    expect(sanitizeMirrorText("оригинальный метеорит")).toBe("метеорит")
    expect(sanitizeMirrorText("Оригинальный подарок")).toBe("подарок")
    expect(sanitizeMirrorText("лигатурой 招财进宝 (zhāo cái jìn bǎo)")).toBe("лигатурой (zhāo cái jìn bǎo)")
    expect(sanitizeMirrorText("100% оригинал")).toBe("проверенное происхождение")
  })

  it("карточка для зеркала: название, описание, значения характеристик санитизированы, прочее — как было", () => {
    const c = sanitizeCardForMirror(card({ title: "Оригинальный метеорит Дронино", characteristics: [{ id: 1, name: "Комплектация", values: ["Сертификат подлинности"] }] }))
    expect(c.title).toBe("метеорит Дронино")
    expect(c.characteristics[0]!.values).toEqual(["Сертификат"])
    expect(c.photos).toEqual(card().photos)
  })
})

describe("диф для вопроса «было → станет»", () => {
  it("название целиком, описание — изменённый кусок, характеристики — по именам, фото — счётом", () => {
    const before = card()
    const after = card({
      title: "Метеорит Сихотэ-Алинь, образец 4,6 г",
      description: "Перед Вами индивидуальный образец - метеорит Сихотэ-Алинь весом 4,7 гр.",
      characteristics: [
        { id: 14177449, name: "Цвет", values: ["чёрный"] },
        { id: 59611, name: "Назначение подарка", values: ["Мужчине", "Женщине"] },
        { id: 59615, name: "Повод", values: ["Новый год"] },
      ],
      photos: [before.photos[0]!],
    })
    const d = diffCardContent(before, after)
    expect(d.map((x) => x.field)).toEqual(["title", "description", "characteristics", "photos"])
    expect(d[0]).toEqual({ field: "title", before: before.title, after: after.title })
    expect(d[1]!.before).toContain("4,6 гр")
    expect(d[1]!.after).toContain("4,7 гр")
    expect(d[2]!.after).toBe("Цвет: графит → чёрный; + Повод: Новый год")
    expect(d[3]).toEqual({ field: "photos", before: "2 фото", after: "1 фото (состав или порядок изменён)" })
  })

  it("одинаковый контент — пусто; габариты и размеры — строкой", () => {
    expect(diffCardContent(card(), card())).toEqual([])
    const d = diffCardContent(card(), card({ dimensions: { lengthCm: 25, widthCm: 15, heightCm: 6, weightKg: 0.09 } }))
    expect(d).toEqual([{ field: "dimensions", before: "25×15×6 см, 0,01 кг", after: "25×15×6 см, 0,09 кг" }])
    expect(diffCardContent(card({ video: null }), card())).toEqual([{ field: "video", before: "нет", after: "новое видео с WB" }])
    expect(diffCardContent(card(), card({ video: "https://videonme-basket-01.wbbasket.ru/x/hls/1440p/index.m3u8" }))).toEqual([{ field: "video", before: "есть", after: "новое видео с WB" }])
  })
})
```
Run: `npx vitest run packages/domain/src/card-content.test.ts` → FAIL (нет модуля).

- [ ] **Step 2: Реализация.** `packages/domain/src/card-content.ts`:
```ts
import { createHash } from "node:crypto"
import type { CardFieldChange, WbCardContent, WbCharacteristic, WbDimensions } from "@sync2/shared"
import { sizeLabel } from "@sync2/shared"

/** Характеристики WB, которые не зеркалятся: ТН ВЭД (у Ozon свой код по маршруту; ЯМ и KIT его не берут). */
export const WB_IGNORED_CHARACTERISTIC_IDS: ReadonlySet<number> = new Set([15000001, 15004139])

const mirrored = (chars: readonly WbCharacteristic[]) => chars.filter((c) => !WB_IGNORED_CHARACTERISTIC_IDS.has(c.id))
const normText = (s: string) => s.replace(/\r\n/g, "\n").trim()

/** Канон контента для хеша: порядок характеристик и значений WB не значим, порядок фото — значим; updatedAt не входит. */
export function canonicalCardContent(c: WbCardContent) {
  return {
    brand: c.brand.trim(),
    subject: c.subject,
    title: c.title.trim(),
    description: normText(c.description),
    characteristics: mirrored(c.characteristics)
      .map((x) => ({ id: x.id, name: x.name, values: [...x.values].sort() }))
      .sort((a, b) => a.id - b.id),
    photos: c.photos,
    dimensions: c.dimensions ? [c.dimensions.lengthCm, c.dimensions.widthCm, c.dimensions.heightCm, c.dimensions.weightKg] : null,
    sizes: c.sizes
      .map((s) => ({ techSize: s.techSize, wbSize: s.wbSize, barcodes: [...s.barcodes].sort() }))
      .sort((a, b) => a.techSize.localeCompare(b.techSize)),
    video: c.video,
  }
}

export function cardContentHash(c: WbCardContent): string {
  return createHash("sha256").update(JSON.stringify(canonicalCardContent(c))).digest("hex")
}

/** Первые 48 бит хеша — в writes.before/after (bigint в режиме number): журнал видит, какой контент ушёл. */
export function hashToNumber(hash: string): number {
  if (!/^[0-9a-f]{12}/.test(hash)) throw new RangeError(`не хеш: ${hash}`)
  return Number.parseInt(hash.slice(0, 12), 16)
}

/**
 * Модерация Ozon (FB_ORIGINAL) режет заявления об оригинальности и подлинности; DESCRIPTION_DECLINE — иероглифы.
 * Правила — из data/ozon-import/02-transform.py (64/64 прошли 18.07) и sync/src/cards-*.ts (v1).
 */
const FB_ORIGINAL: ReadonlyArray<readonly [RegExp, string]> = [
  [/(сертификат[а-яё]*)\s+подлинност[а-яё]*/gi, "$1"],
  [/[Пп]одлинность гарантирована/g, "Происхождение подтверждено"],
  [/[Пп]одлинность подтверждается/g, "Происхождение подтверждается"],
  [/подлинный фрагмент/g, "фрагмент"],
  [/[Пп]одлинн(ый|ая|ое|ые|ым|ого|ой|ости|ость)/g, "настоящий"],
  [/100%\s*оригинал[а-яё]*/gi, "проверенное происхождение"],
  [/оригинальн(ый|ая|ое|ые|ым|ого|ой)\s+(метеорит|образец|фрагмент)/gi, "$2"],
  [/оригинальн[а-яё]*\s*/gi, ""],
]

export function sanitizeMirrorText(text: string): string {
  let out = text
  for (const [re, to] of FB_ORIGINAL) out = out.replace(re, to)
  out = out.replace(/[　-鿿豈-﫿]+/g, "")
  out = out.replace(/\(\s*\)/g, "")
  out = out.replace(/[ \t]{2,}/g, " ").replace(/ +([.,;:!?])/g, "$1").replace(/^ +| +$/gm, "")
  // Заглавная в начале строки после удаления слова («Оригинальный подарок» → «подарок») не восстанавливается: WB-текст
  // остаётся мастером, зеркалу достаточно не быть отклонённым.
  return out
}

/** Копия карточки для Ozon/ЯМ: санитайзер по названию, описанию и значениям характеристик. */
export function sanitizeCardForMirror(c: WbCardContent): WbCardContent {
  return {
    ...c,
    title: sanitizeMirrorText(c.title),
    description: sanitizeMirrorText(c.description),
    characteristics: c.characteristics.map((x) => ({ ...x, values: x.values.map(sanitizeMirrorText).filter((v) => v !== "") })),
  }
}

const CUT = 300
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim()

/** Изменённый кусок двух текстов: 60 символов до первого расхождения и до CUT после — чтобы было видно, что поменялось. */
function changedFragment(a: string, b: string): { before: string; after: string } {
  const x = oneLine(a)
  const y = oneLine(b)
  let i = 0
  while (i < x.length && i < y.length && x[i] === y[i]) i++
  const from = Math.max(0, i - 60)
  const cut = (s: string) => `${from > 0 ? "…" : ""}${s.slice(from, from + CUT)}${s.length > from + CUT ? "…" : ""} (${s.length} симв.)`
  return { before: cut(x), after: cut(y) }
}

const fmtDims = (d: WbDimensions | null) =>
  d === null ? "не заданы" : `${d.lengthCm}×${d.widthCm}×${d.heightCm} см, ${String(d.weightKg).replace(".", ",")} кг`

/** Поля, которые изменились с версии a на версию b, — строками для вопроса в Telegram (4096 символов на сообщение). */
export function diffCardContent(a: WbCardContent, b: WbCardContent): CardFieldChange[] {
  const out: CardFieldChange[] = []
  if (a.title.trim() !== b.title.trim()) out.push({ field: "title", before: a.title.trim(), after: b.title.trim() })
  if (normText(a.description) !== normText(b.description)) out.push({ field: "description", ...changedFragment(a.description, b.description) })
  const ca = new Map(mirrored(a.characteristics).map((x) => [x.name, [...x.values].sort().join(", ")]))
  const cb = new Map(mirrored(b.characteristics).map((x) => [x.name, [...x.values].sort().join(", ")]))
  const lines: string[] = []
  for (const [name, v] of ca) {
    const w = cb.get(name)
    if (w === undefined) lines.push(`− ${name}: ${v}`)
    else if (w !== v) lines.push(`${name}: ${v} → ${w}`)
  }
  for (const [name, w] of cb) if (!ca.has(name)) lines.push(`+ ${name}: ${w}`)
  if (lines.length > 0) out.push({ field: "characteristics", before: `${ca.size} шт.`, after: lines.join("; ") })
  if (JSON.stringify(a.photos) !== JSON.stringify(b.photos)) out.push({ field: "photos", before: `${a.photos.length} фото`, after: `${b.photos.length} фото (состав или порядок изменён)` })
  if (JSON.stringify(a.dimensions) !== JSON.stringify(b.dimensions)) out.push({ field: "dimensions", before: fmtDims(a.dimensions), after: fmtDims(b.dimensions) })
  const sizes = (c: WbCardContent) => c.sizes.map((s) => sizeLabel(s) ?? "без размера").join(", ")
  if (sizes(a) !== sizes(b)) out.push({ field: "sizes", before: sizes(a), after: sizes(b) })
  if (a.video !== b.video && b.video !== null) out.push({ field: "video", before: a.video === null ? "нет" : "есть", after: "новое видео с WB" })
  return out
}
```
Проверка ожидания диф-характеристик в тесте: «Цвет: графит → чёрный; + Повод: Новый год» — строка «before» у характеристик — счёт (`3 шт.` без ТН ВЭД: 2), тест смотрит только `after`.

`packages/domain/src/index.ts` — добавить `export * from "./card-content"`.

- [ ] **Step 3: Проверка и коммит.**
```bash
npx vitest run packages/domain/src/card-content.test.ts && npm run typecheck
git add packages/domain/src/card-content.ts packages/domain/src/card-content.test.ts packages/domain/src/testing/card-fixture.ts packages/domain/src/index.ts
git commit -m "sync2: карточки — хеш контента WB (с видео, без ТН ВЭД и updatedAt), санитайзер FB_ORIGINAL/CJK, диф для людей"
```

---

### Task 3: Категории — конфиг и маршрут карточки (`config/card-categories.json`, `@sync2/domain/card-route`)

**Files:**
- Create: `config/card-categories.json`, `packages/domain/src/card-route.ts`, `packages/domain/src/card-route.test.ts`, `apps/worker/src/card-config.ts`, `apps/worker/src/card-config.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Конфиг.** `config/card-categories.json` — единственный источник категорий этапа 4 (заменяет `data/mappings/category-map.json` для синка v2; тот остаётся справкой v1). Ozon — из рабочего `data/ozon-import/02-transform.py` (кабинет ИП, 18.07), серьги и часы — по атрибутам, прочитанным 29.09 (Серьги 17027899/87593412, Часы наручные 17027904/91758); ЯМ — `category-map.json` с правками 19.07 (Обереги → 78928993, минералы → 62920723, браслеты → 67678046), серьги — «Серьги бижутерные» 66257495, часы — «Наручные часы» 91259 (решение 29.09 п. 5 отменяет «часы на ЯМ не выкладываются»); KIT — id категорий, прочитанные 29.09; размер ЯМ «Браслеты» — 32835410:
```json
{
  "_meta": {
    "updated": "2026-09-29",
    "rules": [
      "Предмет WB → маршрут (вид изделия); «Обереги» — по названию: метеорит-образец → mineral, браслет → braslet, серьги → sergi, иначе amulet (02-transform.py).",
      "Предмета нет в subjects — стоп по карточке и алерт (решение 25.09, п. 16). null — не зеркалится (решение 03.06: открытки).",
      "Ювелирные категории площадок не используются никогда (category-map.json, jewelry_blacklist).",
      "skip — причина, по которой синк не выкладывает на площадку (с 29.09 не используется: ничего вручную).",
      "Шармы на Ozon — тип «Подвеска» (решение 29.09 п. 5); часы на Ozon — ТН ВЭД из карточки WB (tnvedFromWb)."
    ]
  },
  "subjects": {
    "Браслеты": "braslet",
    "Кольца": "kolco",
    "Подвески бижутерные": "podveska",
    "Шармы-подвески": "sharm",
    "Обереги": "by-title",
    "Природные материалы для творчества": "mineral",
    "Серьги": "sergi",
    "Часы наручные": "chasy",
    "Открытки": null
  },
  "slugs": {
    "braslet": {
      "ozon": { "categoryId": 17027899, "typeId": 87458883, "materialAttrId": 5309, "sizeAttr": true },
      "ym": { "marketCategoryId": 67678046, "sizeParamId": 32835410 },
      "kit": { "categoryId": "01a05c9a-e6ea-7170-be89-106aa6cc1d3f" }
    },
    "kolco": {
      "ozon": { "categoryId": 17027899, "typeId": 87458895, "materialAttrId": 5309, "sizeAttr": true },
      "ym": { "marketCategoryId": 69264438, "sizeParamId": null },
      "kit": { "categoryId": "01a05c9a-e6f0-7a1d-bdaf-4a4aa37a26f4" }
    },
    "podveska": {
      "ozon": { "categoryId": 17027899, "typeId": 87458901, "materialAttrId": 5309, "sizeAttr": false },
      "ym": { "marketCategoryId": 68749551, "sizeParamId": null },
      "kit": { "categoryId": "01a05c99-a259-732e-b650-42e7ebf5283a" }
    },
    "sharm": {
      "ozon": { "categoryId": 17027899, "typeId": 87458901, "materialAttrId": 5309, "sizeAttr": false },
      "ym": { "marketCategoryId": 68752047, "sizeParamId": null },
      "kit": { "categoryId": "01a05c9d-4fe9-71d5-8e1b-50987a5dc17c" }
    },
    "amulet": {
      "ozon": { "categoryId": 87515080, "typeId": 93733, "materialAttrId": 7405, "sizeAttr": false },
      "ym": { "marketCategoryId": 78928993, "sizeParamId": null },
      "kit": { "categoryId": "01a05c99-a266-7823-ac54-2e63eaedb332" }
    },
    "mineral": {
      "ozon": { "categoryId": 17028994, "typeId": 970801724, "materialAttrId": 6383, "sizeAttr": false },
      "ym": { "marketCategoryId": 62920723, "sizeParamId": null },
      "kit": { "categoryId": "01a05c99-a275-75a4-a298-506acd89e5f9" }
    },
    "sergi": {
      "ozon": { "categoryId": 17027899, "typeId": 87593412, "materialAttrId": 5309, "sizeAttr": false },
      "ym": { "marketCategoryId": 66257495, "sizeParamId": null },
      "kit": { "categoryId": "01a05c9d-4ff3-757a-95e0-e65c3bd83c1f" }
    },
    "chasy": {
      "ozon": { "categoryId": 17027904, "typeId": 91758, "materialAttrId": null, "sizeAttr": false, "tnvedFromWb": true },
      "ym": { "marketCategoryId": 91259, "sizeParamId": null },
      "kit": { "categoryId": "01a05c9a-e6e3-7a34-9d8c-28a8467c1750" }
    }
  }
}
```

- [ ] **Step 2: Падающие тесты.** `packages/domain/src/card-route.test.ts`:
```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { card } from "./testing/card-fixture"
import { parseCardCategories, routeCard, slugByTitle } from "./card-route"

const cats = parseCardCategories(JSON.parse(readFileSync(new URL("../../../config/card-categories.json", import.meta.url), "utf8")))

describe("маршрут карточки", () => {
  it("«Обереги» — по названию (кириллица без \\b)", () => {
    expect(slugByTitle("Метеорит Сихотэ-Алинь коллекционный образец 4,6 гр, оберег")).toBe("mineral")
    expect(slugByTitle("Метеорит Дронино железный, горбушка")).toBe("mineral")
    expect(slugByTitle("Браслет из Ливийского стекла")).toBe("braslet")
    expect(slugByTitle("Мужской браслет с каменным метеоритом")).toBe("braslet")
    expect(slugByTitle("Серьги-пусеты «Звезда» с молдавитом")).toBe("sergi")
    expect(slugByTitle("Кулон Дракон из метеорита Алетай, амулет")).toBe("amulet")
    expect(slugByTitle("Метеоритный кулон")).toBe("amulet")
  })

  it("предмет замаплен — маршруты трёх площадок; оберег-браслет — в браслеты", () => {
    const r = routeCard(cats, card({ subject: "Обереги", title: "Браслет из Ливийского стекла" }))
    expect(r.slug).toBe("braslet")
    expect(r.ozon).toEqual({ ok: true, route: { categoryId: 17027899, typeId: 87458883, materialAttrId: 5309, sizeAttr: true, tnvedFromWb: false } })
    expect(r.ym).toEqual({ ok: true, route: { marketCategoryId: 67678046, sizeParamId: 32835410 } })
    expect(r.kit).toEqual({ ok: true, route: { categoryId: "01a05c9a-e6ea-7170-be89-106aa6cc1d3f" } })
  })

  it("незамапленный предмет — стоп на всех площадках; открытки — не зеркалятся", () => {
    const unknown = routeCard(cats, card({ subject: "Статуэтки" }))
    expect(unknown.slug).toBeNull()
    expect(unknown.ozon).toEqual({ ok: false, reason: "предмет WB «Статуэтки» не замаплен в config/card-categories.json — стоп (решение 25.09, п. 16)" })
    expect(routeCard(cats, card({ subject: "Открытки" })).kit).toEqual({ ok: false, reason: "предмет WB «Открытки» не зеркалится (решение 03.06)" })
  })

  it("серьги, часы и шармы выкладываются через API (решение 29.09 п. 5)", () => {
    const earrings = routeCard(cats, card({ subject: "Обереги", title: "Серьги-пусеты «Звезда» с молдавитом, нержавеющая сталь" }))
    expect(earrings.slug).toBe("sergi")
    expect(earrings.ozon).toEqual({ ok: true, route: { categoryId: 17027899, typeId: 87593412, materialAttrId: 5309, sizeAttr: false, tnvedFromWb: false } })
    expect(earrings.ym).toEqual({ ok: true, route: { marketCategoryId: 66257495, sizeParamId: null } })
    const watch = routeCard(cats, card({ subject: "Часы наручные", title: "Часы наручные женские с метеоритом Муонионалуста, подарок" }))
    expect(watch.ozon).toEqual({ ok: true, route: { categoryId: 17027904, typeId: 91758, materialAttrId: null, sizeAttr: false, tnvedFromWb: true } })
    expect(watch.ym).toEqual({ ok: true, route: { marketCategoryId: 91259, sizeParamId: null } })
    expect(routeCard(cats, card({ subject: "Шармы-подвески", title: "Шарм с метеоритом" })).ozon).toMatchObject({ ok: true, route: { typeId: 87458901 } })
  })

  it("«серебро 925» маршрут не закрывает (решение 17.09 отменено 29.09)", () => {
    const r = routeCard(cats, card({ subject: "Подвески бижутерные", title: "Подвеска «Космическое сердце»", description: "Основа из Серебра 925 пробы" }))
    expect([r.ozon.ok, r.ym.ok, r.kit.ok]).toEqual([true, true, true])
  })

  it("битый конфиг — ошибка с местом", () => {
    expect(() => parseCardCategories({ subjects: { Браслеты: "braslet" }, slugs: {} })).toThrow(/slugs\.braslet/)
    expect(() => parseCardCategories({ subjects: { Браслеты: "bracelet" }, slugs: {} })).toThrow(/subjects\.Браслеты/)
  })
})
```
`apps/worker/src/card-config.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { loadCardCategories } from "./card-config"

describe("config/card-categories.json", () => {
  it("читается и разбирается: все предметы WB каталога 29.09 на месте", () => {
    const c = loadCardCategories()
    for (const s of ["Обереги", "Подвески бижутерные", "Природные материалы для творчества", "Браслеты", "Кольца", "Серьги", "Часы наручные", "Шармы-подвески"]) {
      expect(c.subjects.has(s)).toBe(true)
    }
  })
})
```
Run: `npx vitest run packages/domain/src/card-route.test.ts apps/worker/src/card-config.test.ts` → FAIL.

- [ ] **Step 3: Реализация.** `packages/domain/src/card-route.ts`:
```ts
import { CARD_SLUGS, type CardRoute, type CardSlug, type KitRoute, type OzonRoute, type Routed, type WbCardContent, type YmRoute } from "@sync2/shared"

type SlugRoutes = { ozon: Routed<OzonRoute>; ym: Routed<YmRoute>; kit: Routed<KitRoute> }

export interface CardCategories {
  /** Предмет WB → маршрут; "by-title" — по названию (Обереги); null — не зеркалится. */
  subjects: ReadonlyMap<string, CardSlug | "by-title" | null>
  slugs: ReadonlyMap<CardSlug, SlugRoutes>
}

const isSlug = (v: unknown): v is CardSlug => typeof v === "string" && (CARD_SLUGS as readonly string[]).includes(v)
const obj = (v: unknown, where: string): Record<string, unknown> => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error(`card-categories: ${where} — не объект`)
  return v as Record<string, unknown>
}
const int = (v: unknown, where: string): number => {
  if (!Number.isSafeInteger(v) || (v as number) <= 0) throw new Error(`card-categories: ${where} — не целое положительное`)
  return v as number
}

function routed<T>(v: unknown, where: string, parse: (o: Record<string, unknown>) => T): Routed<T> {
  const o = obj(v, where)
  if (typeof o.skip === "string" && o.skip.trim() !== "") return { ok: false, reason: o.skip }
  return { ok: true, route: parse(o) }
}

/** Разбор config/card-categories.json; ошибка — с местом, тихих подстановок нет. */
export function parseCardCategories(raw: unknown): CardCategories {
  const root = obj(raw, "корень")
  const subjects = new Map<string, CardSlug | "by-title" | null>()
  for (const [s, v] of Object.entries(obj(root.subjects, "subjects"))) {
    if (v !== null && v !== "by-title" && !isSlug(v)) throw new Error(`card-categories: subjects.${s} — неизвестный маршрут «${String(v)}»`)
    subjects.set(s, v)
  }
  const slugsRaw = obj(root.slugs, "slugs")
  const slugs = new Map<CardSlug, SlugRoutes>()
  const needed = new Set<CardSlug>([...subjects.values()].filter(isSlug))
  if ([...subjects.values()].includes("by-title")) for (const s of ["mineral", "braslet", "sergi", "amulet"] as const) needed.add(s)
  for (const slug of needed) {
    const where = `slugs.${slug}`
    const r = obj(slugsRaw[slug], where)
    slugs.set(slug, {
      ozon: routed(r.ozon, `${where}.ozon`, (o) => ({
        categoryId: int(o.categoryId, `${where}.ozon.categoryId`),
        typeId: int(o.typeId, `${where}.ozon.typeId`),
        materialAttrId: o.materialAttrId === null ? null : int(o.materialAttrId, `${where}.ozon.materialAttrId`),
        sizeAttr: o.sizeAttr === true,
        tnvedFromWb: o.tnvedFromWb === true,
      })),
      ym: routed(r.ym, `${where}.ym`, (o) => ({
        marketCategoryId: int(o.marketCategoryId, `${where}.ym.marketCategoryId`),
        sizeParamId: o.sizeParamId === null || o.sizeParamId === undefined ? null : int(o.sizeParamId, `${where}.ym.sizeParamId`),
      })),
      kit: routed(r.kit, `${where}.kit`, (o) => {
        if (typeof o.categoryId !== "string" || o.categoryId === "") throw new Error(`card-categories: ${where}.kit.categoryId — пусто`)
        return { categoryId: o.categoryId }
      }),
    })
  }
  return { subjects, slugs }
}

/**
 * «Обереги» по названию (02-transform.py): метеорит-образец → минерал, браслет → браслет, серьги → серьги, иначе оберег.
 * Границы слов — не \b: в JS он ASCII-шный и между кириллическими буквами не срабатывает.
 */
export function slugByTitle(title: string): CardSlug {
  const t = title.toLowerCase().trim()
  if (/^метеорит(?![а-яё])/.test(t) && /образец|горбушка|коллекционн/.test(t)) return "mineral"
  if (/^(мужской |женский )?браслет(?![а-яё])/.test(t)) return "braslet"
  if (/^серьги(?![а-яё])/.test(t)) return "sergi"
  return "amulet"
}

/** Маршрут карточки на три площадки. «Серебро 925» маршрут не закрывает (решение 17.09 отменено владельцем 29.09). */
export function routeCard(cat: CardCategories, c: WbCardContent): CardRoute {
  const fail = (reason: string): CardRoute => ({ slug: null, ozon: { ok: false, reason }, ym: { ok: false, reason }, kit: { ok: false, reason } })
  if (!cat.subjects.has(c.subject)) return fail(`предмет WB «${c.subject}» не замаплен в config/card-categories.json — стоп (решение 25.09, п. 16)`)
  const v = cat.subjects.get(c.subject) ?? null
  if (v === null) return fail(`предмет WB «${c.subject}» не зеркалится (решение 03.06)`)
  const slug = v === "by-title" ? slugByTitle(c.title) : v
  const r = cat.slugs.get(slug)
  if (!r) return fail(`маршрут «${slug}» не описан в config/card-categories.json — стоп`)
  return { slug, ...r }
}
```
`packages/domain/src/index.ts` — добавить `export * from "./card-route"`.

`apps/worker/src/card-config.ts`:
```ts
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parseCardCategories, type CardCategories } from "@sync2/domain"

export const DEFAULT_CARD_CATEGORIES_PATH = fileURLToPath(new URL("../../../config/card-categories.json", import.meta.url))

/** Категории карточек (этап 4) — файл в репозитории, как config/pricing.json. */
export function loadCardCategories(path: string = DEFAULT_CARD_CATEGORIES_PATH): CardCategories {
  return parseCardCategories(JSON.parse(readFileSync(path, "utf8")))
}
```
Заготовка `card` — `packages/domain/src/testing/card-fixture.ts` (Task 2).

- [ ] **Step 4: Проверка и коммит.**
```bash
npx vitest run packages/domain/src/card-route.test.ts apps/worker/src/card-config.test.ts && npm run typecheck
git add config/card-categories.json packages/domain/src/card-route.ts packages/domain/src/card-route.test.ts packages/domain/src/index.ts apps/worker/src/card-config.ts apps/worker/src/card-config.test.ts
git commit -m "sync2: карточки — категории WB → Ozon/ЯМ/KIT (config/card-categories.json) с серьгами и часами, обереги по названию"
```

---

### Task 4: План карточек — создания, правки, базовая линия, пропуски, разведение размеров (`@sync2/domain/card-plan`)

**Files:**
- Create: `packages/domain/src/card-plan.ts`, `packages/domain/src/card-plan.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Падающие тесты.** `packages/domain/src/card-plan.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { CardRoute, WbCardContent } from "@sync2/shared"
import { card } from "./testing/card-fixture"
import { planCards, type CardPlanInput, type ListingState, type MirrorKeys } from "./card-plan"

const OK: CardRoute = {
  slug: "braslet",
  ozon: { ok: true, route: { categoryId: 17027899, typeId: 87458883, materialAttrId: 5309, sizeAttr: true } },
  ym: { ok: true, route: { marketCategoryId: 67678046, sizeParamId: 32835410 } },
  kit: { ok: true, route: { categoryId: "kit-braslety" } },
}
const empty = (): MirrorKeys => ({ offerIds: new Set(), archivedOfferIds: new Set(), barcodeOwner: new Map() })
const single = card({ nmId: 1, vendorCode: "V1", sizes: [{ chrtId: 1, techSize: "0", wbSize: "", barcodes: ["B1"] }] })
const multi = card({
  nmId: 2,
  vendorCode: "JW-NB-AGT-M-0073",
  sizes: [
    { chrtId: 21, techSize: "19", wbSize: "1", barcodes: ["B19"] },
    { chrtId: 22, techSize: "20", wbSize: "2", barcodes: ["B20"] },
    { chrtId: 23, techSize: "21", wbSize: "3", barcodes: ["B21"] },
  ],
})
const listing = (channel: ListingState["channel"], barcode: string, over: Partial<ListingState> = {}): ListingState => ({
  channel,
  barcode,
  externalId: over.externalId ?? barcode,
  status: "active",
  contentHash: "h1",
  lastError: null,
  ...over,
})
const input = (cards: WbCardContent[], over: Partial<CardPlanInput> = {}): CardPlanInput => ({
  cards,
  hashes: new Map(cards.map((c) => [c.nmId, "h1"])),
  inStock: new Map([["B1", 1], ["B19", 1], ["B20", 2]]),
  listings: [],
  keys: { ozon: empty(), ym: empty(), kit: empty() },
  routes: new Map(cards.map((c) => [c.nmId, OK])),
  declinedSplits: new Set(),
  ...over,
})

describe("planCards — создание", () => {
  it("товар в наличии без листинга — создать на трёх площадках по артикулу; без остатка — ничего", () => {
    const p = planCards(input([single, card({ nmId: 3, vendorCode: "V3", sizes: [{ chrtId: 3, techSize: "0", wbSize: "", barcodes: ["B3"] }] })]))
    expect(p.creates.map((c) => [c.channel, c.barcode, c.offerId, c.multiSize, c.stock])).toEqual([
      ["ozon", "B1", "V1", false, 1],
      ["ym", "B1", "V1", false, 1],
      ["kit", "B1", "V1", false, 1],
    ])
    expect(p.skips).toEqual([])
  })

  it("площадка не прочитана — ни созданий, ни правок на ней", () => {
    const p = planCards(input([single], { keys: { kit: empty() } }))
    expect(p.creates.map((c) => c.channel)).toEqual(["kit"])
  })

  it("маршрут закрыт — пропуск с причиной по штрихкоду в наличии", () => {
    const p = planCards(input([single], { routes: new Map([[1, { ...OK, ym: { ok: false, reason: "предмет WB «Статуэтки» не замаплен" } }]]) }))
    expect(p.skips).toEqual([{ channel: "ym", nmId: 1, barcode: "B1", reason: "предмет WB «Статуэтки» не замаплен" }])
    expect(p.creates.map((c) => c.channel)).toEqual(["ozon", "kit"])
  })

  it("ключ занят: штрихкод у чужого оффера, оффер в архиве, оффер без штрихкода — пропуск, синк не создаёт", () => {
    const ozon: MirrorKeys = { ...empty(), barcodeOwner: new Map([["B1", "1234567890123"]]) }
    const ym: MirrorKeys = { ...empty(), archivedOfferIds: new Set(["V1"]) }
    const kit: MirrorKeys = empty()
    const p = planCards(input([single], { keys: { ozon, ym, kit } }))
    expect(p.skips.map((s) => [s.channel, s.reason])).toEqual([
      ["ozon", "штрихкод B1 уже у товара 1234567890123 на площадке (не сопоставлен или в архиве) — разобрать вручную"],
      ["ym", "оффер V1 в архиве площадки — вернуть из архива вручную, синк заново не создаёт"],
    ])
    const p2 = planCards(input([single], { keys: { ozon: { ...empty(), offerIds: new Set(["V1"]) } } }))
    expect(p2.skips[0]!.reason).toBe("оффер V1 уже есть на площадке без штрихкода B1 — разобрать вручную")
  })

  it("прошлая попытка отклонена: тот же контент — пропуск; контент WB изменился — создать заново", () => {
    const failed = listing("kit", "B1", { status: "failed", contentHash: "h1", lastError: "KIT 400: name" })
    const p = planCards(input([single], { keys: { kit: empty() }, listings: [failed] }))
    expect(p.skips).toEqual([{ channel: "kit", nmId: 1, barcode: "B1", reason: "прошлая попытка отклонена: KIT 400: name — повтор: cards retry B1 kit" }])
    const p2 = planCards(input([single], { keys: { kit: empty() }, listings: [failed], hashes: new Map([[1, "h2"]]) }))
    expect(p2.creates.map((c) => c.barcode)).toEqual(["B1"])
    // Отклонённый модерацией товар уже есть на площадке под нашим offer_id — это «наш» ключ: повтор создания = обновление.
    const rejectedOzon = listing("ozon", "B1", { status: "failed", contentHash: "h1", externalId: "V1", lastError: "FB_JEWELRY" })
    const ozonKeys: MirrorKeys = { offerIds: new Set(["V1"]), archivedOfferIds: new Set(), barcodeOwner: new Map([["B1", "V1"]]) }
    const p3 = planCards(input([single], { keys: { ozon: ozonKeys }, listings: [rejectedOzon], hashes: new Map([[1, "h2"]]) }))
    expect(p3.creates.map((c) => [c.channel, c.offerId])).toEqual([["ozon", "V1"]])
  })

  it("новая многоразмерная без офферов — сразу вариантами: первый размер — артикул, остальные — артикул-размер", () => {
    const p = planCards(input([multi], { keys: { ozon: empty() } }))
    expect(p.creates.map((c) => [c.barcode, c.offerId, c.size, c.multiSize])).toEqual([
      ["B19", "JW-NB-AGT-M-0073", "19", true],
      ["B20", "JW-NB-AGT-M-0073-20", "20", true],
    ])
  })
})

describe("planCards — правки и базовая линия", () => {
  it("листинг без хеша — базовая линия (без правки); хеш другой — правка по карточке; ожидающий — ничего", () => {
    const p = planCards(
      input([single, multi], {
        hashes: new Map([[1, "h2"], [2, "h1"]]),
        listings: [listing("ozon", "B1", { externalId: "V1" }), listing("kit", "B1", { contentHash: null, externalId: "var-1" }), listing("ym", "B19", { status: "pending", contentHash: "h0" })],
        keys: { ozon: empty(), kit: empty(), ym: empty() },
        inStock: new Map(),
      }),
    )
    expect(p.baselines).toEqual([{ channel: "kit", barcode: "B1", hash: "h2" }])
    expect(p.edits).toEqual([{ channel: "ozon", nmId: 1, fromHash: "h1", toHash: "h2", listings: [{ barcode: "B1", externalId: "V1" }] }])
  })

  it("правка на всех трёх площадках — по правке на площадку, без пропусков (серебро 925 не ограничение с 29.09)", () => {
    const p = planCards(
      input([single], {
        hashes: new Map([[1, "h2"]]),
        listings: [listing("ozon", "B1"), listing("ym", "B1"), listing("kit", "B1")],
        inStock: new Map(),
      }),
    )
    expect(p.edits.map((e) => e.channel)).toEqual(["ozon", "ym", "kit"])
    expect(p.skips).toEqual([])
  })
})

describe("planCards — разведение размеров (п. 18)", () => {
  it("Ozon/ЯМ: существующий оффер остаётся своим размером, недостающие в наличии — в разведение; KIT — создание варианта", () => {
    const p = planCards(input([multi], { listings: [listing("ozon", "B19", { externalId: "JW-NB-AGT-M-0073" }), listing("kit", "B19", { externalId: "var-19" })] }))
    expect(p.splits).toEqual([
      { channel: "ozon", nmId: 2, keep: [{ barcode: "B19", offerId: "JW-NB-AGT-M-0073", size: "19" }], create: [{ barcode: "B20", offerId: "JW-NB-AGT-M-0073-20", size: "20", stock: 2 }] },
    ])
    expect(p.creates.map((c) => [c.channel, c.barcode, c.offerId])).toEqual([
      ["ym", "B19", "JW-NB-AGT-M-0073"],
      ["ym", "B20", "JW-NB-AGT-M-0073-20"],
      ["kit", "B20", "JW-NB-AGT-M-0073"],
    ])
  })

  it("владелец оставил один оффер — пропуск; размер не поддержан маршрутом — пропуск", () => {
    const declined = planCards(input([multi], { keys: { ozon: empty() }, listings: [listing("ozon", "B19", { externalId: "JW-NB-AGT-M-0073" })], declinedSplits: new Set(["ozon:2"]) }))
    expect(declined.splits).toEqual([])
    expect(declined.skips).toEqual([{ channel: "ozon", nmId: 2, barcode: "B20", reason: "владелец оставил один оффер на артикул (п. 18) — размеры не разводятся" }])
    const noSize: CardRoute = { ...OK, ym: { ok: true, route: { marketCategoryId: 69264438, sizeParamId: null } } }
    const p = planCards(input([multi], { keys: { ym: empty() }, routes: new Map([[2, noSize]]) }))
    expect(p.creates).toEqual([])
    expect(p.skips.map((s) => s.reason)).toEqual(["размеры на ЯМ для этого вида изделия не поддержаны — нужна характеристика размера в config/card-categories.json", "размеры на ЯМ для этого вида изделия не поддержаны — нужна характеристика размера в config/card-categories.json"])
  })
})
```
Run: `npx vitest run packages/domain/src/card-plan.test.ts` → FAIL (нет модуля).

- [ ] **Step 2: Реализация.** `packages/domain/src/card-plan.ts`:
```ts
import { CARD_CHANNELS, sizeLabel, type CardChannel, type CardRoute, type ListingStatus, type WbCardContent, type WbCardSize } from "@sync2/shared"

export interface ListingState {
  channel: CardChannel
  barcode: string
  /** offer_id Ozon/ЯМ, id варианта KIT. */
  externalId: string
  status: ListingStatus
  /** Хеш контента WB, с которого товар синхронизирован; null — ни синхронизации, ни базовой линии. */
  contentHash: string | null
  lastError: string | null
}

/** Ключи площадки, прочитанные живьём (с архивом): «нет на площадке» проверяется по ним, а не по снимку остатков. */
export interface MirrorKeys {
  /** Живые ключи товаров: offer_id Ozon/ЯМ, артикул (sku) KIT. */
  offerIds: ReadonlySet<string>
  archivedOfferIds: ReadonlySet<string>
  /** Штрихкод → ключ товара площадки, у которого он стоит (включая архив), — кроме уже сопоставленных листингов. */
  barcodeOwner: ReadonlyMap<string, string>
}

export interface CardPlanInput {
  cards: readonly WbCardContent[]
  hashes: ReadonlyMap<number, string>
  /** Штрихкод → остаток пула; создаются только товары в наличии (решение п. 16). */
  inStock: ReadonlyMap<string, number>
  listings: readonly ListingState[]
  /** Прочитанные площадки; нет площадки — по ней ни созданий, ни правок в этом прогоне. */
  keys: Partial<Record<CardChannel, MirrorKeys>>
  routes: ReadonlyMap<number, CardRoute>
  /** `${channel}:${nmId}` — владелец ответил «оставить один оффер» (п. 18). */
  declinedSplits: ReadonlySet<string>
}

export interface CardCreate {
  channel: CardChannel
  nmId: number
  barcode: string
  /** offer_id Ozon/ЯМ; артикул (sku) KIT. */
  offerId: string
  size: string | null
  /** У карточки WB больше одного размера — варианты группируются (Ozon 9048+5326, ЯМ 200+размер, KIT «Размер»). */
  multiSize: boolean
  stock: number
}

export interface CardEditPlan {
  channel: CardChannel
  nmId: number
  fromHash: string
  toHash: string
  listings: Array<{ barcode: string; externalId: string }>
}

export interface CardBaseline {
  channel: CardChannel
  barcode: string
  hash: string
}

export interface CardSkip {
  channel: CardChannel
  nmId: number
  barcode: string
  reason: string
}

export interface CardSplitPlan {
  channel: "ozon" | "ym"
  nmId: number
  /** Офферы, которые остаются (продажи, отзывы), — своим размером. */
  keep: Array<{ barcode: string; offerId: string; size: string | null }>
  create: Array<{ barcode: string; offerId: string; size: string; stock: number }>
}

export interface CardPlan {
  creates: CardCreate[]
  edits: CardEditPlan[]
  baselines: CardBaseline[]
  skips: CardSkip[]
  splits: CardSplitPlan[]
}

const LABEL: Record<CardChannel, string> = { ozon: "Ozon", ym: "ЯМ", kit: "KIT" }

/** Ключ товара на площадке уже занят чем-то, что синк не сопоставил, — не создаём (урок v1: дубли ЯМ). */
function conflict(channel: CardChannel, keys: MirrorKeys, offerId: string, barcode: string): string | null {
  const owner = keys.barcodeOwner.get(barcode)
  if (owner !== undefined) return `штрихкод ${barcode} уже у товара ${owner} на площадке (не сопоставлен или в архиве) — разобрать вручную`
  if (channel === "kit") return null // у KIT артикул общий у размеров одного продукта
  if (keys.archivedOfferIds.has(offerId)) return `оффер ${offerId} в архиве площадки — вернуть из архива вручную, синк заново не создаёт`
  if (keys.offerIds.has(offerId)) return `оффер ${offerId} уже есть на площадке без штрихкода ${barcode} — разобрать вручную`
  return null
}

function sizeSupported(channel: CardChannel, route: CardRoute): boolean {
  if (channel === "ozon") return route.ozon.ok && route.ozon.route.sizeAttr
  if (channel === "ym") return route.ym.ok && route.ym.route.sizeParamId !== null
  return true
}

const sizeOfferId = (vendorCode: string, size: string | null, barcode: string) => (size ? `${vendorCode}-${size}` : `${vendorCode}-${barcode}`)

/** План карточек одного прогона. Чистая функция: сеть, база и пределы — у джобы. */
export function planCards(input: CardPlanInput): CardPlan {
  const plan: CardPlan = { creates: [], edits: [], baselines: [], skips: [], splits: [] }
  const byKey = new Map(input.listings.map((l) => [`${l.channel}\u0000${l.barcode}`, l]))
  for (const card of input.cards) {
    const hash = input.hashes.get(card.nmId)
    const route = input.routes.get(card.nmId)
    if (!hash || !route) continue
    const units = card.sizes
      .flatMap((s: WbCardSize) => s.barcodes.map((barcode) => ({ barcode, size: sizeLabel(s) })))
      .sort((a, b) => (a.size ?? "").localeCompare(b.size ?? "", "ru", { numeric: true }))
    const multi = units.length > 1
    for (const channel of CARD_CHANNELS) {
      const keys = input.keys[channel]
      if (!keys) continue
      const skip = (barcode: string, reason: string) => plan.skips.push({ channel, nmId: card.nmId, barcode, reason })
      const mine = units.map((u) => ({ ...u, listing: byKey.get(`${channel}\u0000${u.barcode}`) ?? null }))

      // Базовая линия и правки — по товарам, которые на площадке уже есть.
      const changed: Array<{ barcode: string; externalId: string; from: string }> = []
      for (const m of mine) {
        const l = m.listing
        if (!l || l.status !== "active") continue
        if (l.contentHash === null) plan.baselines.push({ channel, barcode: m.barcode, hash })
        else if (l.contentHash !== hash) changed.push({ barcode: m.barcode, externalId: l.externalId, from: l.contentHash })
      }
      if (changed.length > 0) {
        plan.edits.push({ channel, nmId: card.nmId, fromHash: changed[0]!.from, toHash: hash, listings: changed.map((c) => ({ barcode: c.barcode, externalId: c.externalId })) })
      }

      // Создание — только в наличии (п. 16); failed с тем же контентом — не повторяется.
      const missing = mine.filter((m) => (input.inStock.get(m.barcode) ?? 0) > 0 && (m.listing === null || m.listing.status === "failed"))
      if (missing.length === 0) continue
      const routed = route[channel]
      if (!routed.ok) {
        for (const m of missing) skip(m.barcode, routed.reason)
        continue
      }
      const todo = missing.filter((m) => {
        if (m.listing?.status === "failed" && m.listing.contentHash === hash) {
          skip(m.barcode, `прошлая попытка отклонена: ${m.listing.lastError ?? "без текста"} — повтор: cards retry ${m.barcode} ${channel}`)
          return false
        }
        return true
      })
      if (todo.length === 0) continue
      const stock = (b: string) => input.inStock.get(b) ?? 0

      /** Отклонённый ранее товар под тем же ключом — наш (повтор создания площадка примет как обновление). */
      const ours = (m: (typeof todo)[number], offerId: string) => m.listing?.status === "failed" && m.listing.externalId === offerId
      if (channel === "kit") {
        for (const m of todo) {
          const why = ours(m, card.vendorCode) ? null : conflict(channel, keys, card.vendorCode, m.barcode)
          if (why) skip(m.barcode, why)
          else plan.creates.push({ channel, nmId: card.nmId, barcode: m.barcode, offerId: card.vendorCode, size: m.size, multiSize: multi, stock: stock(m.barcode) })
        }
        continue
      }
      if (multi && !sizeSupported(channel, route)) {
        for (const m of todo) skip(m.barcode, `размеры на ${LABEL[channel]} для этого вида изделия не поддержаны — нужна характеристика размера в config/card-categories.json`)
        continue
      }
      const existing = mine.filter((m) => m.listing?.status === "active" || m.listing?.status === "pending")
      if (multi && existing.length > 0) {
        // Разведение размеров — вопросом (решение этапа 5): у существующего оффера продажи и отзывы.
        if (input.declinedSplits.has(`${channel}:${card.nmId}`)) {
          for (const m of todo) skip(m.barcode, "владелец оставил один оффер на артикул (п. 18) — размеры не разводятся")
          continue
        }
        const create: CardSplitPlan["create"] = []
        for (const m of todo) {
          const offerId = sizeOfferId(card.vendorCode, m.size, m.barcode)
          const why = ours(m, offerId) ? null : conflict(channel, keys, offerId, m.barcode)
          if (why) skip(m.barcode, why)
          else create.push({ barcode: m.barcode, offerId, size: m.size ?? m.barcode, stock: stock(m.barcode) })
        }
        if (create.length > 0) {
          plan.splits.push({
            channel,
            nmId: card.nmId,
            keep: existing.map((m) => ({ barcode: m.barcode, offerId: m.listing!.externalId, size: m.size })),
            create,
          })
        }
        continue
      }
      // Новая карточка на площадке: первый размер — артикул, остальные — артикул-размер.
      let first = true
      for (const m of todo) {
        const offerId = m.listing?.status === "failed" ? m.listing.externalId : first ? card.vendorCode : sizeOfferId(card.vendorCode, m.size, m.barcode)
        const why = ours(m, offerId) ? null : conflict(channel, keys, offerId, m.barcode)
        if (why) {
          skip(m.barcode, why)
          continue
        }
        plan.creates.push({ channel, nmId: card.nmId, barcode: m.barcode, offerId, size: m.size, multiSize: multi, stock: stock(m.barcode) })
        first = false
      }
    }
  }
  return plan
}
```
Тест «разведение» ожидает: на Ozon — вопрос о разведении (оффер `JW-NB-AGT-M-0073` остаётся размером 19, создаётся `…-20`); на ЯМ листинга нет — карточка создаётся сразу вариантами; в KIT — вариант B20; B21 без остатка не создаётся нигде.

`packages/domain/src/index.ts` — добавить `export * from "./card-plan"`.

- [ ] **Step 3: Проверка и коммит.**
```bash
npx vitest run packages/domain/src/card-plan.test.ts && npm run typecheck && npm test
git add packages/domain/src/card-plan.ts packages/domain/src/card-plan.test.ts packages/domain/src/index.ts
git commit -m "sync2: карточки — план прогона: создания по артикулу с проверкой ключей и архива, базовая линия, правки, пропуски с причинами, разведение размеров"
```

---

## Часть B — площадки (сеть только здесь)

### Task 5: WB — полный контент карточек (`wb/card-content.ts`)

**Files:**
- Create: `packages/platforms/src/wb/card-content.ts`, `packages/platforms/src/wb/card-content.test.ts`
- Modify: `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающий тест** (на фикстуре живого ответа `wb/fixtures/cards-list-sample.json`). `packages/platforms/src/wb/card-content.test.ts`:
```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { mapWbCardContent, type WbCardFullItem } from "./card-content"

const sample = JSON.parse(readFileSync(new URL("./fixtures/cards-list-sample.json", import.meta.url), "utf8")) as { cards: WbCardFullItem[] }

describe("WB — контент карточки для зеркал", () => {
  it("живой ответ: фото big, габариты в см/кг, размер без techSize, характеристики строками, видео — ссылка HLS", () => {
    const c = mapWbCardContent(sample.cards[0]!)!
    expect(c).toMatchObject({
      nmId: 1532076295,
      vendorCode: "87576556434",
      brand: "KOTELNIKOVARTIFACT",
      subject: "Обереги",
      title: "Метеорит Сихотэ-Алинь коллекционный образец 4,6 гр, оберег",
      dimensions: { lengthCm: 25, widthCm: 15, heightCm: 6, weightKg: 0.01 },
      sizes: [{ techSize: "0", wbSize: "", barcodes: ["2056117304256"] }],
    })
    expect(c.photos).toHaveLength(7)
    expect(c.photos[0]).toBe("https://basket-48.wbbasket.ru/vol15320/part1532076/1532076295/images/big/1.webp")
    expect(c.characteristics.find((x) => x.name === "Цвет")).toEqual({ id: 14177449, name: "Цвет", values: ["графит"] })
    expect(c.video).toBe("https://videonme-basket-09.wbbasket.ru/vol103/part153207/1532076295/hls/1440p/index.m3u8")
    expect(mapWbCardContent({ ...sample.cards[0]!, video: " " })!.video).toBeNull()
  })

  it("число в значении — строкой; без артикула или nmID — карточки нет; битые габариты — null", () => {
    const base = sample.cards[0]!
    const c = mapWbCardContent({ ...base, characteristics: [{ id: 90673, name: "Ширина предмета", value: 2 }], dimensions: { length: 25, width: 0, height: 6, weightBrutto: 0.01 } })!
    expect(c.characteristics).toEqual([{ id: 90673, name: "Ширина предмета", values: ["2"] }])
    expect(c.dimensions).toBeNull()
    expect(mapWbCardContent({ ...base, vendorCode: " " })).toBeNull()
    expect(mapWbCardContent({ ...base, nmID: null })).toBeNull()
  })

  it("размеры: techSize/wbSize, пустые штрихкоды отбрасываются, размер без штрихкодов — тоже", () => {
    const c = mapWbCardContent({
      ...sample.cards[0]!,
      sizes: [
        { chrtID: 639524344, techSize: "21", wbSize: "3", skus: ["2044616238615", " "] },
        { chrtID: 1, techSize: "22", wbSize: "4", skus: [] },
      ],
    })!
    expect(c.sizes).toEqual([{ chrtId: 639524344, techSize: "21", wbSize: "3", barcodes: ["2044616238615"] }])
  })
})
```
Run: `npx vitest run packages/platforms/src/wb/card-content.test.ts` → FAIL (нет модуля).

- [ ] **Step 2: Реализация.** `packages/platforms/src/wb/card-content.ts`:
```ts
import type { WbCardContent, WbCharacteristic } from "@sync2/shared"
import { fetchAllCards, type WbCardListItem } from "./client"

/**
 * Карточка перечня `content/v2/get/cards/list` со всеми полями контента (фикстура cards-list-sample.json, 29.09).
 * `video` — HLS-плейлист (m3u8): синк собирает из него mp4 (Task 13).
 */
export interface WbCardFullItem extends WbCardListItem {
  brand?: string | null
  description?: string | null
  characteristics?: Array<{ id?: number | null; name?: string | null; value?: unknown }> | null
  photos?: Array<{ big?: string | null }> | null
  dimensions?: { length?: number | null; width?: number | null; height?: number | null; weightBrutto?: number | null } | null
  sizes?: Array<{ chrtID?: number | null; techSize?: string | null; wbSize?: string | null; skus?: string[] | null }> | null
  video?: string | null
  updatedAt?: string | null
}

/** Значение характеристики WB — массив строк или число/строка («Ширина предмета»: 2). */
function valuesOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter((x) => x !== "")
  if (typeof v === "number" || typeof v === "string") {
    const s = String(v).trim()
    return s === "" ? [] : [s]
  }
  return []
}

const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0

/** Карточка → контент для зеркал; без nmID или артикула — null (ключ зеркала не выдумывается). */
export function mapWbCardContent(item: WbCardFullItem): WbCardContent | null {
  const vendorCode = item.vendorCode?.trim() ?? ""
  const nmId = item.nmID
  if (typeof nmId !== "number" || !Number.isSafeInteger(nmId) || nmId <= 0 || vendorCode === "") return null
  const d = item.dimensions ?? null
  const characteristics: WbCharacteristic[] = []
  for (const c of item.characteristics ?? []) {
    const name = c.name?.trim() ?? ""
    if (typeof c.id === "number" && Number.isSafeInteger(c.id) && name !== "") characteristics.push({ id: c.id, name, values: valuesOf(c.value) })
  }
  return {
    nmId,
    vendorCode,
    brand: item.brand?.trim() ?? "",
    subject: item.subjectName?.trim() ?? "",
    title: item.title?.trim() || vendorCode,
    description: item.description ?? "",
    characteristics,
    photos: (item.photos ?? []).flatMap((p) => (p.big ? [p.big] : [])),
    dimensions:
      d && positive(d.length) && positive(d.width) && positive(d.height) && positive(d.weightBrutto)
        ? { lengthCm: d.length, widthCm: d.width, heightCm: d.height, weightKg: d.weightBrutto }
        : null,
    sizes: (item.sizes ?? [])
      .map((s) => ({
        chrtId: typeof s.chrtID === "number" && Number.isSafeInteger(s.chrtID) && s.chrtID > 0 ? s.chrtID : null,
        techSize: s.techSize?.trim() ?? "",
        wbSize: s.wbSize?.trim() ?? "",
        barcodes: (s.skus ?? []).map((b) => b?.trim() ?? "").filter((b) => b !== ""),
      }))
      .filter((s) => s.barcodes.length > 0),
    video: item.video?.trim() || null,
  }
}

/**
 * Все карточки продавца с контентом (4 страницы по 100 на 29.09; лимит «Контента» 100/мин). Карточка, которой нет
 * в этом чтении, не считается удалённой (сбой 29.09 13:51: курсор по updatedAt пропускает карточки, обновлённые во
 * время чтения) — джоба cards её просто не обрабатывает в этом прогоне.
 */
export async function fetchWbCardContents(token: string): Promise<{ cards: WbCardContent[]; rejected: number }> {
  const items = (await fetchAllCards(token)) as WbCardFullItem[]
  const cards: WbCardContent[] = []
  let rejected = 0
  for (const it of items) {
    const c = mapWbCardContent(it)
    if (c) cards.push(c)
    else rejected++
  }
  return { cards, rejected }
}
```
`packages/platforms/src/index.ts` — добавить:
```ts
export { fetchWbCardContents, mapWbCardContent, type WbCardFullItem } from "./wb/card-content"
```

- [ ] **Step 3: Проверка и коммит.**
```bash
npx vitest run packages/platforms/src/wb/card-content.test.ts && npm run typecheck
git add packages/platforms/src/wb/card-content.ts packages/platforms/src/wb/card-content.test.ts packages/platforms/src/index.ts
git commit -m "sync2: WB — полный контент карточек для зеркал (фото big, габариты, размеры, характеристики строками, ссылка на видео HLS)"
```

---

### Task 6: Ozon — маппер (перенос `02-transform.py`, серьги, часы, видео, переимпорт габаритов), ключи с архивом, модерация, словарь, лимит, запись с проверкой

**Files:**
- Create: `packages/platforms/src/ozon/card-mapper.ts`, `packages/platforms/src/ozon/card-mapper.test.ts`, `packages/platforms/src/ozon/cards.ts`, `packages/platforms/src/ozon/cards.test.ts`
- Modify: `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающие тесты.** `packages/platforms/src/ozon/card-mapper.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import type { WbCardContent } from "@sync2/shared"
import { OZON_DICT, ozonEditAttributes, ozonGroupAttributes, ozonImportItem, ozonReimportItem, ozonVideoAttributes, type OzonAttr, type OzonProductFull } from "./card-mapper"

const content = (over: Partial<WbCardContent> = {}): WbCardContent => ({
  nmId: 327127352,
  vendorCode: "JW-NB-AGT-M-0073",
  brand: "KOTELNIKOVARTIFACT",
  subject: "Браслеты",
  title: "Браслет Синергия с метеоритом Алетай и лабрадоритом",
  description: "Браслет из натуральных камней с метеоритом Алетай.",
  characteristics: [
    { id: 14177449, name: "Цвет", values: ["серебристый", "черный"] },
    { id: 378533, name: "Комплектация", values: ["Браслет, подарочный мешочек, фирменная коробочка, сертификат"] },
  ],
  photos: ["https://basket-20.wbbasket.ru/vol3271/part327127/327127352/images/big/1.webp"],
  dimensions: { lengthCm: 30, widthCm: 20, heightCm: 3, weightKg: 0.1 },
  sizes: [{ chrtId: 1, techSize: "19", wbSize: "1", barcodes: ["2042770600712"] }],
  video: null,
  ...over,
})
const attr = (attrs: OzonAttr[], id: number) => attrs.find((a) => a.id === id)?.values
const BRASLET = { categoryId: 17027899, typeId: 87458883, materialAttrId: 5309, sizeAttr: true, tnvedFromWb: false }

describe("Ozon — item импорта (02-transform.py)", () => {
  it("браслет: категория/тип, бренд только словарём, 9048 = артикул, ТН ВЭД нанизанные, материал, цвет, пол, комплектация, размер; габариты мм/г", () => {
    const it = ozonImportItem({ content: content(), slug: "braslet", route: BRASLET, offerId: "JW-NB-AGT-M-0073-19", barcode: "2042770600712", size: { dictId: 971012345 }, countryDictId: null, tnvedDictId: null, price: { priceMinor: 1149000, oldMinor: 1580000 } })
    expect(it).toMatchObject({
      offer_id: "JW-NB-AGT-M-0073-19",
      name: "Браслет Синергия с метеоритом Алетай и лабрадоритом",
      description_category_id: 17027899,
      type_id: 87458883,
      barcode: "2042770600712",
      price: "11490.00",
      old_price: "15800.00",
      vat: "0",
      currency_code: "RUB",
      primary_image: "https://basket-20.wbbasket.ru/vol3271/part327127/327127352/images/big/1.webp",
      depth: 300,
      width: 200,
      height: 30,
      dimension_unit: "mm",
      weight: 100,
      weight_unit: "g",
    })
    expect(attr(it.attributes, 85)).toEqual([{ dictionary_value_id: OZON_DICT.brand }])
    expect(attr(it.attributes, 9048)).toEqual([{ value: "JW-NB-AGT-M-0073" }])
    expect(attr(it.attributes, 22232)).toEqual([{ dictionary_value_id: OZON_DICT.tnvedStrung }])
    expect(attr(it.attributes, 23536)).toEqual([{ value: "false" }])
    expect(attr(it.attributes, 5309)).toEqual([{ dictionary_value_id: OZON_DICT.matMetall }])
    expect(attr(it.attributes, 10096)).toEqual([{ dictionary_value_id: 61610 }])
    expect(attr(it.attributes, 9163)).toEqual([{ dictionary_value_id: OZON_DICT.genderM }, { dictionary_value_id: OZON_DICT.genderF }])
    expect(attr(it.attributes, 4384)).toEqual([{ value: "Браслет, подарочный мешочек, фирменная коробочка, сертификат" }])
    expect(attr(it.attributes, 5326)).toEqual([{ dictionary_value_id: 971012345 }])
    expect(attr(it.attributes, 4389)).toBeUndefined()
  })

  it("оберег и минерал: материал своего атрибута, вид оберега, минеральные атрибуты, страна — если найдена", () => {
    const amulet = ozonImportItem({
      content: content({ subject: "Обереги", title: "Кулон Дракон из метеорита Алетай, амулет оберег резной", characteristics: [] }),
      slug: "amulet",
      route: { categoryId: 87515080, typeId: 93733, materialAttrId: 7405, sizeAttr: false, tnvedFromWb: false },
      offerId: "987896756453",
      barcode: "2050761441312",
      size: null,
      countryDictId: 90295,
      tnvedDictId: null,
      price: { priceMinor: 2000000, oldMinor: 2500000 },
    })
    expect(attr(amulet.attributes, 7405)).toEqual([{ dictionary_value_id: OZON_DICT.matMetall }])
    expect(attr(amulet.attributes, 23392)).toEqual([{ dictionary_value_id: OZON_DICT.artAmulet }])
    expect(attr(amulet.attributes, 4389)).toEqual([{ dictionary_value_id: 90295 }])
    expect(attr(amulet.attributes, 22232)).toEqual([{ dictionary_value_id: OZON_DICT.tnvedMetall }])
    const mineral = ozonImportItem({
      content: content({ subject: "Обереги", title: "Метеорит Царёв каменный, коллекционный образец 18 г", characteristics: [] }),
      slug: "mineral",
      route: { categoryId: 17028994, typeId: 970801724, materialAttrId: 6383, sizeAttr: false, tnvedFromWb: false },
      offerId: "555978675645",
      barcode: "2052025128915",
      size: null,
      countryDictId: null,
      tnvedDictId: null,
      price: { priceMinor: 500000, oldMinor: 700000 },
    })
    expect(attr(mineral.attributes, 6383)).toEqual([{ dictionary_value_id: OZON_DICT.matStone }])
    expect(attr(mineral.attributes, 22232)).toEqual([{ dictionary_value_id: OZON_DICT.tnvedCollection }])
    expect(attr(mineral.attributes, 5007)).toEqual([{ dictionary_value_id: OZON_DICT.petrofilia }])
    expect(attr(mineral.attributes, 4382)).toEqual([{ value: "300x200x30" }])
  })

  it("серьги — как подвеска (5309, пол, ТН ВЭД бижутерии); часы — без материала, ТН ВЭД из WB словарём, пол по названию", () => {
    const earrings = ozonImportItem({
      content: content({ subject: "Обереги", title: "Серьги-пусеты «Звезда» с молдавитом, нержавеющая сталь", characteristics: [] }),
      slug: "sergi",
      route: { categoryId: 17027899, typeId: 87593412, materialAttrId: 5309, sizeAttr: false, tnvedFromWb: false },
      offerId: "7575443412",
      barcode: "2055074620560",
      size: null,
      countryDictId: null,
      tnvedDictId: null,
      price: { priceMinor: 300000, oldMinor: 400000 },
    })
    expect(earrings.type_id).toBe(87593412)
    expect(attr(earrings.attributes, 5309)).toBeDefined()
    expect(attr(earrings.attributes, 9163)).toHaveLength(2)
    expect(attr(earrings.attributes, 23171)).toEqual([{ value: "#серьги #подарок" }])
    const watch = ozonImportItem({
      content: content({ subject: "Часы наручные", title: "Часы наручные женские с метеоритом Муонионалуста, подарок", characteristics: [], dimensions: { lengthCm: 20, widthCm: 15, heightCm: 4, weightKg: 0.5 } }),
      slug: "chasy",
      route: { categoryId: 17027904, typeId: 91758, materialAttrId: null, sizeAttr: false, tnvedFromWb: true },
      offerId: "6565542",
      barcode: "2044245185854",
      size: null,
      countryDictId: 90296,
      tnvedDictId: 971500001,
      price: { priceMinor: 3000000, oldMinor: 3500000 },
    })
    expect(watch).toMatchObject({ description_category_id: 17027904, type_id: 91758, depth: 200, width: 150, height: 40, weight: 500 })
    expect(attr(watch.attributes, 22232)).toEqual([{ dictionary_value_id: 971500001 }])
    expect(attr(watch.attributes, 9163)).toEqual([{ dictionary_value_id: OZON_DICT.genderF }])
    expect(watch.attributes.some((a) => [5309, 7405, 6383].includes(a.id))).toBe(false)
    expect(() => ozonImportItem({ content: content(), slug: "chasy", route: { categoryId: 17027904, typeId: 91758, materialAttrId: null, sizeAttr: false, tnvedFromWb: true }, offerId: "x", barcode: "y", size: null, countryDictId: null, tnvedDictId: null, price: { priceMinor: 1, oldMinor: 2 } })).toThrow(/ТН ВЭД/)
  })

  it("правка: название 4180, описание 4191, цвет — по полям; группа размера — 9048 + 5326; видео — комплекс 100001", () => {
    expect(ozonEditAttributes(content(), ["title"])).toEqual([{ id: 4180, values: [{ value: "Браслет Синергия с метеоритом Алетай и лабрадоритом" }] }])
    expect(ozonEditAttributes(content(), ["photos", "dimensions", "video"])).toEqual([])
    expect(ozonEditAttributes(content(), ["characteristics"]).map((a) => a.id)).toEqual([10096, 10097])
    expect(ozonGroupAttributes("JW-NB-AGT-M-0073", 971012345)).toEqual([
      { id: 9048, values: [{ value: "JW-NB-AGT-M-0073" }] },
      { id: 5326, values: [{ dictionary_value_id: 971012345 }] },
    ])
    expect(ozonVideoAttributes("https://kotelnikovartifact.ru/video/JW-NB-AGT-M-0073-1a2b3c4d.mp4", "Браслет Синергия")).toEqual([
      { complex_id: 100001, id: 21841, values: [{ value: "https://kotelnikovartifact.ru/video/JW-NB-AGT-M-0073-1a2b3c4d.mp4" }] },
      { complex_id: 100001, id: 21837, values: [{ value: "Браслет Синергия" }] },
    ])
  })

  it("переимпорт габаритов: полная карточка Ozon как есть, новые габариты в мм/г, текущие цены", () => {
    const row: OzonProductFull = {
      id: 777,
      offer_id: "JW-NB-AGT-M-0073",
      name: "Браслет Синергия",
      barcode: "2042770600705",
      description_category_id: 17027899,
      type_id: 87458883,
      depth: 300,
      width: 200,
      height: 30,
      dimension_unit: "mm",
      weight: 100,
      weight_unit: "g",
      images: ["https://cdn1.ozone.ru/1.jpg"],
      primary_image: "https://cdn1.ozone.ru/0.jpg",
      attributes: [{ id: 85, complex_id: 0, values: [{ dictionary_value_id: 973067008 }] }, { id: 21841, complex_id: 100001, values: [{ value: "https://kotelnikovartifact.ru/video/x.mp4" }] }],
      complex_attributes: [],
    }
    const it = ozonReimportItem(row, { lengthCm: 25, widthCm: 15, heightCm: 6, weightKg: 0.12 }, { priceMinor: 1149000, oldMinor: 1580000, vat: "0" })
    expect(it).toMatchObject({ offer_id: "JW-NB-AGT-M-0073", name: "Браслет Синергия", barcode: "2042770600705", depth: 250, width: 150, height: 60, dimension_unit: "mm", weight: 120, weight_unit: "g", price: "11490.00", old_price: "15800.00", vat: "0", images: ["https://cdn1.ozone.ru/1.jpg"], primary_image: "https://cdn1.ozone.ru/0.jpg" })
    expect(it.attributes).toEqual(row.attributes)
  })
})
```
`packages/platforms/src/ozon/cards.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "../writer"
import { fetchOzonCardKeys, fetchOzonCreateQuota, fetchOzonDictValueId, fetchOzonModeration, fetchOzonProductsFull, writeOzonCards } from "./cards"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const cfg = { clientId: "5332036", apiKey: "k", retryDelaysMs: [0], pollDelayMs: 0, pollAttempts: 2 }
afterEach(() => vi.unstubAllGlobals())
type Route = (body: Record<string, unknown>) => Response
function stub(routes: Record<string, Route | Route[]>) {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = []
  const seen = new Map<string, number>()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      calls.push({ path, body })
      const r = routes[path]
      if (!r) throw new Error(`нет маршрута ${path}`)
      const n = seen.get(path) ?? 0
      seen.set(path, n + 1)
      return Array.isArray(r) ? r[Math.min(n, r.length - 1)]!(body) : r(body)
    }),
  )
  return calls
}
const create = (offerId: string): WriteOp => ({
  channel: "ozon",
  barcode: `B-${offerId}`,
  field: "card_create",
  before: null,
  after: 1,
  externalSku: offerId,
  card: { kind: "create", nmId: 1, vendorCode: offerId, offerId, fields: ["title"], payload: { item: { offer_id: offerId } }, productRef: null, decisionId: null },
})
const edit = (offerId: string, images: string[] | null, attributes = [{ id: 4180, values: [{ value: "Новое" }] }]): WriteOp => ({
  channel: "ozon",
  barcode: `B-${offerId}`,
  field: "card_content",
  before: 1,
  after: 2,
  externalSku: offerId,
  card: { kind: "content", nmId: 1, vendorCode: offerId, offerId, fields: ["title"], payload: { attributes, images }, productRef: "777", decisionId: 5 },
})

describe("Ozon — ключи, словарь, лимит", () => {
  it("ключи: живые и архив двумя проходами v3/product/list, штрихкоды — по всем offer_id", async () => {
    const calls = stub({
      "/v3/product/list": (b) =>
        (b.filter as { visibility: string }).visibility === "ALL"
          ? json({ result: { items: [{ product_id: 1, offer_id: "JW-1", archived: false }], last_id: "" } })
          : json({ result: { items: [{ product_id: 2, offer_id: "2051508626795", archived: true }], last_id: "" } }),
      "/v3/product/info/list": () => json({ items: [{ offer_id: "JW-1", barcodes: ["2041383032873"] }, { offer_id: "2051508626795", barcodes: ["2051508626795"] }] }),
    })
    const k = await fetchOzonCardKeys(cfg)
    expect([...k.offerIds]).toEqual(["JW-1"])
    expect([...k.archivedOfferIds]).toEqual(["2051508626795"])
    expect(k.barcodeOwner.get("2051508626795")).toBe("2051508626795")
    expect(k.productIdOf.get("JW-1")).toBe(1)
    expect(calls.filter((c) => c.path === "/v3/product/list").map((c) => (c.body.filter as { visibility: string }).visibility)).toEqual(["ALL", "ARCHIVED"])
  })

  it("словарь: точное совпадение без регистра, иначе null; лимит создания — остаток суток", async () => {
    stub({
      "/v1/description-category/attribute/values/search": () => json({ result: [{ id: 5, value: "19,5" }, { id: 7, value: "19" }] }),
      "/v4/product/info/limit": () => json({ daily_create: { limit: 100, usage: 97 }, daily_update: { limit: 1000, usage: 1 }, total: { limit: 5000, usage: 81 } }),
    })
    expect(await fetchOzonDictValueId(cfg, { categoryId: 17027899, typeId: 87458883, attributeId: 5326, value: "19" })).toBe(7)
    expect(await fetchOzonDictValueId(cfg, { categoryId: 17027899, typeId: 87458883, attributeId: 5326, value: "22" })).toBeNull()
    expect(await fetchOzonCreateQuota(cfg)).toBe(3)
  })

  it("полные карточки v4 по offer_id; модерация: отклонено с текстом (УИН ГИИС ДМДК), на модерации, прошла", async () => {
    const calls = stub({
      "/v4/product/info/attributes": () => json({ result: [{ id: 1, offer_id: "A", name: "n", description_category_id: 1, type_id: 2, depth: 1, width: 1, height: 1, dimension_unit: "mm", weight: 1, weight_unit: "g", attributes: [] }], last_id: "" }),
      "/v3/product/info/list": () =>
        json({
          items: [
            { offer_id: "A", statuses: { moderate_status: "declined", status_description: "Отклонён модерацией" }, errors: [{ code: "FB_JEWELRY", level: "error", texts: { description: "Для ювелирных изделий укажите УИН ГИИС ДМДК" } }] },
            { offer_id: "B", statuses: { moderate_status: "moderating" }, errors: [] },
            { offer_id: "C", statuses: { moderate_status: "approved" }, errors: [] },
          ],
        }),
    })
    expect((await fetchOzonProductsFull(cfg, ["A"])).get("A")!.id).toBe(1)
    expect(calls[0]!.body).toMatchObject({ filter: { offer_id: ["A"], visibility: "ALL" }, limit: 1000 })
    const m = await fetchOzonModeration(cfg, ["A", "B", "C"])
    expect(m.get("A")).toEqual({ state: "rejected", text: "Отклонён модерацией; FB_JEWELRY: Для ювелирных изделий укажите УИН ГИИС ДМДК", needsDmdk: true })
    expect(m.get("B")).toEqual({ state: "pending", text: "", needsDmdk: false })
    expect(m.get("C")).toEqual({ state: "ok", text: "", needsDmdk: false })
  })
})

describe("Ozon — запись карточек", () => {
  it("создание: import → import/info до финального статуса; imported — ok с product_id, failed — отказ с кодами, pending — итог неизвестен", async () => {
    const calls = stub({
      "/v3/product/import": () => json({ result: { task_id: 42 } }),
      "/v1/product/import/info": [
        () => json({ result: { items: [{ offer_id: "A", status: "pending" }, { offer_id: "B", status: "failed", errors: [{ code: "FB_JEWELRY", level: "error" }] }, { offer_id: "C", status: "pending" }] } }),
        () => json({ result: { items: [{ offer_id: "A", status: "imported", product_id: 900 }, { offer_id: "B", status: "failed", errors: [{ code: "FB_JEWELRY", level: "error" }] }, { offer_id: "C", status: "pending" }] } }),
      ],
    })
    const r = await writeOzonCards(cfg, [create("A"), create("B"), create("C")])
    expect(r.map((x) => [x.barcode, x.ok, x.uncertain ?? false])).toEqual([["B-A", true, false], ["B-B", false, false], ["B-C", false, true]])
    expect(r[0]!.response).toMatchObject({ productId: 900 })
    expect(r[1]!.error).toContain("FB_JEWELRY")
    expect(calls[0]!.body).toEqual({ items: [{ offer_id: "A" }, { offer_id: "B" }, { offer_id: "C" }] })
  })

  it("правка: атрибуты одной задачей attributes/update, фото — pictures/import по product_id; предупреждение — не отказ", async () => {
    const calls = stub({
      "/v1/product/attributes/update": () => json({ task_id: 43 }),
      "/v1/product/import/info": () => json({ result: { items: [{ offer_id: "A", status: "imported", errors: [{ code: "W1", level: "warning" }] }] } }),
      "/v1/product/pictures/import": () => json({ result: { pictures: [{ state: "imported", url: "u1" }] } }),
    })
    const r = await writeOzonCards(cfg, [edit("A", ["u1"])])
    expect(r.map((x) => x.ok)).toEqual([true])
    expect(calls.map((c) => c.path)).toEqual(["/v1/product/attributes/update", "/v1/product/import/info", "/v1/product/pictures/import"])
    expect(calls[2]!.body).toEqual({ product_id: 777, images: ["u1"] })
  })

  it("видео — attributes/update с комплексом; габариты — переимпорт v3/product/import", async () => {
    const calls = stub({
      "/v1/product/attributes/update": () => json({ task_id: 44 }),
      "/v3/product/import": () => json({ result: { task_id: 45 } }),
      "/v1/product/import/info": (b) => json({ result: { items: [{ offer_id: b.task_id === 44 ? "V" : "D", status: "imported" }] } }),
    })
    const video: WriteOp = { ...edit("V", null, [{ id: 21841, values: [{ value: "u" }] }]), card: { ...edit("V", null).card!, kind: "video", payload: { attributes: [{ complex_id: 100001, id: 21841, values: [{ value: "u" }] }], images: null } } }
    const dims: WriteOp = { ...edit("D", null), barcode: "B-D", card: { ...edit("D", null).card!, kind: "reimport", payload: { item: { offer_id: "D", depth: 250 } } } }
    const r = await writeOzonCards(cfg, [video, dims])
    expect(r.map((x) => x.ok)).toEqual([true, true])
    expect(calls.find((c) => c.path === "/v1/product/attributes/update")!.body).toEqual({ items: [{ offer_id: "V", attributes: [{ complex_id: 100001, id: 21841, values: [{ value: "u" }] }] }] })
    expect(calls.find((c) => c.path === "/v3/product/import")!.body).toEqual({ items: [{ offer_id: "D", depth: 250 }] })
  })

  it("правка только фото — без attributes/update; фото отклонено — отказ", async () => {
    const calls = stub({ "/v1/product/pictures/import": () => json({ result: { pictures: [{ state: "failed", url: "u2" }] } }) })
    const r = await writeOzonCards(cfg, [edit("A", ["u2"], [])])
    expect(calls.map((c) => c.path)).toEqual(["/v1/product/pictures/import"])
    expect(r[0]).toMatchObject({ ok: false })
    expect(r[0]!.error).toContain("u2")
  })
})
```
Run: `npx vitest run packages/platforms/src/ozon/card-mapper.test.ts packages/platforms/src/ozon/cards.test.ts` → FAIL.

- [ ] **Step 2: Реализация — маппер.** `packages/platforms/src/ozon/card-mapper.ts` (перенос `data/ozon-import/02-transform.py`: маршрутизация — в домене, здесь — атрибуты; словарные id собраны `values/search` 18.07 и прошли модерацию 64/64; серьги — по образцу подвески, часы — атрибуты, прочитанные 29.09):
```ts
import { minorToDecimalString, type CardField, type CardSlug, type OzonRoute, type WbCardContent, type WbDimensions } from "@sync2/shared"

export interface OzonAttrValue {
  dictionary_value_id?: number
  value?: string
}
export interface OzonAttr {
  /** 0/нет — обычный атрибут; 100001 — комплекс «Озон.Видео». */
  complex_id?: number
  id: number
  values: OzonAttrValue[]
}

/** Item `POST /v3/product/import` (кабинет ИП 5332036). */
export interface OzonImportItem {
  offer_id: string
  name: string
  description_category_id: number
  type_id: number
  barcode: string
  price: string
  old_price: string
  vat: string
  currency_code: "RUB"
  images: string[]
  primary_image: string
  depth: number
  width: number
  height: number
  dimension_unit: "mm"
  weight: number
  weight_unit: "g"
  attributes: OzonAttr[]
  complex_attributes?: unknown[]
}

/** Словарные значения Ozon (02-transform.py, 18.07; бренд — 19.07). Бренд — только dictionary_value_id. */
export const OZON_DICT = {
  brand: 973067008,
  tnvedMetall: 971399026,
  tnvedStoneOther: 971399024,
  tnvedStrung: 971399023,
  tnvedStoneItem: 971398914,
  tnvedCollection: 971400839,
  genderM: 22880,
  genderF: 22881,
  artAmulet: 972870133,
  artTalisman: 972870134,
  artObereg: 972870135,
  petrofilia: 970859413,
  countryRu: 90295,
  matMetall: 61936,
  matStone: 61963,
  matTitan: 62128,
} as const

/** «Озон.Видео» (живое чтение атрибутов 29.09): комплекс 100001 — ссылка 21841 (MP4/MOV, 8 с – 5 мин, до 2 ГБ), название 21837. */
export const OZON_VIDEO = { complexId: 100001, urlAttr: 21841, nameAttr: 21837 } as const

const COLORS: ReadonlyArray<readonly [string, number]> = [
  ["серебрист", 61610],
  ["светло-коричн", 61591],
  ["темно-коричн", 61598],
  ["коричн", 61575],
  ["черно-сер", 61607],
  ["чёрн", 61574],
  ["черн", 61574],
  ["золот", 61582],
  ["сер", 61576],
]
const IRON_KW = ["муонионалуста", "сихотэ", "дронино", "кампо", "алетай", "каньон дьябло", "серичо", "железн", "метеорит nwa"]
const STONE_KW = ["царев", "царёв", "каменн", "индошинит", "ливийск", "тектит", "nwa", "натуральных камней", "натуральные камни"]

const charOf = (c: WbCardContent, name: string): string | null =>
  c.characteristics.find((x) => x.name.toLowerCase() === name.toLowerCase())?.values.join(", ") || null

function materials(t: string): number[] {
  const iron = IRON_KW.some((k) => t.includes(k))
  const stone = STONE_KW.some((k) => t.includes(k))
  if (t.includes("титан")) return [OZON_DICT.matTitan, OZON_DICT.matMetall]
  if (iron && !stone) return [OZON_DICT.matMetall]
  if (stone && !iron) return [OZON_DICT.matStone]
  return iron && stone ? [OZON_DICT.matMetall, OZON_DICT.matStone] : [OZON_DICT.matStone]
}

/** Вид изделия для атрибутов Ozon: шарм — подвеска (решение 29.09 п. 5), серьги — как подвеска (ТН ВЭД бижутерии). */
type OzonKind = Exclude<CardSlug, "sharm">

function tnved(kind: OzonKind, t: string): number {
  if (kind === "mineral") return OZON_DICT.tnvedCollection
  if (kind === "braslet") return OZON_DICT.tnvedStrung
  if (kind === "kolco") return OZON_DICT.tnvedMetall
  const stone = STONE_KW.some((k) => t.includes(k))
  if (kind === "podveska" || kind === "sergi") return stone ? OZON_DICT.tnvedStoneOther : OZON_DICT.tnvedMetall
  if (t.includes("фигурк")) return OZON_DICT.tnvedStoneItem
  return stone ? OZON_DICT.tnvedStoneOther : OZON_DICT.tnvedMetall
}

function hashtags(kind: OzonKind, t: string): string {
  const tags: string[] = []
  if (t.includes("метеорит")) tags.push("#метеорит")
  if (kind === "mineral") tags.push("#коллекционныйобразец", "#минералы")
  if (kind === "amulet") tags.push("#оберег", "#амулет")
  if (kind === "braslet") tags.push("#браслетизкамней")
  if (kind === "podveska") tags.push("#подвеска")
  if (kind === "kolco") tags.push("#кольцо")
  if (kind === "sergi") tags.push("#серьги")
  if (kind === "chasy") tags.push("#часы")
  tags.push("#подарок")
  return [...new Set(tags)].join(" ")
}

const name = (c: WbCardContent) => c.title.replace(/\s+/g, " ").trim().slice(0, 200)
const description = (c: WbCardContent) => (c.description.trim() || c.title).slice(0, 6000)
/** Единицы Ozon (swagger v3/product/import): габариты — `dimension_unit: "mm"`, вес — `weight_unit: "g"`; WB — см и кг. */
const mm = (cm: number | undefined) => Math.max(10, Math.round((cm ?? 10) * 10))
const grams = (kg: number | undefined) => Math.max(1, Math.round((kg ?? 0.1) * 1000))

function colorAttrs(c: WbCardContent): OzonAttr[] {
  const color = (charOf(c, "Цвет") ?? "").toLowerCase()
  const hit = COLORS.find(([kw]) => color.includes(kw))
  return hit ? [{ id: 10096, values: [{ dictionary_value_id: hit[1] }] }, { id: 10097, values: [{ value: color }] }] : []
}

export interface OzonCreateInput {
  /** Контент уже санитизирован для зеркала (domain sanitizeCardForMirror). */
  content: WbCardContent
  slug: CardSlug
  route: OzonRoute
  offerId: string
  barcode: string
  /** Размер варианта — словарное значение атрибута 5326; null — без размера. */
  size: { dictId: number } | null
  /** Страна производства WB → словарь 4389; null — атрибут не передаётся (он не обязательный). */
  countryDictId: number | null
  /** ТН ВЭД из карточки WB → словарь 22232 (маршрут tnvedFromWb — часы); null — по виду изделия. */
  tnvedDictId: number | null
  price: { priceMinor: number; oldMinor: number }
}

export function ozonImportItem(i: OzonCreateInput): OzonImportItem {
  const c = i.content
  const t = c.title.toLowerCase()
  const kind: OzonKind = i.slug === "sharm" ? "podveska" : i.slug
  if (i.route.tnvedFromWb && i.tnvedDictId === null) throw new Error(`Ozon: ТН ВЭД из карточки WB не найден в словаре — ${c.vendorCode} не создаётся`)
  const d = c.dimensions
  const weightG = grams(d?.weightKg)
  const attrs: OzonAttr[] = [
    { id: 85, values: [{ dictionary_value_id: OZON_DICT.brand }] },
    { id: 8229, values: [{ dictionary_value_id: i.route.typeId }] },
    { id: 9048, values: [{ value: c.vendorCode }] },
    { id: 22232, values: [{ dictionary_value_id: i.tnvedDictId ?? tnved(kind, t) }] },
    { id: 23536, values: [{ value: "false" }] },
    { id: 4191, values: [{ value: description(c) }] },
    { id: 23171, values: [{ value: hashtags(kind, t) }] },
    ...(i.route.materialAttrId !== null ? [{ id: i.route.materialAttrId, values: materials(t).map((m) => ({ dictionary_value_id: m })) }] : []),
    ...colorAttrs(c),
    { id: 4497, values: [{ value: String(weightG) }] },
  ]
  if (i.countryDictId !== null) attrs.push({ id: 4389, values: [{ dictionary_value_id: i.countryDictId }] })
  const compl = charOf(c, "Комплектация")
  if (compl && (kind === "mineral" || kind === "braslet")) attrs.push({ id: 4384, values: [{ value: compl }] })
  if (kind === "braslet" || kind === "kolco" || kind === "podveska" || kind === "sergi" || kind === "chasy") {
    const g = t.includes("женск") ? [OZON_DICT.genderF] : t.includes("мужск") ? [OZON_DICT.genderM] : [OZON_DICT.genderM, OZON_DICT.genderF]
    attrs.push({ id: 9163, values: g.map((x) => ({ dictionary_value_id: x })) })
  }
  if (kind === "amulet") {
    const art = t.includes("амулет") ? OZON_DICT.artAmulet : t.includes("оберег") ? OZON_DICT.artObereg : t.includes("талисман") ? OZON_DICT.artTalisman : OZON_DICT.artObereg
    attrs.push({ id: 23392, values: [{ dictionary_value_id: art }] }, { id: 8513, values: [{ value: "1" }] })
  }
  if (kind === "mineral") {
    attrs.push(
      { id: 5007, values: [{ dictionary_value_id: OZON_DICT.petrofilia }] },
      { id: 8962, values: [{ value: "1" }] },
      { id: 4383, values: [{ value: String(weightG) }] },
      { id: 4382, values: [{ value: `${mm(d?.lengthCm)}x${mm(d?.widthCm)}x${mm(d?.heightCm)}` }] },
    )
  }
  if (i.size) attrs.push({ id: 5326, values: [{ dictionary_value_id: i.size.dictId }] })
  return {
    offer_id: i.offerId,
    name: name(c),
    description_category_id: i.route.categoryId,
    type_id: i.route.typeId,
    barcode: i.barcode,
    price: minorToDecimalString(i.price.priceMinor),
    old_price: minorToDecimalString(i.price.oldMinor),
    vat: "0",
    currency_code: "RUB",
    images: c.photos.slice(0, 15),
    primary_image: c.photos[0] ?? "",
    depth: mm(d?.lengthCm),
    width: mm(d?.widthCm),
    height: mm(d?.heightCm),
    dimension_unit: "mm",
    weight: weightG,
    weight_unit: "g",
    attributes: attrs,
  }
}

/** Поля, которые синк правит на Ozon (с 29.09 — все: габариты переимпортом, видео — комплексом 100001). */
export const OZON_EDITABLE_FIELDS: ReadonlySet<CardField> = new Set(["title", "description", "characteristics", "photos", "dimensions", "video"])

/** Атрибуты правки (attributes/update меняет только переданные): название, аннотация, цвет. Фото, видео, габариты — отдельно. */
export function ozonEditAttributes(c: WbCardContent, fields: readonly CardField[]): OzonAttr[] {
  const out: OzonAttr[] = []
  if (fields.includes("title")) out.push({ id: 4180, values: [{ value: name(c) }] })
  if (fields.includes("description")) out.push({ id: 4191, values: [{ value: description(c) }] })
  if (fields.includes("characteristics")) out.push(...colorAttrs(c))
  return out
}

/** Вариант размера (п. 18): одинаковое «Название модели» объединяет товары одного типа, «Размер изделия» различает. */
export function ozonGroupAttributes(vendorCode: string, sizeDictId: number): OzonAttr[] {
  return [
    { id: 9048, values: [{ value: vendorCode }] },
    { id: 5326, values: [{ dictionary_value_id: sizeDictId }] },
  ]
}

/** Видео товара — ссылка на mp4 и название; так 28.09 прикреплены 39 роликов (задание 5717452722). */
export function ozonVideoAttributes(url: string, title: string): OzonAttr[] {
  return [
    { complex_id: OZON_VIDEO.complexId, id: OZON_VIDEO.urlAttr, values: [{ value: url }] },
    { complex_id: OZON_VIDEO.complexId, id: OZON_VIDEO.nameAttr, values: [{ value: title.slice(0, 200) }] },
  ]
}

/** Полная карточка Ozon (`v4/product/info/attributes`) — основа переимпорта габаритов и признак видео. */
export interface OzonProductFull {
  id: number
  offer_id: string
  name: string
  barcode?: string | null
  description_category_id: number
  type_id: number
  depth: number
  width: number
  height: number
  dimension_unit: string
  weight: number
  weight_unit: string
  images?: string[] | null
  primary_image?: string | null
  attributes: OzonAttr[]
  complex_attributes?: unknown[] | null
}

/**
 * Переимпорт с новыми габаритами (v3/product/import требует всю информацию о товаре): всё берётся у самого Ozon как есть,
 * меняются только габариты и вес (WB см/кг → мм/г), цены — текущие цены товара (v5/product/info/prices).
 */
export function ozonReimportItem(row: OzonProductFull, dims: WbDimensions, price: { priceMinor: number; oldMinor: number | null; vat: string | null }): OzonImportItem {
  return {
    offer_id: row.offer_id,
    name: row.name,
    description_category_id: row.description_category_id,
    type_id: row.type_id,
    barcode: row.barcode ?? "",
    price: minorToDecimalString(price.priceMinor),
    old_price: minorToDecimalString(price.oldMinor ?? 0),
    vat: price.vat ?? "0",
    currency_code: "RUB",
    images: row.images ?? [],
    primary_image: row.primary_image ?? "",
    depth: mm(dims.lengthCm),
    width: mm(dims.widthCm),
    height: mm(dims.heightCm),
    dimension_unit: "mm",
    weight: grams(dims.weightKg),
    weight_unit: "g",
    attributes: row.attributes,
    ...(row.complex_attributes && row.complex_attributes.length > 0 ? { complex_attributes: row.complex_attributes } : {}),
  }
}

export function ozonHasVideo(row: Pick<OzonProductFull, "attributes">): boolean {
  return row.attributes.some((a) => a.id === OZON_VIDEO.urlAttr && a.values.some((v) => (v.value ?? "") !== ""))
}
```
Цены — `minorToDecimalString` (`packages/shared/src/prices.ts`): 1 149 000 коп. → `"11490.00"`, как в `writeOzonPrices` этапа 2.

- [ ] **Step 3: Реализация — ключи, словарь, лимит, запись.** `packages/platforms/src/ozon/cards.ts`:
```ts
import { errorText } from "@sync2/shared"
import { requestJson, requestJsonWithMeta } from "../http"
import { WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import type { OzonAttr, OzonImportItem, OzonProductFull } from "./card-mapper"
import { BASE, fetchOzonBarcodes, ozonAuth, type OzonCredentials } from "./client"

export interface OzonCardKeys {
  offerIds: Set<string>
  archivedOfferIds: Set<string>
  /** Штрихкод → offer_id (живые и архив). */
  barcodeOwner: Map<string, string>
  /** offer_id → product_id: фото правятся по product_id. */
  productIdOf: Map<string, number>
}

const LIST_LIMIT = 1000
const MAX_PAGES = 100

/**
 * Все товары кабинета с архивом: visibility ALL — «все, кроме архивных» (swagger), поэтому второй проход ARCHIVED.
 * Архивный offer_id занят навсегда для синка: создавать заново его не будем (решение этапа 2).
 */
export async function fetchOzonCardKeys(cfg: OzonCredentials): Promise<OzonCardKeys> {
  const offers = new Map<string, { productId: number; archived: boolean }>()
  for (const visibility of ["ALL", "ARCHIVED"] as const) {
    let lastId = ""
    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) throw new Error(`Ozon товары (${visibility}): больше ${MAX_PAGES} страниц — список неполный`)
      const body = await requestJson<{ result?: { items?: Array<{ product_id?: number; offer_id?: string; archived?: boolean }> | null; last_id?: string | null } | null }>(
        "ozon",
        `${BASE}/v3/product/list`,
        { ...ozonAuth(cfg), method: "POST", body: { filter: { visibility }, last_id: lastId, limit: LIST_LIMIT } },
      )
      const items = body.result?.items ?? []
      for (const it of items) {
        if (it.offer_id && typeof it.product_id === "number") offers.set(it.offer_id, { productId: it.product_id, archived: visibility === "ARCHIVED" || it.archived === true })
      }
      const next = body.result?.last_id ?? ""
      if (items.length < LIST_LIMIT || next === "" || next === lastId) break
      lastId = next
    }
  }
  const barcodes = await fetchOzonBarcodes(cfg, [...offers.keys()])
  const keys: OzonCardKeys = { offerIds: new Set(), archivedOfferIds: new Set(), barcodeOwner: new Map(), productIdOf: new Map() }
  for (const [offerId, o] of offers) {
    ;(o.archived ? keys.archivedOfferIds : keys.offerIds).add(offerId)
    keys.productIdOf.set(offerId, o.productId)
    for (const b of barcodes.get(offerId) ?? []) if (!keys.barcodeOwner.has(b)) keys.barcodeOwner.set(b, offerId)
  }
  return keys
}

/** Словарное значение атрибута (размер 5326, страна 4389): точное совпадение без регистра, иначе null. */
export async function fetchOzonDictValueId(cfg: OzonCredentials, q: { categoryId: number; typeId: number; attributeId: number; value: string }): Promise<number | null> {
  const body = await requestJson<{ result?: Array<{ id?: number; value?: string }> | null }>("ozon", `${BASE}/v1/description-category/attribute/values/search`, {
    ...ozonAuth(cfg),
    method: "POST",
    body: { attribute_id: q.attributeId, description_category_id: q.categoryId, type_id: q.typeId, value: q.value, limit: 10 },
  })
  const want = q.value.trim().toLowerCase()
  return (body.result ?? []).find((r) => (r.value ?? "").trim().toLowerCase() === want)?.id ?? null
}

/** Сколько товаров ещё можно создать сегодня (сброс в 03:00 МСК); null — площадка лимит не назвала. */
export async function fetchOzonCreateQuota(cfg: OzonCredentials): Promise<number | null> {
  const b = await requestJson<{ daily_create?: { limit?: number; usage?: number } | null }>("ozon", `${BASE}/v4/product/info/limit`, { ...ozonAuth(cfg), method: "POST", body: {} })
  const d = b.daily_create
  if (!d || typeof d.limit !== "number" || typeof d.usage !== "number" || d.limit < 0) return null
  return Math.max(0, d.limit - d.usage)
}

/** Полные карточки `v4/product/info/attributes` по offer_id (пачки по 1000): видео (21841) и основа переимпорта габаритов. */
export async function fetchOzonProductsFull(cfg: OzonCredentials, offerIds: readonly string[]): Promise<Map<string, OzonProductFull>> {
  const out = new Map<string, OzonProductFull>()
  const unique = [...new Set(offerIds)]
  for (let i = 0; i < unique.length; i += LIST_LIMIT) {
    const batch = unique.slice(i, i + LIST_LIMIT)
    let lastId = ""
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await requestJson<{ result?: OzonProductFull[] | null; last_id?: string | null }>("ozon", `${BASE}/v4/product/info/attributes`, {
        ...ozonAuth(cfg),
        method: "POST",
        body: { filter: { offer_id: batch, visibility: "ALL" }, limit: LIST_LIMIT, ...(lastId ? { last_id: lastId } : {}) },
      })
      const rows = body.result ?? []
      for (const r of rows) out.set(r.offer_id, { ...r, attributes: r.attributes ?? [] })
      const next = body.last_id ?? ""
      if (rows.length < LIST_LIMIT || next === "" || next === lastId) break
      lastId = next
    }
  }
  return out
}

export interface OzonModeration {
  /** ok — прошла; pending — на модерации/в обработке; rejected — отклонена (текст — в вопрос card_rejected). */
  state: "ok" | "pending" | "rejected"
  text: string
  /** Площадка просит УИН ГИИС ДМДК (ювелирная маркировка) — отдельной строкой в вопросе. */
  needsDmdk: boolean
}

interface OzonInfoStatusItem {
  offer_id?: string
  statuses?: { moderate_status?: string | null; status_description?: string | null; status_failed?: string | null; validation_status?: string | null } | null
  errors?: Array<{ code?: string; level?: string; texts?: { description?: string; short_description?: string } | null }> | null
}

/** Модерация созданных синком товаров — `v3/product/info/list` (статусы и ошибки карточки). */
export async function fetchOzonModeration(cfg: OzonCredentials, offerIds: readonly string[]): Promise<Map<string, OzonModeration>> {
  const out = new Map<string, OzonModeration>()
  const unique = [...new Set(offerIds)]
  for (let i = 0; i < unique.length; i += LIST_LIMIT) {
    const body = await requestJson<{ items?: OzonInfoStatusItem[] | null }>("ozon", `${BASE}/v3/product/info/list`, { ...ozonAuth(cfg), method: "POST", body: { offer_id: unique.slice(i, i + LIST_LIMIT) } })
    for (const it of body.items ?? []) {
      if (!it.offer_id) continue
      const st = it.statuses ?? {}
      const fatal = (it.errors ?? []).filter((e) => (e.level ?? "error") !== "warning")
      const rejected = st.moderate_status === "declined" || (st.status_failed ?? "") !== "" || fatal.length > 0
      const text = rejected
        ? [st.status_description ?? "", ...fatal.map((e) => `${e.code ?? "?"}: ${e.texts?.description ?? e.texts?.short_description ?? ""}`)].filter((x) => x !== "").join("; ")
        : ""
      out.set(it.offer_id, { state: rejected ? "rejected" : st.moderate_status === "approved" ? "ok" : "pending", text, needsDmdk: /ДМДК|УИН/i.test(text) })
    }
  }
  return out
}

export interface OzonCreatePayload {
  item: OzonImportItem
}
export interface OzonEditPayload {
  attributes: OzonAttr[]
  /** Фото целиком (pictures/import заменяет все); null — фото не меняются. */
  images: string[] | null
}

export interface OzonCardWriterConfig extends OzonCredentials {
  pollDelayMs?: number
  pollAttempts?: number
  retryDelaysMs?: number[]
}

export const OZON_IMPORT_BATCH = 100
/** Проверка задачи импорта — как старый синк (6 с), но короче: не финализировалось — итог по снимку следующего тика. */
const POLL_DELAY_MS = 6_000
const POLL_ATTEMPTS = 10

interface ImportInfoItem {
  offer_id?: string
  product_id?: number
  status?: string
  errors?: Array<{ code?: string; level?: string; message?: string }> | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const writeOpts = (cfg: OzonCardWriterConfig) => ({ retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS], timeoutMs: WRITE_TIMEOUT_MS })

async function pollTask(cfg: OzonCardWriterConfig, taskId: number, offerIds: readonly string[]): Promise<Map<string, ImportInfoItem>> {
  let last = new Map<string, ImportInfoItem>()
  for (let i = 0; i < (cfg.pollAttempts ?? POLL_ATTEMPTS); i++) {
    await sleep(cfg.pollDelayMs ?? POLL_DELAY_MS)
    const b = await requestJson<{ result?: { items?: ImportInfoItem[] | null } | null }>("ozon", `${BASE}/v1/product/import/info`, { ...ozonAuth(cfg), method: "POST", body: { task_id: taskId } })
    last = new Map((b.result?.items ?? []).flatMap((it): Array<[string, ImportInfoItem]> => (it.offer_id ? [[it.offer_id, it]] : [])))
    if (offerIds.every((o) => { const st = last.get(o)?.status; return st !== undefined && st !== "pending" })) break
  }
  return last
}

function outcome(op: WriteOp, it: ImportInfoItem | undefined, taskId: number, what: string): SendResult {
  const fatal = (it?.errors ?? []).filter((e) => (e.level ?? "error") !== "warning")
  if (it && (it.status === "imported" || it.status === "skipped") && fatal.length === 0) return succeeded(op, { taskId, productId: it.product_id ?? null, status: it.status, warnings: it.errors ?? [] })
  if (it && (it.status === "failed" || fatal.length > 0)) {
    return failed(op, `Ozon: ${what} отклонено — ${fatal.map((e) => e.code ?? e.message ?? "?").join(", ") || it.status}`, { response: it })
  }
  return failed(op, `Ozon: ${what} — задача ${taskId} не завершилась за время проверки; итог — по снимку следующего тика`, { uncertain: true, response: it ?? null })
}

async function runTask(cfg: OzonCardWriterConfig, batch: WriteOp[], path: string, body: unknown, what: string): Promise<SendResult[]> {
  let taskId: number | undefined
  try {
    const r = await requestJsonWithMeta<{ result?: { task_id?: number } | null; task_id?: number }>("ozon", `${BASE}${path}`, { ...ozonAuth(cfg), method: "POST", body, ...writeOpts(cfg) })
    taskId = r.body.result?.task_id ?? r.body.task_id
  } catch (e) {
    return batch.map((op) => failed(op, `Ozon: ${what} не принято — ${errorText(e)}`, { uncertain: isUncertain(e) }))
  }
  if (!taskId) return batch.map((op) => failed(op, `Ozon: ${what} — ответ без task_id`, { uncertain: true }))
  let info: Map<string, ImportInfoItem>
  try {
    info = await pollTask(cfg, taskId, batch.map((op) => op.card!.offerId))
  } catch (e) {
    return batch.map((op) => failed(op, `Ozon: ${what} — статус задачи ${taskId} не прочитан: ${errorText(e)}`, { uncertain: true }))
  }
  return batch.map((op) => outcome(op, info.get(op.card!.offerId), taskId!, what))
}

async function pictures(cfg: OzonCardWriterConfig, op: WriteOp, images: string[], prev: SendResult | undefined): Promise<SendResult> {
  const productId = Number(op.card!.productRef)
  if (!Number.isSafeInteger(productId) || productId <= 0) return failed(op, "Ozon: нет product_id — фото не обновить")
  try {
    const r = await requestJson<{ result?: { pictures?: Array<{ state?: string; url?: string }> | null } | null }>("ozon", `${BASE}/v1/product/pictures/import`, {
      ...ozonAuth(cfg),
      method: "POST",
      body: { product_id: productId, images: images.slice(0, 30) },
      ...writeOpts(cfg),
    })
    const bad = (r.result?.pictures ?? []).filter((p) => p.state === "failed")
    if (bad.length > 0) return failed(op, `Ozon: фото не приняты — ${bad.map((p) => p.url ?? "?").join(", ")}`, { response: r })
    return succeeded(op, { attributes: prev?.response ?? null, pictures: r.result?.pictures ?? [] })
  } catch (e) {
    return failed(op, `Ozon: фото не приняты — ${errorText(e)}`, { uncertain: isUncertain(e) })
  }
}

/**
 * Отправитель карточек Ozon. Создание и переимпорт габаритов — v3/product/import пачками до 100 с проверкой import/info;
 * правка, группа размера и видео — атрибуты одной задачей attributes/update (меняет только переданные), фото —
 * pictures/import по товару (заменяет все).
 * Правка идемпотентна: повтор после «итог неизвестен» безопасен.
 */
export async function writeOzonCards(cfg: OzonCardWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const results: SendResult[] = []
  const creates: WriteOp[] = []
  const edits: WriteOp[] = []
  const reimports: WriteOp[] = []
  for (const op of ops) {
    if (!op.card) results.push(failed(op, "Ozon: нет тела карточки — запись невозможна"))
    else if (op.card.kind === "create") creates.push(op)
    else if (op.card.kind === "reimport") reimports.push(op)
    else edits.push(op)
  }
  for (const batch of chunk(creates, OZON_IMPORT_BATCH)) {
    results.push(...(await runTask(cfg, batch, "/v3/product/import", { items: batch.map((op) => (op.card!.payload as OzonCreatePayload).item) }, "создание")))
  }
  // Габариты существующих — переимпорт полной карточки Ozon (решение 29.09 п. 3).
  for (const batch of chunk(reimports, OZON_IMPORT_BATCH)) {
    results.push(...(await runTask(cfg, batch, "/v3/product/import", { items: batch.map((op) => (op.card!.payload as OzonCreatePayload).item) }, "габариты")))
  }
  const withAttrs = edits.filter((op) => (op.card!.payload as OzonEditPayload).attributes.length > 0)
  const byKey = new Map<string, SendResult>()
  const key = (x: { barcode: string; field: string }) => `${x.barcode}\u0000${x.field}`
  // Видео — отдельной задачей: правка и видео одного товара не должны оказаться двумя items одного offer_id в запросе.
  for (const group of [withAttrs.filter((op) => op.card!.kind !== "video"), withAttrs.filter((op) => op.card!.kind === "video")]) {
    for (const batch of chunk(group, OZON_IMPORT_BATCH)) {
      const body = { items: batch.map((op) => ({ offer_id: op.card!.offerId, attributes: (op.card!.payload as OzonEditPayload).attributes })) }
      for (const r of await runTask(cfg, batch, "/v1/product/attributes/update", body, "правка")) byKey.set(key(r), r)
    }
  }
  for (const op of edits) {
    const a = byKey.get(key(op))
    if (a && !a.ok) {
      results.push(a)
      continue
    }
    const images = (op.card!.payload as OzonEditPayload).images
    results.push(images ? await pictures(cfg, op, images, a) : (a ?? succeeded(op)))
  }
  return results
}
```
`packages/platforms/src/index.ts` — добавить:
```ts
export {
  OZON_DICT,
  OZON_EDITABLE_FIELDS,
  OZON_VIDEO,
  ozonEditAttributes,
  ozonGroupAttributes,
  ozonHasVideo,
  ozonImportItem,
  ozonReimportItem,
  ozonVideoAttributes,
  type OzonAttr,
  type OzonCreateInput,
  type OzonImportItem,
  type OzonProductFull,
} from "./ozon/card-mapper"
export {
  OZON_IMPORT_BATCH,
  fetchOzonCardKeys,
  fetchOzonCreateQuota,
  fetchOzonDictValueId,
  fetchOzonModeration,
  fetchOzonProductsFull,
  writeOzonCards,
  type OzonCardKeys,
  type OzonModeration,
  type OzonCardWriterConfig,
  type OzonCreatePayload,
  type OzonEditPayload,
} from "./ozon/cards"
```

- [ ] **Step 4: Проверка и коммит.**
```bash
npx vitest run packages/platforms/src/ozon && npm run typecheck
git add packages/platforms/src/ozon/card-mapper.ts packages/platforms/src/ozon/card-mapper.test.ts packages/platforms/src/ozon/cards.ts packages/platforms/src/ozon/cards.test.ts packages/platforms/src/index.ts
git commit -m "sync2: Ozon — карточки: перенос 02-transform.py с серьгами и часами, видео комплексом 100001, переимпорт габаритов, ключи с архивом, модерация, словарь, лимит, запись с проверкой задачи"
```

---

### Task 7: ЯМ — ключи с архивом и видео, маппер оффера, модерация, ставка из тарифов, запись + первый остаток (`ym/cards.ts`)

**Files:**
- Create: `packages/platforms/src/ym/cards.ts`, `packages/platforms/src/ym/cards.test.ts`
- Modify: `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающие тесты.** `packages/platforms/src/ym/cards.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WbCardContent } from "@sync2/shared"
import type { WriteOp } from "../writer"
import { YM_GROUP_PARAM_ID, fetchYmCardKeys, fetchYmModeration, fetchYmTakeBp, writeYmCards, ymCreateMapping, ymEditMapping, ymGroupMapping, ymVideoMapping } from "./cards"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const NOW = new Date("2026-10-12T16:19:00.000Z")
const cfg = { apiKey: "k", businessId: "191766894", campaignId: "149197829", warehouseId: 2369574, retryDelaysMs: [0], now: () => NOW }
afterEach(() => vi.unstubAllGlobals())
function stub(handler: (path: string, body: Record<string, unknown>, url: URL) => Response) {
  const calls: Array<{ path: string; body: Record<string, unknown>; method: string }> = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url)
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
      calls.push({ path: u.pathname, body, method: init?.method ?? "GET" })
      return handler(u.pathname, body, u)
    }),
  )
  return calls
}
const content: WbCardContent = {
  nmId: 1631024060,
  vendorCode: "888645543123",
  brand: "KOTELNIKOVARTIFACT",
  subject: "Обереги",
  title: "Браслет из Ливийского стекла",
  description: "Браслет из натурального ливийского стекла.",
  characteristics: [{ id: 14177451, name: "Страна производства", values: ["Египет"] }],
  photos: Array.from({ length: 12 }, (_, i) => `https://basket-49.wbbasket.ru/x/images/big/${i + 1}.webp`),
  dimensions: { lengthCm: 25, widthCm: 15, heightCm: 6, weightKg: 0.1 },
  sizes: [{ chrtId: 1, techSize: "0", wbSize: "", barcodes: ["2057086856166"] }],
  video: "https://videonme-basket-12.wbbasket.ru/vol140/part163102/1631024060/hls/1440p/index.m3u8",
}
const op = (offerId: string, kind: "create" | "content", initialStock?: number): WriteOp => ({
  channel: "ym",
  barcode: `B-${offerId}`,
  field: kind === "create" ? "card_create" : "card_content",
  before: null,
  after: 1,
  externalSku: offerId,
  card: { kind, nmId: 1, vendorCode: offerId, offerId, fields: ["title"], payload: { offer: { offerId } }, productRef: null, decisionId: null, ...(initialStock !== undefined ? { initialStock } : {}) },
})

describe("ЯМ — маппер оффера", () => {
  it("создание: обязательные поля, 10 фото, страна из WB, цена бизнеса; без размера — без parameterValues", () => {
    const m = ymCreateMapping({ content, route: { marketCategoryId: 67678046, sizeParamId: 32835410 }, offerId: "888645543123", barcode: "2057086856166", size: null, multiSize: false, price: { priceMinor: 1149000, baseMinor: 1580000 } })
    expect(m.offer).toMatchObject({
      offerId: "888645543123",
      name: "Браслет из Ливийского стекла",
      marketCategoryId: 67678046,
      vendor: "KOTELNIKOVARTIFACT",
      vendorCode: "888645543123",
      barcodes: ["2057086856166"],
      manufacturerCountries: ["Египет"],
      weightDimensions: { length: 25, width: 15, height: 6, weight: 0.1 },
      basicPrice: { value: 11490, currencyId: "RUR", discountBase: 15800 },
    })
    expect((m.offer.pictures as string[]).length).toBe(10)
    expect(m.offer.parameterValues).toBeUndefined()
  })

  it("вариант размера: группа 200 = артикул и размер distinctive-характеристикой", () => {
    const m = ymCreateMapping({ content, route: { marketCategoryId: 67678046, sizeParamId: 32835410 }, offerId: "888645543123-19", barcode: "B19", size: "19", multiSize: true, price: { priceMinor: 100, baseMinor: 200 } })
    expect(m.offer.parameterValues).toEqual([{ parameterId: YM_GROUP_PARAM_ID, value: "888645543123" }, { parameterId: 32835410, value: "19" }])
    expect(ymGroupMapping("JW-NB-AGT-M-0073", 67678046, 32835410, "JW-NB-AGT-M-0073", "20")).toEqual({
      offer: { offerId: "JW-NB-AGT-M-0073", marketCategoryId: 67678046, parameterValues: [{ parameterId: 200, value: "JW-NB-AGT-M-0073" }, { parameterId: 32835410, value: "20" }] },
    })
  })

  it("правка: только изменившиеся поля и без marketCategoryId — категория ЯМ правкой не меняется", () => {
    expect(ymEditMapping(content, "888645543123", ["title", "photos"])).toEqual({ offer: { offerId: "888645543123", name: "Браслет из Ливийского стекла", pictures: content.photos.slice(0, 10) } })
    expect(ymEditMapping(content, "888645543123", ["dimensions"]).offer).toEqual({ offerId: "888645543123", weightDimensions: { length: 25, width: 15, height: 6, weight: 0.1 } })
    expect(ymVideoMapping("888645543123", "https://kotelnikovartifact.ru/video/888645543123-1a2b3c4d.mp4")).toEqual({ offer: { offerId: "888645543123", videos: ["https://kotelnikovartifact.ru/video/888645543123-1a2b3c4d.mp4"] } })
  })
})

describe("ЯМ — ключи и запись", () => {
  it("ключи: живые и архив (archived: true), штрихкод → оффер, категория оффера", async () => {
    const calls = stub((_p, body) =>
      body.archived
        ? json({ status: "OK", result: { offerMappings: [{ offer: { offerId: "2051508626795", barcodes: ["2051508626795"], archived: true } }], paging: {} } })
        : json({ status: "OK", result: { offerMappings: [{ offer: { offerId: "JW-NB-AGT-M-0073", barcodes: ["2042770600712"], mediaFiles: { videos: [{ url: "https://x/v.mp4" }] } }, mapping: { marketCategoryId: 67678046 } }], paging: {} } }),
    )
    const k = await fetchYmCardKeys(cfg)
    expect([...k.offerIds]).toEqual(["JW-NB-AGT-M-0073"])
    expect([...k.archivedOfferIds]).toEqual(["2051508626795"])
    expect(k.barcodeOwner.get("2042770600712")).toBe("JW-NB-AGT-M-0073")
    expect(k.categoryOf.get("JW-NB-AGT-M-0073")).toBe(67678046)
    expect([...k.withVideo]).toEqual(["JW-NB-AGT-M-0073"])
    expect(calls.map((c) => c.body.archived)).toEqual([false, true])
  })

  it("модерация по offer-cards: ошибки карточки — отклонено с текстом; в обработке — ждёт; есть карточка — ok", async () => {
    stub(() =>
      json({
        status: "OK",
        result: {
          offerCards: [
            { offerId: "A", cardStatus: "NO_CARD_ERRORS", errors: [{ type: "INVALID_PARAMETER", message: "Нужен УИН ГИИС ДМДК" }] },
            { offerId: "B", cardStatus: "NO_CARD_PROCESSING" },
            { offerId: "C", cardStatus: "HAS_CARD_CAN_UPDATE" },
          ],
          paging: {},
        },
      }),
    )
    const m = await fetchYmModeration(cfg, ["A", "B", "C"])
    expect(m.get("A")).toEqual({ state: "rejected", text: "NO_CARD_ERRORS; INVALID_PARAMETER: Нужен УИН ГИИС ДМДК", needsDmdk: true })
    expect(m.get("B")!.state).toBe("pending")
    expect(m.get("C")!.state).toBe("ok")
  })

  it("ставка из тарифов: FEE + перевод платежа (относительные), bp; доставка покупателю — не в ставке (её добавляет домен этапа 2)", async () => {
    const calls = stub(() =>
      json({
        status: "OK",
        result: {
          offers: [
            {
              offer: { categoryId: 91259, price: 20000 },
              tariffs: [
                { type: "FEE", amount: 10100, parameters: [{ name: "value", value: "50.50" }, { name: "valueType", value: "relative" }] },
                { type: "PAYMENT_TRANSFER", amount: 560, parameters: [{ name: "value", value: "2.80" }, { name: "valueType", value: "relative" }] },
                { type: "DELIVERY_TO_CUSTOMER", amount: 1000, parameters: [{ name: "value", value: "5.00" }, { name: "valueType", value: "relative" }] },
              ],
            },
          ],
        },
      }),
    )
    expect(await fetchYmTakeBp(cfg, { categoryId: 91259, priceMinor: 2000000, dims: { lengthCm: 20, widthCm: 15, heightCm: 4, weightKg: 0.5 } })).toBe(5330)
    expect(calls[0]!.body).toEqual({ parameters: { campaignId: 149197829 }, offers: [{ categoryId: 91259, price: 20000, length: 20, width: 15, height: 4, weight: 0.5, quantity: 1 }] })
  })

  it("ошибка одного оффера — ему отказ, остальные — одним повтором; созданным — первый остаток в магазин", async () => {
    let n = 0
    const calls = stub((path, body) => {
      if (path.endsWith("/offer-mappings/update")) {
        n++
        const ids = (body.offerMappings as Array<{ offer: { offerId: string } }>).map((m) => m.offer.offerId)
        return json({ status: "OK", results: ids.map((offerId) => ({ offerId, errors: offerId === "BAD" ? [{ type: "UNKNOWN_CATEGORY", message: "x" }] : [] })) })
      }
      if (path.endsWith("/offers/stocks")) return json({ status: "OK" })
      throw new Error(path)
    })
    const r = await writeYmCards(cfg, [op("A", "create", 2), op("BAD", "create", 1), op("C", "content")])
    expect(r.map((x) => [x.barcode, x.ok])).toEqual([["B-BAD", false], ["B-A", true], ["B-C", true]])
    expect(r[0]!.error).toContain("UNKNOWN_CATEGORY")
    expect(n).toBe(2)
    const stock = calls.find((c) => c.path.endsWith("/offers/stocks"))!
    expect(stock.method).toBe("PUT")
    expect(stock.body).toEqual({ skus: [{ sku: "A", warehouseId: 2369574, items: [{ count: 2, type: "FIT", updatedAt: NOW.toISOString() }] }] })
  })

  it("остаток не записался — создание всё равно успех, причина в ответе", async () => {
    stub((path) => (path.endsWith("/offers/stocks") ? json({ status: "ERROR", errors: [{ code: "X" }] }, 400) : json({ status: "OK", results: [{ offerId: "A", errors: [] }] })))
    const r = await writeYmCards(cfg, [op("A", "create", 1)])
    expect(r[0]).toMatchObject({ ok: true })
    expect(r[0]!.response).toMatchObject({ stockError: expect.stringContaining("400") })
  })
})
```
Run: `npx vitest run packages/platforms/src/ym/cards.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `packages/platforms/src/ym/cards.ts`:
```ts
import { errorText, minorToRub, type CardField, type WbCardContent, type WbDimensions, type YmRoute } from "@sync2/shared"
import { requestJson } from "../http"
import { WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, chunk, failed, isUncertain, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { BASE, nextSnapshotPage, pagedUrl, ymAuth, type YmCredentials } from "./client"
import { ymStocksBody } from "./stock-writer"

export interface YmCardKeys {
  offerIds: Set<string>
  archivedOfferIds: Set<string>
  barcodeOwner: Map<string, string>
  /** Офферы, у которых видео уже есть: первое видео синк прикрепляет только остальным. */
  withVideo: Set<string>
  /** offer_id → текущая категория ЯМ: группа размеров пишется с ней, а не с маршрутом синка. */
  categoryOf: Map<string, number>
}

const PAGE = 100
const MAX_PAGES = 1000

interface MappingsPage {
  result?: {
    paging?: { nextPageToken?: string | null } | null
    offerMappings?: Array<{
      offer?: { offerId?: string; barcodes?: string[] | null; archived?: boolean; videos?: string[] | null; mediaFiles?: { videos?: Array<{ url?: string }> | null } | null } | null
      mapping?: { marketCategoryId?: number } | null
    }> | null
  } | null
}

/** Каталог бизнеса с архивом (урок v1: 105 архивных баркодовых дублей; SKU ЯМ нельзя освободить и использовать заново). */
export async function fetchYmCardKeys(cfg: YmCredentials): Promise<YmCardKeys> {
  const keys: YmCardKeys = { offerIds: new Set(), archivedOfferIds: new Set(), barcodeOwner: new Map(), withVideo: new Set(), categoryOf: new Map() }
  for (const archived of [false, true]) {
    let pageToken: string | undefined
    for (let page = 0; ; page++) {
      if (page >= MAX_PAGES) throw new Error(`ЯМ каталог: больше ${MAX_PAGES} страниц — список неполный`)
      const body = await requestJson<MappingsPage>("ym", pagedUrl(`/v2/businesses/${cfg.businessId}/offer-mappings`, PAGE, pageToken), { ...ymAuth(cfg), method: "POST", body: { archived } })
      const rows = body.result?.offerMappings ?? []
      for (const r of rows) {
        const id = r.offer?.offerId
        if (!id) continue
        ;(archived || r.offer?.archived === true ? keys.archivedOfferIds : keys.offerIds).add(id)
        for (const b of r.offer?.barcodes ?? []) if (!keys.barcodeOwner.has(b)) keys.barcodeOwner.set(b, id)
        const cat = r.mapping?.marketCategoryId
        if (typeof cat === "number") keys.categoryOf.set(id, cat)
        if ((r.offer?.videos ?? []).length > 0 || (r.offer?.mediaFiles?.videos ?? []).length > 0) keys.withVideo.add(id)
      }
      const next = nextSnapshotPage("каталог", body.result?.paging?.nextPageToken, pageToken, rows.length)
      if (!next) break
      pageToken = next
    }
  }
  return keys
}

export interface YmOfferMapping {
  offer: { offerId: string } & Record<string, unknown>
}

/** «Название группы вариантов» — одинаковое у вариантов одной карточки (справка ЯМ, 29.09). */
export const YM_GROUP_PARAM_ID = 200
const NAME_MAX = 256
const DESC_MAX = 6000
const PICTURES_MAX = 10

const countryOf = (c: WbCardContent) => c.characteristics.find((x) => x.name === "Страна производства")?.values[0] ?? "Россия"
const dimsOf = (c: WbCardContent) =>
  c.dimensions
    ? { length: c.dimensions.lengthCm, width: c.dimensions.widthCm, height: c.dimensions.heightCm, weight: c.dimensions.weightKg }
    : { length: 10, width: 10, height: 5, weight: 0.05 }
const nameOf = (c: WbCardContent) => c.title.replace(/\s+/g, " ").trim().slice(0, NAME_MAX)
const descOf = (c: WbCardContent) => (c.description.trim() || c.title).slice(0, DESC_MAX)

export interface YmCreateInput {
  /** Контент уже санитизирован для зеркала. */
  content: WbCardContent
  route: YmRoute
  offerId: string
  barcode: string
  size: string | null
  multiSize: boolean
  price: { priceMinor: number; baseMinor: number }
}

/** Новый оффер: обязательные поля (offerId, name, marketCategoryId, pictures, vendor, description) и цена бизнеса. */
export function ymCreateMapping(i: YmCreateInput): YmOfferMapping {
  const c = i.content
  const group = i.multiSize && i.size !== null && i.route.sizeParamId !== null
  return {
    offer: {
      offerId: i.offerId,
      name: nameOf(c),
      marketCategoryId: i.route.marketCategoryId,
      pictures: c.photos.slice(0, PICTURES_MAX),
      vendor: c.brand || "KOTELNIKOVARTIFACT",
      vendorCode: c.vendorCode,
      barcodes: [i.barcode],
      description: descOf(c),
      manufacturerCountries: [countryOf(c)],
      weightDimensions: dimsOf(c),
      // discountBase — всегда, minimumForBestseller — никогда (спека §6, решение п. 14).
      basicPrice: { value: minorToRub(i.price.priceMinor), currencyId: "RUR", discountBase: minorToRub(i.price.baseMinor) },
      ...(group ? { parameterValues: [{ parameterId: YM_GROUP_PARAM_ID, value: c.vendorCode }, { parameterId: i.route.sizeParamId!, value: i.size! }] } : {}),
    },
  }
}

/** Правка: только изменившиеся поля; без marketCategoryId — категорию ЯМ правка контента не трогает. */
export function ymEditMapping(c: WbCardContent, offerId: string, fields: readonly CardField[]): YmOfferMapping {
  const offer: YmOfferMapping["offer"] = { offerId }
  if (fields.includes("title")) offer.name = nameOf(c)
  if (fields.includes("description")) offer.description = descOf(c)
  if (fields.includes("photos")) offer.pictures = c.photos.slice(0, PICTURES_MAX)
  if (fields.includes("dimensions")) offer.weightDimensions = dimsOf(c)
  return { offer }
}

/** Видео по постоянной ссылке; новое видео — новая ссылка (справка ЯМ: по старой ссылке видео не обновится). */
export function ymVideoMapping(offerId: string, url: string): YmOfferMapping {
  return { offer: { offerId, videos: [url] } }
}

export interface YmModeration {
  state: "ok" | "pending" | "rejected"
  text: string
  needsDmdk: boolean
}

const YM_REJECTED = new Set(["NO_CARD_ERRORS", "HAS_CARD_CAN_UPDATE_ERRORS", "NO_CARD_NEED_CONTENT"])
const YM_OK = new Set(["HAS_CARD_CAN_UPDATE", "HAS_CARD_CAN_NOT_UPDATE"])

/** Модерация созданных синком офферов — `offer-cards` (статус карточки и ошибки контента). */
export async function fetchYmModeration(cfg: YmCredentials, offerIds: readonly string[]): Promise<Map<string, YmModeration>> {
  const out = new Map<string, YmModeration>()
  const unique = [...new Set(offerIds)]
  for (let i = 0; i < unique.length; i += PAGE) {
    const body = await requestJson<{ result?: { offerCards?: Array<{ offerId?: string; cardStatus?: string; errors?: Array<{ type?: string; message?: string }> | null }> | null } | null }>(
      "ym",
      pagedUrl(`/v2/businesses/${cfg.businessId}/offer-cards`, PAGE, undefined),
      { ...ymAuth(cfg), method: "POST", body: { offerIds: unique.slice(i, i + PAGE) } },
    )
    for (const c of body.result?.offerCards ?? []) {
      if (!c.offerId) continue
      const status = c.cardStatus ?? ""
      const errors = c.errors ?? []
      const rejected = YM_REJECTED.has(status) || (errors.length > 0 && !YM_OK.has(status))
      const text = rejected ? [status, ...errors.map((e) => `${e.type ?? "?"}: ${e.message ?? ""}`)].filter((x) => x !== "").join("; ") : ""
      out.set(c.offerId, { state: rejected ? "rejected" : YM_OK.has(status) ? "ok" : "pending", text, needsDmdk: /ДМДК|УИН/i.test(text) })
    }
  }
  return out
}

/**
 * Живая ставка ЯМ для предмета без ставки в config/pricing.json (часы, решение 29.09 п. 5): `POST v2/tariffs/calculate`
 * по категории, цене и габаритам; ставка = FEE + перевод платежа (относительные, %) → bp. Доставку покупателю (5 %,
 * ≤ 1 000 ₽) добавляет домен этапа 2 (`ymPriceForNet`). null — площадка тарифов не вернула.
 */
export async function fetchYmTakeBp(cfg: YmCredentials, q: { categoryId: number; priceMinor: number; dims: WbDimensions | null }): Promise<number | null> {
  const d = q.dims ?? { lengthCm: 10, widthCm: 10, heightCm: 5, weightKg: 0.05 }
  const body = await requestJson<{ result?: { offers?: Array<{ tariffs?: Array<{ type?: string; parameters?: Array<{ name?: string; value?: string }> | null }> | null }> | null } | null }>(
    "ym",
    `${BASE}/v2/tariffs/calculate`,
    {
      ...ymAuth(cfg),
      method: "POST",
      body: { parameters: { campaignId: Number(cfg.campaignId) }, offers: [{ categoryId: q.categoryId, price: minorToRub(q.priceMinor), length: d.lengthCm, width: d.widthCm, height: d.heightCm, weight: d.weightKg, quantity: 1 }] },
    },
  )
  const tariffs = body.result?.offers?.[0]?.tariffs ?? []
  let pct = 0
  let found = false
  for (const t of tariffs) {
    if (t.type !== "FEE" && t.type !== "PAYMENT_TRANSFER") continue
    const params = new Map((t.parameters ?? []).map((x) => [x.name ?? "", x.value ?? ""]))
    if (params.get("valueType") !== "relative") continue
    const v = Number(params.get("value"))
    if (!Number.isFinite(v)) continue
    pct += v
    found = true
  }
  return found ? Math.round(pct * 100) : null
}

/** Существующему офферу — группа вариантов (п. 18); категория — текущая категория оффера (parameterValues — только с ней). */
export function ymGroupMapping(offerId: string, marketCategoryId: number, sizeParamId: number, group: string, size: string): YmOfferMapping {
  return { offer: { offerId, marketCategoryId, parameterValues: [{ parameterId: YM_GROUP_PARAM_ID, value: group }, { parameterId: sizeParamId, value: size }] } }
}

export interface YmCardWriterConfig extends YmCredentials {
  /** Склад магазина 149197829 — первый из YM_WAREHOUSE_IDS (2369574). */
  warehouseId: number
  now?: () => Date
  retryDelaysMs?: number[]
}

export const YM_CARDS_BATCH = 100

type MappingResult = { offerId?: string; errors?: Array<{ type?: string; message?: string }> | null; warnings?: unknown[] | null }

async function updateMappings(cfg: YmCardWriterConfig, batch: WriteOp[], retryWithoutBad: boolean): Promise<SendResult[]> {
  let results: MappingResult[]
  try {
    const body = await requestJson<{ results?: MappingResult[] | null }>("ym", `${BASE}/v2/businesses/${cfg.businessId}/offer-mappings/update`, {
      ...ymAuth(cfg),
      method: "POST",
      body: { offerMappings: batch.map((op) => op.card!.payload) },
      retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
      timeoutMs: WRITE_TIMEOUT_MS,
    })
    results = body.results ?? []
  } catch (e) {
    return batch.map((op) => failed(op, `ЯМ: карточка не принята — ${errorText(e)}`, { uncertain: isUncertain(e) }))
  }
  const bad = new Map<string, string>()
  for (const r of results) if (r.offerId && (r.errors ?? []).length > 0) bad.set(r.offerId, (r.errors ?? []).map((e) => e.type ?? e.message ?? "?").join(", "))
  if (bad.size === 0) return batch.map((op) => succeeded(op, results.find((r) => r.offerId === op.card!.offerId) ?? null))
  // Ошибка у одного оффера — пачка не обновилась целиком (спека updateOfferMappings): плохим — отказ, остальным — один повтор.
  const out = batch.filter((op) => bad.has(op.card!.offerId)).map((op) => failed(op, `ЯМ: ${bad.get(op.card!.offerId)}`))
  const good = batch.filter((op) => !bad.has(op.card!.offerId))
  if (good.length > 0) out.push(...(retryWithoutBad ? await updateMappings(cfg, good, false) : good.map((op) => failed(op, "ЯМ: пачка не обновилась из-за ошибки соседнего оффера"))))
  return out
}

/**
 * Отправитель карточек ЯМ: offer-mappings/update пачками до 100. Созданным — первый остаток пула на склад магазина
 * (так оффер попадает в магазин 149197829 — старый синк 04.09); сбой остатка не отменяет создание — причина в ответе,
 * остаток допишет pool, когда оффер появится в снимке.
 */
export async function writeYmCards(cfg: YmCardWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const results: SendResult[] = []
  const valid = ops.filter((op) => {
    if (op.card) return true
    results.push(failed(op, "ЯМ: нет тела карточки — запись невозможна"))
    return false
  })
  // offerId в запросе уникален (спека): видео — отдельными пачками от правок того же оффера.
  for (const group of [valid.filter((op) => op.field !== "card_video"), valid.filter((op) => op.field === "card_video")]) {
    for (const batch of chunk(group, YM_CARDS_BATCH)) results.push(...(await updateMappings(cfg, batch, true)))
  }
  const opOf = new Map(ops.map((op) => [`${op.barcode}\u0000${op.field}`, op]))
  const of = (r: SendResult) => opOf.get(`${r.barcode}\u0000${r.field}`)
  const created = results.filter((r) => r.ok && of(r)?.card?.kind === "create" && (of(r)?.card?.initialStock ?? 0) > 0)
  if (created.length > 0) {
    const items = created.map((r) => ({ offerId: of(r)!.card!.offerId, count: of(r)!.card!.initialStock! }))
    try {
      await requestJson("ym", `${BASE}/v2/campaigns/${cfg.campaignId}/offers/stocks`, {
        ...ymAuth(cfg),
        method: "PUT",
        body: ymStocksBody(items, cfg.warehouseId, (cfg.now?.() ?? new Date()).toISOString()),
        retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS],
        timeoutMs: WRITE_TIMEOUT_MS,
      })
    } catch (e) {
      const stockError = errorText(e)
      for (let i = 0; i < results.length; i++) {
        const r = results[i]!
        if (created.includes(r)) results[i] = { ...r, response: { mapping: r.response ?? null, stockError } }
      }
    }
  }
  return results
}
```
`packages/platforms/src/index.ts` — добавить:
```ts
export {
  YM_CARDS_BATCH,
  YM_GROUP_PARAM_ID,
  fetchYmCardKeys,
  fetchYmModeration,
  fetchYmTakeBp,
  writeYmCards,
  ymCreateMapping,
  ymEditMapping,
  ymGroupMapping,
  ymVideoMapping,
  type YmCardKeys,
  type YmModeration,
  type YmCardWriterConfig,
  type YmCreateInput,
  type YmOfferMapping,
} from "./ym/cards"
```
Порядок результатов в тесте: отказы плохих — первыми, затем повтор хороших (так устроен `updateMappings`), затем правка — отдельной пачкой не идёт: `op("C", "content")` в той же пачке, что и создания, поэтому ожидание `[["B-BAD", false], ["B-A", true], ["B-C", true]]`.

- [ ] **Step 3: Проверка и коммит.**
```bash
npx vitest run packages/platforms/src/ym && npm run typecheck
git add packages/platforms/src/ym/cards.ts packages/platforms/src/ym/cards.test.ts packages/platforms/src/index.ts
git commit -m "sync2: ЯМ — карточки: ключи с архивом и видео, оффер по артикулу с группой вариантов, видео, модерация offer-cards, ставка из тарифов, первый остаток созданным"
```

---

### Task 8: KIT — ключи (с видео), характеристики, загрузка фото, видео по ссылке, продукт + вариант, правка (`kit/cards.ts`)

**Files:**
- Create: `packages/platforms/src/kit/cards.ts`, `packages/platforms/src/kit/cards.test.ts`
- Modify: `packages/platforms/src/kit/client.ts`, `packages/platforms/src/index.ts`

- [ ] **Step 1: Падающие тесты.** `packages/platforms/src/kit/cards.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { WbCardContent } from "@sync2/shared"
import type { WriteOp } from "../writer"
import { resetKitPaceForTests } from "./client"
import { KIT_SIZE_CHARACTERISTIC, fetchKitCardKeys, kitVariantDraft, writeKitCards, type KitVariantDraft, type KitVideoPayload } from "./cards"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
beforeEach(() => resetKitPaceForTests())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const content: WbCardContent = {
  nmId: 327127352,
  vendorCode: "JW-NB-AGT-M-0073",
  brand: "KOTELNIKOVARTIFACT",
  subject: "Браслеты",
  title: "Браслет Синергия с метеоритом Алетай и лабрадоритом",
  description: "Сертификат подлинности в комплекте.",
  characteristics: [
    { id: 14177449, name: "Цвет", values: ["серебристый"] },
    { id: 15000001, name: "ТНВЭД", values: ["7117900000"] },
    { id: 999, name: "Неизвестная KIT", values: ["x"] },
  ],
  photos: ["https://wb/1.webp", "https://wb/2.webp"],
  dimensions: { lengthCm: 30, widthCm: 20, heightCm: 3, weightKg: 0.1 },
  sizes: [
    { chrtId: 1, techSize: "19", wbSize: "1", barcodes: ["2042770600705"] },
    { chrtId: 2, techSize: "20", wbSize: "2", barcodes: ["2042770600712"] },
  ],
  video: null,
}

describe("KIT — черновик варианта", () => {
  it("контент WB как есть (свой магазин — без санитайзера), ТН ВЭД не переносится, размер — характеристикой, цена со скидкой", () => {
    const d = kitVariantDraft(content, { barcode: "2042770600712", size: "20", categoryId: "kit-braslety", price: { priceMinor: 617500, baseMinor: 1187500 } })
    expect(d).toMatchObject({
      name: content.title,
      description: "Сертификат подлинности в комплекте.",
      brand: "KOTELNIKOVARTIFACT",
      sku: "JW-NB-AGT-M-0073",
      barcode: "2042770600712",
      photoUrls: ["https://wb/1.webp", "https://wb/2.webp"],
      cargo: { length: 30, width: 20, height: 3, weight: 100 },
      pricing: { price: "11875.00", manual_discount_price: "6175.00" },
      size: "20",
    })
    expect(d.characteristics).toEqual([
      { title: "Цвет", values: ["серебристый"] },
      { title: "Неизвестная KIT", values: ["x"] },
      { title: KIT_SIZE_CHARACTERISTIC, values: ["20"] },
    ])
  })
})

describe("KIT — ключи и запись", () => {
  it("ключи: живые варианты и архив (status=ARCHIVED), штрихкод → вариант, продукт по штрихкоду", async () => {
    vi.useFakeTimers()
    const urls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url)
        return new URL(url).searchParams.get("status") === "ARCHIVED"
          ? json({ variants: [{ id: "v-arch", sku: "OLD", barcode: "111", product_id: "p0", status: "ARCHIVED" }], total_count: 1 })
          : json({ variants: [{ id: "v1", sku: "JW-NB-AGT-M-0073", barcode: "2042770600705", product_id: "p1", status: "PUBLISHED", media: [{ type: "IMAGE", display_sequence: 0, image_id: "i1" }, { type: "VIDEO", display_sequence: 1, video_id: "vid" }] }], total_count: 1 })
      }),
    )
    const pending = fetchKitCardKeys({ token: "t" })
    await vi.runAllTimersAsync()
    const k = await pending
    expect([...k.offerIds]).toEqual(["JW-NB-AGT-M-0073"])
    expect([...k.archivedOfferIds]).toEqual(["OLD"])
    expect(k.barcodeOwner.get("111")).toBe("v-arch")
    expect(k.productOfBarcode.get("2042770600705")).toBe("p1")
    expect([...k.withVideo]).toEqual(["v1"])
    expect(k.imagesOf.get("v1")).toEqual([{ type: "IMAGE", display_sequence: 0, image_id: "i1" }])
    expect(urls.some((u) => u.includes("status=ARCHIVED"))).toBe(true)
  })

  it("создание: характеристики по названиям, фото — загрузка (дедуп в прогоне), продукт с группировкой по «Размер», вариант PUBLISHED", async () => {
    vi.useFakeTimers()
    const calls: Array<{ method: string; path: string; body: unknown }> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const u = new URL(url)
        const method = init?.method ?? "GET"
        const body = init?.body instanceof FormData ? "form" : init?.body ? JSON.parse(String(init.body)) : null
        calls.push({ method, path: u.pathname, body })
        if (u.hostname === "wb") return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } })
        if (u.pathname === "/v1/characteristics") return json({ characteristics: [{ id: "c-color", title: "Цвет", type: "STRING" }, { id: "c-size", title: "Размер", type: "STRING" }], total_count: 2 })
        if (u.pathname === "/v1/files") return json({ id: `img-${calls.filter((c) => c.path === "/v1/files").length}`, type: "IMAGE", url: "https://avatars/x" })
        if (u.pathname === "/v1/products" && method === "POST") return json({ id: "p-new", category_ids: ["kit-braslety"], settings: { grouping_characteristic_ids: [], splitting_characteristic_ids: [] } })
        if (u.pathname === "/v1/products/p-new" && method === "PATCH") return json({ id: "p-new" })
        if (u.pathname === "/v1/variants" && method === "POST") return json({ id: `v-${calls.filter((c) => c.path === "/v1/variants").length}` })
        throw new Error(`${method} ${u.pathname}`)
      }),
    )
    const mk = (barcode: string, size: string): WriteOp => ({
      channel: "kit",
      barcode,
      field: "card_create",
      before: null,
      after: 1,
      externalSku: null,
      card: { kind: "create", nmId: 327127352, vendorCode: "JW-NB-AGT-M-0073", offerId: "JW-NB-AGT-M-0073", fields: ["title"], payload: kitVariantDraft(content, { barcode, size, categoryId: "kit-braslety", price: { priceMinor: 617500, baseMinor: 1187500 } }), productRef: null, decisionId: null },
    })
    const pending = writeKitCards({ token: "t", retryDelaysMs: [0] }, [mk("2042770600705", "19"), mk("2042770600712", "20")])
    await vi.runAllTimersAsync()
    const r = await pending
    expect(r.map((x) => x.ok)).toEqual([true, true])
    expect(r[0]!.response).toMatchObject({ variantId: "v-1", productId: "p-new" })
    expect(calls.filter((c) => c.path === "/v1/files")).toHaveLength(2)
    expect(calls.filter((c) => c.path === "/v1/products" && c.method === "POST")).toHaveLength(1)
    const patch = calls.find((c) => c.method === "PATCH")!
    expect(patch.body).toEqual({ settings: { grouping_characteristic_ids: ["c-size"], splitting_characteristic_ids: [] } })
    const variant = calls.find((c) => c.path === "/v1/variants")!.body as Record<string, unknown>
    expect(variant).toMatchObject({ product_id: "p-new", sku: "JW-NB-AGT-M-0073", barcode: "2042770600705", status: "PUBLISHED", vat: -1, requires_marking: false })
    expect(variant.characteristics).toEqual([
      { characteristic_id: "c-color", value: "серебристый", values: ["серебристый"] },
      { characteristic_id: "c-size", value: "19", values: ["19"] },
    ])
    expect(variant.media).toEqual([
      { type: "IMAGE", display_sequence: 0, image_id: "img-1" },
      { type: "IMAGE", display_sequence: 1, image_id: "img-2" },
    ])
  })

  it("видео: загрузка по ссылке (videos/from_url), PATCH media = фото варианта + видео", async () => {
    vi.useFakeTimers()
    const calls: Array<{ method: string; path: string; body: unknown }> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const u = new URL(url)
        calls.push({ method: init?.method ?? "GET", path: u.pathname, body: init?.body ? JSON.parse(String(init.body)) : null })
        if (u.pathname === "/v1/characteristics") return json({ characteristics: [], total_count: 0 })
        if (u.pathname === "/v1/videos/from_url") return json({ video_id: "vplv123" })
        return json({ id: "var-1" })
      }),
    )
    const payload: KitVideoPayload = { videoUrl: "https://kotelnikovartifact.ru/video/JW-1a2b3c4d.mp4", images: [{ type: "IMAGE", display_sequence: 0, image_id: "i1" }] }
    const pending = writeKitCards({ token: "t", retryDelaysMs: [0] }, [
      { channel: "kit", barcode: "B", field: "card_content", before: null, after: 2, externalSku: "var-1", card: { kind: "video", nmId: 1, vendorCode: "JW", offerId: "JW", fields: ["video"], payload, productRef: null, decisionId: null } },
    ])
    await vi.runAllTimersAsync()
    const r = await pending
    expect(r[0]!.ok).toBe(true)
    expect(calls.find((c) => c.path === "/v1/videos/from_url")!.body).toEqual({ url: payload.videoUrl })
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({
      media: [
        { type: "IMAGE", display_sequence: 0, image_id: "i1" },
        { type: "VIDEO", display_sequence: 1, video_id: "vplv123" },
      ],
    })
  })

  it("правка: PATCH варианта merge-patch, только изменившиеся поля; SEO-поля не шлются", async () => {
    vi.useFakeTimers()
    const calls: Array<{ method: string; path: string; body: unknown; ct: string | null }> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const u = new URL(url)
        calls.push({ method: init?.method ?? "GET", path: u.pathname, body: init?.body ? JSON.parse(String(init.body)) : null, ct: new Headers(init?.headers).get("content-type") })
        if (u.pathname === "/v1/characteristics") return json({ characteristics: [], total_count: 0 })
        return json({ id: "var-1" })
      }),
    )
    const d: KitVariantDraft = kitVariantDraft(content, { barcode: "2042770600705", size: "19", categoryId: "kit-braslety", price: null })
    const pending = writeKitCards({ token: "t", retryDelaysMs: [0] }, [
      { channel: "kit", barcode: "2042770600705", field: "card_content", before: 1, after: 2, externalSku: "var-1", card: { kind: "content", nmId: 1, vendorCode: "JW", offerId: "JW", fields: ["title", "dimensions"], payload: d, productRef: null, decisionId: null } },
    ])
    await vi.runAllTimersAsync()
    const r = await pending
    expect(r[0]!.ok).toBe(true)
    const patch = calls.find((c) => c.method === "PATCH")!
    expect(patch.path).toBe("/v1/variants/var-1")
    expect(patch.ct).toBe("application/merge-patch+json")
    expect(patch.body).toEqual({ name: content.title, cargo_boxes: [{ display_sequence: 1, length: 30, width: 20, height: 3, weight: 100 }] })
  })
})
```
Run: `npx vitest run packages/platforms/src/kit/cards.test.ts` → FAIL.

- [ ] **Step 2: Реализация — загрузка файла в клиенте.** `packages/platforms/src/kit/client.ts` — в импорт добавить `import { PlatformApiError } from "../errors"`, в конец раздела «очередь» после `kitRequestOrNull`:
```ts
/**
 * Загрузка файла (фото товара), `POST /v1/files` multipart — в той же очереди, что и остальные запросы (площадка рвёт
 * соединение при параллельных). KIT дедуплицирует по содержимому: повтор того же фото отдаёт прежний id.
 */
export function kitUploadFile(credentials: KitCredentials, bytes: ArrayBuffer, fileName: string, contentType: string): Promise<{ id: string; url: string }> {
  return enqueue(async () => {
    const form = new FormData()
    form.append("file", new Blob([bytes], { type: contentType }), fileName)
    const r = await fetch(`${BASE}/v1/files`, { method: "POST", headers: { Authorization: `Bearer ${credentials.token}` }, body: form, signal: AbortSignal.timeout(120_000) })
    const text = await r.text()
    if (!r.ok) throw new PlatformApiError("kit", r.status, `kit: файл не принят ${r.status}: ${text.slice(0, 200)}`, text)
    const body = JSON.parse(text) as { id?: string; url?: string }
    if (!body.id) throw new PlatformApiError("kit", r.status, "kit: ответ загрузки без id файла", body)
    return { id: body.id, url: body.url ?? "" }
  })
}
```

- [ ] **Step 3: Реализация — карточки.** `packages/platforms/src/kit/cards.ts`:
```ts
import { errorText, minorToDecimalString, type CardField, type WbCardContent } from "@sync2/shared"
import { WRITE_RETRY_DELAYS_MS, WRITE_TIMEOUT_MS, failed, isUncertain, succeeded } from "../stock-write"
import type { SendResult, WriteOp } from "../writer"
import { kitRequest, kitUploadFile, type KitCredentials } from "./client"

/** Характеристика размера в KIT (живое чтение 29.09: «Размер», STRING, SINGLE); по ней группируются варианты продукта. */
export const KIT_SIZE_CHARACTERISTIC = "Размер"
/** ТН ВЭД WB в KIT не переносится (как и на зеркала). */
const IGNORED = new Set([15000001, 15004139])

export type KitMediaItem = { type: "IMAGE"; display_sequence: number; image_id: string }

export interface KitCardKeys {
  /** Живые артикулы (sku) вариантов. */
  offerIds: Set<string>
  /** Варианты, у которых уже есть видео. */
  withVideo: Set<string>
  /** Вариант → его фото (media IMAGE): PATCH media заменяет список целиком, видео добавляется к ним. */
  imagesOf: Map<string, KitMediaItem[]>
  archivedOfferIds: Set<string>
  /** Штрихкод → id варианта (живые и архив). */
  barcodeOwner: Map<string, string>
  /** Штрихкод → id продукта: новый размер карточки добавляется в продукт уже выложенного размера. */
  productOfBarcode: Map<string, string>
}

interface KitVariantRow {
  id?: string
  sku?: string | null
  barcode?: string | null
  product_id?: string | null
  status?: string | null
  media?: Array<{ type?: string; display_sequence?: number; image_id?: string | null; video_id?: string | null }> | null
}

const PAGE = 100
const MAX_PAGES = 1000

export async function fetchKitCardKeys(cfg: KitCredentials): Promise<KitCardKeys> {
  const keys: KitCardKeys = { offerIds: new Set(), withVideo: new Set(), imagesOf: new Map(), archivedOfferIds: new Set(), barcodeOwner: new Map(), productOfBarcode: new Map() }
  for (const archived of [false, true]) {
    for (let page = 1; ; page++) {
      if (page > MAX_PAGES) throw new Error(`KIT: варианты не кончились за ${MAX_PAGES} страниц`)
      const body = await kitRequest<{ variants?: KitVariantRow[] | null }>(cfg, `/v1/variants?per_page=${PAGE}&page=${page}${archived ? "&status=ARCHIVED" : ""}`)
      const got = body.variants ?? []
      for (const v of got) {
        if (!v.id) continue
        if (v.sku) (archived || v.status === "ARCHIVED" ? keys.archivedOfferIds : keys.offerIds).add(v.sku)
        if (v.barcode && !keys.barcodeOwner.has(v.barcode)) keys.barcodeOwner.set(v.barcode, v.id)
        if (v.barcode && v.product_id && !archived) keys.productOfBarcode.set(v.barcode, v.product_id)
        const media = v.media ?? []
        if (media.some((m) => m.type === "VIDEO")) keys.withVideo.add(v.id)
        keys.imagesOf.set(
          v.id,
          media.flatMap((m): KitMediaItem[] => (m.type === "IMAGE" && m.image_id ? [{ type: "IMAGE", display_sequence: m.display_sequence ?? 0, image_id: m.image_id }] : [])),
        )
      }
      if (got.length < PAGE) break
    }
  }
  return keys
}

/** Характеристики магазина: название → id (ACTIVE). Названия у KIT — как у WB (41 шт., 29.09). */
export async function fetchKitCharacteristics(cfg: KitCredentials): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await kitRequest<{ characteristics?: Array<{ id?: string; title?: string }> | null }>(cfg, `/v1/characteristics?status=ACTIVE&per_page=${PAGE}&page=${page}`)
    const got = body.characteristics ?? []
    for (const c of got) if (c.id && c.title) out.set(c.title.trim().toLowerCase(), c.id)
    if (got.length < PAGE) return out
  }
  throw new Error(`KIT: характеристики не кончились за ${MAX_PAGES} страниц`)
}

/** Вариант KIT из контента WB: писатель сопоставит характеристики по названию и загрузит фото. */
export interface KitVariantDraft {
  name: string
  description: string
  brand: string
  sku: string
  barcode: string
  characteristics: Array<{ title: string; values: string[] }>
  photoUrls: string[]
  cargo: { length: number; width: number; height: number; weight: number } | null
  /** Как у записи цены KIT (kit/prices.ts): зачёркнутая — price, цель — manual_discount_price; null — цену пишет prices. */
  pricing: { price: string; manual_discount_price: string | null } | null
  categoryId: string
  /** Размер варианта — характеристика «Размер» и группировка продукта по ней; null — без размера. */
  size: string | null
}

export function kitVariantDraft(c: WbCardContent, i: { barcode: string; size: string | null; categoryId: string; price: { priceMinor: number; baseMinor: number | null } | null }): KitVariantDraft {
  const chars = c.characteristics.filter((x) => !IGNORED.has(x.id) && x.values.length > 0).map((x) => ({ title: x.name, values: x.values }))
  if (i.size !== null) chars.push({ title: KIT_SIZE_CHARACTERISTIC, values: [i.size] })
  const d = c.dimensions
  const p = i.price
  return {
    name: c.title,
    description: c.description,
    brand: c.brand || "KOTELNIKOVARTIFACT",
    sku: c.vendorCode,
    barcode: i.barcode,
    characteristics: chars,
    photoUrls: c.photos,
    cargo: d ? { length: Math.max(1, Math.round(d.lengthCm)), width: Math.max(1, Math.round(d.widthCm)), height: Math.max(1, Math.round(d.heightCm)), weight: Math.max(1, Math.round(d.weightKg * 1000)) } : null,
    pricing:
      p === null
        ? null
        : p.baseMinor !== null && p.baseMinor > p.priceMinor
          ? { price: minorToDecimalString(p.baseMinor), manual_discount_price: minorToDecimalString(p.priceMinor) }
          : { price: minorToDecimalString(p.priceMinor), manual_discount_price: null },
    categoryId: i.categoryId,
    size: i.size,
  }
}

/** Видео варианта: mp4 по постоянной ссылке + фото, которые у варианта уже есть (media заменяется целиком). */
export interface KitVideoPayload {
  videoUrl: string
  images: KitMediaItem[]
}

export interface KitCardWriterConfig extends KitCredentials {
  retryDelaysMs?: number[]
  /** Скачивание фото WB (подменяется в тестах). */
  download?: (url: string) => Promise<{ bytes: ArrayBuffer; contentType: string }>
}

async function downloadPhoto(url: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!r.ok) throw new Error(`фото WB ${url}: ${r.status}`)
  return { bytes: await r.arrayBuffer(), contentType: r.headers.get("content-type") ?? "image/webp" }
}

const writeOpts = (cfg: KitCardWriterConfig) => ({ retryDelaysMs: cfg.retryDelaysMs ?? [...WRITE_RETRY_DELAYS_MS], timeoutMs: WRITE_TIMEOUT_MS })

/**
 * Отправитель карточек KIT (решение п. 17 — без подтверждения). Создание: фото загружаются (кеш в вызове + дедуп
 * KIT), продукт — один на карточку WB (productRef уже выложенного размера или новый, с группировкой по «Размер»),
 * вариант PUBLISHED с ценой. Правка: PATCH варианта только изменившимися полями; characteristics/media/cargo_boxes
 * KIT заменяет целиком — шлём полный список; SEO-поля не трогаем.
 */
export async function writeKitCards(cfg: KitCardWriterConfig, ops: WriteOp[]): Promise<SendResult[]> {
  const results: SendResult[] = []
  let chars: Map<string, string>
  try {
    chars = await fetchKitCharacteristics(cfg)
  } catch (e) {
    return ops.map((op) => failed(op, `KIT: характеристики не прочитаны — ${errorText(e)}`))
  }
  const download = cfg.download ?? downloadPhoto
  const photoIds = new Map<string, string>()
  const productOfNm = new Map<number, string>()
  const sizeId = chars.get(KIT_SIZE_CHARACTERISTIC.toLowerCase()) ?? null

  const media = async (urls: readonly string[]) => {
    const out: Array<{ type: "IMAGE"; display_sequence: number; image_id: string }> = []
    for (const url of urls) {
      let id = photoIds.get(url)
      if (!id) {
        const f = await download(url)
        const name = url.split("/").pop() || "photo.webp"
        id = (await kitUploadFile(cfg, f.bytes, name, f.contentType)).id
        photoIds.set(url, id)
      }
      out.push({ type: "IMAGE", display_sequence: out.length, image_id: id })
    }
    return out
  }
  const characteristics = (d: KitVariantDraft) =>
    d.characteristics.flatMap((x) => {
      const id = chars.get(x.title.trim().toLowerCase())
      return id ? [{ characteristic_id: id, value: x.values[0] ?? "", values: x.values }] : []
    })
  const cargo = (d: KitVariantDraft) => (d.cargo ? [{ display_sequence: 1, ...d.cargo }] : [])

  for (const op of ops) {
    if (!op.card) {
      results.push(failed(op, "KIT: нет тела карточки — запись невозможна"))
      continue
    }
    const d = op.card.payload as KitVariantDraft
    try {
      if (op.card.kind === "create") {
        const m = await media(d.photoUrls)
        if (m.length === 0) {
          results.push(failed(op, "KIT: у карточки WB нет фото — вариант без изображения KIT не принимает"))
          continue
        }
        let productId = op.card.productRef ?? productOfNm.get(op.card.nmId) ?? null
        if (!productId) {
          const p = await kitRequest<{ id?: string }>(cfg, "/v1/products", { method: "POST", body: { category_ids: [d.categoryId] }, ...writeOpts(cfg) })
          if (!p.id) throw new Error("KIT: продукт создан без id")
          productId = p.id
          if (d.size !== null && sizeId) {
            await kitRequest(cfg, `/v1/products/${productId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/merge-patch+json" },
              body: { settings: { grouping_characteristic_ids: [sizeId], splitting_characteristic_ids: [] } },
              ...writeOpts(cfg),
            })
          }
        }
        productOfNm.set(op.card.nmId, productId)
        const v = await kitRequest<{ id?: string }>(cfg, "/v1/variants", {
          method: "POST",
          body: {
            product_id: productId,
            name: d.name,
            sku: d.sku,
            barcode: d.barcode,
            description: d.description,
            brand: d.brand,
            status: "PUBLISHED",
            characteristics: characteristics(d),
            media: m,
            ...(d.pricing ? { pricing: d.pricing } : {}),
            cargo_boxes: cargo(d),
            vat: -1,
            requires_marking: false,
          },
          ...writeOpts(cfg),
        })
        results.push(v.id ? succeeded(op, { variantId: v.id, productId }) : failed(op, "KIT: вариант создан без id", { uncertain: true }))
        continue
      }
      if (!op.externalSku) {
        results.push(failed(op, "KIT: нет id варианта — правка невозможна"))
        continue
      }
      if (op.card.kind === "video") {
        const v = op.card.payload as KitVideoPayload
        if (v.images.length === 0) {
          results.push(failed(op, "KIT: у варианта нет фото — видео без изображения KIT не принимает"))
          continue
        }
        const up = await kitRequest<{ video_id?: string }>(cfg, "/v1/videos/from_url", { method: "POST", body: { url: v.videoUrl }, ...writeOpts(cfg) })
        if (!up.video_id) throw new Error("KIT: загрузка видео без video_id")
        const images = [...v.images].sort((a, b) => a.display_sequence - b.display_sequence).map((m, i) => ({ ...m, display_sequence: i }))
        await kitRequest(cfg, `/v1/variants/${op.externalSku}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/merge-patch+json" },
          body: { media: [...images, { type: "VIDEO", display_sequence: images.length, video_id: up.video_id }] },
          ...writeOpts(cfg),
        })
        results.push(succeeded(op, { variantId: op.externalSku, videoId: up.video_id }))
        continue
      }
      const f = new Set<CardField>(op.card.fields)
      const body: Record<string, unknown> = {}
      if (f.has("title")) body.name = d.name
      if (f.has("description")) body.description = d.description
      if (f.has("characteristics") || f.has("sizes")) body.characteristics = characteristics(d)
      if (f.has("photos")) body.media = await media(d.photoUrls)
      if (f.has("dimensions")) body.cargo_boxes = cargo(d)
      if (Object.keys(body).length === 0) {
        results.push(succeeded(op, { nothing: true }))
        continue
      }
      await kitRequest(cfg, `/v1/variants/${op.externalSku}`, { method: "PATCH", headers: { "Content-Type": "application/merge-patch+json" }, body, ...writeOpts(cfg) })
      results.push(succeeded(op, { variantId: op.externalSku, fields: Object.keys(body) }))
    } catch (e) {
      results.push(failed(op, `KIT: ${errorText(e)}`, { uncertain: isUncertain(e) }))
    }
  }
  return results
}
```
`packages/platforms/src/index.ts` — добавить:
```ts
export { kitUploadFile } from "./kit/client"
export {
  KIT_SIZE_CHARACTERISTIC,
  fetchKitCardKeys,
  fetchKitCharacteristics,
  kitVariantDraft,
  writeKitCards,
  type KitCardKeys,
  type KitCardWriterConfig,
  type KitMediaItem,
  type KitVariantDraft,
  type KitVideoPayload,
} from "./kit/cards"
```
Тест создания опирается на `download` по умолчанию — `fetch` URL `https://wb/1.webp` (хост `wb`) отвечает байтами из заглушки; темп KIT 1,1 с между запросами (`kit/client.ts`) прокручивается `vi.runAllTimersAsync()`, как в `kit/adapter.test.ts`.

- [ ] **Step 4: Проверка и коммит.**
```bash
npx vitest run packages/platforms/src/kit && npm run typecheck
git add packages/platforms/src/kit/client.ts packages/platforms/src/kit/cards.ts packages/platforms/src/kit/cards.test.ts packages/platforms/src/index.ts
git commit -m "sync2: KIT — карточки: ключи с архивом и видео, характеристики по названию, загрузка фото WB, видео по ссылке, продукт с группировкой по «Размер», вариант, PATCH правки"
```

---

## Часть C — база, джоба, вопросы, команды

### Task 9: Хранилище карточек — версии WB, листинги из снимков, статусы и хеши (`@sync2/db/cards-store`)

**Files:**
- Create: `packages/db/src/cards-store.ts`
- Modify: `packages/db/src/index.ts`, `packages/db/src/products.ts`, `packages/db/src/store-4.db.test.ts`

- [ ] **Step 1: Падающие тесты** — дописать в `packages/db/src/store-4.db.test.ts` (в импорт — `insertStockSnapshot`, `poolItems`, функции из `./cards-store`, `inStockBarcodes` из `./products`):
```ts
import { insertStockSnapshot } from "./stock-snapshots"
import { inStockBarcodes } from "./products"
import {
  clearListingFailure,
  loadCardListings,
  loadWbCardVersion,
  markListingCreated,
  markListingFailed,
  saveWbCardRead,
  setListingHashes,
  stalePendingListings,
  syncListingsFromSnapshots,
} from "./cards-store"
import { poolItems } from "./schema"

describe.skipIf(!TEST_DATABASE_URL)("этап 4: хранилище карточек", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  const RUN = "00000000-0000-4000-8000-000000008101"
  const content = (nmId: number, title: string) => ({ nmId, vendorCode: `V${nmId}`, brand: "K", subject: "Обереги", title, description: "", characteristics: [], photos: [], dimensions: null, sizes: [], video: null })
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    await insertRun(h.db, RUN)
    await h.db.insert(products).values([
      { barcode: "B1", vendorCode: "V1", nmId: 1, title: "t1" },
      { barcode: "B2", vendorCode: "V2", nmId: 2, title: "t2" },
    ])
  })
  afterAll(async () => h?.close())

  it("версии WB: новая — added, та же — ничего, другой хеш — changed; версия читается по (nm_id, хеш)", async () => {
    expect(await saveWbCardRead(h.db, RUN, [{ content: content(1, "a"), hash: "h1" }], "2026-10-12T16:19:00.000Z")).toEqual({ added: [1], changed: [], notSeen: 0 })
    expect(await saveWbCardRead(h.db, RUN, [{ content: content(1, "a"), hash: "h1" }], "2026-10-12T17:19:00.000Z")).toEqual({ added: [], changed: [], notSeen: 0 })
    expect(await saveWbCardRead(h.db, RUN, [{ content: content(1, "b"), hash: "h2" }, { content: content(2, "c"), hash: "h3" }], "2026-10-12T18:19:00.000Z")).toEqual({ added: [2], changed: [1], notSeen: 0 })
    expect(await saveWbCardRead(h.db, RUN, [{ content: content(2, "c"), hash: "h3" }], "2026-10-12T19:19:00.000Z")).toEqual({ added: [], changed: [], notSeen: 1 })
    expect((await loadWbCardVersion(h.db, 1, "h1"))!.title).toBe("a")
    expect(await loadWbCardVersion(h.db, 1, "h9")).toBeNull()
  })

  it("листинги из последних снимков Ozon/ЯМ/KIT: active, внешний ключ, nm_id; ожидающий и отклонённый становятся active", async () => {
    const chs = await loadChannels(h.db)
    await markListingCreated(h.db, { channelId: chs.get("ozon")!.id, barcode: "B2", externalId: "V2", nmId: 2, hash: "h3", runId: RUN, status: "pending" })
    await markListingFailed(h.db, { channelId: chs.get("ym")!.id, barcode: "B1", externalId: "V1", nmId: 1, hash: "h2", error: "UNKNOWN_CATEGORY" })
    await insertStockSnapshot(h.db, { channelId: chs.get("ozon")!.id, runId: RUN, takenAt: "2026-10-12T16:16:00.000Z", stocks: [{ barcode: "B1", externalSku: "V1", quantity: 1, warehouse: null }, { barcode: "B2", externalSku: "V2", quantity: 0, warehouse: null }] })
    await insertStockSnapshot(h.db, { channelId: chs.get("ym")!.id, runId: RUN, takenAt: "2026-10-12T16:16:00.000Z", stocks: [{ barcode: "B1", externalSku: "V1", quantity: 1, warehouse: "2369574" }] })
    expect(await syncListingsFromSnapshots(h.db, chs, new Map([["B1", 1], ["B2", 2]]))).toBe(3)
    const rows = await loadCardListings(h.db, chs)
    expect(rows.map((r) => [r.channel, r.barcode, r.externalId, r.status, r.contentHash, r.nmId]).sort()).toEqual([
      ["ozon", "B1", "V1", "active", null, 1],
      ["ozon", "B2", "V2", "active", "h3", 2],
      ["ym", "B1", "V1", "active", "h2", 1],
    ])
  })

  it("хеши, повтор отклонённого, ожидающие дольше суток, товары в наличии", async () => {
    const chs = await loadChannels(h.db)
    const ozon = chs.get("ozon")!.id
    await setListingHashes(h.db, ozon, ["B1"], "h2")
    expect((await loadCardListings(h.db, chs)).find((r) => r.channel === "ozon" && r.barcode === "B1")!.contentHash).toBe("h2")
    const kit = chs.get("kit")!.id
    await markListingFailed(h.db, { channelId: kit, barcode: "B2", externalId: "V2", nmId: 2, hash: "h3", error: "KIT 400" })
    expect(await clearListingFailure(h.db, kit, "B2")).toBe(true)
    expect(await clearListingFailure(h.db, kit, "B2")).toBe(false)
    expect((await loadCardListings(h.db, chs)).find((r) => r.channel === "kit")).toMatchObject({ status: "failed", contentHash: null })
    await markListingCreated(h.db, { channelId: kit, barcode: "B1", externalId: "V1", nmId: 1, hash: "h2", runId: RUN, status: "pending" })
    expect(await stalePendingListings(h.db, chs, new Date(Date.now() + 60_000).toISOString())).toEqual([{ channel: "kit", barcode: "B1", externalId: "V1" }])
    await h.db.insert(poolItems).values([{ barcode: "B1", base: 2, wbExpected: 2 }, { barcode: "B2", base: 0, wbExpected: 0 }])
    expect(await inStockBarcodes(h.db)).toEqual(new Map([["B1", 2]]))
  })
})
```
Run: `npm run test:db -- packages/db/src/store-4.db.test.ts` → FAIL (нет модуля).

- [ ] **Step 2: Реализация.** `packages/db/src/cards-store.ts`:
```ts
import { and, eq, inArray, lt, sql } from "drizzle-orm"
import type { ListingState } from "@sync2/domain"
import { CARD_CHANNELS, isCardChannel, type CardChannel, type Channel, type ListingStatus, type WbCardContent } from "@sync2/shared"
import type { ChannelRow } from "./channels"
import type { Db } from "./client"
import { listings, wbCardVersions, wbCards } from "./schema"
import { latestStockSnapshots } from "./stock-snapshots"
import { toIso, toIsoOrNull } from "./time"

export interface WbCardRead {
  content: WbCardContent
  hash: string
}

/**
 * Чтение каталога WB → версии (только дописываются, одна на (nm_id, хеш)) и текущий хеш карточки. added — новые
 * карточки, changed — хеш сменился; notSeen — известные карточки, которых нет в этом чтении (не удаляются).
 */
export async function saveWbCardRead(db: Db, runId: string, cards: readonly WbCardRead[], nowIso: string): Promise<{ added: number[]; changed: number[]; notSeen: number }> {
  const prev = new Map((await db.select({ nmId: wbCards.nmId, hash: wbCards.contentHash }).from(wbCards)).map((r) => [r.nmId, r.hash]))
  const added: number[] = []
  const changed: number[] = []
  for (const c of cards) {
    const p = prev.get(c.content.nmId)
    if (p === undefined) added.push(c.content.nmId)
    else if (p !== c.hash) changed.push(c.content.nmId)
  }
  if (cards.length > 0) {
    await db
      .insert(wbCardVersions)
      .values(cards.map((c) => ({ nmId: c.content.nmId, contentHash: c.hash, content: c.content, runId })))
      .onConflictDoNothing()
    await db
      .insert(wbCards)
      .values(cards.map((c) => ({ nmId: c.content.nmId, vendorCode: c.content.vendorCode, contentHash: c.hash, seenAt: nowIso, changedAt: nowIso })))
      .onConflictDoUpdate({
        target: wbCards.nmId,
        set: {
          vendorCode: sql`excluded.vendor_code`,
          // SET вычисляется по старой строке: changed_at сдвигается только при смене хеша.
          changedAt: sql`case when ${wbCards.contentHash} = excluded.content_hash then ${wbCards.changedAt} else excluded.changed_at end`,
          contentHash: sql`excluded.content_hash`,
          seenAt: sql`excluded.seen_at`,
        },
      })
  }
  const read = new Set(cards.map((c) => c.content.nmId))
  const notSeen = [...prev.keys()].filter((n) => !read.has(n)).length
  return { added, changed, notSeen }
}

export async function loadWbCardVersion(db: Db, nmId: number, hash: string): Promise<WbCardContent | null> {
  const [r] = await db
    .select({ content: wbCardVersions.content })
    .from(wbCardVersions)
    .where(and(eq(wbCardVersions.nmId, nmId), eq(wbCardVersions.contentHash, hash)))
  return r?.content ?? null
}

/** nm_id → текущий хеш WB (последнее чтение) — для `cards baseline`. */
export async function loadWbCardHashes(db: Db): Promise<Map<number, string>> {
  return new Map((await db.select({ nmId: wbCards.nmId, hash: wbCards.contentHash }).from(wbCards)).map((r) => [r.nmId, r.hash]))
}

const cardChannelIds = (chs: ReadonlyMap<Channel, ChannelRow>) => CARD_CHANNELS.flatMap((c) => (chs.get(c) ? [{ channel: c, id: chs.get(c)!.id }] : []))

/**
 * Листинги Ozon/ЯМ/KIT из последних снимков остатков: товар в снимке — active с ключом площадки (offer_id, id варианта).
 * Ожидающий (создан синком) и отклонённый, появившиеся в снимке, — тоже active; хеш контента не трогается.
 */
export async function syncListingsFromSnapshots(db: Db, chs: ReadonlyMap<Channel, ChannelRow>, nmIdOf: ReadonlyMap<string, number>): Promise<number> {
  const snaps = await latestStockSnapshots(db)
  let n = 0
  for (const { id } of cardChannelIds(chs)) {
    const snap = snaps.get(id)
    if (!snap) continue
    const rows = new Map<string, string>()
    for (const s of snap.stocks) if (s.externalSku && !rows.has(s.barcode)) rows.set(s.barcode, s.externalSku)
    if (rows.size === 0) continue
    await db
      .insert(listings)
      .values([...rows].map(([barcode, externalId]) => ({ channelId: id, barcode, externalId, status: "active", nmId: nmIdOf.get(barcode) ?? null, seenAt: snap.takenAt })))
      .onConflictDoUpdate({
        target: [listings.channelId, listings.barcode],
        set: {
          externalId: sql`excluded.external_id`,
          status: sql`'active'`,
          nmId: sql`coalesce(excluded.nm_id, ${listings.nmId})`,
          seenAt: sql`excluded.seen_at`,
          lastError: sql`null`,
          updatedAt: sql`now()`,
        },
      })
    n += rows.size
  }
  return n
}

export interface CardListingRow extends ListingState {
  nmId: number | null
  seenAt: string | null
  updatedAt: string
}

export async function loadCardListings(db: Db, chs: ReadonlyMap<Channel, ChannelRow>): Promise<CardListingRow[]> {
  const ids = cardChannelIds(chs)
  if (ids.length === 0) return []
  const codeOf = new Map(ids.map((x) => [x.id, x.channel]))
  const rows = await db.select().from(listings).where(inArray(listings.channelId, ids.map((x) => x.id)))
  return rows.flatMap((r) => {
    const channel = codeOf.get(r.channelId)
    if (!channel || !isCardChannel(channel)) return []
    return [
      {
        channel,
        barcode: r.barcode,
        externalId: r.externalId,
        status: r.status as ListingStatus,
        contentHash: r.contentHash,
        lastError: r.lastError,
        nmId: r.nmId,
        seenAt: toIsoOrNull(r.seenAt),
        updatedAt: toIso(r.updatedAt),
      },
    ]
  })
}

export interface ListingCreated {
  channelId: number
  barcode: string
  externalId: string
  nmId: number
  hash: string
  runId: string
  /** pending — Ozon/ЯМ (появится в снимке после модерации); active — KIT (вариант есть сразу). */
  status: Extract<ListingStatus, "pending" | "active">
}

export async function markListingCreated(db: Db, l: ListingCreated): Promise<void> {
  await db
    .insert(listings)
    .values({ channelId: l.channelId, barcode: l.barcode, externalId: l.externalId, status: l.status, contentHash: l.hash, nmId: l.nmId, createdRunId: l.runId })
    .onConflictDoUpdate({
      target: [listings.channelId, listings.barcode],
      set: { externalId: l.externalId, status: l.status, contentHash: l.hash, nmId: l.nmId, createdRunId: l.runId, lastError: null, updatedAt: sql`now()` },
    })
}

/** Создание отклонено: повтор — только после правки WB (другой хеш) или `cards retry`. */
export async function markListingFailed(db: Db, l: Omit<ListingCreated, "runId" | "status"> & { error: string }): Promise<void> {
  await db
    .insert(listings)
    .values({ channelId: l.channelId, barcode: l.barcode, externalId: l.externalId, status: "failed", contentHash: l.hash, nmId: l.nmId, lastError: l.error })
    .onConflictDoUpdate({
      target: [listings.channelId, listings.barcode],
      set: { status: "failed", contentHash: l.hash, lastError: l.error, updatedAt: sql`now()` },
      // Товар уже на площадке (active) отказом повторного создания не портится.
      setWhere: sql`${listings.status} <> 'active'`,
    })
}

/** Листинги синхронизированы с этим контентом WB: базовая линия, применённая правка, «не применять». */
export async function setListingHashes(db: Db, channelId: number, barcodes: readonly string[], hash: string): Promise<void> {
  if (barcodes.length === 0) return
  await db
    .update(listings)
    .set({ contentHash: hash, updatedAt: sql`now()` })
    .where(and(eq(listings.channelId, channelId), inArray(listings.barcode, [...barcodes])))
}

/** `cards retry`: у отклонённого стирается хеш попытки — следующий прогон создаёт заново. false — отклонённого нет. */
export async function clearListingFailure(db: Db, channelId: number, barcode: string): Promise<boolean> {
  const rows = await db
    .update(listings)
    .set({ contentHash: null, updatedAt: sql`now()` })
    .where(and(eq(listings.channelId, channelId), eq(listings.barcode, barcode), eq(listings.status, "failed"), sql`${listings.contentHash} is not null`))
    .returning({ id: listings.id })
  return rows.length > 0
}

/** Созданы синком и не появились в снимке до края — алерт «не появилась на площадке». */
export async function stalePendingListings(db: Db, chs: ReadonlyMap<Channel, ChannelRow>, beforeIso: string): Promise<Array<{ channel: CardChannel; barcode: string; externalId: string }>> {
  const ids = cardChannelIds(chs)
  if (ids.length === 0) return []
  const codeOf = new Map(ids.map((x) => [x.id, x.channel]))
  const rows = await db
    .select({ channelId: listings.channelId, barcode: listings.barcode, externalId: listings.externalId })
    .from(listings)
    .where(and(eq(listings.status, "pending"), lt(listings.updatedAt, beforeIso), inArray(listings.channelId, ids.map((x) => x.id))))
  return rows.flatMap((r) => (codeOf.has(r.channelId) ? [{ channel: codeOf.get(r.channelId)!, barcode: r.barcode, externalId: r.externalId }] : []))
}
```
`packages/db/src/products.ts` — добавить:
```ts
/** Штрихкод → остаток пула (> 0): карточки создаются только для товаров в наличии (решение п. 16). */
export async function inStockBarcodes(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ barcode: poolItems.barcode, base: poolItems.base }).from(poolItems).where(gt(poolItems.base, 0))
  return new Map(rows.map((r) => [r.barcode, r.base]))
}
```
`packages/db/src/index.ts` — добавить `export * from "./cards-store"`.

Проверка `markListingFailed` с `setWhere`: drizzle 0.45 поддерживает `onConflictDoUpdate({ target, set, setWhere })` (генерирует `ON CONFLICT … DO UPDATE SET … WHERE …`); тест «ожидающий и отклонённый становятся active» проверяет обратный путь — снимок переводит отклонённый в active.

- [ ] **Step 3: Проверка и коммит.**
```bash
npm run test:db -- packages/db/src/store-4.db.test.ts && npm run typecheck && npm test && npm run test:db
git add packages/db/src/cards-store.ts packages/db/src/products.ts packages/db/src/index.ts packages/db/src/store-4.db.test.ts
git commit -m "sync2: карточки — хранилище: версии контента WB, листинги из снимков Ozon/ЯМ/KIT, создание/отказ/повтор, хеши, ожидающие дольше суток"
```

---

### Task 10: Джоба `cards` — чтение, базовая линия, создания (темп 29.09), правки KIT, предохранители; отправитель карточек

**Files:**
- Create: `apps/worker/src/card-senders.ts`, `apps/worker/src/card-senders.test.ts`, `apps/worker/src/jobs/cards.ts`, `apps/worker/src/jobs/cards.db.test.ts`

- [ ] **Step 1: Падающие тесты.** `apps/worker/src/card-senders.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import type { WriteOp } from "@sync2/platforms"
import { buildCardSender } from "./card-senders"
import { loadChannelsConfig } from "./channels-config"

const env = {
  WB_API_TOKEN: "w",
  OZON_CLIENT_ID: "5332036",
  OZON_API_TOKEN: "o",
  YM_API_TOKEN: "y",
  YM_BUSINESS_ID: "191766894",
  YM_CAMPAIGN_ID: "149197829",
  YM_WAREHOUSE_IDS: "2369574",
  YAKIT_API_TOKEN: "k",
  KIT_WAREHOUSE_ID: "01980d4c-1b53-7aa1-ab23-1b7c23604704",
}
afterEach(() => vi.unstubAllGlobals())
const op = (field: WriteOp["field"]): WriteOp => ({ channel: "ozon", barcode: "B", field, before: null, after: 1, externalSku: "V" })

describe("отправитель карточек", () => {
  it("пишет только карточки и только на Ozon/ЯМ/KIT; WB и сайт — отказ до сети", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const send = buildCardSender(loadChannelsConfig(env))
    await expect(send("wb", [op("card_create")])).rejects.toThrow(/не пишутся на wb/)
    await expect(send("site", [op("card_create")])).rejects.toThrow(/не пишутся на site/)
    await expect(send("ozon", [op("price")])).rejects.toThrow(/не поле карточки/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```
`apps/worker/src/jobs/cards.db.test.ts`:
```ts
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { agreedPrices, channels, getState, insertStockSnapshot, listings, loadChannels, poolItems, products, seedChannels, sppCoefficients, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import type { SendResult, WriteOp } from "@sync2/platforms"
import type { Channel, WbCardContent } from "@sync2/shared"
import { loadCardCategories } from "../card-config"
import { loadPricingConfig } from "../pricing-config"
import { CARDS_PLAN_KEY, runCards, type CardSources, type CardsPlanSummary } from "./cards"

const NOW = new Date("2026-10-12T16:19:00.000Z")
const card = (over: Partial<WbCardContent> = {}): WbCardContent => ({
  nmId: 1631024060,
  vendorCode: "888645543123",
  brand: "KOTELNIKOVARTIFACT",
  subject: "Обереги",
  title: "Браслет из Ливийского стекла",
  description: "Браслет из натурального ливийского стекла.",
  characteristics: [{ id: 14177449, name: "Цвет", values: ["светло-зеленый"] }],
  photos: ["https://basket-49.wbbasket.ru/x/images/big/1.webp"],
  dimensions: { lengthCm: 25, widthCm: 15, heightCm: 6, weightKg: 0.1 },
  sizes: [{ chrtId: 2582121787, techSize: "0", wbSize: "", barcodes: ["2057086856166"] }],
  video: null,
  ...over,
})
const existing = card({ nmId: 327127352, vendorCode: "JW-NB-AGT-M-0073", subject: "Браслеты", title: "Браслет Синергия", sizes: [{ chrtId: 1, techSize: "0", wbSize: "", barcodes: ["2042770600705"] }] })
const noKeys = () => ({ offerIds: new Set<string>(), archivedOfferIds: new Set<string>(), barcodeOwner: new Map<string, string>() })
const sources = (cards: WbCardContent[]): CardSources => ({
  wbCards: async () => ({ cards, rejected: 0 }),
  ozonKeys: async () => ({ ...noKeys(), productIdOf: new Map([["JW-NB-AGT-M-0073", 777]]) }),
  ymKeys: async () => ({ ...noKeys(), categoryOf: new Map() }),
  kitKeys: async () => ({ ...noKeys(), productOfBarcode: new Map() }),
  ozonDict: async () => null,
  ozonCreateQuota: async () => 100,
})
const okSend = () =>
  vi.fn(async (c: Channel, ops: WriteOp[]): Promise<SendResult[]> => ops.map((o) => ({ barcode: o.barcode, field: o.field, ok: true, response: c === "kit" ? { variantId: `var-${o.barcode}` } : { productId: 1 } })))

describe.skipIf(!TEST_DATABASE_URL)("runCards", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let n = 0
  const nextRun = async () => {
    const id = `00000000-0000-4000-8000-${String(8200 + ++n).padStart(12, "0")}`
    await insertRun(h.db, id)
    return id
  }
  const mode = (c: Channel, m: "off" | "dry-run" | "apply") => h.db.update(channels).set({ cardWriteMode: m }).where(eq(channels.code, c))
  const job = async (cards: WbCardContent[], send = okSend(), extra: Partial<Parameters<typeof runCards>[0]> = {}) => {
    const runId = await nextRun()
    const r = await runCards({ db: h.db, now: () => NOW, runId, globalMode: "apply", categories: loadCardCategories(), pricing: loadPricingConfig(), sources: sources(cards), send, ...extra })
    const rows = await h.db.select().from(writes).where(eq(writes.runId, runId))
    return { r, rows, send }
  }
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    const chs = await loadChannels(h.db)
    const seed = await nextRun()
    await h.db.insert(products).values([
      { barcode: "2057086856166", vendorCode: "888645543123", nmId: 1631024060, title: "Браслет из Ливийского стекла", wbSubject: "Обереги" },
      { barcode: "2042770600705", vendorCode: "JW-NB-AGT-M-0073", nmId: 327127352, title: "Браслет Синергия", wbSubject: "Браслеты" },
    ])
    await h.db.insert(poolItems).values([{ barcode: "2057086856166", base: 1, wbExpected: 1 }, { barcode: "2042770600705", base: 3, wbExpected: 3 }])
    await h.db.insert(agreedPrices).values([
      { nmId: 1631024060, barcode: "2057086856166", priceMinor: 900000, source: "cli", approvedBy: "test" },
      { nmId: 327127352, barcode: "2042770600705", priceMinor: 1149000, source: "cli", approvedBy: "test" },
    ])
    await h.db.insert(sppCoefficients).values({ windowFrom: "2026-09-01", windowTo: "2026-10-01", sales: 30, medianBp: 2500, activeBp: 2500, changed: true, reason: "test", runId: seed })
    for (const c of ["ozon", "ym", "kit"] as const) {
      await insertStockSnapshot(h.db, { channelId: chs.get(c)!.id, runId: seed, takenAt: "2026-10-12T16:16:00.000Z", stocks: [{ barcode: "2042770600705", externalSku: c === "kit" ? "var-0705" : "JW-NB-AGT-M-0073", quantity: 3, warehouse: null }] })
    }
  })
  afterAll(async () => h?.close())
  beforeEach(async () => {
    for (const c of ["ozon", "ym", "kit"] as const) await mode(c, "off")
  })

  it("режимы off: базовая линия существующим, план созданий — в журнал с mode off, в сеть ни шагу, сводка сохранена", async () => {
    const { r, rows, send } = await job([card(), existing])
    expect(send).not.toHaveBeenCalled()
    expect(r.counters).toMatchObject({ wbCards: 2, cardBaselines: 3, ozonCardPlanned: 1, ymCardPlanned: 1, kitCardPlanned: 1 })
    expect(rows.map((w) => [w.field, w.barcode, w.mode]).sort()).toEqual([
      ["card_create", "2057086856166", "off"],
      ["card_create", "2057086856166", "off"],
      ["card_create", "2057086856166", "off"],
    ])
    const ozon = rows.find((w) => w.externalSku === "888645543123" && (w.detail as { payload: { item?: unknown } }).payload.item)!
    expect((ozon.detail as { payload: { item: { description_category_id: number; type_id: number } } }).payload.item).toMatchObject({ description_category_id: 17027899, type_id: 87458883 })
    const all = await h.db.select().from(listings)
    expect(all.every((l) => l.contentHash !== null)).toBe(true)
    const summary = await getState<CardsPlanSummary>(h.db, CARDS_PLAN_KEY)
    expect(summary!.creates).toHaveLength(3)
  })

  it("KIT apply: вариант создан, листинг active с id варианта; Ozon/ЯМ остаются off", async () => {
    await mode("kit", "apply")
    const { r, send } = await job([card(), existing])
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]![0]).toBe("kit")
    expect(r.counters).toMatchObject({ kitCardCreated: 1 })
    const [kit] = await h.db.select().from(listings).where(eq(listings.externalId, "var-2057086856166"))
    expect(kit).toMatchObject({ status: "active", barcode: "2057086856166" })
  })

  it("правка WB: KIT правится сразу (card_content), Ozon/ЯМ — не пишутся этой задачей", async () => {
    await mode("kit", "apply")
    const changed = card({ title: "Браслет из ливийского стекла, бусины 7,3 мм" })
    const { rows, send } = await job([changed, existing])
    const kitEdit = rows.find((w) => w.field === "card_content")!
    expect(kitEdit).toMatchObject({ barcode: "2057086856166", externalSku: "var-2057086856166", applied: true })
    expect((kitEdit.detail as { fields: string[] }).fields).toEqual(["title"])
    expect(send.mock.calls.every((c) => c[0] === "kit")).toBe(true)
  })

  it("нет прайса — создание пропущено с причиной (предел на площадку его не расходует)", async () => {
    const fresh = card({ nmId: 1, vendorCode: "NEW1", sizes: [{ chrtId: 9, techSize: "0", wbSize: "", barcodes: ["2099999999991"] }] })
    await h.db.insert(products).values({ barcode: "2099999999991", vendorCode: "NEW1", nmId: 1, title: "t", wbSubject: "Обереги" })
    await h.db.insert(poolItems).values({ barcode: "2099999999991", base: 1, wbExpected: 1 })
    const { r } = await job([fresh], okSend(), { maxCreatesPerChannel: 1 })
    const summary = await getState<CardsPlanSummary>(h.db, CARDS_PLAN_KEY)
    expect(summary!.skips.map((s) => s.reason)).toContain("нет прайса — ответьте на вопрос «товар без прайса» (этап 2); карточка создастся следующим прогоном")
    expect(r.counters.cardCreatesDeferred ?? 0).toBe(0)
  })

  it("массовая правка WB (> 25 карточек) — правки не отправляются, партиал с подсказкой", async () => {
    await mode("kit", "apply")
    const many = Array.from({ length: 26 }, (_, i) => card({ nmId: 5000 + i, vendorCode: `M${i}`, sizes: [{ chrtId: i, techSize: "0", wbSize: "", barcodes: [`29000000000${String(i).padStart(2, "0")}`] }] }))
    for (const c of many) await h.db.insert(products).values({ barcode: c.sizes[0]!.barcodes[0]!, vendorCode: c.vendorCode, nmId: c.nmId, title: "t", wbSubject: "Обереги" })
    const chs = await loadChannels(h.db)
    for (const c of many) await h.db.insert(listings).values({ channelId: chs.get("kit")!.id, barcode: c.sizes[0]!.barcodes[0]!, externalId: `v${c.nmId}`, status: "active", contentHash: "old", nmId: c.nmId })
    const { r, rows } = await job(many)
    expect(r.status).toBe("partial")
    expect(r.counters.cardsMassStopped).toBe(26)
    expect(r.error).toContain("cards baseline --confirm")
    expect(rows.filter((w) => w.field === "card_content")).toHaveLength(0)
  })
})
```
Run: `npx vitest run apps/worker/src/card-senders.test.ts` → FAIL; `npm run test:db -- apps/worker/src/jobs/cards.db.test.ts` → FAIL.

- [ ] **Step 2: Реализация — отправитель.** `apps/worker/src/card-senders.ts`:
```ts
import { writeKitCards, writeOzonCards, writeYmCards, type Sender } from "@sync2/platforms"
import type { ChannelsConfig } from "./channels-config"

/**
 * Отправитель карточек для executeWrites (этап 4): Ozon, ЯМ, KIT; WB — мастер (не пишется), сайт берёт контент сам.
 * Остаток, цена и защиты сюда не попадают — у них свои отправители и режимы.
 */
export function buildCardSender(cfg: ChannelsConfig): Sender {
  return async (channel, ops) => {
    if (ops.some((o) => o.field !== "card_create" && o.field !== "card_content" && o.field !== "card_video")) throw new Error("карточки: в пачке не поле карточки")
    switch (channel) {
      case "ozon":
        return writeOzonCards(cfg.ozon, ops)
      case "ym": {
        const warehouseId = cfg.ym.warehouseIds[0]
        if (warehouseId === undefined) throw new Error("карточки ЯМ: YM_WAREHOUSE_IDS пуст — первый остаток созданным некуда писать")
        return writeYmCards({ ...cfg.ym, warehouseId }, ops)
      }
      case "kit":
        return writeKitCards({ token: cfg.kit.token }, ops)
      default:
        throw new Error(`карточки не пишутся на ${channel}`)
    }
  }
}
```

- [ ] **Step 3: Реализация — джоба.** `apps/worker/src/jobs/cards.ts`:
```ts
import {
  cardContentHash,
  diffCardContent,
  hashToNumber,
  mirrorPrices,
  planCards,
  routeCard,
  sanitizeCardForMirror,
  type CardCategories,
  type CardCreate,
  type CardPlan,
  type CardSkip,
  type MirrorKeys,
  type SubjectRates,
} from "@sync2/domain"
import {
  activeSpp,
  drizzleWriteStore,
  inStockBarcodes,
  latestWbPriceSnapshot,
  loadAgreedPrices,
  loadCardListings,
  loadChannels,
  loadProducts,
  loadWbCardVersion,
  markListingCreated,
  markListingFailed,
  saveWbCardRead,
  setListingHashes,
  setState,
  stalePendingListings,
  syncListingsFromSnapshots,
  type ChannelRow,
  type Db,
} from "@sync2/db"
import {
  OZON_DICT,
  WriteJournalError,
  executeWrites,
  kitVariantDraft,
  ozonImportItem,
  ymCreateMapping,
  type KitCardKeys,
  type OzonCardKeys,
  type Sender,
  type WriteOp,
  type WriteOutcome,
  type YmCardKeys,
} from "@sync2/platforms"
import { CARD_CHANNELS, CARD_FIELDS, CHANNEL_LABELS, errorText, sizeLabel, type CardChannel, type CardRoute, type Channel, type WbCardContent, type WriteMode } from "@sync2/shared"
import type { PricingConfig } from "../pricing-config"

export const CARDS_JOB = "cards"
/**
 * Созданий за прогон на площадку (решение 29.09 п. 4: первый прогон — одна карточка, дальше все недостающие разом;
 * 29.09 недостаёт 24/23/17 — потолок ловит только сбой ключей). У Ozon ещё суточный лимит площадки.
 */
export const MAX_CARD_CREATES_PER_CHANNEL = 40
export const MAX_KIT_EDITS_PER_RUN = 20
/** Контент изменился у стольких карточек сразу — массовая правка WB: зеркала не трогаем без решения владельца. */
export const MASS_CHANGE_CARDS = 25
export const PENDING_ALERT_MS = 24 * 3_600_000
export const CARDS_PLAN_KEY = "cards:last-plan"
const MAX_SHOWN = 5
const shown = (items: readonly string[]) => items.slice(0, MAX_SHOWN).join(", ") + (items.length > MAX_SHOWN ? ` … ещё ${items.length - MAX_SHOWN}` : "")

export interface CardSources {
  wbCards: () => Promise<{ cards: WbCardContent[]; rejected: number }>
  ozonKeys: () => Promise<OzonCardKeys>
  ymKeys: () => Promise<YmCardKeys>
  kitKeys: () => Promise<KitCardKeys>
  ozonDict: (q: { categoryId: number; typeId: number; attributeId: number; value: string }) => Promise<number | null>
  ozonCreateQuota: () => Promise<number | null>
}

export interface CardsDeps {
  db: Db
  now: () => Date
  runId: string
  globalMode: WriteMode
  categories: CardCategories
  pricing: PricingConfig
  sources: CardSources
  send: Sender
  /** Выборочный прогон: артикулы или штрихкоды WB. Счётчик cardsOnly — такой прогон не план для apply. */
  only?: readonly string[]
  /** Только эти площадки (первый боевой прогон — одна площадка). */
  channelsOnly?: readonly CardChannel[]
  /** Отправить правки, несмотря на массовую правку WB (`cards run --allow-mass --confirm`). */
  allowMass?: boolean
  maxCreatesPerChannel?: number
}

export interface CardsResult {
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}

/** План прогона — в sync_state: `cards plan` и блок «🗂 Карточки» сводки. */
export interface CardsPlanSummary {
  at: string
  runId: string
  creates: Array<{ channel: CardChannel; nmId: number; barcode: string; offerId: string }>
  skips: CardSkip[]
  edits: Array<{ channel: CardChannel; nmId: number }>
  splits: Array<{ channel: "ozon" | "ym"; nmId: number }>
  massStopped: number | null
}

/** Режимы записи карточек всех площадок — для executeWrites (WB и сайт — off всегда: у них card_write_mode off). */
export function cardModesOf(chs: ReadonlyMap<Channel, ChannelRow>): Record<Channel, WriteMode> {
  return Object.fromEntries([...chs].map(([c, r]) => [c, r.cardWriteMode])) as Record<Channel, WriteMode>
}

const countryOf = (c: WbCardContent) => c.characteristics.find((x) => x.name === "Страна производства")?.values[0] ?? "Россия"

/** Подпись размера штрихкода в карточке WB. */
export function sizeOfBarcode(c: WbCardContent, barcode: string): string | null {
  const s = c.sizes.find((x) => x.barcodes.includes(barcode))
  return s ? sizeLabel(s) : null
}

export async function runCards(deps: CardsDeps): Promise<CardsResult> {
  const { db } = deps
  const now = deps.now()
  const nowIso = now.toISOString()
  const counters: Record<string, number> = {}
  const problems: string[] = []
  const add = (k: string, n = 1) => {
    counters[k] = (counters[k] ?? 0) + n
  }

  const channels = await loadChannels(db)
  const modes = cardModesOf(channels)

  // 1. Контент WB: версии и текущий хеш. Пропавшая из чтения карточка не удаляется и не правится (сбой 29.09 13:51).
  const read = await deps.sources.wbCards()
  if (read.cards.length === 0) throw new Error("каталог WB пуст — карточки в этом прогоне не обрабатываются")
  counters.wbCards = read.cards.length
  if (read.rejected > 0) counters.wbCardsRejected = read.rejected
  const hashes = new Map(read.cards.map((c) => [c.nmId, cardContentHash(c)]))
  const saved = await saveWbCardRead(db, deps.runId, read.cards.map((c) => ({ content: c, hash: hashes.get(c.nmId)! })), nowIso)
  if (saved.changed.length > 0) counters.wbCardsChanged = saved.changed.length
  if (saved.added.length > 0) counters.wbCardsAdded = saved.added.length
  if (saved.notSeen > 0) counters.wbCardsNotSeen = saved.notSeen

  // 2. Листинги — из последних снимков остатков (ingest).
  const nmIdOf = new Map((await loadProducts(db)).flatMap((p) => (p.nmId === null ? [] : [[p.barcode, p.nmId] as const])))
  counters.listingsSeen = await syncListingsFromSnapshots(db, channels, nmIdOf)
  const inStock = await inStockBarcodes(db)

  // 3. Ключи площадок с архивом: площадка, которая не прочиталась, в этом прогоне пропускается целиком.
  const want = new Set<CardChannel>(deps.channelsOnly ?? CARD_CHANNELS)
  const keys: Partial<Record<CardChannel, MirrorKeys>> = {}
  let ozonKeys: OzonCardKeys | null = null
  let ymKeys: YmCardKeys | null = null
  let kitKeys: KitCardKeys | null = null
  for (const c of CARD_CHANNELS) {
    if (!want.has(c)) continue
    try {
      const k = c === "ozon" ? (ozonKeys = await deps.sources.ozonKeys()) : c === "ym" ? (ymKeys = await deps.sources.ymKeys()) : (kitKeys = await deps.sources.kitKeys())
      keys[c] = k
      counters[`${c}CardKeys`] = k.offerIds.size
    } catch (e: unknown) {
      counters[`${c}CardKeysFailed`] = 1
      problems.push(`${CHANNEL_LABELS[c]}: ключи карточек не прочитаны — ${errorText(e)}; по площадке этот прогон ничего не делает`)
    }
  }

  // 4. Маршруты и план.
  const only = deps.only ? new Set(deps.only) : null
  const cards = only ? read.cards.filter((c) => only.has(c.vendorCode) || c.sizes.some((s) => s.barcodes.some((b) => only.has(b)))) : read.cards
  if (only) counters.cardsOnly = cards.length
  const routes = new Map(cards.map((c) => [c.nmId, routeCard(deps.categories, c)]))
  const plan: CardPlan = planCards({
    cards,
    hashes,
    inStock,
    listings: await loadCardListings(db, channels),
    keys,
    routes,
    declinedSplits: new Set(),
  })
  const skips: CardSkip[] = [...plan.skips]
  const contentOf = new Map(cards.map((c) => [c.nmId, c]))
  /** Весь прочитанный каталог — ответы на вопросы исполняются и вне выборки --only. */
  const allContent = new Map(read.cards.map((c) => [c.nmId, c]))

  // 5. Базовая линия — без сети, в любом режиме: что на зеркале сейчас, принимается как есть.
  const baseGroups = new Map<string, { channelId: number; hash: string; barcodes: string[] }>()
  for (const b of plan.baselines) {
    const k = `${b.channel}\u0000${b.hash}`
    const g = baseGroups.get(k) ?? { channelId: channels.get(b.channel)!.id, hash: b.hash, barcodes: [] }
    g.barcodes.push(b.barcode)
    baseGroups.set(k, g)
  }
  for (const g of baseGroups.values()) await setListingHashes(db, g.channelId, g.barcodes, g.hash)
  if (plan.baselines.length > 0) counters.cardBaselines = plan.baselines.length

  // 6. Массовая правка WB — зеркала не трогаем.
  const editCards = new Set(plan.edits.map((e) => e.nmId))
  const massStopped = editCards.size > MASS_CHANGE_CARDS && !deps.allowMass
  if (massStopped) {
    counters.cardsMassStopped = editCards.size
    problems.push(
      `массовая правка WB: контент изменился у ${editCards.size} карточек (предел ${MASS_CHANGE_CARDS}) — правки зеркал не отправлены и вопросы не заданы; принять как есть: cards baseline --confirm; отправить: cards run --allow-mass --confirm`,
    )
  }

  // 7. Создания: цена из прайса (этап 2), тело площадки, пределы.
  const agreed = await loadAgreedPrices(db)
  const sppBp = await activeSpp(db)
  const wbSnap = await latestWbPriceSnapshot(db, channels.get("wb")!.id)
  const wbBaseOf = new Map((wbSnap?.prices ?? []).filter((r) => !r.sizesDiffer && r.priceRub > 0).map((r) => [r.nmId, r.priceRub * 100]))
  const skip = (cr: Pick<CardCreate, "channel" | "nmId" | "barcode">, reason: string) => skips.push({ channel: cr.channel, nmId: cr.nmId, barcode: cr.barcode, reason })

  let ozonQuota: number | null = null
  if (plan.creates.some((c) => c.channel === "ozon")) {
    try {
      ozonQuota = await deps.sources.ozonCreateQuota()
      if (ozonQuota !== null) counters.ozonCreateQuota = ozonQuota
    } catch (e: unknown) {
      problems.push(`Ozon: лимит создания не прочитан — ${errorText(e)}; создание Ozon в этом прогоне пропущено`)
      ozonQuota = 0
    }
  }
  /**
   * Ставки предмета для цены создания. Предмет без ставки в config/pricing.json (часы) — Task 15 подставляет живую
   * ставку ЯМ из тарифов и наибольшую ставку Ozon из конфига; до Task 15 — как в конфиге.
   */
  const ratesFor = async (c: WbCardContent, _route: CardRoute, _priceMinor: number): Promise<SubjectRates | null> => deps.pricing.rates.get(c.subject) ?? null

  /** Тело создания для площадки (и для разведения размеров — Task 14); null — пропуск с причиной уже записан. */
  const buildCreateOp = async (cr: CardCreate, decisionId: number | null): Promise<WriteOp | null> => {
    const c = allContent.get(cr.nmId)!
    const route = routes.get(cr.nmId) ?? routeCard(deps.categories, c)
    const hash = hashes.get(cr.nmId)!
    const a = agreed.get(cr.nmId)
    if (!a) {
      skip(cr, "нет прайса — ответьте на вопрос «товар без прайса» (этап 2); карточка создастся следующим прогоном")
      return null
    }
    const m = mirrorPrices(
      { agreedMinor: a.priceMinor, rates: await ratesFor(c, route, a.priceMinor), ozonTakeBp: null, hasOzon: cr.channel === "ozon", hasYm: cr.channel === "ym", sppBp, deliveryMinor: deps.pricing.deliveryMinor, wbBaseMinor: wbBaseOf.get(cr.nmId) ?? null },
      deps.pricing.policy,
    )
    const mirror = sanitizeCardForMirror(c)
    let payload: unknown
    let productRef: string | null = null
    if (cr.channel === "ozon") {
      const r = route.ozon
      if (!r.ok || !m.ozon) {
        skip(cr, r.ok ? `цена Ozon не посчитана (${m.skips.join(", ")})` : r.reason)
        return null
      }
      let size: { dictId: number } | null = null
      if (cr.multiSize && cr.size) {
        const id = await deps.sources.ozonDict({ categoryId: r.route.categoryId, typeId: r.route.typeId, attributeId: 5326, value: cr.size })
        if (id === null) {
          skip(cr, `размер «${cr.size}» не найден в словаре Ozon (атрибут 5326 «Размер изделия») — карточка размера не создана`)
          return null
        }
        size = { dictId: id }
      }
      const country = countryOf(c)
      const countryDictId = country === "Россия" ? OZON_DICT.countryRu : await deps.sources.ozonDict({ categoryId: r.route.categoryId, typeId: r.route.typeId, attributeId: 4389, value: country })
      let tnvedDictId: number | null = null
      if (r.route.tnvedFromWb) {
        // Часы: ТН ВЭД — из карточки WB (9102110000) через словарь Ozon 22232.
        const code = c.characteristics.find((x) => x.id === 15004139 || x.id === 15000001)?.values[0] ?? null
        tnvedDictId = code ? await deps.sources.ozonDict({ categoryId: r.route.categoryId, typeId: r.route.typeId, attributeId: 22232, value: code }) : null
        if (tnvedDictId === null) {
          skip(cr, `ТН ВЭД «${code ?? "нет в карточке WB"}» не найден в словаре Ozon (22232)`)
          return null
        }
      }
      payload = { item: ozonImportItem({ content: mirror, slug: route.slug!, route: r.route, offerId: cr.offerId, barcode: cr.barcode, size, countryDictId, tnvedDictId, price: { priceMinor: m.ozon.priceMinor, oldMinor: m.ozon.oldMinor } }) }
    } else if (cr.channel === "ym") {
      const r = route.ym
      if (!r.ok || !m.ym) {
        skip(cr, r.ok ? `цена ЯМ не посчитана (${m.skips.join(", ")})` : r.reason)
        return null
      }
      payload = ymCreateMapping({ content: mirror, route: r.route, offerId: cr.offerId, barcode: cr.barcode, size: cr.size, multiSize: cr.multiSize, price: { priceMinor: m.ym.priceMinor, baseMinor: m.ym.baseMinor } })
    } else {
      const r = route.kit
      if (!r.ok || !m.kit) {
        skip(cr, r.ok ? `цена KIT не посчитана (${m.skips.join(", ")})` : r.reason)
        return null
      }
      // KIT — свой магазин: контент WB как есть (без санитайзера зеркал).
      payload = kitVariantDraft(c, { barcode: cr.barcode, size: cr.multiSize ? cr.size : null, categoryId: r.route.categoryId, price: { priceMinor: m.kit.priceMinor, baseMinor: m.kit.baseMinor } })
      for (const s of c.sizes) for (const b of s.barcodes) productRef ??= kitKeys?.productOfBarcode.get(b) ?? null
    }
    return {
      channel: cr.channel,
      barcode: cr.barcode,
      field: "card_create",
      before: null,
      after: hashToNumber(hash),
      externalSku: cr.channel === "kit" ? null : cr.offerId,
      card: {
        kind: "create",
        nmId: cr.nmId,
        vendorCode: c.vendorCode,
        offerId: cr.offerId,
        fields: [...CARD_FIELDS],
        payload,
        productRef,
        decisionId,
        ...(cr.channel === "ym" ? { initialStock: cr.stock } : {}),
      },
    }
  }

  const maxPerChannel = deps.maxCreatesPerChannel ?? MAX_CARD_CREATES_PER_CHANNEL
  const ops: WriteOp[] = []
  const taken: Record<CardChannel, number> = { ozon: 0, ym: 0, kit: 0 }
  for (const cr of plan.creates) {
    if (taken[cr.channel] >= maxPerChannel || (cr.channel === "ozon" && ozonQuota !== null && taken.ozon >= ozonQuota)) {
      add(cr.channel === "ozon" && ozonQuota !== null && taken.ozon >= ozonQuota ? "ozonCreateQuotaDeferred" : "cardCreatesDeferred")
      continue
    }
    const op = await buildCreateOp(cr, null)
    if (!op) continue
    taken[cr.channel]++
    add(`${cr.channel}CardPlanned`)
    ops.push(op)
  }

  // 8. Правки KIT — сразу (решение п. 17); Ozon/ЯМ — вопросом (Task 11).
  const kitRoute = (nmId: number) => routes.get(nmId)?.kit
  if (!massStopped) {
    let taken = 0
    for (const e of plan.edits.filter((x) => x.channel === "kit")) {
      if (taken >= MAX_KIT_EDITS_PER_RUN) {
        add("kitEditsDeferred")
        continue
      }
      const c = contentOf.get(e.nmId)!
      const from = await loadWbCardVersion(db, e.nmId, e.fromHash)
      const fields = from ? [...new Set(diffCardContent(from, c).map((x) => x.field))] : [...CARD_FIELDS]
      if (fields.length === 0) {
        // Изменилось то, что KIT не касается (например, ТН ВЭД): синхронизировано без записи.
        await setListingHashes(db, channels.get("kit")!.id, e.listings.map((l) => l.barcode), e.toHash)
        continue
      }
      const r = kitRoute(e.nmId)
      for (const l of e.listings) {
        ops.push({
          channel: "kit",
          barcode: l.barcode,
          field: "card_content",
          before: hashToNumber(e.fromHash),
          after: hashToNumber(e.toHash),
          externalSku: l.externalId,
          card: {
            kind: "content",
            nmId: e.nmId,
            vendorCode: c.vendorCode,
            offerId: c.vendorCode,
            fields,
            payload: kitVariantDraft(c, { barcode: l.barcode, size: c.sizes.length > 1 ? sizeOfBarcode(c, l.barcode) : null, categoryId: r?.ok ? r.route.categoryId : "", price: null }),
            productRef: null,
            decisionId: null,
          },
        })
      }
      taken++
      add("kitEditPlanned")
    }
  }

  // 9. Запись и итоги по листингам.
  let outs: WriteOutcome[] = []
  if (ops.length > 0) {
    try {
      outs = await executeWrites(ops, { globalMode: deps.globalMode, channelModes: modes, send: deps.send, record: drizzleWriteStore(db, deps.runId, channels, nowIso) })
    } catch (e: unknown) {
      if (!(e instanceof WriteJournalError)) throw e
      counters.journalErrors = 1
      problems.push(`журнал карточек не сохранён: ${errorText(e.cause)}`)
      outs = e.outcomes
    }
  }
  const failedCreates: string[] = []
  for (const o of outs) {
    if (o.mode !== "apply" || !o.card) continue
    const channelId = channels.get(o.channel)!.id
    const hash = hashes.get(o.card.nmId)!
    if (o.field === "card_create") {
      const resp = (o.response ?? null) as { variantId?: string; stockError?: string } | null
      if (o.applied || o.uncertain) {
        const kitActive = o.channel === "kit" && o.applied && typeof resp?.variantId === "string"
        await markListingCreated(db, { channelId, barcode: o.barcode, externalId: kitActive ? resp!.variantId! : o.card.offerId, nmId: o.card.nmId, hash, runId: deps.runId, status: kitActive ? "active" : "pending" })
        add(o.applied ? `${o.channel}CardCreated` : `${o.channel}CardUncertain`)
        if (o.applied && resp?.stockError) problems.push(`ЯМ: ${o.card.offerId} создан, первый остаток не записан (${resp.stockError}) — в магазин попадёт после записи остатка`)
      } else {
        await markListingFailed(db, { channelId, barcode: o.barcode, externalId: o.card.offerId, nmId: o.card.nmId, hash, error: o.error ?? "отказ без текста" })
        add(`${o.channel}CardFailed`)
        failedCreates.push(`${CHANNEL_LABELS[o.channel]} ${o.card.offerId}: ${o.error ?? "отказ"}`)
      }
    } else if (o.field === "card_content" && o.card.decisionId === null) {
      if (o.applied) {
        await setListingHashes(db, channelId, [o.barcode], hash)
        add(`${o.channel}CardEdited`)
      } else {
        add(`${o.channel}CardEditFailed`)
        problems.push(`${CHANNEL_LABELS[o.channel]}: правка ${o.card.offerId} не применена — ${o.error ?? "итог неизвестен"}; повтор — следующим прогоном`)
      }
    }
  }
  if (failedCreates.length > 0) problems.push(`создание отклонено: ${shown(failedCreates)}`)

  // 10. Пропуски и ожидающие дольше суток.
  if (skips.length > 0) {
    counters.cardSkips = skips.length
    const reasons = [...new Set(skips.map((s) => s.reason))]
    problems.push(`карточки не выложены (${skips.length}): ${shown(reasons)} — список: cards plan`)
  }
  const stale = await stalePendingListings(db, channels, new Date(now.getTime() - PENDING_ALERT_MS).toISOString())
  if (stale.length > 0) {
    counters.cardsPendingStale = stale.length
    problems.push(`созданы синком и не появились на площадке за 24 ч: ${shown(stale.map((s) => `${CHANNEL_LABELS[s.channel]} ${s.externalId}`))} — проверить в ЛК`)
  }

  const summary: CardsPlanSummary = {
    at: nowIso,
    runId: deps.runId,
    creates: ops.filter((o) => o.field === "card_create").map((o) => ({ channel: o.channel as CardChannel, nmId: o.card!.nmId, barcode: o.barcode, offerId: o.card!.offerId })),
    skips,
    edits: plan.edits.map((e) => ({ channel: e.channel, nmId: e.nmId })),
    splits: plan.splits.map((s) => ({ channel: s.channel, nmId: s.nmId })),
    massStopped: massStopped ? editCards.size : null,
  }
  await setState(db, CARDS_PLAN_KEY, summary)
  return problems.length > 0 ? { status: "partial", counters, error: problems.join("; ") } : { status: "ok", counters }
}
```
Ожидания теста «режимы off»: базовая линия — 3 листинга существующего артикула (снимки Ozon/ЯМ/KIT); создания — 3 строки журнала `card_create` с `mode: "off"` (действует меньший из `SYNC_WRITE_MODE=apply` и `card_write_mode=off`); Ozon-категория браслета из «Оберегов» — 17027899/87458883 (маршрут по названию «Браслет из …»). В тесте «нет прайса» `maxCreatesPerChannel: 1` при единственной карточке — отложенных нет: пропуск по прайсу предел не расходует.

- [ ] **Step 4: Проверка и коммит.**
```bash
npx vitest run apps/worker/src/card-senders.test.ts && npm run test:db -- apps/worker/src/jobs/cards.db.test.ts && npm run typecheck && npm test && npm run test:db
git add apps/worker/src/card-senders.ts apps/worker/src/card-senders.test.ts apps/worker/src/jobs/cards.ts apps/worker/src/jobs/cards.db.test.ts
git commit -m "sync2: джоба cards — версии WB, листинги из снимков, базовая линия, создания с ценой из прайса (все недостающие, потолок 40 на площадку, лимит Ozon), правки KIT сразу, массовая правка"
```

---
### Task 11: Вопросы `card_edit` и `card_rejected` (миграция 0009): «было → станет», отказ модерации, кнопки, исполнение ответа, габариты Ozon

**Files:**
- Create: `packages/db/migrations/0009_card_decisions.sql` (+ meta — генерирует drizzle-kit)
- Modify: `packages/shared/src/decisions.ts`, `packages/db/src/decisions.ts`, `apps/worker/src/decision-text.ts`, `apps/worker/src/decision-text.test.ts`, `apps/worker/src/jobs/bot.ts`, `apps/worker/src/cli-prices.ts`, `apps/worker/src/jobs/cards.ts`, `apps/worker/src/jobs/cards.db.test.ts`

- [ ] **Step 1: Падающие тесты.** В `apps/worker/src/decision-text.test.ts` дописать:
```ts
import type { CardEditDecisionRow, CardRejectedDecisionRow } from "@sync2/db"

const cardEdit = (over: Partial<CardEditDecisionRow["payload"]> = {}): CardEditDecisionRow => ({
  id: 41,
  kind: "card_edit",
  subject: "edit:1631024060",
  status: "open",
  answer: null,
  answeredById: null,
  answeredByName: null,
  answeredAt: null,
  result: null,
  tgMessageId: null,
  sentAt: null,
  remindedAt: null,
  deadlineRemindedAt: null,
  tgClosedAt: null,
  createdAt: "2026-10-12T16:19:00.000Z",
  payload: {
    nmId: 1631024060,
    vendorCode: "888645543123",
    title: "Браслет из Ливийского стекла",
    toHash: "h2",
    channels: [
      {
        channel: "ozon",
        barcodes: ["2057086856166"],
        fromHash: "h1",
        changes: [
          { field: "title", before: "Браслет из Ливийского стекла", after: "Браслет из ливийского стекла, бусины 7,3 мм" },
          { field: "dimensions", before: "25×15×6 см, 0,1 кг", after: "25×15×6 см, 0,12 кг" },
        ],
      },
      { channel: "ym", barcodes: ["2057086856166"], fromHash: "h1", changes: [{ field: "title", before: "Браслет из Ливийского стекла", after: "Браслет из ливийского стекла, бусины 7,3 мм" }] },
    ],
    sizeSplit: null,
    ...over,
  },
})

describe("вопрос card_edit", () => {
  it("кнопки — только при apply карточек Ozon/ЯМ; коды e/s разбираются", () => {
    expect(allowedAnswers("card_edit", false, false, true)).toEqual(["apply_edit", "skip_edit"])
    expect(allowedAnswers("card_edit", true, true, false)).toEqual([])
    expect(parseCallbackData("d:41:e")).toEqual({ id: 41, answer: "apply_edit" })
    expect(parseCallbackData("d:41:s")).toEqual({ id: 41, answer: "skip_edit" })
    expect(decisionKeyboard(cardEdit(), false, false, true).map((r) => r[0]!.text)).toEqual(["✅ Применить на Ozon и ЯМ", "⏭ Не применять"])
  })

  it("текст: было → станет по площадкам, габариты Ozon — тоже вопросом (решение 29.09 п. 3), KIT и сайт сами", () => {
    const t = decisionText(cardEdit())
    expect(t).toContain("✏️ WB: правка карточки → Ozon и ЯМ")
    expect(t).toContain("Арт. 888645543123 · nm 1631024060")
    expect(t).toContain("Ozon\n• Название: «Браслет из Ливийского стекла» → «Браслет из ливийского стекла, бусины 7,3 мм»")
    expect(t).toContain("• Габариты и вес: 25×15×6 см, 0,1 кг → 25×15×6 см, 0,12 кг")
    expect(t).not.toContain("вручную")
    expect(t).toContain("KIT и сайт обновляются без вопроса")
    expect(t.length).toBeLessThanOrEqual(3500)
    expect(reminderText(cardEdit())).toContain("nm 1631024060")
    expect(decisionListLine(cardEdit())).toContain("правка: Название, Габариты и вес")
  })

  it("отказ модерации: текст площадки, пометка про УИН ГИИС ДМДК, кнопка «Принято» всегда", () => {
    const d: CardRejectedDecisionRow = {
      ...cardEdit(),
      id: 42,
      kind: "card_rejected",
      subject: "rejected:ozon:2041942767208",
      payload: { nmId: 288116175, vendorCode: "JW-NB-AGT-M-0029", title: "Подвеска «Космическое сердце»", channel: "ozon", offerId: "JW-NB-AGT-M-0029", barcode: "2041942767208", text: "FB_JEWELRY: Для ювелирных изделий укажите УИН ГИИС ДМДК", needsDmdk: true },
    }
    expect(allowedAnswers("card_rejected", false, false, false)).toEqual(["ack"])
    expect(parseCallbackData("d:42:k")).toEqual({ id: 42, answer: "ack" })
    const t = decisionText(d)
    expect(t).toContain("⛔ Ozon отклонил карточку")
    expect(t).toContain("FB_JEWELRY: Для ювелирных изделий укажите УИН ГИИС ДМДК")
    expect(t).toContain("Площадка просит УИН ГИИС ДМДК")
    expect(t).toContain("карточку не пересоздаю")
  })

  it("разведение размеров: свои кнопки и текст", () => {
    const d = cardEdit({
      channels: [],
      sizeSplit: {
        keep: [{ channel: "ozon", offerId: "JW-NB-AGT-M-0073", barcode: "2042770600705", size: "19" }],
        create: [{ channel: "ozon", offerId: "JW-NB-AGT-M-0073-20", barcode: "2042770600712", size: "20", stock: 2 }],
      },
    })
    expect(decisionKeyboard(d, false, false, true).map((r) => r[0]!.text)).toEqual(["✅ Развести размеры", "⏭ Оставить один оффер"])
    const t = decisionText(d)
    expect(t).toContain("📏 WB: размеры карточки → варианты Ozon/ЯМ (решение п. 18)")
    expect(t).toContain("Ozon: остаётся JW-NB-AGT-M-0073 (размер 19 — продажи и отзывы при нём); создаётся: JW-NB-AGT-M-0073-20 (размер 20, 2 шт.)")
  })
})
```
(в импорт теста из `./decision-text` добавить `decisionListLine`, если его там нет).

В `apps/worker/src/jobs/cards.db.test.ts` дописать (перед закрывающей скобкой `describe`):
```ts
  it("правка Ozon/ЯМ при apply карточек: вопрос с «было → станет»; ответ «применить» исполняется, хеш листинга — новый", async () => {
    await mode("ozon", "apply")
    await mode("ym", "apply")
    const v1 = card({ nmId: 327127352, vendorCode: "JW-NB-AGT-M-0073", subject: "Браслеты", title: "Браслет Синергия", sizes: [{ chrtId: 1, techSize: "0", wbSize: "", barcodes: ["2042770600705"] }] })
    await job([v1]) // базовая линия уже стоит; этим прогоном ничего не меняется
    const v2 = { ...v1, title: "Браслет Синергия с метеоритом Алетай" }
    const first = await job([v2])
    expect(first.r.counters.cardEditQuestions).toBe(1)
    const [q] = (await activeDecisionsOfKind(h.db, "card_edit")).filter(isCardEditDecision)
    expect(q!.payload.channels.map((c) => [c.channel, c.changes[0]!.field])).toEqual([["ozon", "title"], ["ym", "title"]])
    await answerDecision(h.db, q!.id, "apply_edit", { id: 1, name: "Минас" }, NOW.toISOString())
    const second = await job([v2])
    const edits = second.rows.filter((w) => w.field === "card_content" && (w.detail as { decisionId: number | null }).decisionId === q!.id)
    expect(edits.map((w) => [w.mode, w.applied])).toEqual([["apply", true], ["apply", true]])
    expect((await decisionById(h.db, q!.id))!).toMatchObject({ status: "done", result: "применено: Ozon 1, ЯМ 1" })
    const chs = await loadChannels(h.db)
    const ls = await h.db.select().from(listings).where(eq(listings.barcode, "2042770600705"))
    for (const c of ["ozon", "ym"] as const) expect(ls.find((l) => l.channelId === chs.get(c)!.id)!.contentHash).toBe(q!.payload.toHash)
  })

  it("на WB новая правка до ответа — открытый вопрос закрывается и задаётся заново", async () => {
    await mode("ozon", "apply")
    const v3 = card({ nmId: 327127352, vendorCode: "JW-NB-AGT-M-0073", subject: "Браслеты", title: "Браслет Синергия v3", sizes: [{ chrtId: 1, techSize: "0", wbSize: "", barcodes: ["2042770600705"] }] })
    await job([v3])
    const v4 = { ...v3, title: "Браслет Синергия v4" }
    const r = await job([v4])
    expect(r.r.counters.cardEditsSuperseded).toBe(1)
    const open = (await activeDecisionsOfKind(h.db, "card_edit")).filter(isCardEditDecision)
    expect(open).toHaveLength(1)
    expect(open[0]!.payload.channels[0]!.changes[0]!.after).toBe("Браслет Синергия v4")
  })

  it("модерация Ozon отклонила созданную синком карточку (УИН ГИИС ДМДК): листинг failed, вопрос card_rejected, повторно не создаётся", async () => {
    const chs = await loadChannels(h.db)
    await markListingCreated(h.db, { channelId: chs.get("ozon")!.id, barcode: "2057086856166", externalId: "888645543123", nmId: 1631024060, hash: "hX", runId: await nextRun(), status: "pending" })
    const runId = await nextRun()
    const src: CardSources = {
      ...sources([card()]),
      ozonModeration: async () => new Map([["888645543123", { state: "rejected" as const, text: "FB_JEWELRY: укажите УИН ГИИС ДМДК", needsDmdk: true }]]),
    }
    const r = await runCards({ db: h.db, now: () => NOW, runId, globalMode: "apply", categories: loadCardCategories(), pricing: loadPricingConfig(), sources: src, send: okSend() })
    expect(r.counters.ozonCardModerationRejected).toBe(1)
    const [l] = await h.db.select().from(listings).where(eq(listings.externalId, "888645543123"))
    expect(l).toMatchObject({ status: "failed", lastError: "FB_JEWELRY: укажите УИН ГИИС ДМДК" })
    const q = (await activeDecisionsOfKind(h.db, "card_rejected")).filter(isCardRejectedDecision)
    expect(q.map((d) => [d.subject, d.payload.needsDmdk])).toEqual([["rejected:ozon:2057086856166", true]])
  })
```
(в импорт теста из `@sync2/db` добавить `activeDecisionsOfKind`, `answerDecision`, `decisionById`, `isCardEditDecision`, `isCardRejectedDecision`, `markListingCreated`).
Run: `npx vitest run apps/worker/src/decision-text.test.ts` → FAIL; `npm run test:db -- apps/worker/src/jobs/cards.db.test.ts` → FAIL.

- [ ] **Step 2: Вид вопроса и миграция.** `packages/shared/src/decisions.ts`:
- в начало: `import type { CardFieldChange, CardSizeOffer } from "./cards"`;
- `DECISION_KINDS`:
```ts
/**
 * ozon_discount_task — «Хочу скидку»; wb_min_template — шаблон мин. цен WB; card_edit — правка карточки или размеры
 * Ozon/ЯМ; card_rejected — площадка отклонила созданную карточку (этап 4).
 */
export const DECISION_KINDS = [...WB_PRICE_DECISION_KINDS, "ozon_discount_task", "wb_min_template", "card_edit", "card_rejected"] as const
```
- `DECISION_ANSWERS`:
```ts
/** … apply_edit/skip_edit — правка карточки Ozon/ЯМ: применить или оставить как есть; ack — отказ модерации принят к сведению (этап 4). */
export const DECISION_ANSWERS = ["accept", "autoaction", "return", "approve", "decline", "uploaded", "apply_edit", "skip_edit", "ack"] as const
```
- после `WbMinTemplatePayload`:
```ts
/** Правка карточки WB → Ozon/ЯМ или разведение размеров (этап 4, решение п. 17–18). Ответ исполняет джоба cards. */
export interface CardEditPayload {
  nmId: number
  vendorCode: string
  title: string
  /** Хеш контента WB, к которому приводятся зеркала; на WB новая правка до исполнения — вопрос закрывается. */
  toHash: string
  /** Правка контента по площадкам; у разведения размеров — пусто. */
  channels: Array<{ channel: "ozon" | "ym"; barcodes: string[]; fromHash: string; changes: CardFieldChange[] }>
  /** Разведение размеров (п. 18); null — правка контента. */
  sizeSplit: { keep: CardSizeOffer[]; create: Array<CardSizeOffer & { stock: number }> } | null
}
```
- после `CardEditPayload`:
```ts
/** Площадка отклонила созданную синком карточку (решение 29.09 п. 1): текст отказа; карточка не пересоздаётся. */
export interface CardRejectedPayload {
  nmId: number
  vendorCode: string
  title: string
  channel: "ozon" | "ym" | "kit"
  offerId: string
  barcode: string
  /** Текст отказа площадки (ошибки импорта или модерации). */
  text: string
  /** Площадка просит УИН ГИИС ДМДК (ювелирная маркировка). */
  needsDmdk: boolean
}
```
- `PayloadOf`:
```ts
export type PayloadOf<K extends DecisionKind> = K extends WbPriceDecisionKind
  ? DecisionPayload
  : K extends "ozon_discount_task"
    ? OzonDiscountPayload
    : K extends "wb_min_template"
      ? WbMinTemplatePayload
      : K extends "card_edit"
        ? CardEditPayload
        : CardRejectedPayload
```
`packages/db/src/decisions.ts` — после `isOzonTaskDecision`:
```ts
export type CardEditDecisionRow = DecisionRowOf<"card_edit">
export type CardRejectedDecisionRow = DecisionRowOf<"card_rejected">

export function isCardEditDecision(d: DecisionRow): d is CardEditDecisionRow {
  return d.kind === "card_edit"
}

export function isCardRejectedDecision(d: DecisionRow): d is CardRejectedDecisionRow {
  return d.kind === "card_rejected"
}
```
Миграция:
```bash
npm run db:generate -- --name card_decisions
```
Expected: `0009_card_decisions.sql` — ровно `DROP CONSTRAINT "decisions_kind_check"`, `DROP CONSTRAINT "decisions_answer_check"` и оба `ADD CONSTRAINT` с новыми списками (`'card_edit', 'card_rejected'`; `'apply_edit', 'skip_edit', 'ack'`), как 0006.

- [ ] **Step 3: Тексты и кнопки.** `apps/worker/src/decision-text.ts`:
- импорт из `@sync2/db` дополнить `type CardEditDecisionRow`; из `@sync2/shared` — `CARD_FIELD_LABELS`, `type CardEditPayload`;
- `ANSWER_LABELS` дополнить: `apply_edit: "✅ Применить на Ozon и ЯМ", skip_edit: "⏭ Не применять", ack: "✅ Принято",`; `CODE` — `apply_edit: "e", skip_edit: "s", ack: "k"`;
- в `parseCallbackData` регулярное выражение — `/^d:(\d+):([axronuesk])$/`;
- `allowedAnswers` — четвёртый параметр и ветка:
```ts
export function allowedAnswers(kind: DecisionKind, wbReturnEnabled: boolean, ozonTasksEnabled = false, cardEditsEnabled = false): DecisionAnswer[] {
  switch (kind) {
    case "wb_price_new":
      return ["accept"]
    case "wb_price_drift":
      return wbReturnEnabled ? ["accept", "autoaction", "return"] : ["accept", "autoaction"]
    case "ozon_discount_task":
      return ozonTasksEnabled ? ["approve", "decline"] : []
    case "wb_min_template":
      return ["uploaded"]
    case "card_edit":
      return cardEditsEnabled ? ["apply_edit", "skip_edit"] : []
    case "card_rejected":
      return ["ack"]
  }
}
```
- `buttonText` — перед `return ANSWER_LABELS[a]`:
```ts
  if (d.kind === "card_edit" && d.payload.sizeSplit) return a === "apply_edit" ? "✅ Развести размеры" : "⏭ Оставить один оффер"
```
- `decisionKeyboard(d, wbReturnEnabled, ozonTasksEnabled = false, cardEditsEnabled = false)` — передаёт четвёртый параметр в `allowedAnswers`;
- тексты:
```ts
const CARD_TEXT_MAX = 3500
const CH_LABEL = { ozon: "Ozon", ym: "ЯМ" } as const

function cardEditText(p: CardEditPayload): string {
  const head = [p.title, `Арт. ${p.vendorCode} · nm ${p.nmId}`]
  if (p.sizeSplit) {
    const s = p.sizeSplit
    const lines = (["ozon", "ym"] as const).flatMap((ch) => {
      const keep = s.keep.filter((k) => k.channel === ch)
      const create = s.create.filter((k) => k.channel === ch)
      if (create.length === 0) return []
      const k = keep.map((x) => `${x.offerId} (размер ${x.size ?? "—"} — продажи и отзывы при нём)`).join(", ")
      const c = create.map((x) => `${x.offerId} (размер ${x.size ?? "—"}, ${x.stock} шт.)`).join(", ")
      return [`${CH_LABEL[ch]}: остаётся ${k || "—"}; создаётся: ${c}`]
    })
    return [
      "📏 WB: размеры карточки → варианты Ozon/ЯМ (решение п. 18)",
      ...head,
      ...lines,
      "«Оставить один оффер» — по этой карточке больше не спрошу; если размер неважен (браслет на резинке) — остаток перейдёт на сумму отдельным решением.",
    ].join("\n")
  }
  const blocks = p.channels.map((c) => {
    const lines = c.changes.map((x) => {
      const onlyColor = c.channel === "ozon" && x.field === "characteristics" ? " (на Ozon переносится только цвет)" : ""
      return x.field === "title" ? `• ${CARD_FIELD_LABELS[x.field]}: «${x.before}» → «${x.after}»` : `• ${CARD_FIELD_LABELS[x.field]}: ${x.before} → ${x.after}${onlyColor}`
    })
    return [CH_LABEL[c.channel], ...lines].join("\n")
  })
  const text = ["✏️ WB: правка карточки → Ozon и ЯМ", ...head, ...blocks, "KIT и сайт обновляются без вопроса. Без ответа зеркала остаются как есть."].join("\n")
  return text.length > CARD_TEXT_MAX ? `${text.slice(0, CARD_TEXT_MAX - 40)}…\nполностью: cards diff <номер вопроса>` : text
}
```
- текст отказа модерации:
```ts
const REJ_LABEL = { ozon: "Ozon", ym: "ЯМ", kit: "KIT" } as const

function cardRejectedText(p: CardRejectedPayload): string {
  return [
    `⛔ ${REJ_LABEL[p.channel]} отклонил карточку`,
    p.title,
    `Арт. ${p.vendorCode} · nm ${p.nmId} · оффер ${p.offerId}`,
    `Ответ площадки: ${p.text.slice(0, 1500)}`,
    ...(p.needsDmdk ? ["Площадка просит УИН ГИИС ДМДК (ювелирная маркировка) — нужен ответ владельца: получить УИН или изменить карточку WB."] : []),
    "Синк карточку не пересоздаю; после правки карточки WB — попробую снова, или вручную: cards retry <штрихкод> <площадка> --confirm.",
  ].join("\n")
}
```
- в `decisionText` — `case "card_edit": return cardEditText(d.payload)` и `case "card_rejected": return cardRejectedText(d.payload)`; в импорт из `@sync2/shared` — `type CardRejectedPayload`;
- в `reminderText` — перед `default`:
```ts
    case "card_edit":
      return `⏰ Правка карточки nm ${d.payload.nmId} без ответа больше суток — без ответа зеркала Ozon/ЯМ остаются как есть`
    case "card_rejected":
      return `⏰ Отказ ${d.payload.channel} по ${d.payload.offerId} без отметки «Принято» больше суток`
```
- в `decisionListLine` — перед `default`:
```ts
    case "card_edit":
      return [...state, `nm ${d.payload.nmId}`, d.payload.sizeSplit ? "размеры" : `правка: ${[...new Set(d.payload.channels.flatMap((c) => c.changes.map((x) => CARD_FIELD_LABELS[x.field])))].join(", ")}`, d.payload.title.slice(0, 30)].join("\t")
    case "card_rejected":
      return [...state, `nm ${d.payload.nmId}`, `отказ ${d.payload.channel}`, d.payload.text.slice(0, 40)].join("\t")
```

`apps/worker/src/jobs/bot.ts`:
- в `BotDeps` после `ozonTasksEnabled?`:
```ts
  /** Действующий режим записи карточек Ozon или ЯМ — apply: кнопки вопросов card_edit показываются и принимаются (этап 4). */
  cardEditsEnabled?: boolean
```
- `decisionKeyboard(d, deps.wbReturnEnabled, deps.ozonTasksEnabled ?? false, deps.cardEditsEnabled ?? false)`;
- в цикле напоминаний после строки про заявку Ozon: `if (d.kind === "card_edit" && !deps.cardEditsEnabled) continue`;
- в `handleCallback`: `allowedAnswers(d.kind, deps.wbReturnEnabled, deps.ozonTasksEnabled ?? false, deps.cardEditsEnabled ?? false)`, и в `refusal` перед последней веткой:
```ts
          : parsed.answer === "apply_edit" || parsed.answer === "skip_edit"
            ? "Запись карточек Ozon/ЯМ выключена — ответить сейчас нельзя"
```
`apps/worker/src/cli-prices.ts`:
- в `case "bot"` после `ozonTasksEnabled`:
```ts
        const cardEditsEnabled = (["ozon", "ym"] as const).some((c) => effectiveMode(config.writeMode, chs.get(c)?.cardWriteMode ?? "off") === "apply")
```
и `cardEditsEnabled,` в `runBot({...})`;
- в `decide` — `allowedAnswers(d.kind, true, ozonTasksEnabled, cardEditsEnabled)` с тем же расчётом `cardEditsEnabled` рядом с `ozonTasksEnabled`.

- [ ] **Step 4: Вопросы и исполнение ответов в джобе.** `apps/worker/src/jobs/cards.ts`:
- импорты: из `@sync2/db` — `activeDecisionsOfKind`, `finishDecision`, `isCardEditDecision`, `isCardRejectedDecision`, `noteAnsweredDecision`, `openDecisions`, `type CardEditDecisionRow`; из `@sync2/platforms` — `effectiveMode`, `ozonEditAttributes`, `ozonReimportItem`, `ymEditMapping`, `type OzonModeration`, `type OzonProductFull`, `type YmModeration`; из `@sync2/domain` — `type CardEditPlan`; из `@sync2/shared` — `type CardEditPayload`, `type CardField`, `type OzonFlagProduct`;
- в `CardSources` — источники полных карточек и цен Ozon (переимпорт габаритов) и модерации:
```ts
  ozonProductsFull: (offerIds: readonly string[]) => Promise<Map<string, OzonProductFull>>
  /** Текущие цены Ozon (stage 3: fetchOzonFlagProducts) — переимпорт габаритов идёт с ними. */
  ozonPrices: () => Promise<OzonFlagProduct[]>
  ozonModeration: (offerIds: readonly string[]) => Promise<Map<string, OzonModeration>>
  ymModeration: (offerIds: readonly string[]) => Promise<Map<string, YmModeration>>
```
и в `sources()` теста `cards.db.test.ts` — `ozonProductsFull: async () => new Map(), ozonPrices: async () => [], ozonModeration: async () => new Map(), ymModeration: async () => new Map(),`;
- константы:
```ts
export const MAX_EDIT_QUESTIONS_PER_RUN = 10
/** Ответ с итогом «неизвестно» повторяется (правка идемпотентна) не дольше суток, потом — failed. */
export const ANSWER_RETRY_MS = 24 * 3_600_000
```
- после шага 8 («Правки KIT») — шаг 8b:
```ts
  // 8b. Ozon/ЯМ — вопрос «было → станет» (решение п. 17); ответы партнёров — исполнить в этом же прогоне.
  const editOn = (c: "ozon" | "ym") => effectiveMode(deps.globalMode, modes[c]) === "apply"
  const listingOf = new Map((await loadCardListings(db, channels)).map((l) => [`${l.channel}\u0000${l.barcode}`, l]))
  /** Вопрос → что захешировать при успехе (в т.ч. площадки, где писать нечего). */
  const decisionHashes = new Map<number, Array<{ channelId: number; barcodes: string[]; hash: string }>>()
  const answeredWork = new Map<number, CardEditDecisionRow>()
  const activeEdits = (await activeDecisionsOfKind(db, "card_edit")).filter(isCardEditDecision)
  // Габариты Ozon — переимпорт полной карточки Ozon (решение 29.09 п. 3): полные карточки и цены — только под такие ответы.
  const dimsOffers = activeEdits
    .filter((d) => d.status === "answered" && d.answer === "apply_edit")
    .flatMap((d) => d.payload.channels.filter((e) => e.channel === "ozon" && e.changes.some((x) => x.field === "dimensions")).flatMap((e) => e.barcodes))
    .flatMap((b) => listingOf.get(`ozon\u0000${b}`)?.externalId ?? [])
  let ozonFull = new Map<string, OzonProductFull>()
  let ozonPriceOf = new Map<string, OzonFlagProduct>()
  if (dimsOffers.length > 0) {
    try {
      ozonFull = await deps.sources.ozonProductsFull(dimsOffers)
      ozonPriceOf = new Map((await deps.sources.ozonPrices()).map((x) => [x.offerId, x]))
    } catch (e: unknown) {
      problems.push(`Ozon: полные карточки для габаритов не прочитаны — ${errorText(e)}; ответы с габаритами ждут следующего прогона`)
    }
  }
  for (const d of activeEdits) {
    const p = d.payload
    const cur = hashes.get(p.nmId)
    const stale = p.sizeSplit === null && cur !== undefined && cur !== p.toHash
    if (d.status === "open") {
      if (stale && (await finishDecision(db, d.id, "closed", "на WB новая правка — вопрос задан заново", nowIso, ["open"]))) add("cardEditsSuperseded")
      continue
    }
    if (d.answer === "skip_edit") {
      for (const c of p.channels) await setListingHashes(db, channels.get(c.channel)!.id, c.barcodes, p.toHash)
      await finishDecision(db, d.id, "done", p.sizeSplit ? "оставлен один оффер на артикул (п. 18)" : "не применено по решению — зеркала как есть", nowIso, ["answered"])
      add("cardEditsSkipped")
      continue
    }
    if (stale) {
      await finishDecision(db, d.id, "closed", "на WB новая правка после ответа — задан новый вопрос", nowIso, ["answered"])
      add("cardEditsSuperseded")
      continue
    }
    const c = allContent.get(p.nmId)
    if (!c) {
      problems.push(`ответ на вопрос #${d.id}: карточки nm ${p.nmId} нет в этом чтении WB — исполнится следующим прогоном`)
      continue
    }
    if (p.sizeSplit) {
      answeredWork.set(d.id, d) // разведение размеров — Task 14
      continue
    }
    const mirror = sanitizeCardForMirror(c)
    const hashesToSet: Array<{ channelId: number; barcodes: string[]; hash: string }> = []
    let waiting = false
    for (const e of p.channels) {
      if (!editOn(e.channel)) {
        waiting = true
        continue
      }
      const channelId = channels.get(e.channel)!.id
      const fields = [...new Set(e.changes.map((x) => x.field))]
      // Видео — своим полем card_video (Task 13); размеры — вопросом о разведении (Task 14); габариты Ozon — переимпортом.
      const contentFields: CardField[] = fields.filter((f) => f !== "video" && f !== "sizes" && (e.channel !== "ozon" || f !== "dimensions"))
      hashesToSet.push({ channelId, barcodes: e.barcodes, hash: p.toHash })
      for (const barcode of e.barcodes) {
        const l = listingOf.get(`${e.channel}\u0000${barcode}`)
        if (!l) continue
        if (e.channel === "ozon" && fields.includes("dimensions")) {
          const row = ozonFull.get(l.externalId)
          const pr = ozonPriceOf.get(l.externalId)
          if (!row || !pr || !c.dimensions) {
            waiting = true
            continue
          }
          // Одна запись: полная карточка Ozon + новые габариты + изменённые поля (название/описание/цвет/фото) поверх.
          const item = ozonReimportItem(row, c.dimensions, { priceMinor: pr.priceMinor, oldMinor: pr.oldMinor, vat: pr.vat })
          const over = ozonEditAttributes(mirror, contentFields)
          item.attributes = [...item.attributes.filter((a) => !over.some((o) => o.id === a.id && (o.complex_id ?? 0) === (a.complex_id ?? 0))), ...over]
          if (contentFields.includes("photos")) {
            item.images = mirror.photos.slice(0, 15)
            item.primary_image = mirror.photos[0] ?? item.primary_image
          }
          ops.push({
            channel: "ozon",
            barcode,
            field: "card_content",
            before: hashToNumber(e.fromHash),
            after: hashToNumber(p.toHash),
            externalSku: l.externalId,
            card: { kind: "reimport", nmId: p.nmId, vendorCode: c.vendorCode, offerId: l.externalId, fields: [...contentFields, "dimensions"], payload: { item }, productRef: String(row.id), decisionId: d.id },
          })
          continue
        }
        if (contentFields.length === 0) continue
        const fields = contentFields
        ops.push({
          channel: e.channel,
          barcode,
          field: "card_content",
          before: hashToNumber(e.fromHash),
          after: hashToNumber(p.toHash),
          externalSku: l.externalId,
          card: {
            kind: "content",
            nmId: p.nmId,
            vendorCode: c.vendorCode,
            offerId: l.externalId,
            fields,
            payload:
              e.channel === "ozon"
                ? { attributes: ozonEditAttributes(mirror, fields), images: fields.includes("photos") ? mirror.photos.slice(0, 30) : null }
                : ymEditMapping(mirror, l.externalId, fields),
            productRef: e.channel === "ozon" ? String(ozonKeys?.productIdOf.get(l.externalId) ?? "") || null : null,
            decisionId: d.id,
          },
        })
      }
    }
    if (waiting) {
      problems.push(`ответ на вопрос #${d.id} (nm ${p.nmId}) ждёт: apply карточек площадки (card-mode … apply --confirm) или полную карточку Ozon для габаритов`)
      continue
    }
    decisionHashes.set(d.id, hashesToSet)
    answeredWork.set(d.id, d)
  }

  if (!massStopped) {
    const byNm = new Map<number, CardEditPlan[]>()
    for (const e of plan.edits) if (e.channel !== "kit" && editOn(e.channel)) byNm.set(e.nmId, [...(byNm.get(e.nmId) ?? []), e])
    let opened = 0
    for (const [nmId, edits] of byNm) {
      if (opened >= MAX_EDIT_QUESTIONS_PER_RUN) {
        add("cardEditQuestionsDeferred")
        continue
      }
      const c = contentOf.get(nmId)!
      const toHash = hashes.get(nmId)!
      const now2 = sanitizeCardForMirror(c)
      const chs: CardEditPayload["channels"] = []
      for (const e of edits) {
        const from = await loadWbCardVersion(db, nmId, e.fromHash)
        const changes = from ? diffCardContent(sanitizeCardForMirror(from), now2) : [{ field: "title" as const, before: "(версия WB не сохранена)", after: now2.title }]
        const barcodes = e.listings.map((l) => l.barcode)
        // Изменилось только то, что зеркала не видят (ТН ВЭД, санитайзер) — синхронизировано без вопроса.
        if (changes.length === 0) await setListingHashes(db, channels.get(e.channel)!.id, barcodes, toHash)
        else chs.push({ channel: e.channel as "ozon" | "ym", barcodes, fromHash: e.fromHash, changes })
      }
      if (chs.length === 0) continue
      opened += await openDecisions(db, [{ kind: "card_edit", subject: `edit:${nmId}`, payload: { nmId, vendorCode: c.vendorCode, title: c.title, toHash, channels: chs, sizeSplit: null } }], deps.runId)
    }
    if (opened > 0) counters.cardEditQuestions = opened
  }
```
- после цикла итогов по листингам (шаг 9) — итоги вопросов:
```ts
  for (const [id, d] of answeredWork) {
    const mine = outs.filter((o) => o.card?.decisionId === id)
    if (mine.some((o) => o.mode !== "apply")) continue // режим не apply (выборочный предпросмотр) — ответ ждёт
    const bad = mine.filter((o) => !o.applied && !o.uncertain)
    const unknown = mine.filter((o) => o.uncertain)
    if (bad.length > 0) {
      await finishDecision(db, id, "failed", `не применено: ${shown(bad.map((o) => `${CHANNEL_LABELS[o.channel]} ${o.card!.offerId}: ${o.error ?? "отказ"}`))}`, nowIso, ["answered"])
      add("cardEditsFailed")
      continue
    }
    if (unknown.length > 0) {
      const old = d.answeredAt !== null && now.getTime() - Date.parse(d.answeredAt) > ANSWER_RETRY_MS
      if (old) await finishDecision(db, id, "failed", "итог записи неизвестен больше суток — проверьте карточку в ЛК", nowIso, ["answered"])
      else await noteAnsweredDecision(db, id, "итог записи неизвестен — повтор следующим прогоном", nowIso)
      continue
    }
    for (const g of decisionHashes.get(id) ?? []) await setListingHashes(db, g.channelId, g.barcodes, g.hash)
    const per = (["ozon", "ym"] as const).map((c) => `${CHANNEL_LABELS[c]} ${mine.filter((o) => o.channel === c).length}`).join(", ")
    if (await finishDecision(db, id, "done", `применено: ${per}`, nowIso, ["answered"])) add("cardEditsApplied")
  }
```
Шаг 8b стоит **до** `executeWrites` (шаг 9): операции ответов уходят той же записью, что создания и правки KIT. Вопросы по правкам KIT не задаются (п. 17).

- после шага 8b — шаг 8c, модерация созданного синком (решение 29.09 п. 1: отказ — вопрос с текстом, карточка не пересоздаётся):
```ts
  // 8c. Модерация созданных синком товаров Ozon/ЯМ: отказ — листинг failed (повтор только после правки WB или cards retry)
  // и вопрос card_rejected с текстом площадки; «УИН ГИИС ДМДК» — отдельной строкой.
  const rejections: Array<{ channel: CardChannel; barcode: string; offerId: string; nmId: number | null; text: string; needsDmdk: boolean }> = []
  const pendingMine = (await loadCardListings(db, channels)).filter((l) => l.status === "pending" && (l.channel === "ozon" || l.channel === "ym"))
  for (const ch of ["ozon", "ym"] as const) {
    const list = pendingMine.filter((l) => l.channel === ch)
    if (list.length === 0 || !keys[ch]) continue
    let mod: Map<string, OzonModeration | YmModeration>
    try {
      mod = ch === "ozon" ? await deps.sources.ozonModeration(list.map((l) => l.externalId)) : await deps.sources.ymModeration(list.map((l) => l.externalId))
    } catch (e: unknown) {
      problems.push(`${CHANNEL_LABELS[ch]}: модерация созданных не прочитана — ${errorText(e)}`)
      continue
    }
    for (const l of list) {
      const m = mod.get(l.externalId)
      if (!m || m.state !== "rejected") continue
      await markListingFailed(db, { channelId: channels.get(ch)!.id, barcode: l.barcode, externalId: l.externalId, nmId: l.nmId ?? 0, hash: l.contentHash ?? "", error: m.text })
      rejections.push({ channel: ch, barcode: l.barcode, offerId: l.externalId, nmId: l.nmId, text: m.text, needsDmdk: m.needsDmdk })
      add(`${ch}CardModerationRejected`)
    }
  }
```
- в цикле итогов шага 9, в ветке отказа создания (после `failedCreates.push(…)`):
```ts
        rejections.push({ channel: o.channel as CardChannel, barcode: o.barcode, offerId: o.card.offerId, nmId: o.card.nmId, text: o.error ?? "отказ без текста", needsDmdk: /ДМДК|УИН/i.test(o.error ?? "") })
```
- после цикла «итоги вопросов» — вопросы об отказах и отметки «Принято»:
```ts
  for (const r of rejections) {
    const c = r.nmId !== null ? allContent.get(r.nmId) : undefined
    const n = await openDecisions(
      db,
      [{ kind: "card_rejected", subject: `rejected:${r.channel}:${r.barcode}`, payload: { nmId: r.nmId ?? 0, vendorCode: c?.vendorCode ?? r.offerId, title: c?.title ?? "", channel: r.channel, offerId: r.offerId, barcode: r.barcode, text: r.text, needsDmdk: r.needsDmdk } }],
      deps.runId,
    )
    if (n > 0) add("cardRejectedQuestions")
  }
  for (const d of (await activeDecisionsOfKind(db, "card_rejected")).filter(isCardRejectedDecision)) {
    if (d.status === "answered") await finishDecision(db, d.id, "done", "принято к сведению", nowIso, ["answered"])
  }
```

- [ ] **Step 5: Проверка и коммит.**
```bash
npx vitest run apps/worker/src/decision-text.test.ts && npm run test:db -- apps/worker/src/jobs/cards.db.test.ts apps/worker/src/jobs/bot.db.test.ts && npm run typecheck && npm test && npm run test:db
git add packages/shared/src/decisions.ts packages/db/src/decisions.ts packages/db/migrations apps/worker/src/decision-text.ts apps/worker/src/decision-text.test.ts apps/worker/src/jobs/bot.ts apps/worker/src/cli-prices.ts apps/worker/src/jobs/cards.ts apps/worker/src/jobs/cards.db.test.ts
git commit -m "sync2: карточки — вопросы card_edit «было → станет» и card_rejected (отказ модерации, УИН ГИИС ДМДК; миграция 0009), габариты Ozon переимпортом, исполнение ответа той же записью"
```

---

### Task 12: Команды `cards` и `card-mode`, предпросмотр apply карточек

**Files:**
- Create: `apps/worker/src/cli-cards.ts`, `apps/worker/src/cli-cards.test.ts`
- Modify: `apps/worker/src/apply-preview.ts`, `apps/worker/src/apply-preview.test.ts`, `apps/worker/src/cli.ts`

- [ ] **Step 1: Падающие тесты.** В `apps/worker/src/apply-preview.test.ts` дописать:
```ts
import { CARD_APPLY_PREVIEW_MAX_AGE_H, checkCardApplyPreview } from "./apply-preview"

describe("apply карточек — по свежему прогону cards", () => {
  const at = new Date("2026-10-12T17:00:00.000Z")
  const run = (counters: Record<string, unknown>, startedAt = "2026-10-12T16:19:00.000Z", status = "ok") => ({ runId: "r", status, startedAt, counters })
  it("нет прогона, упал, старше 3 ч, площадка не прочитана, выборочный, массовая правка — нельзя; иначе можно", () => {
    expect(checkCardApplyPreview(null, "kit", at)).toMatchObject({ ok: false })
    expect(checkCardApplyPreview(run({ kitCardKeys: 393 }, undefined, "failed"), "kit", at)).toMatchObject({ ok: false })
    expect(checkCardApplyPreview(run({ kitCardKeys: 393 }, "2026-10-12T13:00:00.000Z"), "kit", at)).toMatchObject({ ok: false })
    expect(checkCardApplyPreview(run({ ozonCardKeys: 81 }), "kit", at)).toEqual({ ok: false, reason: "в последнем cards ключи KIT не прочитаны — сначала card-mode kit dry-run и cards run" })
    expect(checkCardApplyPreview(run({ kitCardKeys: 393, cardsOnly: 1 }), "kit", at)).toMatchObject({ ok: false })
    expect(checkCardApplyPreview(run({ kitCardKeys: 393, cardsMassStopped: 30 }), "kit", at)).toMatchObject({ ok: false })
    expect(checkCardApplyPreview(run({ kitCardKeys: 393 }), "kit", at)).toEqual({ ok: true })
    expect(CARD_APPLY_PREVIEW_MAX_AGE_H).toBe(3)
  })
})
```
`apps/worker/src/cli-cards.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { parseCardsRunFlags } from "./cli-cards"

describe("флаги cards run", () => {
  it("--only и --channel — список; без --confirm выборочный прогон — предпросмотр", () => {
    expect(parseCardsRunFlags(["--only=888645543123,2057086856166", "--channel=kit"])).toEqual({ ok: true, only: ["888645543123", "2057086856166"], channels: ["kit"], allowMass: false, confirm: false, preview: true })
    expect(parseCardsRunFlags([])).toEqual({ ok: true, only: null, channels: null, allowMass: false, confirm: false, preview: false })
    expect(parseCardsRunFlags(["--allow-mass"])).toMatchObject({ ok: true, preview: true })
    expect(parseCardsRunFlags(["--allow-mass", "--confirm"])).toMatchObject({ ok: true, preview: false, allowMass: true })
    expect(parseCardsRunFlags(["--channel=wb"])).toEqual({ ok: false, error: "--channel=<ozon|ym|kit>, получено «wb»" })
    expect(parseCardsRunFlags(["--only="])).toEqual({ ok: false, error: "--only=<артикул|штрихкод,…>: пустой список" })
  })
})
```
Run: `npx vitest run apps/worker/src/apply-preview.test.ts apps/worker/src/cli-cards.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `apps/worker/src/apply-preview.ts` — в конец:
```ts
/** Прогон cards — раз в час; план старше этого для «включать apply карточек» не годится. */
export const CARD_APPLY_PREVIEW_MAX_AGE_H = 3

const CARD_LABEL = { ozon: "Ozon", ym: "ЯМ", kit: "KIT" } as const

/** Можно ли включать apply карточек площадки (этап 4): свежий полный прогон cards, ключи площадки прочитаны, не остановлен. */
export function checkCardApplyPreview(run: RunInfo | null, channel: "ozon" | "ym" | "kit", now: Date): { ok: true } | { ok: false; reason: string } {
  if (!run) return { ok: false, reason: "cards ещё не запускался — сначала card-mode … dry-run и cards run" }
  if (run.status !== "ok" && run.status !== "partial") return { ok: false, reason: `последний cards — ${run.status}` }
  const ageH = (now.getTime() - Date.parse(run.startedAt)) / 3_600_000
  if (ageH > CARD_APPLY_PREVIEW_MAX_AGE_H) return { ok: false, reason: `последний cards ${Math.round(ageH)} ч назад — запустите cards run` }
  if (!(`${channel}CardKeys` in run.counters)) return { ok: false, reason: `в последнем cards ключи ${CARD_LABEL[channel]} не прочитаны — сначала card-mode ${channel} dry-run и cards run` }
  if ("cardsOnly" in run.counters) return { ok: false, reason: "последний cards — выборочный (--only), а не план по всем карточкам: запустите без --only" }
  if ("cardsMassStopped" in run.counters) return { ok: false, reason: "последний cards остановлен массовой правкой WB — разобрать (cards baseline или --allow-mass) до apply" }
  return { ok: true }
}
```
`apps/worker/src/cli-cards.ts`:
```ts
import { eq } from "drizzle-orm"
import {
  channels,
  clearListingFailure,
  decisionById,
  drizzleRunStore,
  getState,
  isCardEditDecision,
  lastRunStatus,
  latestRun,
  loadCardListings,
  loadChannels,
  loadWbCardHashes,
  loadWbCardVersion,
  setListingHashes,
  writesOfRun,
  type Db,
} from "@sync2/db"
import {
  effectiveMode,
  fetchKitCardKeys,
  fetchOzonCardKeys,
  fetchOzonCreateQuota,
  fetchOzonDictValueId,
  fetchOzonFlagProducts,
  fetchOzonModeration,
  fetchOzonProductsFull,
  fetchWbCardContents,
  fetchYmCardKeys,
  fetchYmModeration,
} from "@sync2/platforms"
import { CARD_CHANNELS, CARD_FIELD_LABELS, isCardChannel, type CardChannel, type Config, type WriteMode } from "@sync2/shared"
import { checkCardApplyPreview } from "./apply-preview"
import { loadCardCategories } from "./card-config"
import { buildCardSender } from "./card-senders"
import { loadChannelsConfig } from "./channels-config"
import { CARDS_JOB, CARDS_PLAN_KEY, runCards, type CardsPlanSummary } from "./jobs/cards"
import { formatMsk } from "./jobs/compare-v1"
import type { Logger } from "./log"
import type { Notifier } from "./notify"
import { notifyTransition } from "./notify-run"
import { loadPricingConfig } from "./pricing-config"
import { withRun } from "./run"

export const CARD_COMMANDS: ReadonlySet<string> = new Set(["cards", "card-mode"])
export const CARD_FLAGS: Record<string, readonly string[]> = {
  cards: ["--only", "--channel", "--allow-mass", "--confirm"],
  "card-mode": ["--confirm"],
}

export const CARD_USAGE = `
Карточки (этап 4):
  cards run [--only=<артикул|штрихкод,…>] [--channel=<ozon|ym|kit>] [--allow-mass] [--confirm]
                         создания, правки KIT, вопросы Ozon/ЯМ, исполнение ответов (крон раз в час, :19);
                         --only/--channel/--allow-mass без --confirm — предпросмотр (dry-run)
  cards plan             план/итог последнего прогона: создания, правки, пропуски с причинами
  cards diff <номер вопроса>
                         правка карточки полностью: было → станет по полям (из версий WB)
  cards baseline [--only=<артикул,…>] --confirm
                         принять текущий контент зеркал как синхронизированный (после массовой правки WB)
  cards retry <штрихкод> <ozon|ym|kit> [--confirm]
                         повторить отклонённое создание следующим прогоном
  card-mode <ozon|ym|kit> <off|dry-run|apply> [--confirm]
                         режим записи карточек; apply — после плана свежего cards run и с --confirm`

export interface CardCliContext {
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
const list = (raw: string) => raw.split(",").map((s) => s.trim()).filter(Boolean)

export function parseCardsRunFlags(
  flags: readonly string[],
): { ok: true; only: string[] | null; channels: CardChannel[] | null; allowMass: boolean; confirm: boolean; preview: boolean } | { ok: false; error: string } {
  const hasOnly = flags.some((f) => f === "--only" || f.startsWith("--only="))
  const only = hasOnly ? list(flagValue(flags, "--only") ?? "") : null
  if (only !== null && only.length === 0) return { ok: false, error: "--only=<артикул|штрихкод,…>: пустой список" }
  const rawCh = flags.some((f) => f.startsWith("--channel")) ? list(flagValue(flags, "--channel") ?? "") : null
  if (rawCh !== null) for (const c of rawCh.length ? rawCh : [""]) if (!isCardChannel(c)) return { ok: false, error: `--channel=<ozon|ym|kit>, получено «${c}»` }
  const allowMass = flags.includes("--allow-mass")
  const confirm = flags.includes("--confirm")
  const narrowed = only !== null || rawCh !== null || allowMass
  return { ok: true, only, channels: rawCh as CardChannel[] | null, allowMass, confirm, preview: narrowed && !confirm }
}

function printPlan(summary: CardsPlanSummary | null, rows: Awaited<ReturnType<typeof writesOfRun>>): void {
  const cardRows = rows.filter((w) => w.field === "card_create" || w.field === "card_content")
  for (const w of cardRows) {
    const state = w.applied ? "применено" : w.uncertain ? `итог неизвестен: ${w.error ?? ""}` : w.error ? `ошибка: ${w.error}` : w.mode
    console.log([w.channel, w.field === "card_create" ? "создать" : "правка", w.barcode, w.externalSku ?? "—", w.vendorCode ?? "", state, (w.title ?? "").slice(0, 40)].join("\t"))
  }
  if (cardRows.length === 0) console.log("записей карточек в прогоне нет")
  if (!summary) return
  console.log(`правки: ${summary.edits.length}, разведение размеров: ${summary.splits.length}${summary.massStopped ? `; ⚠️ массовая правка WB — ${summary.massStopped} карточек, правки не отправлены` : ""}`)
  for (const s of summary.skips) console.log(["пропуск", s.channel, s.barcode, `nm ${s.nmId}`, s.reason].join("\t"))
}

export async function runCardCommand(ctx: CardCliContext, pos: readonly string[], flags: readonly string[]): Promise<number> {
  const [cmd, sub, a1, a2] = pos
  const { db, log, config, notifier, env } = ctx
  if (cmd === "card-mode") return cardMode(ctx, sub, a1, flags)
  switch (sub) {
    case "run": {
      const f = parseCardsRunFlags(flags)
      if (!f.ok) {
        console.error(f.error)
        return 2
      }
      const globalMode: WriteMode = f.preview ? "dry-run" : config.writeMode
      if (f.preview) console.error("выборочный прогон без --confirm — dry-run: план в cards plan, запись — повторите с --confirm")
      const prev = await lastRunStatus(db, CARDS_JOB)
      const outcome = await withRun(CARDS_JOB, { store: drizzleRunStore(db), log, writeMode: globalMode }, async (run) => {
        const ch = loadChannelsConfig(env)
        const r = await runCards({
          db,
          now: () => new Date(),
          runId: run.runId,
          globalMode,
          categories: loadCardCategories(),
          pricing: loadPricingConfig(),
          sources: {
            wbCards: () => fetchWbCardContents(ch.wb.token),
            ozonKeys: () => fetchOzonCardKeys(ch.ozon),
            ymKeys: () => fetchYmCardKeys(ch.ym),
            kitKeys: () => fetchKitCardKeys({ token: ch.kit.token }),
            ozonDict: (q) => fetchOzonDictValueId(ch.ozon, q),
            ozonCreateQuota: () => fetchOzonCreateQuota(ch.ozon),
            ozonProductsFull: (ids) => fetchOzonProductsFull(ch.ozon, ids),
            ozonPrices: () => fetchOzonFlagProducts(ch.ozon),
            ozonModeration: (ids) => fetchOzonModeration(ch.ozon, ids),
            ymModeration: (ids) => fetchYmModeration(ch.ym, ids),
          },
          send: buildCardSender(ch),
          ...(f.only ? { only: f.only } : {}),
          ...(f.channels ? { channelsOnly: f.channels } : {}),
          allowMass: f.allowMass && f.confirm,
        })
        return { status: r.status, counters: r.counters, error: r.error }
      })
      await notifyTransition(db, log, notifier, CARDS_JOB, prev, outcome)
      console.log(`${outcome.status} ${JSON.stringify(outcome.counters)}${outcome.error ? ` — ${outcome.error}` : ""}`)
      return outcome.status === "failed" ? 1 : 0
    }
    case "plan": {
      const run = await latestRun(db, CARDS_JOB)
      if (!run) {
        console.error("cards ещё не запускался")
        return 2
      }
      console.log(`${CARDS_JOB} ${run.startedAt} ${run.status} ${JSON.stringify(run.counters)}`)
      printPlan(await getState<CardsPlanSummary>(db, CARDS_PLAN_KEY), await writesOfRun(db, run.runId))
      return 0
    }
    case "diff": {
      const id = Number(a1)
      const d = Number.isSafeInteger(id) && id > 0 ? await decisionById(db, id) : null
      if (!d || !isCardEditDecision(d)) {
        console.error("cards diff <номер вопроса card_edit>")
        return 2
      }
      const p = d.payload
      const to = await loadWbCardVersion(db, p.nmId, p.toHash)
      for (const c of p.channels) {
        const from = await loadWbCardVersion(db, p.nmId, c.fromHash)
        console.log(`=== ${c.channel} (${c.barcodes.join(", ")})`)
        for (const x of c.changes) {
          const full = x.field === "description" && from && to ? { before: from.description, after: to.description } : x
          console.log(`--- ${CARD_FIELD_LABELS[x.field]}: было\n${full.before}\n+++ станет\n${full.after}`)
        }
      }
      if (p.sizeSplit) console.log(JSON.stringify(p.sizeSplit, null, 2))
      return 0
    }
    case "baseline": {
      const only = flags.some((f) => f.startsWith("--only")) ? new Set(list(flagValue(flags, "--only") ?? "")) : null
      const chs = await loadChannels(db)
      const current = await loadWbCardHashes(db)
      const todo = (await loadCardListings(db, chs)).filter((l) => l.status === "active" && l.nmId !== null && current.has(l.nmId) && l.contentHash !== current.get(l.nmId) && (!only || only.has(l.barcode) || only.has(l.externalId)))
      console.log(`принять как синхронизированные: ${todo.length} листингов (${CARD_CHANNELS.map((c) => `${c} ${todo.filter((l) => l.channel === c).length}`).join(", ")}) — зеркала не меняются, правки по ним не пойдут`)
      if (!flags.includes("--confirm")) {
        console.error("не записано: повторите с --confirm")
        return 2
      }
      for (const l of todo) await setListingHashes(db, chs.get(l.channel)!.id, [l.barcode], current.get(l.nmId!)!)
      console.log("записано")
      return 0
    }
    case "retry": {
      if (!a1 || !a2 || !isCardChannel(a2)) {
        console.error("cards retry <штрихкод> <ozon|ym|kit> [--confirm]")
        return 2
      }
      if (!flags.includes("--confirm")) {
        console.error(`повторить создание ${a1} на ${a2} следующим прогоном — повторите с --confirm`)
        return 2
      }
      const chs = await loadChannels(db)
      const ok = await clearListingFailure(db, chs.get(a2)!.id, a1)
      console.log(ok ? "отмечено: создание повторится следующим прогоном cards" : "отклонённого создания с таким штрихкодом нет")
      return ok ? 0 : 2
    }
    default:
      console.error(`cards run|plan|diff|baseline|retry${CARD_USAGE}`)
      return 2
  }
}

async function cardMode(ctx: CardCliContext, channel: string | undefined, mode: string | undefined, flags: readonly string[]): Promise<number> {
  const { db, config } = ctx
  if (!channel || !isCardChannel(channel)) {
    console.error("карточки пишутся на Ozon, ЯМ и KIT (WB — мастер, сайт берёт сам): card-mode <ozon|ym|kit> <off|dry-run|apply> [--confirm]")
    return 2
  }
  if (mode !== "off" && mode !== "dry-run" && mode !== "apply") {
    console.error(`неизвестный режим: ${mode} (ожидается off | dry-run | apply)`)
    return 2
  }
  if (mode === "apply") {
    const run = await latestRun(db, CARDS_JOB)
    if (run) printPlan(await getState<CardsPlanSummary>(db, CARDS_PLAN_KEY), (await writesOfRun(db, run.runId)).filter((w) => w.channel === channel))
    const verdict = checkCardApplyPreview(run, channel, new Date())
    if (!verdict.ok) {
      console.error(`apply карточек ${channel} не включён: ${verdict.reason}`)
      return 2
    }
    if (!flags.includes("--confirm")) {
      console.error("apply карточек не включён: посмотрите план выше и повторите с --confirm")
      return 2
    }
  } else if (flags.includes("--confirm")) {
    console.error("--confirm нужен только для apply")
    return 2
  }
  await db.update(channels).set({ cardWriteMode: mode }).where(eq(channels.code, channel))
  for (const r of await db.select({ code: channels.code, stock: channels.writeMode, price: channels.priceWriteMode, guard: channels.guardWriteMode, card: channels.cardWriteMode }).from(channels).orderBy(channels.code)) {
    console.log(`${r.code}\tостатки ${r.stock}\tцены ${r.price}\tзащиты ${r.guard}\tкарточки ${r.card}`)
  }
  const eff = effectiveMode(config.writeMode, mode)
  if (eff !== mode) console.error(`⚠️ глобальный SYNC_WRITE_MODE=${config.writeMode} ограничивает карточки: действует ${eff}`)
  const last = await latestRun(db, CARDS_JOB)
  console.log(`последний cards: ${last ? `${formatMsk(last.startedAt)} (${last.status})` : "—"}`)
  return 0
}
```
`apps/worker/src/cli.ts`:
- импорт: `import { CARD_COMMANDS, CARD_FLAGS, CARD_USAGE, runCardCommand } from "./cli-cards"`;
- в `USAGE` после `${GUARD_USAGE}` — `${CARD_USAGE}`;
- проверка флагов: `(ALLOWED_FLAGS[cmd] ?? PRICE_FLAGS[cmd] ?? GUARD_FLAGS[cmd] ?? CARD_FLAGS[cmd] ?? [])`;
- после строки `if (GUARD_COMMANDS.has(cmd)) …`:
```ts
    if (CARD_COMMANDS.has(cmd)) return await runCardCommand({ db, log, config, notifier, env: process.env }, positional, flags)
```
(флаг `--channel` у `cards` принимается и как `--channel=kit`: проверка имени до «=» в `main` уже есть.)

- [ ] **Step 3: Проверка и коммит.**
```bash
npx vitest run apps/worker/src/apply-preview.test.ts apps/worker/src/cli-cards.test.ts && npm run typecheck && npm test && npm run test:db
npm run cli -- help | grep -A2 "cards run"
git add apps/worker/src/apply-preview.ts apps/worker/src/apply-preview.test.ts apps/worker/src/cli-cards.ts apps/worker/src/cli-cards.test.ts apps/worker/src/cli.ts
git commit -m "sync2: карточки — команды cards run|plan|diff|baseline|retry и card-mode с предпросмотром apply по свежему прогону"
```

---

### Task 13: Видео — HLS WB → mp4 (ffmpeg) → публикация на сервере сайта → прикрепление на Ozon/ЯМ/KIT (решение 29.09 п. 2)

**Files:**
- Create: `apps/worker/src/video/hls.ts`, `apps/worker/src/video/hls.test.ts`, `apps/worker/src/video/publish.ts`, `apps/worker/src/video/publish.test.ts`
- Modify: `packages/db/src/cards-store.ts`, `packages/db/src/store-4.db.test.ts`, `apps/worker/src/jobs/cards.ts`, `apps/worker/src/jobs/cards.db.test.ts`, `apps/worker/src/cli-cards.ts`, `.env.example`

**Как устроено.** WB отдаёт видео HLS-плейлистом (сегменты `N.ts`, ~3 с), площадки берут файл: Ozon и ЯМ — по постоянной публичной ссылке, KIT — `videos/from_url` по ссылке. HTTPS на VPS синка невозможен (443 занят `xray`), а сервер сайта уже раздаёт `https://kotelnikovartifact.ru/video/*.mp4` (28.09, 39 роликов) — туда синк и кладёт файлы. Сборка — на VPS синка (`ffmpeg` ставится при выкладке, Task 17), публикация — `rsync` по отдельному ключу, который на сервере сайта ограничен `rrsync -wo /var/www/media/video/` (писать можно только в эту папку, ни shell, ни чтения). Видео не задерживает создание: первое видео прикрепляется следующим прогоном туда, где у товара площадки его нет; замена — вопросом `card_edit` (Ozon/ЯМ) или сразу (KIT).

- [ ] **Step 1: Падающие тесты.** `apps/worker/src/video/hls.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest"
import { buildMp4, videoFileName, videoFits, type Exec } from "./hls"

const SRC = "https://videonme-basket-12.wbbasket.ru/vol140/part163102/1631024060/hls/1440p/index.m3u8"

describe("сборка mp4 из HLS WB", () => {
  it("копирование без перекодирования; ffprobe — длительность; размер файла", async () => {
    const exec = vi.fn<Exec>(async (cmd) => (cmd === "ffprobe" ? { stdout: "14.4\n", stderr: "" } : { stdout: "", stderr: "" }))
    expect(await buildMp4(SRC, "/tmp/x.mp4", exec, async () => 3_532_139)).toEqual({ durationSec: 14, bytes: 3_532_139 })
    expect(exec.mock.calls[0]![1]).toEqual(["-hide_banner", "-loglevel", "error", "-y", "-protocol_whitelist", "file,http,https,tcp,tls,crypto", "-i", SRC, "-c", "copy", "-bsf:a", "aac_adtstoasc", "-movflags", "+faststart", "/tmp/x.mp4"])
  })

  it("копирование отказало — перекодирование H.264/AAC", async () => {
    let n = 0
    const exec = vi.fn<Exec>(async (cmd) => {
      if (cmd === "ffmpeg" && n++ === 0) throw new Error("Could not find tag for codec")
      return cmd === "ffprobe" ? { stdout: "25.0", stderr: "" } : { stdout: "", stderr: "" }
    })
    await buildMp4(SRC, "/tmp/x.mp4", exec, async () => 1)
    expect(exec.mock.calls[1]![1]).toContain("libx264")
  })

  it("пределы: 8 с – 5 мин, ≤ 100 МБ; имя файла — артикул + 8 символов хеша ссылки", () => {
    expect(videoFits({ durationSec: 14, bytes: 3_500_000 })).toBeNull()
    expect(videoFits({ durationSec: 5, bytes: 1 })).toContain("короче 8 с")
    expect(videoFits({ durationSec: 400, bytes: 1 })).toContain("длиннее 300 с")
    expect(videoFits({ durationSec: 20, bytes: 200 * 1024 * 1024 })).toContain("больше 100 МБ")
    expect(videoFileName("JW-NB-AGT-M-0073", SRC)).toMatch(/^JW-NB-AGT-M-0073-[0-9a-f]{8}\.mp4$/)
    expect(videoFileName("JW-NB-AGT-M-0073", SRC)).toBe(videoFileName("JW-NB-AGT-M-0073", SRC))
    expect(videoFileName("a/b c", SRC)).toMatch(/^a_b_c-/)
  })
})
```
`apps/worker/src/video/publish.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest"
import type { Exec } from "./hls"
import { checkPublicVideo, loadVideoConfig, publishVideo } from "./publish"

describe("публикация видео на сервер сайта", () => {
  it("конфиг: без цели или ключа — видео выключено; ссылка — только https", () => {
    expect(loadVideoConfig({})).toBeNull()
    expect(loadVideoConfig({ SYNC2_VIDEO_RSYNC_TARGET: "root@201.34.133.76:", SYNC2_VIDEO_SSH_KEY: "/root/.ssh/sync2_video" })).toEqual({
      rsyncTarget: "root@201.34.133.76:",
      sshKey: "/root/.ssh/sync2_video",
      publicBase: "https://kotelnikovartifact.ru/video",
      dir: "/opt/sync2/media/video",
    })
    expect(() => loadVideoConfig({ SYNC2_VIDEO_RSYNC_TARGET: "x:", SYNC2_VIDEO_SSH_KEY: "k", SYNC2_VIDEO_PUBLIC_BASE: "http://x" })).toThrow(/https/)
  })

  it("rsync по ключу в папку rrsync; ссылка = публичная база + имя", async () => {
    const exec = vi.fn<Exec>(async () => ({ stdout: "", stderr: "" }))
    const cfg = loadVideoConfig({ SYNC2_VIDEO_RSYNC_TARGET: "root@201.34.133.76:", SYNC2_VIDEO_SSH_KEY: "/root/.ssh/sync2_video" })!
    expect(await publishVideo(cfg, "/opt/sync2/media/video/A-1a2b3c4d.mp4", "A-1a2b3c4d.mp4", exec)).toBe("https://kotelnikovartifact.ru/video/A-1a2b3c4d.mp4")
    expect(exec.mock.calls[0]).toEqual([
      "rsync",
      ["-e", "ssh -i /root/.ssh/sync2_video -o BatchMode=yes -o StrictHostKeyChecking=yes", "--chmod=F644", "/opt/sync2/media/video/A-1a2b3c4d.mp4", "root@201.34.133.76:A-1a2b3c4d.mp4"],
      { timeoutMs: 120_000 },
    ])
  })

  it("ссылка проверяется HEAD: 200 и video/mp4, иначе ошибка", async () => {
    await expect(checkPublicVideo("https://x/v.mp4", async () => new Response(null, { status: 200, headers: { "content-type": "video/mp4" } }))).resolves.toBeUndefined()
    await expect(checkPublicVideo("https://x/v.mp4", async () => new Response(null, { status: 404 }))).rejects.toThrow(/404/)
    await expect(checkPublicVideo("https://x/v.mp4", async () => new Response(null, { status: 200, headers: { "content-type": "text/html" } }))).rejects.toThrow(/video\/mp4/)
  })
})
```
В `packages/db/src/store-4.db.test.ts` дописать:
```ts
import { loadWbCardVideos, saveWbCardVideo } from "./cards-store"

describe.skipIf(!TEST_DATABASE_URL)("этап 4: видео WB", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())
  it("сохраняется по nm_id, повтор — перезапись; статус из закрытого списка", async () => {
    await saveWbCardVideo(h.db, { nmId: 1, sourceUrl: "s1", fileName: "A-1.mp4", publicUrl: null, status: "failed", durationSec: null, bytes: null, error: "timeout" })
    await saveWbCardVideo(h.db, { nmId: 1, sourceUrl: "s1", fileName: "A-1.mp4", publicUrl: "https://kotelnikovartifact.ru/video/A-1.mp4", status: "ready", durationSec: 14, bytes: 3_532_139, error: null })
    const v = (await loadWbCardVideos(h.db)).get(1)!
    expect(v).toMatchObject({ status: "ready", publicUrl: "https://kotelnikovartifact.ru/video/A-1.mp4", durationSec: 14, error: null })
    await expectConstraint(saveWbCardVideo(h.db, { nmId: 2, sourceUrl: "s", fileName: "f", publicUrl: null, status: "broken" as never, durationSec: null, bytes: null, error: null }), "wb_card_videos_status_check")
  })
})
```
В `apps/worker/src/jobs/cards.db.test.ts` дописать:
```ts
  it("видео: собирается один раз, прикрепляется туда, где его нет (Ozon — комплекс 100001, KIT — ссылкой); не задерживает прочее", async () => {
    await mode("ozon", "apply")
    await mode("kit", "apply")
    const withVideo = card({ nmId: 327127352, vendorCode: "JW-NB-AGT-M-0073", subject: "Браслеты", title: "Браслет Синергия v4", sizes: [{ chrtId: 1, techSize: "0", wbSize: "", barcodes: ["2042770600705"] }], video: "https://videonme-basket-10.wbbasket.ru/vol111/part28811/327127352/hls/1440p/index.m3u8" })
    const prepare = vi.fn(async (_src: string, fileName: string) => ({ status: "ready" as const, publicUrl: `https://kotelnikovartifact.ru/video/${fileName}`, durationSec: 14, bytes: 3_000_000 }))
    const src: CardSources = {
      ...sources([withVideo]),
      ozonProductsFull: async () => new Map([["JW-NB-AGT-M-0073", { id: 777, offer_id: "JW-NB-AGT-M-0073", name: "n", description_category_id: 17027899, type_id: 87458883, depth: 1, width: 1, height: 1, dimension_unit: "mm", weight: 1, weight_unit: "g", attributes: [] }]]),
      kitKeys: async () => ({ ...noKeys(), productOfBarcode: new Map(), withVideo: new Set(), imagesOf: new Map([["var-0705", [{ type: "IMAGE" as const, display_sequence: 0, image_id: "i1" }]]]) }),
    }
    const send = okSend()
    const runId = await nextRun()
    const r = await runCards({ db: h.db, now: () => NOW, runId, globalMode: "apply", categories: loadCardCategories(), pricing: loadPricingConfig(), sources: src, send, video: { prepare } })
    expect(prepare).toHaveBeenCalledTimes(1)
    const videoOps = send.mock.calls.flatMap((c) => c[1]).filter((o) => o.field === "card_video")
    expect(videoOps.map((o) => o.channel).sort()).toEqual(["kit", "ozon"])
    const oz = videoOps.find((o) => o.channel === "ozon")!
    expect((oz.card!.payload as { attributes: Array<{ id: number; complex_id?: number }> }).attributes.map((a) => [a.complex_id, a.id])).toEqual([[100001, 21841], [100001, 21837]])
    const kit = videoOps.find((o) => o.channel === "kit")!
    expect(kit.card!.payload).toMatchObject({ videoUrl: expect.stringMatching(/^https:\/\/kotelnikovartifact\.ru\/video\/JW-NB-AGT-M-0073-[0-9a-f]{8}\.mp4$/), images: [{ image_id: "i1" }] })
    expect(r.counters.videosBuilt).toBe(1)
    // Второй прогон: видео уже собрано — сборки нет.
    const runId2 = await nextRun()
    await runCards({ db: h.db, now: () => NOW, runId: runId2, globalMode: "apply", categories: loadCardCategories(), pricing: loadPricingConfig(), sources: src, send: okSend(), video: { prepare } })
    expect(prepare).toHaveBeenCalledTimes(1)
  })
```
(в `sources()` теста: `kitKeys` — `withVideo: new Set(), imagesOf: new Map()`, `ymKeys` — `withVideo: new Set()`.)
Run: `npx vitest run apps/worker/src/video` → FAIL; `npm run test:db -- packages/db/src/store-4.db.test.ts apps/worker/src/jobs/cards.db.test.ts` → FAIL.

- [ ] **Step 2: Реализация — сборка.** `apps/worker/src/video/hls.ts`:
```ts
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { stat } from "node:fs/promises"

/** Запуск внешней программы (ffmpeg, ffprobe, rsync); подменяется в тестах. */
export type Exec = (cmd: string, args: readonly string[], opts: { timeoutMs: number }) => Promise<{ stdout: string; stderr: string }>

export const execReal: Exec = (cmd, args, opts) =>
  new Promise((resolve, reject) => {
    execFile(cmd, [...args], { timeout: opts.timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(new Error(`${cmd}: ${err.message}${stderr ? ` — ${String(stderr).slice(-400)}` : ""}`)) : resolve({ stdout: String(stdout), stderr: String(stderr) }),
    )
  })

/** Пределы — общие для трёх площадок: Ozon 8 с – 5 мин и ≤ 2 ГБ (атрибут 21841), KIT ≤ 100 МБ (videos/from_url). */
export const VIDEO_MIN_SEC = 8
export const VIDEO_MAX_SEC = 300
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024
export const FFMPEG_TIMEOUT_MS = 180_000

export interface Mp4 {
  durationSec: number
  bytes: number
}

/** null — годится; иначе причина (в wb_card_videos.status = unfit, по этой ссылке WB больше не собирается). */
export function videoFits(v: Mp4): string | null {
  if (v.durationSec < VIDEO_MIN_SEC) return `видео ${v.durationSec} с — короче ${VIDEO_MIN_SEC} с (минимум Ozon)`
  if (v.durationSec > VIDEO_MAX_SEC) return `видео ${v.durationSec} с — длиннее ${VIDEO_MAX_SEC} с (максимум Ozon)`
  if (v.bytes > VIDEO_MAX_BYTES) return `видео ${Math.round(v.bytes / 1_048_576)} МБ — больше 100 МБ (предел KIT)`
  return null
}

/** HLS WB → mp4: сначала без перекодирования (быстро, без потерь), при отказе — H.264/AAC; длительность — ffprobe. */
export async function buildMp4(src: string, out: string, exec: Exec = execReal, sizeOf: (path: string) => Promise<number> = async (p) => (await stat(p)).size): Promise<Mp4> {
  const input = ["-hide_banner", "-loglevel", "error", "-y", "-protocol_whitelist", "file,http,https,tcp,tls,crypto", "-i", src]
  try {
    await exec("ffmpeg", [...input, "-c", "copy", "-bsf:a", "aac_adtstoasc", "-movflags", "+faststart", out], { timeoutMs: FFMPEG_TIMEOUT_MS })
  } catch {
    await exec("ffmpeg", [...input, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out], { timeoutMs: FFMPEG_TIMEOUT_MS })
  }
  const probe = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", out], { timeoutMs: 30_000 })
  const seconds = Number(probe.stdout.trim())
  if (!Number.isFinite(seconds)) throw new Error(`ffprobe: длительность не прочитана («${probe.stdout.trim()}»)`)
  return { durationSec: Math.round(seconds), bytes: await sizeOf(out) }
}

/** Артикул + 8 символов sha256 ссылки WB: новое видео — новое имя и новая ссылка (ЯМ не обновляет видео по старой). */
export function videoFileName(vendorCode: string, sourceUrl: string): string {
  const safe = vendorCode.replace(/[^A-Za-z0-9_-]/g, "_")
  return `${safe}-${createHash("sha256").update(sourceUrl).digest("hex").slice(0, 8)}.mp4`
}
```

- [ ] **Step 3: Реализация — публикация.** `apps/worker/src/video/publish.ts`:
```ts
import { mkdir, readdir, unlink } from "node:fs/promises"
import { join } from "node:path"
import { buildMp4, execReal, videoFits, type Exec } from "./hls"

export interface VideoConfig {
  /** `root@201.34.133.76:` — на сервере сайта ключ ограничен `rrsync -wo /var/www/media/video/`, путь — от этой папки. */
  rsyncTarget: string
  sshKey: string
  /** Публичная база ссылок: nginx kotelnikovartifact.ru, `location ^~ /video/`. */
  publicBase: string
  /** Где собираются файлы на VPS синка. */
  dir: string
}

/** Видео включается окружением; нет цели или ключа — выключено (джоба пишет счётчик videoDisabled). */
export function loadVideoConfig(env: Record<string, string | undefined>): VideoConfig | null {
  const rsyncTarget = env.SYNC2_VIDEO_RSYNC_TARGET?.trim()
  const sshKey = env.SYNC2_VIDEO_SSH_KEY?.trim()
  if (!rsyncTarget || !sshKey) return null
  const publicBase = (env.SYNC2_VIDEO_PUBLIC_BASE?.trim() || "https://kotelnikovartifact.ru/video").replace(/\/+$/, "")
  if (!publicBase.startsWith("https://")) throw new Error(`SYNC2_VIDEO_PUBLIC_BASE: только https — площадки берут видео по постоянной https-ссылке, получено ${publicBase}`)
  return { rsyncTarget, sshKey, publicBase, dir: env.SYNC2_VIDEO_DIR?.trim() || "/opt/sync2/media/video" }
}

export async function publishVideo(cfg: VideoConfig, localPath: string, fileName: string, exec: Exec = execReal): Promise<string> {
  await exec("rsync", ["-e", `ssh -i ${cfg.sshKey} -o BatchMode=yes -o StrictHostKeyChecking=yes`, "--chmod=F644", localPath, `${cfg.rsyncTarget}${fileName}`], { timeoutMs: 120_000 })
  return `${cfg.publicBase}/${fileName}`
}

/** Ссылка отдаёт файл: HEAD → 200 и video/mp4 (иначе площадка получит страницу, а не ролик). */
export async function checkPublicVideo(url: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const r = await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(30_000) })
  if (r.status !== 200) throw new Error(`видео ${url}: HEAD ${r.status}`)
  const type = r.headers.get("content-type") ?? ""
  if (!type.startsWith("video/mp4")) throw new Error(`видео ${url}: ${type || "без типа"} вместо video/mp4`)
}

export type PreparedVideo =
  | { status: "ready"; publicUrl: string; durationSec: number; bytes: number }
  | { status: "unfit"; reason: string; durationSec: number; bytes: number }

/** Собрать, проверить пределы, опубликовать, проверить ссылку; на VPS остаётся только последняя версия ролика артикула. */
export function createVideoWorker(cfg: VideoConfig, exec: Exec = execReal): { prepare: (source: string, fileName: string) => Promise<PreparedVideo> } {
  return {
    async prepare(source, fileName) {
      await mkdir(cfg.dir, { recursive: true })
      const local = join(cfg.dir, fileName)
      const mp4 = await buildMp4(source, local, exec)
      const unfit = videoFits(mp4)
      if (unfit) {
        await unlink(local).catch(() => undefined)
        return { status: "unfit", reason: unfit, ...mp4 }
      }
      const publicUrl = await publishVideo(cfg, local, fileName, exec)
      await checkPublicVideo(publicUrl)
      const prefix = fileName.replace(/-[0-9a-f]{8}\.mp4$/, "-")
      for (const f of await readdir(cfg.dir)) if (f.startsWith(prefix) && f !== fileName) await unlink(join(cfg.dir, f)).catch(() => undefined)
      return { status: "ready", publicUrl, ...mp4 }
    },
  }
}
```
`.env.example` — дописать:
```
# Видео карточек (этап 4): mp4 публикуются на сервер сайта; пусто — видео выключено
SYNC2_VIDEO_RSYNC_TARGET=root@201.34.133.76:
SYNC2_VIDEO_SSH_KEY=/root/.ssh/sync2_video
SYNC2_VIDEO_PUBLIC_BASE=https://kotelnikovartifact.ru/video
SYNC2_VIDEO_DIR=/opt/sync2/media/video
```

- [ ] **Step 4: Реализация — база.** `packages/db/src/cards-store.ts` — в импорт схемы добавить `wbCardVideos`, в конец:
```ts
export interface WbCardVideoRow {
  nmId: number
  sourceUrl: string
  fileName: string
  publicUrl: string | null
  status: "ready" | "failed" | "unfit"
  durationSec: number | null
  bytes: number | null
  error: string | null
  updatedAt?: string
}

export async function loadWbCardVideos(db: Db): Promise<Map<number, WbCardVideoRow>> {
  const rows = await db.select().from(wbCardVideos)
  return new Map(rows.map((r) => [r.nmId, { ...r, status: r.status as WbCardVideoRow["status"], updatedAt: toIso(r.updatedAt) }]))
}

export async function saveWbCardVideo(db: Db, v: Omit<WbCardVideoRow, "updatedAt">): Promise<void> {
  const row = { nmId: v.nmId, sourceUrl: v.sourceUrl, fileName: v.fileName, publicUrl: v.publicUrl, status: v.status, durationSec: v.durationSec, bytes: v.bytes, error: v.error }
  await db
    .insert(wbCardVideos)
    .values(row)
    .onConflictDoUpdate({ target: wbCardVideos.nmId, set: { ...row, updatedAt: sql`now()` } })
}
```

- [ ] **Step 5: Реализация — джоба.** `apps/worker/src/jobs/cards.ts`:
- импорты: из `@sync2/db` — `loadWbCardVideos`, `saveWbCardVideo`; из `@sync2/platforms` — `ozonHasVideo`, `ozonVideoAttributes`, `ymVideoMapping`, `type KitVideoPayload`; из `../video/hls` — `videoFileName`; из `../video/publish` — `type PreparedVideo`;
- константы и зависимость:
```ts
export const MAX_VIDEO_BUILDS_PER_RUN = 20
/** Неудачная сборка по той же ссылке WB повторяется не чаще раза в сутки (сеть, CDN); «не годится» — не повторяется. */
export const VIDEO_RETRY_MS = 24 * 3_600_000
```
в `CardsDeps`:
```ts
  /** Сборка и публикация видео (createVideoWorker); нет — видео выключено окружением (SYNC2_VIDEO_*). */
  video?: { prepare: (source: string, fileName: string) => Promise<PreparedVideo> }
```
- в шаге 8 (правки KIT): поля для записи контента — без видео, а изменившееся видео KIT — заменить сразу:
```ts
      const allFields = from ? [...new Set(diffCardContent(from, c).map((x) => x.field))] : [...CARD_FIELDS]
      if (allFields.includes("video")) kitVideoReplace.add(e.nmId)
      const fields = allFields.filter((f) => f !== "video")
```
(вместо строки `const fields = from ? … : [...CARD_FIELDS]`; перед шагом 8 — `const kitVideoReplace = new Set<number>()`), а ветка пустых полей — так:
```ts
      if (fields.length === 0) {
        // Изменилось то, что KIT не касается (ТН ВЭД) — синхронизировано без записи; изменилось только видео — заменит шаг 8d.
        if (!kitVideoReplace.has(e.nmId)) await setListingHashes(db, channels.get("kit")!.id, e.listings.map((l) => l.barcode), e.toHash)
        continue
      }
```
- в шаге 8b, в цикле по площадкам ответа `apply_edit`, после `hashesToSet.push(…)`:
```ts
      if (fields.includes("video")) for (const barcode of e.barcodes) videoWanted.push({ channel: e.channel, barcode, nmId: p.nmId, decisionId: d.id })
```
(перед шагом 8b — `const videoWanted: Array<{ channel: CardChannel; barcode: string; nmId: number; decisionId: number | null }> = []`);
- после шага 8c — шаг 8d:
```ts
  // 8d. Видео (решение 29.09 п. 2): mp4 из HLS WB → сервер сайта → первое видео туда, где его нет; замена — по ответу (Ozon/ЯМ) или сразу (KIT).
  if (!deps.video) {
    if (cards.some((c) => c.video !== null)) counters.videoDisabled = 1
  } else {
    // В off видео не планируется; в dry-run — только журнал (как остальные записи карточек).
    const editOnAll = (c: CardChannel) => effectiveMode(deps.globalMode, modes[c]) !== "off"
    const videos = await loadWbCardVideos(db)
    let built = 0
    const urlOf = new Map<number, string | null>()
    const readyUrl = async (c: WbCardContent): Promise<string | null> => {
      if (c.video === null) return null
      if (urlOf.has(c.nmId)) return urlOf.get(c.nmId)!
      const v = videos.get(c.nmId)
      const fresh = v !== undefined && v.sourceUrl === c.video
      if (fresh && v.status === "ready") return v.publicUrl
      if (fresh && (v.status === "unfit" || now.getTime() - Date.parse(v.updatedAt ?? nowIso) < VIDEO_RETRY_MS)) return null
      if (built >= MAX_VIDEO_BUILDS_PER_RUN) {
        add("videoBuildsDeferred")
        return null
      }
      built++
      const fileName = videoFileName(c.vendorCode, c.video)
      let url: string | null = null
      try {
        const r = await deps.video!.prepare(c.video, fileName)
        if (r.status === "ready") {
          url = r.publicUrl
          await saveWbCardVideo(db, { nmId: c.nmId, sourceUrl: c.video, fileName, publicUrl: r.publicUrl, status: "ready", durationSec: r.durationSec, bytes: r.bytes, error: null })
          add("videosBuilt")
        } else {
          await saveWbCardVideo(db, { nmId: c.nmId, sourceUrl: c.video, fileName, publicUrl: null, status: "unfit", durationSec: r.durationSec, bytes: r.bytes, error: r.reason })
          add("videosUnfit")
          problems.push(`видео nm ${c.nmId} не переносится: ${r.reason}`)
        }
      } catch (e: unknown) {
        await saveWbCardVideo(db, { nmId: c.nmId, sourceUrl: c.video, fileName, publicUrl: null, status: "failed", durationSec: null, bytes: null, error: errorText(e) })
        add("videosFailed")
        problems.push(`видео nm ${c.nmId} не собрано: ${errorText(e)} — повтор через сутки`)
      }
      urlOf.set(c.nmId, url)
      return url
    }
    const byNm = new Map(cards.map((c) => [c.nmId, c]))
    const active = (await loadCardListings(db, channels)).filter((l) => l.status === "active" && l.nmId !== null && byNm.get(l.nmId)?.video != null)
    // Присутствие видео — живьём: Ozon — атрибут 21841 полной карточки, ЯМ — mediaFiles.videos, KIT — media VIDEO.
    let ozonRows = new Map<string, OzonProductFull>()
    const ozonActive = active.filter((l) => l.channel === "ozon")
    if (ozonActive.length > 0 && keys.ozon) {
      try {
        ozonRows = await deps.sources.ozonProductsFull(ozonActive.map((l) => l.externalId))
      } catch (e: unknown) {
        problems.push(`Ozon: карточки для видео не прочитаны — ${errorText(e)}`)
      }
    }
    const hasVideo = (l: (typeof active)[number]): boolean | null => {
      if (l.channel === "ozon") return ozonRows.has(l.externalId) ? ozonHasVideo(ozonRows.get(l.externalId)!) : null
      if (l.channel === "ym") return ymKeys ? ymKeys.withVideo.has(l.externalId) : null
      return kitKeys ? kitKeys.withVideo.has(l.externalId) : null
    }
    const wanted = [
      ...active.filter((l) => hasVideo(l) === false).map((l) => ({ channel: l.channel, barcode: l.barcode, nmId: l.nmId!, decisionId: null as number | null, replace: false })),
      ...active.filter((l) => l.channel === "kit" && kitVideoReplace.has(l.nmId!) && hasVideo(l) === true).map((l) => ({ channel: l.channel, barcode: l.barcode, nmId: l.nmId!, decisionId: null as number | null, replace: true })),
      ...videoWanted.map((w) => ({ ...w, replace: true })),
    ]
    const seen = new Set<string>()
    for (const w of wanted) {
      const k = `${w.channel}\u0000${w.barcode}`
      if (seen.has(k) || !editOnAll(w.channel)) continue
      seen.add(k)
      const c = byNm.get(w.nmId) ?? allContent.get(w.nmId)
      const l = listingOf.get(k)
      if (!c || !l) continue
      const url = await readyUrl(c)
      if (!url) {
        if (w.decisionId !== null) answeredWork.delete(w.decisionId) // ответ ждёт готового видео — следующим прогоном
        continue
      }
      const payload =
        w.channel === "ozon"
          ? { attributes: ozonVideoAttributes(url, c.title), images: null }
          : w.channel === "ym"
            ? ymVideoMapping(l.externalId, url)
            : ({ videoUrl: url, images: kitKeys?.imagesOf.get(l.externalId) ?? [] } satisfies KitVideoPayload)
      ops.push({
        channel: w.channel,
        barcode: w.barcode,
        field: "card_video",
        before: null,
        after: hashToNumber(hashes.get(w.nmId)!),
        externalSku: l.externalId,
        card: { kind: "video", nmId: w.nmId, vendorCode: c.vendorCode, offerId: l.externalId, fields: w.replace ? ["video"] : [], payload, productRef: null, decisionId: w.decisionId },
      })
      add(`${w.channel}VideoPlanned`)
    }
  }
```
- в цикле итогов шага 9 — ветка видео:
```ts
    } else if (o.field === "card_video") {
      if (o.applied) {
        add(`${o.channel}VideoAttached`)
        // Замена видео KIT без вопроса — листинг синхронизирован (первое видео хеш не трогает: у Ozon/ЯМ могут ждать вопросы).
        if (o.channel === "kit" && o.card.decisionId === null && o.card.fields.length > 0) await setListingHashes(db, channelId, [o.barcode], hash)
      } else if (o.card.decisionId === null) problems.push(`${CHANNEL_LABELS[o.channel]}: видео ${o.card.offerId} не прикреплено — ${o.error ?? "итог неизвестен"}; повтор — следующим прогоном`)
    }
```
Первое видео (fields `[]`) не меняет хеш листинга: если у Ozon/ЯМ по карточке ждёт вопрос о правке, он не теряется; ответ «Применить» с полем «Видео» заменяет ролик (новая ссылка, новое имя файла).

`apps/worker/src/cli-cards.ts` — в `runCards({…})` после `send`:
```ts
          ...(videoCfg ? { video: createVideoWorker(videoCfg) } : {}),
```
где перед `withRun` — `const videoCfg = loadVideoConfig(env)` (импорт `createVideoWorker`, `loadVideoConfig` из `./video/publish`).

- [ ] **Step 6: Проверка и коммит.**
```bash
npx vitest run apps/worker/src/video && npm run test:db -- packages/db/src/store-4.db.test.ts apps/worker/src/jobs/cards.db.test.ts && npm run typecheck && npm test && npm run test:db
git add apps/worker/src/video packages/db/src/cards-store.ts packages/db/src/store-4.db.test.ts apps/worker/src/jobs/cards.ts apps/worker/src/jobs/cards.db.test.ts apps/worker/src/cli-cards.ts .env.example
git commit -m "sync2: карточки — видео: HLS WB → mp4 (ffmpeg) → сервер сайта (rsync под rrsync) → Ozon (комплекс 100001), ЯМ (videos), KIT (videos/from_url); не задерживает создание, пределы 8 с – 5 мин и 100 МБ"
```

---

### Task 14: Разведение многоразмерных карточек на варианты Ozon/ЯМ (п. 18) — вопрос и исполнение

**Files:**
- Modify: `packages/db/src/decisions.ts`, `apps/worker/src/jobs/cards.ts`, `apps/worker/src/jobs/cards.db.test.ts`, `packages/db/src/store-4.db.test.ts`

- [ ] **Step 1: Падающие тесты.** В `packages/db/src/store-4.db.test.ts` дописать:
```ts
import { answerDecision, declinedSplitNmIds, finishDecision, openDecisions } from "./decisions"

describe.skipIf(!TEST_DATABASE_URL)("этап 4: отказ от разведения размеров", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())
  it("«оставить один оффер» (skip_edit, done) по split:<nm> — карточка больше не спрашивается", async () => {
    const p = { nmId: 327127352, vendorCode: "JW-NB-AGT-M-0073", title: "t", toHash: "h", channels: [], sizeSplit: { keep: [], create: [] } }
    await openDecisions(h.db, [{ kind: "card_edit", subject: "split:327127352", payload: p }, { kind: "card_edit", subject: "edit:702062898", payload: { ...p, nmId: 702062898, sizeSplit: null } }], null)
    const [s, e] = [1, 2]
    await answerDecision(h.db, s, "skip_edit", { id: 1, name: "Минас" }, "2026-10-12T16:20:00.000Z")
    await finishDecision(h.db, s, "done", "оставлен один оффер", "2026-10-12T17:19:00.000Z", ["answered"])
    await answerDecision(h.db, e, "skip_edit", { id: 1, name: "Минас" }, "2026-10-12T16:20:00.000Z")
    await finishDecision(h.db, e, "done", "не применено", "2026-10-12T17:19:00.000Z", ["answered"])
    expect(await declinedSplitNmIds(h.db)).toEqual(new Set([327127352]))
  })
})
```
В `apps/worker/src/jobs/cards.db.test.ts` дописать:
```ts
  it("многоразмерная с оффером одного размера: вопрос о разведении; «развести» — создаются новые размеры и группа у существующего", async () => {
    await mode("ozon", "apply")
    await mode("ym", "off")
    await mode("kit", "off")
    await h.db.insert(products).values({ barcode: "2042770600712", vendorCode: "JW-NB-AGT-M-0073", nmId: 327127352, title: "Браслет Синергия", wbSubject: "Браслеты" })
    await h.db.insert(poolItems).values({ barcode: "2042770600712", base: 2, wbExpected: 2 })
    const multi = card({
      nmId: 327127352,
      vendorCode: "JW-NB-AGT-M-0073",
      subject: "Браслеты",
      title: "Браслет Синергия v4",
      sizes: [
        { chrtId: 1, techSize: "19", wbSize: "1", barcodes: ["2042770600705"] },
        { chrtId: 2, techSize: "20", wbSize: "2", barcodes: ["2042770600712"] },
      ],
    })
    const dict = vi.fn(async (q: { attributeId: number; value: string }) => (q.attributeId === 5326 ? Number(q.value) * 1000 : null))
    const src = { ...sources([multi]), ozonDict: dict }
    const runId1 = await nextRun()
    await runCards({ db: h.db, now: () => NOW, runId: runId1, globalMode: "apply", categories: loadCardCategories(), pricing: loadPricingConfig(), sources: src, send: okSend() })
    const split = (await activeDecisionsOfKind(h.db, "card_edit")).filter(isCardEditDecision).find((d) => d.subject === "split:327127352")!
    expect(split.payload.sizeSplit).toEqual({
      keep: [{ channel: "ozon", offerId: "JW-NB-AGT-M-0073", barcode: "2042770600705", size: "19" }],
      create: [{ channel: "ozon", offerId: "JW-NB-AGT-M-0073-20", barcode: "2042770600712", size: "20", stock: 2 }],
    })
    await answerDecision(h.db, split.id, "apply_edit", { id: 1, name: "Минас" }, NOW.toISOString())
    const runId2 = await nextRun()
    const send = okSend()
    await runCards({ db: h.db, now: () => NOW, runId: runId2, globalMode: "apply", categories: loadCardCategories(), pricing: loadPricingConfig(), sources: src, send })
    const ozonOps = send.mock.calls.filter((c) => c[0] === "ozon").flatMap((c) => c[1])
    const create = ozonOps.find((o) => o.field === "card_create")!
    expect(create.card!.offerId).toBe("JW-NB-AGT-M-0073-20")
    const attrs = (create.card!.payload as { item: { attributes: Array<{ id: number; values: unknown[] }> } }).item.attributes
    expect(attrs.find((a) => a.id === 5326)!.values).toEqual([{ dictionary_value_id: 20000 }])
    expect(attrs.find((a) => a.id === 9048)!.values).toEqual([{ value: "JW-NB-AGT-M-0073" }])
    const group = ozonOps.find((o) => o.field === "card_content" && o.card!.kind === "group")!
    expect(group.barcode).toBe("2042770600705")
    expect((group.card!.payload as { attributes: unknown }).attributes).toEqual([
      { id: 9048, values: [{ value: "JW-NB-AGT-M-0073" }] },
      { id: 5326, values: [{ dictionary_value_id: 19000 }] },
    ])
    expect((await decisionById(h.db, split.id))!).toMatchObject({ status: "done" })
    const [created] = await h.db.select().from(listings).where(eq(listings.externalId, "JW-NB-AGT-M-0073-20"))
    expect(created).toMatchObject({ status: "pending" })
  })
```
Run: `npm run test:db -- packages/db/src/store-4.db.test.ts apps/worker/src/jobs/cards.db.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `packages/db/src/decisions.ts` — в конец:
```ts
/** Карточки, где на вопрос о разведении размеров ответили «оставить один оффер» (п. 18): больше не спрашиваются. */
export async function declinedSplitNmIds(db: Db): Promise<Set<number>> {
  const rows = await db
    .select({ payload: decisions.payload })
    .from(decisions)
    .where(and(eq(decisions.kind, "card_edit"), eq(decisions.answer, "skip_edit"), eq(decisions.status, "done"), sql`${decisions.subject} like 'split:%'`))
  return new Set(rows.map((r) => (r.payload as { nmId: number }).nmId))
}
```
(в импорт из `drizzle-orm` добавить `sql`).

`apps/worker/src/jobs/cards.ts`:
- импорты: из `@sync2/db` — `declinedSplitNmIds`; из `@sync2/platforms` — `ozonGroupAttributes`, `ymGroupMapping`;
- в шаге 4 вместо `declinedSplits: new Set()`:
```ts
    declinedSplits: new Set([...(await declinedSplitNmIds(db))].flatMap((n) => [`ozon:${n}`, `ym:${n}`])),
```
- в шаге 8b, в ветке `if (p.sizeSplit) { answeredWork.set(d.id, d); continue }` — заменить на исполнение разведения:
```ts
    if (p.sizeSplit) {
      const s = p.sizeSplit
      const chsInSplit = [...new Set(s.create.map((x) => x.channel))]
      if (chsInSplit.some((ch) => !editOn(ch))) {
        problems.push(`ответ на вопрос #${d.id} (размеры nm ${p.nmId}) ждёт apply карточек площадки — card-mode … apply --confirm`)
        continue
      }
      const route = routes.get(p.nmId) ?? routeCard(deps.categories, c)
      let broken = false
      for (const k of s.keep) {
        if (k.size === null) continue
        if (k.channel === "ozon") {
          const r = route.ozon
          const dictId = r.ok ? await deps.sources.ozonDict({ categoryId: r.route.categoryId, typeId: r.route.typeId, attributeId: 5326, value: k.size }) : null
          if (dictId === null) {
            broken = true
            await finishDecision(db, d.id, "failed", `размер «${k.size}» не найден в словаре Ozon (5326) — разведение не выполнено`, nowIso, ["answered"])
            break
          }
          ops.push({
            channel: "ozon",
            barcode: k.barcode,
            field: "card_content",
            before: null,
            after: hashToNumber(p.toHash),
            externalSku: k.offerId,
            card: { kind: "group", nmId: p.nmId, vendorCode: c.vendorCode, offerId: k.offerId, fields: ["sizes"], payload: { attributes: ozonGroupAttributes(c.vendorCode, dictId), images: null }, productRef: null, decisionId: d.id },
          })
        } else {
          const r = route.ym
          const sizeParamId = r.ok ? r.route.sizeParamId : null
          const category = ymKeys?.categoryOf.get(k.offerId) ?? (r.ok ? r.route.marketCategoryId : null)
          if (sizeParamId === null || category === null) {
            broken = true
            await finishDecision(db, d.id, "failed", "у категории ЯМ нет характеристики размера — разведение не выполнено", nowIso, ["answered"])
            break
          }
          ops.push({
            channel: "ym",
            barcode: k.barcode,
            field: "card_content",
            before: null,
            after: hashToNumber(p.toHash),
            externalSku: k.offerId,
            card: { kind: "group", nmId: p.nmId, vendorCode: c.vendorCode, offerId: k.offerId, fields: ["sizes"], payload: ymGroupMapping(k.offerId, category, sizeParamId, c.vendorCode, k.size), productRef: null, decisionId: d.id },
          })
        }
      }
      if (broken) continue
      for (const x of s.create) {
        const op = await buildCreateOp({ channel: x.channel, nmId: p.nmId, barcode: x.barcode, offerId: x.offerId, size: x.size, multiSize: true, stock: x.stock }, d.id)
        if (op) ops.push(op)
      }
      answeredWork.set(d.id, d)
      continue
    }
```
- после шага 8b (вопросы о правках) — вопросы о разведении:
```ts
  for (const sp of plan.splits) {
    if (!editOn(sp.channel)) continue
    const c = contentOf.get(sp.nmId)!
    const subject = `split:${sp.nmId}`
    const both = plan.splits.filter((x) => x.nmId === sp.nmId && editOn(x.channel))
    if (both[0] !== sp) continue // один вопрос на карточку для обеих площадок
    const n = await openDecisions(
      db,
      [
        {
          kind: "card_edit",
          subject,
          payload: {
            nmId: sp.nmId,
            vendorCode: c.vendorCode,
            title: c.title,
            toHash: hashes.get(sp.nmId)!,
            channels: [],
            sizeSplit: {
              keep: both.flatMap((x) => x.keep.map((k) => ({ channel: x.channel, offerId: k.offerId, barcode: k.barcode, size: k.size }))),
              create: both.flatMap((x) => x.create.map((k) => ({ channel: x.channel, offerId: k.offerId, barcode: k.barcode, size: k.size, stock: k.stock }))),
            },
          },
        },
      ],
      deps.runId,
    )
    if (n > 0) add("cardSplitQuestions")
  }
```
Создания разведения идут той же записью, что остальные; их итог по листингам (pending/failed) обрабатывает общий цикл шага 9 (`card_create` — независимо от `decisionId`), а итог вопроса — цикл «итоги вопросов» из Task 11 (все операции с `decisionId` = вопросу). Хеш существующего листинга не меняется: разведение — не правка контента.

- [ ] **Step 3: Проверка и коммит.**
```bash
npm run test:db -- packages/db/src/store-4.db.test.ts apps/worker/src/jobs/cards.db.test.ts && npm run typecheck && npm test && npm run test:db
git add packages/db/src/decisions.ts packages/db/src/store-4.db.test.ts apps/worker/src/jobs/cards.ts apps/worker/src/jobs/cards.db.test.ts
git commit -m "sync2: карточки — разведение размеров Ozon/ЯМ вопросом: оффер с продажами остаётся размером, новые размеры создаются вариантами (9048+5326, группа 200+размер), «оставить один» — навсегда"
```

---

### Task 15: Часы и другие предметы без ставки — живая ставка ЯМ из тарифов, цена Ozon до первой живой ставки (решение 29.09 п. 5)

**Files:**
- Create: `packages/domain/src/live-take.ts`, `packages/domain/src/live-take.test.ts`
- Modify: `packages/domain/src/index.ts`, `packages/db/src/sync-state.ts`, `apps/worker/src/jobs/cards.ts`, `apps/worker/src/jobs/cards.db.test.ts`, `apps/worker/src/jobs/prices.ts`, `apps/worker/src/cli-cards.ts`

**Зачем.** В `config/pricing.json` у «Часы наручные» `take_ozon` и `take_ym` — `null`: `mirrorPrices` отдаёт `no-ozon-rate`/`no-ym-rate`, и ни создание, ни джоба `prices` цену не поставят. Решение 29.09 п. 5: цена ведётся по живой ставке площадки. Ozon: джоба `prices` этапа 2 уже берёт живую ставку товара (`ozonTakeBp` из `v5/product/info/prices`), но она есть только у созданного товара — цена создания считается по наибольшей ставке Ozon в конфиге (55 %: цена не ниже нужной), первая же `prices` после модерации ставит цену по живой ставке. ЯМ: живой ставки у оффера нет — ставка предмета берётся из `tariffs/calculate` (FEE + перевод платежа; доставку 5 % добавляет домен этапа 2), кешируется в `sync_state` на 7 дней и подхватывается джобой `prices`.

- [ ] **Step 1: Падающие тесты.** `packages/domain/src/live-take.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { maxOzonTakeBp, ratesWithLive } from "./live-take"

describe("ставки предмета без ставки в конфиге", () => {
  const watch = { takeWbBp: 5000, takeOzonBp: null, takeYmBp: null }
  it("живая ставка ЯМ подставляется только вместо null; Ozon — запасная только если задана", () => {
    expect(ratesWithLive(watch, 5330, 5500)).toEqual({ takeWbBp: 5000, takeOzonBp: 5500, takeYmBp: 5330 })
    expect(ratesWithLive(watch, null, null)).toEqual(watch)
    expect(ratesWithLive({ takeWbBp: 4400, takeOzonBp: 5500, takeYmBp: 5280 }, 6000, 9000)).toEqual({ takeWbBp: 4400, takeOzonBp: 5500, takeYmBp: 5280 })
    expect(ratesWithLive(null, 5330, 5500)).toBeNull()
  })
  it("наибольшая ставка Ozon из конфига; нет ни одной — null", () => {
    expect(maxOzonTakeBp(new Map([["a", { takeWbBp: 1, takeOzonBp: 5200, takeYmBp: null }], ["b", { takeWbBp: 1, takeOzonBp: 5500, takeYmBp: null }], ["c", watch]]))).toBe(5500)
    expect(maxOzonTakeBp(new Map([["c", watch]]))).toBeNull()
  })
})
```
В `apps/worker/src/jobs/cards.db.test.ts` дописать:
```ts
  it("часы: цена ЯМ — по ставке из тарифов (кеш в sync_state), Ozon — по наибольшей ставке конфига; ТН ВЭД Ozon — из WB словарём", async () => {
    await mode("ozon", "dry-run")
    await mode("ym", "dry-run")
    await h.db.insert(products).values({ barcode: "2044245185854", vendorCode: "6565542", nmId: 431548944, title: "Часы", wbSubject: "Часы наручные" })
    await h.db.insert(poolItems).values({ barcode: "2044245185854", base: 1, wbExpected: 1 })
    await h.db.insert(agreedPrices).values({ nmId: 431548944, barcode: "2044245185854", priceMinor: 2000000, source: "cli", approvedBy: "test" })
    const watch = card({
      nmId: 431548944,
      vendorCode: "6565542",
      subject: "Часы наручные",
      title: "Часы наручные женские с метеоритом Муонионалуста, подарок",
      characteristics: [{ id: 15004139, name: "Код ТН ВЭД", values: ["9102110000"] }, { id: 14177451, name: "Страна производства", values: ["Китай"] }],
      dimensions: { lengthCm: 20, widthCm: 15, heightCm: 4, weightKg: 0.5 },
      sizes: [{ chrtId: 1, techSize: "0", wbSize: "", barcodes: ["2044245185854"] }],
    })
    const ymTakeBp = vi.fn(async () => 5330)
    const src: CardSources = { ...sources([watch]), ymTakeBp, ozonDict: async (q) => (q.attributeId === 22232 ? 971500001 : q.attributeId === 4389 ? 90296 : null) }
    const runId = await nextRun()
    await runCards({ db: h.db, now: () => NOW, runId, globalMode: "apply", categories: loadCardCategories(), pricing: loadPricingConfig(), sources: src, send: okSend() })
    const rows = await h.db.select().from(writes).where(eq(writes.runId, runId))
    const ymId = (await loadChannels(h.db)).get("ym")!.id
    const ym = rows.find((w) => w.field === "card_create" && w.channelId === ymId && w.barcode === "2044245185854")!
    expect((ym.detail as { payload: { offer: { marketCategoryId: number; basicPrice: { value: number } } } }).payload.offer.marketCategoryId).toBe(91259)
    const oz = rows.find((w) => w.field === "card_create" && w.externalSku === "6565542" && (w.detail as { payload: { item?: unknown } }).payload.item)!
    const item = (oz.detail as { payload: { item: { description_category_id: number; attributes: Array<{ id: number; values: unknown[] }> } } }).payload.item
    expect(item.description_category_id).toBe(17027904)
    expect(item.attributes.find((a) => a.id === 22232)!.values).toEqual([{ dictionary_value_id: 971500001 }])
    expect(ymTakeBp).toHaveBeenCalledWith({ categoryId: 91259, priceMinor: 2000000, dims: { lengthCm: 20, widthCm: 15, heightCm: 4, weightKg: 0.5 } })
    expect(await getState(h.db, YM_LIVE_TAKE_KEY)).toMatchObject({ "Часы наручные": { takeBp: 5330, categoryId: 91259 } })
    // Второй прогон — ставка из кеша, тарифы не спрашиваются.
    await runCards({ db: h.db, now: () => NOW, runId: await nextRun(), globalMode: "apply", categories: loadCardCategories(), pricing: loadPricingConfig(), sources: src, send: okSend() })
    expect(ymTakeBp).toHaveBeenCalledTimes(1)
  })
```
(в импорт теста из `@sync2/db` — `YM_LIVE_TAKE_KEY`; в `sources()` теста — `ymTakeBp: async () => null`.)
Run: `npx vitest run packages/domain/src/live-take.test.ts` → FAIL; `npm run test:db -- apps/worker/src/jobs/cards.db.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `packages/domain/src/live-take.ts`:
```ts
import type { SubjectRates } from "./pricing"

/**
 * Ставки предмета с живыми значениями вместо null конфига (решение 29.09 п. 5): ЯМ — ставка из тарифов API
 * (FEE + перевод платежа), Ozon — запасная ставка только для цены создания (наибольшая в конфиге) до первой живой
 * ставки товара. Заданные в конфиге ставки не подменяются.
 */
export function ratesWithLive(base: SubjectRates | null, liveYmBp: number | null, fallbackOzonBp: number | null): SubjectRates | null {
  if (!base) return null
  return {
    takeWbBp: base.takeWbBp,
    takeOzonBp: base.takeOzonBp ?? fallbackOzonBp,
    takeYmBp: base.takeYmBp ?? liveYmBp,
  }
}

/** Наибольшая ставка Ozon в конфиге — цена создания товара без своей ставки заведомо не ниже нужной. */
export function maxOzonTakeBp(rates: ReadonlyMap<string, SubjectRates>): number | null {
  let max: number | null = null
  for (const r of rates.values()) if (r.takeOzonBp !== null && (max === null || r.takeOzonBp > max)) max = r.takeOzonBp
  return max
}
```
`packages/domain/src/index.ts` — `export * from "./live-take"`.

`packages/db/src/sync-state.ts` — добавить:
```ts
/** Живая ставка ЯМ по предмету без ставки в config/pricing.json (часы): тарифы API, кеш на 7 дней (этап 4). */
export const YM_LIVE_TAKE_KEY = "ym-live-take"
export type YmLiveTakes = Record<string, { takeBp: number; at: string; categoryId: number }>
```

`apps/worker/src/jobs/cards.ts`:
- импорты: из `@sync2/domain` — `maxOzonTakeBp`, `ratesWithLive`; из `@sync2/db` — `getState`, `YM_LIVE_TAKE_KEY`, `type YmLiveTakes`; из `@sync2/shared` — `type WbDimensions`;
- в `CardSources`: `ymTakeBp: (q: { categoryId: number; priceMinor: number; dims: WbDimensions | null }) => Promise<number | null>`;
- константа: `export const YM_LIVE_TAKE_TTL_MS = 7 * 86_400_000`;
- `ratesFor` из Task 10 — заменить целиком:
```ts
  const liveYm: YmLiveTakes = (await getState<YmLiveTakes>(db, YM_LIVE_TAKE_KEY)) ?? {}
  const maxOzon = maxOzonTakeBp(deps.pricing.rates)
  const ratesFor = async (c: WbCardContent, route: CardRoute, priceMinor: number): Promise<SubjectRates | null> => {
    const base = deps.pricing.rates.get(c.subject) ?? null
    if (!base) return null
    let ym = base.takeYmBp
    if (ym === null && route.ym.ok) {
      const cached = liveYm[c.subject]
      if (cached && now.getTime() - Date.parse(cached.at) < YM_LIVE_TAKE_TTL_MS) ym = cached.takeBp
      else {
        try {
          ym = await deps.sources.ymTakeBp({ categoryId: route.ym.route.marketCategoryId, priceMinor, dims: c.dimensions })
          if (ym !== null) {
            liveYm[c.subject] = { takeBp: ym, at: nowIso, categoryId: route.ym.route.marketCategoryId }
            await setState(db, YM_LIVE_TAKE_KEY, liveYm)
            add("ymLiveTakeRead")
          }
        } catch (e: unknown) {
          problems.push(`ЯМ: ставка из тарифов для «${c.subject}» не прочитана — ${errorText(e)}`)
        }
      }
    }
    return ratesWithLive(base, ym, maxOzon)
  }
```
(вызов в `buildCreateOp` — `rates: await ratesFor(c, route, a.priceMinor)` — уже такой с Task 10).

`apps/worker/src/jobs/prices.ts` (этап 2) — живая ставка ЯМ для предметов без ставки:
- импорты: `getState`, `YM_LIVE_TAKE_KEY`, `type YmLiveTakes` из `@sync2/db`; `ratesWithLive` из `@sync2/domain`;
- после `const sppBp = await activeSpp(db)`:
```ts
  // Предметы без ставки ЯМ в конфиге (часы) — ставка из тарифов, которую держит джоба cards (этап 4, решение 29.09 п. 5).
  const liveYm = (await getState<YmLiveTakes>(db, YM_LIVE_TAKE_KEY)) ?? {}
```
- строку `const rates = subject ? (config.rates.get(subject) ?? null) : null` заменить на:
```ts
      const rates = subject ? ratesWithLive(config.rates.get(subject) ?? null, liveYm[subject]?.takeBp ?? null, null) : null
```
(Ozon здесь запасной ставки не получает: у созданного товара есть живая `ozonTakeBp`.)

`apps/worker/src/cli-cards.ts` — в `sources`: `ymTakeBp: (q) => fetchYmTakeBp(ch.ym, q),` (импорт `fetchYmTakeBp`).

- [ ] **Step 3: Проверка и коммит.**
```bash
npx vitest run packages/domain/src/live-take.test.ts && npm run test:db -- apps/worker/src/jobs/cards.db.test.ts apps/worker/src/jobs/prices.db.test.ts && npm run typecheck && npm test && npm run test:db
git add packages/domain/src/live-take.ts packages/domain/src/live-take.test.ts packages/domain/src/index.ts packages/db/src/sync-state.ts apps/worker/src/jobs/cards.ts apps/worker/src/jobs/cards.db.test.ts apps/worker/src/jobs/prices.ts apps/worker/src/cli-cards.ts
git commit -m "sync2: часы — ставка ЯМ из тарифов API (кеш 7 дней, подхватывает prices), цена создания Ozon по наибольшей ставке до живой ставки товара"
```

---

### Task 16: Блок «🗂 Карточки» в суточной сводке, крон, README

**Files:**
- Create: `apps/worker/src/jobs/card-summary.ts`, `apps/worker/src/jobs/card-summary.test.ts`
- Modify: `apps/worker/src/jobs/drift.ts`, `deploy/crontab.sync2.txt`, `deploy/README.md`, `README.md`

- [ ] **Step 1: Падающий тест.** `apps/worker/src/jobs/card-summary.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { formatCardSummary } from "./card-summary"

describe("блок «Карточки» сводки", () => {
  it("режимы, созданные за сутки, ожидающие/отклонённые, пропуски по причинам, вопросы", () => {
    const t = formatCardSummary({
      modes: { ozon: "apply", ym: "dry-run", kit: "apply" },
      globalMode: "apply",
      lastRunAgeH: 1,
      lastRunStatus: "partial",
      created24h: { ozon: 2, ym: 0, kit: 3 },
      failed24h: { ozon: 1, ym: 0, kit: 0 },
      pending: 2,
      pendingStale: 1,
      rejected: 1,
      skipsByReason: [["нет прайса — ответьте на вопрос «товар без прайса» (этап 2); карточка создастся следующим прогоном", 4], ["оффер 2051508626795 в архиве площадки — вернуть из архива вручную, синк заново не создаёт", 1]],
      questionsOpen: 3,
      questionsAnswered: 1,
      rejectedOpen: 1,
      videoDisabled: false,
      videosFailed: 2,
      massStopped: null,
    })
    expect(t).toContain("🗂 Карточки")
    expect(t).toContain("Создано за сутки: Ozon 2, ЯМ 0, KIT 3; отклонено: Ozon 1")
    expect(t).toContain("⚠️ не появились на площадке за 24 ч: 1")
    expect(t).toContain("Не выложены: 5 — нет прайса")
    expect(t).toContain("Вопросы Ozon/ЯМ: без ответа 3, ждут исполнения 1; ⛔ отказов модерации без отметки: 1")
    expect(t).toContain("Видео: ⚠️ не собрано в последнем прогоне: 2")
    expect(t).toContain("Режим записи карточек: Ozon apply, ЯМ dry-run, KIT apply")
  })

  it("cards не запускался — пометка", () => {
    expect(formatCardSummary({ modes: { ozon: "off", ym: "off", kit: "off" }, globalMode: "dry-run", lastRunAgeH: null, lastRunStatus: null, created24h: { ozon: 0, ym: 0, kit: 0 }, failed24h: { ozon: 0, ym: 0, kit: 0 }, pending: 0, pendingStale: 0, rejected: 0, skipsByReason: [], questionsOpen: 0, questionsAnswered: 0, rejectedOpen: 0, videoDisabled: false, videosFailed: 0, massStopped: null })).toContain(
      "⚠️ cards ещё не запускался",
    )
  })
})
```
Run: `npx vitest run apps/worker/src/jobs/card-summary.test.ts` → FAIL.

- [ ] **Step 2: Реализация.** `apps/worker/src/jobs/card-summary.ts`:
```ts
import { activeDecisions, getState, latestRun, loadCardListings, loadChannels, writeStatsSince, type Db } from "@sync2/db"
import { errorText, type WriteMode } from "@sync2/shared"
import { CARDS_JOB, CARDS_PLAN_KEY, PENDING_ALERT_MS, type CardsPlanSummary } from "./cards"

type ByCh = { ozon: number; ym: number; kit: number }
export interface CardSummary {
  modes: { ozon: WriteMode; ym: WriteMode; kit: WriteMode }
  globalMode: WriteMode
  lastRunAgeH: number | null
  lastRunStatus: string | null
  created24h: ByCh
  failed24h: ByCh
  pending: number
  pendingStale: number
  rejected: number
  skipsByReason: Array<[string, number]>
  questionsOpen: number
  questionsAnswered: number
  /** Вопросы card_rejected без отметки «Принято». */
  rejectedOpen: number
  /** Видео выключено окружением (SYNC2_VIDEO_*), а у карточек оно есть. */
  videoDisabled: boolean
  videosFailed: number
  massStopped: number | null
}

const LBL = { ozon: "Ozon", ym: "ЯМ", kit: "KIT" } as const
const byCh = (x: ByCh) => (["ozon", "ym", "kit"] as const).map((c) => `${LBL[c]} ${x[c]}`).join(", ")

/** Блок «Карточки» суточной сводки drift — счётчики и причины, без рекомендаций. */
export function formatCardSummary(s: CardSummary): string {
  if (s.lastRunAgeH === null) return "🗂 Карточки\n⚠️ cards ещё не запускался"
  const failed = (["ozon", "ym", "kit"] as const).filter((c) => s.failed24h[c] > 0).map((c) => `${LBL[c]} ${s.failed24h[c]}`)
  const skips = s.skipsByReason.reduce((n, [, k]) => n + k, 0)
  return [
    "🗂 Карточки",
    `Последний прогон ${s.lastRunAgeH} ч назад (${s.lastRunStatus ?? "?"})${s.massStopped ? `; ⚠️ массовая правка WB — ${s.massStopped} карточек ждут решения (cards baseline / --allow-mass)` : ""}`,
    `Создано за сутки: ${byCh(s.created24h)}${failed.length > 0 ? `; отклонено: ${failed.join(", ")}` : ""}`,
    ...(s.pending > 0 ? [`Ждут появления на площадке: ${s.pending}${s.pendingStale > 0 ? `; ⚠️ не появились на площадке за 24 ч: ${s.pendingStale}` : ""}`] : []),
    ...(s.rejected > 0 ? [`Отклонены площадкой (повтор — cards retry): ${s.rejected}`] : []),
    ...(skips > 0 ? [`Не выложены: ${skips} — ${s.skipsByReason.slice(0, 3).map(([r, k]) => `${r.split(" — ")[0]} (${k})`).join("; ")}`] : []),
    `Вопросы Ozon/ЯМ: без ответа ${s.questionsOpen}, ждут исполнения ${s.questionsAnswered}${s.rejectedOpen > 0 ? `; ⛔ отказов модерации без отметки: ${s.rejectedOpen}` : ""}`,
    ...(s.videoDisabled ? ["Видео: ⚠️ выключено (нет SYNC2_VIDEO_* в .env)"] : s.videosFailed > 0 ? [`Видео: ⚠️ не собрано в последнем прогоне: ${s.videosFailed}`] : []),
    `Режим записи карточек: ${(["ozon", "ym", "kit"] as const).map((c) => `${LBL[c]} ${s.modes[c]}`).join(", ")}${s.globalMode !== "apply" ? ` (SYNC_WRITE_MODE=${s.globalMode} ⚠️)` : ""}`,
  ].join("\n")
}

export async function loadCardSummary(db: Db, now: Date, globalMode: WriteMode): Promise<CardSummary> {
  const chs = await loadChannels(db)
  const run = await latestRun(db, CARDS_JOB)
  const since = new Date(now.getTime() - 86_400_000).toISOString()
  const stats = await writeStatsSince(db, since, "card_create")
  const listings = await loadCardListings(db, chs)
  const plan = await getState<CardsPlanSummary>(db, CARDS_PLAN_KEY)
  const reasons = new Map<string, number>()
  for (const s of plan?.skips ?? []) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1)
  const all = await activeDecisions(db)
  const active = all.filter((d) => d.kind === "card_edit")
  const counter = (k: string) => (run && typeof run.counters[k] === "number" ? (run.counters[k] as number) : 0)
  const staleEdge = now.getTime() - PENDING_ALERT_MS
  return {
    modes: { ozon: chs.get("ozon")?.cardWriteMode ?? "off", ym: chs.get("ym")?.cardWriteMode ?? "off", kit: chs.get("kit")?.cardWriteMode ?? "off" },
    globalMode,
    lastRunAgeH: run ? Math.round((now.getTime() - Date.parse(run.startedAt)) / 3_600_000) : null,
    lastRunStatus: run?.status ?? null,
    created24h: { ozon: stats.ozon.applied, ym: stats.ym.applied, kit: stats.kit.applied },
    failed24h: { ozon: stats.ozon.failed, ym: stats.ym.failed, kit: stats.kit.failed },
    pending: listings.filter((l) => l.status === "pending").length,
    pendingStale: listings.filter((l) => l.status === "pending" && Date.parse(l.updatedAt) < staleEdge).length,
    rejected: listings.filter((l) => l.status === "failed").length,
    skipsByReason: [...reasons].sort((a, b) => b[1] - a[1]),
    questionsOpen: active.filter((d) => d.status === "open").length,
    questionsAnswered: active.filter((d) => d.status === "answered").length,
    rejectedOpen: all.filter((d) => d.kind === "card_rejected" && d.status === "open").length,
    videoDisabled: counter("videoDisabled") > 0,
    videosFailed: counter("videosFailed"),
    massStopped: plan?.massStopped ?? null,
  }
}

/** Сбой сбора блока не роняет сводку — пометка вместо блока. */
export async function safeCardBlock(load: () => Promise<string>): Promise<string> {
  try {
    return await load()
  } catch (e: unknown) {
    return `🗂 Карточки: не удалось собрать — ${errorText(e)}`
  }
}
```
`apps/worker/src/jobs/drift.ts`:
- импорт: `import { formatCardSummary, loadCardSummary, safeCardBlock } from "./card-summary"`;
- после строки `const stale = await guardStaleBlock(db, now)`:
```ts
  // Блок «🗂 Карточки» (этап 4) — после «Защит», не обрезается.
  const cardsBlock = await safeCardBlock(async () => formatCardSummary(await loadCardSummary(db, now, deps.globalMode)))
```
- в `joinSummaryBlocks(…)` второй аргумент — `` `${prices}\n\n${guards}${stale ? `\n${stale}` : ""}\n\n${cardsBlock}` ``.

`deploy/crontab.sync2.txt` — перед `# <<< sync2`:
```
# карточки: создания на Ozon/ЯМ/KIT, правки KIT, видео, вопросы Ozon/ЯМ и исполнение ответов — раз в час в :19 (мимо тика 1,6,…,56,
# цен 4/34, «Хочу скидку» 14/44, старого orders 3,8,…); режим — card-mode <площадка>, по умолчанию off.
19 * * * * cd /opt/sync2 && flock -w 240 /tmp/sync2.lock timeout 9m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts cards run >> logs/cards.log 2>&1
```
`deploy/README.md` — раздел «Этап 4 — карточки»: предусловия (шаг B 1.4, этап 2 выложен, бот включён); выкладка; `ffmpeg` (`apt-get install ffmpeg`) и ключ публикации видео (`rrsync -wo /var/www/media/video/` на сервере сайта, `SYNC2_VIDEO_*` в `.env`); `card-mode … dry-run` → `cards run` → `cards plan`; первый боевой прогон по одной карточке и площадке (`cards run --only=<артикул> --channel=kit --confirm`); строка крона вставкой (как этап 3: копия `logs/crontab.before-4.txt`, проверка `grep -q 'cli.ts cards run'`); откат — `card-mode <площадка> off`, строка крона `#`; разведение размеров — вопросами в группе. `README.md` — строки про джобу `cards`, видео (`apps/worker/src/video`), `config/card-categories.json` и команды `cards`/`card-mode`.

- [ ] **Step 3: Проверка и коммит.**
```bash
npx vitest run apps/worker/src/jobs/card-summary.test.ts apps/worker/src/jobs/drift.test.ts && npm run typecheck && npm test && npm run test:db
git add apps/worker/src/jobs/card-summary.ts apps/worker/src/jobs/card-summary.test.ts apps/worker/src/jobs/drift.ts deploy/crontab.sync2.txt deploy/README.md README.md
git commit -m "sync2: этап 4 — блок «Карточки» в суточной сводке, крон cards :19, README"
```
Затем ревью этапа (`superpowers:requesting-code-review`, диапазон `sync2-stage-3..sync2-stage-4`).

---
## Часть D — в бой (каждый внешний шаг — «да» владельца)

**Предусловия (все — до Task 17):** шаг B этапа 1.4 выполнен (пул пишет остатки Ozon/ЯМ/KIT, `SYNC_WRITE_MODE=apply`); этапы 2–3 влиты и выложены (прайс `agreed_prices` — цена создания; бот с `SYNC2_BOT_POLLING=on` и `TELEGRAM_APPROVERS` — кнопки); ворота каталога WB в `ingest` усилены (открытый вопрос 1 — иначе пропажа карточек из чтения каталога обнуляет зеркала). Правила внешних шагов — как в Task 6/16 этапа 3: каждая команда на сервере — после «да» владельца на предпросмотр; крон — вставкой строки с копией прежнего крона; в `main` чужие незакоммиченные правки не трогать.

### Task 17: Выкладка этапа 4, ffmpeg и ключ публикации видео, первый прогон без записи [«да»]

- [ ] **Step 1 [«да»]: слияние и выкладка.**
```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git merge --no-ff sync2-stage-4 -m "sync2: этап 4 — карточки: создание на зеркалах, правки с подтверждением, KIT без, видео, разведение размеров"
cd sync2 && npm run typecheck && npm test && npm run test:db && npm run deploy
ssh root@147.45.171.40 'cd /opt/sync2 && set -a && . ./.env && set +a && psql "$DATABASE_URL" -X -A -c "select count(*) from drizzle.__drizzle_migrations" -c "select code, card_write_mode from channels order by id"'
```
Expected: миграции до 0009 включительно; `card_write_mode` — `off` у всех пяти площадок.

- [ ] **Step 2 [«да»]: `ffmpeg` на VPS синка** (29.09 не установлен; пакет Ubuntu 24.04 `7:6.1.1-3ubuntu5`):
```bash
ssh root@147.45.171.40 'apt-get update -qq && apt-get install -y -qq ffmpeg && ffmpeg -version | head -1 && ffprobe -version | head -1 && mkdir -p /opt/sync2/media/video'
```
Проба на одном ролике (только чтение WB CDN, файл — во временную папку):
```bash
ssh root@147.45.171.40 'cd /tmp && ffmpeg -hide_banner -loglevel error -y -protocol_whitelist file,http,https,tcp,tls,crypto -i https://videonme-basket-12.wbbasket.ru/vol140/part163102/1631024060/hls/1440p/index.m3u8 -c copy -bsf:a aac_adtstoasc -movflags +faststart probe.mp4 && ffprobe -v error -show_entries format=duration -of csv=p=0 probe.mp4 && ls -la probe.mp4 && rm probe.mp4'
```
Expected: длительность ≈ 14 с, файл 3–9 МБ.

- [ ] **Step 3 [«да»]: ключ публикации видео — VPS синка → сервер сайта, только запись в папку видео.**
```bash
ssh root@147.45.171.40 'test -f /root/.ssh/sync2_video || ssh-keygen -t ed25519 -N "" -C sync2-video -f /root/.ssh/sync2_video; cat /root/.ssh/sync2_video.pub'
```
На сервере сайта (201.34.133.76) — одна строка в `/root/.ssh/authorized_keys` (копия файла — `authorized_keys.bak-<дата>`):
```
command="/usr/bin/rrsync -wo /var/www/media/video/",restrict ssh-ed25519 AAAA… sync2-video
```
Затем с VPS синка — ключ хоста и проба записи (файл-проба и удаление — вручную на сервере сайта):
```bash
ssh root@147.45.171.40 'ssh-keyscan -H 201.34.133.76 >> /root/.ssh/known_hosts && echo probe > /tmp/sync2-probe.txt && rsync -e "ssh -i /root/.ssh/sync2_video -o BatchMode=yes -o StrictHostKeyChecking=yes" /tmp/sync2-probe.txt root@201.34.133.76:sync2-probe.txt && echo ok'
ssh root@201.34.133.76 'ls -la /var/www/media/video/sync2-probe.txt && rm /var/www/media/video/sync2-probe.txt'
```
И в `/opt/sync2/.env` — `SYNC2_VIDEO_RSYNC_TARGET=root@201.34.133.76:`, `SYNC2_VIDEO_SSH_KEY=/root/.ssh/sync2_video` (база ссылок и папка — по умолчанию). Проверка ограничения: `ssh -i /root/.ssh/sync2_video root@201.34.133.76 ls` отвечает отказом `rrsync`.

- [ ] **Step 4 [«да»]: первый прогон — базовая линия и план, без записи на площадки.**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; for c in ozon ym kit; do $T card-mode $c dry-run; done; flock -w 240 /tmp/sync2.lock $T cards run; $T cards plan'
```
Expected: `cardBaselines` ≈ 81 + 83 + 393 (все листинги, видимые в снимках), `wbCards` ≈ 388, ключи трёх площадок прочитаны; в журнале — только `mode dry-run`; план созданий по состоянию 29.09 — порядка **Ozon 24, ЯМ 23, KIT 17** (в т.ч. часы `6565542` и `JW-NB-AGT-M-0029` с «серебром 925»); вторые размеры `JW-NB-AGT-M-0073` и `6363638900098` — в `splits` (вопрос придёт при `apply`); пропуски — только «нет прайса» и занятые ключи; видео — `videosBuilt` > 0 (ролики собраны и опубликованы, прикрепление — в журнале `card_video` с `mode dry-run`), `ymLiveTakeRead: 1` (часы). Владельцу — список созданий с категорией и ценой (`cards plan`), пропуски и 2–3 ссылки на опубликованные mp4 для просмотра: **«да» на план — условие Task 18.**

### Task 18: Первое боевое создание — одна карточка на площадку, затем все недостающие [«да»]

Решение 29.09 п. 4: первый прогон — одна карточка на площадку (проверка модерации), затем все недостающие разом. Карточка — `888645543123` «Браслет из Ливийского стекла» (в наличии, нет ни на одной площадке, предмет «Обереги» → маршрут «браслет», есть видео), если владелец не назовёт другую.

- [ ] **Step 1 [«да»]: KIT.**
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T card-mode kit apply --confirm && flock -w 240 /tmp/sync2.lock $T cards run --only=888645543123 --channel=kit --confirm; $T cards plan | head -20'
```
Expected: `kitCardCreated: 1`; в ЛК KIT — вариант в категории «Браслеты», фото с WB, цена = KIT-цена этапа 2, «Опубликован». Следующий тик — листинг `active`, пул пишет остаток; следующий прогон `cards` — видео (`kitVideoAttached: 1`). **Если KIT отверг webp** (`KIT: файл не принят 400`) — стоп, открытый вопрос 3.

- [ ] **Step 2 [«да»]: Ozon** — `card-mode ozon apply --confirm`, затем `cards run --only=888645543123 --channel=ozon --confirm`.
Expected: `ozonCardCreated: 1` или `ozonCardUncertain: 1` (листинг `pending` до модерации); в ЛК Ozon — «Бижутерия → Браслет», бренд KOTELNIKOVARTIFACT, габариты из WB (мм/г); отказ модерации — вопрос «⛔ Ozon отклонил карточку» в группе. После появления в снимке — остаток от пула, флаг и `min_price` — ближайшие `prices`/`ozon-guard timers`, видео — следующим прогоном `cards`.

- [ ] **Step 3 [«да»]: ЯМ** — `card-mode ym apply --confirm`, затем `cards run --only=888645543123 --channel=ym --confirm`.
Expected: `ymCardCreated: 1` без `stockError`; оффер `888645543123` в магазине 149197829, категория «Браслеты», цена и остаток; оффер **не** появился в старом магазине 148697627 (решение 29.09 п. 10 — затем закрыть старый магазин).

- [ ] **Step 4 [«да»]: все недостающие разом и крон** — строка `cards` вставкой из `deploy/crontab.sync2.txt` (копия — `logs/crontab.before-4.txt`, проверка `grep -q 'cli.ts cards run'`), затем сразу один прогон руками:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock -w 240 /tmp/sync2.lock $T cards run; $T cards plan | tail -40'
```
Expected: созданы все недостающие (≈ 23 Ozon, 22 ЯМ, 16 KIT — потолок 40 на площадку не достигается); если `ozonCreateQuotaDeferred` > 0 — остаток Ozon создаст прогон после 03:00 МСК. Серьги-пусеты в наличии — тоже. Отказы модерации — вопросами `card_rejected` в течение суток. Первые сутки — смотреть группу и `cards plan`.

### Task 19: Разведение размеров, габариты Ozon, приёмка [«да»]

- [ ] **Step 1: вопросы о размерах** приходят в группу первым прогоном при `apply`: `JW-NB-AGT-M-0073` (Ozon: остаётся размер штрихкода `2042770600705`; ЯМ: `2042770600712`) и `6363638900098`. **[«да»] владельца = кнопка «✅ Развести размеры» по одной карточке** (решение 29.09 п. 9; сначала `JW-NB-AGT-M-0073`). Проверка: Ozon — новые офферы `JW-NB-AGT-M-0073-<размер>` объединились с существующим (одинаковое «Название модели»), у каждого свой «Размер изделия»; ЯМ — одинаковый `groupId` (`offer-cards`); остатки размеров — от пула. Затем — вторая карточка.
- [ ] **Step 2: первая правка габаритов Ozon** (когда придёт вопрос с полем «Габариты и вес») — ответ «Применить» на одной карточке; проверка: в ЛК Ozon изменились только габариты/вес (и поля из вопроса), атрибуты, видео и фото — прежние, товар не ушёл на повторную модерацию с ошибками. Если переимпорт что-то сломал — открытый вопрос 4.
- [ ] **Step 3: приёмка — 3 суток.** `runs 30 | grep cards` без `failed`; `cards plan` — пропуски только с известными причинами; `decisions` — ни одного `card_edit` в `answered` дольше часа; видео — у всех товаров зеркал с видео на WB (`videosFailed` = 0 или с причиной); сводка `drift` 09:10 МСК — блок «🗂 Карточки» без ⚠️; ожидающих дольше суток — 0. Итог — в «Ход выполнения».

---

## Откат

Каждый вариант — одно «да» владельца. Команды — также в `sync2/deploy/README.md`.

**Карточки площадки** (синк перестаёт создавать, править и прикреплять видео; созданное остаётся, ничего не удаляется):
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts card-mode ozon off'   # ym | kit
```
**Только видео:** убрать `SYNC2_VIDEO_RSYNC_TARGET` из `/opt/sync2/.env` (джоба пишет `videoDisabled`); ключ на сервере сайта — удалить строку `sync2-video` из `authorized_keys`. Опубликованные mp4 в `/var/www/media/video/` остаются (на них ссылаются карточки).
**Всё целиком:** строку крона `cli.ts cards run` закомментировать (`crontab /opt/sync2/logs/crontab.before-4.txt`). Созданные синком товары по журналу:
```bash
ssh root@147.45.171.40 'cd /opt/sync2 && set -a && . ./.env && set +a && psql "$DATABASE_URL" -X -A -F "	" -c "select c.code, w.barcode, w.external_sku, w.created_at from writes w join channels c on c.id = w.channel_id where w.field = '"'"'card_create'"'"' and w.applied order by w.created_at"'
```
Снять товар с продажи — в ЛК площадки (архив Ozon/ЯМ, «Скрыт» KIT); синк архив не трогает и заново архивный `offer_id` не создаёт. **Разведение размеров:** новые офферы размеров — в архив в ЛК; у существующего оффера атрибуты размера не мешают продаже. **Ставка ЯМ часов:** `sync_state` ключ `ym-live-take` — удалить строку, `prices` вернётся к `no-ym-rate`. **Код этапа 4:** прежний `main` → `npm run deploy`; миграции 0008/0009 не откатывать (новые колонки с default, новые таблицы и расширенные CHECK старый код не читает); патч `jobs/prices.ts` уходит вместе с кодом.

---

## Готово, когда

- `sync2-stage-4` в `main`, выложен; миграции 0008–0009; `ffmpeg` на VPS и ключ `rrsync` на сервере сайта; крон `cards` :19; режимы карточек Ozon/ЯМ/KIT — `apply`.
- Все товары WB в наличии есть на Ozon, ЯМ и KIT — включая серьги, часы и карточки с «серебром 925»; исключения — только «нет прайса», занятые ключи и отказы модерации (каждый — вопросом `card_rejected` с текстом площадки).
- У товаров зеркал, у которых на WB есть видео, видео есть на Ozon, ЯМ и KIT (`https://kotelnikovartifact.ru/video/…mp4`), кроме роликов вне пределов (с причиной).
- Правка карточки WB доходит до KIT в течение часа, до Ozon/ЯМ — после «Применить» (включая габариты Ozon); сайт — сам.
- Часы: цена ЯМ ведётся по ставке из тарифов, Ozon — по живой ставке товара.
- `JW-NB-AGT-M-0073` и `6363638900098` разведены на варианты Ozon/ЯМ (или владелец ответил «оставить один оффер»).
- Все тесты зелёные (`typecheck`, `test`, `test:db`); откат — в `sync2/deploy/README.md`.

## Самопроверка по спеке

| Спека / решение / постановка | Где покрыто |
|---|---|
| §2 п. 16, решение п. 16: создание автоматически, только в наличии | Task 4 (`inStock`), Task 10 (создания без вопроса), Task 18 |
| §2 п. 16: незамапленная категория — стоп + алерт | Task 3 (`routeCard`: предмет не в конфиге — пропуск на всех площадках), Task 10 (`runs.error`), Task 16 (сводка) |
| Решение 29.09 п. 1: серебро 925 — на все площадки; отказ модерации (УИН ГИИС ДМДК) — вопрос с текстом, не пересоздавать | Task 2–4 (ограничения нет), Task 6–7 (`fetchOzonModeration`, `fetchYmModeration`), Task 11 (`card_rejected`, листинг `failed`, повтор — только после правки WB или `cards retry`) |
| Решение 29.09 п. 2: видео HLS → mp4 (ffmpeg на VPS) → Ozon/ЯМ/KIT, не блокирует создание | Task 1 (`wb_card_videos`, поле `card_video`), Task 5 (ссылка HLS), Task 6–8 (прикрепление), Task 13 (сборка, публикация, пределы, первое видео и замена), Task 17 (ffmpeg, ключ `rrsync`) |
| Решение 29.09 п. 3: габариты Ozon — из WB для новых (см → мм, кг → г), правки — вопросом | Task 6 (`ozonImportItem`, `ozonReimportItem`), Task 11 (переимпорт по ответу), Task 19 Step 2 |
| Решение 29.09 п. 4: темп — одна карточка на площадку, затем все недостающие; лимит Ozon | Task 10 (`MAX_CARD_CREATES_PER_CHANNEL` = 40, `v4/product/info/limit`), Task 18 |
| Решение 29.09 п. 5: ничего вручную — серьги (маппинг), часы (через API, живая ставка), шармы на Ozon — «Подвеска» | Task 3 (`sergi`, `chasy`, `sharm`), Task 6 (атрибуты серёг и часов, ТН ВЭД часов из WB), Task 15 (ставка ЯМ из тарифов, цена Ozon до живой ставки, патч `prices`) |
| Решение 29.09 п. 6–10: страна Ozon из WB для новых; SEO KIT вручную; «не применять» — не переспрашивать; размеры по одной; старый магазин ЯМ | Task 6 (4389 словарём), Task 8 (SEO не трогается), Task 11 (`skip_edit` → новый хеш), Task 19, Task 18 Step 3 |
| §2 п. 17, решение п. 17: Ozon/ЯМ — «было → станет», KIT — без, сайт — сам | Task 10 (KIT сразу), Task 11 (`card_edit`), сайт в `CARD_CHANNELS` не входит |
| Решение п. 18: развести размеры на варианты Ozon/ЯМ | Task 4 (`splits`), Task 6–7 (9048+5326; 200+размер), Task 14 |
| §4 `listings`: offer_id, статус карточки, хеш контента | Task 1, Task 9 |
| §8: ключ оффера — артикул WB; категории — только маппинг; санитайзер FB_ORIGINAL | Task 4, Task 3, Task 2 |
| §3: запись только через выключатель, режим площадки; лимиты без слепых повторов | Task 1, Task 10, Task 12; Ozon — суточный лимит; KIT — темп очереди |
| §9: кнопки — двое партнёров, без ответа ничего | Task 11 (бот этапа 2) |
| §10: `runs` со счётчиками, `writes` — было → стало, контрактные тесты | Task 5–8, 13 (заглушки ответов и `exec`), Task 10 |
| Постановка: предохранители, никогда не удалять/архивировать | Task 10, 13 (пределы видео); удаления нет ни в одном писателе |
| Постановка: первый боевой прогон — одна карточка | Task 18 |

## Открытые вопросы к владельцу

1. **Сбой каталога WB 29.09 13:51 (к шагу B этапа 1.4, не к карточкам):** чтение `cards/list` во время массового обновления карточек вернуло 386 штрихкодов из 421, ворота 90 % пропустили, пул в dry-run записал −35. **Рекомендация:** до шага B — отдельная правка `ingest`: снимок WB отклоняется, если из каталога пропал хоть один штрихкод с остатком > 0 в прошлом снимке (или каталог перечитывается второй раз и берётся объединение).
2. **ЯМ «Наручные часы» 91259:** `v2/category/91259/parameters` 29.09 дважды ответил `INTERNAL_ERROR` — обязательные характеристики категории неизвестны; оффер создаётся без `parameterValues` (как 18 офферов 04.09). **Рекомендация:** создать; если ЯМ отклонит — придёт вопрос `card_rejected` с текстом, дополним маппинг.
3. **Фото в KIT — webp с WB:** формат `POST /v1/files` в спецификации не ограничен, живьём webp не проверен. **Рекомендация:** проверить на первой карточке (Task 18 Step 1); если KIT откажет — конвертация в jpg тем же `ffmpeg` на VPS отдельной задачей.
4. **Габариты Ozon переимпортом:** `v3/product/import` получает полную карточку Ozon как есть (все атрибуты, видео, фото) с новыми габаритами; формат `images` в ответе `v4/product/info/attributes` проверяется на первой правке. **Рекомендация:** первую правку габаритов — на одной карточке (Task 19 Step 2), дальше как обычно.
5. **Ключ публикации видео на сервере сайта:** VPS синка получает запись только в `/var/www/media/video/` (`rrsync -wo`), без shell. **Рекомендация:** да — это минимальный доступ; альтернатива (отдавать mp4 с VPS синка) невозможна без HTTPS на 443, который занят VPN.
6. **Серебро 925 на Ozon:** 04.09 шесть таких карточек Ozon отклонил FB_JEWELRY с требованием ювелирной категории/УИН. **Рекомендация:** выкладываем по решению 29.09; на отказ — вопрос с текстом, решение по УИН ГИИС ДМДК — за владельцем.

## Ход выполнения

(заполняется исполнителем: даты выкладки, счётчики первых прогонов, созданные карточки, прикреплённые видео, разведённые размеры, итоги приёмки)

## Решения владельца (29.09.2026) — обязательны для исполнителей

1. **Серебро 925** — выкладывается на все площадки (Ozon, ЯМ, KIT): ИП продаёт без отдельных разрешений (владелец). Решение 17.09 «не выкладывать на зеркала» отменено. Если модерация Ozon/ЯМ запросит УИН ГИИС ДМДК — вопрос в Telegram с текстом отказа, карточка не пересоздаётся.
2. **Видео** — переносится: новая задача этапа 4 — скачать HLS (m3u8) с WB, склеить в mp4 (ffmpeg на VPS), загрузить на Ozon/ЯМ/KIT по их API; видео не блокирует создание карточки (догружается следующим прогоном).
3. **Габариты Ozon** — для новых карточек из WB автоматически (см → мм, кг → г по спецификации Ozon); правки габаритов существующих — вопросом «было → станет» с кнопками, как остальные правки Ozon.
4. **Темп создания** — не 10/час: первый прогон — одна карточка на площадку (проверка модерации), затем все недостающие разом (предохранитель поднимается до числа недостающих, ≈ 25 на площадку); единственное ограничение — суточный лимит Ozon (проверка лимита, остаток — на следующий день).
5. **Ничего вручную** — серьги: маппинг категории и атрибутов в `config/card-categories.json`; часы: создаются через API, цена начинает вестись после чтения живой ставки площадки (этап 2 сам берёт ставку товара Ozon; для ЯМ — ставка из тарифов API); шармы на Ozon — как «Подвеска».
6. Страна производства Ozon — из WB для новых, существующие не трогать. 7. SEO-поля KIT — пока скриптом вручную. 8. «Не применять» — не переспрашивать. 9. Разведение размеров — по одной карточке. 10. Старый магазин ЯМ 148697627 — проверить после первого создания и закрыть.
