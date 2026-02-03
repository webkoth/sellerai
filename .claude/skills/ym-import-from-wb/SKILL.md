---
name: ym-import-from-wb
description: Миграция товаров с Wildberries на Яндекс.Маркет. Используйте для переноса карточек товаров, маппинга категорий, установки цен и остатков. Помогает ответить на вопросы "как перенести товар на Яндекс Маркет", "миграция WB→ЯМ", "импорт из Wildberries на Яндекс", "загрузить товары на яндекс маркет".
context: fork
---

# YM Import from WB — Миграция товаров WB→Яндекс.Маркет

Skill для переноса товаров с Wildberries на Яндекс.Маркет с правильными категориями.

## Обзор процесса миграции

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  WB API     │ →  │  Категории  │ →  │  Трансформ  │ →  │  YM API     │ →  │  Цены +     │
│  (товары)   │    │  (маппинг)  │    │  (данные)   │    │  (товары)   │    │  Остатки    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Шаг 1: Получение товаров с WB

### Через MCP (рекомендуется)

```
wb_get_products_in_stock(minQuantity: 1)
```

Возвращает только товары в наличии с полной информацией.

### Данные из WB

| Поле WB | Описание |
|---------|----------|
| `nmId` | ID товара на WB |
| `vendorCode` | Артикул продавца |
| `barcode` | Штрихкод (EAN) |
| `title` | Название товара |
| `description` | Описание |
| `brand` | Бренд |
| `photos[]` | URL фотографий |
| `price` | Цена до скидки |
| `discount` | Скидка в % |
| `stock` | Остаток FBS |
| `dimensions` | Габариты и вес |
| `characteristics[]` | Характеристики |

## Шаг 2: Определение категорий ЯМ

### Поиск категории через MCP

```
ym_search_categories(query: "браслет")
ym_search_categories(query: "подвеска")
ym_search_categories(query: "минерал")
```

### Справочник категорий для KOTELNIKOVARTIFACT

| Тип товара | ID категории ЯМ | Название категории |
|------------|-----------------|-------------------|
| Браслеты | `67678046` | Украшения и бижутерия > Браслеты |
| Подвески | `68749551` | Украшения и бижутерия > Подвески |
| Шармы | `68752047` | Украшения и бижутерия > Шармы |
| Образцы метеоритов | `62920723` | Сувениры > Минералы интерьерные |

### Автоматическое определение категории

```python
def get_category(name):
    name_lower = name.lower()

    if 'шарм' in name_lower:
        return 68752047  # Шармы
    elif 'браслет' in name_lower:
        return 67678046  # Браслеты
    elif 'подвеска' in name_lower or 'кулон' in name_lower:
        return 68749551  # Подвески
    else:
        return 62920723  # Минералы интерьерные (образцы)
```

## Шаг 3: Маппинг полей WB → ЯМ

### Основные поля

| WB | ЯМ | Примечание |
|----|-----|-----------|
| `barcode` | `offerId` | **Уникальный идентификатор** (используем баркод!) |
| `title` | `name` | Название товара |
| `description` | `description` | Описание (до 2000 символов) |
| `brand` | `vendor` | Бренд |
| `brand` | `manufacturer` | Производитель |
| `vendorCode` | `vendorCode` | Артикул производителя |
| `barcode` | `barcodes[]` | Штрихкоды |
| `photos[]` | `pictures[]` | URL фотографий (до 10 шт) |
| Страна производства | `manufacturerCountries[]` | Из характеристик |
| `dimensions` | `weightDimensions` | Габариты и вес |
| — | `marketCategoryId` | **ID категории ЯМ** (обязательно!) |

### Важно: offerId

**Используйте баркод как offerId**, а не vendorCode!

Причина: на WB один товар может иметь несколько размеров/вариантов с одним vendorCode, но разными баркодами. Для ЯМ offerId должен быть уникальным.

### Структура данных для ЯМ

