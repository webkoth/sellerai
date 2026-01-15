# Tariffs API

> **Base URL:** `https://common-api.wildberries.ru`
> **Rate Limits:** Varies by endpoint (1-60 req/60s)
> **Документация:** https://dev.wildberries.ru/openapi/wb-tariffs
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Тарифы: комиссии, хранение, доставка, возвраты

---

## Документация API

- Commission
  - getProduct Category Commission/api/v1/tariffs/commission
- Stock Tariffs
  - getBox Tariffs/api/v1/tariffs/box
  - getPallet Tariffs/api/v1/tariffs/pallet
- Supply Tariffs
  - getSupply Tariffs/api/tariffs/v1/acceptance/coefficients
- Return Cost to Seller
  - getReturn Tariffs/api/v1/tariffs/return

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Доступ:** Токен любой категории
- Тарифы включают комиссии WB, стоимость хранения, доставки и возвратов
- Rate limits важны для предотвращения блокировки
- Полная официальная документация: https://dev.wildberries.ru/openapi/wb-tariffs
