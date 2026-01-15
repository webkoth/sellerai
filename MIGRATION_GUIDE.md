# Руководство по миграции v1 → v2

> Пошаговая инструкция для обновления SellerAI с версии 1.x до 2.0.0

---

## 📋 Резюме изменений

**v2.0.0** — это **major release** с существенными архитектурными изменениями:

| Аспект | v1.0.0 | v2.0.0 | Тип изменения |
|--------|--------|--------|---------------|
| **Размер репозитория** | 99GB | ~1GB | 🔴 Breaking |
| **Курсы** | В репозитории | Вынесены | 🔴 Breaking |
| **MCP конфигурация** | 2 файла | 1 файл + symlink | 🔴 Breaking |
| **Миграции БД** | 2 папки | 1 папка | 🔴 Breaking |
| **Формулы** | Дублируются | Централизованы | ✅ Улучшение |
| **Skills** | 200-300 строк | 100-150 строк | ✅ Улучшение |
| **Knowledge Base** | Нет | Есть | ✅ Новое |

---

## ⚠️ Breaking Changes

### 1. Курсы вынесены из репозитория

**Было:** `courses/` в корне проекта (98GB)

**Стало:** `~/sellerai-courses/` (отдельная директория)

**Действия:**

```bash
# 1. Создать директорию для курсов
mkdir -p ~/sellerai-courses

# 2. Переместить курсы (если они у вас есть)
mv courses/* ~/sellerai-courses/

# 3. Обновить скрипт парсера
# В scripts/parse_courses.py путь изменён на ~/sellerai-courses/
```

**Если у вас нет курсов:**
- Ничего делать не нужно
- Скрипт `parse_courses.py` будет искать курсы в новом месте

**Если используете парсер:**
```bash
# Старая команда (v1)
python3 scripts/parse_courses.py --file "courses/[курс]/[файл].pdf"

# Новая команда (v2)
python3 scripts/parse_courses.py --file "~/sellerai-courses/[курс]/[файл].pdf"
```

---

### 2. MCP конфигурация консолидирована

**Было:**
- `.mcp.json` (корень)
- `.claude/.mcp.json` (дубликат)

**Стало:**
- `.claude/.mcp.json` (единственный файл)
- `.mcp.json` → symlink на `.claude/.mcp.json`

**Действия:**

```bash
# 1. Удалить корневой .mcp.json
rm .mcp.json

# 2. Создать symlink (для обратной совместимости)
ln -s .claude/.mcp.json .mcp.json

# 3. Проверить конфигурацию
cat .claude/.mcp.json
```

**Теперь редактируйте только:**
```
.claude/.mcp.json
```

---

### 3. Миграции БД объединены

**Было:**
- `/migrations/` (основные)
- `/dashboard/migrations/` (для dashboard)

**Стало:**
- `/migrations/` (все миграции)

**Действия:**

```bash
# Миграции уже объединены в v2
# Проверить порядок применения:
cat migrations/README.md

# Применить (если нужно):
psql $DATABASE_URL < migrations/001_init.sql
psql $DATABASE_URL < migrations/002_add_orders.sql
psql $DATABASE_URL < migrations/003_seller_settings.sql
```

**Порядок миграций:**
1. `001_init.sql` — базовые таблицы
2. `002_add_orders.sql` — таблица заказов
3. `003_seller_settings.sql` — настройки продавца

---

### 4. Служебные файлы удалены

**Удалены:**
- 28 файлов `.DS_Store` (macOS)
- `marketplace-docs-parser.skill` (дубликат в корне)
- Пустые папки

**Действия:**

```bash
# В v2 это уже сделано
# Для профилактики добавьте в .gitignore:
echo ".DS_Store" >> .gitignore
```

---

## ✨ Новые возможности

### 1. Knowledge Base — единый источник данных

**Что это:**
Централизованное хранилище формул, бенчмарков, данных.

**Расположение:**
```
.claude/knowledge/
├── formulas/
│   ├── wb-metrics.md       # ROI, маржа, CTR, конверсия
│   └── wb-costs.md         # Комиссии, логистика, налоги
└── benchmarks/
    └── wb-benchmarks.md    # Бенчмарки по 10 категориям
```

**Преимущества:**
- ✅ Формулы в одном месте (DRY)
- ✅ Обновление = везде автоматически
- ✅ Бенчмарки по 10 категориям товаров

