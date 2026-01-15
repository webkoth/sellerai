# Обработка заказов FBS и rFBS

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (21 total)

### 1. /v3/posting/fbs/unfulfilled/list

**Method:** `POST`

**Path:** `/v3/posting/fbs/unfulfilled/list`

**Request Body:**
```json
{
  "dir": "ASC",
  "filter": {
    "cutoff_from": "2021-08-24T14:15:22Z",
    "cutoff_to": "2021-08-31T14:15:22Z",
    "delivery_method_id": [],
    "provider_id": [],
    "status": "awaiting_packaging",
    "warehouse_id": []
  },
  "limit": 100,
  "offset": 0,
  "with": {
    "analytics_data": true,
    "barcodes": true,
    "financial_data": true,
    "translit": true
  }
}
```

---

### 2. /v3/posting/fbs/list

**Method:** `POST`

**Path:** `/v3/posting/fbs/list`

**Request Body:**
```json
{
  "dir": "ASC",
  "filter": {
    "since": "2025-01-15T00:47:39.878Z",
    "status": "awaiting_deliver",
    "to": "2025-01-25T00:47:39.878Z"
  },
  "limit": 100,
  "offset": 0
}
```

---

### 3. /v3/posting/fbs/get

**Method:** `POST`

**Path:** `/v3/posting/fbs/get`

**Request Body:**
```json
{
  "posting_number": "57195475-0050-3",
  "with": {
    "analytics_data": false,
    "barcodes": false,
    "financial_data": false,
    "product_exemplars": false,
    "translit": false
  }
}
```

---

### 4. /v2/posting/fbs/get-by-barcode

**Method:** `POST`

**Path:** `/v2/posting/fbs/get-by-barcode`

**Request Body:**
```json
{
  "barcode": "20325804886000"
}
```

---

### 5. /v3/posting/multiboxqty/set

**Method:** `POST`

**Path:** `/v3/posting/multiboxqty/set`

**Request Body:**
```json
{
  "posting_number": "string",
  "multi_box_qty": 0
}
```

---

### 6. /v2/posting/fbs/product/change

**Method:** `POST`

**Path:** `/v2/posting/fbs/product/change`

**Request Body:**
```json
{
  "items": [
    {
      "sku": 1231428352,
      "weightReal": [
        0.3
      ]
    }
  ],
  "posting_number": "33920158-0006-1"
}
```

---

### 7. /v2/posting/fbs/product/country/list

**Method:** `POST`

**Path:** `/v2/posting/fbs/product/country/list`

**Request Body:**
```json
{
  "name_search": ""
}
```

---

### 8. /v2/posting/fbs/product/country/set

**Method:** `POST`

**Path:** `/v2/posting/fbs/product/country/set`

**Request Body:**
```json
{
  "country_iso_code": "NO",
  "posting_number": "57195475-0050-3",
  "product_id": 180550365
}
```

---

### 9. /v1/posting/fbs/restrictions

**Method:** `POST`

**Path:** `/v1/posting/fbs/restrictions`

**Request Body:**
```json
{
  "posting_number": "76673629-0020-1"
}
```

---

### 10. /v2/posting/fbs/package-label

**Method:** `POST`

**Path:** `/v2/posting/fbs/package-label`

**Request Body:**
```json
{
  "posting_number": [
    "48173252-0034-4"
  ]
}
```

---

### 11. /v2/posting/fbs/package-label/create

**Method:** `POST`

**Path:** `/v2/posting/fbs/package-label/create`

**Request Body:**
```json
{
  "posting_number": [
    "4708216109137",
    "3697105098026"
  ]
}
```

---

### 12. /v1/posting/fbs/package-label/get

**Method:** `POST`

**Path:** `/v1/posting/fbs/package-label/get`

**Request Body:**
```json
{
  "task_id": 0
}
```

---

### 13. /v1/posting/fbs/cancel-reason

**Method:** `POST`

**Path:** `/v1/posting/fbs/cancel-reason`

**Request Body:**
```json
{
  "related_posting_numbers": [
    "73837363-0010-3"
  ]
}
```

---

### 14. /v2/posting/fbs/cancel-reason/list

**Method:** `POST`

**Path:** `/v2/posting/fbs/cancel-reason/list`

**Request Body:**
```json
{}
```

---

### 15. /v2/posting/fbs/product/cancel

**Method:** `POST`

**Path:** `/v2/posting/fbs/product/cancel`

**Request Body:**
```json
{
  "cancel_reason_id": 352,
  "cancel_reason_message": "Product is out of stock",
  "items": [
    {
      "quantity": 5,
      "sku": 150587396
    }
  ],
  "posting_number": "33920113-1231-1"
}
```

---

### 16. /v2/posting/fbs/cancel

**Method:** `POST`

**Path:** `/v2/posting/fbs/cancel`

**Request Body:**
```json
{
  "cancel_reason_id": 352,
  "cancel_reason_message": "Product is out of stock",
  "posting_number": "33920113-1231-1"
}
```

---

### 17. /v2/posting/fbs/arbitration

**Method:** `POST`

**Path:** `/v2/posting/fbs/arbitration`

**Request Body:**
```json
{
  "posting_number": [
    "33920143-1195-1"
  ]
}
```

---

### 18. /v2/posting/fbs/awaiting-delivery

**Method:** `POST`

**Path:** `/v2/posting/fbs/awaiting-delivery`

**Request Body:**
```json
{
  "posting_number": [
    "33920143-1195-1"
  ]
}
```

---

### 19. /v1/posting/global/etgb

**Method:** `POST`

**Path:** `/v1/posting/global/etgb`

**Request Body:**
```json
{
  "date": {
    "from": "2023-02-13T12:13:16.818Z",
    "to": "2023-02-13T12:13:16.818Z"
  }
}
```

---

### 20. /v1/posting/fbs/pick-up-code/verify

**Method:** `POST`

**Path:** `/v1/posting/fbs/pick-up-code/verify`

**Request Body:**
```json
{
  "pickup_code": "string",
  "posting_number": "string"
}
```

---

### 21. /v1/posting/unpaid-legal/product/list

**Method:** `POST`

**Path:** `/v1/posting/unpaid-legal/product/list`

**Request Body:**
```json
{
  "cursor": "",
  "limit": 1000
}
```

---

