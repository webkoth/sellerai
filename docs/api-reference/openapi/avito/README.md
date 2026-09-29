# Авито API: спеки и формат фида автозагрузки

Скачано 29.09.2026. Файлы спек не правились: `<slug>.json` это ровно та строка `swagger`,
которую отдаёт портал.

## Откуда взято

| Что | Источник |
|---|---|
| Список разделов каталога | `GET https://www.avito.ru/web/1/openapi/list` (внутренний эндпоинт портала `www.avito.ru/developers/api-catalog`; `developers.avito.ru` редиректит туда) |
| Спека раздела + текст страницы | `GET https://www.avito.ru/web/1/openapi/info/{slug}` → `{swagger, md, changelog?}` |
| Дерево категорий автозагрузки | `GET https://api.avito.ru/autoload/v1/user-docs/tree` (с токеном), Last-Modified: 29 Sep 2026 18:12:41 UTC |
| Поля категории | `GET https://api.avito.ru/autoload/v1/user-docs/node/{node_slug}/fields` (с токеном) |
| Справочники значений полей | `values_link_xml` из ответа полей, `https://api.avito.ru/autoload/v1/user-docs/node/{slug}/field/{id}/values-xml` |

Портал с `curl` отвечает 429 («Доступ с вашего IP-адреса временно ограничен»), поэтому спеки
забраны через браузер (fetch внутри страницы портала). Вызовы `api.avito.ru` сделаны curl/python
с токеном, все только на чтение.

## Файлы

### OpenAPI-спеки (26 разделов, все OpenAPI 3.0.0)

Хост у всех `https://api.avito.ru/`, кроме `autoteka` (`https://pro.autoteka.ru/`).

| Файл | Раздел каталога | Путей |
|---|---|---|
| `auth.json` | Авторизация (`POST /token`: client_credentials, authorization_code, refresh_token) | 3 |
| `user.json` | Информация о пользователе (`/core/v1/accounts/self`, баланс, операции) | 3 |
| `item.json` | Объявления: инфо, цена, VAS, статистика `/stats/...` | 11 |
| `autoload.json` | **Автозагрузка**: профиль, запуск, загрузки v4, дерево категорий и поля | 20 |
| `stock-management.json` | Управление остатками | 2 |
| `order-management.json` | Управление заказами | 12 |
| `delivery-sandbox.json` | Доставка (в т.ч. песочница) | 31 |
| `messenger.json` | Мессенджер | 13 |
| `ratings.json` | Рейтинги и отзывы | 4 |
| `promotion.json` | Продвижение | 7 |
| `cpxpromo.json` | Настройка цены целевого действия | 5 |
| `autostrategy.json` | Автостратегия | 7 |
| `avito-promo.json` | Авито Promo | 15 |
| `trxpromo.json` | TrxPromo | 3 |
| `ads.json` | Авито Реклама (кабинет) | 23 |
| `tariff.json` | Тарифы | 1 |
| `cpa.json` | CPA Авито | 11 |
| `auction.json` | CPA-аукцион | 1 |
| `calltracking.json` | CallTracking | 3 |
| `sbc-gateway.json` | Рассылка скидок в мессенджере (beta) | 5 |
| `digital-goods.json` | Цифровые товары | 8 |
| `accounts-hierarchy.json` | Иерархия аккаунтов | 7 |
| `job.json` | Авито.Работа | 22 |
| `realty-reports.json` | Аналитика по недвижимости | 2 |
| `str.json` | Краткосрочная аренда | 5 |
| `autoteka.json` | Автотека | 27 |

Прочее:

- `catalog-list.json`: список разделов каталога (slug, название, описание) как его отдаёт портал.
- `portal-md/<slug>.md`: текст страницы раздела на портале (поле `md`) и, где он есть, changelog
  после разделителя. Там описания методов, которых нет в самой спеке: например, план вывода
  отчётов v2/v3 в `portal-md/autoload.md`.

### Автозагрузка: категории и поля

