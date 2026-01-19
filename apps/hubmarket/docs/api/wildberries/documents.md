# Documents and Accounting API

> **Base URL:** `https://documents-api.wildberries.ru`
> **Документация:** https://dev.wildberries.ru/openapi/financial-reports-and-accounting
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Финансовые отчёты, баланс кабинета, документы (УПД, акты сверки)

**Категории токенов:**
- **Finance:** Balance - `https://finance-api.wildberries.ru`
- **Statistics:** Financial Reports - `https://statistics-api.wildberries.ru`
- **Documents:** Documents - `https://documents-api.wildberries.ru`

---

## Документация API

### Balance

- **GET** Get Seller's Balance `/api/v1/account/balance`
  - Rate Limit: 1 req/60s, burst 1
  - Returns: `currency`, `current`, `for_withdraw`

### Financial Reports

- **GET** Realization Sales Report `/api/v5/supplier/reportDetailByPeriod`
  - Rate Limit: 1 req/60s, burst 1
  - Parameters: `dateFrom`, `dateTo`, `limit`, `rrdid`, `period`
  - Report data since 29 January 2024

### Documents

- **GET** Documents Categories `/api/v1/documents/categories`
  - Rate Limit: 1 req/10s, burst 5
  - Returns list of document categories

- **GET** Documents List `/api/v1/documents/list`
  - Rate Limit: 1 req/10s, burst 5
  - Parameters: `locale`, `beginTime`, `endTime`, `sort`, `order`, `category`, `serviceName`, `limit`, `offset`

- **GET** Get Document `/api/v1/documents/download`
  - Rate Limit: 1 req/10s, burst 5
  - Parameters: `serviceName`, `extension`

- **POST** Get Documents `/api/v1/documents/download/all`
  - Rate Limit: 1 req/5min, burst 5
  - Download multiple documents at once (max 50)

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категории токенов:**
  - **Finance** - для Balance API
  - **Statistics** - для Financial Reports
  - **Documents** - для Documents API
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/financial-reports-and-accounting
