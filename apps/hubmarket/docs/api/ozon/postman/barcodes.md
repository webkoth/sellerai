# Штрихкоды товаров

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (2 total)

### 1. /v1/barcode/add

**Method:** `POST`

**Path:** `/v1/barcode/add`

**Request Body:**
```json
{
  "barcodes": [
    {
      "barcode": "string",
      "sku": 0
    }
  ]
}
```

---

### 2. /v1/barcode/generate

**Method:** `POST`

**Path:** `/v1/barcode/generate`

**Request Body:**
```json
{
  "product_ids": [
    "string"
  ]
}
```

---

