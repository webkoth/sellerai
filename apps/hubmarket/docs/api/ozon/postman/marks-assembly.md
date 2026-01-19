# Управление кодами маркировки и сборкой заказов для FBS/rFBS

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (6 total)

### 1. /v4/fbs/posting/product/exemplar/validate

**Method:** `POST`

**Path:** `/v4/fbs/posting/product/exemplar/validate`

**Request Body:**
```json
{
  "posting_number": "23281294-0063-2",
  "products": [
    {
      "exemplars": [
        {
          "gtd": "",
          "mandatory_mark": "010290000151642731tVMohkbfFgunB",
          "jw_uin": ""
        }
      ],
      "product_id": 476925391
    }
  ]
}
```

---

### 2. /v5/fbs/posting/product/exemplar/set

**Method:** `POST`

**Path:** `/v5/fbs/posting/product/exemplar/set`

**Request Body:**
```json
{
  "multi_box_qty": 0,
  "posting_number": "string",
  "products": [
    {
      "exemplars": [
        {
          "exemplar_id": 0,
          "gtd": "string",
          "is_gtd_absent": true,
          "is_rnpt_absent": true,
          "mandatory_mark": "string",
          "rnpt": "string",
          "jw_uin": "string"
        }
      ],
      "is_gtd_needed": true,
      "is_mandatory_mark_needed": true,
      "is_rnpt_needed": true,
      "product_id": 0,
      "quantity": 0
    }
  ]
}
```

---

### 3. /v4/fbs/posting/product/exemplar/status

**Method:** `POST`

**Path:** `/v4/fbs/posting/product/exemplar/status`

**Request Body:**
```json
{
    "posting_number": "18373555-0124-2"
}
```

---

### 4. /v5/fbs/posting/product/exemplar/create-or-get

**Method:** `POST`

**Path:** `/v5/fbs/posting/product/exemplar/create-or-get`

**Request Body:**
```json
{
  "posting_number": "string"
}
```

---

### 5. /v4/posting/fbs/ship

**Method:** `POST`

**Path:** `/v4/posting/fbs/ship`

**Request Body:**
```json
{
  "packages": [
    {
      "products": [
        {
          "product_id": 185479045,
          "quantity": 1
        }
      ]
    }
  ],
  "posting_number": "89491381-0072-1",
  "with": {
    "additional_data": true
  }
}
```

---

### 6. /v4/posting/fbs/ship/package

**Method:** `POST`

**Path:** `/v4/posting/fbs/ship/package`

**Request Body:**
```json
{
  "posting_number": "string",
  "products": [
    {
      "exemplarsIds": [
        "string"
      ],
      "product_id": 0,
      "quantity": 0
    }
  ]
}
```

---

