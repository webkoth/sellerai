# Возвраты товаров rFBS

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (7 total)

### 1. /v2/returns/rfbs/list

**Method:** `POST`

**Path:** `/v2/returns/rfbs/list`

**Request Body:**
```json
{
  "filter": {
    "offer_id": "string",
    "posting_number": "string",
    "group_state": [
      "string"
    ],
    "created_at": {
      "from": "2019-08-24T14:15:22Z",
      "to": "2019-08-24T14:15:22Z"
    }
  },
  "last_id": 0,
  "limit": 0
}
```

---

### 2. /v2/returns/rfbs/get

**Method:** `POST`

**Path:** `/v2/returns/rfbs/get`

**Request Body:**
```json
{
  "return_id": 0
}
```

---

### 3. /v2/returns/rfbs/reject

**Method:** `POST`

**Path:** `/v2/returns/rfbs/reject`

**Request Body:**
```json
{
  "return_id": 0,
  "comment": "string",
  "rejection_reason_id": 0
}
```

---

### 4. /v2/returns/rfbs/compensate

**Method:** `POST`

**Path:** `/v2/returns/rfbs/compensate`

**Request Body:**
```json
{
  "compensation_amount": "string",
  "return_id": 0
}
```

---

### 5. /v2/returns/rfbs/verify

**Method:** `POST`

**Path:** `/v2/returns/rfbs/verify`

**Request Body:**
```json
{
  "return_id": 0,
  "return_method_description": "string"
}
```

---

### 6. /v2/returns/rfbs/receive-return

**Method:** `POST`

**Path:** `/v2/returns/rfbs/receive-return`

**Request Body:**
```json
{
  "return_id": 0
}
```

---

### 7. /v2/returns/rfbs/return-money

**Method:** `POST`

**Path:** `/v2/returns/rfbs/return-money`

**Request Body:**
```json
{
  "return_id": 0,
  "return_for_back_way": 0
}
```

---

