# In-Store Pickup Orders API

> **Base URL:** `https://marketplace-api.wildberries.ru`
> **Rate Limits:** 300 req/60s, interval 200ms, burst 20
> **Документация:** https://dev.wildberries.ru/openapi/in-store-pickup
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Управление заказами самовывоза (In-Store Pickup)

---

## Документация API

- In-Store Pickup Assembly Orders
  - getGet New Assembly Orders List/api/v3/click-collect/orders/new
  - patchTransfer to Assembly/api/v3/click-collect/orders/{orderId}/confirm
  - patchNotify That the Assembly Order Is Ready for Pickup/api/v3/click-collect/orders/{orderId}/prepare
  - postBuyer Information/api/v3/click-collect/orders/client
  - postCheck If the Order Belongs to the Buyer/api/v3/click-collect/orders/client/identity
  - patchNotify That the Order Has Been Accepted by the Buyer/api/v3/click-collect/orders/{orderId}/receive
  - patchNotify That the Buyer Refused the Order/api/v3/click-collect/orders/{orderId}/reject
  - postGet Assembly Order Statuses/api/v3/click-collect/orders/status
  - getRetrieve Information on Completed Assembly Orders/api/v3/click-collect/orders
  - patchCancel the Assembly Order/api/v3/click-collect/orders/{orderId}/cancel
- In-Store Pickup Metadata
  - getGet Assembly Order Metadata/api/v3/click-collect/orders/{orderId}/meta
  - delDelete Assembly Order Metadata/api/v3/click-collect/orders/{orderId}/meta
  - putAssign a Data Matrix Code to the Assembly Order/api/v3/click-collect/orders/{orderId}/meta/sgtin
  - putAdd UIN (Unique Identification Number) to the Assembly Order/api/v3/click-collect/orders/{orderId}/meta/uin
  - putAdd IMEI to the Assembly Order/api/v3/click-collect/orders/{orderId}/meta/imei
  - putAdd GTIN to the Assembly Order/api/v3/click-collect/orders/{orderId}/meta/gtin

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категория токена:** Marketplace
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/in-store-pickup
