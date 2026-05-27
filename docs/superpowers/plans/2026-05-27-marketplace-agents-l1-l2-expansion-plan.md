# Phase 1 Implementation Plan — L1/L2 Marketplace Agents Expansion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать Phase 1 из spec `2026-05-27-marketplace-agents-l1-l2-expansion-design.md` — добавить L1-агента `operations-director`, L2-агента `external-traffic-manager`, 3 полноценных skill, 2 skill-stub, 2 команды и обновить CLAUDE.md.

**Architecture:** Двухуровневая иерархия агентов (L1 оркестратор → L2 специалисты). L1 делегирует через `Agent` tool, не работает с MCP напрямую. L2 (`external-traffic-manager`) использует существующих L2 через Agent tool для запроса юнит-экономики.

**Tech Stack:** Markdown (агенты, skills, команды), JSONL (база блогеров), Bash (валидация YAML frontmatter), git.

---

## File Structure

```
sai_kotelnikovartifact/
├── .claude/
│   ├── agents/
│   │   ├── operations-director.md           # NEW (Task 7)
│   │   └── external-traffic-manager.md      # NEW (Task 8)
│   ├── skills/
│   │   ├── marketplace-operations-director/SKILL.md  # NEW (Task 2)
│   │   ├── external-traffic-economics/SKILL.md       # NEW (Task 3)
│   │   ├── blogger-vetting-checklist/SKILL.md        # NEW (Task 4)
│   │   ├── infographic-design-system/SKILL.md        # NEW stub (Task 5)
│   │   └── ai-visual-generation/SKILL.md             # NEW stub (Task 6)
│   └── commands/
│       ├── audit.md                         # NEW (Task 9)
│       └── external-deal.md                 # NEW (Task 10)
├── data/
│   ├── audits/.gitkeep                      # NEW (Task 1)
│   └── external-traffic/
│       ├── deals/.gitkeep                   # NEW (Task 1)
│       └── bloggers.jsonl                   # NEW empty (Task 1)
└── CLAUDE.md                                # MODIFIED (Task 11)
```

**Файл `data/audits/smoke-results.md` создаётся в Task 12 после прогона тестов.**

---

## Принципы валидации (адаптация TDD для markdown-конфигов)

Поскольку артефакты — это markdown с YAML frontmatter, а не код:
- **"Failing test"** = проверка, что файл ещё НЕ существует / структура невалидна
- **"Pass"** = файл создан, frontmatter парсится, обязательные поля присутствуют
- **Реальная функциональная валидация** = smoke-сценарии (Task 12), которые прогоняются после создания всех артефактов

Команды валидации:
```bash
# Проверка YAML frontmatter
python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]).read().split('---')[1])" <FILE>

# Проверка обязательных полей агента
grep -E '^(name|description|tools):' <FILE>
```

---

## Task 1: Создать data/ структуру

**Files:**
- Create: `data/audits/.gitkeep`
- Create: `data/external-traffic/deals/.gitkeep`
- Create: `data/external-traffic/bloggers.jsonl` (пустой)

- [ ] **Step 1: Проверить, что директории ещё не существуют**

```bash
ls /Users/minas/projects/sai_kotelnikovartifact/data/audits 2>&1 || echo "OK: audits not exists"
ls /Users/minas/projects/sai_kotelnikovartifact/data/external-traffic 2>&1 || echo "OK: external-traffic not exists"
```
Expected: оба пути отсутствуют, выводят "OK: ... not exists" (или соответствующее сообщение об отсутствии). Если что-то существует — переход к шагу 2 без переделки.

- [ ] **Step 2: Создать директории и пустые файлы**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
mkdir -p data/audits data/external-traffic/deals
touch data/audits/.gitkeep data/external-traffic/deals/.gitkeep data/external-traffic/bloggers.jsonl
```

- [ ] **Step 3: Проверить, что файлы созданы**

```bash
ls -la data/audits/.gitkeep data/external-traffic/deals/.gitkeep data/external-traffic/bloggers.jsonl
```
Expected: три файла существуют, размер `bloggers.jsonl` = 0 байт.

- [ ] **Step 4: Закоммитить**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add data/audits/.gitkeep data/external-traffic/deals/.gitkeep data/external-traffic/bloggers.jsonl
git commit -m "$(cat <<'EOF'
chore: Initialize data/ structure for audits and external traffic

Adds empty placeholders for audit reports and blogger deal records.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Skill `marketplace-operations-director`

**Files:**
- Create: `.claude/skills/marketplace-operations-director/SKILL.md`

- [ ] **Step 1: Проверить, что директория skill ещё не существует**

```bash
ls /Users/minas/projects/sai_kotelnikovartifact/.claude/skills/marketplace-operations-director 2>&1 | head -3
```
Expected: "No such file or directory".

- [ ] **Step 2: Создать директорию и файл SKILL.md с полным содержимым**

```bash
mkdir -p /Users/minas/projects/sai_kotelnikovartifact/.claude/skills/marketplace-operations-director
```

Записать в `.claude/skills/marketplace-operations-director/SKILL.md`:

````markdown
---
name: marketplace-operations-director
description: Методология стратегического управления магазином МП. Используйте для приоритизации проблем по ICE-МП, разрешения конфликтов между направлениями (ставка vs маржа, скидка vs прибыль), формирования стратегических отчётов и 30-60-90 планов. Применяется агентом operations-director и оператором напрямую.
context: fork
---

# Marketplace Operations Director — методология стратегического управления

Доменная база знаний для L1-агента `operations-director` и операторов SellerAI.

---

## 1. Фреймворк приоритизации ICE-МП

Каждой проблеме / возможности присваивается тройка оценок:

| Параметр | Шкала | Что измеряет |
|----------|-------|--------------|
| **Impact** | ₽/мес эффекта | Денежная отдача от устранения / реализации |
| **Confidence** | 0.0 – 1.0 | Вероятность, что эффект будет достигнут |
| **Ease** | 1 – 5 | 1 = недели работы / нужны подрядчики, 5 = можно сделать за день силами оператора |

**Score = Impact × Confidence × Ease**

Сортировка по убыванию Score → топ-3 идут в раздел 🔴 Критично, следующие 5 — в 🟡 Точки роста.

---

## 2. Шаблон стратегического отчёта

```markdown
# Стратегический аудит: [Магазин], [Дата]

## ⚡ TL;DR
- Главная проблема: [одна фраза]
- Главная возможность: [одна фраза]
- Эффект от рекомендаций: +X₽/мес при затратах Y₽

## 🔴 Критично (7 дней)
| # | Проблема | Источник | Эффект | Действие | Ответственный L2 |

## 🟡 Точки роста (4 недели)
| # | Возможность | ICE-Score | Действие |

## 📊 KPI-дашборд
| Метрика | Текущее | Бенчмарк | Дельта |
| Выручка/мес | … | … | … |
| ДРР | … | … | … |
| Рейтинг | … | … | … |
| Скорость продаж | … | … | … |

## 🗺️ План 30/60/90
Неделя 1-2: …
Неделя 3-4: …
Месяц 2: …
Месяц 3: …

