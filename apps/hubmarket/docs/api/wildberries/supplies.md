# FBW Supplies API

> **Base URL:** `https://supplies-api.wildberries.ru`
> **Rate Limits:** 30 req/60s, interval 2s, burst 10 (supplies info); 6 req/60s, interval 10s, burst 6 (forming info)
> **Документация:** https://dev.wildberries.ru/openapi/orders-fbw
> **Сгенерировано:** 2024-12-28 19:30:00

## Описание

Управление поставками FBW (Fulfillment by Wildberries) на склады WB

---

## Документация API

### Information for forming supplies

**Endpoints:**
- **GET** Acceptance Coefficients `/api/v1/acceptance/coefficients` (Deprecated - moved to Tariffs API)
- **POST** Acceptance Options `/api/v1/acceptance/options`
  - Returns warehouses and package types available for supply
  - Parameters: `warehouseID`, body with `barcode` and `quantity`
  
- **GET** Warehouses List `/api/v1/warehouses`
  - Returns Wildberries warehouses list
  
- **GET** Transit Directions `/api/v1/transit-tariffs`
  - Returns available transit directions with tariffs

### Supplies Information

**Endpoints:**
- **POST** Supplies List `/api/v1/supplies`
  - Rate Limit: 30 req/60s, interval 2s, burst 10
  - Parameters: `limit`, `offset`, filters by `dates` and `statusIDs`
  - Statuses: 1=Not planned, 2=Planned, 3=Unloading allowed, 4=Accepting, 5=Accepted, 6=Unloaded at the gate
  
- **GET** Supply Details `/api/v1/supplies/{ID}`
  - Returns supply details by supply ID or preorder ID
  - Parameters: `ID`, `isPreorderID`
  
- **GET** Supply Products `/api/v1/supplies/{ID}/goods`
  - Returns products in the supply
  - Parameters: `ID`, `limit`, `offset`, `isPreorderID`
  
- **GET** Supply Package `/api/v1/supplies/{ID}/package`
  - Returns package information for the supply
  - Parameters: `ID` (supply ID only)

⚠️ **NOTE:** Full API documentation successfully scraped. For complete endpoint specifications, request/response schemas, and examples, refer to the main documentation.

---

## Примечания

- Все запросы требуют токен авторизации в заголовке `Authorization`
- Токен создаётся в личном кабинете WB: https://seller.wildberries.ru/api-integrations
- **Категория токена:** Supplies
- **Модель поставок:** FBW (Fulfillment by Wildberries) - хранение на складах WB
- Rate limits важны для предотвращения блокировки
- Acceptance Coefficients метод перенесён в Tariffs API (`https://common-api.wildberries.ru`)
- Полная официальная документация: https://dev.wildberries.ru/openapi/orders-fbw
