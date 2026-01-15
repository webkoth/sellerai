---
name: bulk-price-update
description: Массовое изменение цен на товары по условиям
arguments:
  - name: action
    description: "Действие: increase (повысить), decrease (понизить), set (установить)"
    required: true
  - name: value
    description: "Значение: число (абсолютное) или процент (например 10%)"
    required: true
  - name: filter
    description: "Фильтр товаров: all, category:X, brand:X, margin<X%, abc:C"
    required: false
  - name: marketplace
    description: Маркетплейс (wb, ozon, ym, all)
    required: false
---

# Массовое изменение цен

Измени цены на товары по заданным условиям.

## Параметры

- **Действие:** {{ action }}
- **Значение:** {{ value }}
- **Фильтр:** {{ filter | default: "all" }}
- **Маркетплейс:** {{ marketplace | default: "wb" }}

## Алгоритм

### 1. Получи список товаров

{% if marketplace == "ozon" %}
```
ozon_get_prices — получить все цены
```
{% elsif marketplace == "ym" %}
```
ym_get_prices — получить все цены
```
{% elsif marketplace == "all" %}
```
wb_get_prices + ozon_get_prices + ym_get_prices
```
{% else %}
```
wb_get_prices — получить все цены
```
{% endif %}

### 2. Примени фильтр

| Фильтр | Логика |
|--------|--------|
| `all` | Все товары |
| `category:Одежда` | Только товары категории |
| `brand:Nike` | Только бренд |
| `margin<20%` | Товары с маржой менее 20% |
| `abc:C` | Товары группы C (по ABC-анализу) |
| `price>5000` | Товары дороже 5000₽ |
| `price<1000` | Товары дешевле 1000₽ |
| `stock<10` | Товары с остатком менее 10 шт |

### 3. Рассчитай новые цены

**Для каждого товара:**

{% if action == "increase" %}
```
Если {{ value }} содержит % :
  Новая_цена = Текущая_цена × (1 + {{ value }}/100)
Иначе:
  Новая_цена = Текущая_цена + {{ value }}
```
{% elsif action == "decrease" %}
```
Если {{ value }} содержит % :
  Новая_цена = Текущая_цена × (1 - {{ value }}/100)
Иначе:
  Новая_цена = Текущая_цена - {{ value }}
```
{% else %}
```
Новая_цена = {{ value }}
```
{% endif %}

### 4. Проверь ограничения

- Скидка не более 70% от базовой цены
- Цена не ниже себестоимости (если известна)
- Цена не ниже 100₽ (минимум маркетплейса)

### 5. Покажи preview

**НЕ применяй изменения автоматически!**

Выведи таблицу с изменениями и запроси подтверждение.

## Формат вывода

```markdown
## Массовое изменение цен

**Действие:** {{ action }} на {{ value }}
**Фильтр:** {{ filter | default: "все товары" }}
**Маркетплейс:** {{ marketplace | default: "WB" }}

---

### Preview изменений

| № | Товар | Текущая цена | Новая цена | Изменение |
|---|-------|--------------|------------|-----------|
| 1 | [название] | X ₽ | Y ₽ | +/-Z% |
| 2 | [название] | X ₽ | Y ₽ | +/-Z% |
| ... | ... | ... | ... | ... |

**Итого:** X товаров
**Средний рост/снижение:** Y%

---

### ⚠️ Предупреждения

- [Если есть товары с ценой ниже себестоимости]
- [Если скидка > 50%]
- [Если повышение > 30%]

---

### Подтверждение

Для применения изменений выполни команды:

{% if marketplace == "wb" or marketplace == "all" %}
**Wildberries:**
wb_update_price nmId=XXX price=YYY confirm=true
wb_update_price nmId=XXX price=YYY confirm=true
...
{% endif %}

{% if marketplace == "ozon" or marketplace == "all" %}
**Ozon:**
ozon_update_price offerId=XXX price=YYY confirm=true
...
{% endif %}

{% if marketplace == "ym" or marketplace == "all" %}
**Яндекс.Маркет:**
ym_update_prices prices=[{offerId: XXX, price: YYY}] confirm=true
...
{% endif %}

Или скажи "примени изменения" для автоматического выполнения.
```

## Примеры использования

### Повысить цены на 10% для всех товаров
```
/bulk-price-update action=increase value=10% filter=all marketplace=wb
```

### Снизить цены на товары группы C на 15%
```
/bulk-price-update action=decrease value=15% filter=abc:C marketplace=wb
```

### Установить цену 999₽ для товаров дешевле 1000₽
```
/bulk-price-update action=set value=999 filter=price<1000 marketplace=wb
```

### Повысить на 500₽ товары с маржой менее 15%
```
/bulk-price-update action=increase value=500 filter=margin<15% marketplace=all
```

## Безопасность

1. **Всегда показывай preview** перед применением
2. **Не применяй автоматически** — требуй явного подтверждения
3. **Логируй все изменения** в operations.log
4. **Проверяй лимиты** — скидка не более 70%