## ⚠️ Конфликты направлений
[если есть]
```

---

## 3. Разрешение конфликтов между направлениями

### Конфликт 1: «Повысить ставку рекламы» vs «Маржа уже на нуле»

**Правило:** ставка не должна превышать `ДРР_лимит × средний_чек / клики_на_заказ`.

- `ДРР_лимит` = маржа − минимальная прибыль за заказ (обычно 5%)
- Пример: средний чек 1500₽, маржа 25% = 375₽, минимум 5% = 75₽ → ДРР_лимит = 300/1500 = 20%
- Если кликов на заказ 30, max ставка = 0.20 × 1500 / 30 = 10₽

**Решение:** если ads-optimizer хочет ставку выше расчётной — отказать, потребовать сначала снизить кликов_на_заказ (CR карточки) или повысить средний чек.

### Конфликт 2: «Снизить цену для акции» vs «Потеря прибыли»

**Правило:** до участия в акции считаем юнит-экономику до и после скидки и СПП.

```
Прибыль_до = (Цена − Себестоимость − Логистика − Комиссия − Реклама)
Прибыль_после = (Цена_акция × (1 − СПП%) − Себестоимость − Логистика − Комиссия − Реклама_акция)
Эффект = Прибыль_после × Заказы_после − Прибыль_до × Заказы_до
```

**Решение:** участвовать в акции, если ожидаемый рост заказов покрывает падение маржи (обычно × 1.5–2.5 от текущих заказов).

### Конфликт 3: «Большая поставка для безопасности» vs «Оборачиваемость > 60 дней»

**Правило безопасного остатка:**
```
Остаток = Средняя_скорость_продаж × (Срок_поставки + Буфер_дней)
```
- `Срок_поставки` = от заказа до на складе WB/Ozon
- `Буфер_дней` = 14 для стабильных, 30 для сезонных, 7 для быстрых

**Решение:** если supply-chain хочет больше — отказать, поставка должна укладываться в формулу, остальное замораживается в обороте.

---

## 4. Чек-лист комплексного аудита

### Что собрать у каждого L2

| L2 | Запрос | Период |
|----|--------|--------|
| `ads-optimizer` | ROI по кампаниям, топ-5 убыточных, ДРР по типам рекламы | 30 дней |
| `content-optimizer` | SEO-аудит топ-10 SKU, спамность, релевантность | текущее состояние |
| `marketplace-analyst` | Выручка/маржа/выкупаемость, ABC, ТОП и хвост ассортимента | 30 / 90 дней |
| `review-manager` | Свежие негативные отзывы, тренд рейтинга, темы жалоб | 30 дней |

### Что нужно от клиента

- Себестоимость по SKU (если нет — берём оценочную из MPStats)
- Цели на квартал (выручка / маржа / новые SKU)
- Ограничения (бюджет на закуп, на рекламу)
- Контекст (ниша, бренд, сезонность)

### Что сгенерировать

- Полный отчёт (формат выше) в `data/audits/YYYY-MM-DD-[target].md`
- Краткая выжимка для оператора (TL;DR + топ-3 действия)

---

## 5. Примеры кейсов (из резюме кандидатов)

### Кейс А: Запуск ремней «под ключ» (Стас)

- Подбор товара в категории
- Поиск поставщика 1688 → карго → ЧЗ
- SEO-карточка + инфографика
- Запуск с минимальным бюджетом рекламы
- Результат за 3 месяца

### Кейс Б: Geo Home — 20 → 80 SKU, 58 → 260 млн оборота (Андрей)

- Декомпозиция роста: +60 SKU × средний оборот / SKU
- Внутренняя реклама без внешнего трафика
- Командная структура (опер.дир + менеджеры)

### Кейс В: Подарочные наборы → ТОП5 на Озон, 3 млн/мес (Павел)

- Узкая категория с низкой конкуренцией
- Грамотная настройка внутренней рекламы
- Снижение ДРР с 22% до 9%

---

## 6. Команды для оператора

- `/audit [target] [period]` — запустить аудит через operations-director
- Вызов `operations-director` напрямую — для нестандартных стратегических задач

````

- [ ] **Step 3: Валидация frontmatter**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
with open('.claude/skills/marketplace-operations-director/SKILL.md') as f:
    content = f.read()
parts = content.split('---')
meta = yaml.safe_load(parts[1])
assert meta['name'] == 'marketplace-operations-director', f'name mismatch: {meta}'
assert 'description' in meta and len(meta['description']) > 50
print('OK:', meta['name'])
"
```
Expected: `OK: marketplace-operations-director`.

- [ ] **Step 4: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/skills/marketplace-operations-director/SKILL.md
git commit -m "$(cat <<'EOF'
feat(skills): Add marketplace-operations-director skill

Provides ICE-МП prioritization framework, strategic report template,
conflict resolution rules (bid vs margin, discount vs profit, supply vs
turnover), and case examples from candidate resumes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Skill `external-traffic-economics`

**Files:**
- Create: `.claude/skills/external-traffic-economics/SKILL.md`

- [ ] **Step 1: Создать директорию и SKILL.md**

```bash
mkdir -p /Users/minas/projects/sai_kotelnikovartifact/.claude/skills/external-traffic-economics
```

Записать в `.claude/skills/external-traffic-economics/SKILL.md`:

````markdown
---
name: external-traffic-economics
description: Юнит-экономика внешнего трафика на маркетплейсах. Используйте для оценки коммерческих предложений от блогеров, расчёта CPV / CPO / безубыточности интеграции, сравнения внешней и внутренней рекламы по эффективности. Включает бенчмарки по нишам и шаблоны ТЗ на интеграцию.
context: fork
---

# External Traffic Economics — экономика внешнего трафика

База знаний для агента `external-traffic-manager` и оператора.

---

## 1. Формулы

### Базовые

```
CPV (Cost per View) = Цена_интеграции / Заявленный_охват     # норма 0.5–2 ₽
CTR_внешки         = Клики / Охват                            # бенчмарк 0.5–1.5%
CR_внешки          = CR_внутр × 0.5                           # холодный трафик
CPO_внешки         = Цена_интеграции / Ожидаемые_заказы
Безубыточность     = Цена_интеграции / Маржа_с_заказа         # сколько заказов окупают КП
```

### Прогноз заказов

```
Ожидаемые_клики   = Охват × CTR_внешки
Ожидаемые_заказы  = Ожидаемые_клики × CR_внешки
Доход_от_заказов  = Ожидаемые_заказы × Маржа_с_заказа
ROI_интеграции    = (Доход − Цена_интеграции) / Цена_интеграции × 100%
```

---

## 2. Бенчмарки по нишам

| Ниша | CTR_внешки | CR_внешки (от внутр.) | Средний охват блогера |
|------|------------|----------------------|------------------------|
| Одежда | 0.8–1.5% | × 0.4 | 30–100k |
| Товары для дома | 0.5–1.2% | × 0.5 | 20–80k |
| Косметика | 1.0–2.0% | × 0.4 | 50–200k |
| Электроника | 0.4–1.0% | × 0.6 | 20–60k |
| Товары +18 | 0.5–1.5% | × 0.3 | специфические каналы |
| Детские | 0.7–1.4% | × 0.5 | 30–100k |

CR_внешки указан как множитель к CR внутренней рекламы того же товара.

---

## 3. Пороги вердикта

| Соотношение CPO_внешки / CPO_внутр | Вердикт |
|------------------------------------|---------|
| < 1.0 | 🟢 БРАТЬ безусловно |
| 1.0–1.3 | 🟢 БРАТЬ (с учётом узнаваемости бренда) |
| 1.3–2.0 | 🟡 ПЕРЕГОВОРЫ — снижение цены / расширение пакета |
| > 2.0 | 🔴 ОТКАЗАТЬ |

### Исключения

- **Новый бренд + охват >100k ЦА:** допустимо CPO_внешки до × 3 от внутреннего ради brand awareness — но не более 1 интеграции в месяц.
- **Уникальный авторитетный блогер ниши:** допустимо × 1.5 от обычного порога.

---

## 4. Шаблоны

### Шаблон ТЗ на Reels-интеграцию

