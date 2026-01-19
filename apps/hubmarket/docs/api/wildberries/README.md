# Wildberries API Reference

> **Официальная документация:** https://dev.wildberries.ru
> **Последнее обновление:** 2024-12-28
> **Всего категорий:** 13

## Описание

Полная документация Wildberries API в LLM-friendly формате. Все эндпоинты, параметры запросов, ответы и примеры использования.

---

## Категории API

### 1. General (Общие)

**Файл:** [`common.md`](./common.md)
**Base URL:** `https://common-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/api-information

Общая информация об API, авторизация, проверка подключения, новости, информация о продавце, управление пользователями.

**Основные эндпоинты:**
- Connection Check (`/ping`)
- News API (`/api/communications/v2/news`)
- Seller Information (`/api/v1/seller-info`)
- User Management (`/api/v1/invite`, `/api/v1/users`)

---

### 2. Content (Управление товарами)

**Файл:** [`content.md`](./content.md)
**Base URL:** `https://content-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/work-with-products
**Rate Limits:** 60 req/60s, interval 1000ms, burst 5

Создание и управление карточками товаров, категории, характеристики, медиафайлы, теги, цены и скидки, остатки.

**Основные разделы:**
- Categories, Subjects and Characteristics
- Creating Product Cards
- Product Cards Management
- Media Files
- Tags
- Prices and Discounts
- Seller Warehouses
- Inventory

---

### 3. Marketplace (FBS Заказы)

**Файл:** [`marketplace.md`](./marketplace.md)
**Base URL:** `https://marketplace-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/orders-fbs
**Rate Limits:** 300 req/60s, interval 200ms, burst 20

Управление заказами FBS (Fulfillment by Seller) - доставка со склада продавца.

**Основные операции:**
- Получение новых заказов
- Подтверждение сборки
- Получение стикеров
- Отмена заказов
- Метаданные (SGTIN, UIN, IMEI, GTIN)

---

### 4. Orders DBS (Доставка продавцом)

**Файл:** [`orders-dbs.md`](./orders-dbs.md)
**Base URL:** `https://marketplace-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/orders-dbs
**Rate Limits:** 300 req/60s, interval 200ms, burst 20

Управление заказами DBS (Delivery by Seller) - продавец доставляет заказы покупателям.

---

### 5. Orders DBW (Доставка курьером WB)

**Файл:** [`orders-dbw.md`](./orders-dbw.md)
**Base URL:** `https://marketplace-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/orders-dbw
**Rate Limits:** 300 req/60s, interval 200ms, burst 20

Управление заказами DBW (Delivery by WB Courier) - доставка курьером Wildberries.

---

### 6. In-Store Pickup (Самовывоз)

**Файл:** [`in-store-pickup.md`](./in-store-pickup.md)
**Base URL:** `https://marketplace-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/in-store-pickup
**Rate Limits:** 300 req/60s, interval 200ms, burst 20

Управление заказами самовывоза (In-Store Pickup).

---

### 7. Supplies (FBW Поставки)

**Файл:** [`supplies.md`](./supplies.md)
**Base URL:** `https://supplies-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/orders-fbw
**Rate Limits:** 30 req/60s, interval 2s, burst 10

Управление поставками FBW (Fulfillment by Wildberries) на склады WB.

**Основные операции:**
- Формирование поставок
- Информация о поставках
- QR-коды поставок
- Стикеры товаров

---

### 8. Promotion (Реклама)

**Файл:** [`advert.md`](./advert.md)
**Base URL:** `https://advert-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/promotion
**Rate Limits:** 300 req/60s, interval 200ms, burst 10

Управление рекламными кампаниями на Wildberries.

**Основные разделы:**
- Campaigns (создание, управление)
- Campaign Parameters (ставки, бюджеты)
- Finance (баланс, пополнение)
- Media (креативы, баннеры)
- Statistics (статистика кампаний)
- Promotions Calendar (календарь акций)

---

### 9. Feedbacks (Отзывы и вопросы)

**Файл:** [`feedbacks.md`](./feedbacks.md)
**Base URL:** `https://feedbacks-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/user-communication
**Rate Limits:** 300 req/60s, interval 200ms, burst 10

Управление отзывами, вопросами, чатом с покупателями и возвратами.

**Основные разделы:**
- Questions (вопросы покупателей)
- Feedbacks (отзывы)
- Pinned Feedback (закрепление отзывов)
- Buyers Chat (чат с покупателями)
- Buyers Returns (возвраты)

---

### 10. Analytics (Аналитика и данные)

**Файл:** [`analytics.md`](./analytics.md)
**Base URL:** `https://seller-analytics-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/analytics
**Rate Limits:** 60 req/60s, interval 1000ms, burst 5

Аналитика продаж, воронки, поисковые запросы, остатки.

**⚠️ Требует подписку "Джем"** в личном кабинете WB.

**Основные разделы:**
- Sales Funnel (воронка продаж)
- Search Queries for Your Items (поисковые запросы)
- Stocks Report (отчёт по остаткам)
- Seller Analytics CSV (выгрузка в CSV)

