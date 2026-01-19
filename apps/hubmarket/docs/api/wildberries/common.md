# Common API

> **Base URL:** `https://common-api.wildberries.ru`
> **Rate Limits:** 1 req/60s, interval 60000ms, burst 10
> **Документация:** https://dev.wildberries.ru/openapi/api-information
> **Сгенерировано:** 2024-12-28 17:25:00

## Описание

Тарифы, новости, информация о продавце, управление пользователями

---

## Документация API

- General

  - Introduction

  - Authorization

  - WB API Connection Check

  - News API

  - Seller Information

  - Seller User Management

### Introduction

The Wildberries API provides sellers with tools to manage their store and obtain real-time and statistical information via the HTTP REST API protocol.

### How to get started with the API

1. Register in the [seller personal account](https://seller.wildberries.ru/)
2. Go to the store settings and create an API token
3. Develop an integration with the API

### HTTP status codes

| Code | Description | How to resolve |
|------|-------------|----------------|
| 200 | Success | |
| 204 | Deleted/Updated/Confirmed | |
| 400 | Bad request | Check the request syntax |
| 401 | Unauthorized | Check the authorization token |
| 403 | Access denied | Check token permissions |
| 404 | Not found | Check the request URL |
| 429 | Too many requests | Check method rate limits |
| 5XX | Internal service error | Retry later or contact support |

### Rate Limits

WB API uses token bucket algorithm for rate limiting:

- **Period** — time interval for maximum requests
- **Limit** — maximum requests per period
- **Interval** — pause time between requests
- **Burst** — maximum simultaneous requests

Headers:
- `X-Ratelimit-Remaining` — available burst requests
- `X-Ratelimit-Retry` — seconds to wait after 429
- `X-Ratelimit-Reset` — seconds until burst replenishment

### Authorization

Four types of tokens:

1. **Personal access token** - for own programs/systems
2. **Service token** - for cloud services from WB Catalog
3. **Base token** - limited access, for testing
4. **Test token** - sandbox environment only

### Available Endpoints

#### Connection Check
- `GET /ping` - Check API connection and token validity

#### News API
- `GET /api/communications/v2/news` - Get seller portal news

#### Seller Information
- `GET /api/v1/seller-info` - Get seller name and ID

#### Seller User Management
- `POST /api/v1/invite` - Create invitation for new user
- `GET /api/v1/users` - Get list of active/invited users
- `PUT /api/v1/users/access` - Update user permissions
- `DELETE /api/v1/user` - Delete user access

---

## API Categories and Documentation

Based on the WB API structure, here are all available categories:

### Core APIs
- **Product Management** - `/openapi/work-with-products`
- **FBS Orders** - `/openapi/orders-fbs`
- **Analytics** - `/openapi/analytics`
- **Promotion (Advertising)** - `/openapi/promotion`
- **User Communication** - `/openapi/user-communication`
- **Financial Reports** - `/openapi/financial-reports-and-accounting`
- **Reports** - `/openapi/reports`
- **FBW Orders** - `/openapi/orders-fbw`
- **DBS Orders** - `/openapi/orders-dbs`
- **In-Store Pickup** - `/openapi/in-store-pickup`

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- Токен действителен 180 дней после создания
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/api-information
