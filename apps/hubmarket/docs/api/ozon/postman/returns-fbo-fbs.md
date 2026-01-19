# Возвраты товаров FBO и FBS

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (1 total)

### 1. /v1/returns/list

**Method:** `POST`

**Path:** `/v1/returns/list`

**Request Body:**
```json
{
  "filter": {
    "logistic_return_date": {
      "time_from": "2019-08-24T14:15:22Z",
      "time_to": "2019-08-24T14:15:22Z"
    },
    "storage_tariffication_start_date": {
      "time_from": "2019-08-24T14:15:22Z",
      "time_to": "2019-08-24T14:15:22Z"
    },
    "visual_status_change_moment": {
      "time_from": "2019-08-24T14:15:22Z",
      "time_to": "2019-08-24T14:15:22Z"
    },
    "order_id": "0",
    "posting_numbers": [
      "string"
    ],
    "product_name": "string",
    "offer_id": "string",
    "visual_status_name": "string",
    "warehouse_id": "911",
    "barcode": "string",
    "return_schema": "FBO"
  },
  "limit": 500,
  "last_id": 0
}
```

---

