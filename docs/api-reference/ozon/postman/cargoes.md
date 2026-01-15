# β Работа с грузоместами

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (5 total)

### 1. /v1/cargoes/create

**Method:** `POST`

**Path:** `/v1/cargoes/create`

**Request Body:**
```json
{
  "cargoes": [
    {
      "key": "string",
      "value": {
        "items": [
          {
            "barcode": "string",
            "expires_at": "2019-08-24T14:15:22Z",
            "quant": 0,
            "quantity": 0
          }
        ],
        "type": "BOX"
      }
    }
  ],
  "delete_current_version": true,
  "supply_id": 0
}
```

---

### 2. /v1/cargoes/create/info

**Method:** `POST`

**Path:** `/v1/cargoes/create/info`

**Request Body:**
```json
{
  "operation_id": "string"
}
```

---

### 3. /v1/cargoes-label/create

**Method:** `POST`

**Path:** `/v1/cargoes-label/create`

**Request Body:**
```json
{
  "cargoes": [
    {
      "cargo_id": 0
    }
  ],
  "supply_id": 0
}
```

---

### 4. /v1/cargoes-label/get

**Method:** `POST`

**Path:** `/v1/cargoes-label/get`

**Request Body:**
```json
{
  "operation_id": "string"
}
```

---

### 5. /v1/cargoes-label/file/{file_guid}

**Method:** `GET`

**Path:** `/v1/cargoes-label/file/{file_guid}`

**Request Body:**
```json
{
  "operation_id": "string"
}
```

---

