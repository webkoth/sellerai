---
description: Комплексный стратегический аудит магазина через Operations Director
arguments:
  - name: target
    description: Цель аудита — артикул, бренд или "all" для всего магазина
    required: true
  - name: period
    description: Период анализа (7d, 30d, 90d) — по умолчанию 30d
    required: false
---

# /audit — Комплексный аудит магазина

Запускает агента `operations-director` для комплексного стратегического аудита.

## Аргументы

- `$1` (target) — что аудируем: артикул товара, название бренда или `all` для всего магазина
- `$2` (period) — период анализа, по умолчанию `30d`

## Шаги выполнения

### Шаг 1: Распарсить аргументы $ARGUMENTS

- Первый аргумент — target. Если не указан — спроси оператора через `AskUserQuestion`.
- Второй аргумент — period. Если не указан — используй `30d`.

### Шаг 2: Сформировать дату для имени файла

Получи текущую дату в формате `YYYY-MM-DD` через `date +%Y-%m-%d`. Сохрани в переменную для пути к отчёту.

### Шаг 3: Вызвать operations-director через Agent tool

Используй Agent tool с параметрами:
- `subagent_type`: `operations-director`
- `description`: `Комплексный аудит [target]`
- `prompt`:

```
Проведи комплексный аудит target=[TARGET] за период=[PERIOD].

Действия:
1. Запусти ПАРАЛЛЕЛЬНО (один message, 4 Agent tool calls):
   - ads-optimizer — топ-3 проблемы рекламы + точки роста
   - content-optimizer — SEO-аудит топ-10 SKU
   - marketplace-analyst — финансовая сводка + ABC + прогноз
   - review-manager — свежие отзывы, негатив, рейтинг
2. Используй методологию ICE-МП из skill marketplace-operations-director.
3. Сформируй стратегический отчёт по шаблону (TL;DR + 🔴 + 🟡 + KPI + план).
4. Сохрани полный отчёт в data/audits/[DATE]-[TARGET].md.
5. Верни оператору ТОЛЬКО TL;DR + путь к файлу (не весь отчёт).
```

Подставь конкретные значения `[TARGET]`, `[PERIOD]`, `[DATE]`.

### Шаг 4: Показать оператору результат

После завершения agent-вызова выведи:

```
✅ Аудит готов.

[TL;DR от operations-director]

📄 Полный отчёт: data/audits/[DATE]-[TARGET].md
```

## Пример

```
/audit all 30d
```
→ полный аудит магазина за 30 дней, отчёт в `data/audits/2026-05-27-all.md`.

```
/audit 123456789
```
→ аудит конкретного артикула за 30 дней (по умолчанию).
