# FBS API (Fulfillment by Seller)

> Методы для модели FBS — хранение на складе продавца, доставка силами Маркета

**Category:** FBS Methods
**Base URL:** `https://api.partner.market.yandex.ru`
**Generated:** 2025-12-28
**Source:** [GitHub OpenAPI Spec](https://github.com/yandex-market/yandex-market-partner-api)

---

## Overview

При работе по модели FBS вы храните товары на своем складе, а доставку заказов поручаете Маркету. Когда покупатель оформляет заказ, вы его собираете и упаковываете, а дальше либо сами отвозите Маркету, либо отгружаете в присланную Маркетом машину.

### Key Operations

- ✅ Управление товарами в магазине
- ✅ Обновление остатков на складе
- ✅ Установка цен
- ✅ Обработка заказов FBS
- ✅ Создание отгрузок
- ✅ Печать ярлыков
- ✅ Работа с возвратами

**Всего методов:** 130

---


## Кабинеты и магазины

**GET /v2/campaigns**
_Список магазинов пользователя_
Лимит: ** 1 000 запросов в час

**GET /v2/campaigns/{campaignId}**
_Информация о магазине_
Лимит: ** 1 000 запросов в час

**GET /v2/campaigns/{campaignId}/settings**
_Настройки магазина_
Лимит: ** 1 000 запросов в час

---

## Товары

**POST /v2/categories/tree**
_Дерево категорий_
Лимит: ** 1 000 запросов в час

**POST /v2/category/{categoryId}/parameters**
_Списки характеристик товаров по категориям_
Лимит: ** 100 категорий в минуту

**POST /v2/campaigns/{campaignId}/offers/update**
_Изменение условий продажи товаров в магазине_
Лимит: ** 10 000 товаров в минуту

**POST /v2/campaigns/{campaignId}/offers**
_Информация о товарах, которые размещены в заданном магазине_
Лимит: ** 10 000 товаров в минуту

**POST /v2/campaigns/{campaignId}/offers/delete**
_Удаление товаров из ассортимента магазина_
Лимит: ** 10 000 товаров в минуту

**GET /v2/campaigns/{campaignId}/hidden-offers**
_Информация о скрытых вами товарах_
Лимит: ** 10 000 товаров в минуту, не более 500 товаров в одном запросе

**POST /v2/campaigns/{campaignId}/hidden-offers**
_Скрытие товаров и настройки скрытия_
Лимит: ** 10 000 товаров в минуту

**POST /v2/campaigns/{campaignId}/hidden-offers/delete**
_Возобновление показа товаров_
Лимит: ** 10 000 товаров в минуту

---

## Остатки и оборачиваемость

**POST /v2/campaigns/{campaignId}/offers/stocks**
_Информация об остатках и оборачиваемости_
Лимит: ** 100 000 товаров в минуту

**PUT /v2/campaigns/{campaignId}/offers/stocks**
_Передача информации об остатках_
Лимит: ** 100 000 товаров в минуту

---

## Цены

**POST /v2/campaigns/{campaignId}/offer-prices/updates**
_Установка цен на товары в конкретном магазине_
Лимит: ** 10 000 товаров в минуту

**GET /v2/campaigns/{campaignId}/offer-prices**
_Список цен_
Лимит: ** 150 000 товаров в минуту

**POST /v2/campaigns/{campaignId}/offer-prices**
_Просмотр цен на указанные товары в конкретном магазине_
Лимит: ** 150 000 товаров в минуту

**POST /v2/campaigns/{campaignId}/price-quarantine**
_Список товаров, находящихся в карантине по цене в магазине_
Лимит: ** 10 000 товаров в минуту

**POST /v2/campaigns/{campaignId}/price-quarantine/confirm**
_Удаление товара из карантина по цене в магазине_
Лимит: ** 10 000 товаров в минуту

---

## Заказы

**PUT /v2/campaigns/{campaignId}/orders/{orderId}/boxes**
_Подготовка заказа_
Лимит: ** 100 000 запросов в час

**POST /v2/campaigns/{campaignId}/orders/{orderId}/external-id**
_Передача внешнего идентификатора заказа_
Лимит: ** 10 000 запросов в час

**PUT /v2/campaigns/{campaignId}/orders/{orderId}/status**
_Изменение статуса одного заказа_
Лимит: ** 100 000 запросов в час

**POST /v2/campaigns/{campaignId}/orders/status-update**
_Изменение статусов нескольких заказов_
Лимит: ** 100 000 заказов в час

**POST /v2/campaigns/{campaignId}/orders/{orderId}/identifiers/status**
_Статусы проверки кодов маркировки_
Лимит: ** 100 000 запросов в час

**POST /v2/campaigns/{campaignId}/orders/{orderId}/business-buyer**
_Информация о покупателе — юридическом лице_
Лимит: ** 3 000 запросов в час

**POST /v2/campaigns/{campaignId}/orders/{orderId}/documents**
_Информация о документах_
Лимит: ** 3 000 запросов в час

---


## Important Notes

### FBS Workflow

1. **Прием заказа:** Заказ поступает в статусе `PROCESSING`
2. **Сборка:** Собираете товары, упаковываете
3. **Подготовка:** Обновляете статус → `READY_TO_SHIP`
4. **Отгрузка:** Создаете отгрузку, печатаете документы
5. **Передача:** Отвозите на склад Маркета или передаете курьеру
6. **Доставка:** Маркет доставляет покупателю

### Обновление остатков

- Обновляйте остатки **минимум раз в час**
- При обнулении остатков товар автоматически скрывается
- Используйте `warehouseId` для привязки к складу

### Отгрузки

- Отгрузки формируются **по расписанию** (настраивается в ЛК)
- Подтверждайте отгрузки **до дедлайна**
- Пропуск дедлайна → штрафы и снижение индекса качества

### Rate Limits

- Стандартный лимит: **300 запросов / 60 секунд**
- Для массовых операций: используйте batch-методы

---

## Related APIs

- [Business API](./business.md) — Общие методы для всех моделей
- [Yandex Market API Overview](./README.md) — Обзор всех API

---

## Resources

- [Official Documentation](https://yandex.ru/dev/market/partner-api/doc/ru/overview/fbs)
- [FBS Model Guide](https://yandex.ru/support/marketplace/ru/introduction/models#fbs)
- [OpenAPI Specification](https://github.com/yandex-market/yandex-market-partner-api)

---

## Методология создания документации

Эта документация создана путём парсинга официальной веб-документации Яндекс.Маркета с использованием:
- **Firecrawl MCP** для извлечения markdown-контента
- **OpenAPI спецификации** для структуры методов
- **marketplace-docs-parser skill** для единообразного формата

Детальная документация доступна для методов, успешно извлечённых из веб-страниц. Для остальных методов приведены summary и endpoint из OpenAPI спецификации.
