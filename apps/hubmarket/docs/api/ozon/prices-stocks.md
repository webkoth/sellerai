# Prices & Stocks API

> Управление ценами и остатками товаров

**Category:** PricesStocksAPIApi
**Base URL:** `https://api-seller.ozon.ru`
**Generated:** 2024-12-28

---

## Overview

Prices & Stocks API позволяет управлять ценами, скидками и остатками товаров на складах Ozon (FBO) и складах продавца (FBS/rFBS).

### Key Operations

- ✅ Обновление цен товаров
- ✅ Управление остатками на складах
- ✅ Получение информации о текущих ценах
- ✅ Работа с уценёнными товарами
- ✅ Отслеживание остатков по складам

---

## Endpoints

### Price Management

#### POST /v1/product/import/prices
**Обновить цену**

Массовое обновление цен товаров.

**Request:**
```json
{
  "prices": [
    {
      "offer_id": "SKU-123",
      "price": "1500",
      "old_price": "2000",
      "premium_price": "0",
      "vat": "0.2"
    }
  ]
}
```

**Response:**
```json
{
  "result": [
    {
      "offer_id": "SKU-123",
      "product_id": 123456,
      "updated": true,
      "errors": []
    }
  ]
}
```

**Parameters:**
- `price` — Цена товара (обязательно)
- `old_price` — Цена до скидки (опционально)
- `premium_price` — Цена для Premium покупателей (опционально)
- `vat` — Ставка НДС: `"0"` (без НДС), `"0.1"` (10%), `"0.2"` (20%)

#### POST /v5/product/info/prices
**Получить информацию о цене товара**

Получение текущих цен товаров.

**Request:**
```json
{
  "filter": {
    "offer_id": ["SKU-123", "SKU-456"],
    "product_id": [],
    "visibility": "ALL"
  },
  "last_id": "",
  "limit": 100
}
```

**Response:**
```json
{
  "result": {
    "items": [
      {
        "product_id": 123456,
        "offer_id": "SKU-123",
        "price": {
          "price": "1500",
          "old_price": "2000",
          "premium_price": "0",
          "vat": "0.2",
          "min_ozon_price": "1200",
          "marketing_price": "1450",
          "marketing_seller_price": "1500"
        },
        "commissions": {
          "sales_percent": 0.15,
          "fbo_fulfillment_amount": 50,
          "fbo_direct_flow_trans_min_amount": 30,
          "fbo_direct_flow_trans_max_amount": 100,
          "fbs_direct_flow_trans_min_amount": 20,
          "fbs_direct_flow_trans_max_amount": 80
        }
      }
    ],
    "total": 1,
    "last_id": ""
  }
}
```

**Price Types:**
- `price` — Текущая цена товара
- `old_price` — Зачёркнутая цена (цена до скидки)
- `premium_price` — Цена для Premium-пользователей
- `min_ozon_price` — Минимальная цена на Ozon (для участия в акциях)
- `marketing_price` — Цена с учётом рекламных акций
- `marketing_seller_price` — Цена продавца с учётом маркетинга

---

### Stock Management

#### POST /v1/product/import/stocks
**Обновить остатки**

Обновление остатков товаров на складе Ozon (FBO).

**Request:**
```json
{
  "stocks": [
    {
      "offer_id": "SKU-123",
      "stock": 50
    },
    {
      "product_id": 789012,
      "stock": 100
    }
  ]
}
```

**Response:**
```json
{
  "result": [
    {
      "offer_id": "SKU-123",
      "product_id": 123456,
      "updated": true,
      "errors": []
    }
  ]
}
```

**Important:**
- Используйте `offer_id` или `product_id` для идентификации товара
- `stock` = 0 означает "товар отсутствует на складе"
- Для FBO: обновляет остатки на складе Ozon
- Для FBS/rFBS: используйте `/v2/products/stocks`

#### POST /v2/products/stocks
**Обновить количество товаров на складах**

Обновление остатков на конкретных складах (поддерживает несколько складов).

**Request:**
```json
{
  "stocks": [
    {
      "offer_id": "SKU-123",
      "warehouse_id": 12345678,
      "stock": 25
    },
    {
      "offer_id": "SKU-456",
      "warehouse_id": 12345678,
      "stock": 0
    }
  ]
}
```

**Response:**
```json
{
  "result": [
    {
      "warehouse_id": 12345678,
      "offer_id": "SKU-123",
      "product_id": 123456,
      "updated": true,
      "errors": []
    }
  ]
}
```

#### POST /v4/product/info/stocks
**Информация о количестве товаров**

Получение информации об остатках товаров (FBO).

**Request:**
```json
{
  "filter": {
    "offer_id": ["SKU-123"],
    "product_id": [],
    "visibility": "ALL"
  },
  "last_id": "",
  "limit": 100
}
```

**Response:**
```json
{
  "result": {
    "items": [
      {
        "offer_id": "SKU-123",
        "product_id": 123456,
        "stocks": [
          {
            "type": "fbo",
            "present": 50,
            "reserved": 10
          }
        ]
      }
    ],
    "total": 1,
    "last_id": ""
  }
}
```

**Stock Types:**
- `present` — Доступно для продажи
- `reserved` — Зарезервировано в заказах

#### POST /v1/product/info/stocks-by-warehouse/fbs
**Информация об остатках на складах продавца (FBS и rFBS)**

Получение остатков на складах продавца для схем FBS и rFBS.

**Request:**
```json
{
  "fbs_sku": [123456, 789012]
}
```

