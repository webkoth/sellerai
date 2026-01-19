# Стратегии ценообразования

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (12 total)

### 1. /v1/pricing-strategy/competitors/list

**Method:** `POST`

**Path:** `/v1/pricing-strategy/competitors/list`

**Request Body:**
```json
{
  "page": 1,
  "limit": 50
}
```

---

### 2. /v1/pricing-strategy/list

**Method:** `POST`

**Path:** `/v1/pricing-strategy/list`

**Request Body:**
```json
{
  "page": 1,
  "limit": 50
}
```

---

### 3. /v1/pricing-strategy/create

**Method:** `POST`

**Path:** `/v1/pricing-strategy/create`

**Request Body:**
```json
{
  "strategy_name": "Новая стратегия",
  "competitors": [
    {
      "competitor_id": 1008426,
      "coefficient": 1
    },
    {
      "competitor_id": 204,
      "coefficient": 1
    },
    {
      "competitor_id": 91,
      "coefficient": 1
    },
    {
      "competitor_id": 48,
      "coefficient": 1
    }
  ],
  "company_id": 7
}
```

---

### 4. /v1/pricing-strategy/info

**Method:** `POST`

**Path:** `/v1/pricing-strategy/info`

**Request Body:**
```json
{
  "strategy_id": "string"
}
```

---

### 5. /v1/pricing-strategy/update

**Method:** `POST`

**Path:** `/v1/pricing-strategy/update`

**Request Body:**
```json
{
  "strategy_id": "a3de1826-9c54-40f1-bb6d-1a9e2638b058",
  "strategy_name": "Новая стратегия",
  "competitors": [
    {
      "competitor_id": 1008426,
      "coefficient": 1
    },
    {
      "competitor_id": 204,
      "coefficient": 1
    },
    {
      "competitor_id": 91,
      "coefficient": 1
    },
    {
      "competitor_id": 48,
      "coefficient": 1
    },
    {
      "id": 45,
      "coefficient": 1
    }
  ]
}
```

---

### 6. /v1/pricing-strategy/products/add

**Method:** `POST`

**Path:** `/v1/pricing-strategy/products/add`

**Request Body:**
```json
{
  "product_id": [
    "29209"
  ],
  "strategy_id": "e29114f0-177d-4160-8d06-2bc528470dda"
}
```

---

### 7. /v1/pricing-strategy/strategy-ids-by-product-ids

**Method:** `POST`

**Path:** `/v1/pricing-strategy/strategy-ids-by-product-ids`

**Request Body:**
```json
{
  "product_id": [
    "string"
  ]
}
```

---

### 8. v1/pricing-strategy/products/list

**Method:** `POST`

**Path:** `/v1/pricing-strategy/products/list`

**Request Body:**
```json
{
  "strategy_id": "string"
}
```

---

### 9. /v1/pricing-strategy/product/info

**Method:** `POST`

**Path:** `/v1/pricing-strategy/product/info`

**Request Body:**
```json
{
  "product_id": 0
}
```

---

### 10. /v1/pricing-strategy/products/delete

**Method:** `POST`

**Path:** `/v1/pricing-strategy/products/delete`

**Request Body:**
```json
{
  "product_id": [
    "string"
  ]
}
```

---

### 11. /v1/pricing-strategy/status

**Method:** `POST`

**Path:** `/v1/pricing-strategy/status`

**Request Body:**
```json
{
  "strategy_id": "c7516438-7124-4e2c-85d3-ccd92b6b9b65",
  "enabled": true
}
```

---

### 12. /v1/pricing-strategy/delete

**Method:** `POST`

**Path:** `/v1/pricing-strategy/delete`

**Request Body:**
```json
{
  "strategy_id": "string"
}
```

---

