# План: SellerAI Dashboard + Синхронизация остатков

## Резюме

Публичный SaaS-продукт для селлеров маркетплейсов:
- **Бесплатно:** Аудит магазина (аналитика, показатели, графики)
- **Платно:** Синхронизация FBS остатков между WB/Ozon/YM

---

## Бизнес-модель

```
Клиент → Регистрация → Вводит API ключи + товары с себестоимостью
                              ↓
                    Бесплатный аудит (лид-магнит)
                              ↓
                    Показатели, графики, рекомендации
                              ↓
                    Upsell → Платная синхронизация остатков
```

---

## Ключевые решения

| Вопрос | Решение |
|--------|---------|
| Структура | Monorepo: `apps/dashboard/` |
| Hubmarket | Объединить с dashboard |
| Синхронизация контента | Убрать (только остатки) |
| Master stock | PostgreSQL (МойСклад — позже) |
| Cron | node-cron (self-hosted на Timeweb) |
| Auth | NextAuth.js (самостоятельная регистрация) |
| Возвраты/отмены | Вручную (не автоматизируем) |

---

## Архитектура

```
sellerai/
├── .claude/                    # Claude Code (есть)
├── mcp/                        # MCP серверы (есть)
├── apps/
│   └── dashboard/              # Next.js SaaS
│       ├── app/
│       │   ├── (auth)/         # Регистрация / Логин
│       │   │   ├── login/
│       │   │   └── register/
│       │   ├── (dashboard)/    # Личный кабинет клиента
│       │   │   ├── overview/   # Главная с показателями
│       │   │   ├── products/   # Товары + себестоимость
│       │   │   ├── analytics/  # Графики, метрики
│       │   │   ├── stocks/     # [ПЛАТНО] Синхронизация
│       │   │   └── settings/   # API ключи, профиль
│       │   └── api/
│       │       ├── auth/       # NextAuth endpoints
│       │       └── cron/       # Внутренние cron endpoints
│       ├── lib/
│       │   ├── db/             # Drizzle ORM
│       │   ├── auth/           # NextAuth конфиг
│       │   ├── sync/           # Синхронизация остатков
│       │   └── marketplaces/   # API клиенты WB/Ozon/YM
│       ├── server.ts           # Custom server с node-cron
│       └── package.json
└── scripts/
```

---

## Логика синхронизации FBS

### Принцип работы

```
Master Stock (PostgreSQL или МойСклад)
         ↓
    Cron каждые 15 мин
         ↓
┌────────┴────────┐
↓        ↓        ↓
WB FBS  Ozon FBS  YM FBS
```

1. Получить заказы со всех маркетплейсов (новые, за последние N минут)
2. Уменьшить master stock на проданное количество
3. Запушить актуальные остатки на все маркетплейсы

### Маппинг SKU

Разные клиенты — разные артикулы. Таблица соответствий:

```
client_id | master_sku | wb_nm_id | ozon_offer_id | ym_offer_id
----------|------------|----------|---------------|------------
uuid-1    | SHIRT-001  | 12345678 | shirt-001-oz  | shirt001
```

---

## Схема БД (PostgreSQL)

```sql
-- Пользователи (NextAuth)
users (id, email, password_hash, name, created_at)
sessions (id, user_id, expires_at)

-- Подписка / тариф
subscriptions (
    id, user_id,
    plan,           -- 'free' | 'sync_monthly' | 'sync_yearly'
    status,         -- 'active' | 'expired' | 'cancelled'
    expires_at
)

-- Токены маркетплейсов пользователя
marketplace_tokens (id, user_id, marketplace, credentials, created_at)

-- Товары пользователя (с себестоимостью для аудита)
products (
    id, user_id,
    master_sku,     -- внутренний артикул
    name,
    cost_price,     -- себестоимость
    wb_nm_id, ozon_offer_id, ym_offer_id,
    created_at
)

-- Остатки (master stock для синхронизации)
stocks (id, user_id, master_sku, quantity, updated_at)

-- Лог синхронизаций
sync_log (id, user_id, started_at, finished_at, status, details)

-- Обработанные заказы (дедупликация)
processed_orders (id, user_id, marketplace, order_id, processed_at)
```

---

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| ORM | Drizzle ORM |
| БД | PostgreSQL (Timeweb managed или на VPS) |
| Cron | node-cron |
| UI | shadcn/ui + Tailwind |
| Auth | NextAuth.js (опционально) |
| Process Manager | PM2 |
| Reverse Proxy | Nginx |

---

## Деплой на Timeweb

```bash
# Сборка
npm run build

# Запуск через PM2
pm2 start server.js --name sellerai-dashboard

# Nginx конфиг
server {
    listen 80;
    server_name dashboard.sellerai.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Этапы реализации

### Этап 1: Инфраструктура
- [ ] Создать `apps/dashboard/` с Next.js 14
- [ ] Настроить Drizzle ORM + PostgreSQL
- [ ] Миграции БД
- [ ] NextAuth.js (email + password)
- [ ] Базовый layout с навигацией

### Этап 2: Бесплатный аудит (MVP)
- [ ] Регистрация / Логин
- [ ] Настройки: ввод API ключей WB/Ozon/YM
- [ ] Страница товаров: добавление товаров + себестоимость
- [ ] Overview: базовые показатели (остатки, заказы, выручка)
- [ ] Analytics: графики продаж, маржинальности

### Этап 3: Платная синхронизация
- [ ] Система подписок (plan check middleware)
- [ ] Страница Stocks: управление остатками
- [ ] Маппинг SKU между маркетплейсами
- [ ] node-cron синхронизация (каждые 15 мин)
- [ ] Лог синхронизаций

### Этап 4: Деплой на Timeweb
- [ ] PostgreSQL (managed или на VPS)
- [ ] Custom server.ts с cron
- [ ] PM2 + Nginx + SSL
- [ ] Домен

---

## Решённые вопросы

| Вопрос | Решение |
|--------|---------|
| МойСклад | Позже, сначала PostgreSQL |
| Auth | NextAuth, самостоятельная регистрация |
| Возвраты | Вручную, не автоматизируем |

## Открытые вопросы (для обсуждения позже)

1. **Оплата подписки** — ЮKassa, Stripe, вручную?
2. **Частота синхронизации** — 15 минут по умолчанию, настраиваемо?
3. **Лимиты** — сколько товаров на бесплатном плане?

---

## Верификация

### Этап 2 (Аудит):
1. Регистрация нового пользователя
2. Добавление API ключей WB
3. Добавление товаров с себестоимостью
4. Просмотр показателей и графиков

### Этап 3 (Синхронизация):
1. Активация платной подписки (вручную в БД для теста)
2. Настройка маппинга SKU
3. Ручной запуск синхронизации
4. Проверка что cron работает каждые 15 минут
5. End-to-end: заказ на WB → остатки уменьшились на Ozon/YM