- `autoload-categories-tree.json`: полное дерево категорий автозагрузки (`categories[].nested[]`, у узла `name` и `slug`).
- `autoload-fields/<slug>.json`: поля конечной категории как их отдаёт API, `{node, fields[]}`.
  У поля есть `tag` (имя XML-тега), `label`, `descriptions` и `content[]` с `required`,
  `required_by_dependency`, `dependencies_text`, `values`, `values_link_xml`, `warnings`.
  Одно поле может повторяться в `content[]` с разными условиями (так, у `Proba` свой список значений для золота, серебра и платины).
- `autoload-fields/_index.json`: сводка от меня: путь в дереве, обязательные теги, значения
  `Category`/`GoodsType`/`GoodsSubType`/`ProductType` по каждому slug.
- `autoload-fields/values/<slug>__<Tag>__<fieldId>.xml`: справочники значений из `values_link_xml` на `api.avito.ru`.

Скачаны все конечные узлы двух веток:
- **Личные вещи → Часы и украшения** (`chasy_i_ukrashenija`): Часы (2), Ювелирные изделия (12), Бижутерия (10). Итого 24.
- **Хобби и отдых → Коллекционирование** (`kollektsionirovanie`): 48 конечных узлов.

Промежуточные узлы (`chasy_i_ukrashenija`, `casy`, `iuvelirnye_izdeliia`, `bizuteriia`,
`kollektsionirovanie`, `modeli__figurki__kukly_`, `modeli_2303483`, `figurki_i_statuetki_2303484`,
`kartiny`, `gramplastinki`) API не отдаёт, возвращает 400 «The requested category is not a leaf node».

**Не скачано.** Справочники, которые лежат на `avito.ru/web/1/catalogs/content/feed/*.xml`, а не на
`api.avito.ru`, отдают curl'у 429. Среди них `brendy_fashion.xml`, то есть справочник **Brand**
для часов и ювелирки, где поле обязательное. Ещё не скачаны `coins.xml`, `banknoty.xml`,
`istochniki_dlya_figurok_new.xml`, `brendy_dlya_figurok.xml`,
`kollekcionirovanie_modeli_avtomobilej.xml`, `vinilovye_plastinki.xml` и
`hudozhniki_zhivopisi_i_grafiki.xml`. Ссылки есть в `values_link_xml` соответствующих полей.

## База API

- Хост: `https://api.avito.ru`.
- Авторизация (факт, `auth.json` и `portal-md/auth.md`): `POST /token`, form-urlencoded,
  `grant_type=client_credentials`, `client_id`, `client_secret`. В ответе `access_token`, он живёт **24 часа**.
  Дальше заголовок `Authorization: Bearer <token>`. Для чужих аккаунтов есть
  `authorization_code` и `refresh_token`; нам они не нужны.
- Ответы несут `X-RateLimit-Limit` и `X-RateLimit-Remaining` (в минуту).
- Ключи и токен лежат вне репозитория, в `~/.config/avito/` (права 600). В документацию их не писать.

## Автозагрузка: выжимка

### Факт (по `autoload.json` и `portal-md/autoload.md`)

**URL фида и расписание задаются профилем:**
- `GET /autoload/v2/profile`: текущие настройки.
- `POST /autoload/v2/profile`: создать или изменить профиль (пишущий вызов). В теле обязательны
  `autoload_enabled` (bool), `report_email`, `feeds_data[]` из `{feed_name, feed_url}` (url
  начинается с http/https) и `schedule[]` из `{rate, time_slots[], weekdays[]}`. `rate` означает
  число объявлений за период, `time_slots` это часы 0–23 (0 = 00:00–01:00), `weekdays` дни 0–6
  (0 = понедельник). Время московское. `agreement: true` нужен только при создании профиля.
  С 23.12.2024 вместо `feed_url` используется `feeds_data`.
- `/autoload/v1/profile` (GET/POST) помечен deprecated.

**Ручной запуск:** `POST /autoload/v1/upload` без тела. Берёт файл по ссылке из настроек
профиля. **Не чаще одного раза в час.** Лимиты числа публикаций из настроек профиля на такой
запуск не действуют: публикуется всё, что можно опубликовать.

