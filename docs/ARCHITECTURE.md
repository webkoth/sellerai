# Архитектура SellerAI

> Многоуровневая архитектура для управления продажами на маркетплейсах через Claude Code

---

## 🏗 Общая архитектура

SellerAI построен по принципу **многоуровневой архитектуры** с чёткими границами ответственности:

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                       │
│              (Natural language requests)                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                       Agents                            │
│        (Multi-step autonomous task execution)           │
│   marketplace-analyst, content-optimizer, etc.          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                      Commands                           │
│            (Actionable slash commands)                  │
│    /unit-economics, /funnel, /seo-audit, etc.           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                       Skills                            │
│         (Domain knowledge + interpretation)             │
│   wb-unit-economics, wb-advertising, ozon-basics        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Knowledge Base                        │
│          (Single source of truth for data)              │
│   formulas/wb-metrics.md, benchmarks/wb-benchmarks.md   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    MCP Servers                          │
│              (External data sources)                    │
│         wb-mcp, postgres, firecrawl, linear             │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Уровень 1: Knowledge Base (Единственный источник правды)

**Расположение:** `.claude/knowledge/`

**Назначение:** Централизованное хранилище формул, данных, бенчмарков.

**Структура:**
```
.claude/knowledge/
├── formulas/               # Формулы расчётов
│   ├── wb-metrics.md       # ROI, маржа, CTR, конверсия
│   └── wb-costs.md         # Комиссии, логистика, налоги
└── benchmarks/             # Нормы и эталоны
    └── wb-benchmarks.md    # Бенчмарки по 10 категориям
```

