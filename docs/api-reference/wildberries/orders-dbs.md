# DBS Orders API

> **Base URL:** `https://marketplace-api.wildberries.ru`
> **Rate Limits:** 300 req/60s, interval 200ms, burst 20
> **Документация:** https://dev.wildberries.ru/openapi/orders-dbs
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

DBS заказы (Delivery by Seller) - доставка продавцом

---

## Документация API

- DBS Assembly Orders
  - getGet New Orders List/api/v3/dbs/orders/new
  - getGet Information on Completed Orders/api/v3/dbs/orders
  - postGet Information on Paid Delivery/api/v3/dbs/groups/info
  - postBuyer Information/api/v3/dbs/orders/client
  - postDelivery Date and Time/api/v3/dbs/orders/delivery-date
  - postGet Orders Statuses/api/v3/dbs/orders/status
  - patchCancel the Order/api/v3/dbs/orders/{orderId}/cancel
  - patchTransfer to Assembly/api/v3/dbs/orders/{orderId}/confirm
  - patchTransfer to Delivery/api/v3/dbs/orders/{orderId}/deliver
  - patchNotify That the Order Has Been Accepted by the Buyer/api/v3/dbs/orders/{orderId}/receive
  - patchNotify That the Buyer Has Declined the Order/api/v3/dbs/orders/{orderId}/reject
- DBS Metadata
  - getGet Order Metadata/api/v3/dbs/orders/{orderId}/meta
  - delDelete Order Metadata/api/v3/dbs/orders/{orderId}/meta
  - putAdd Data Matrix Code to the Order/api/v3/dbs/orders/{orderId}/meta/sgtin
  - putAdd UIN to the Order/api/v3/dbs/orders/{orderId}/meta/uin
  - putAdd IMEI to the Order/api/v3/dbs/orders/{orderId}/meta/imei
  - putAdd GTIN to the Order/api/v3/dbs/orders/{orderId}/meta/gtin

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категория токена:** Marketplace
- **Модель доставки:** DBS (Delivery by Seller) - продавец доставляет заказы покупателям
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/orders-dbs
