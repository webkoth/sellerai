# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# SellerAI — Marketplace Workspace

Рабочее пространство для управления продажами на маркетплейсах Wildberries, Ozon, Яндекс.Маркет и Авито.

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

# Авито MCP
cd mcp/avito-mcp && npm run build
cd mcp/avito-mcp && npm run dev
```

**После изменений в MCP серверах:** пересобрать (`npm run build`) и перезапустить Claude Code.

### Hooks (TypeScript)

```bash
# Hooks выполняются автоматически, но для отладки:
npx ts-node scripts/hooks/check-api-tokens.ts    # Проверка токенов
npx ts-node scripts/hooks/validate-price-change.ts  # Валидация цен
npx ts-node scripts/hooks/log-operation.ts       # Логирование
```

### Парсер курсов (Python)

```bash
python3 scripts/parse_courses.py --file "courses/[курс]/[файл].pdf"
```

## Архитектура

```
.claude/
├── skills/           # Доменные знания (17 skills) — активируются по контексту
├── commands/         # Slash-команды (10 commands)
├── agents/           # Специализированные агенты с prompt-based hooks
├── hooks.json        # Конфигурация hooks (PreToolUse, PostToolUse, SessionStart)
└── settings.json     # Настройки (language: russian)

mcp/
├── wb-mcp/           # MCP сервер Wildberries
├── ozon-mcp/         # MCP сервер Ozon
├── ym-mcp/           # MCP сервер Яндекс.Маркет
└── avito-mcp/        # MCP сервер Авито

scripts/hooks/        # TypeScript hooks для валидации и логирования
├── types.ts          # Типы для hooks input/output
├── validate-price-change.ts  # PreToolUse: валидация изменения цен
├── log-operation.ts  # PostToolUse: логирование в logs/operations.log
└── check-api-tokens.ts       # SessionStart: проверка API токенов
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

## Hooks система

Автоматическая валидация и логирование операций:

| Hook | Event | Назначение |
|------|-------|------------|
| `check-api-tokens` | SessionStart | Проверка наличия API токенов при старте |
| `validate-price-change` | PreToolUse | Валидация изменения цен (лимит скидки 70%) |
| `log-operation` | PostToolUse | Логирование всех update_* операций |

Логи операций: `logs/operations.log`

## Skills — пополнения Phase 1

| Skill | Назначение | Кто использует |
|-------|-----------|----------------|
| `marketplace-operations-director` | ICE-МП, шаблон стратегического отчёта, правила разрешения конфликтов | `operations-director` |
| `external-traffic-economics` | CPV/CPO/безубыточность, бенчмарки по нишам, ТЗ на интеграцию | `external-traffic-manager` |
| `blogger-vetting-checklist` | Проверка блогера на накрутку (5 мин / 30 мин) | `external-traffic-manager` |

**Phase 2 (stubs):** `infographic-design-system`, `ai-visual-generation` — заготовки под будущих агентов.

## MCP инструменты

### Wildberries (wb-mcp)

| Инструмент | Описание |
|------------|----------|
| `wb_get_inventory` | Остатки FBO/FBS |
| `wb_get_prices` | Цены и скидки |
| `wb_get_cards` | Карточки товаров |
| `wb_get_orders` | Заказы и выручка |
| `wb_get_reviews` | Отзывы |
| `wb_reply_review` | Ответить на отзыв |
| `wb_get_campaigns` | Рекламные кампании |
| `wb_get_campaign_stats` | Статистика рекламы |
| `wb_get_sales_funnel` | Воронка продаж (требует подписку "Джем") |
| `wb_update_price` | Изменить цену (требует confirm=true) |

### Ozon (ozon-mcp)

| Инструмент | Описание |
|------------|----------|
| `ozon_get_products` | Список товаров |
| `ozon_get_product_info` | Детальная информация |
| `ozon_get_prices` | Цены с комиссиями |
| `ozon_get_stocks` | Остатки FBO/FBS |
| `ozon_get_orders` | Заказы |
| `ozon_update_price` | Изменить цену (требует confirm=true) |
| `ozon_update_stocks` | Обновить остатки (требует confirm=true) |
| `ozon_import_products` | Импорт товаров |
| `ozon_get_categories` | Дерево категорий |
| `ozon_get_category_attributes` | Атрибуты категории |

### Яндекс.Маркет (ym-mcp)

| Инструмент | Описание |
|------------|----------|
| `ym_get_campaigns` | Список магазинов |
| `ym_get_products` | Товары |
| `ym_get_stocks` | Остатки |
| `ym_get_prices` | Цены |
| `ym_get_orders` | Заказы |
| `ym_get_reviews` | Отзывы |
| `ym_get_quality_rating` | Индекс качества |
| `ym_update_prices` | Изменить цены (требует confirm=true) |
| `ym_update_stocks` | Обновить остатки (требует confirm=true) |
| `ym_reply_review` | Ответить на отзыв (требует confirm=true) |

### Авито (avito-mcp)

| Инструмент | Описание |
|------------|----------|
| `avito_get_items` | Список объявлений |
| `avito_get_item` | Детали объявления |
| `avito_get_items_stats` | Статистика просмотров |
| `avito_get_calls_stats` | Статистика звонков |
| `avito_update_item_price` | Изменить цену (требует confirm=true) |
| `avito_get_vas_prices` | Стоимость услуг продвижения |
| `avito_apply_vas` | Применить VAS (требует confirm=true) |
| `avito_get_promotions` | Активные продвижения |
| `avito_set_promotion` | Настроить продвижение (требует confirm=true) |
| `avito_get_reviews` | Отзывы продавца |
| `avito_reply_review` | Ответить на отзыв (требует confirm=true) |
| `avito_get_user_info` | Профиль и баланс |

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
YM_TOKEN="..."               # ЛК YM: partner.market.yandex.ru
YM_BUSINESS_ID="..."
YM_CAMPAIGN_ID="..."
AVITO_CLIENT_ID="..."        # developers.avito.ru (OAuth2)
AVITO_CLIENT_SECRET="..."
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
- **Бизнес-план:** `.claude/plans/velvet-swimming-glacier.md`
