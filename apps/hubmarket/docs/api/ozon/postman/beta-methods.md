# β Прочие методы

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (13 total)

### 1. /v1/analytics/manage/stocks

**Method:** `POST`

**Path:** `/v1/analytics/manage/stocks`

**Request Body:**
```json
{
  "filter": {
    "skus": [
      "string"
    ],
    "stock_types": "STOCK_TYPE_VALID",
    "warehouse_ids": [
      "string"
    ]
  },
  "limit": 1,
  "offset": 0
}
```

---

### 2. /v1/finance/document-b2b-sales

**Method:** `POST`

**Path:** `/v1/finance/document-b2b-sales`

**Request Body:**
```json
{
  "date": "string",
  "language": "DEFAULT"
}
```

---

### 3. /v1/finance/mutual-settlement

**Method:** `POST`

**Path:** `/v1/finance/mutual-settlement`

**Request Body:**
```json
{
  "date": "string",
  "language": "DEFAULT"
}
```

---

### 4. /v4/product/info/attributes

**Method:** `POST`

**Path:** `/v4/product/info/attributes`

**Request Body:**
```json
{
  "filter": {
    "product_id": [
      "213761435"
    ],
    "offer_id": [
      "testtest5"
    ],
    "sku": [
      "123495432"
    ],
    "visibility": "ALL"
  },
  "limit": 100,
  "sort_dir": "ASC"
}
```

---

### 5. /v4/product/info/stocks

**Method:** `POST`

**Path:** `/v4/product/info/stocks`

**Request Body:**
```json
{
  "cursor": "string",
  "filter": {
    "offer_id": [
      "string"
    ],
    "product_id": [
      "string"
    ],
    "visibility": "ALL",
    "with_quant": {
      "created": true,
      "exists": true
    }
  },
  "limit": 0
}
```

---

### 6. /v2/product/certification/list

**Method:** `POST`

**Path:** `/v2/product/certification/list`

**Request Body:**
```json
{
  "page": 1,
  "page_size": 100
}
```

---

### 7. /v1/carriage/create

**Method:** `POST`

**Path:** `/v1/carriage/create`

**Request Body:**
```json
{
  "delivery_method_id": 0,
  "departure_date": "2019-08-24T14:15:22Z"
}
```

---

### 8. /v1/carriage/approve

**Method:** `POST`

**Path:** `/v1/carriage/approve`

**Request Body:**
```json
{
  "carriage_id": 0,
  "containers_count": 0
}
```

---

### 9. /v1/carriage/delivery/list

**Method:** `POST`

**Path:** `/v1/carriage/delivery/list`

**Request Body:**
```json
{
  "delivery_method_id": 0,
  "departure_date": "2019-08-24T14:15:22Z"
}
```

---

### 10. /v1/carriage/set-postings

**Method:** `POST`

**Path:** `/v1/carriage/set-postings`

**Request Body:**
```json
{
  "carriage_id": 0,
  "posting_numbers": [
    "string"
  ]
}
```

---

### 11. /v1/carriage/cancel

**Method:** `POST`

**Path:** `/v1/carriage/cancel`

**Request Body:**
```json
{
  "carriage_id": 0
}
```

---

### 12. /v1/product/action/timer/update

**Method:** `POST`

**Path:** `/v1/product/action/timer/update`

**Request Body:**
```json
{
  "product_ids": [
    "string"
  ]
}
```

---

### 13. /v1/product/action/timer/status

**Method:** `POST`

**Path:** `/v1/product/action/timer/status`

**Request Body:**
```json
{
  "product_ids": [
    "string"
  ]
}
```

---

