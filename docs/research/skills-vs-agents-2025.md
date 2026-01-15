# Исследование: Skills vs Agents в AI — Тренд 2025

## Резюме

Проведено исследование текущего состояния дискуссии о соотношении Skills (навыков) и Agents (агентов) в экосистеме AI. Анализ показывает, что **Skills не заменяют агентов, а дополняют их**, создавая новый архитектурный паттерн для построения AI-систем.

---

## 1. Контекст: почему этот вопрос возник

### 1.1 "2025 — год AI-агентов"

Согласно исследованиям:

- **99% разработчиков** исследуют или разрабатывают AI-агентов (IBM/Morning Consult, 2025)
- **85% организаций** уже интегрировали агентов хотя бы в один workflow (Index.dev, 2025)
- **62% компаний** экспериментируют с агентами (McKinsey, 2025)
- Рынок AI-агентов: **$5.1B → $47.1B** к 2030 (CAGR 44.8%)

### 1.2 Почему возник тренд на Skills

С октября 2025 года Anthropic активно продвигает концепцию **Agent Skills** — модульные возможности, которые Claude загружает динамически. Это вызвало дискуссию: не заменяют ли Skills традиционных агентов?

---

## 2. Официальная позиция Anthropic

### 2.1 Что такое Skills по определению Anthropic

> "Skills extend Claude's capabilities by packaging your expertise into composable resources for Claude, transforming general-purpose agents into specialized agents."
> — Anthropic Engineering Blog

Skills — это:
- Папки с инструкциями, скриптами и ресурсами
- Загружаются динамически когда релевантны задаче
- Используют **progressive disclosure** (сначала метаданные ~100 токенов, потом полные инструкции)
- Могут содержать исполняемый код

### 2.2 Ключевое разграничение от Anthropic

| Компонент | Назначение | Аналогия |
|-----------|------------|----------|
| **Skills** | "Here's how to do things" | Учебник, мануал |
| **Projects** | "Here's what you need to know" | База знаний |
| **Subagents** | Независимые агенты для специализированных задач | Сотрудники |
| **MCP** | Подключение к внешним системам | API-коннекторы |
| **Prompts** | Одноразовые инструкции | Разговор |

### 2.3 Официальная рекомендация: использовать вместе

> "Skills are portable and reusable, while subagents are purpose-built for specific workflows. Use Skills to teach expertise that any agent can apply; use subagents when you need independent task execution with specific tool permissions and context isolation."
> — Claude.com/blog/skills-explained

---

## 3. Индустриальные перспективы

### 3.1 Эволюция подходов

```
2022-2023: Prompt Engineering
     ↓
2024: RAG + Function Calling
     ↓
2025: Agentic AI + Context Engineering
     ↓
2025+: Skills + Agents + Multi-Agent Systems
```

### 3.2 Context Engineering как новая дисциплина

Anthropic ввёл термин **Context Engineering** — стратегическое управление контекстом для агентов:

> "We're now seeing a shift in how engineers think about designing context for agents... from 'How do I ask this AI a question?' to 'How do I build systems that continuously supply agents with the right operational context?'"
> — Anthropic Engineering

### 3.3 Четыре архитектурных паттерна Agentic AI

1. **Reflection** — самопроверка и улучшение
2. **Tool Use** — использование внешних инструментов
3. **Planning** — декомпозиция задач
4. **Multi-Agent Collaboration** — командная работа агентов

Skills вписываются как **слой экспертизы**, который агенты используют для повышения качества.

---

## 4. Практические инсайты от разработчиков

### 4.1 Структура Daniel Miessler (автор ряда популярных AI-инструментов)

```
~/.claude/
├── skills/           # Доменные контейнеры
│   ├── blogging/
│   │   ├── SKILL.md
│   │   ├── workflows/    # Команды живут здесь
│   │   │   ├── write.md
│   │   │   └── publish.md
│   │   └── context/
│   └── research/
├── agents/           # Standalone агенты
│   ├── engineer.md
│   └── researcher.md
└── commands/         # Глобальные команды
```

**Ключевой инсайт:**
> "Agents aren't nested in skills—they're standalone entities that can EXECUTE skills and commands as parallel workers."

### 4.2 Практические рекомендации

| Используй Skills когда | Используй Agents когда |
|------------------------|------------------------|
| Нужны повторяемые процедуры | Нужна автономность |
| Экспертиза для любого контекста | Параллельное выполнение |
| Хочешь портативность | Специфичные permissions |
| Минимум кода | Сложные workflows |

### 4.3 Предупреждения

Исследование сетевого трафика Claude Code выявило:

> "Never use skills for anything sensitive. Direct code execution with no schema validation or access control is unacceptable in production environments."
> — Level Up Coding

Рекомендация: для production использовать **MCP-серверы** вместо Skills для интеграций.

---

## 5. Технические различия

### 5.1 Как загружаются Skills

```
Startup:
  System prompt includes: "PDF Processing - Extract text..."
  
User request: "Extract text from this PDF"

Claude invokes: bash: read pdf-skill/SKILL.md 
  → Instructions loaded into context

Claude determines: Form filling not needed
  → FORMS.md NOT read (saves tokens)

Claude executes: Uses SKILL.md to complete task
```

### 5.2 Как работают Agents

```
User request → Agent receives goal
     ↓
Agent plans: Decompose into subtasks
     ↓
Agent reasons: Select tools/actions (ReAct loop)
     ↓
Agent acts: Execute tools, observe results
     ↓
Agent reflects: Evaluate, adjust plan
     ↓
Agent returns: Final result to user
```

### 5.3 Архитектурное различие