**Отчёты (v4, с 08.06.2026):**
- `GET /autoload/v4/uploads?page=&perPage=&dateFrom=&dateTo=`: история загрузок, свежая первой.
  По каждой загрузке `upload_id`, `started_at`, `source` (Email/Url/Web/OpenAPI), `status`
  (processing/success/success_warning/error), `events[]`, `feed_urls[]` (копия файла на момент загрузки)
  и `stats` (дерево разделов со счётчиками).
- `GET /autoload/v4/uploads/current`: текущая загрузка (обработала хотя бы одно объявление). 404, если такой нет.
- `GET /autoload/v4/uploads/last_successful`: последняя завершённая загрузка.
- `GET /autoload/v4/uploads/{current|last_successful}/items?query=&sections=&page=&perPage=`: объявления
  загрузки. По каждому `ad_id` (наш Id), `avito_id`, `avito_status`
  (active/old/blocked/rejected/archived/removed), `url`, `messages[]` (ошибки и предупреждения), `section`.
- `GET /autoload/v2/items/avito_ids?query=` и `/autoload/v2/items/ad_ids?query=`: сопоставление нашего Id с номером на Авито.
- Отчёты v2/v3 (`/autoload/v2/reports...`, `/autoload/v3/reports...`) устарели. С 08.09.2026 данные
  старше 7 дней в них неполные, с 08.03.2027 они будут отвечать 410. Списаний (`fees`) в v4 нет:
  баланс и операции брать из `user.json`.

**Документация категорий:** `GET /autoload/v1/user-docs/tree` и
`GET /autoload/v1/user-docs/node/{node_slug}/fields`. Оба поддерживают `If-Modified-Since` (ответ 304).

### Поля фида, общие для обеих веток (факт, по `autoload-fields/*.json`)

Обязательны во всех 72 скачанных категориях (Price почти во всех):

| Тег | Что | Ограничение из описания поля |
|---|---|---|
| `Id` | наш уникальный Id объявления | до 100 знаков; цифры, буквы, `, \ / ( ) [ ] - =`; не менять |
| `Title` | название | до 50 символов; без цены, контактов и слова «продам» |
| `Description` | описание | до 7500 символов; HTML (p, br, strong, em, ul, ol, li) только в CDATA и только при подходящем тарифе |
| `Category` | категория | «Часы и украшения» или «Коллекционирование» |
| `GoodsType` | вид товара | см. ниже |
| `AdType` | вид объявления | по умолчанию «Товар приобретен на продажу» |
| `Condition` | состояние | «Новое» / «Б/у» |
| `Address` | адрес, до 256 символов | обязателен, если нет `Latitude`+`Longitude`; вместо него можно `SellerAddressID` из профиля |
| `Images` | фото, `<Image url="..."/>` | JPEG/PNG, до 25 МБ каждое, **не больше 10**, лишние отбрасываются; фото меняется только сменой URL |
| `Price` | цена в рублях, целое | обязательна везде, кроме `figurki`, `kukly_kollekcionnye_2303485`, `drugoe_2303486` |

`ContactPhone` необязателен: один российский номер. `ManagerName` до 40 символов.
`ImageUrls`/`ImageNames` это аналог `Images` для Excel-формата (помечены обязательными
в «Часах и украшениях» с условием «если не указан ImageNames»). `VideoURL` принимает VK Видео и Rutube.
Для доставки есть `Delivery`, `WeightForDelivery`, `LengthForDelivery`, `HeightForDelivery`,
`WidthForDelivery`, `ReturnPolicy`.

### «Часы и украшения» (Category = `Часы и украшения`)

AdType здесь только «Товар приобретен на продажу» или «Товар от производителя».
Варианта «Продаю своё» нет.