**Как использовать:**
```markdown
# В Skills теперь ссылки вместо дублирования:
**Формула маржинальности:** См. `.claude/knowledge/formulas/wb-metrics.md#маржинальность`
```

---

### 2. Рефакторинг Skills — меньше дублирования

**Что изменилось:**
- Skills стали на 40-50% короче
- Формулы вынесены в Knowledge Base
- Добавлены разделы "Контекст применения" и "Типичные ошибки"

**Пример до/после:**

**Было (v1):**
```markdown
## Маржинальность

Формула: `Маржинальность = (Выручка - Расходы) / Выручка × 100%`

Бенчмарки:
- < 15% — плохо
- 15-25% — нормально
- > 40% — отлично
```

**Стало (v2):**
```markdown
## 📚 Формулы и расходы

**Формула маржинальности:** `.claude/knowledge/formulas/wb-metrics.md#маржинальность`
**Бенчмарки по категориям:** `.claude/knowledge/benchmarks/wb-benchmarks.md`

## 🎯 Контекст применения

**Когда пересчитывать:**
1. Запуск нового товара
2. Изменение себестоимости
3. Падение продаж

## ❌ Типичные ошибки

### Ошибка 1: Не учитывают возвраты
**Проблема:** Считают выручку по заказам, а не по выкупам
**Последствия:** Завышение маржи на 5-15%
**Решение:** Использовать формулу `Выручка = Заказы × Выкупаемость × Цена`
```

**Действия:**
- Ничего не нужно делать
- Skills обновлены автоматически при `git pull`
- Функциональность осталась той же

---

### 3. API Reference для Ozon и Yandex Market

**Добавлено:**
```
docs/api-reference/
├── ozon/                   # 37 файлов API документации
│   ├── README.md
│   ├── products.md
│   ├── prices-stocks.md
│   └── postman/
└── yandex-market/          # 3 файла API документации
    ├── README.md
    ├── business.md
    └── fbs.md
```

**Как использовать:**
- Спрашивайте Claude Code: "Как работает API Ozon для товаров?"
- Claude автоматически найдёт нужную документацию

---

### 4. Knowledge Base для маркетплейсов

**Добавлено:**
```
docs/knowledge-base/
├── wb/                     # 12 файлов знаний WB
├── ozon/                   # 4 файла знаний Ozon
└── yandex-market/          # 10 файлов знаний Яндекс
```

**Содержит:**
- Гайды по началу работы
- Описание моделей продаж (FBO/FBS/DBS)
- Настройка интеграции
- Работа с карточками товаров
- Аналитика и отчёты

---

## 🔄 Процесс миграции

### Шаг 1: Backup

**Создайте резервную копию:**

```bash
# Создать git tag для отката
git tag -a v1.0.0-backup -m "Backup перед миграцией на v2.0.0"

# Или создать полную копию
cp -r ~/projects/sellerai ~/projects/sellerai-backup
```

---

### Шаг 2: Обновление кода

```bash
# Получить последние изменения
git pull origin main