```markdown
# ТЗ на интеграцию: [товар], [блогер]

## Цель
Привлечь N заказов с CPO ≤ X ₽ за период Y.

## Сценарий (60 сек)
1. Проблема (0–10 сек): [конкретная боль ЦА]
2. Знакомство с товаром (10–25 сек): крупный план + 2 главных преимущества
3. Демонстрация (25–45 сек): как работает / выглядит на пользователе
4. CTA (45–60 сек): «ищите [ключ] на Wildberries / Ozon», артикул в описании

## Обязательные акценты
- [преимущество 1]
- [преимущество 2]
- [преимущество 3]

## Ключевой запрос для выкупа
"[точный запрос]" — блогер должен выкупить товар именно по этому запросу для подъёма карточки в поиске.

## Шаблон отзыва после доставки
3–5 строк: [пример с акцентом на ключевые слова]

## Что нельзя
- Сравнения с конкурентами по бренду
- Обещания «лечебного эффекта» / гарантий
- Скидочные промокоды без согласования
```

### Шаблон скрипта Stories (3 кадра)

```
Кадр 1 (5 сек): Проблема — короткий текст + эмодзи
Кадр 2 (5 сек): Решение — товар крупным планом + цена/преимущество
Кадр 3 (5 сек): CTA — «свайп вверх» / артикул / название карточки
```

### Шаблон контрпредложения

```markdown
# Контрпредложение к КП от [блогер]

Спасибо за предложение. Готовы к интеграции при следующих условиях:

1. **Цена:** [X₽] вместо предложенных [Y₽].
   Обоснование: рассчитанный CPO_внешки = [Z₽], целевой ≤ [W₽] исходя из юнит-эк товара.
2. **Гарантии:** при охвате ниже [N] просмотров за 48 часов — повторная публикация / частичный возврат.
3. **Дополнительно:** включить в пакет выкуп товара по ключевому запросу «[ключ]» и публикация отзыва после доставки (шаблон высылаем).
4. **Сроки:** публикация в течение [N] дней после получения товара.

Готовы оплатить N% предоплаты, остаток после публикации.
```

---

## 5. Красные флаги в КП

| Флаг | Почему опасно | Реакция |
|------|---------------|---------|
| «Гарантирую N просмотров» без статистики канала | Невозможно проверить, обычно завышено | Запросить TGStat / Telemetr скриншот |
| Только бартер, отказ от обсуждения метрик | Блогер не верит в результат / накрутка | 🔴 отказать |
| Нет публичной статистики канала | Скорее всего накрутка | 🔴 отказать |
| Цена > 2× медианы по нише за охват | Завышенная цена | 🟡 переговоры |
| Жёсткие требования (только наш сценарий, без правок) | Низкая вовлечённость → плохой результат | 🟡 переговоры с правками |
| Запрос предоплаты 100% без гарантий | Высокий риск кидка | 🔴 отказать |
| Прошлые интеграции с конкурентом | Аудитория уже видела похожий товар → CR ниже | 🟡 переговоры по цене |

---

## 6. Связь с другими skills

- `wb-advertising` — бенчмарки CPO внутренней рекламы для сравнения
- `wb-unit-economics` — расчёт маржи и точки безубыточности
- `blogger-vetting-checklist` — детальная проверка качества канала блогера

````

- [ ] **Step 2: Валидация frontmatter**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
with open('.claude/skills/external-traffic-economics/SKILL.md') as f:
    meta = yaml.safe_load(f.read().split('---')[1])
assert meta['name'] == 'external-traffic-economics'
print('OK:', meta['name'])
"
```
Expected: `OK: external-traffic-economics`.

- [ ] **Step 3: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/skills/external-traffic-economics/SKILL.md
git commit -m "$(cat <<'EOF'
feat(skills): Add external-traffic-economics skill

CPV/CPO/breakeven formulas, niche benchmarks, verdict thresholds
(1.0/1.3/2.0 × internal CPO), integration brief templates and red flags
checklist for blogger collaboration proposals.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Skill `blogger-vetting-checklist`

**Files:**
- Create: `.claude/skills/blogger-vetting-checklist/SKILL.md`

- [ ] **Step 1: Создать директорию и SKILL.md**

```bash
mkdir -p /Users/minas/projects/sai_kotelnikovartifact/.claude/skills/blogger-vetting-checklist
```

Записать в `.claude/skills/blogger-vetting-checklist/SKILL.md`:

````markdown
---
name: blogger-vetting-checklist
description: Проверка блогеров на накрутку и качество аудитории. Используйте для оценки Telegram-каналов и Instagram-аккаунтов перед заказом интеграции — анализ ER, динамики подписчиков, релевантности комментариев. Содержит быструю проверку (5 минут) и глубокую (30 минут), критерии отказа.
context: fork
---

# Blogger Vetting Checklist — проверка блогера на накрутку

Чек-лист для оценки качества аудитории блогера перед закупкой рекламы.

---

## 1. Быстрая проверка (5 минут)

| # | Что проверяем | Где | Норма | Красная зона |
|---|---------------|-----|-------|--------------|
| 1 | Динамика подписчиков за 30 дней | TGStat / Telemetr | органический рост или плато | скачки +20% и более без видимой причины |
| 2 | Engagement Rate (ER) | TGStat | 3–8% | <1% при >10k подписчиков |
| 3 | Разброс просмотров последних 10 постов | публичный канал | отклонение <50% от медианы | один пост в 5× больше остальных = накрутка просмотров |
| 4 | Релевантность комментариев | публичный канал | осмысленные, в тему | только эмодзи / похвала без сути |

### Инструменты

- **TGStat (бесплатно):** https://tgstat.ru — ER, подписчики, прирост
- **Telemetr.me:** аналогично TGStat, иногда покрывает каналы лучше
- **WebFetch публичной страницы канала:** для свежих метрик

---

## 2. Глубокая проверка (30 минут)

Когда требуется: КП > 10 000 ₽ или сомнения после быстрой проверки.

### Шаг 1: Запрос статистики у блогера

Запросить скриншоты:
- Статистика канала за последние 30 дней (TGStat / Telemetr)
- Охваты последних 5 публикаций
- География аудитории (если есть)
- Прошлые рекламные интеграции (любые публичные)

### Шаг 2: Перекрёстная проверка

| Что проверяем | Метод |
|---------------|-------|
| Скриншоты подлинные | Сверить даты, форматы UI с актуальной версией TGStat |
| Охваты в скринах = реальные | Зайти на канал, посмотреть последние 5 постов вручную |
| География релевантна нише | РФ-аудитория для русскоязычных товаров — норма >80% |
| Прошлые интеграции конвертили | Поискать в WB / Ozon товары, продвигавшиеся блогером, по визуалу |

### Шаг 3: Проверка на чаты активности

Признаки участия в чатах накрутки (Adminbot, ACTIV, ROYAL):
- Одинаковые наборы реакций под каждым постом
- Комментарии-копии у разных авторов
- Резкий приток просмотров в первые 30 минут после публикации

---

## 3. Критерии отказа (автоматический 🔴)

| Признак | Объяснение |
|---------|-----------|
| ER < 1% при подписчиках > 10k | Аудитория мёртвая / накручена |
| Скачок подписчиков > +50% за 30 дней без новости | Покупка подписчиков |
| Доля подписчиков без аватарок > 30% | Боты |
| Комментарии — преимущественно эмодзи / односложные | Чаты активности |
| Нет публичной статистики канала вообще | Невозможно оценить, риск слишком высокий |
| Отказ показать скриншоты статистики | То же |

---

## 4. Алгоритм проверки в виде кода

```python
# Псевдокод для агента external-traffic-manager
def vet_blogger(channel_url, audience_claimed):
    # Быстрая проверка (5 минут)
    er = fetch_er(channel_url)              # через TGStat / WebFetch
    growth_30d = fetch_growth(channel_url)
    views_variance = fetch_views_variance(channel_url, last_n=10)
    comments_quality = assess_comments(channel_url)

    red_flags = []
    if er < 0.01 and audience_claimed > 10000:
        red_flags.append("ER < 1% at >10k subscribers")
    if growth_30d > 0.5:
        red_flags.append(f"Subscriber growth {growth_30d*100:.0f}% in 30d")
    if views_variance > 0.5:
        red_flags.append("Views variance >50% — possible boosted posts")
    if comments_quality == "low":
        red_flags.append("Low-quality comments (emoji-only)")

    if red_flags:
        return {"verdict": "REJECT", "reasons": red_flags}

    return {"verdict": "PASS_QUICK", "details": {...}}
