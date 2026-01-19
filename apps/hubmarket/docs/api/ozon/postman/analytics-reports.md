# Аналитические отчёты

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (3 total)

### 1. /v1/analytics/data

**Method:** `POST`

**Path:** `/v1/analytics/data`

**Request Body:**
```json
{
  "date_from": "2020-09-01",
  "date_to": "2021-10-15",
  "metrics": [
    "hits_view_search"
  ],
  "dimension": [
    "sku",
    "day"
  ],
  "filters": [],
  "sort": [
    {
      "key": "hits_view_search",
      "order": "DESC"
    }
  ],
  "limit": 1000,
  "offset": 0
}
```

---

### 2. /v2/analytics/stock_on_warehouses

**Method:** `POST`

**Path:** `/v2/analytics/stock_on_warehouses`

**Request Body:**
```json
{
  "limit": 1000,
  "offset": 0,
  "warehouse_type": "ALL"
}
```

---

### 3. /v1/analytics/turnover/stocks

**Method:** `POST`

**Path:** `/v1/analytics/turnover/stocks`

**Request Body:**
```json
{
  "limit": 1,
  "offset": 0,
  "sku": [
    "string"
  ]
}
```

---