# Проверить версию
git log -1 --oneline
# Должно быть что-то вроде: "docs: синхронизация, ARCHITECTURE, CHANGELOG"
```

---

### Шаг 3: Миграция курсов (если есть)

```bash
# Если у вас есть директория courses/
if [ -d "courses" ]; then
  mkdir -p ~/sellerai-courses
  mv courses/* ~/sellerai-courses/
  echo "Курсы перенесены"
fi
```

---

### Шаг 4: Обновление MCP

```bash
# Удалить старый корневой .mcp.json
rm -f .mcp.json

# Создать symlink
ln -s .claude/.mcp.json .mcp.json

# Проверить
ls -la .mcp.json
# Должен быть symlink: .mcp.json -> .claude/.mcp.json
```

---

### Шаг 5: Проверка работоспособности

```bash
# Запустить Claude Code
claude

# В Claude Code проверить:
# 1. Skills загружаются
# 2. Commands работают
# 3. MCP серверы подключаются
```

**Тестовые команды:**
```
Покажи остатки товаров на WB
/unit-economics 123456
Какая формула маржинальности?
```

---

### Шаг 6: Обновление БД (если нужно)

```bash
# Проверить текущую схему БД
psql $DATABASE_URL -c "\dt"

# Если нет таблицы seller_settings, применить миграцию:
psql $DATABASE_URL < migrations/003_seller_settings.sql
```

---

## 🆘 Проблемы и решения

### Проблема 1: "Курсы не найдены"

**Симптом:**
```
FileNotFoundError: courses/[курс]/[файл].pdf
```

**Решение:**
```bash
# Переместить курсы в новое место
mkdir -p ~/sellerai-courses
mv courses/* ~/sellerai-courses/

# Или обновить путь в команде
python3 scripts/parse_courses.py --file "~/sellerai-courses/[курс]/[файл].pdf"
```

---

### Проблема 2: "MCP сервер не подключается"

**Симптом:**
```
Error: MCP server 'wb-mcp' not found
```

**Решение:**
```bash
# Проверить конфигурацию
cat .claude/.mcp.json

# Убедиться что symlink работает
ls -la .mcp.json

# Пересоздать symlink
rm .mcp.json
ln -s .claude/.mcp.json .mcp.json
```

---

### Проблема 3: "Формулы не найдены"

**Симптом:**
Skills ссылаются на `.claude/knowledge/formulas/wb-metrics.md`, но файл не найден

**Решение:**
```bash
# Проверить что файлы созданы
ls .claude/knowledge/formulas/
# Должны быть: wb-metrics.md, wb-costs.md

# Если нет — получить последние изменения
git pull origin main
```

---

### Проблема 4: "Database migrations failed"

**Симптом:**
```
ERROR: relation "seller_settings" already exists
```

**Решение:**
```bash
# Миграция уже применена, пропустить
# Или откатить и применить заново:
psql $DATABASE_URL -c "DROP TABLE IF EXISTS seller_settings CASCADE;"
psql $DATABASE_URL < migrations/003_seller_settings.sql
```

---

## 🔙 Откат на v1 (если что-то пошло не так)

**Вариант 1: Git tag**
```bash
git reset --hard v1.0.0-backup
git clean -fd
```

**Вариант 2: Резервная копия**
```bash
rm -rf ~/projects/sellerai
mv ~/projects/sellerai-backup ~/projects/sellerai
```

---

## ❓ FAQ

### Q: Нужно ли мне что-то делать с Skills?

**A:** Нет. Skills обновлены автоматически при `git pull`. Функциональность та же, просто структура улучшена.

---

### Q: Потеряю ли я данные при миграции?

**A:** Нет. База данных остаётся на месте, только добавляется новая таблица `seller_settings`.

---

### Q: Что делать если курсов нет?

**A:** Ничего. Просто пропустите шаг миграции курсов.

---

### Q: Работают ли старые команды?

**A:** Да. Все команды (`/unit-economics`, `/funnel`, и т.д.) работают как раньше.

---

### Q: Изменился ли API WB MCP?

**A:** Нет. WB MCP работает так же. Изменилась только внутренняя структура Skills.

---

### Q: Можно ли использовать v1 и v2 одновременно?

**A:** Да, если держать их в разных директориях:
```bash
~/projects/sellerai-v1/      # Старая версия
~/projects/sellerai-v2/      # Новая версия
```

---

### Q: Как проверить что миграция успешна?

**A:** Выполните тестовые команды:
```
Покажи остатки на WB
/unit-economics 123456
Какая маржинальность считается хорошей?
```

Если всё работает — миграция успешна.

---

## 📊 Что улучшилось

| Метрика | v1.0.0 | v2.0.0 | Улучшение |
|---------|--------|--------|-----------|
| Размер репозитория | 99GB | ~1GB | **-99%** |
| Дублирование формул | 13+ мест | 1 место | **-92%** |
| Средний размер Skill | 200-300 строк | 100-150 строк | **-40-50%** |
| Конфигов MCP | 2 файла | 1 файл + symlink | **-50%** |
| Папок миграций | 2 | 1 | **-50%** |
| .DS_Store файлов | 28 | 0 | **-100%** |
| Knowledge Base | 0 файлов | 3 файла | **+∞** |
| API Reference | 0 | Ozon + Yandex | **Новое** |

---

## 🔗 См. также

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — Архитектура v2.0.0
- [CHANGELOG.md](CHANGELOG.md) — Полный список изменений
- [README.md](README.md) — Основная документация
- [CLAUDE.md](CLAUDE.md) — Инструкции для Claude Code

---

## 💬 Нужна помощь?

**Проблемы с миграцией:**
- Создайте issue: https://github.com/your-repo/sellerai/issues
- Или откатитесь на v1: `git reset --hard v1.0.0-backup`

**Вопросы по новой архитектуре:**
- Читайте [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Смотрите примеры в обновлённых Skills
