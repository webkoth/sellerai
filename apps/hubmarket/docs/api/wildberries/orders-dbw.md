# DBW Orders API

> **Base URL:** `https://marketplace-api.wildberries.ru`
> **Rate Limits:** 300 req/60s, interval 200ms, burst 20
> **Документация:** https://dev.wildberries.ru/openapi/orders-dbw
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

DBW заказы (Delivery by WB Courier) - доставка курьером Wildberries

---

## Документация API

- DBW Assembly Orders
  - getGet New Orders/api/v3/dbw/orders/new
  - getGet Information on Completed Orders/api/v3/dbw/orders
  - postDelivery Date and Time/api/v3/dbw/orders/delivery-date
  - postGet Orders Statuses/api/v3/dbw/orders/status
  - patchTransfer to Assembly/api/v3/dbw/orders/{orderId}/confirm
  - postGet Orders Stickers/api/v3/dbw/orders/stickers
  - patchTransfer to Delivery/api/v3/dbw/orders/{orderId}/assemble
  - postCourier Info/api/v3/dbw/orders/courier
  - patchCancel the Order/api/v3/dbw/orders/{orderId}/cancel
- DBW Metadata
  - getGet Order Metadata/api/v3/dbw/orders/{orderId}/meta
  - delDelete Order Metadata/api/v3/dbw/orders/{orderId}/meta
  - putAdd Data Matrix Code to the Order/api/v3/dbw/orders/{orderId}/meta/sgtin
  - putAdd UIN to the Order/api/v3/dbw/orders/{orderId}/meta/uin
  - putAdd IMEI to the Order/api/v3/dbw/orders/{orderId}/meta/imei
  - putAdd GTIN to the Order/api/v3/dbw/orders/{orderId}/meta/gtin

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категория токена:** Marketplace
- **Модель доставки:** DBW (Delivery by WB Courier) - доставка курьером Wildberries
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/orders-dbw