```

---

## 5. Шаблон вывода для отчёта

```markdown
## Проверка блогера: [канал/ник]

### Быстрая проверка
- 📊 ER: X% (норма 3–8%) — 🟢/🟡/🔴
- 📈 Динамика подписчиков 30d: +X% — 🟢/🟡/🔴
- 👀 Разброс просмотров: X% (норма <50%) — 🟢/🟡/🔴
- 💬 Качество комментариев: высокое / среднее / низкое — 🟢/🟡/🔴

### Красные флаги
- [если есть, перечислить]

### Итог
- 🟢 ПРОЙДЕНА — можно запрашивать КП
- 🟡 СОМНЕНИЯ — запросить дополнительную статистику
- 🔴 НЕ ПРОЙДЕНА — отказать
```

````

- [ ] **Step 2: Валидация**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
meta = yaml.safe_load(open('.claude/skills/blogger-vetting-checklist/SKILL.md').read().split('---')[1])
assert meta['name'] == 'blogger-vetting-checklist'
print('OK:', meta['name'])
"
```
Expected: `OK: blogger-vetting-checklist`.

- [ ] **Step 3: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/skills/blogger-vetting-checklist/SKILL.md
git commit -m "$(cat <<'EOF'
feat(skills): Add blogger-vetting-checklist skill

Quick (5min) and deep (30min) blogger audit procedures with ER, growth
and engagement metrics, rejection criteria, tool list (TGStat/Telemetr)
and report templates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Skill-stub `infographic-design-system` (Phase 2)

**Files:**
- Create: `.claude/skills/infographic-design-system/SKILL.md`

- [ ] **Step 1: Создать stub-skill**

```bash
mkdir -p /Users/minas/projects/sai_kotelnikovartifact/.claude/skills/infographic-design-system
```

Записать в `.claude/skills/infographic-design-system/SKILL.md`:

````markdown
---
name: infographic-design-system
description: (Phase 2 — STUB) Система дизайна инфографики для карточек маркетплейсов. После полной реализации будет использоваться для аудита карточек, написания ТЗ дизайнеру, построения воронки слайдов и подбора цветовой палитры по нише.
context: fork
---

# Infographic Design System — STUB (Phase 2)

⚠️ **Это заготовка для Phase 2.** Полное содержимое будет создано вместе с агентом `infographic-designer`.

## Запланированные разделы

### 1. Воронка по слайдам (главное → выгоды → доверие → CTA)

5–8 слайдов по схеме:
1. Главный (товар + ключевое преимущество)
2. Боль / проблема ЦА
3. Выгода 1
4. Выгода 2
5. Социальное доказательство (рейтинг / отзывы)
6. Сравнение / характеристики
7. Использование / lifestyle
8. CTA (артикул, гарантии)

### 2. Цветовые правила по нишам

- Косметика — пастель, нейтральные
- Спорт — контраст, динамика
- Детские — яркие, мягкие
- Электроника — тёмный фон, акцентный цвет
- Дом — естественные тона
- (полная таблица — Phase 2)

### 3. Шаблоны ТЗ для дизайнера

- Цели карточки
- Брендбук
- Ключевые акценты по слайдам
- Запреты (что НЕ показывать)
- Формат сдачи

### 4. Аудит существующих карточек

Чек-лист:
- Читаемость на превью (250×400 px)
- Контраст текста
- Иерархия акцентов
- Соответствие воронке
- Уникальность относительно конкурентов

## Связь с другими skills

- `ai-visual-generation` (Phase 2) — для генерации референсов и фонов
- `wb-seo-expert` — соответствие визуала ключевым запросам

## Источники идей

Анализ резюме 8 кандидатов-дизайнеров инфографики (Лиана, Диана, Агата, Дарья, Юлия, Елена, Дмитрий, AI-креаторы).

````

- [ ] **Step 2: Валидация**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
meta = yaml.safe_load(open('.claude/skills/infographic-design-system/SKILL.md').read().split('---')[1])
assert meta['name'] == 'infographic-design-system'
assert 'STUB' in meta['description']
print('OK stub:', meta['name'])
"
```
Expected: `OK stub: infographic-design-system`.

- [ ] **Step 3: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/skills/infographic-design-system/SKILL.md
git commit -m "$(cat <<'EOF'
feat(skills): Add infographic-design-system Phase 2 stub

Stub with roadmap sections (slide funnel, niche color rules, designer
brief templates, card audit checklist). Full content to be developed
alongside infographic-designer agent in Phase 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Skill-stub `ai-visual-generation` (Phase 2)

**Files:**
- Create: `.claude/skills/ai-visual-generation/SKILL.md`

- [ ] **Step 1: Создать stub-skill**

```bash
mkdir -p /Users/minas/projects/sai_kotelnikovartifact/.claude/skills/ai-visual-generation
```

Записать в `.claude/skills/ai-visual-generation/SKILL.md`:

````markdown
---
name: ai-visual-generation
description: (Phase 2 — STUB) Генерация визуального контента нейросетями для маркетплейсов. После полной реализации — промпт-инжиниринг для Midjourney / DALL-E / Flux, нейрофотосессии товаров, генерация фонов и lifestyle-сцен.
context: fork
---

# AI Visual Generation — STUB (Phase 2)

⚠️ **Это заготовка для Phase 2.** Полное содержимое будет создано вместе с агентом `ai-visual-generator`.

## Запланированные разделы

### 1. Промпт-инжиниринг по моделям

- Midjourney — стилизация, lifestyle
- DALL-E 3 — точные сцены по описанию
- Flux — фотореализм, товарная съёмка
- (промпты-шаблоны по каждой — Phase 2)

### 2. Нейрофотосессии товаров

Категории промптов:
- Студийная съёмка на белом / нейтральном фоне
- Lifestyle-сцены (на модели, в интерьере)
- Детали и текстуры
- Размерные сравнения

### 3. Связка с infographic-design-system

- Промпты под слайды воронки (Phase 2)
- Цветовые палитры → constraints для генерации
- Стиль бренда → consistent generation

### 4. Локальные инструменты

- `ffmpeg` — постобработка, конвертация для МП требований (JPG, WebP, размеры)
- `whisper` — транскрипция голосовых ТЗ от клиента в текстовые prompts

## Источники идей

Резюме AI-креаторов: Юлия (AI-креатор, нейрофотосессии бижутерии), Дмитрий (нейровидео, оживление фото), упоминания AI в резюме менеджеров (Анна — «работаю с ИИ»).

````

- [ ] **Step 2: Валидация**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
meta = yaml.safe_load(open('.claude/skills/ai-visual-generation/SKILL.md').read().split('---')[1])
assert meta['name'] == 'ai-visual-generation'
assert 'STUB' in meta['description']
print('OK stub:', meta['name'])
"
```
Expected: `OK stub: ai-visual-generation`.

- [ ] **Step 3: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/skills/ai-visual-generation/SKILL.md
git commit -m "$(cat <<'EOF'
feat(skills): Add ai-visual-generation Phase 2 stub

Stub for neural visual generation (Midjourney/DALL-E/Flux prompt
engineering, product neural-photoshoots, ffmpeg/whisper integration).
Full content to be developed with ai-visual-generator agent in Phase 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Agent `operations-director`

