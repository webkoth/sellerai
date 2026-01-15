# Доставка FBS

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (13 total)

### 1. /v2/posting/fbs/act/create

**Method:** `POST`

**Path:** `/v2/posting/fbs/act/create`

**Request Body:**
```json
{
  "containers_count": 1,
  "delivery_method_id": 230039077005,
  "departure_date": "2022-06-10T11:42:06.444Z"
}
```

---

### 2. /v1/posting/carriage-available/list

**Method:** `POST`

**Path:** `/v1/posting/carriage-available/list`

**Request Body:**
```json
{
  "delivery_method_id": 0,
  "departure_date": "2019-08-24T14:15:22Z"
}
```

---

### 3. /v1/carriage/get

**Method:** `POST`

**Path:** `/v1/carriage/get`

**Request Body:**
```json
{
  "carriage_id": 0
}
```

---

### 4. /v1/posting/fbs/split

**Method:** `POST`

**Path:** `/v1/posting/fbs/split`

**Request Body:**
```json
{
  "posting_number": "string",
  "postings": [
    {
      "products": [
        {
          "product_id": 0,
          "quantity": 0
        }
      ]
    }
  ]
}
```

---

### 5. /v2/posting/fbs/act/get-postings

**Method:** `POST`

**Path:** `/v2/posting/fbs/act/get-postings`

**Request Body:**
```json
{
  "id": 900000250859000
}
```

---

### 6. /v2/posting/fbs/act/get-container-labels

**Method:** `POST`

**Path:** `/v2/posting/fbs/act/get-container-labels`

**Request Body:**
```json
{
  "id": 295662811
}
```

---

### 7. /v2/posting/fbs/act/get-barcode

**Method:** `POST`

**Path:** `/v2/posting/fbs/act/get-barcode`

**Request Body:**
```json
{
  "id": "295662811"
}
```

---

### 8. /v2/posting/fbs/act/get-barcode/text

**Method:** `POST`

**Path:** `/v2/posting/fbs/act/get-barcode/text`

**Request Body:**
```json
{
  "id": "295662811"
}
```

---

### 9. /v2/posting/fbs/digital/act/check-status

**Method:** `POST`

**Path:** `/v2/posting/fbs/digital/act/check-status`

**Request Body:**
```json
{
  "id": 0
}
```

---

### 10. /v2/posting/fbs/act/get-pdf

**Method:** `POST`

**Path:** `/v2/posting/fbs/act/get-pdf`

**Request Body:**
```json
{
  "id": 22435521842000
}
```

---

### 11. /v2/posting/fbs/act/list

**Method:** `POST`

**Path:** `/v2/posting/fbs/act/list`

**Request Body:**
```json
{
  "filter": {
    "date_from": "2021-08-04",
    "date_to": "2022-08-04",
    "integration_type": "ozon",
    "status": [
      "delivered"
    ]
  },
  "limit": 100
}
```

---

### 12. /v2/posting/fbs/digital/act/get-pdf

**Method:** `POST`

**Path:** `/v2/posting/fbs/digital/act/get-pdf`

**Request Body:**
```json
{
  "id": 900000250859000,
  "doc_type": "act_of_acceptance"
}
```

---

### 13. /v2/posting/fbs/act/check-status

**Method:** `POST`

**Path:** `/v2/posting/fbs/act/check-status`

**Request Body:**
```json
{
  "id": 900000250859000
}
```

---