**Принципы:**
- ✅ **DRY (Don't Repeat Yourself)** — формулы в одном месте
- ✅ **SSOT (Single Source of Truth)** — всё идёт из Knowledge Base
- ✅ **Актуальность** — обновление в одном месте = обновление везде

**Примеры содержимого:**
- Формула маржинальности: `(Выручка - Расходы) / Выручка × 100%`
- Комиссии WB по категориям
- Бенчмарки CTR, CR, выкупаемости

**Когда добавлять:**
- Новая формула используется в 2+ местах
- Новый бенчмарк нужен для интерпретации метрик
- Данные меняются и требуют централизованного обновления

---

## 🎓 Уровень 2: Skills (Доменные знания + Контекст)

**Расположение:** `.claude/skills/`

**Назначение:** Экспертиза и контекст применения знаний из Knowledge Base.

**Структура:**
```
.claude/skills/
├── wb-unit-economics/      # Юнит-экономика WB
├── wb-advertising/         # Реклама WB
├── wb-sales-funnel/        # Воронка продаж WB
├── wb-seo-expert/          # SEO карточек WB
├── wb-pricing-strategy/    # Ценообразование WB
├── ozon-basics/            # Основы Ozon
└── yandex-market-basics/   # Основы Яндекс.Маркет
```

**Что содержат Skills:**
- 📌 **Ссылки на Knowledge Base** (не дублируют формулы!)
- 🎯 **Контекст применения** — когда использовать
- 🚨 **Типичные ошибки** — как НЕ надо делать
- 💡 **Интерпретация** — что означают результаты
- 🔧 **Специфика** — особенности маркетплейса/категории

**Что НЕ содержат Skills:**
- ❌ Формулы (они в Knowledge Base)
- ❌ Бенчмарки (они в Knowledge Base)
- ❌ Код (он в Commands/Agents)

**Пример структуры SKILL.md:**
```markdown
---
name: wb-unit-economics
description: Расчёт юнит-экономики на Wildberries
---

## 📚 Формулы и расходы

**Формулы:** `.claude/knowledge/formulas/wb-metrics.md`
**Расходы:** `.claude/knowledge/formulas/wb-costs.md`
**Бенчмарки:** `.claude/knowledge/benchmarks/wb-benchmarks.md`

## 🎯 Контекст применения

**Когда использовать:**
1. Оценка нового товара
2. Анализ текущих товаров
3. Принятие решений по акциям

## ❌ Типичные ошибки

### Ошибка 1: Не учитывают возвраты
**Проблема:** Считают выручку по заказам, а не по выкупам
**Последствия:** Завышение маржи на 5-15%
**Решение:** Использовать формулу `Выручка = Заказы × Выкупаемость × Цена`
```

**Триггеры активации:**
- Автоматически по контексту запроса
- Явно через упоминание имени skill

---

## ⚡ Уровень 3: Commands (Исполняемые команды)

**Расположение:** `.claude/commands/`

**Назначение:** Slash-команды для быстрого выполнения типовых задач.

**Структура:**
```
.claude/commands/
├── unit-economics.md       # /unit-economics [артикул]
├── funnel.md               # /funnel [артикул]
├── seo-audit.md            # /seo-audit [артикул]
├── ad-analysis.md          # /ad-analysis
├── abc-analysis.md         # /abc-analysis [период]
├── weekly-report.md        # /weekly-report
├── review-reply.md         # /review-reply [текст]
├── competitors.md          # /competitors [артикул]
└── price-check.md          # /price-check [артикул]
```

**Что делают Commands:**
- ✅ Используют Skills для получения экспертизы
- ✅ Вызывают MCP серверы для получения данных
- ✅ Применяют формулы из Knowledge Base
- ✅ Выводят структурированный результат

**Пример команды:**
```markdown
---
name: unit-economics
description: Расчёт юнит-экономики товара
args:
  - nmId: Артикул товара WB
---

1. Получить данные товара через wb-mcp
2. Использовать skill wb-unit-economics для интерпретации
3. Применить формулы из .claude/knowledge/formulas/wb-metrics.md
4. Вывести отчёт с рекомендациями
```

**Когда создавать:**
- Повторяющаяся задача с чёткими шагами
- Нужен быстрый доступ (один слэш-командой)
- Есть стандартный формат вывода

---

## 🤖 Уровень 4: Agents (Многошаговые автономные задачи)

**Расположение:** `.claude/agents/`

**Назначение:** Автономное выполнение сложных задач с принятием решений.

**Структура:**
```
.claude/agents/
├── marketplace-analyst.md   # Анализ продаж, аудит
├── content-optimizer.md     # Оптимизация карточек
├── review-manager.md        # Управление отзывами
└── ads-optimizer.md         # Оптимизация рекламы
```

**Что делают Agents:**
- 🔍 Исследуют проблему
- 🧠 Принимают решения на основе данных
- 🔄 Итеративно улучшают результат
- 📊 Используют Skills + Commands + MCP

**Когда использовать Agents:**
- Задача требует нескольких шагов исследования
- Нужны промежуточные решения
- Непонятен конечный результат заранее

**Пример Agent workflow:**
```
User: "Найди проблемные товары"
  ↓
marketplace-analyst:
  1. Получить все товары (wb-mcp)
  2. Рассчитать юнит-экономику (wb-unit-economics skill)
  3. Анализировать воронку (wb-sales-funnel skill)
  4. Выявить узкие места
  5. Приоритизировать проблемы
  6. Дать рекомендации
```

---

## 🔗 Уровень 5: MCP Servers (Внешние данные)

**Расположение:** `.claude/.mcp.json`

**Назначение:** Подключение к API и сервисам через Model Context Protocol.

**Активные серверы:**
```
wb-mcp          → Wildberries API (товары, цены, заказы)
postgres        → Локальная база данных
firecrawl       → Парсинг веб-страниц
linear          → Управление задачами
playwright      → Автоматизация браузера
```

**Конфигурация:**
```json
{
  "mcpServers": {
    "wb-mcp": {
      "command": "node",
      "args": ["/path/to/wb-mcp/build/index.js"],
      "env": {
        "WB_API_TOKEN": "env:WB_API_TOKEN"
      }
    }
  }
}
```

**Когда добавлять MCP:**
- Интеграция с новым API
- Нужен доступ к внешним данным
- Сервис предоставляет MCP-интерфейс

---

## 🔄 Data Flow (Поток данных)

### Пример: Расчёт юнит-экономики товара

```
1. User: "/unit-economics 123456"
      ↓
2. Command unit-economics.md:
   - Парсит аргументы (nmId: 123456)
   - Вызывает MCP server wb-mcp
      ↓
3. MCP wb-mcp:
   - GET /api/v1/prices (цены)
   - GET /api/v1/cards (карточка)
   - Возвращает JSON
      ↓
4. Command:
   - Активирует skill wb-unit-economics
      ↓
5. Skill wb-unit-economics:
   - Ссылается на .claude/knowledge/formulas/wb-metrics.md
   - Ссылается на .claude/knowledge/formulas/wb-costs.md
   - Применяет контекст и интерпретацию
      ↓
6. Knowledge Base:
   - Формула маржинальности: (Выручка - Расходы) / Выручка
   - Комиссия WB для категории "Одежда": 20%
   - Бенчмарк маржи для одежды: 25-40%
      ↓
7. Command:
   - Выполняет расчёты
   - Сравнивает с бенчмарками
   - Формирует отчёт
      ↓
8. User: получает структурированный отчёт
```

---

## 📐 Принципы проектирования

### 1. DRY (Don't Repeat Yourself)

**Правило:** Каждая формула, бенчмарк, правило — в одном месте.

**✅ Правильно:**
```markdown
# .claude/knowledge/formulas/wb-metrics.md
Маржинальность = (Выручка - Расходы) / Выручка × 100%

# .claude/skills/wb-unit-economics/SKILL.md
**Формула:** См. `.claude/knowledge/formulas/wb-metrics.md#маржинальность`
```

**❌ Неправильно:**
```markdown
# .claude/skills/wb-unit-economics/SKILL.md
Маржинальность = (Выручка - Расходы) / Выручка × 100%

# .claude/skills/wb-advertising/SKILL.md
Маржинальность = (Выручка - Расходы) / Выручка × 100%
```

### 2. SSOT (Single Source of Truth)

**Правило:** Knowledge Base — единственный источник формул и данных.

**Иерархия:**
```
Knowledge Base (SSOT)
    ↓ используется
Skills (интерпретация)
    ↓ используется
Commands (выполнение)
    ↓ используется
Agents (многошаговые задачи)
```

### 3. Separation of Concerns (Разделение ответственности)

**Уровни:**
- **Knowledge Base** — только данные и формулы
- **Skills** — только контекст и экспертиза
- **Commands** — только выполнение конкретных задач
- **Agents** — только автономные многошаговые процессы

### 4. Explicit is Better Than Implicit

**Правило:** Skills явно ссылаются на Knowledge Base, не подразумевают.

**✅ Правильно:**
```markdown
**Формула маржинальности:** См. `.claude/knowledge/formulas/wb-metrics.md#маржинальность`
**Бенчмарки по категориям:** См. `.claude/knowledge/benchmarks/wb-benchmarks.md`
```

**❌ Неправильно:**
```markdown
Используем стандартную формулу маржинальности.
```

---

## 🔧 Правила расширения

### Добавление нового маркетплейса

**Шаги:**

1. **Knowledge Base** — создать файлы:
   ```
   .claude/knowledge/formulas/{marketplace}-metrics.md
   .claude/knowledge/formulas/{marketplace}-costs.md
   .claude/knowledge/benchmarks/{marketplace}-benchmarks.md
   ```

2. **Skills** — создать базовый skill:
   ```
   .claude/skills/{marketplace}-basics/SKILL.md
   ```

3. **MCP Server** (если есть API):
   ```
   .claude/.mcp.json + mcp/{marketplace}-mcp/
   ```

4. **Commands** — адаптировать существующие или создать новые

5. **Documentation** — обновить README.md, CLAUDE.md

### Добавление новой формулы

**Шаги:**

1. **Добавить в Knowledge Base:**
   ```markdown
   # .claude/knowledge/formulas/wb-metrics.md

   ### Новая метрика
   **Формула:** ...
   **Применение:** ...
   **Бенчмарки:** ...
   ```

2. **Обновить Skills** — добавить ссылку и контекст:
   ```markdown
   **Формула:** См. `.claude/knowledge/formulas/wb-metrics.md#новая-метрика`

   **Когда использовать:**
   - ...
   ```

3. **Обновить Commands** — если нужно

### Добавление нового Skill

**Шаблон SKILL.md:**
```markdown
---
name: {skill-name}
description: {1-2 предложения}
---

# {Skill Title}

## 📚 Формулы и расходы

**Формулы:** `.claude/knowledge/formulas/{file}.md`
**Бенчмарки:** `.claude/knowledge/benchmarks/{file}.md`

## 🎯 Контекст применения

**Когда использовать:**
1. Сценарий 1
2. Сценарий 2

## ❌ Типичные ошибки

### Ошибка 1: Описание
**Проблема:** ...
**Последствия:** ...
**Решение:** ...

## 📊 Интерпретация результатов

| Диапазон | Интерпретация | Действия |
|----------|---------------|----------|
| ...      | ...           | ...      |

## Источники

- Курс "..." — Модуль X, Урок Y
```

### Добавление нового Command

**Шаблон:**
```markdown
---
name: {command-name}
description: {краткое описание}
args:
  - argName: Описание аргумента
---

# Алгоритм:

1. Получить данные через MCP
2. Активировать нужные Skills
3. Применить формулы из Knowledge Base
4. Вывести отчёт
```

### Добавление нового Agent

**Шаблон:**
```markdown
---
name: {agent-name}
description: {описание автономной задачи}
tools:
  - wb-mcp
  - Read
  - Grep
color: blue
---

# {Agent Title}

## Цель агента

{Какую проблему решает}

## Workflow

1. Шаг исследования
2. Анализ данных
3. Принятие решений
4. Действия
5. Рекомендации

## Используемые Skills

- {skill-1}
- {skill-2}
```

---

## 🚀 Миграция на новую архитектуру

**См. MIGRATION_GUIDE.md** для пошаговой инструкции.

**Основные изменения:**
- Skills теперь ссылаются на Knowledge Base (не дублируют формулы)
- Centralized benchmarks для всех категорий
- Unified data flow через MCP

---

## 📊 Метрики архитектуры

| Метрика | v1.0.0 | v2.0.0 | Улучшение |
|---------|--------|--------|-----------|
| Дублирование формул | 13+ мест | 1 место | -92% |
| Средний размер Skill | 200-300 строк | 100-150 строк | -40-50% |
| Количество Knowledge Base файлов | 0 | 3 | +∞ |
| Количество бенчмарков | Разбросаны | 10 категорий | Консолидация |

---

## 🔗 См. также

- [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) — Миграция с v1 на v2
- [CHANGELOG.md](../CHANGELOG.md) — История изменений
- [README.md](../README.md) — Основная документация
- [CLAUDE.md](../CLAUDE.md) — Инструкции для Claude Code
