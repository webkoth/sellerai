# SellerAI — Starter Template

> Рабочее пространство Claude Code для управления продажами на маркетплейсах (Wildberries, Ozon, Яндекс.Маркет)

## Быстрый старт

```bash
# 1. Клонируйте репозиторий
git clone <repo-url> my-store
cd my-store

# 2. Запустите установку
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. Заполните API токены
nano .env

# 4. Запустите Claude Code
claude
```

## Получение API токенов

| Маркетплейс | Где получить |
|-------------|--------------|
| Wildberries | seller.wildberries.ru → Настройки → Доступ к API |
| Ozon | seller.ozon.ru → Настройки → API ключи |
| Яндекс.Маркет | partner.market.yandex.ru → Настройки → API |

## Основные команды

| Команда | Описание |
|---------|----------|
| `/weekly-report` | Еженедельный отчёт по продажам |
| `/unit-economics` | Юнит-экономика товара |
| `/funnel` | Воронка продаж (WB) |
| `/seo-audit` | SEO-аудит карточки |
| `/competitors` | Анализ конкурентов |
| `/abc-analysis` | ABC-анализ ассортимента |
| `/review-reply` | Ответ на отзыв |

## Структура проекта

```
sellerai/
├── .claude/
│   ├── .mcp.json         # Конфигурация MCP серверов
│   ├── settings.json     # Настройки Claude Code
│   ├── hooks.json        # Автоматическая валидация
│   ├── agents/           # Специализированные агенты (4)
│   ├── commands/         # Slash-команды (17)
│   ├── skills/           # Доменные знания (19)
│   └── knowledge/        # База знаний по маркетплейсам
├── mcp/
│   ├── wb-mcp/           # MCP сервер Wildberries
│   ├── ozon-mcp/         # MCP сервер Ozon
│   └── ym-mcp/           # MCP сервер Яндекс.Маркет
├── scripts/
│   ├── setup.sh          # Скрипт установки
│   └── hooks/            # TypeScript хуки
├── docs/                 # Документация
├── .env.example          # Шаблон переменных окружения
├── CLAUDE.md             # Инструкции для Claude
└── README.md
```

## Модель использования

**Один клон = один клиент/магазин**

1. Клонируете шаблон для нового клиента
2. Настраиваете API токены клиента
3. Работаете через Claude Code
4. Улучшения фреймворка → PR в основной репозиторий

Клиентские данные (`.env`, логи, кэши) не версионируются.

## MCP инструменты

### Wildberries
- `wb_get_inventory` — остатки FBO/FBS
- `wb_get_prices` — цены и скидки
- `wb_get_orders` — заказы и выручка
- `wb_get_reviews` — отзывы
- `wb_get_campaigns` — рекламные кампании
- `wb_get_sales_funnel` — воронка продаж (требует "Джем")
- `wb_update_price` — изменение цены

### Ozon
- `ozon_get_products` — список товаров
- `ozon_get_prices` — цены с комиссиями
- `ozon_get_stocks` — остатки
- `ozon_get_orders` — заказы
- `ozon_update_price` — изменение цены

### Яндекс.Маркет
- `ym_get_products` — товары
- `ym_get_stocks` — остатки
- `ym_get_prices` — цены
- `ym_get_orders` — заказы
- `ym_get_reviews` — отзывы

## Безопасность

- API токены в `.env` (не версионируется)
- Критичные операции требуют `confirm=true`
- Все операции логируются в `logs/`
- Hooks валидируют изменения цен

## Требования

- Node.js 18+
- Claude Code CLI
- PostgreSQL (опционально)

## Лицензия

MIT
