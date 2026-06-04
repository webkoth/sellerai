# SellerAI — Starter Template

> Рабочее пространство Claude Code для управления продажами на маркетплейсах (Wildberries, Ozon, Яндекс.Маркет)

## Быстрый старт

```bash
# 1. Клонируйте репозиторий
git clone <repo-url> my-store
cd my-store

# 2. Скопируйте шаблон env и заполните токены
cp .env.example .env
nano .env

# 3. Соберите MCP-серверы
for s in wb ozon ym; do (cd "mcp/$s-mcp" && npm install && npm run build); done

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

Проект организован в соответствии с [ARCHITECTURE.md](docs/ARCHITECTURE.md):

```
.
├── .claude/                # Agent Config (Agents, Skills, Commands)
│   ├── agents/             # Автономные агенты
│   ├── skills/             # Доменные знания и legacy-scripts
│   ├── commands/           # Slash-команды
│   └── knowledge/          # База знаний (SSOT)
├── mcp/                    # MCP Servers (wb / ozon / ym)
├── docs/                   # Документация (+ api-reference)
├── config/                 # Конфигурационные файлы
├── data/                   # Справочники (категории, комиссии), аудиты
└── README.md
```

> **Note:** Legacy-скрипты лежат в `.claude/skills/legacy-scripts/`.

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
- Критичные операции (изменение цен, остатков, ответы на отзывы) требуют `confirm=true`
- Без `confirm=true` показывается preview изменений (БЫЛО → СТАЛО)

## Требования

- Node.js 18+
- Claude Code CLI

## Лицензия

MIT
