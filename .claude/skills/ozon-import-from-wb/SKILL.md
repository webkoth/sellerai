---
name: ozon-import-from-wb
description: Миграция товаров с Wildberries на Ozon. Используйте для переноса карточек товаров, маппинга атрибутов WB→Ozon, подготовки данных для импорта. Помогает ответить на вопросы "как перенести товар на Озон", "миграция WB→Ozon", "импорт из Wildberries".
context: fork
---

# Ozon Import from WB — Миграция товаров WB→Ozon

Skill для переноса товаров с Wildberries на Ozon с автоматическим маппингом атрибутов.

## Обзор процесса миграции

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  WB API     │ →  │  Маппинг    │ →  │  Подготовка │ →  │  Ozon API   │
│  (товары)   │    │  атрибутов  │    │  данных     │    │  (импорт)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Шаг 1: Получение товаров с WB

Используйте MCP tool `wb_get_inventory` или скрипт:

```bash
# Через MCP (рекомендуется)
# Вызовите: wb_get_inventory с параметром mode="fbs"

# Или через скрипт для полных данных с характеристиками
npx tsx scripts/wb-to-ozon-prepare.ts
```

**Данные из WB:**
- `nmId` → `offerId` (артикул)
- `title` → `name`
- `description` → `description`
- `photos[].big` → `images[]`
- `price`, `discount` → `price`, `oldPrice`
- `dimensions` → `weight`, `depth`, `height`, `width`
- `characteristics` → маппинг в `attributes`

## Шаг 2: Определение категории Ozon

### Поиск категории

```
# Используйте MCP tool
ozon_get_categories(parentId: 0)  # Корневые категории
ozon_get_categories(parentId: XXX) # Подкатегории
```

### Получение атрибутов категории

```
ozon_get_category_attributes(categoryId: 17027899)
```

**Результат:** список обязательных и опциональных атрибутов.

## Шаг 3: Маппинг атрибутов

### Обязательные атрибуты (пример для ювелирки)

| WB характеристика | Ozon атрибут | ID | Тип |
|-------------------|--------------|-----|-----|
| Бренд | Бренд | 85 | String |
| — | Пол | 9163 | Dictionary |
| — | Размер изделия | 5326 | Dictionary |
| Название | Название модели | 9048 | String |
| — | Тип | 8229 | Integer |

### Словарные значения (Dictionary)

Для атрибутов с `dictionary_id` нужно указать `dictionary_value_id`:

```json
{
  "id": 9163,
  "values": [{ "dictionary_value_id": 22881 }]  // Женский
}
```

**Справочники:** `docs/knowledge-base/ozon/dictionaries/`

### Маппинг характеристик WB → атрибуты Ozon

```typescript
const ATTR_MAPPING = {
  // WB характеристика → Ozon атрибут ID
  'Материал': 5309,
  'Цвет': 10096,
  'Страна производства': 4389,
  'Тип вставки': 5292,
};

const DICT_MAPPING = {
  // WB значение → Ozon dictionary_value_id
  'Бижутерный сплав': 61767,
  'серый': 61576,
  'черный': 61574,
  'Россия': 90295,
  'Натуральный камень': 970941536,
};
```

## Шаг 4: Подготовка данных для импорта

### Структура товара для Ozon

```typescript
interface OzonProduct {
  offerId: string;        // Уникальный артикул (vendorCode с WB)
  name: string;           // Название (до 200 символов)
  description: string;    // Описание (до 6000 символов)
  price: string;          // Цена ("1500")
  oldPrice: string;       // Старая цена для скидки
  vat: string;            // НДС: "0", "0.1", "0.2"
  descriptionCategoryId: number;  // ID категории Ozon
  barcode: string;        // Штрихкод (EAN13)
  images: string[];       // URL изображений
  weight: number;         // Вес в граммах
  depth: number;          // Глубина в мм
  height: number;         // Высота в мм
  width: number;          // Ширина в мм
  attributes: Array<{
    id: number;
    values: Array<{
      value?: string;
      dictionary_value_id?: number;
    }>;
  }>;
}
```

### Конвертация фото WB → Ozon

WB фото формат:
```
https://basket-XX.wbbasket.ru/volXXXX/partXXXXXX/XXXXXXX/images/big/1.webp
```

**Важно:** Ozon принимает webp, но рекомендуется jpg/png для лучшей обработки.

### Валидация перед импортом

