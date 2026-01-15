# β Заявки на поставку FBO

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (7 total)

### 1. /v1/cluster/list

**Method:** `POST`

**Path:** `/v1/cluster/list`

**Request Body:**
```json
{
  "cluster_ids": [
    "string"
  ],
  "cluster_type": "CLUSTER_TYPE_OZON"
}
```

---

### 2. /v1/warehouse/fbo/list

**Method:** `POST`

**Path:** `/v1/warehouse/fbo/list`

**Request Body:**
```json
{
  "filter_by_supply_type": [
    "CREATE_TYPE_CROSSDOCK"
  ],
  "search": "string"
}
```

---

### 3. /v1/draft/create

**Method:** `POST`

**Path:** `/v1/draft/create`

**Request Body:**
```json
{
  "cluster_ids": [
    "string"
  ],
  "drop_off_point_warehouse_id": 0,
  "items": [
    {
      "quantity": 0,
      "sku": 0
    }
  ],
  "type": "CREATE_TYPE_UNKNOWN"
}
```

---

### 4. /v1/draft/create/info

**Method:** `POST`

**Path:** `/v1/draft/create/info`

**Request Body:**
```json
{
  "operation_id": "string"
}
```

---

### 5. /v1/draft/timeslot/info

**Method:** `POST`

**Path:** `/v1/draft/timeslot/info`

**Request Body:**
```json
{
  "date_from": "2019-08-24T14:15:22Z",
  "date_to": "2019-08-24T14:15:22Z",
  "draft_id": 0,
  "warehouse_ids": [
    "string"
  ]
}
```

---

### 6. /v1/draft/supply/create

**Method:** `POST`

**Path:** `/v1/draft/supply/create`

**Request Body:**
```json
{
  "draft_id": 0,
  "timeslot": {
    "from_in_timezone": "2019-08-24T14:15:22Z",
    "to_in_timezone": "2019-08-24T14:15:22Z"
  },
  "warehouse_id": 0
}
```

---

### 7. /v1/supply/create/status

**Method:** `POST`

**Path:** `/v1/supply/create/status`

**Request Body:**
```json
{
  "operation_id": "string"
}
```

---

