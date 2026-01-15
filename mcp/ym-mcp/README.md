# Yandex Market MCP Server

MCP сервер для работы с Яндекс.Маркет Partner API.

## Возможности

- **Магазины (campaigns):** получение списка и информации о магазинах
- **Товары (products):** просмотр каталога товаров
- **Остатки (stocks):** просмотр и обновление остатков на складах
- **Цены (prices):** просмотр и установка цен
- **Заказы (orders):** получение списка заказов
- **Отзывы (reviews):** просмотр отзывов и ответы на них
- **Склады (warehouses):** информация о складах
- **Качество (quality):** индекс качества магазина

## Установка

```bash
cd mcp/ym-mcp
npm install
npm run build
```

## Настройка

Добавьте переменные окружения в `.env`:

```bash
YM_API_TOKEN="your_api_token"
YM_BUSINESS_ID="your_business_id"
YM_CAMPAIGN_ID="your_campaign_id"
```

**Получение токена:**
1. Войдите в [Личный кабинет продавца](https://partner.market.yandex.ru)
2. Настройки → API и модули → Токены авторизации
3. Создайте токен с правами `all-methods` или `marketplace`

**Получение ID:**
- `businessId` — ID кабинета (один кабинет = несколько магазинов)
- `campaignId` — ID магазина (конкретный магазин в кабинете)

## Инструменты

### ym_get_campaigns
Получить список магазинов в кабинете.

### ym_get_campaign
Получить информацию о конкретном магазине.

### ym_get_products
Получить товары в магазине.

### ym_get_stocks
Получить остатки на складах.

### ym_update_stocks
Обновить остатки (требует `confirm: true`).

### ym_get_prices
Получить цены товаров.

### ym_update_prices
Установить цены (требует `confirm: true`).

### ym_get_orders
Получить заказы.

### ym_get_reviews
Получить отзывы о товарах.

### ym_reply_review
Ответить на отзыв (требует `confirm: true`).

### ym_get_warehouses
Получить список складов.

### ym_get_quality_rating
Получить индекс качества магазина.

## Примеры

```
Покажи мои магазины на Яндекс.Маркет
→ ym_get_campaigns

Покажи остатки товаров
→ ym_get_stocks

Установи цену 1500₽ на товар SKU-123
→ ym_update_prices({ prices: [{ offerId: "SKU-123", price: 1500 }], confirm: true })

Найди негативные отзывы
→ ym_get_reviews({ rating: [1, 2] })
```

## MCP конфигурация

Добавьте в `.mcp.json`:

```json
{
  "mcpServers": {
    "ym-mcp": {
      "command": "node",
      "args": ["mcp/ym-mcp/dist/index.js"],
      "env": {
        "YM_API_TOKEN": "${YM_API_TOKEN}",
        "YM_BUSINESS_ID": "${YM_BUSINESS_ID}",
        "YM_CAMPAIGN_ID": "${YM_CAMPAIGN_ID}"
      }
    }
  }
}
```

## API Reference

- [Документация Яндекс.Маркет API](https://yandex.ru/dev/market/partner-api/doc/ru/)
- [OpenAPI Specification](https://github.com/yandex-market/yandex-market-partner-api)