---

### 11. Reports (Отчёты)

**Файл:** [`reports.md`](./reports.md)
**Base URL:** `https://statistics-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/reports
**Rate Limits:** 60 req/60s, interval 1000ms, burst 5

Отчёты по продажам, остаткам, маркировке, хранению, регионам.

**Основные разделы:**
- Product Reports (отчёты по товарам)
- Warehouses Remains Report (остатки на складах)
- Products with Mandatory Labeling (маркировка)
- Retention Reports (хранение)
- Paid Reception/Storage (платное приёмка/хранение)
- Sales by Regions (продажи по регионам)
- Share of Brand in Sales (доля бренда)
- Hidden Products (скрытые товары)
- Goods Return Report (возвраты)

---

### 12. Documents (Документы и финансы)

**Файл:** [`documents.md`](./documents.md)
**Base URL:** `https://documents-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/financial-reports-and-accounting

Финансовые отчёты, баланс, документы, акты.

**Категории токена:**
- **Finance:** Balance (баланс)
- **Statistics:** Financial Reports (финансовые отчёты)
- **Documents:** Documents (документы, УПД, акты)

**Основные разделы:**
- Balance (баланс кабинета)
- Financial Reports (реестры, отчёты)
- Documents (УПД, акты сверки)

---

### 13. Tariffs (Тарифы)

**Файл:** [`tariffs.md`](./tariffs.md)
**Base URL:** `https://common-api.wildberries.ru`
**Документация:** https://dev.wildberries.ru/openapi/wb-tariffs
**Rate Limits:** Varies by endpoint (1-60 req/60s)

Тарифы WB: комиссии, хранение, доставка, возвраты.

**Основные разделы:**
- Commission (комиссии по категориям)
- Stock Tariffs (тарифы на хранение: короба, паллеты)
- Supply Tariffs (тарифы на приёмку)
- Return Cost (стоимость возврата продавцу)

---

## Авторизация

Все запросы требуют токен в заголовке `Authorization`.

**Создание токена:** https://seller.wildberries.ru/api-integrations

**Типы токенов:**
1. **Personal Access Token** - для собственных систем (on-premise)
2. **Service Token** - для облачных сервисов из каталога WB
3. **Base Token** - ограниченный доступ
4. **Test Token** - для песочницы (sandbox)

**Категории токенов:**
- Content, Analytics, Prices and Discounts
- Marketplace, Statistics, Promotion
- Feedbacks and Questions, Buyers Chat
- Supplies, Buyers Returns
- Documents, Finance, Users

---

## Rate Limits

WB API использует алгоритм `token bucket` для ограничения запросов.

**Параметры:**
- **Period** - период времени (обычно 1 минута)
- **Limit** - максимум запросов за период
- **Interval** - минимальный интервал между запросами (мс)
- **Burst** - максимум одновременных запросов

**Типичные лимиты:**
- Content API: 60 req/60s, interval 1000ms, burst 5
- Marketplace API: 300 req/60s, interval 200ms, burst 20
- Analytics API: 60 req/60s, interval 1000ms, burst 5

**При превышении:** HTTP 429 с заголовками `X-Ratelimit-Retry`, `X-Ratelimit-Reset`, `X-Ratelimit-Limit`

---

## HTTP Status Codes

| Code | Описание | Решение |
|------|----------|---------|
| 200 | Success | - |
| 204 | Deleted/Updated/Confirmed | - |
| 400 | Bad request | Проверить синтаксис запроса |
| 401 | Unauthorized | Проверить токен (истёк, неверный, не соответствует категории) |
| 403 | Access denied | Токен не должен быть от удалённого пользователя, проверить подписку "Джем" |
| 404 | Not found | Проверить URL |
| 409 | Status update error | Проверить данные запроса |
| 413 | Request too large | Уменьшить количество объектов |
| 422 | Processing error | Данные противоречат друг другу |
| 429 | Too many requests | Превышен rate limit, повторить позже |
| 5XX | Internal error | Сервис недоступен, повторить позже |

---

## Дополнительные ресурсы

- **Официальная документация:** https://dev.wildberries.ru
- **Release Notes:** https://dev.wildberries.ru/release-notes
- **Telegram канал:** https://t.me/wb_api_notifications
- **Новости WB:** https://seller.wildberries.ru/news-v2/news-list
- **Техподдержка:** Диалоги в ЛК продавца, категория "API"
- **JWT декодер:** https://dev.wildberries.ru/jwt

---

## Примечания

- Документация сгенерирована автоматически с помощью Firecrawl MCP
- Все эндпоинты включают примеры запросов и ответов
- Markdown формат оптимизирован для LLM (Claude, GPT)
- Обновления: следить за официальным Telegram каналом
- **WB Digital API** пока не опубликован (404)

---

**Дата генерации:** 2024-12-28 19:30:00
**Источник:** https://dev.wildberries.ru/openapi/*
**Генератор:** Firecrawl MCP + Claude Code