```typescript
interface YMProduct {
  offerId: string;           // barcode с WB (уникальный!)
  name: string;              // title с WB
  description: string;       // description с WB (до 2000 символов)
  vendor: string;            // brand с WB
  manufacturer: string;      // brand с WB
  vendorCode: string;        // vendorCode с WB (для референса)
  barcodes: string[];        // [barcode] с WB
  pictures: string[];        // photos с WB (до 10 шт)
  manufacturerCountries: string[];  // из характеристик или ["Россия"]
  marketCategoryId: number;  // ID категории ЯМ
  weightDimensions?: {
    length: number;          // в см
    width: number;           // в см
    height: number;          // в см
    weight: number;          // в кг
  };
}
```

## Шаг 4: Загрузка товаров на ЯМ

### API Endpoint

```
POST https://api.partner.market.yandex.ru/businesses/{businessId}/offer-mappings/update
```

### Формат запроса

```json
{
  "offerMappings": [
    {
      "offer": {
        "offerId": "2041385829402",
        "name": "Коллекционный образец метеорит Кампо Дель Сьело",
        "description": "Описание товара...",
        "vendor": "KOTELNIKOVARTIFACT",
        "vendorCode": "JW-NB-AGT-M-0018",
        "barcodes": ["2041385829402"],
        "pictures": ["https://basket-17.wbbasket.ru/.../1.webp"],
        "manufacturerCountries": ["Аргентина"],
        "weightDimensions": {
          "length": 12,
          "width": 5,
          "height": 3,
          "weight": 0.115
        }
      },
      "mapping": {
        "marketCategoryId": 62920723
      }
    }
  ]
}
```

### Заголовки

```
Content-Type: application/json
Api-Key: {YM_API_TOKEN}
```

### Пример curl

```bash
curl -X POST "https://api.partner.market.yandex.ru/businesses/${BUSINESS_ID}/offer-mappings/update" \
  -H "Content-Type: application/json" \
  -H "Api-Key: ${YM_API_TOKEN}" \
  -d @products.json
```

## Шаг 5: Установка цен

### API Endpoint

```
POST https://api.partner.market.yandex.ru/businesses/{businessId}/offer-prices/updates
```

**ВАЖНО:** Используйте бизнес API (`/businesses/`), а не campaigns API!

### Формат запроса

```json
{
  "offers": [
    {
      "offerId": "2041385829402",
      "price": {
        "value": 65000,
        "currencyId": "RUR"
      }
    }
  ]
}
```

### Рекомендации по ценам

- Используйте цену **до скидки** с WB (`price`, не `finalPrice`)
- Это позволит устанавливать акционные цены на ЯМ отдельно
- `discountBase` = `price` (база для расчёта скидок)

## Шаг 6: Установка остатков

### API Endpoint

```
PUT https://api.partner.market.yandex.ru/v2/campaigns/{campaignId}/offers/stocks
```

### Формат запроса

```json
{
  "skus": [
    {
      "sku": "2041385829402",
      "warehouseId": 1872191,
      "items": [
        {
          "type": "FIT",
          "count": 1,
          "updatedAt": "2025-02-03T12:00:00+03:00"
        }
      ]
    }
  ]
}
```

### ВАЖНО: updatedAt

Дата обновления **не должна быть старше 1 дня**! Используйте текущее время:

```python
from datetime import datetime, timezone
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')
```

### Получение warehouseId

```
ym_get_warehouses()
```

Для KOTELNIKOVARTIFACT: `warehouseId = 1872191` (Склад Краснодар)

## Полный алгоритм миграции

