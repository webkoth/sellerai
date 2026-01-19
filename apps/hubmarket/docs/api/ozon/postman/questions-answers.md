# β Работа с вопросами и ответами

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (8 total)

### 1. /v1/question/answer/create

**Method:** `POST`

**Path:** `/v1/question/answer/create`

**Request Body:**
```json
{
  "question_id": "0192a009-769f-7ee9-b412-893045171a66",
  "sku": 646399170,
  "text": "текст"
}
```

---

### 2. /v1/question/answer/delete

**Method:** `POST`

**Path:** `/v1/question/answer/delete`

**Request Body:**
```json
{
  "answer_id": "0192e7ce-e12c-7a74-afc7-26e877799204",
  "sku": 646399170
}
```

---

### 3. /v1/question/answer/list

**Method:** `POST`

**Path:** `/v1/question/answer/list`

**Request Body:**
```json
{
  "last_id": "string",
  "question_id": "019228a7-91d8-76af-a73a-e989dfac7ac8",
  "sku": 646399170
}
```

---

### 4. /v1/question/change_status

**Method:** `POST`

**Path:** `/v1/question/change_status`

**Request Body:**
```json
{
  "question_ids": [
    "string"
  ],
  "status": "VIEWED"
}
```

---

### 5. /v1/question/count

**Method:** `POST`

**Path:** `/v1/question/count`

**Request Body:**
```json
{}
```

---

### 6. /v1/question/info

**Method:** `POST`

**Path:** `/v1/question/info`

**Request Body:**
```json
{
  "question_id": "string"
}
```

---

### 7. /v1/question/list

**Method:** `POST`

**Path:** `/v1/question/list`

**Request Body:**
```json
{
  "filter": {
    "date_from": "2019-08-24T14:15:22Z",
    "date_to": "2019-08-24T14:15:22Z",
    "status": "string"
  },
  "last_id": "string"
}
```

---

### 8. /v1/question/top_sku

**Method:** `POST`

**Path:** `/v1/question/top_sku`

**Request Body:**
```json
{
  "limit": "100"
}
```

---