| Аспект | Skills | Agents |
|--------|--------|--------|
| **Активация** | Model-invoked (Claude решает) | User/System-invoked |
| **Контекст** | Загружается в существующий | Собственный context window |
| **Состояние** | Stateless | Stateful (память) |
| **Действия** | Инструкции → модель действует | Автономное принятие решений |
| **Композиция** | Могут комбинироваться | Могут orchestrate друг друга |

---

## 6. Гибридная архитектура: Best Practices 2025

### 6.1 Рекомендуемый стек

```
┌─────────────────────────────────────────────────┐
│                 USER INTERFACE                  │
│         (Commands, Chat, Webhooks)              │
├─────────────────────────────────────────────────┤
│                   ORCHESTRATOR                  │
│        (Main Agent / Claude Code)               │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   SKILLS    │  │      SUB-AGENTS         │  │
│  │ (Expertise) │  │ (Specialized Workers)   │  │
│  │             │  │                         │  │
│  │ • WB API    │  │ • Analyst Agent         │  │
│  │ • Formulas  │  │ • Content Agent         │  │
│  │ • Templates │  │ • Review Agent          │  │
│  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────┤
│                  MCP SERVERS                    │
│     (External Tools & Data Connections)         │
│                                                 │
│  • wb-catalog   • wb-prices   • databases      │
│  • google-drive • slack       • custom APIs    │
├─────────────────────────────────────────────────┤
│                 MEMORY / STATE                  │
│     (SQLite, Vector DBs, File System)          │
└─────────────────────────────────────────────────┘
```

### 6.2 Когда что использовать

| Сценарий | Решение |
|----------|---------|
| "Как рассчитать маржу на WB?" | **Skill** (формулы, правила) |
| "Проанализируй все продажи за месяц" | **Agent** (планирует, делает API-calls) |
| "Получи данные из WB API" | **MCP Server** (connectivity) |
| "Ответь на этот отзыв" | **Skill** (шаблоны) + **Prompt** (контекст) |
| "Проведи полный аудит магазина" | **Multi-Agent** с Skills |

### 6.3 Ошибки, которых следует избегать

1. ❌ Использовать Skills для sensitive операций без валидации
2. ❌ Писать агента когда достаточно Skill
3. ❌ Игнорировать MCP для внешних интеграций
4. ❌ Дублировать логику между Skills и Agents
5. ❌ Не использовать progressive disclosure в больших Skills

---

## 7. Статистика и прогнозы

### 7.1 Текущее состояние (конец 2025)

| Метрика | Значение | Источник |
|---------|----------|----------|
| Компании, использующие AI agents | 85% (в ≥1 workflow) | Index.dev |
| Разработчики, исследующие agents | 99% | IBM |
| Компании, масштабирующие agents | 23% | McKinsey |
| ROI от agentic AI deployments | До 50% efficiency gain | A&M |
| Рынок AI-агентов (2025) | $7.38B | PragmaticCoders |
| Прогноз рынка (2032) | >$100B | Industry estimates |

### 7.2 Прогноз развития

**2025-2026:**
- Skills станут стандартом для domain expertise
- Multi-agent системы выйдут из экспериментов в production
- MCP станет де-факто стандартом для интеграций

**2027+:**
- Agent-as-a-Service платформы
- Self-improving агенты с reflection
- Стандартизированные skill marketplaces

---

## 8. Выводы и рекомендации

### 8.1 Главный вывод

> **Skills НЕ заменяют агентов. Они создают новый слой архитектуры — "экспертизу как код", которую агенты используют для повышения качества работы.**

### 8.2 Рекомендации для разработчиков

1. **Начни с Skills** — проще создать и поддерживать
2. **Добавляй Agents** — когда нужна автономность и multi-step workflows
3. **Используй MCP** — для всех внешних интеграций
4. **Комбинируй** — agents + skills + MCP = мощная система
5. **Думай о context** — context engineering важнее prompt engineering

### 8.3 Для твоего Marketplace Workspace

Рекомендуемая архитектура:

```
Skills (уже есть):
├── marketplace-expert/ — знания о WB API, формулы
├── review-responder/   — шаблоны ответов
└── [добавить по мере необходимости]

Agents (уже есть):
├── marketplace-analyst — глубокий анализ
├── content-optimizer   — оптимизация карточек
└── review-manager      — управление отзывами

MCP Servers (TODO):
├── wb-catalog, wb-prices, wb-stocks...
└── Реальные API интеграции

Commands (уже есть):
├── /digest, /sales, /stocks...
└── User interface для всего выше
```

---

## Источники

1. Anthropic. "Equipping agents for the real world with Agent Skills" (Engineering Blog, 2025)
2. Anthropic. "Skills explained: How Skills compares to prompts, Projects, MCP, and subagents" (Claude Blog, Nov 2025)
3. Anthropic. "Effective context engineering for AI agents" (Engineering Blog, 2025)
4. IBM. "AI Agents in 2025: Expectations vs. Reality" (Nov 2025)
5. McKinsey. "The state of AI in 2025: Agents, innovation, and transformation" (Nov 2025)
6. McKinsey. "Agents, robots, and us: Skill partnerships in the age of AI" (2025)
7. Daniel Miessler. "When to Use Claude Code Skills vs Commands vs Agents" (Dec 2025)
8. Pragmatic Coders. "200+ AI Agent statistics for 2025" (Dec 2025)
9. Alvarez & Marsal. "Demystifying AI Agents in 2025" (Aug 2025)
10. Various industry sources on agentic AI frameworks and patterns

---

*Исследование проведено: 25 декабря 2025*
*Для проекта: Marketplace Workspace*