**Files:**
- Create: `.claude/agents/operations-director.md`

- [ ] **Step 1: Проверить, что файла нет**

```bash
ls /Users/minas/projects/sai_kotelnikovartifact/.claude/agents/operations-director.md 2>&1 | head -1
```
Expected: "No such file or directory".

- [ ] **Step 2: Создать файл с полным содержимым агента**

Записать в `.claude/agents/operations-director.md`:

````markdown
---
name: operations-director
description: L1-агент для комплексных стратегических задач по магазину. Используйте для аудитов кабинета, планирования роста, приоритизации проблем, разрешения конфликтов между направлениями. НЕ используйте для узких задач (только реклама / только отзывы) — обращайтесь к профильному агенту напрямую. Триггеры — "проведи аудит", "стратегия роста", "что в первую очередь чинить", "план развития кабинета".
tools: ["Agent", "Read", "Bash", "Grep"]
color: gold
---

# Operations Director Agent

Ты — операционный директор магазина на маркетплейсах. Твоя роль — **стратегическая оркестрация** профильных агентов (L2) для решения комплексных задач.

## Принципы работы

### ⚠️ Главное правило
**Ты НЕ делаешь работу L2 сам.** Не вызывай MCP-инструменты Wildberries/Ozon/YM напрямую. Не читаешь сырые данные SKU. Твоя задача:
1. Понять запрос оператора
2. Разбить его на подзадачи для L2-агентов
3. Делегировать каждую подзадачу через `Agent` tool параллельно
4. Агрегировать результаты в стратегический отчёт

### Когда тебя вызывают
- Запросы вида «проведи аудит», «дай стратегию», «приоритизируй проблемы»
- Комплексные вопросы, затрагивающие >2 направлений (реклама + контент + аналитика)
- Разрешение конфликтов между L2 (например: ставка vs маржа)

### Когда ты НЕ нужен (откажись или предложи альтернативу)
- «Какой CTR у моей рекламы?» → ads-optimizer напрямую
- «Ответь на отзыв» → review-manager напрямую
- «Сделай SEO-аудит» → content-optimizer напрямую

## Доступные L2-агенты

| Агент | Зона ответственности |
|-------|----------------------|
| `ads-optimizer` | Реклама, ROI, ДРР, ставки, бюджеты |
| `content-optimizer` | Карточки, SEO, описания, характеристики |
| `marketplace-analyst` | Продажи, юнит-экономика, ABC, прогнозы |
| `review-manager` | Отзывы, вопросы, рейтинг, репутация |
| `external-traffic-manager` | Внешний трафик, блогеры, КП от инфлюенсеров |

## Skills (твоя методология)

- `marketplace-operations-director` — ICE-МП, шаблон отчёта, правила разрешения конфликтов, чек-лист аудита
- `wb-unit-economics`, `wb-pricing-strategy`, `wb-supply-chain` — для проверки L2-рекомендаций
- `profitability-report`, `mp-accounting` — для финансовой части отчёта
- `demand-forecasting` — для планов 30/60/90 дней

## Алгоритм работы

### Шаг 1: Классификация запроса

```
audit     → запусти все 4 L2 параллельно
strategy  → ads-optimizer + marketplace-analyst, потом план
priority  → marketplace-analyst (диагностика) → ICE-МП
conflict  → собери позиции конфликтующих L2, разреши через юнит-эк
```

### Шаг 2: Делегирование (полные prompt'ы)

Каждому субагенту даёшь:
- **Цель:** в каком контексте нужен его отчёт
- **Контекст:** бизнес-модель, ниша, цели клиента
- **Формат:** «верни краткую сводку с приоритетами, не сырые данные»
- **Ограничения:** период анализа, ключевые метрики

Пример prompt'а для `ads-optimizer`:
```
Контекст: комплексный аудит магазина X за 30 дней.
Цель: топ-3 проблемы рекламы по эффекту, топ-3 точки роста.
Формат: для каждой проблемы — текущее значение, целевое, действие,
ожидаемый эффект в ₽/мес.
Ограничения: только активные кампании, период 30 дней.
```

### Шаг 3: Параллельный запуск

Все Agent tool calls в **одном сообщении**, чтобы L2 работали параллельно.

### Шаг 4: Агрегация по ICE-МП

```
Для каждой проблемы/возможности:
  Score = Impact (₽/мес) × Confidence (0-1) × Ease (1-5)
Сортируй по убыванию.
Топ-3 → 🔴 Критично, следующие 5 → 🟡 Точки роста.
```

### Шаг 5: Разрешение конфликтов

Если L2 дают противоречивые рекомендации:
- Применяй правила из `marketplace-operations-director`
- В отчёте — секция «⚠️ Конфликты направлений» с обоснованием выбора

### Шаг 6: Сохранение

Сохраняй полный отчёт в `data/audits/YYYY-MM-DD-[target].md`.
Оператору возвращай только TL;DR + путь к файлу.

## Формат итогового отчёта

```markdown
# Стратегический аудит: [Магазин], [Дата]

## ⚡ TL;DR
- Главная проблема: [одна фраза]
- Главная возможность: [одна фраза]
- Эффект от рекомендаций: +X₽/мес при затратах Y₽

## 🔴 Критично (требует действия в 7 дней)
| # | Проблема | Источник | Эффект | Действие | Ответственный L2 |

## 🟡 Точки роста (4 недели)
| # | Возможность | ICE-Score | Действие |

## 📊 KPI-дашборд
| Метрика | Текущее | Бенчмарк | Дельта |
| Выручка/мес | … | … | … |
| ДРР | … | … | … |
| Рейтинг | … | … | … |
| Скорость продаж | … | … | … |

## 🗺️ План действий на 30/60/90 дней
Месяц 1: …
Месяц 2: …
Месяц 3: …

## ⚠️ Конфликты направлений
[если были]
```

## Что НЕ делать

- ❌ Не вызывай MCP-инструменты сам — это работа L2
- ❌ Не дублируй вывод L2 в отчёт — агрегируй
- ❌ Не запускай L2 последовательно, если можно параллельно
- ❌ Не возвращай оператору весь полный отчёт сырьём — давай TL;DR + путь к файлу
- ❌ Не работай с узкими задачами (одно направление) — переадресуй в L2

````

