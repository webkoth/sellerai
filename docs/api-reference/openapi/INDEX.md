# OpenAPI-спеки маркетплейсов

Машиночитаемые спецификации API WB / Ozon / Яндекс.Маркет. Скопировано из проекта Hubmarket 16.06.2026.
Используются для точных API-вызовов (эндпоинты, тела запросов, лимиты, требования подписок).

## Файлы

| Площадка | Файл | Что внутри |
|---|---|---|
| **Wildberries** | `wildberries/01-general.yaml` | Общее, информация о продавце, лимиты запросов |
| | `wildberries/02-products.yaml` | Карточки (`content/v2/...`), характеристики, медиа |
| | `wildberries/03..07-orders-*.yaml` | Заказы FBS / DBW / DBS / самовывоз / FBW |
| | `wildberries/08-promotion.yaml` | **Реклама** (`/adv/...`): кампании, ставки, статистика |
| | `wildberries/09-communications.yaml` | Отзывы, вопросы, чат |
| | `wildberries/10-tariffs.yaml` | Тарифы логистики/хранения/возврата |
| | `wildberries/11-analytics.yaml` | **Воронка продаж, поисковые запросы, остатки** |
| | `wildberries/12-reports.yaml` | Отчёты |
| | `wildberries/13-finances.yaml` | Финансы: отчёт о реализации, баланс |
| **Ozon** | `ozon/swagger_ozon.json` | Полный Swagger Ozon Seller API |
| **Яндекс.Маркет** | `yandex-market/openapi.yaml` | Полный OpenAPI Я.Маркет Partner API |
| — | `README-source.md` | Исходный сводный README из Hubmarket |

## ⚠️ Практические находки (проверено на боевых вызовах 16.06.2026)

**Доступ:** прямые вызовы РФ-API из песочницы блокируются → всё через relay-прокси `API_CHECK_PROXY` (см. [[relay-ru-api-access]] в памяти, харнессы в `api-check/src/`).

### Wildberries
- **Реклама — БЕСПЛАТНА** (подписка не нужна). Статистика: `GET /adv/v3/fullstats?ids=&beginDate=&endDate=` — **лимит 31 день/запрос** + жёсткий rate-limit (429 → пауза ~65с между вызовами). Список кампаний: `/adv/v1/promotion/count`.
- **Воронка продаж — БЕСПЛАТНА** (базовая, до 365 дней): `POST https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products` (тело: `selectedPeriod`/`pastPeriod` {start,end} + `nmIds`). Поля ответа: `openCount → cartCount → orderCount → buyoutCount` + `conversions`.
  - ⛔ Устаревший путь `/api/v2/nm-report/detail` отдаёт **404** — не использовать (в т.ч. в `mcp/wb-mcp` старый путь).
  - **Джем нужен ТОЛЬКО** для CSV-истории до года (`DETAIL_HISTORY_REPORT`/`GROUPED_HISTORY_REPORT`). Для оптимизации рекламы/воронки Джем НЕ требуется.
- **Отчёт о реализации:** `GET /api/v5/supplier/reportDetailByPeriod` (statistics-api), пагинация по `rrdid`. Реклама списывается строкой «Удержание / WB Продвижение» (deduction).

### Ozon
- Финансы: `POST /v3/finance/transaction/totals` (агрегаты) и `/v3/finance/transaction/list` — **период ≤ 1 месяц**. Заголовки `Client-Id` + `Api-Key`.
- Выкупленные отправления FBS: `POST /v3/posting/fbs/list` (filter status=delivered).

### Яндекс.Маркет
- Прямого баланса/выплат НЕТ. Финансы по заказам: `POST /campaigns/{campaignId}/stats/orders` — комиссии на уровне ЗАКАЗА (`commissions[]`: FEE, AGENCY, DELIVERY_TO_CUSTOMER, PAYMENT_TRANSFER), товар по `shopSku`(=баркод). Субсидии ЯМ уже внутри цены BUYER. Заголовок `Api-Key`.
