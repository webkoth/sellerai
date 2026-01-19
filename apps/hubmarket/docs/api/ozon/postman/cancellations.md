# Отмены заказов

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (4 total)

### 1. /v1/conditional-cancellation/get

**Method:** `POST`

**Path:** `/v1/conditional-cancellation/get`

**Request Body:**
```json
{
  "cancellation_id": 90066344
}
```

---

### 2. /v1/conditional-cancellation/list

**Method:** `POST`

**Path:** `/v1/conditional-cancellation/list`

**Request Body:**
```json
{
  "filters": {
    "cancellation_initiator": [
      "CLIENT"
    ],
    "posting_number": [],
    "state": "ALL"
  },
  "limit": 2,
  "offset": 0,
  "with": {
    "counters": true
  }
}
```

---

### 3. /v1/conditional-cancellation/approve

**Method:** `POST`

**Path:** `/v1/conditional-cancellation/approve`

**Request Body:**
```json
{
  "cancellation_id": 74393917
}
```

---

### 4. /v1/conditional-cancellation/reject

**Method:** `POST`

**Path:** `/v1/conditional-cancellation/reject`

**Request Body:**
```json
{
  "cancellation_id": 52394916,
  "comment": "Заявка на отмену отклоняется. Заказ будет доставлен в указанные сроки. При необходимости вы можете оформить возврат."
}
```

---

