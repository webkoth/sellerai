# {MARKETPLACE_NAME} API Reference

> **Официальная документация:** {OFFICIAL_DOCS_URL}
> **Последнее обновление:** {UPDATE_DATE}
> **Всего категорий:** {TOTAL_CATEGORIES}

## Описание

Полная документация {MARKETPLACE_NAME} API в LLM-friendly формате. Все эндпоинты, параметры запросов, ответы и примеры использования.

---

## Категории API

{CATEGORIES_LIST}

---

## Авторизация

{AUTH_SECTION}

---

## Rate Limits

{RATE_LIMITS_SECTION}

---

## HTTP Status Codes

| Code | Описание | Решение |
|------|----------|---------|
| 200 | Success | - |
| 201 | Created | - |
| 204 | No Content / Deleted/Updated | - |
| 400 | Bad Request | Проверить синтаксис запроса |
| 401 | Unauthorized | Проверить токен (истёк, неверный, некорректный) |
| 403 | Forbidden | Недостаточно прав, проверить токен |
| 404 | Not Found | Проверить URL, проверить ID ресурса |
| 409 | Conflict | Конфликт данных, проверить запрос |
| 413 | Payload Too Large | Уменьшить размер запроса |
| 422 | Unprocessable Entity | Проверить корректность данных |
| 429 | Too Many Requests | Превышен rate limit, повторить позже |
| 500 | Internal Server Error | Ошибка сервера, повторить позже |
| 503 | Service Unavailable | Сервис недоступен, повторить позже |

---

## Дополнительные ресурсы

{ADDITIONAL_RESOURCES}

---

## Примечания

- Документация сгенерирована автоматически с помощью Firecrawl MCP
- Все эндпоинты включают примеры запросов и ответов
- Markdown формат оптимизирован для LLM (Claude, GPT)
- Обновления: следить за официальными release notes

---

**Дата генерации:** {GENERATION_TIMESTAMP}
**Источник:** {OFFICIAL_DOCS_URL}
**Генератор:** Firecrawl MCP + Claude Code
