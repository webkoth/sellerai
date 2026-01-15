# β Работа с отзывами

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (7 total)

### 1. /v1/review/comment/create

**Method:** `POST`

**Path:** `/v1/review/comment/create`

**Request Body:**
```json
{
  "mark_review_as_processed": true,
  "parent_comment_id": "string",
  "review_id": "string",
  "text": "string"
}
```

---

### 2. /v1/review/comment/delete

**Method:** `POST`

**Path:** `/v1/review/comment/delete`

**Request Body:**
```json
{
  "comment_id": "string"
}
```

---

### 3. /v1/review/comment/list

**Method:** `POST`

**Path:** `/v1/review/comment/list`

**Request Body:**
```json
{
  "limit": 0,
  "offset": 0,
  "review_id": "string",
  "sort_dir": "ASC"
}
```

---

### 4. /v1/review/change-status

**Method:** `POST`

**Path:** `/v1/review/change-status`

**Request Body:**
```json
{
  "review_ids": [
    "string"
  ],
  "status": "string"
}
```

---

### 5. /v1/review/count

**Method:** `POST`

**Path:** `/v1/review/count`

**Request Body:**
```json
{}
```

---

### 6. /v1/review/info

**Method:** `POST`

**Path:** `/v1/review/info`

**Request Body:**
```json
{
  "review_id": "string"
}
```

---

### 7. /v1/review/list

**Method:** `POST`

**Path:** `/v1/review/list`

**Request Body:**
```json
{
  "last_id": "string",
  "limit": 0,
  "sort_dir": "string",
  "status": "string"
}
```

---

