# Атрибуты и характеристики Ozon

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (4 total)

### 1. /v1/description-category/tree

**Method:** `POST`

**Path:** `/v1/description-category/tree`

**Request Body:**
```json
{
  "language": "DEFAULT"
}
```

---

### 2. /v1/description-category/attribute

**Method:** `POST`

**Path:** `/v1/description-category/attribute`

**Request Body:**
```json
{
  "description_category_id": 200000933,
  "language": "DEFAULT",
  "type_id": 93080
}
```

---

### 3. /v1/description-category/attribute/values

**Method:** `POST`

**Path:** `/v1/description-category/attribute/values`

**Request Body:**
```json
{
  "attribute_id": 85,
  "description_category_id": 17054869,
  "language": "DEFAULT",
  "last_value_id": 0,
  "limit": 100,
  "type_id": 97311
}
```

---

### 4. /v1/description-category/attribute/values/search

**Method:** `POST`

**Path:** `/v1/description-category/attribute/values/search`

**Request Body:**
```json
{
  "attribute_id": 0,
  "description_category_id": 0,
  "limit": 0,
  "type_id": 0,
  "value": "string"
}
```

---

