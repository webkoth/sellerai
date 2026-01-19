# Ozon Seller API - Postman Collection Documentation

> Полная документация всех endpoint'ов Ozon API из официальной Postman коллекции v2.1

**Generated:** 2024-12-28
**Source:** [Ozon Postman Collection 2.1](https://cdn1.ozonusercontent.com/s3/kms-files-prod/seller-edu/Ozon-Seller-API-(2.1).postman_collection.json)
**Base URL:** `https://api-seller.ozon.ru`
**Total Categories:** 32
**Total Endpoints:** 239

---

## Обзор

Эта документация создана автоматическим парсингом официальной Postman коллекции Ozon Seller API v2.1. Каждая категория содержит полный список endpoint'ов с методами, путями и примерами запросов.

### Аутентификация

Все запросы требуют:
```http
Client-Id: ваш_client_id
Api-Key: ваш_api_key
Content-Type: application/json
```

---

## 📦 Товары и Каталог

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Атрибуты и характеристики Ozon** | 4 | [attributes.md](./attributes.md) |
| **Загрузка и обновление товаров** | 22 | [products-import.md](./products-import.md) |
| **Штрихкоды товаров** | 2 | [barcodes.md](./barcodes.md) |
| **Цены и остатки товаров** | 8 | [prices-stocks.md](./prices-stocks.md) |

**Итого:** 36 endpoints

---

## 🎯 Маркетинг и Продвижение

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Акции** | 12 | [promotions.md](./promotions.md) |
| **Стратегии ценообразования** | 12 | [pricing-strategy.md](./pricing-strategy.md) |

**Итого:** 24 endpoints

---

## 📜 Сертификация

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Сертификаты брендов** | 1 | [brand-certificates.md](./brand-certificates.md) |
| **Сертификаты качества** | 14 | [quality-certificates.md](./quality-certificates.md) |

**Итого:** 15 endpoints

---

## 🚚 Заказы и Доставка

### FBO (Fulfillment by Ozon)

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Доставка FBO** | 13 | [delivery-fbo.md](./delivery-fbo.md) |

### FBS (Fulfillment by Seller)

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Обработка заказов FBS и rFBS** | 21 | [orders-fbs-rfbs.md](./orders-fbs-rfbs.md) |
| **Доставка FBS** | 13 | [delivery-fbs.md](./delivery-fbs.md) |
| **Управление кодами маркировки и сборкой заказов для FBS/rFBS** | 6 | [marks-assembly.md](./marks-assembly.md) |

### rFBS (real FBS)

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Доставка rFBS** | 8 | [delivery-rfbs.md](./delivery-rfbs.md) |

**Итого:** 61 endpoints

---

## 🔄 Возвраты и Отмены

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Возвраты товаров FBO и FBS** | 1 | [returns-fbo-fbs.md](./returns-fbo-fbs.md) |
| **Возвраты товаров rFBS** | 7 | [returns-rfbs.md](./returns-rfbs.md) |
| **Возвратные отгрузки** | 8 | [return-shipments.md](./return-shipments.md) |
| **Отмены заказов** | 4 | [cancellations.md](./cancellations.md) |

**Итого:** 20 endpoints

---

## 🏢 Логистика и Склады

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Склады** | 2 | [warehouses.md](./warehouses.md) |
| **Полигоны** | 2 | [polygons.md](./polygons.md) |
| **Пропуски** | 7 | [passes.md](./passes.md) |

**Итого:** 11 endpoints

---

## 💬 Взаимодействие с Покупателями

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Чаты с покупателями** | 6 | [chats.md](./chats.md) |
| **β Работа с отзывами** | 7 | [reviews.md](./reviews.md) |
| **β Работа с вопросами и ответами** | 8 | [questions-answers.md](./questions-answers.md) |

**Итого:** 21 endpoints

---

## 📊 Отчёты и Аналитика

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **Отчёты** | 8 | [reports.md](./reports.md) |
| **Аналитические отчёты** | 3 | [analytics-reports.md](./analytics-reports.md) |
| **Финансовые отчёты** | 3 | [finance-reports.md](./finance-reports.md) |
| **Накладные** | 4 | [invoices.md](./invoices.md) |
| **Рейтинг продавца** | 2 | [seller-rating.md](./seller-rating.md) |

**Итого:** 20 endpoints

---

## 🧪 Beta Методы

| Категория | Endpoints | Файл |
|-----------|-----------|------|
| **β Прочие методы** | 13 | [beta-methods.md](./beta-methods.md) |
| **β Заявки на поставку FBO** | 7 | [fbo-supply-requests.md](./fbo-supply-requests.md) |
| **β Работа с квантами** | 6 | [quants.md](./quants.md) |
| **β Работа с грузоместами** | 5 | [cargoes.md](./cargoes.md) |

**Итого:** 31 endpoints

---

## Полный список категорий

### По количеству endpoints (топ-10)

| # | Категория | Endpoints |
|---|-----------|-----------|
| 1 | Загрузка и обновление товаров | 22 |
| 2 | Обработка заказов FBS и rFBS | 21 |
| 3 | Сертификаты качества | 14 |
| 4 | Доставка FBO | 13 |
| 5 | Доставка FBS | 13 |
| 6 | β Прочие методы | 13 |
| 7 | Акции | 12 |
| 8 | Стратегии ценообразования | 12 |
| 9 | Цены и остатки товаров | 8 |
| 10 | Доставка rFBS | 8 |

### По категориям (алфавит)

1. [Аналитические отчёты](./analytics-reports.md) — 3 endpoints
2. [Атрибуты и характеристики Ozon](./attributes.md) — 4 endpoints
3. [Акции](./promotions.md) — 12 endpoints
4. [β Заявки на поставку FBO](./fbo-supply-requests.md) — 7 endpoints
5. [β Прочие методы](./beta-methods.md) — 13 endpoints
6. [β Работа с вопросами и ответами](./questions-answers.md) — 8 endpoints
7. [β Работа с грузоместами](./cargoes.md) — 5 endpoints
8. [β Работа с квантами](./quants.md) — 6 endpoints
9. [β Работа с отзывами](./reviews.md) — 7 endpoints
10. [Возвраты товаров FBO и FBS](./returns-fbo-fbs.md) — 1 endpoint
11. [Возвраты товаров rFBS](./returns-rfbs.md) — 7 endpoints
12. [Возвратные отгрузки](./return-shipments.md) — 8 endpoints
13. [Доставка FBO](./delivery-fbo.md) — 13 endpoints
14. [Доставка FBS](./delivery-fbs.md) — 13 endpoints
15. [Доставка rFBS](./delivery-rfbs.md) — 8 endpoints
16. [Загрузка и обновление товаров](./products-import.md) — 22 endpoints
17. [Накладные](./invoices.md) — 4 endpoints
18. [Обработка заказов FBS и rFBS](./orders-fbs-rfbs.md) — 21 endpoints
19. [Отмены заказов](./cancellations.md) — 4 endpoints
20. [Отчёты](./reports.md) — 8 endpoints
21. [Полигоны](./polygons.md) — 2 endpoints
22. [Пропуски](./passes.md) — 7 endpoints
23. [Рейтинг продавца](./seller-rating.md) — 2 endpoints
24. [Сертификаты брендов](./brand-certificates.md) — 1 endpoint
25. [Сертификаты качества](./quality-certificates.md) — 14 endpoints
26. [Склады](./warehouses.md) — 2 endpoints
27. [Стратегии ценообразования](./pricing-strategy.md) — 12 endpoints
28. [Управление кодами маркировки и сборкой заказов для FBS/rFBS](./marks-assembly.md) — 6 endpoints
29. [Финансовые отчёты](./finance-reports.md) — 3 endpoints
30. [Цены и остатки товаров](./prices-stocks.md) — 8 endpoints
31. [Чаты с покупателями](./chats.md) — 6 endpoints
32. [Штрихкоды товаров](./barcodes.md) — 2 endpoints

---

## Использование

### Навигация

Каждый файл категории содержит:
- Название категории
- Список всех endpoint'ов с методами HTTP
- Пути запросов
- Примеры тел запросов (где применимо)

### Пример структуры файла

```markdown
# Название категории

**Base URL:** `https://api-seller.ozon.ru`

## Endpoints (N total)

### 1. Название метода

**Method:** `POST`
**Path:** `/v1/endpoint/path`

**Request Body:**
...json example...
```

---

## Важные замечания

### Rate Limits
- Стандартный лимит: **300 запросов / 60 секунд**
- Проверяйте заголовки ответа для текущих лимитов

### Переменные Postman

В оригинальной коллекции используются переменные:
- `{{baseURL}}` → `https://api-seller.ozon.ru`
- `{{clientID}}` → ваш Client-Id
- `{{apiKey}}` → ваш Api-Key

В данной документации все переменные заменены на реальные значения.

### Beta Методы

Методы с префиксом **β** находятся в стадии тестирования и могут быть изменены без предварительного уведомления.

---

## Структура файлов

```
docs/api-reference/ozon/postman/
├── README.md                    # Этот файл
├── summary.json                 # JSON сводка всех категорий
├── attributes.md                # Атрибуты и характеристики
├── products-import.md           # Загрузка товаров
├── prices-stocks.md             # Цены и остатки
├── promotions.md                # Акции
├── pricing-strategy.md          # Стратегии цен
├── orders-fbs-rfbs.md          # Заказы FBS/rFBS
├── delivery-*.md                # Доставка (FBO/FBS/rFBS)
├── returns-*.md                 # Возвраты
├── reviews.md                   # Отзывы
├── questions-answers.md         # Вопросы и ответы
├── analytics-reports.md         # Аналитика
├── finance-reports.md           # Финансы
└── ...                          # Остальные категории
```

---

## Связанные ресурсы

- [Основная документация Ozon API](../README.md) - Главный индекс
- [Products API (детальная)](../products.md) - Подробная документация Products API
- [Prices & Stocks API (детальная)](../prices-stocks.md) - Подробная документация цен и остатков
- [Официальная документация Ozon](https://docs.ozon.ru/api/seller/)
- [Ozon Seller Education](https://seller-edu.ozon.ru/)
- [Ozon Developer Platform](https://dev.ozon.ru/)

---

## Обновления

Эта документация создана из Postman коллекции v2.1 от 2024-12-28. Для актуальной информации проверяйте официальную документацию Ozon.

**Последнее обновление:** 2024-12-28
