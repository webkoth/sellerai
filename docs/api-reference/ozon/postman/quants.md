# β Работа с квантами

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (6 total)

### 1. /v1/product/quant/list

**Method:** `POST`

**Path:** `/v1/product/quant/list`

**Request Body:**
```json
{
  "cursor": "string",
  "limit": 0,
  "visibility": "ALL"
}
```

---

### 2. /v1/product/quant/info

**Method:** `POST`

**Path:** `/v1/product/quant/info`

**Request Body:**
```json
{
  "quant_code": [
    "string"
  ]
}
```

---

### 3. /v1/quant/list

**Method:** `POST`

**Path:** `/v1/quant/list`

**Request Body:**
```json
{
  "cursor": "string",
  "filter": {
    "created_at": {
      "from": "2019-08-24T14:15:22Z",
      "to": "2019-08-24T14:15:22Z"
    },
    "cutoff": {
      "from": "2019-08-24T14:15:22Z",
      "to": "2019-08-24T14:15:22Z"
    },
    "destination_place_id": 0,
    "inv_quant_ids": [
      "string"
    ],
    "offer_id": "string",
    "sku_name": "string",
    "statuses": [
      "unknown"
    ],
    "warehouse_id": 0
  },
  "limit": 0,
  "sort": "string",
  "sort_dir": "string"
}
```

---

### 4. /v1/quant/get

**Method:** `POST`

**Path:** `/v1/quant/get`

**Request Body:**
```json
{
  "inv_quant_id": 0
}
```

---

### 5. /v1/quant/ship

**Method:** `POST`

**Path:** `/v1/quant/ship`

**Request Body:**
```json
{
  "inv_quant_id": 0
}
```

---

### 6. /v1/quant/status

**Method:** `POST`

**Path:** `/v1/quant/status`

**Request Body:**
```json
{
  "inv_quant_id": 0
}
```

---

