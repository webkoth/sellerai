# Changelog

Все заметные изменения в проекте SellerAI документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и этот проект придерживается [семантического версионирования](https://semver.org/lang/ru/).

---

## [2.0.0] - 2025-12-29

### 🔴 Breaking Changes

#### Курсы вынесены из репозитория
- **Было:** Курсы в `courses/` (98GB в репозитории)
- **Стало:** Курсы в `~/sellerai-courses/` (отдельная директория)
- **Причина:** Уменьшение размера репозитория с 99GB до ~1GB (-99%)
- **Действия:** Переместить `courses/*` в `~/sellerai-courses/`
- **Затронутые файлы:** `scripts/parse_courses.py` (обновлён путь)

#### MCP конфигурация консолидирована
- **Было:** Два файла `.mcp.json` (корень + `.claude/`)
- **Стало:** Один файл `.claude/.mcp.json` + symlink в корне
- **Причина:** Устранение дублирования конфигурации
- **Действия:** Удалить корневой `.mcp.json`, создать symlink
- **Затронутые файлы:** `.mcp.json`, `.claude/.mcp.json`

#### Миграции БД объединены
- **Было:** Миграции в `/migrations/` и `/dashboard/migrations/`
- **Стало:** Все миграции в `/migrations/`
- **Причина:** Централизация схемы БД
- **Действия:** Применить `migrations/003_seller_settings.sql` если нужно
- **Затронутые файлы:** `dashboard/migrations/003_seller_settings.sql` → `migrations/003_seller_settings.sql`

#### Служебные файлы удалены
- Удалено 28 файлов `.DS_Store` (macOS)
- Удалён дубликат `marketplace-docs-parser.skill` в корне
- Добавлен `.DS_Store` в `.gitignore`

---

### ✨ Added

#### Knowledge Base — централизованное хранилище знаний
- `.claude/knowledge/formulas/wb-metrics.md` — формулы метрик WB (ROI, маржа, CTR, CR, оборачиваемость)
- `.claude/knowledge/formulas/wb-costs.md` — детализация расходов WB (комиссии, логистика, хранение, налоги)
- `.claude/knowledge/benchmarks/wb-benchmarks.md` — бенчмарки для 10 категорий товаров (одежда, электроника, косметика и др.)
- **Преимущество:** Формулы в одном месте, обновление = автоматически везде (DRY принцип)

#### API Reference для Ozon
- `docs/api-reference/ozon/` — 37 файлов документации Ozon API
  - Products, Prices & Stocks, Orders, Reviews, Analytics
  - FBO, FBS, realFBS delivery models
  - Postman collection с примерами
- **Формат:** LLM-friendly markdown с примерами кода

#### API Reference для Yandex Market
- `docs/api-reference/yandex-market/` — 3 файла документации Yandex Market API
  - Business API, FBS API
  - Campaign-centric workflow
- **Формат:** Структурированный markdown

#### Knowledge Base для маркетплейсов
- `docs/knowledge-base/wb/` — 12 файлов знаний о Wildberries
  - Getting started, Sales models, Product cards
  - Advertising, Analytics, Pricing & Discounts
  - Inventory & Logistics, Reviews & Communication
  - Courses index
- `docs/knowledge-base/ozon/` — 4 файла знаний об Ozon
  - Getting started, Sales models, Product cards
- `docs/knowledge-base/yandex-market/` — 10 файлов знаний о Яндекс.Маркет
  - Getting started, Sales models, Orders
  - Quality control, Storage & Logistics
  - Marketing & Promotions, Tools & Integration

#### Документация
- `docs/ARCHITECTURE.md` — описание многоуровневой архитектуры v2.0.0
  - Knowledge Base → Skills → Commands → Agents
  - Принципы DRY, SSOT, Separation of Concerns
  - Data flow диаграммы
  - Правила расширения
- `MIGRATION_GUIDE.md` — пошаговое руководство по миграции v1 → v2
  - Breaking changes
  - Процесс миграции (6 шагов)
  - Проблемы и решения
  - FAQ
- `CHANGELOG.md` — история изменений (этот файл)
- `migrations/README.md` — порядок применения миграций БД

---

### 🔄 Changed

#### Skills рефакторинг — убрано дублирование формул
**Рефакторированы 4 основных Skill:**
- `wb-unit-economics/SKILL.md` — вынесены формулы, добавлены типичные ошибки
- `wb-advertising/SKILL.md` — вынесены формулы, добавлен контекст "когда запускать рекламу"
- `wb-sales-funnel/SKILL.md` — вынесены формулы, добавлен принцип "узкого горлышка"
- `wb-pricing-strategy/SKILL.md` — вынесены формулы, добавлены принципы ценообразования

**Результат:**
- Размер Skills уменьшился на 40-50% (с 200-300 до 100-150 строк)
- Формулы теперь ссылаются на Knowledge Base вместо дублирования
- Добавлены разделы:
  - 📚 Формулы и расходы (ссылки на KB)
  - 🎯 Контекст применения (когда использовать)
  - ❌ Типичные ошибки (как НЕ надо)
  - 📊 Интерпретация результатов (что означают метрики)

**Обновлены Skills с добавлением ссылок на KB:**
- `ozon-basics/SKILL.md`
- `yandex-market-basics/SKILL.md`
- `wb-competitor-analysis/SKILL.md`
- `wb-inventory/SKILL.md`
- `wb-reviews-responder/SKILL.md`
- `wb-seo-expert/SKILL.md`
- `wb-supply-chain/SKILL.md`

#### README.md синхронизирован с CLAUDE.md
- **Было:** Противоречия в статусах маркетплейсов
  - Ozon: "В разработке"
  - Яндекс.Маркет: "Планируется"
- **Стало:** Реальные статусы
  - Wildberries: ✅ Полная поддержка (9 skills, API)
  - Ozon: ⚠️ Базовая поддержка (1 skill, без API)
  - Яндекс.Маркет: ⚠️ Базовая поддержка (1 skill, без API)
- Добавлены столбцы: Skills, API, Описание

#### CLAUDE.md обновлён
- Удалено упоминание несуществующего `scripts/get_stock.py`
- Добавлена инструкция по использованию MCP сервера `wb-mcp`
- Примеры вызова: `wb_get_inventory`, `wb_get_prices`, `wb_get_cards`

---

### 🐛 Fixed

#### Устранено дублирование конфигурации
- **Было:** `.mcp.json` в двух местах (корень и `.claude/`)
- **Стало:** Один файл `.claude/.mcp.json` + symlink для совместимости
- **Исправлено:** Конфликты при обновлении конфигурации

#### Устранено дублирование миграций
- **Было:** Миграции в `/migrations/` и `/dashboard/migrations/`
- **Стало:** Все миграции в `/migrations/`
- **Исправлено:** Путаница в порядке применения миграций

#### Очищены служебные файлы
- Удалено 28 файлов `.DS_Store` (macOS metadata)
- Удалён дубликат `marketplace-docs-parser.skill` в корне
- Добавлен `.DS_Store` в `.gitignore` для предотвращения

#### Устранено дублирование формул
- **Было:** Формулы дублировались в 13+ местах
- **Стало:** Формулы в одном месте (Knowledge Base)
- **Исправлено:** Риск несогласованности при обновлении

---

### 📊 Метрики v2.0.0

| Метрика | v1.0.0 | v2.0.0 | Улучшение |
|---------|--------|--------|-----------|
| **Размер репозитория** | 99GB | ~1GB | **-99%** |
| **Дублирование формул** | 13+ мест | 1 место | **-92%** |
| **Средний размер Skill** | 200-300 строк | 100-150 строк | **-40-50%** |
| **Конфигов MCP** | 2 файла | 1 файл + symlink | **-50%** |
| **Папок миграций** | 2 | 1 | **-50%** |
| **.DS_Store файлов** | 28 | 0 | **-100%** |
| **Knowledge Base файлов** | 0 | 3 | **+∞** |
| **API Reference** | 0 | Ozon + Yandex | **Новое** |
| **KB маркетплейсов** | 0 | WB + Ozon + Yandex | **Новое** |

---

### 🔗 Дополнительная информация

**Документация:**
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура v2.0.0
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) — руководство по миграции
- [README.md](README.md) — основная документация
- [CLAUDE.md](CLAUDE.md) — инструкции для Claude Code

