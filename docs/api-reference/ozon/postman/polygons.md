# Полигоны

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (2 total)

### 1. /v1/polygon/create

**Method:** `POST`

**Path:** `/v1/polygon/create`

**Request Body:**
```json
{
  "coordinates": "[[[30.149574279785153,59.86550435303646],[30.21205902099609,59.846884387977326],[30.255661010742184,59.86240174913176],[30.149574279785153,59.86550435303646]]]"
}
```

---

### 2. /v1/polygon/bind

**Method:** `POST`

**Path:** `/v1/polygon/bind`

**Request Body:**
```json
{
  "delivery_method_id": 0,
  "polygons": [
    {
      "polygon_id": "1323",
      "time": "30"
    }
  ],
  "warehouse_location": {
    "lat": "58.52391272075821",
    "lon": "31.236791610717773"
  }
}
```

---

