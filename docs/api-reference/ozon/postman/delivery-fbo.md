# Доставка FBO

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (13 total)

### 1. /v2/posting/fbo/list

**Method:** `POST`

**Path:** `/v2/posting/fbo/list`

**Request Body:**
```json
{
  "dir": "ASC",
  "filter": {
    "since": "2021-09-01T00:00:00.000Z",
    "status": "",
    "to": "2021-11-17T10:44:12.828Z"
  },
  "limit": 5,
  "offset": 0,
  "translit": true,
  "with": {
    "analytics_data": true,
    "financial_data": true
  }
}
```

---

### 2. /v2/posting/fbo/get

**Method:** `POST`

**Path:** `/v2/posting/fbo/get`

**Request Body:**
```json
{
  "posting_number": "50520644-0012-7",
  "translit": true,
  "with": {
    "analytics_data": true,
    "financial_data": true
  }
}
```

---

### 3. /v1/posting/fbo/cancel-reason/list

**Method:** `POST`

**Path:** `/v1/posting/fbo/cancel-reason/list`

**Request Body:**
```json
{}
```

---

### 4. /v1/supply-order/status/counter

**Method:** `POST`

**Path:** `/v1/supply-order/status/counter`

**Request Body:**
```json
{}
```

---

### 5. /v2/supply-order/list

**Method:** `POST`

**Path:** `/v2/supply-order/list`

**Request Body:**
```json
{
  "filter": {
    "states": [
      "ORDER_STATE_DATA_FILLING"
    ]
  },
  "paging": {
    "from_supply_order_id": 0,
    "limit": 0
  }
}
```

---

### 6. /v2/supply-order/get

**Method:** `POST`

**Path:** `/v2/supply-order/get`

**Request Body:**
```json
{
  "order_ids": [
    "string"
  ]
}
```

---

### 7. /v1/supply-order/bundle

**Method:** `POST`

**Path:** `/v1/supply-order/bundle`

**Request Body:**
```json
{
  "bundle_ids": [
    "string"
  ],
  "is_asc": true,
  "limit": 0,
  "query": "string",
  "sort_field": "UNSPECIFIED"
}
```

---

### 8. /v1/supply-order/timeslot/get

**Method:** `POST`

**Path:** `/v1/supply-order/timeslot/get`

**Request Body:**
```json
{
  "supply_order_id": 0
}
```

---

### 9. /v1/supply-order/timeslot/update

**Method:** `POST`

**Path:** `/v1/supply-order/timeslot/update`

**Request Body:**
```json
{
  "supply_order_id": 0,
  "timeslot": {
    "from": "2019-08-24T14:15:22Z",
    "to": "2019-08-24T14:15:22Z"
  }
}
```

---

### 10. /v1/supply-order/timeslot/status

**Method:** `POST`

**Path:** `/v1/supply-order/timeslot/status`

**Request Body:**
```json
{
  "operation_id": "string"
}
```

---

### 11. /v1/supply-order/pass/create

**Method:** `POST`

**Path:** `/v1/supply-order/pass/create`

**Request Body:**
```json
{
  "supply_order_id": 0,
  "vehicle": {
    "driver_name": "string",
    "driver_phone": "string",
    "vehicle_model": "string",
    "vehicle_number": "string"
  }
}
```

---

### 12. /v1/supply-order/pass/status

**Method:** `POST`

**Path:** `/v1/supply-order/pass/status`

**Request Body:**
```json
{
  "operation_id": "string"
}
```

---

### 13. /v1/supplier/available_warehouses

**Method:** `GET`

**Path:** `/v1/supplier/available_warehouses`

**Request Body:**
```json
{}
```

---

