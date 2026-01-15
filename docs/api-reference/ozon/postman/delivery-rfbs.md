# Доставка rFBS

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (8 total)

### 1. /v2/fbs/posting/tracking-number/set

**Method:** `POST`

**Path:** `/v2/fbs/posting/tracking-number/set`

**Request Body:**
```json
{
  "tracking_numbers": [
    {
      "posting_number": "48173252-0033-2",
      "tracking_number": "123123123"
    }
  ]
}
```

---

### 2. /v2/fbs/posting/sent-by-seller

**Method:** `POST`

**Path:** `/v2/fbs/posting/sent-by-seller`

**Request Body:**
```json
{
  "posting_number": [
    "47173252-0073-1"
  ]
}
```

---

### 3. /v2/fbs/posting/delivering

**Method:** `POST`

**Path:** `/v2/fbs/posting/delivering`

**Request Body:**
```json
{
  "posting_number": [
    "33920157-0018-1"
  ]
}
```

---

### 4. /v2/fbs/posting/last-mile

**Method:** `POST`

**Path:** `/v2/fbs/posting/last-mile`

**Request Body:**
```json
{
  "posting_number": [
    "48173252-0033-2"
  ]
}
```

---

### 5. /v2/fbs/posting/delivered

**Method:** `POST`

**Path:** `/v2/fbs/posting/delivered`

**Request Body:**
```json
{
  "posting_number": [
    "48173252-0033-2"
  ]
}
```

---

### 6. /v1/posting/fbs/timeslot/change-restrictions

**Method:** `POST`

**Path:** `/v1/posting/fbs/timeslot/change-restrictions`

**Request Body:**
```json
{
  "posting_number": "string"
}
```

---

### 7. /v1/posting/fbs/timeslot/set

**Method:** `POST`

**Path:** `/v1/posting/fbs/timeslot/set`

**Request Body:**
```json
{
  "new_timeslot": {
    "from": "2023-03-25T08:51:56.932Z",
    "to": "2023-03-25T08:51:56.932Z"
  },
  "posting_number": "string"
}
```

---

### 8. /v1/posting/cutoff/set

**Method:** `POST`

**Path:** `/v1/posting/cutoff/set`

**Request Body:**
```json
{
  "new_cutoff_date": "2019-08-24T14:15:22Z",
  "posting_number": "string"
}
```

---

