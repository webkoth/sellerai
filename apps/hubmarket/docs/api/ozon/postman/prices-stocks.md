# Цены и остатки товаров

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (8 total)

### 1. /v1/product/import/stocks

**Method:** `POST`

**Path:** `/v1/product/import/stocks`

**Request Body:**
```json
{
  "stocks": [
    {
      "offer_id": "PG-2404С1",
      "product_id": 55946,
      "stock": 4
    }
  ]
}
```

---

### 2. /v2/products/stocks

**Method:** `POST`

**Path:** `/v2/products/stocks`

**Request Body:**
```json
{
  "stocks": [
    {
      "offer_id": "PH11042",
      "product_id": 313455276,
      "stock": 100,
      "warehouse_id": 22142605386000
    }
  ]
}
```

---

### 3. /v3/product/info/stocks

**Method:** `POST`

**Path:** `/v3/product/info/stocks`

**Request Body:**
```json
{
  "filter": {
    "product_id": [
      "788898745"
    ],
    "visibility": "ALL"
  },
  "last_id": "",
  "limit": 100
}
```

---

### 4. /v1/product/info/stocks-by-warehouse/fbs

**Method:** `POST`

**Path:** `/v1/product/info/stocks-by-warehouse/fbs`

**Request Body:**
```json
{
  "sku": [
    "string"
  ]
}
```

---

### 5. /v1/product/import/prices

**Method:** `POST`

**Path:** `/v1/product/import/prices`

**Request Body:**
```json
{
  "prices": [
    {
      "auto_action_enabled": "UNKNOWN",
      "currency_code": "RUB",
      "min_price": "800",
      "min_price_for_auto_actions_enabled": true,
      "offer_id": "",
      "old_price": "0",
      "price": "1448",
      "price_strategy_enabled": "UNKNOWN",
      "product_id": 1386,
      "quant_size": 1,
      "vat": "0.1"
    }
  ]
}
```

---

### 6. /v5/product/info/prices

**Method:** `POST`

**Path:** `/v4/product/info/prices`

**Request Body:**
```json
{
  "cursor": "string",
  "filter": {
    "offer_id": [
      "356792"
    ],
    "product_id": [
      "243686911"
    ],
    "visibility": "ALL"
  },
  "limit": 100
}
```

---

### 7. /v1/product/info/discounted

**Method:** `POST`

**Path:** `/v1/product/info/discounted`

**Request Body:**
```json
{
  "discounted_skus": [
    "635548518"
  ]
}
```

---

### 8. /v1/product/update/discount

**Method:** `POST`

**Path:** `/v1/product/update/discount`

**Request Body:**
```json
{
  "discount": 0,
  "product_id": 0
}
```

---

