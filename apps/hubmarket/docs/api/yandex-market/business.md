# Business API (Общие для всех моделей методы)

> Методы, доступные для всех моделей размещения на Яндекс.Маркет

**Category:** Business Methods
**Base URL:** `https://api.partner.market.yandex.ru`
**Generated:** 2024-12-28
**Source:** https://yandex.ru/dev/market/partner-api/doc/ru/overview/business

---

## Overview

Методы Business API используются для всех моделей размещения (FBY, FBS, Express, DBS) и обеспечивают базовые операции с товарами, ценами, заказами и аналитикой.

### Key Operations

- ✅ Управление товарами в каталоге
- ✅ Установка цен для всех магазинов
- ✅ Работа с акциями
- ✅ Получение заказов по кабинету
- ✅ Аналитические и финансовые отчеты
- ✅ Управление отзывами и вопросами
- ✅ Буст продаж и индекс качества

---

## Кабинеты и магазины

### POST /v2/businesses/{businessId}/settings
**Настройки кабинета**

Получение настроек кабинета продавца.

**Path Parameters:**
- `businessId` — Идентификатор кабинета

---

## Товары

### POST /v2/businesses/{businessId}/offer-mappings/update
**Добавление товаров в каталог и изменение информации о них**

Массовое добавление или обновление информации о товарах в каталоге.

### POST /v1/businesses/{businessId}/offer-mappings/barcodes/generate
**Генерация штрихкодов**

Автоматическая генерация штрихкодов для товаров.

### POST /v2/businesses/{businessId}/offer-cards
**Получение информации о заполненности карточек магазина**

Проверка качества заполнения карточек товаров.

### POST /v2/businesses/{businessId}/offer-cards/update
**Редактирование категорийных характеристик товара**

Обновление характеристик товаров в карточках.

### POST /v2/businesses/{businessId}/offer-mappings
**Информация о товарах в каталоге**

Получение полного списка товаров в каталоге кабинета.

### POST /v2/businesses/{businessId}/offer-mappings/delete
**Удаление товаров из каталога**

Удаление товаров из каталога кабинета.

### POST /v2/businesses/{businessId}/offer-mappings/archive
**Добавление товаров в архив**

Перемещение товаров в архив без полного удаления.

### POST /v2/businesses/{businessId}/offer-mappings/unarchive
**Удаление товаров из архива**

Восстановление товаров из архива.

---

## Цены

### POST /v2/tariffs/calculate
**Калькулятор стоимости услуг**

Расчет комиссий и стоимости услуг Маркета.

### POST /v2/businesses/{businessId}/offer-prices/updates
**Установка цен на товары для всех магазинов**

Массовое обновление цен на товары во всех магазинах кабинета.

### POST /v2/businesses/{businessId}/offer-prices
**Просмотр цен на указанные товары во всех магазинах**

Получение актуальных цен товаров.

### POST /v2/businesses/{businessId}/offers/recommendations
**Рекомендации Маркета, касающиеся цен**

Рекомендуемые цены для повышения продаж.

### POST /v2/businesses/{businessId}/price-quarantine
**Список товаров, находящихся в карантине по цене в кабинете**

Товары с ценами, требующими проверки.

### POST /v2/businesses/{businessId}/price-quarantine/confirm
**Удаление товара из карантина по цене в кабинете**

Подтверждение цен и выход из карантина.

---

## Акции

### POST /v2/businesses/{businessId}/promos
**Получение списка акций**

Список доступных акций Маркета.

### POST /v2/businesses/{businessId}/promos/offers
**Получение списка товаров, которые участвуют или могут участвовать в акции**

Товары, подходящие для участия в акциях.

### POST /v2/businesses/{businessId}/promos/offers/update
**Добавление товаров в акцию или изменение их цен**

Управление участием товаров в акциях.

### POST /v2/businesses/{businessId}/promos/offers/delete
**Удаление товаров из акции**

Отмена участия товаров в акциях.

---

## Заказы

### POST /v1/businesses/{businessId}/orders
**Информация о заказах в кабинете**

Получение списка всех заказов по кабинету (для всех магазинов).

---

## Отчеты и документы

### POST /v2/reports/shows-sales/generate
**Отчет «Аналитика продаж»**

Аналитический отчет по показам и продажам.

### POST /v2/reports/sales-geography/generate
**Отчет по географии продаж**

Распределение продаж по регионам.

### POST /v2/reports/key-indicators/generate
**Отчет по ключевым показателям**

Основные метрики эффективности.

### POST /v2/reports/competitors-position/generate
**Отчет «Конкурентная позиция»**

Анализ позиций относительно конкурентов.

### POST /v2/reports/united-orders/generate
**Отчет по заказам**

Детальный отчет по всем заказам.

### POST /v2/reports/goods-prices/generate
**Отчет «Цены»**

Анализ ценовой политики.

### POST /v2/reports/goods-feedback/generate
**Отчет по отзывам о товарах**