```python
# 1. Получить товары с WB
products = wb_get_products_in_stock(minQuantity=1)

# 2. Трансформировать данные
ym_products = []
ym_prices = []
ym_stocks = []

for p in products:
    # Определить категорию
    category_id = get_category(p['title'])

    # Товар
    ym_products.append({
        'offer': {
            'offerId': p['barcode'],
            'name': p['title'],
            'description': p['description'][:2000],
            'vendor': p['brand'],
            'manufacturer': p['brand'],
            'vendorCode': p['vendorCode'],
            'barcodes': [p['barcode']],
            'pictures': p['photos'][:10],
            'manufacturerCountries': get_country(p) or ['Россия'],
            'weightDimensions': p['dimensions']
        },
        'mapping': {
            'marketCategoryId': category_id
        }
    })

    # Цена
    ym_prices.append({
        'offerId': p['barcode'],
        'price': {'value': p['price'], 'currencyId': 'RUR'}
    })

    # Остаток
    ym_stocks.append({
        'sku': p['barcode'],
        'warehouseId': WAREHOUSE_ID,
        'items': [{'type': 'FIT', 'count': p['stock'], 'updatedAt': NOW}]
    })

# 3. Загрузить товары
POST /businesses/{id}/offer-mappings/update
body: {'offerMappings': ym_products}

# 4. Установить цены
POST /businesses/{id}/offer-prices/updates
body: {'offers': ym_prices}

# 5. Установить остатки
PUT /v2/campaigns/{id}/offers/stocks
body: {'skus': ym_stocks}
```

## Частые проблемы и решения

### 1. Категория не определяется автоматически

**Проблема:** ЯМ неправильно определяет категорию товара.

**Решение:** Явно указать `marketCategoryId` в `mapping`:

```json
{
  "offer": { ... },
  "mapping": {
    "marketCategoryId": 67678046
  }
}
```

### 2. Ошибка "Stock should not be older than a day"

**Проблема:** Дата `updatedAt` в остатках старше 24 часов.

**Решение:** Использовать текущее время в ISO формате:

```python
from datetime import datetime, timezone
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')
```

### 3. Ошибка "Partner use only default price"

**Проблема:** Попытка установить цены через campaigns API.

**Решение:** Использовать **бизнес API**:

```
POST /businesses/{businessId}/offer-prices/updates
```

### 4. Дубликаты offerId

**Проблема:** На WB один vendorCode может иметь несколько размеров.

**Решение:** Использовать **баркод** как offerId (он уникален для каждого варианта).

### 5. Фото не загружаются

**Проблема:** URL с WB CDN недоступны.

**Решение:**
- Проверить что URL доступны (открыть в браузере)
- ЯМ принимает webp, но лучше jpg/png
- Максимум 10 фото на товар

### 6. Товары не появляются после загрузки

**Проблема:** Товары на модерации.

**Решение:** Модерация занимает 1-2 дня. Проверить статус:

```
POST /businesses/{businessId}/offer-mappings
```

## MCP Tools

| Tool | Использование |
|------|---------------|
| `wb_get_products_in_stock` | Получить товары WB с остатками |
| `ym_get_categories` | Дерево категорий ЯМ |
| `ym_search_categories` | Поиск категории по названию |
| `ym_update_products` | Создание/обновление товаров |
| `ym_update_prices` | Установка цен |
| `ym_update_stocks` | Установка остатков |
| `ym_get_warehouses` | Список складов |
| `ym_get_products` | Проверка загруженных товаров |

## Переменные окружения

```bash
YM_API_TOKEN="..."      # API ключ Яндекс.Маркета
YM_BUSINESS_ID="..."    # ID бизнеса
YM_CAMPAIGN_ID="..."    # ID магазина (кампании)
```

Для KOTELNIKOVARTIFACT:
- Business ID: `191766894`
- Campaign ID: `148697627`
- Warehouse ID: `1872191`

## Чек-лист миграции

- [ ] Получить товары с WB (`wb_get_products_in_stock`)
- [ ] Определить категории для каждого товара
- [ ] Использовать баркод как offerId (уникальность!)
- [ ] Обрезать описание до 2000 символов
- [ ] Ограничить фото до 10 штук
- [ ] Указать `marketCategoryId` для каждого товара
- [ ] Загрузить товары (`/offer-mappings/update`)
- [ ] Установить цены (`/offer-prices/updates`)
- [ ] Установить остатки с актуальной датой
- [ ] Проверить статус модерации

---

## Источники

- Яндекс.Маркет Partner API Documentation
- Опыт миграции KOTELNIKOVARTIFACT (февраль 2025)