1. ✅ Уникальный `offerId` (не дублируется)
2. ✅ Название ≤ 200 символов
3. ✅ Описание ≤ 6000 символов
4. ✅ Все обязательные атрибуты заполнены
5. ✅ Штрихкод валидный (EAN13)
6. ✅ Фото доступны по URL
7. ✅ Размеры > 0

## Шаг 5: Импорт на Ozon

### Через MCP (рекомендуется)

```
# 1. Preview импорта (без confirm)
ozon_import_products(products: [...], confirm: false)

# 2. Проверить preview, исправить ошибки

# 3. Выполнить импорт
ozon_import_products(products: [...], confirm: true)

# 4. Проверить статус
ozon_get_import_status(taskId: 123456)
```

### Статусы импорта

| Статус | Описание | Действие |
|--------|----------|----------|
| `pending` | В обработке | Подождать |
| `imported` | Успешно | Проверить карточку |
| `failed` | Ошибка | Исправить и повторить |

## Частые проблемы

### 1. Ошибка "Атрибут обязателен"

**Причина:** Не заполнен обязательный атрибут.

**Решение:**
```
ozon_get_category_attributes(categoryId: XXX)
# Найти is_required: true и добавить в attributes
```

### 2. Ошибка "Недопустимое значение словаря"

**Причина:** Указан неверный `dictionary_value_id`.

**Решение:**
```bash
# Посмотреть справочник
cat docs/knowledge-base/ozon/dictionaries/ozon-dictionaries.json | jq '.["Название атрибута"]'
```

### 3. Ошибка "Артикул уже существует"

**Причина:** `offerId` уже используется.

**Решение:** Добавить суффикс к артикулу: `JW-001` → `JW-001-OZ`

### 4. Фото не загружаются

**Причина:** URL недоступен или формат не поддерживается.

**Решение:**
- Проверить доступность URL
- Использовать jpg/png вместо webp
- Загрузить фото на свой хостинг

## Пример полного импорта

```typescript
const ozonProduct = {
  offerId: "JW-NB-AGT-M-0018",
  name: "Браслет из натурального камня метеорит Кампо Дель Сьело",
  description: "Уникальный браслет...",
  price: "59800",
  oldPrice: "65000",
  vat: "0",
  descriptionCategoryId: 17027899,
  barcode: "2041385829402",
  images: [
    "https://basket-17.wbbasket.ru/.../1.webp",
    "https://basket-17.wbbasket.ru/.../2.webp"
  ],
  weight: 115,
  depth: 120,
  height: 30,
  width: 50,
  attributes: [
    { id: 85, values: [{ value: "KOTELNIKOVARTIFACT" }] },  // Бренд
    { id: 9163, values: [{ dictionary_value_id: 22881 }] }, // Пол: Женский
    { id: 5326, values: [{ dictionary_value_id: 39290 }] }, // Размер: Безразмерный
    { id: 9048, values: [{ value: "Кампо Дель Сьело" }] },  // Название модели
    { id: 8229, values: [{ dictionary_value_id: 87458883 }] }, // Тип: Браслет
    { id: 5309, values: [{ dictionary_value_id: 61767 }] }, // Материал
    { id: 10096, values: [{ dictionary_value_id: 61576 }] }, // Цвет: серый
  ]
};
```

## Скрипты и утилиты

| Скрипт | Назначение |
|--------|------------|
| `scripts/wb-to-ozon-prepare.ts` | Получение товаров WB с остатками |
| `scripts/prepare-ozon-import.ts` | Подготовка данных для импорта |
| `scripts/execute-ozon-import.ts` | Выполнение импорта |
| `scripts/get-ozon-attributes.ts` | Получение атрибутов категории |

## MCP Tools

| Tool | Использование |
|------|---------------|
| `wb_get_inventory` | Получить товары WB |
| `ozon_get_categories` | Найти категорию Ozon |
| `ozon_get_category_attributes` | Атрибуты категории |
| `ozon_import_products` | Импорт товаров |
| `ozon_get_import_status` | Статус импорта |

## Справочники

- **Атрибуты категории:** `docs/knowledge-base/ozon/dictionaries/ozon-attributes.json`
- **Словари значений:** `docs/knowledge-base/ozon/dictionaries/ozon-dictionaries.json`
- **Опциональные атрибуты:** `docs/knowledge-base/ozon/dictionaries/ozon-optional-attributes.json`

---

## Источники

- Ozon Seller API v3 Documentation
- Скрипты миграции из проекта SellerAI