Статистика отзывов по товарам.

### POST /v2/reports/jewelry-fiscal/generate
**Отчет по заказам с ювелирными изделиями**

Специальный отчет для ювелирных товаров.

### POST /v2/reports/goods-realization/generate
**Отчет по реализации**

Финансовый отчет по реализации.

### POST /v2/reports/united-netting/generate
**Отчет по платежам**

Детализация платежей и взаиморасчетов.

### POST /v2/reports/shows-boost/generate
**Отчет по бусту показов**

Эффективность продвижения показов.

### POST /v2/reports/boost-consolidated/generate
**Отчет по бусту продаж**

Сводный отчет по бусту продаж.

### POST /v2/reports/shelf-statistics/generate
**Отчет по полкам**

Статистика размещения на полках.

### POST /v2/reports/banners-statistics/generate
**Отчет по охватному продвижению**

Статистика баннерного продвижения.

---

## Отзывы о товарах

### POST /v2/businesses/{businessId}/goods-feedback
**Получение отзывов о товарах продавца**

Список всех отзывов на товары.

### POST /v2/businesses/{businessId}/goods-feedback/comments
**Получение комментариев к отзыву**

Детальная информация по комментариям.

### POST /v2/businesses/{businessId}/goods-feedback/comments/update
**Добавление нового или изменение созданного комментария**

Ответ на отзывы покупателей.

### POST /v2/businesses/{businessId}/goods-feedback/skip-reaction
**Пропуск реакции на отзывы**

Пометка отзывов как обработанных.

### POST /v2/businesses/{businessId}/goods-feedback/comments/delete
**Удаление комментария к отзыву**

Удаление ответов на отзывы.

---

## Вопросы и ответы о товарах

### POST /v1/businesses/{businessId}/goods-questions
**Получение вопросов о товарах продавца**

Список вопросов покупателей.

### POST /v1/businesses/{businessId}/goods-questions/answers
**Получение ответов на вопрос**

Просмотр ответов на конкретный вопрос.

### POST /v1/businesses/{businessId}/goods-questions/update
**Создание, изменение и удаление ответа или комментария**

Управление ответами на вопросы.

---

## Буст продаж

### PUT /v2/businesses/{businessId}/bids
**Включение буста продаж и установка ставок**

Настройка ставок для продвижения товаров.

### POST /v2/businesses/{businessId}/bids/info
**Информация об установленных ставках**

Просмотр текущих ставок.

### POST /v2/businesses/{businessId}/bids/recommendations
**Рекомендованные ставки для заданных товаров**

Рекомендации по оптимальным ставкам.

---

## Индекс качества

### POST /v2/businesses/{businessId}/ratings/quality
**Индекс качества магазинов**

Показатели качества работы магазина.

---

## Чаты

### POST /v2/businesses/{businessId}/chats/history
**Получение истории сообщений в чате**

История переписки с покупателями.

### GET /v2/businesses/{businessId}/chat
**Получение чата по идентификатору**

Информация о конкретном чате.

### POST /v2/businesses/{businessId}/chats
**Получение доступных чатов**

Список всех чатов с покупателями.

### GET /v2/businesses/{businessId}/chats/message
**Получение сообщения в чате**

Конкретное сообщение из чата.

### POST /v2/businesses/{businessId}/chats/new
**Создание нового чата с покупателем**

Инициация чата с покупателем.

### POST /v2/businesses/{businessId}/chats/message
**Отправка сообщения в чат**

Отправка сообщения покупателю.

### POST /v2/businesses/{businessId}/chats/file/send
**Отправка файла в чат**

Отправка документов или изображений.

---

## Склады

### POST /v2/businesses/{businessId}/warehouses
**Список складов**

Информация о складах кабинета.

---

## Important Notes

### Идентификаторы

- **businessId** — идентификатор кабинета (один кабинет может содержать несколько магазинов)
- **campaignId** — идентификатор магазина (используется в model-specific методах)

### Модели размещения

Business API работает для всех моделей:
- **FBY** — Fulfillment by Yandex (склад Маркета)
- **FBS** — Fulfillment by Seller (склад продавца, доставка Маркетом)
- **Express** — Экспресс-доставка
- **DBS** — Delivery by Seller (полностью самостоятельная доставка)

### Rate Limits

- Стандартный лимит: **300 запросов / 60 секунд**
- Для отчетов: специальные лимиты (проверяйте документацию)

---

## Related APIs

- [FBS API](./fbs.md) — Методы для модели FBS
- [FBY API](./fby.md) — Методы для модели FBY
- [Express API](./express.md) — Методы для модели Экспресс
- [DBS API](./dbs.md) — Методы для модели DBS

---

## Resources

- [Official Documentation](https://yandex.ru/dev/market/partner-api/doc/ru/overview/business)
- [OpenAPI Specification](https://github.com/yandex-market/yandex-market-partner-api)
- [Yandex Market Seller Help](https://yandex.ru/support/marketplace/)
