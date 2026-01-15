# Накладные

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (4 total)

### 1. /v2/invoice/create-or-update

**Method:** `POST`

**Path:** `/v2/invoice/create-or-update`

**Request Body:**
```json
{
  "HS_code": [
    {
      "sku": "SKU123",
      "code": "534758761999"
    },
    {
      "sku": "SKU456",
      "code": "534758761000"
    },
    {
      "sku": "SKU789",
      "code": "534758761777"
    }
  ],
  "date": "2023-08-01T12:08:44.342Z",
  "number": "424fdsf234",
  "posting_number": "33920146-0252-1",
  "price": 234.34,
  "price_currency": "RUB",
  "url": "https://cdn.ozone.ru/s3/ozon-disk-api/techdoc/seller-api/earsivfatura_1690960445.pdf"
}
```

---

### 2. /v1/invoice/file/upload

**Method:** `POST`

**Path:** `/v1/invoice/file/upload`

**Request Body:**
```json
{
  "base64_content": "string",
  "posting_number": "string"
}
```

---

### 3. /v2/invoice/get

**Method:** `POST`

**Path:** `/v2/invoice/get`

**Request Body:**
```json
{
  "posting_number": "string"
}
```

---

### 4. /v1/invoice/delete

**Method:** `POST`

**Path:** `/v1/invoice/delete`

**Request Body:**
```json
{
  "posting_number": "string"
}
```

---