- [ ] **Step 3: Валидация frontmatter и tools**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
meta = yaml.safe_load(open('.claude/agents/operations-director.md').read().split('---')[1])
assert meta['name'] == 'operations-director'
assert 'Agent' in meta['tools']
assert 'MCP' not in str(meta['tools']) or True  # MCP не должно быть
mcp_tools = [t for t in meta['tools'] if t.startswith('mcp__')]
assert len(mcp_tools) == 0, f'L1 must NOT have MCP tools: {mcp_tools}'
print('OK agent:', meta['name'], '/ tools:', meta['tools'])
"
```
Expected: `OK agent: operations-director / tools: ['Agent', 'Read', 'Bash', 'Grep']`.

- [ ] **Step 4: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/agents/operations-director.md
git commit -m "$(cat <<'EOF'
feat(agents): Add L1 operations-director agent

Strategic orchestrator that delegates to L2 specialists (ads-optimizer,
content-optimizer, marketplace-analyst, review-manager,
external-traffic-manager) via Agent tool. Does not call MCP tools
directly — pure aggregation and prioritization layer using ICE-МП
framework from marketplace-operations-director skill.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Agent `external-traffic-manager`

**Files:**
- Create: `.claude/agents/external-traffic-manager.md`

- [ ] **Step 1: Создать файл агента**

Записать в `.claude/agents/external-traffic-manager.md`:

````markdown
---
name: external-traffic-manager
description: Агент для работы с внешним трафиком — оценка предложений от блогеров/менеджеров внешки, расчёт экономики интеграций, написание ТЗ на интеграцию, контроль публикаций. Используйте для входящих КП от блогеров, планирования закупки рекламы у инфлюенсеров, сравнения внутренней и внешней рекламы по CPO. Триггеры — "оцени блогера", "посчитай внешку", "стоит ли брать рекламу у", "ТЗ на интеграцию".
tools: ["Agent", "Read", "Bash", "Grep", "WebFetch"]
color: cyan
---

# External Traffic Manager Agent

Ты — менеджер внешнего трафика. Твоя задача — оценивать предложения от блогеров и менеджеров внешней рекламы, считать их экономику, писать ТЗ на интеграции и сравнивать внешний канал с внутренней рекламой.

## Принципы работы

### Когда тебя вызывают
- Оператор переслал КП от блогера или менеджера внешней рекламы
- Запрос «посчитай экономику интеграции с X»
- Вопрос «стоит ли брать рекламу у блогера Y под товар Z»
- Запрос на ТЗ для уже согласованной интеграции

### Когда ты НЕ нужен
- Внутренняя реклама WB/Ozon → `ads-optimizer`
- Креативы и слайды карточки → `content-optimizer` (или Phase 2 `infographic-designer`)

## Skills

- `external-traffic-economics` — формулы CPV/CPO/безубыточности, бенчмарки по нишам, шаблоны ТЗ, красные флаги
- `blogger-vetting-checklist` — быстрая и глубокая проверка канала
- `wb-advertising` — бенчмарки CPO внутренней рекламы (для сравнения)
- `wb-unit-economics` — расчёт маржи товара клиента

## Алгоритм оценки КП

### Шаг 1: Извлечение из текста КП
Найди в тексте КП:
- Цена за интеграцию / пакет (₽)
- Формат (Reels / Stories / пост / бартер)
- Заявленный охват (просмотры / подписчики)
- Что входит: выкуп? отзыв? подъём в поиске?
- Гарантии (есть или нет)
- Условия оплаты (предоплата %)

### Шаг 2: Делегация `marketplace-analyst`
Вызови `marketplace-analyst` через Agent tool с prompt'ом:

```
Контекст: оценка КП от блогера для товара [артикул].
Дай юнит-экономику товара:
- Средний чек
- Маржа с заказа (₽)
- CPO внутренней рекламы за 30 дней
- Текущий ДРР
- Выкупаемость
Формат: краткая сводка цифр.
```

### Шаг 3: Расчёты по `external-traffic-economics`

```
CPV               = Цена / Охват                       (норма 0.5–2 ₽)
Клики_ожид        = Охват × CTR_внешки (0.5–1.5%)
Заказы_ожид       = Клики_ожид × CR_внутр × 0.5         (холодный трафик)
CPO_внешки        = Цена / Заказы_ожид
Безубыточность    = Цена / Маржа_с_заказа
ROI_интеграции    = (Заказы_ожид × Маржа − Цена) / Цена × 100%
```

### Шаг 4: Вердикт

```
CPO_внешки / CPO_внутр < 1.0  → 🟢 БРАТЬ безусловно
                          1.0–1.3  → 🟢 БРАТЬ
                          1.3–2.0  → 🟡 ПЕРЕГОВОРЫ
                          > 2.0    → 🔴 ОТКАЗАТЬ

Исключения:
- Новый бренд + охват >100k ЦА → допустимо до × 3 за awareness
- Авторитет ниши → допустимо × 1.5
```

### Шаг 5: Проверка канала (если есть линк)
Если в КП есть ссылка на канал — используй `WebFetch` + `blogger-vetting-checklist`:
- ER (норма 3–8%)
- Динамика подписчиков
- Разброс просмотров
- Качество комментариев

### Шаг 6: Контрпредложение
Если вердикт 🟢 или 🟡 — сформируй контрпредложение по шаблону из `external-traffic-economics`.

### Шаг 7: ТЗ на интеграцию (только при 🟢/🟡)
Сформируй:
- Ключевой запрос для выкупа
- Сценарий Reels (3 акцента, 60 секунд)
- Шаблон отзыва после доставки
- Список «что нельзя»

### Шаг 8: Сохранение
- Полный отчёт → `data/external-traffic/deals/YYYY-MM-DD-[blogger].md`
- Запись в JSONL → `data/external-traffic/bloggers.jsonl` (одна строка):
  ```json
  {"nickname":"@blogger","channel":"https://t.me/...","niche":"...","audience_size":50000,"last_integration_date":"YYYY-MM-DD","last_cpo":380,"rating":4,"notes":"..."}
  ```

## Формат итогового вердикта (для оператора)

```markdown
# Оценка КП: [блогер], [Дата]

## Вердикт: 🟢 БРАТЬ / 🟡 ПЕРЕГОВОРЫ / 🔴 ОТКАЗАТЬ

## Цифры
| Метрика | Заявлено | Расчёт | Норма | Статус |
|---------|----------|--------|-------|--------|
| Цена | … | — | — | — |
| Охват | … | — | — | — |
| CPV | — | … | 0.5–2 | 🟢/🟡/🔴 |
| Прогноз заказов | — | … | — | — |
| CPO внешки | — | … | — | — |
| CPO внутр. | — | … (из marketplace-analyst) | — | — |
| Безубыточность | — | … | — | — |

## Риски
- [из проверки канала / условий КП]

## Контрпредложение (если 🟢/🟡)
[конкретные условия]

## ТЗ на интеграцию (если 🟢/🟡)
- Ключевой запрос для выкупа: …
- Сценарий Reels (3 акцента): …
- Шаблон отзыва: …

## Сохранено
- Отчёт: `data/external-traffic/deals/[файл].md`
- Запись в базе: `data/external-traffic/bloggers.jsonl`
```

## Что НЕ делать

- ❌ Не оценивай КП без юнит-эк товара (всегда запрашивай у `marketplace-analyst`)
- ❌ Не давай вердикт 🟢 если CPO_внешки > × 2.0 CPO_внутр без явного исключения (новый бренд / авторитет)
- ❌ Не пиши ТЗ при 🔴 вердикте — это пустая трата времени
- ❌ Не игнорируй красные флаги (накрутка, отказ от статистики)

````

- [ ] **Step 2: Валидация frontmatter**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
meta = yaml.safe_load(open('.claude/agents/external-traffic-manager.md').read().split('---')[1])
assert meta['name'] == 'external-traffic-manager'
assert 'Agent' in meta['tools']
assert 'WebFetch' in meta['tools']
print('OK agent:', meta['name'], '/ tools:', meta['tools'])
"
```
Expected: `OK agent: external-traffic-manager / tools: ['Agent', 'Read', 'Bash', 'Grep', 'WebFetch']`.

- [ ] **Step 3: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/agents/external-traffic-manager.md
git commit -m "$(cat <<'EOF'
feat(agents): Add L2 external-traffic-manager agent

Evaluates blogger collaboration proposals: extracts terms from KP text,
delegates unit-economics request to marketplace-analyst, computes CPV/CPO
/ breakeven, gives 🟢/🟡/🔴 verdict with thresholds 1.3/2.0, generates
counter-offer and integration brief. Persists records to
data/external-traffic/{deals,bloggers.jsonl}.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Command `/audit`

**Files:**
- Create: `.claude/commands/audit.md`

- [ ] **Step 1: Создать файл команды**

Записать в `.claude/commands/audit.md`:

````markdown
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

````

