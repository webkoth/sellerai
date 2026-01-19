# Пропуски

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (7 total)

### 1. /v1/pass/list

**Method:** `POST`

**Path:** `/v1/pass/list`

**Request Body:**
```json
{
  "cursor": "string",
  "filter": {
    "arrival_pass_ids": [
      "string"
    ],
    "arrival_reason": "string",
    "dropoff_point_ids": [
      "string"
    ],
    "only_active_passes": true,
    "warehouse_ids": [
      "string"
    ]
  },
  "limit": 0
}
```

---

### 2. /v1/carriage/pass/create

**Method:** `POST`

**Path:** `/v1/carriage/pass/create`

**Request Body:**
```json
{
  "arrival_passes": [
    {
      "driver_name": "string",
      "driver_phone": "string",
      "vehicle_license_plate": "string",
      "vehicle_model": "string",
      "with_returns": true
    }
  ],
  "carriage_id": 0
}
```

---

### 3. /v1/carriage/pass/update

**Method:** `POST`

**Path:** `/v1/carriage/pass/update`

**Request Body:**
```json
{
  "arrival_passes": [
    {
      "driver_name": "string",
      "driver_phone": "string",
      "id": 0,
      "vehicle_license_plate": "string",
      "vehicle_model": "string",
      "with_returns": true
    }
  ],
  "carriage_id": 0
}
```

---

### 4. /v1/carriage/pass/delete

**Method:** `POST`

**Path:** `/v1/carriage/pass/delete`

**Request Body:**
```json
{
  "arrival_pass_ids": [
    "string"
  ],
  "carriage_id": 0
}
```

---

### 5. /v1/return/pass/create

**Method:** `POST`

**Path:** `/v1/return/pass/create`

**Request Body:**
```json
{
  "arrival_passes": [
    {
      "arrival_time": "2019-08-24T14:15:22Z",
      "driver_name": "string",
      "driver_phone": "string",
      "dropoff_point_id": 0,
      "vehicle_license_plate": "string",
      "vehicle_model": "string",
      "warehouse_id": 0
    }
  ]
}
```

---

### 6. /v1/return/pass/update

**Method:** `POST`

**Path:** `/v1/return/pass/update`

**Request Body:**
```json
{
  "arrival_passes": [
    {
      "arrival_pass_id": 0,
      "arrival_time": "2019-08-24T14:15:22Z",
      "driver_name": "string",
      "driver_phone": "string",
      "vehicle_license_plate": "string",
      "vehicle_model": "string"
    }
  ]
}
```

---

### 7. /v1/return/pass/delete

**Method:** `POST`

**Path:** `/v1/return/pass/delete`

**Request Body:**
```json
{
  "arrival_pass_ids": [
    "string"
  ]
}
```

---

