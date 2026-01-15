# Финансовые отчёты

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (3 total)

### 1. /v2/finance/realization

**Method:** `POST`

**Path:** `/v2/finance/realization`

**Request Body:**
```json
{
  "month": 0,
  "year": 0
}
```

---

### 2. /v3/finance/transaction/list

**Method:** `POST`

**Path:** `/v3/finance/transaction/list`

**Request Body:**
```json
{
      "filter": {
          "date": {
              "from": "2024-12-16T00:00:00.000Z",
              "to": "2024-12-22T23:59:59.000Z"
          },
          "operation_type": [],
          "posting_number": "",
          "transaction_type": "all"
      },
      "page": 1,
      "page_size": 1000
  }
```

---

### 3. /v3/finance/transaction/totals

**Method:** `POST`

**Path:** `/v3/finance/transaction/totals`

**Request Body:**
```json
{
  "date": {
    "from": "2021-11-01T00:00:00.000Z",
    "to": "2021-11-02T00:00:00.000Z"
  },
  "posting_number": "",
  "transaction_type": "all"
}
```

---

