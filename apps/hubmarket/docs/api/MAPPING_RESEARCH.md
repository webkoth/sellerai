# Исследование маппинга товаров между маркетплейсами

> **Дата:** 2024-12-29
> **Версия:** 1.0

---

## Идентификаторы товаров

| Поле | Wildberries | Ozon | Yandex Market |
|------|-------------|------|---------------|
| **Артикул продавца** | `vendorCode` | `offer_id` | `offerId` |
| **ID площадки** | `nmID` | `product_id` | `marketSku` |
| **Вариант товара** | `chrtId` | (в offer_id) | `cardIndex` |
| **SKU площадки** | — | `sku` | `marketSku` |

### Ключ связи товаров

```
vendorCode (WB) = offer_id (Ozon) = offerId (Yandex)
```

Продавец должен использовать **единый артикул** на всех площадках.

---

## Сравнительная таблица полей товара

| Canonical | Wildberries | Ozon | Yandex Market | Примечание |
|-----------|-------------|------|---------------|------------|
| `internalSku` | `vendorCode` | `offer_id` | `offerId` | Ключ связи |
| `name` | `title` | `name` | `name` | — |
| `brand` | `brand` | `attributes[85]` | `vendor` | Ozon: dictionary |
| `description` | `description` | отдельный запрос | `description` | — |
| `images` | `photos[].big` | `images[]` | `pictures[]` | — |
| `basePrice` | `sizes[].price / 100` | `price` | `basicPrice.value` | **WB в копейках!** |
| `barcode` | `sizes[].skus[]` | `barcode` | `barcodes[]` | — |
| `categoryId` | `subjectId` (imtID) | `description_category_id` | `categoryId` | — |

---

## Критические различия

### 1. Единицы измерения цены

| Маркетплейс | Единица | Пример | Конвертация |
|-------------|---------|--------|-------------|
| **Wildberries** | Копейки | `150000` = 1500 руб | `price / 100` |
| **Ozon** | Рубли (строка) | `"1500"` | `parseFloat(price)` |
| **Yandex** | Рубли (число) | `1500` | — |

### 2. Типы атрибутов

| Маркетплейс | Тип | Пример |
|-------------|-----|--------|
| **Wildberries** | Названия из справочника | `"Цвет": "Красный"` |
| **Ozon** | ID атрибута + dictionary_value_id | `{ attribute_id: 10096, values: [{ dictionary_value_id: 123 }] }` |
| **Yandex** | Названия в characteristics | `{ name: "Цвет", value: "Красный" }` |

### 3. Изображения

| Маркетплейс | Формат | Требования |
|-------------|--------|------------|
| **Wildberries** | `{ big: string }[]` | JPEG, WebP |
| **Ozon** | `string[]` (URL) | JPEG, PNG, мин. 200x200px, макс. 10MB |
| **Yandex** | `string[]` (URL) | JPEG, PNG, GIF |

---

## Известные ID атрибутов Ozon

| Атрибут | ID | Тип | Примечание |
|---------|-----|-----|------------|
| Бренд | `85` | dictionary | Обязательный |
| Цвет | `10096` | dictionary | — |
| Размер | `10097` | string | — |
| Страна | — | dictionary | — |
| Вес | — | number | В граммах |

Справочник значений: `POST /v1/description-category/attribute/values`

---

## API для получения категорий

### Wildberries
```
GET /content/v2/object/parent/all  — родительские категории
GET /content/v2/object/all          — все subjects (категории)
GET /content/v2/object/charcs/{subjectId} — характеристики категории
```

### Ozon
```
POST /v1/description-category/tree      — дерево категорий
POST /v1/description-category/attribute — атрибуты категории
POST /v1/description-category/attribute/values — значения атрибута
```

### Yandex Market
```
POST /v2/categories/tree                — дерево категорий
GET /v2/category/{categoryId}/parameters — параметры категории
```

---

## Справочники

### Wildberries
```
GET /content/v2/directory/colors    — цвета
GET /content/v2/directory/kinds     — пол/тип
GET /content/v2/directory/countries — страны
GET /content/v2/directory/seasons   — сезоны
GET /content/v2/directory/vat       — ставки НДС
```

### Ozon
Dictionary values загружаются через:
```
POST /v1/description-category/attribute/values
{
  "attribute_id": 85,
  "description_category_id": 17054869,
  "limit": 100
}
```

---

## Трансформация данных

### WB → Canonical

```typescript
toCanonical(wbProduct: WBProduct): Partial<CanonicalProduct> {
  return {
    internalSku: wbProduct.vendorCode,
    name: wbProduct.title,
    brand: wbProduct.brand,
    description: wbProduct.description,
    images: wbProduct.photos?.map(p => p.big),
    basePrice: (wbProduct.sizes?.[0]?.price || 0) / 100, // КОПЕЙКИ → РУБЛИ
    barcode: wbProduct.sizes?.[0]?.skus?.[0] || null,
  };
}
```

### Canonical → Ozon

```typescript
fromCanonical(canonical: CanonicalProduct): OzonProductImport {
  return {
    offer_id: canonical.internalSku,
    name: canonical.name,
    price: String(canonical.basePrice || 0), // Рубли как строка
    images: canonical.images,
    attributes: [
      {
        id: 85, // Бренд
        values: [{ value: canonical.brand }], // Нужен dictionary_value_id!
      },
    ],
  };
}
```

### Canonical → Yandex

```typescript
fromCanonical(canonical: CanonicalProduct): YandexOffer {
  return {
    offerId: canonical.internalSku,
    name: canonical.name,
    vendor: canonical.brand,
    description: canonical.description,
    pictures: canonical.images,
    basicPrice: {
      value: canonical.basePrice || 0,
      currencyId: 'RUB',
    },
  };
}
```

---

## Ограничения и валидация

### Wildberries
- `vendorCode` — уникальный для продавца
- Название — макс. 100 символов
- Требуется `subjectId` (категория)

### Ozon
- `offer_id` — уникальный, макс. 500 символов
- Название — макс. 500 символов
- Минимум 1 изображение
- Обязательные атрибуты зависят от категории

### Yandex Market
- `offerId` — уникальный
- Категория определяется автоматически или вручную
- Требуются обязательные параметры категории

---

## Рекомендации

1. **Используйте единый артикул** на всех площадках
2. **Храните цены в рублях** в canonical, конвертируйте для WB
3. **Кэшируйте справочники** Ozon (dictionary values)
4. **Валидируйте обязательные поля** перед отправкой на каждую площадку
5. **Логируйте ошибки** маппинга для отладки

---

## Связанные файлы

- `libs/marketplace-clients/src/wildberries/wildberries.client.ts`
- `libs/marketplace-clients/src/ozon/ozon.client.ts`
- `libs/marketplace-clients/src/yandex/yandex.client.ts`
- `apps/workers/src/shared/transformers/*.transformer.ts`
- `libs/core/src/database/entities/canonical-product.entity.ts`
