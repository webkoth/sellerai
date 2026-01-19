# Загрузка и обновление товаров

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (22 total)

### 1. /v3/product/import

**Method:** `POST`

**Path:** `/v3/product/import`

**Request Body:**
```json
{
  "items": [
    {
      "attributes": [
        {
          "complex_id": 0,
          "id": 5076,
          "values": [
            {
              "dictionary_value_id": 971082156,
              "value": "Стойка для акустической системы"
            }
          ]
        },
        {
          "complex_id": 0,
          "id": 9048,
          "values": [
            {
              "value": "Комплект защитных плёнок для X3 NFC. Темный хлопок"
            }
          ]
        },
        {
          "complex_id": 0,
          "id": 85,
          "values": [
            {
              "dictionary_value_id": 5060050,
              "value": "Samsung"
            }
          ]
        },
        {
          "complex_id": 0,
          "id": 10096,
          "values": [
            {
              "dictionary_value_id": 61576,
              "value": "серый"
            }
          ]
        }
      ],
      "barcode": "112772873170",
      "description_category_id": 17028922,
      "type_id": 95911,
      "color_image": "",
      "complex_attributes": [],
      "currency_code": "RUB",
      "depth": 10,
      "dimension_unit": "mm",
      "height": 250,
      "images": [],
      "images360": [],
      "name": "Комплект защитных плёнок для X3 NFC. Темный хлопок",
      "offer_id": "143210608",
      "old_price": "1100",
      "pdf_list": [],
      "price": "1000",
      "primary_image": "",
      "vat": "0.1",
      "weight": 100,
      "weight_unit": "g",
      "width": 150
    }
  ]
}
```

---

### 2. /v1/product/import/info

**Method:** `POST`

**Path:** `/v1/product/import/info`

**Request Body:**
```json
{
  "task_id": "172549793"
}
```

---

### 3. /v1/product/import-by-sku

**Method:** `POST`

**Path:** `/v1/product/import-by-sku`

**Request Body:**
```json
{
  "items": [
    {
      "sku": 298789742,
      "name": "string",
      "offer_id": "91132",
      "currency_code": "RUB",
      "old_price": "2590",
      "price": "2300",
      "vat": "0.1"
    }
  ]
}
```

---

### 4. /v1/product/attributes/update

**Method:** `POST`

**Path:** `/v1/product/attributes/update`

**Request Body:**
```json
{
  "items": [
    {
      "attributes": [
        {
          "complex_id": 0,
          "id": 0,
          "values": [
            {
              "dictionary_value_id": 0,
              "value": "string"
            }
          ]
        }
      ],
      "offer_id": "string"
    }
  ]
}
```

---

### 5. /v1/product/pictures/import

**Method:** `POST`

**Path:** `/v1/product/pictures/import`

**Request Body:**
```json
{
  "color_image": "string",
  "images": [
    "string"
  ],
  "images360": [
    "string"
  ],
  "product_id": 0
}
```

---

### 6. /v2/product/pictures/info

**Method:** `POST`

**Path:** `/v2/product/pictures/info`

**Request Body:**
```json
{
  "product_id": [
    "string"
  ]
}
```

---

### 7. /v2/product/list

**Method:** `POST`

**Path:** `/v2/product/list`

**Request Body:**
```json
{
  "filter": {
    "offer_id": [
      "136748"
    ],
    "product_id": [
      "223681945"
    ],
    "visibility": "ALL"
  },
  "last_id": "",
  "limit": 100
}
```

---

### 8. /v3/product/list

**Method:** `POST`

**Path:** `/v2/product/list`

**Request Body:**
```json
{
  "filter": {
    "offer_id": [
      "136748"
    ],
    "product_id": [
      "223681945"
    ],
    "visibility": "ALL"
  },
  "last_id": "",
  "limit": 100
}
```

---

### 9. /v3/product/info/list

**Method:** `POST`

**Path:** `/v3/product/info/list`

**Request Body:**
```json
{
  "offer_id": [
    "string"
  ],
  "product_id": [
    "string"
  ],
  "sku": [
    "string"
  ]
}
```

---

### 10. /v1/product/rating-by-sku

**Method:** `POST`

**Path:** `/v1/product/rating-by-sku`

**Request Body:**
```json
{
  "skus": [
    "179737222"
  ]
}
```

---

### 11. /v3/products/info/attributes

**Method:** `POST`

**Path:** `/v3/products/info/attributes`

**Request Body:**
```json
{
  "filter": {
    "product_id": [
      "213761435"
    ],
    "visibility": "ALL"
  },
  "limit": 100,
  "last_id": "okVsfA==«",
  "sort_dir": "ASC"
}
```

---

### 12. /v4/products/info/attributes

**Method:** `POST`

**Path:** `/v4/products/info/attributes`

**Request Body:**
```json
{
  "filter": {
    "product_id": [
      "213761435"
    ],
    "offer_id": [
      "testtest5"
    ],
    "sku": [
      "123495432"
    ],
    "visibility": "ALL"
  },
  "limit": 100,
  "sort_dir": "ASC"
}
```

---

### 13. /v1/product/info/description

**Method:** `POST`

**Path:** `/v1/product/info/description`

**Request Body:**
```json
{
  "offer_id": "5",
  "product_id": 73453843
}
```

---

### 14. /v4/product/info/limit

**Method:** `POST`

**Path:** `/v4/product/info/limit`

**Request Body:**
```json
{}
```

---

### 15. /v1/product/update/offer-id

**Method:** `POST`

**Path:** `/v1/product/update/offer-id`

**Request Body:**
```json
{
  "update_offer_id": [
    {
      "new_offer_id": "string",
      "offer_id": "string"
    }
  ]
}
```

---

### 16. /v1/product/archive

**Method:** `POST`

**Path:** `/v1/product/archive`

**Request Body:**
```json
{
  "product_id": [
    "125529926"
  ]
}
```

---

### 17. /v1/product/unarchive

**Method:** `POST`

**Path:** `/v1/product/unarchive`

**Request Body:**
```json
{
  "product_id": [
    "125529926"
  ]
}
```

---

### 18. /v2/products/delete

**Method:** `POST`

**Path:** `/v2/products/delete`

**Request Body:**
```json
{
  "products": [
    {
      "offer_id": "033"
    }
  ]
}
```

---

### 19. /v1/product/upload_digital_codes

**Method:** `POST`

**Path:** `/v1/product/upload_digital_codes`

**Request Body:**
```json
{
  "digital_codes": [
    "764282654334"
  ],
  "product_id": 73160317
}
```

---

### 20. /v1/product/upload_digital_codes/info

**Method:** `POST`

**Path:** `/v1/product/upload_digital_codes/info`

**Request Body:**
```json
{
  "task_id": 178574231
}
```

---

### 21. /v1/product/info/subscription

**Method:** `POST`

**Path:** `/v1/product/info/subscription`

**Request Body:**
```json
{
  "skus": [
    "string"
  ]
}
```

---

### 22. /v1/product/related-sku/get

**Method:** `POST`

**Path:** `/v1/product/related-sku/get`

**Request Body:**
```json
{
  "skus": [
    "string"
  ]
}
```

---