| Товар | slug | GoodsType | GoodsSubType / ProductType | Обязательные сверх общих |
|---|---|---|---|---|
| Наручные часы | `narucnye_ili_karmannye` | Часы | ProductType «Наручные или карманные», ProductSubType «Наручные часы» | Brand, Color, ProductType, ProductSubType, Gender (Женские/Мужские/Унисекс/Детские), Mechanism (Кварцевые/Механические/Электронные/Другие), StrapType (справочник в `values/`) |
| Браслет, ювелирный | `braslety` | Ювелирные изделия | Браслеты | Brand, Color, Material, InsertStone, NumberStone, Gender |
| Кулон/подвеска, ювелирный | `kulony_i_podveski` | Ювелирные изделия | Кулоны и подвески | Brand, Color, Material, InsertStone, NumberStone |
| Религиозные изделия | `religioznye_izdeliia` | Ювелирные изделия | Религиозные изделия | нет (Brand, Material и прочие необязательны) |
| Браслет, бижутерия | `braslety_bijouterie` | Бижутерия | Браслеты | GoodsSubType |
| Кулон/подвеска, бижутерия | `kulony_i_podveski_bijouterie` | Бижутерия | Кулоны и подвески | GoodsSubType |
| Прочее, бижутерия | `drugoe_bijouterie` | Бижутерия | Другое | GoodsSubType |

Значения полей ювелирки (`kulony_i_podveski`, `braslety`):
- `Material`: Золото, Серебро, Платина, Ювелирный сплав, Сталь, Кожа, Платиновые металлы, Другое.
- `Proba` необязательна, применима при Material = Серебро: 925, 875, Другое.
- `InsertStone` (checkbox): список драгоценных камней, а также «Янтарь», «Без вставок», «Другое».
- `NumberStone`: 1…6, 6+, Россыпь, Без камней.
- `Color`: 17 цветов, в том числе «Серебряный».
- `Design` (подвески, необязательно): в том числе «Символы и обереги», «Звёзды и планеты».
- `Gender`: Мужчинам / Женщинам / Для всех.
- `Brand` идёт по справочнику `brendy_fashion.xml` (не скачан). Обязателен для часов и ювелирки,
  для бижутерии нет.

### «Коллекционирование» (Category = `Коллекционирование`)

AdType: «Продаю своё», «Товар приобретен на продажу» или «Товар от производителя».
Значение GoodsType совпадает с названием подкатегории второго уровня: «Монеты»,
«Модели, фигурки, куклы», «Картины», «Другое» и т.д. Все значения по каждому slug есть в `autoload-fields/_index.json`.

- `kollektsionirovanie_drugoe`: GoodsType «Другое». Обязательно только общее. Необязательный
  `GoodsSubTypeOther` берётся из справочника
  (`values/kollektsionirovanie_drugoe__GoodsSubTypeOther__111168.xml`, около 60 значений:
  Янтарь, Клык, Зуб, Рог, Насекомые, Четки и т.п.). **Значений «Метеорит» и «Минерал» в нём нет.**
- `statuetki_i_skulptury`, `miniatyury`, `figurki`: GoodsType «Модели, фигурки, куклы»,
  GoodsSubType «Фигурки и статуэтки», плюс обязательный ProductType.

Отдельной категории для минералов, камней или метеоритов в дереве нет: поиск по всему
дереву находит только стройматериалы («Натуральный камень» и т.п.).

### Догадки (не проверено загрузкой)

- Образцы метеоритов по смыслу ближе всего к `Коллекционирование` / GoodsType `Другое`,
  `GoodsSubTypeOther` оставить пустым. Подходящего значения в справочнике нет, а поле необязательное.
- Подвески и браслеты с метеоритом в серебре 925 можно подать двумя способами. Первый: как «Ювелирные
  изделия» (Material «Серебро», Proba «925», InsertStone «Другое», NumberStone «1»); тогда нужен
  Brand из справочника `brendy_fashion.xml`, и есть ли там подходящее значение, не проверено.
  Второй: как «Бижутерия», где Brand и материал необязательны. Амулеты и обереги ложатся в
  «Кулоны и подвески» (Design «Символы и обереги»). Вариант «Религиозные изделия» подходит только
  к религиозной символике.
- Часы требуют Brand из того же справочника.
- Как на эти категории влияет тариф (`/tariff/info/1` отвечает только для «Транспорта»), не выяснено.
