# Акции

Для продвижения товаров участвуйте в акциях, которые Ozon проводит для покупателей. Подробнее об акциях в [Базе знаний продавца](https://seller-edu.ozon.ru/docs/how-to-sell-effectively/promo/promo.html).

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (12 total)

### 1. /v1/actions

**Method:** `GET`

**Path:** `/v1/actions`

---

### 2. /v1/actions/candidates

**Method:** `POST`

**Path:** `/v1/actions/candidates`

**Request Body:**
```json
{
  "action_id": 63337,
  "limit": 10,
  "offset": 0
}
```

---

### 3. /v1/actions/products

**Method:** `POST`

**Path:** `/v1/actions/products`

**Request Body:**
```json
{
  "action_id": 66011,
  "limit": 10,
  "offset": 0
}
```

---

### 4. /v1/actions/products/activate

**Method:** `POST`

**Path:** `/v1/actions/products/activate`

**Request Body:**
```json
{
  "action_id": 60564,
  "products": [
    {
      "action_price": 356,
      "product_id": 1389,
      "stock": 10
    }
  ]
}
```

---

### 5. /v1/actions/products/deactivate

**Method:** `POST`

**Path:** `/v1/actions/products/deactivate`

**Request Body:**
```json
{
  "action_id": 66011,
  "product_ids": [
    14975
  ]
}
```

---

### 6. /v1/actions/hotsales/list

**Method:** `POST`

**Path:** `/v1/actions/hotsales/list`

**Request Body:**
```json
{}
```

---

### 7. /v1/actions/hotsales/products

**Method:** `POST`

**Path:** `/v1/actions/hotsales/products`

**Request Body:**
```json
{
  "hotsale_id": 0,
  "limit": 0,
  "offset": 0
}
```

---

### 8. /v1/actions/hotsales/activate

**Method:** `POST`

**Path:** `/v1/actions/hotsales/activate`

**Request Body:**
```json
{
  "hotsale_id": 0,
  "products": [
    {
      "action_price": 0,
      "product_id": 0,
      "stock": 0
    }
  ]
}
```

---

### 9. /v1/actions/hotsales/deactivate

**Method:** `POST`

**Path:** `/v1/actions/hotsales/deactivate`

**Request Body:**
```json
{
  "hotsale_id": 0,
  "product_ids": [
    0
  ]
}
```

---

### 10. /v1/actions/discounts-task/list

**Method:** `POST`

**Path:** `/v1/actions/discounts-task/list`

**Request Body:**
```json
{
  "status": "NEW",
  "page": 1,
  "limit": 50
}
```

---

### 11. /v1/actions/discounts-task/approve

**Method:** `POST`

**Path:** `/v1/actions/discounts-task/approve`

**Request Body:**
```json
{
  "tasks": [
    {
      "id": 0,
      "approved_price": 0,
      "seller_comment": "string",
      "approved_quantity_min": 0,
      "approved_quantity_max": 0
    }
  ]
}
```

---

### 12. /v1/actions/discounts-task/decline

**Method:** `POST`

**Path:** `/v1/actions/discounts-task/decline`

**Request Body:**
```json
{
  "tasks": [
    {
      "id": 0,
      "seller_comment": "string"
    }
  ]
}
```

---

