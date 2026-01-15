# Отчёты

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (8 total)

### 1. /v1/report/info

**Method:** `POST`

**Path:** `/v1/report/info`

**Request Body:**
```json
{
  "code": "REPORT_seller_products_924336_1720170405_a9ea2f27-a473-4b13-99f9-d0cfcb5b1a69"
}
```

---

### 2. /v1/report/list

**Method:** `POST`

**Path:** `/v1/report/list`

**Request Body:**
```json
{
  "page": 0,
  "page_size": 1000,
  "report_type": "ALL"
}
```

---

### 3. /v1/report/products/create

**Method:** `POST`

**Path:** `/v1/report/products/create`

**Request Body:**
```json
{
  "language": "DEFAULT",
  "offer_id": [],
  "search": "",
  "sku": [],
  "visibility": "ALL"
}
```

---

### 4. /v2/report/returns/create

**Method:** `POST`

**Path:** `/v2/report/returns/create`

**Request Body:**
```json
{
  "filter": {
    "delivery_schema": "fbs",
    "date_from": "2024-09-16T00:00:00.000Z",
    "date_to": "2024-09-19T23:59:59.999Z",
    "status": "MovingToSeller"
  },
  "language": "DEFAULT"
}
```

---

### 5. /v1/report/postings/create

**Method:** `POST`

**Path:** `/v1/report/postings/create`

**Request Body:**
```json
{
  "filter": {
    "processed_at_from": "2021-09-02T17:10:54.861Z",
    "processed_at_to": "2021-11-02T17:10:54.861Z",
    "delivery_schema": [
      "fbo"
    ],
    "sku": [],
    "cancel_reason_id": [],
    "offer_id": "",
    "status_alias": [],
    "statuses": [],
    "title": ""
  },
  "language": "DEFAULT"
}
```

---

### 6. /v1/finance/cash-flow-statement/list

**Method:** `POST`

**Path:** `/v1/finance/cash-flow-statement/list`

**Request Body:**
```json
{
  "date": {
    "from": "2022-01-01T00:00:00.000Z",
    "to": "2022-12-31T00:00:00.000Z"
  },
  "with_details": true,
  "page": 1,
  "page_size": 1
}
```

---

### 7. /v1/report/discounted/create

**Method:** `POST`

**Path:** `/v1/report/discounted/create`

**Request Body:**
```json
{}
```

---

### 8. /v1/report/warehouse/stock

**Method:** `POST`

**Path:** `/v1/report/warehouse/stock`

**Request Body:**
```json
{
  "language": "DEFAULT",
  "warehouseId": [
    "string"
  ]
}
```

---