**Response:**
```json
{
  "result": [
    {
      "fbs_sku": 123456,
      "offer_id": "SKU-123",
      "product_id": 999888,
      "warehouse_id": 12345678,
      "warehouse_name": "Мой склад",
      "present": 25,
      "reserved": 5
    }
  ]
}
```

---

### Discounted Products

#### POST /v1/product/info/discounted
**Узнать информацию об уценке и основном товаре по SKU уценённого товара**

Получение связи между основным и уценённым товаром.

**Request:**
```json
{
  "discounted_skus": [111222333]
}
```

**Response:**
```json
{
  "result": {
    "items": [
      {
        "discounted": {
          "sku": 111222333,
          "product_id": 123456
        },
        "main": {
          "sku": 987654321,
          "product_id": 654321
        }
      }
    ]
  }
}
```

#### POST /v1/product/update/discount
**Установить скидку на уценённый товар**

Установка скидки для уценённых товаров.

**Request:**
```json
{
  "discount": 30,
  "product_id": 123456
}
```

---

## Common Workflows

### Update Prices for Multiple Products

```python
import ozon_api_client

api = ozon_api_client.PricesStocksAPIApi()

body = {
    "prices": [
        {
            "offer_id": "SKU-001",
            "price": "1500",
            "old_price": "2000",
            "vat": "0.2"
        },
        {
            "offer_id": "SKU-002",
            "price": "2500",
            "vat": "0.2"
        }
    ]
}

response = api.product_api_import_products_prices(
    body=body,
    client_id="your_client_id",
    api_key="your_api_key"
)
```

### Update Stocks (FBO)

```python
body = {
    "stocks": [
        {"offer_id": "SKU-001", "stock": 100},
        {"offer_id": "SKU-002", "stock": 50}
    ]
}

response = api.product_api_import_products_stocks(
    body=body,
    client_id="your_client_id",
    api_key="your_api_key"
)
```

### Update Stocks by Warehouse (FBS/rFBS)

```python
body = {
    "stocks": [
        {
            "offer_id": "SKU-001",
            "warehouse_id": 12345678,
            "stock": 25
        }
    ]
}

response = api.product_api_products_stocks_v2(
    body=body,
    client_id="your_client_id",
    api_key="your_api_key"
)
```

---

## Important Notes

### Price Rules

- ✅ Цена должна быть > 0
- ✅ Максимальная цена: 9,999,999 руб
- ✅ `old_price` должна быть >= `price` (если указана)
- ✅ Для участия в акциях проверяйте `min_ozon_price`
- ✅ Скидка рассчитывается: `(old_price - price) / old_price * 100%`

### Stock Rules

- ✅ Остатки обновляются в течение 15 минут
- ✅ `stock` >= 0 (отрицательные значения не допускаются)
- ✅ Максимум: 1,000,000 единиц на складе
- ✅ Для FBO: используйте `/v1/product/import/stocks`
- ✅ Для FBS/rFBS: используйте `/v2/products/stocks` с `warehouse_id`

### Batch Limits

| Operation | Max Items | Frequency |
|-----------|-----------|-----------|
| Update prices | 1000 items/request | No limit |
| Update stocks (FBO) | 100 items/request | No limit |
| Update stocks (FBS) | 100 items/request | No limit |
| Get info | 1000 items/request | 300 req/60s |

---

## Pricing Strategy

### Commissions Structure

Ozon взимает комиссии:

1. **Sales Commission** — % от цены товара (зависит от категории)
2. **FBO Fulfillment** — за хранение и обработку (для FBO)
3. **Delivery Fee** — за доставку покупателю
4. **Return Fee** — за обработку возвратов

**Получить комиссии:**
```
POST /v5/product/info/prices
```

В ответе: поле `commissions` с детализацией всех комиссий.

### Price Calculation Formula

```
Чистая выручка = price - (sales_commission + delivery + fulfillment)
Маржа = Чистая выручка - Себестоимость
```

---

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `PRICE_MIN_VIOLATION` | Цена ниже минимальной | Увеличьте цену >= `min_ozon_price` |
| `INVALID_VAT` | Некорректная ставка НДС | Используйте: 0, 0.1, 0.2 |
| `STOCK_LIMIT_EXCEEDED` | Превышен лимит остатков | Максимум 1,000,000 единиц |
| `WAREHOUSE_NOT_FOUND` | Склад не найден | Проверьте `warehouse_id` |
| `PRODUCT_NOT_FOUND` | Товар не найден | Проверьте `offer_id` или `product_id` |

---

## Best Practices

### 1. Regular Stock Updates
Обновляйте остатки минимум раз в час для актуальности данных.

### 2. Monitor Minimum Prices
Регулярно проверяйте `min_ozon_price` для участия в акциях.

### 3. Use Batch Operations
Группируйте обновления (до 100-1000 товаров) для эффективности.

### 4. Track Commissions
Учитывайте все комиссии при расчёте маржинальности.

### 5. Set old_price Wisely
Зачёркнутая цена должна быть реальной и обоснованной.

---

## Related APIs

- [Products API](./products.md) - Управление товарами
- [Analytics API](./analytics.md) - Анализ остатков и оборачиваемости
- [Pricing Strategy API](./pricing-strategy.md) - Автоматическое ценообразование

---

## Resources

- [Official Documentation](https://docs.ozon.ru/api/seller/#tag/PricesStocksAPI)
- [Commission Calculator](https://seller.ozon.ru/app/analytics/commissions)
- [Pricing Guide](https://seller-edu.ozon.ru/pricing)