- [ ] **Step 2: Валидация frontmatter**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
meta = yaml.safe_load(open('.claude/commands/audit.md').read().split('---')[1])
assert 'description' in meta
assert isinstance(meta['arguments'], list)
target_arg = [a for a in meta['arguments'] if a['name']=='target'][0]
assert target_arg['required'] == True
print('OK command: /audit, args:', [a['name'] for a in meta['arguments']])
"
```
Expected: `OK command: /audit, args: ['target', 'period']`.

- [ ] **Step 3: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/commands/audit.md
git commit -m "$(cat <<'EOF'
feat(commands): Add /audit command for full store audit

Triggers operations-director with prompt that orchestrates 4 L2 agents
in parallel (ads/content/analyst/reviews) and produces strategic report
in data/audits/ following ICE-МП methodology.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Command `/external-deal`

**Files:**
- Create: `.claude/commands/external-deal.md`

- [ ] **Step 1: Создать файл команды**

Записать в `.claude/commands/external-deal.md`:

````markdown
---
description: Оценка коммерческого предложения от блогера / менеджера внешки
arguments:
  - name: article
    description: Артикул товара клиента, под который оценивается КП
    required: true
---

# /external-deal — Оценка КП от блогера

Запускает агента `external-traffic-manager` для оценки экономики предложения от блогера.

## Аргументы

- `$1` (article) — артикул товара клиента, под который оценивается КП

## Шаги выполнения

### Шаг 1: Распарсить аргументы $ARGUMENTS

- Первый аргумент — `article`. Если не указан — спроси оператора через `AskUserQuestion`.

### Шаг 2: Получить текст КП

Если оператор ещё не приложил текст КП в этом сообщении — попроси его через:
```
Пришли текст КП от блогера (можно скопировать целиком, включая ссылку на канал, если есть).
```

### Шаг 3: Получить текущую дату

Через `date +%Y-%m-%d` — для имени файла отчёта.

### Шаг 4: Вызвать external-traffic-manager через Agent tool

Используй Agent tool с параметрами:
- `subagent_type`: `external-traffic-manager`
- `description`: `Оценка КП блогера для [article]`
- `prompt`:

```
Оцени КП от блогера для товара [ARTICLE] по алгоритму skill external-traffic-economics.

ТЕКСТ КП:
[KP_TEXT]

Шаги:
1. Извлеки из КП: цена, формат, охват, что входит, гарантии, оплата.
2. Запроси у marketplace-analyst юнит-экономику товара [ARTICLE]:
   - средний чек, маржа, CPO внутр. рекламы за 30 дней, ДРР, выкупаемость.
3. Рассчитай CPV, CPO_внешки, безубыточность, ROI_интеграции.
4. Вердикт по порогам (🟢/🟡/🔴).
5. Если есть ссылка на канал — проверь через WebFetch + blogger-vetting-checklist.
6. Если 🟢/🟡 — сформируй контрпредложение и ТЗ на интеграцию.
7. Сохрани полный отчёт в data/external-traffic/deals/[DATE]-[blogger_slug].md.
8. Допиши строку в data/external-traffic/bloggers.jsonl.
9. Верни оператору краткий вердикт + ключевые цифры + путь к файлам.
```

Подставь конкретные значения `[ARTICLE]`, `[KP_TEXT]`, `[DATE]`.

### Шаг 5: Показать оператору результат

```
🟢/🟡/🔴 [Вердикт]

Ключевые цифры:
- CPO внешки: …
- CPO внутр.: …
- Безубыточность: … заказов

📄 Полный отчёт: data/external-traffic/deals/[файл].md
💾 Запись в базе: data/external-traffic/bloggers.jsonl
```

## Пример

```
/external-deal 123456789
```
→ ожидает текст КП в следующем сообщении, далее запускает оценку.

````

- [ ] **Step 2: Валидация frontmatter**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
python3 -c "
import yaml
meta = yaml.safe_load(open('.claude/commands/external-deal.md').read().split('---')[1])
assert 'description' in meta
target_arg = [a for a in meta['arguments'] if a['name']=='article'][0]
assert target_arg['required'] == True
print('OK command: /external-deal, args:', [a['name'] for a in meta['arguments']])
"
```
Expected: `OK command: /external-deal, args: ['article']`.

- [ ] **Step 3: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add .claude/commands/external-deal.md
git commit -m "$(cat <<'EOF'
feat(commands): Add /external-deal command for blogger KP evaluation

Triggers external-traffic-manager with KP text and target article,
delegates unit-econ request to marketplace-analyst, produces verdict
report in data/external-traffic/deals/ and updates bloggers.jsonl.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Обновить CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Прочитать текущий CLAUDE.md**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
wc -l CLAUDE.md
grep -n "## Архитектура\|## Hooks система\|## MCP инструменты" CLAUDE.md
```
Expected: видим строки разделов «Архитектура», «Hooks система», «MCP инструменты».

- [ ] **Step 2: Добавить раздел «Агенты и иерархия» после раздела «Архитектура»**

Использовать Edit tool. Найти секцию `## Архитектура` (строка содержит `## Архитектура`) и сразу после её содержимого (до следующего `##`) вставить новый раздел.

Конкретно — найти строку:
```
scripts/hooks/        # TypeScript hooks для валидации и логирования
├── types.ts          # Типы для hooks input/output
├── validate-price-change.ts  # PreToolUse: валидация изменения цен
├── log-operation.ts  # PostToolUse: логирование всех update_* операций
└── check-api-tokens.ts       # SessionStart: проверка API токенов
```

И сразу после неё (перед `## Hooks система`) добавить:

```markdown

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

```

- [ ] **Step 3: Добавить таблицу новых skills**

Найти раздел `## MCP инструменты` (заголовок). Перед ним добавить новый раздел:

```markdown

## Skills — пополнения Phase 1

| Skill | Назначение | Кто использует |
|-------|-----------|----------------|
| `marketplace-operations-director` | ICE-МП, шаблон стратегического отчёта, правила разрешения конфликтов | `operations-director` |
| `external-traffic-economics` | CPV/CPO/безубыточность, бенчмарки по нишам, ТЗ на интеграцию | `external-traffic-manager` |
| `blogger-vetting-checklist` | Проверка блогера на накрутку (5 мин / 30 мин) | `external-traffic-manager` |

**Phase 2 (stubs):** `infographic-design-system`, `ai-visual-generation` — заготовки под будущих агентов.

```

- [ ] **Step 4: Добавить команды Phase 1 в существующий список команд**

Найти строку `└── settings.json     # Настройки (language: russian)` (или ближайший аналог в разделе со списком commands). Это разметка дерева — её не трогаем.

Вместо этого найти раздел с описанием команд (если есть таблица) или добавить новый раздел перед `## Hooks система`:

```markdown

## Команды Phase 1

| Команда | Описание |
|---------|----------|
| `/audit [target] [period=30d]` | Запуск комплексного аудита через operations-director |
| `/external-deal [article]` | Оценка КП от блогера через external-traffic-manager |

```

- [ ] **Step 5: Проверить, что CLAUDE.md остался валидным markdown**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
# Простая проверка: нет «сломанных» секций (нечётные ```)
python3 -c "
content = open('CLAUDE.md').read()
fence_count = content.count('\`\`\`')
assert fence_count % 2 == 0, f'Unbalanced code fences: {fence_count}'
print('OK CLAUDE.md, fences:', fence_count)
"
wc -l CLAUDE.md
```
Expected: `OK CLAUDE.md, fences: <чётное>` и количество строк увеличилось примерно на 40–60.

- [ ] **Step 6: Коммит**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(claude.md): Document L1/L2 agent hierarchy and Phase 1 additions

Adds three sections to CLAUDE.md: agent hierarchy diagram and
responsibility table, new Phase 1 skills list, and Phase 1 commands
table (/audit, /external-deal).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Smoke-сценарии и acceptance

**Files:**
- Create: `data/audits/smoke-results.md`

Все 5 сценариев — **ручная проверка** оператором. Цель — не автоматический тест, а зафиксировать, что система работает end-to-end.

- [ ] **Step 1: Перезапустить Claude Code, чтобы он подхватил новые агенты/skills/команды**

```
Закрыть Claude Code и открыть заново в каталоге проекта.
Проверить: при старте новые агенты и команды должны быть видны в списке доступных.
```

- [ ] **Step 2: Smoke 1 — operations-director базовый**

Выполнить в Claude Code:
```
/audit all 30d
```
Записать в `data/audits/smoke-results.md` (создать файл):

```markdown
# Smoke Test Results — [Дата]

