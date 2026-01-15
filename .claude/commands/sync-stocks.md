---
description: Синхронизация остатков между маркетплейсами (WB, Ozon, Яндекс.Маркет)
arguments:
  - name: direction
    description: "Направление: compare, wb-to-ozon, ozon-to-wb, wb-to-ym, ym-to-wb, ozon-to-ym, ym-to-ozon, all-from-wb"
    required: false
  - name: warehouse
    description: ID склада для синхронизации (опционально)
    required: false
  - name: marketplaces
    description: "Какие МП сравнивать: wb-ozon, wb-ym, ozon-ym, all (по умолчанию all)"
    required: false
---

# Синхронизация остатков WB ↔ Ozon ↔ YM

Синхронизирует остатки товаров между маркетплейсами по артикулу (vendorCode/offerId).

## Алгоритм

### 1. Получение остатков

```
# Wildberries FBS остатки
wb_get_inventory(mode: "fbs", minQuantity: 0)

# Ozon FBS остатки
ozon_get_stocks(visibility: "ALL")

# Яндекс.Маркет остатки
ym_get_stocks({})
```

### 2. Сопоставление товаров

Сопоставь товары по артикулу:
- WB: `vendorCode`
- Ozon: `offer_id`
- YM: `offerId` (он же sku)

**Формат маппинга:**
```
WB vendorCode: "JW-NB-001" → Ozon offer_id: "JW-NB-001" → YM offerId: "JW-NB-001"
```

### 3. Сравнение остатков

Выведи таблицу сравнения:

```markdown
## Сравнение остатков WB ↔ Ozon ↔ YM

| Артикул | WB | Ozon | YM | Мин | Статус |
|---------|-----|------|-----|-----|--------|
| JW-001  | 5   | 3    | 4   | 3   | Расхождение |
| JW-002  | 0   | 2    | 1   | 0   | WB закончился |
| JW-003  | 10  | 10   | 10  | 10  | Синхронизировано |
```

### 4. Направления синхронизации

| Направление | Источник | Приёмник | Описание |
|-------------|----------|----------|----------|
| `compare` | — | — | Только показать расхождения |
| `wb-to-ozon` | WB | Ozon | Обновить Ozon по WB |
| `ozon-to-wb` | Ozon | WB | Обновить WB по Ozon |
| `wb-to-ym` | WB | YM | Обновить YM по WB |
| `ym-to-wb` | YM | WB | Обновить WB по YM |
| `ozon-to-ym` | Ozon | YM | Обновить YM по Ozon |
| `ym-to-ozon` | YM | Ozon | Обновить Ozon по YM |
| `all-from-wb` | WB | Ozon + YM | Синхронизировать все с WB |

### 5. Применение изменений

#### Обновление Ozon
```
# Preview изменений
ozon_update_stocks(stocks: [
  { offerId: "JW-001", warehouseId: 123, stock: 5 }
], confirm: false)

# После подтверждения
ozon_update_stocks(stocks: [...], confirm: true)
```

#### Обновление YM
```
# Preview изменений
ym_update_stocks(stocks: [
  { sku: "JW-001", warehouseId: 456, count: 5 }
], confirm: false)

# После подтверждения
ym_update_stocks(stocks: [...], confirm: true)
```

## Формат вывода

### Сводка

```markdown
## Синхронизация остатков

**Направление:** {{ direction }}
**Дата:** {{ timestamp }}

### Статистика
| Маркетплейс | Товаров | С остатком | Нулевых |
|-------------|---------|------------|---------|
| Wildberries | {{ wb_count }} | {{ wb_in_stock }} | {{ wb_zero }} |
| Ozon | {{ ozon_count }} | {{ ozon_in_stock }} | {{ ozon_zero }} |
| Яндекс.Маркет | {{ ym_count }} | {{ ym_in_stock }} | {{ ym_zero }} |

**Сопоставлено:** {{ matched }} товаров
**Расхождений:** {{ diff_count }}

### Критичные расхождения

| Артикул | Название | WB | Ozon | YM | Действие |
|---------|----------|-----|------|-----|----------|
| ... | ... | ... | ... | ... | Обновить на [МП] |
```

### Алерты

```
КРИТИЧНО: {{ count }} товаров с нулевым остатком на одной из площадок
ВНИМАНИЕ: {{ count }} товаров с расхождением > 5 шт
OK: {{ count }} товаров синхронизированы
```

## Приоритеты синхронизации

| Ситуация | Приоритет | Рекомендация |
|----------|-----------|--------------|
| Нулевой остаток на МП с продажами | P1 | Срочно синхронизировать |
| Расхождение > 50% | P2 | Проверить и синхронизировать |
| Расхождение 1-5 шт | P3 | Плановая синхронизация |

## Получение складов

```
# Склады WB (FBS)
wb_get_warehouses(type: "fbs")

# Склады Ozon (из ozon_get_stocks)
# warehouse_id в ответе

# Склады YM
ym_get_warehouses({})
```

## Используемые инструменты

| MCP Tool | Маркетплейс | Назначение |
|----------|-------------|------------|
| `wb_get_inventory` | WB | Получить остатки |
| `ozon_get_stocks` | Ozon | Получить остатки |
| `ym_get_stocks` | YM | Получить остатки |
| `ozon_update_stocks` | Ozon | Обновить остатки |
| `ym_update_stocks` | YM | Обновить остатки |

## Важные замечания

1. **ВСЕГДА показывай preview** перед применением изменений
2. **Требуй подтверждения** пользователя для записи
3. **Проверяй warehouseId** — склады должны соответствовать
4. Учитывай что один товар может быть на нескольких складах
5. YM использует `count` вместо `stock` в API

## Ссылки

- Skill: `wb-inventory` — работа с остатками WB
- Skill: `ozon-basics` — основы Ozon
- Skill: `yandex-market-basics` — основы Яндекс.Маркет
- Skill: `ozon-import-from-wb` — миграция товаров