**Коммиты:**
- `b7201af` — added skill llm docs
- `92357e6` — added wb settings
- `d06801b` — added wb mcp analytics
- `a8baf66` — added wb mcp
- `e7e6a02` — refactor: архитектура - Knowledge Base, DRY принцип
- `ec49271` — docs: обновить skills - добавить KB ссылки, синхронизировать README/CLAUDE
- `1226f52` — docs: добавить API reference для Ozon и Yandex Market, knowledge base

---

## [1.0.0] - 2025-12-28

### Initial Release

**Базовая функциональность:**
- 9 Skills для Wildberries
- 1 Skill для Ozon
- 1 Skill для Яндекс.Маркет
- 1 Skill для бухгалтерии маркетплейсов
- 9 Commands (slash-команды)
- 4 Agents (автономные задачи)
- MCP интеграция с wb-mcp
- Postgres база данных
- Dashboard (не изменялся в v2)

**Известные проблемы:**
- Размер репозитория 99GB (курсы в репозитории)
- Дублирование формул в 13+ местах
- Два файла .mcp.json (дублирование конфигурации)
- Миграции в двух папках
- 28 файлов .DS_Store

---

## Формат версий

Проект использует [семантическое версионирование](https://semver.org/lang/ru/):

- **MAJOR** (X.0.0) — несовместимые изменения API
- **MINOR** (x.X.0) — обратно совместимая новая функциональность
- **PATCH** (x.x.X) — обратно совместимые исправления

**Пример:**
- `1.0.0` → `1.1.0` — новая функциональность, обратная совместимость
- `1.1.0` → `2.0.0` — breaking changes (требуется миграция)

---

## Категории изменений

- **Added** — новая функциональность
- **Changed** — изменения в существующей функциональности
- **Deprecated** — функциональность, которая будет удалена
- **Removed** — удалённая функциональность
- **Fixed** — исправление ошибок
- **Security** — исправление уязвимостей

---

*Сгенерировано автоматически в рамках рефакторинга v2.0.0*
