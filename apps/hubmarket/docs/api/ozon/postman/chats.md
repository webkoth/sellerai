# Чаты с покупателями

**Base URL:** `https://api-seller.ozon.ru`
**Generated from:** Ozon Postman Collection 2.1

---

## Endpoints (6 total)

### 1. /v1/chat/send/message

**Method:** `POST`

**Path:** `/v1/chat/send/message`

**Request Body:**
```json
{
  "chat_id": "99feb3fc-a474-469f-95d5-268b470cc607",
  "text": "test"
}
```

---

### 2. /v1/chat/send/file

**Method:** `POST`

**Path:** `/v1/chat/send/file`

**Request Body:**
```json
{
  "base64_content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "chat_id": "99feb3fc-a474-469f-95d5-268b470cc607",
  "name": "tempor"
}
```

---

### 3. /v1/chat/start

**Method:** `POST`

**Path:** `/v1/chat/start`

**Request Body:**
```json
{
  "posting_number": "47873153-0052-1"
}
```

---

### 4. /v2/chat/list

**Method:** `POST`

**Path:** `/v2/chat/list`

**Request Body:**
```json
{
  "filter": {
    "chat_status": "Opened",
    "unread_only": true
  },
  "limit": 1,
  "offset": 0
}
```

---

### 5. /v2/chat/history

**Method:** `POST`

**Path:** `/v2/chat/history`

**Request Body:**
```json
{
  "chat_id": "18b8e1f9-4ae7-461c-84ea-8e1f54d1a45e",
  "direction": "Forward",
  "from_message_id": 3000000000118032000,
  "limit": 1
}
```

---

### 6. /v2/chat/read

**Method:** `POST`

**Path:** `/v2/chat/read`

**Request Body:**
```json
{
  "chat_id": "99feb3fc-a474-469f-95d5-268b470cc607",
  "from_message_id": 3000000000118032000
}
```

---

