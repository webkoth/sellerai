# Анализ данных маркетплейсов и архитектуры синхронизации

**Дата анализа:** 2025-12-31

## 1. Статистика по маркетплейсам

| Маркетплейс | Товаров | С наличием | Файл экспорта |
|-------------|---------|------------|---------------|
| Wildberries | 265 | 0* | wildberries_products_2025-12-31.json |
| Ozon | 72 | 0** | ozon_products_2025-12-31.json |
| Yandex Market | 146 | 84 | yandex_market_products_2025-12-31.json |

\* WB остатки не получены (нужен отдельный API с правами на склады)
\** Ozon остатки/цены не получены (404 ошибка API)

## 2. Совпадение SKU между маркетплейсами

```
WB (master):     265 товаров
├── WB + Ozon:   71 совпадение (почти все товары Ozon есть на WB)
├── WB + Yandex: 144 совпадения (почти все товары Yandex есть на WB)
└── Все три:    71 товар присутствует на всех маркетплейсах
```

**Вывод:** WB является master-маркетплейсом. Ozon и Yandex — подмножества WB.

## 3. Структура идентификаторов

### Wildberries
```json
{
  "nmID": 731575790,           // WB internal ID (число)
  "vendorCode": "957384759763", // Артикул продавца = наш internalSku
  "imtID": 748091602,           // ID объединённой карточки
  "sizes": [{
    "skus": ["2048101268606"]   // БАРКОДЫ (не SKU!)
  }]
}
```

### Ozon
```json
{
  "product_id": 1725413783,  // Ozon internal ID
  "offer_id": "957384759763" // Артикул продавца = наш internalSku
}
```

### Yandex Market
```json
{
  "offer": {
    "offerId": "957384759763",  // Артикул продавца = наш internalSku
    "barcodes": ["2048101268606"]
  },
  "mapping": {
    "marketCategoryId": 69118464,
    "marketCategoryName": "Подвески ювелирные"
  }
}
```

## 4. Ключ связи между маркетплейсами

**Связь по артикулу продавца (SKU):**
- WB: `vendorCode`
- Ozon: `offer_id`
- Yandex: `offerId`

Все три маркетплейса используют **одинаковый артикул продавца** как ключ связи.

**ВАЖНО:** WB в заказах передаёт **баркод** (из `sizes[].skus[]`), а не `vendorCode`!

## 5. Проблемы текущей архитектуры

### 5.1 Проблема с баркодами в заказах WB

**Текущая логика:**
```
WB Order → item.sku = "2047668668362" (это БАРКОД)
OrderPollWorker → ищет по externalSku/externalId → НЕ НАХОДИТ
```

**Решение (уже реализовано):**
Добавлен fallback поиск по `barcode` в `canonical_products`.

### 5.2 Хранение множественных баркодов

**Проблема:**
- WB товар может иметь несколько размеров → несколько баркодов
- Текущая схема: `barcode: string | null` — только один баркод

**Данные:**
- WB: 265 товаров → 296 уникальных баркодов (некоторые товары с размерами)
- Yandex: 146 товаров → 146 баркодов

**Рекомендация:**
```sql
-- Добавить таблицу для множественных баркодов
CREATE TABLE product_barcodes (
  id UUID PRIMARY KEY,
  canonical_product_id UUID REFERENCES canonical_products(id),
  barcode VARCHAR(50) NOT NULL,
  size_code VARCHAR(50),  -- для связи с размером
  UNIQUE(barcode)
);
CREATE INDEX idx_product_barcodes_barcode ON product_barcodes(barcode);
```

### 5.3 Неполные данные о ценах

**Проблема:**
- WB: цены требуют отдельного API (`/api/v2/list/goods/filter`)
- Ozon: `getPricesInfo` возвращает 404
- Yandex: цены получены для всех 146 товаров

**Рекомендация:**
Доработать клиенты маркетплейсов для корректного получения цен.

### 5.4 Хранение категорий

**Текущая схема:**
```typescript
categoryId: string | null;           // Внутренняя категория
categoryMappingId: string | null;    // Связь с маппингом категорий
```

**Данные маркетплейсов:**
- WB: `subjectID`, `subjectName` (категория WB)
- Yandex: `mapping.marketCategoryId`, `mapping.marketCategoryName`
- Ozon: Нет в базовом ответе (нужен отдельный запрос)

**Рекомендация:**
Таблица `category_mappings` уже создана — нужно заполнить данными при синхронизации.

## 6. Рекомендации по доработке БД

### 6.1 Добавить таблицу product_barcodes
Для поддержки множественных баркодов (товары с размерами).

### 6.2 Расширить marketplaceData
Текущая структура `jsonb` правильная, но нужно стандартизировать:
```typescript
interface WBMarketplaceData {
  nmId: number;
  imtId: number;
  vendorCode: string;
  subjectId?: number;
  subjectName?: string;
  barcodes?: string[];  // Все баркоды товара
}
```

### 6.3 Добавить поле для размеров
```sql
ALTER TABLE canonical_products
ADD COLUMN sizes JSONB DEFAULT '[]';
-- Формат: [{code: "S", barcode: "123..."}, {code: "M", barcode: "456..."}]
```

## 7. Рекомендации по бизнес-логике

### 7.1 Поиск товара по заказу (уже исправлено)
```typescript
// Порядок поиска для item.sku из заказа:
1. product_marketplace_mappings.externalSku
2. product_marketplace_mappings.externalId
3. canonical_products.internalSku
4. canonical_products.barcode  // ← ДОБАВЛЕНО
5. product_barcodes.barcode    // ← TODO: добавить
```

### 7.2 Синхронизация остатков
При получении заказа с любого маркетплейса:
1. Найти canonical_product по SKU/barcode
2. Уменьшить totalStock на quantity
3. Отправить обновление на ВСЕ маркетплейсы (кроме источника заказа)

### 7.3 Inbound sync (WB → БД)
```
1. Получить товары с WB (getProductsList)
2. Для каждого товара:
   - internalSku = vendorCode
   - barcode = sizes[0].skus[0] (первый баркод)
   - Сохранить все barcodes в marketplaceData
3. Создать/обновить canonical_product
4. Создать/обновить product_marketplace_mapping
```

### 7.4 Outbound sync (БД → Ozon/Yandex)
```
1. Получить canonical_products без маппинга на целевой маркетплейс
2. Для каждого товара:
   - Найти/создать карточку на маркетплейсе
   - Сохранить external_id и external_sku
   - Синхронизировать цены и остатки
```

## 8. Итоги

**Что работает:**
- ✅ WB как master-маркетплейс
- ✅ Связь товаров по vendorCode/offer_id/offerId
- ✅ Inbound sync товаров с WB
- ✅ Order polling со всех маркетплейсов
- ✅ Поиск товара по баркоду для заказов WB

**Что нужно доработать:**
- ⚠️ Поддержка множественных баркодов (товары с размерами)
- ⚠️ Получение цен с WB и Ozon
- ⚠️ Заполнение category_mappings при синхронизации
- ⚠️ Outbound sync товаров на Ozon и Yandex
- ⚠️ Полный цикл синхронизации остатков
