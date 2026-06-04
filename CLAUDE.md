# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# SellerAI — Marketplace Workspace

Рабочее пространство для управления продажами на маркетплейсах Wildberries, Ozon и Яндекс.Маркет.

## Команды разработки

### MCP серверы (TypeScript)

```bash
# Wildberries MCP
cd mcp/wb-mcp && npm run build      # Сборка
cd mcp/wb-mcp && npm run dev        # Dev режим с hot reload
cd mcp/wb-mcp && npm run typecheck  # Проверка типов

# Ozon MCP
cd mcp/ozon-mcp && npm run build
cd mcp/ozon-mcp && npm run dev

# Яндекс.Маркет MCP
cd mcp/ym-mcp && npm run build
cd mcp/ym-mcp && npm run dev
```

**После изменений в MCP серверах:** пересобрать (`npm run build`) и перезапустить Claude Code.

## Архитектура

```
.claude/
├── skills/           # Доменные знания (24 skills) — активируются по контексту
├── commands/         # Slash-команды (19 commands)
├── agents/           # Специализированные агенты (L1/L2)
├── knowledge/        # Формулы и бенчмарки WB
└── settings.json     # Настройки (language: russian)

mcp/
├── wb-mcp/           # MCP сервер Wildberries
├── ozon-mcp/         # MCP сервер Ozon
└── ym-mcp/           # MCP сервер Яндекс.Маркет

.mcp.json             # Конфиг MCP-серверов (wb / ozon / ym / firecrawl)
```

## Агенты — иерархия L1/L2

```
L1 — operations-director (стратегический оркестратор)
       │
       ▼ (через Agent tool, параллельно)
L2 ── ads-optimizer       — реклама, ROI, ДРР
   ├─ content-optimizer   — SEO, карточки
   ├─ marketplace-analyst — аналитика, ABC, юнит-эк
   ├─ review-manager      — отзывы, рейтинг
   └─ external-traffic-manager — блогеры, внешний трафик
```

| Агент | Уровень | Зона ответственности | Когда вызывать |
|-------|---------|----------------------|----------------|
| `operations-director` | L1 | Стратегия, аудит, приоритизация, разрешение конфликтов | `/audit`, комплексные запросы (>2 направлений) |
| `ads-optimizer` | L2 | Реклама WB | Узкие задачи по рекламе |
| `content-optimizer` | L2 | SEO и карточки | Узкие задачи по контенту |
| `marketplace-analyst` | L2 | Продажи, юнит-эк | Аналитика и финансы |
| `review-manager` | L2 | Отзывы и репутация | Работа с отзывами |
| `external-traffic-manager` | L2 | Внешний трафик | `/external-deal`, КП от блогеров |
| `social-media-content-transformer` | L2 | Контент для соцсетей | Перевод материалов в посты |

**Правило:** для узких задач (одно направление) — обращайся к L2 напрямую. L1 нужен только для комплексных стратегических задач.

## Команды Phase 1

| Команда | Описание |
|---------|----------|
| `/audit [target] [period=30d]` | Запуск комплексного аудита через operations-director |
| `/external-deal [article]` | Оценка КП от блогера через external-traffic-manager |

## Skills — пополнения Phase 1

| Skill | Назначение | Кто использует |
|-------|-----------|----------------|
| `marketplace-operations-director` | ICE-МП, шаблон стратегического отчёта, правила разрешения конфликтов | `operations-director` |
| `external-traffic-economics` | CPV/CPO/безубыточность, бенчмарки по нишам, ТЗ на интеграцию | `external-traffic-manager` |
| `blogger-vetting-checklist` | Проверка блогера на накрутку (5 мин / 30 мин) | `external-traffic-manager` |

## MCP инструменты

> `(confirm)` — операция изменяет данные и требует `confirm=true`; без него возвращается preview (БЫЛО → СТАЛО).

### Wildberries (wb-mcp)

| Инструмент | Описание |
|------------|----------|
| `wb_get_inventory` | Остатки FBO/FBS по товарам |
| `wb_get_products_in_stock` | Товары с остатком > 0 (быстрый список) |
| `wb_get_warehouses` | Склады продавца |
| `wb_get_prices` | Цены и скидки |
| `wb_update_price` | Изменить цену `(confirm)` |
| `wb_get_cards` | Карточки товаров |
| `wb_update_card` | Обновить карточку `(confirm)` |
| `wb_get_orders` | Заказы |
| `wb_get_sales` | Продажи (выкупы) |
| `wb_get_sales_funnel` | Воронка продаж (требует подписку «Джем») |
| `wb_get_reviews` | Отзывы |
| `wb_reply_review` | Ответить на отзыв `(confirm)` |
| `wb_get_campaigns` | Рекламные кампании |
| `wb_get_campaign_stats` | Статистика рекламы |
| `wb_pause_campaign` | Пауза кампании `(confirm)` |
| `wb_update_campaign_budget` | Бюджет кампании `(confirm)` |
| `wb_update_campaign_cpm` | Ставка CPM `(confirm)` |
| `wb_get_balance` | Баланс |
| `wb_get_payments` | Выплаты |
| `wb_get_realization_report` | Отчёт о реализации |
| `wb_get_npd_report` | Отчёт для НПД (самозанятые) |
| `wb_get_seller_info` | Профиль продавца |
| `wb_get_supplies` / `wb_get_supply` | Поставки FBS (список / детали) |
| `wb_create_supply` / `wb_add_to_supply` / `wb_close_supply` / `wb_delete_supply` | Управление поставкой FBS `(confirm)` |
| `wb_get_documents` / `wb_get_document_categories` / `wb_download_document` | Документы |

