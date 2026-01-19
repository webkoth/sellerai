# Products API

> Управление товарами на Ozon

**Category:** ProductAPIApi
**Base URL:** `https://api-seller.ozon.ru`
**Generated:** 2024-12-28

---

## Overview

Products API предоставляет методы для создания, обновления, архивирования товаров, управления характеристиками, изображениями и описаниями товаров.

### Key Operations

- ✅ Создание и обновление товаров
- ✅ Управление характеристиками и атрибутами
- ✅ Загрузка и обновление изображений
- ✅ Архивирование и восстановление товаров
- ✅ Получение информации о товарах
- ✅ Управление артикулами (SKU/offer_id)

---

## Endpoints

### Product Creation & Updates

#### POST /v3/product/import
**Создать или обновить товар**

Основной метод для создания нового товара или обновления существующего.

**Request:**
```json
{
  "items": [
    {
      "offer_id": "SKU-123",
      "name": "Название товара",
      "category_id": 17028922,
      "price": "1000",
      "vat": "0.2",
      "images": [
        "https://example.com/image1.jpg"
      ],
      "attributes": [
        {
          "complex_id": 0,
          "id": 85,
          "values": [
            {
              "value": "Значение атрибута"
            }
          ]
        }
      ]
    }
  ]
}
```

**Headers:**
```
Client-Id: your_client_id
Api-Key: your_api_key
```

#### POST /v1/product/import-by-sku
**Создать товар по SKU**

Создание товара на основе существующего SKU.

#### POST /v1/product/import/info
**Узнать статус добавления товара**

Проверка статуса задачи импорта товаров.

---

### Product Information

#### POST /v3/product/list
**Список товаров**

Получить список всех товаров продавца с возможностью фильтрации и пагинации.

**Request:**
```json
{
  "filter": {
    "offer_id": ["SKU-123", "SKU-456"],
    "product_id": [123456, 789012],
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
        "is_fbo_visible": true,
        "is_fbs_visible": true,
        "archived": false,
        "is_discounted": false
      }
    ],
    "total": 250,
    "last_id": "abc123"
  }
}
```

#### POST /v2/product/info
**Информация о товарах**

Детальная информация о конкретных товарах.

**Request:**
```json
{
  "offer_id": ["SKU-123"],
  "product_id": [],
  "sku": []
}
```

#### POST /v3/product/info/list
**Получить информацию о товарах по идентификаторам**

Получение информации о нескольких товарах одновременно.

#### POST /v1/product/info/description
**Получить описание товара**

Получение полного описания товара.

---

### Product Attributes

#### POST /v4/product/info/attributes
**Получить описание характеристик товара**

Получение всех характеристик (атрибутов) товара.

**Response:**
```json
{
  "result": [
    {
      "id": 123456,
      "offer_id": "SKU-123",
      "name": "Название товара",
      "attributes": [
        {
          "attribute_id": 85,
          "complex_id": 0,
          "values": [
            {
              "dictionary_value_id": 0,
              "value": "Значение"
            }
          ]
        }
      ]
    }
  ]
}
```

#### POST /v1/product/attributes/update
**Обновить характеристики товара**

Обновление атрибутов существующего товара.