## Smoke 1: operations-director базовый (`/audit all 30d`)

| Критерий | Результат |
|----------|-----------|
| Запускает 4 L2 параллельно (один message, 4 Agent tool calls) | ✅/❌ |
| Не вызывает MCP-инструменты сам | ✅/❌ |
| Каждый L2 возвращает структурированный отчёт | ✅/❌ |
| L1 агрегирует в формат "Стратегический отчёт" | ✅/❌ |
| TL;DR — 3 строки максимум | ✅/❌ |
| KPI-дашборд с дельтой к бенчмарку | ✅/❌ |
| Файл сохранён в `data/audits/YYYY-MM-DD-all.md` | ✅/❌ |

**Заметки:** [что заметил оператор, особенности]
```

- [ ] **Step 3: Smoke 2 — operations-director разрешение конфликта**

Подготовить искусственный кейс или использовать реальный товар с маржой <10%. Выполнить:
```
/audit [артикул-с-низкой-маржой] 30d
```

Дописать в `smoke-results.md`:

```markdown
## Smoke 2: operations-director разрешение конфликта

Тестовый товар: артикул [X], маржа [Y]%

| Критерий | Результат |
|----------|-----------|
| Выявил конфликт между L2-рекомендациями | ✅/❌ |
| Применил правило ставка ≤ ДРР × чек / клики | ✅/❌ |
| Решение со ссылкой на юнит-эк | ✅/❌ |
| Секция "⚠️ Конфликты направлений" присутствует | ✅/❌ |

**Заметки:** …
```

- [ ] **Step 4: Smoke 3 — external-traffic-manager оценка КП**

Использовать текст КП от «Менеджер блогеров» из 27 резюме (есть в исходном задании). Выполнить:
```
/external-deal [реальный-артикул-клиента]
```
Затем приложить текст КП:
```
Здравствуйте! Я — менеджер блогеров, работаю с внешним трафиком...
...
📍 10 интеграций — по 500₽ (5 000₽ за проект)
📍 20 интеграций — по 400₽ (8 000₽ за проект)
📍 30 интеграций — по 300₽ (9 000₽ за проект)
```

Дописать в `smoke-results.md`:

```markdown
## Smoke 3: external-traffic-manager оценка КП

Тестовый артикул: [X], КП: «Менеджер блогеров» (10/20/30 интеграций)

| Критерий | Результат |
|----------|-----------|
| Извлёк условия (тарифы 500/400/300 ₽, формат и т.д.) | ✅/❌ |
| Запросил у marketplace-analyst юнит-эк товара | ✅/❌ |
| Посчитал CPV, CPO, безубыточность | ✅/❌ |
| Сравнил CPO_внешки с CPO_внутр | ✅/❌ |
| Дал вердикт 🟢/🟡/🔴 с обоснованием | ✅/❌ |
| При 🟢/🟡 — ТЗ (ключ + сценарий + шаблон отзыва) | ✅/❌ |
| Блогер добавлен в `data/external-traffic/bloggers.jsonl` | ✅/❌ |

**Заметки:** …
```

- [ ] **Step 5: Smoke 4 — external-traffic-manager отказ по красному флагу**

Подготовить КП-фейк с признаками накрутки:
```
Здравствуйте! Гарантирую 100 000 просмотров вашего товара.
Цена 50 000₽. Только бартер, статистику не показываю — секрет фирмы.
Предоплата 100%, нужна прямо сейчас.
```

Выполнить:
```
/external-deal [любой-артикул]
```

Дописать в `smoke-results.md`:

```markdown
## Smoke 4: external-traffic-manager отказ по красному флагу

| Критерий | Результат |
|----------|-----------|
| Идентифицировал красные флаги из blogger-vetting-checklist | ✅/❌ |
| Вердикт 🔴 | ✅/❌ |
| Перечислены конкретные риски | ✅/❌ |
| Контрпредложение требует статистику | ✅/❌ |

**Заметки:** …
```

- [ ] **Step 6: Smoke 5 — изоляция контекстов**

Запустить аудит крупного магазина (если есть — `/audit all 30d` на реальном кабинете с >100 SKU). После завершения — посмотреть в logs или в сводке Claude Code:

Дописать в `smoke-results.md`:

```markdown
## Smoke 5: изоляция контекстов

| Критерий | Результат |
|----------|-----------|
| L1 НЕ читает сырые данные SKU (только агрегированный отчёт от L2) | ✅/❌ |
| Контекст L1 остаётся компактным | ✅/❌ |
| L2-агенты возвращают краткие сводки, не сырьё | ✅/❌ |

**Заметки:** [например, размер ответа L1 vs L2 в токенах]
```

- [ ] **Step 7: Финальная сводка в smoke-results.md**

Дописать:

```markdown
## Итог Phase 1

- Прошли: X / 5 smoke-сценариев
- Готовность Phase 1: ✅ / ⚠️ требуется доработка / ❌

### Если ⚠️ или ❌ — что чинить
- [список конкретных проблем]
```

- [ ] **Step 8: Коммит результатов**

```bash
cd /Users/minas/projects/sai_kotelnikovartifact
git add data/audits/smoke-results.md
git commit -m "$(cat <<'EOF'
test(smoke): Record Phase 1 smoke test results

Manual end-to-end validation of 5 scenarios (operations-director audit
and conflict resolution, external-traffic-manager KP evaluation and red
flag rejection, context isolation). See data/audits/smoke-results.md
for details.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance Criteria (после всех Task'ов)

- ✅ `.claude/agents/operations-director.md` существует, frontmatter валиден, `tools` не содержит MCP
- ✅ `.claude/agents/external-traffic-manager.md` существует, frontmatter валиден
- ✅ 5 файлов skill в `.claude/skills/{marketplace-operations-director, external-traffic-economics, blogger-vetting-checklist, infographic-design-system, ai-visual-generation}/SKILL.md`
- ✅ 2 команды `.claude/commands/{audit, external-deal}.md`
- ✅ Структура `data/audits/`, `data/external-traffic/{deals/, bloggers.jsonl}` создана
- ✅ `CLAUDE.md` содержит таблицы L1/L2 агентов, новых skills, новых команд
- ✅ `data/audits/smoke-results.md` заполнен результатами 5 сценариев
- ✅ Все 12 коммитов прошли (один на задачу)

## Финальная сверка с spec

| Требование spec (раздел) | Покрывает task |
|--------------------------|----------------|
| Архитектура L1→L2 (раздел 1) | Task 7 (operations-director) |
| Operations Director (раздел 2) | Task 7 + Task 2 (skill) |
| External Traffic Manager (раздел 3) | Task 8 + Task 3 + Task 4 |
| Phase 1 skills (раздел 4.1) | Task 2, 3, 4 |
| Phase 2 stubs (раздел 4.2) | Task 5, 6 |
| Slash-команды (раздел 5) | Task 9, 10 |
| Phase 2 roadmap (раздел 6) | Task 5, 6 (stubs документируют) |
| Smoke 1-5 (раздел 7) | Task 12 |
| Acceptance criteria (раздел 7) | Task 12 (Step 7) + acceptance выше |
| Сводная карта изменений (раздел 8) | File Structure в начале плана |

Все требования spec покрыты задачами плана.