### Ozon (ozon-mcp)

| Инструмент | Описание |
|------------|----------|
| `ozon_get_products` | Список товаров |
| `ozon_get_product_info` | Детальная информация |
| `ozon_update_product` | Обновить товар `(confirm)` |
| `ozon_get_prices` | Цены с комиссиями |
| `ozon_update_price` | Изменить цену `(confirm)` |
| `ozon_get_stocks` | Остатки FBO/FBS |
| `ozon_update_stocks` | Обновить остатки `(confirm)` |
| `ozon_get_orders` | Заказы |
| `ozon_get_reviews` | Отзывы |
| `ozon_reply_review` | Ответить на отзыв `(confirm)` |
| `ozon_import_products` | Импорт товаров |
| `ozon_get_import_status` | Статус импорта |
| `ozon_get_categories` | Дерево категорий |
| `ozon_get_category_attributes` | Атрибуты категории |
| `ozon_get_balance` | Баланс |
| `ozon_get_transactions` | Транзакции (финансы) |

### Яндекс.Маркет (ym-mcp)

| Инструмент | Описание |
|------------|----------|
| `ym_get_campaigns` / `ym_get_campaign` | Магазины (список / детали) |
| `ym_get_products` | Товары |
| `ym_update_products` | Обновить товары `(confirm)` |
| `ym_get_stocks` | Остатки |
| `ym_update_stocks` | Обновить остатки `(confirm)` |
| `ym_get_prices` | Цены |
| `ym_update_prices` | Изменить цены `(confirm)` |
| `ym_get_orders` | Заказы |
| `ym_get_reviews` | Отзывы |
| `ym_reply_review` | Ответить на отзыв `(confirm)` |
| `ym_get_quality_rating` | Индекс качества |
| `ym_get_categories` / `ym_search_categories` | Категории (дерево / поиск) |
| `ym_get_warehouses` | Склады |
| `ym_get_balance` / `ym_get_payments` | Финансы |

## Критичные операции

Операции с `confirm=true` требуют явного подтверждения:
- Изменение цен
- Обнуление остатков
- Ответы на отзывы

Без `confirm=true` показывается preview изменений (БЫЛО → СТАЛО).

## API токены

```bash
# .env файл
WB_API_TOKEN="..."           # ЛК WB: seller.wildberries.ru/api-integrations
OZON_CLIENT_ID="..."         # ЛК Ozon: seller.ozon.ru/app/settings/api-keys
OZON_API_TOKEN="..."
YM_API_TOKEN="..."           # ЛК YM: partner.market.yandex.ru
YM_BUSINESS_ID="..."
YM_CAMPAIGN_ID="..."
FIRECRAWL_API_KEY="..."      # firecrawl.dev — парсинг документации МП
```

## Стиль общения

- Язык: **русский**, технические термины на английском
- Конкретность: цифры, факты, примеры
- Действия: предлагать конкретные шаги, не только анализ

## Форматы вывода

```
🔴 КРИТИЧНО: [проблема]
🟡 ВНИМАНИЕ: [предупреждение]
🟢 OK: [всё в порядке]

💡 Рекомендация: [что сделать]
   Причина: [почему]
   Ожидаемый эффект: [результат]
```

## Ключевые метрики

- **Оборачиваемость** — дни до продажи остатка (норма < 60 дней)
- **Маржинальность** — прибыль / выручка (норма 25-40%)
- **Выкупаемость** — выкупы / заказы (норма 70-85%)
- **CTR** — клики / показы (норма 3-7%)
- **ROI рекламы** — (выручка - расход) / расход (норма > 100%)

---

## Бизнес-процессы

### SLA по тарифам

| Тариф | Обычные запросы | Критичные запросы | AI-запросов/мес |
|-------|-----------------|-------------------|-----------------|
| Starter (9 900₽) | до 24ч | до 24ч | 20 |
| Growth (29 900₽) | до 4ч | до 4ч | 100 |
| Scale (79 900₽) | до 4ч | до 1ч | безлимит |

### Приоритеты запросов

| Приоритет | Тип | SLA | Примеры |
|-----------|-----|-----|---------|
| P1 | Блокер продаж | 1-2ч | Товар пропал из выдачи |
| P2 | Потеря денег | 4ч | Реклама сливает бюджет |
| P3 | Оптимизация | 24ч | Как улучшить конверсию |
| P4 | Вопрос | 48ч | Как работает СПП |

### Регулярные задачи

**Ежедневно:**
- Проверка алертов (остатки < 7 дней, негативные отзывы)
- Мониторинг рекламы (ROI < 0%)
- Ответы на срочные вопросы

**Еженедельно (понедельник):**
- `/weekly-report` — еженедельный отчёт
- Проверка рекламных кампаний
- Ответы на отзывы (пакетно)
- ABC-анализ

**Ежемесячно (1-е число):**
- Полный аналитический отчёт
- Сравнение с прошлым месяцем
- Юнит-экономика по товарам
- Стратегическая сессия (Scale)

### Документация

- **Тарифы и услуги:** `docs/PRICING.md`
- **Онбординг клиента:** `docs/ONBOARDING.md`
- **API-справочник:** `docs/api-reference/{wildberries,ozon,yandex-market}/`