**Request:**
```json
{
  "items": [
    {
      "offer_id": "SKU-123",
      "attributes": [
        {
          "id": 85,
          "values": [
            {
              "value": "Новое значение"
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Product Images

#### POST /v1/product/pictures/import
**Загрузить или обновить изображения товара**

Загрузка новых изображений или обновление существующих.

**Request:**
```json
{
  "product_id": 123456,
  "images": [
    {
      "file_name": "image1.jpg",
      "default": true
    }
  ],
  "color_image": ""
}
```

#### POST /v2/product/pictures/info
**Получить изображения товаров**

Получение списка изображений для товаров.

**Request:**
```json
{
  "product_id": [123456, 789012]
}
```

---

### Archive Operations

#### POST /v1/product/archive
**Перенести товар в архив**

Архивирование товара (скрытие из продажи).

**Request:**
```json
{
  "product_id": [123456, 789012]
}
```

#### POST /v1/product/unarchive
**Вернуть товар из архива**

Восстановление товара из архива.

**Request:**
```json
{
  "product_id": [123456]
}
```

#### POST /v2/products/delete
**Удалить товар без SKU из архива**

Полное удаление архивного товара (необратимо).

---

### Advanced Features

#### POST /v1/product/update/offer-id
**Изменить артикулы товаров из системы продавца**

Обновление offer_id (артикула продавца).

**Request:**
```json
{
  "update_offer_id": [
    {
      "offer_id": "OLD-SKU",
      "new_offer_id": "NEW-SKU",
      "product_id": 123456
    }
  ]
}
```

#### POST /v1/product/related-sku/get
**Получить связанные SKU**

Получение связанных товаров (например, разные размеры одного товара).

#### POST /v1/product/rating-by-sku
**Получить контент-рейтинг товаров по SKU**

Получение рейтинга качества контента товара.

#### POST /v4/product/info/limit
**Лимиты на ассортимент, создание и обновление товаров**

Проверка доступных лимитов по товарам.

**Response:**
```json
{
  "result": {
    "daily_create": 1000,
    "daily_update": 5000,
    "total": 50000,
    "used": 12500
  }
}
```

#### POST /v1/product/info/subscription
**Количество подписавшихся на товар пользователей**

Получение количества пользователей, подписанных на уведомления о поступлении товара.

---

### Digital Products

#### POST /v1/product/upload_digital_codes
**Загрузить коды активации для услуг и цифровых товаров**

Загрузка кодов активации для цифровых товаров.

#### POST /v1/product/upload_digital_codes/info
**Статус загрузки кодов активации**

Проверка статуса загрузки кодов.

---

## Common Workflows

### Creating a New Product

1. **Get category attributes:**
   ```
   POST /v1/description-category/attribute
   ```

2. **Create product:**
   ```
   POST /v3/product/import
   ```

3. **Check import status:**
   ```
   POST /v1/product/import/info
   ```

4. **Upload images (optional):**
   ```
   POST /v1/product/pictures/import
   ```

### Updating Product Information

1. **Get current product info:**
   ```
   POST /v2/product/info
   ```

2. **Update attributes:**
   ```
   POST /v1/product/attributes/update
   ```

3. **Update images (if needed):**
   ```
   POST /v1/product/pictures/import
   ```

---

## Product Identification

Products can be identified using:

| Field | Description | Example |
|-------|-------------|---------|
| `product_id` | Ozon internal ID | `123456789` |
| `offer_id` | Seller's SKU/article | `"SKU-12345"` |
| `sku` | Ozon SKU | `987654321` |

**Best practice:** Always use `offer_id` for your internal tracking.

---

## Important Notes

### Validation Rules

- ✅ `offer_id` must be unique across your catalog
- ✅ Product name: max 500 characters
- ✅ Images: JPEG/PNG, max 10MB, min 200x200px
- ✅ At least 1 image required (recommended: 5-8 images)
- ✅ Price must be > 0
- ✅ Category-specific required attributes must be filled

### Image Requirements

- **Format:** JPEG, PNG
- **Size:** Max 10MB per image
- **Resolution:** Min 200x200px, recommended 900x1200px
- **Quantity:** 1-15 images per product
- **First image:** Used as main product image

### Attribute Types

| Type | Description | Example |
|------|-------------|---------|
| String | Text value | "Красный" |
| Dictionary | Predefined value from catalog | value_id: 971082156 |
| Decimal | Numeric with decimals | "12.5" |
| Integer | Whole number | "100" |

---

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `PRODUCT_LIMIT_EXCEEDED` | Превышен лимит товаров | Check limits via `/v4/product/info/limit` |
| `INVALID_OFFER_ID` | Некорректный offer_id | Check uniqueness and format |
| `REQUIRED_ATTRIBUTE_MISSING` | Отсутствует обязательный атрибут | Check category requirements |
| `INVALID_IMAGE_FORMAT` | Неверный формат изображения | Use JPEG/PNG |
| `CATEGORY_NOT_FOUND` | Категория не найдена | Verify category_id |

---

## Rate Limits

- **Standard:** 300 requests / 60 seconds
- **Product import:** Batch up to 100 items per request
- **Image upload:** Max 15 images per request

---

## Related APIs

- [Categories API](./categories.md) - Get category tree and attributes
- [Prices & Stocks API](./prices-stocks.md) - Update prices and inventory
- [Certification API](./certification.md) - Manage product certificates

---

## Resources

- [Official Documentation](https://docs.ozon.ru/api/seller/#tag/ProductAPI)
- [Category Attributes Guide](./categories.md)
- [Python Client Example](#quick-start)

---

## Quick Start

```python
import ozon_api_client
from ozon_api_client.rest import ApiException

# Create API instance
api = ozon_api_client.ProductAPIApi()

# Get product list
body = ozon_api_client.Productv3GetProductListRequest(
    filter={"visibility": "ALL"},
    limit=100
)

try:
    response = api.product_api_get_product_list(
        body=body,
        client_id="your_client_id",
        api_key="your_api_key"
    )
    print(f"Total products: {response.result.total}")
except ApiException as e:
    print(f"Error: {e}")
```
