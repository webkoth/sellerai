# Сертификаты качества

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (14 total)

### 1. /v1/product/certificate/accordance-types

**Method:** `GET`

**Path:** `/v1/product/certificate/accordance-types`

---

### 2. /v2/product/certificate/accordance-types/list

**Method:** `GET`

**Path:** `/v2/product/certificate/accordance-types/list`

---

### 3. /v1/product/certificate/types

**Method:** `GET`

**Path:** `/v1/product/certificate/types`

---

### 4. /v1/product/certification/list

**Method:** `POST`

**Path:** `/v1/product/certification/list`

**Request Body:**
```json
{
  "page": 1,
  "page_size": 100
}
```

---

### 5. /v1/product/certificate/create

**Method:** `POST`

**Path:** `/v1/product/certificate/create`

**Request Body:**
```json
{
  "files": ["..."],
  "name": "string",
  "number": "100052",
  "type_code": "declaration",
  "issue_date": "2021-04-30T11:31:26Z"
}
```

---

### 6. /v1/product/certificate/bind

**Method:** `POST`

**Path:** `/v1/product/certificate/bind`

**Request Body:**
```json
{
  "certificate_id": 50058,
  "product_id": [
    290
  ]
}
```

---

### 7. /v1/product/certificate/delete

**Method:** `POST`

**Path:** `/v1/product/certificate/delete`

**Request Body:**
```json
{
  "certificate_id": 0
}
```

---

### 8. /v1/product/certificate/info

**Method:** `POST`

**Path:** `/v1/product/certificate/info`

**Request Body:**
```json
{
  "certificate_number": "string"
}
```

---

### 9. /v1/product/certificate/list

**Method:** `POST`

**Path:** `/v1/product/certificate/list`

**Request Body:**
```json
{
  "offer_id": "string",
  "status": "string",
  "type": "string",
  "page": 1,
  "page_size": 50
}
```

---

### 10. /v1/product/certificate/product_status/list

**Method:** `POST`

**Path:** `/v1/product/certificate/product_status/list`

**Request Body:**
```json
{}
```

---

### 11. /v1/product/certificate/products/list

**Method:** `POST`

**Path:** `/v1/product/certificate/products/list`

**Request Body:**
```json
{
  "certificate_id": 0,
  "product_status_code": "string",
  "page": 0,
  "page_size": 0
}
```

---

### 12. /v1/product/certificate/unbind

**Method:** `POST`

**Path:** `/v1/product/certificate/unbind`

**Request Body:**
```json
{
  "certificate_id": 0,
  "product_id": [
    "string"
  ]
}
```

---

### 13. /v1/product/certificate/rejection_reasons/list

**Method:** `POST`

**Path:** `/v1/product/certificate/rejection_reasons/list`

**Request Body:**
```json
{}
```

---

### 14. /v1/product/certificate/status/list

**Method:** `POST`

**Path:** `/v1/product/certificate/status/list`

**Request Body:**
```json
{}
```

---

