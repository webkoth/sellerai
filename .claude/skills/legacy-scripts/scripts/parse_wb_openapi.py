#!/usr/bin/env python3
"""
WB OpenAPI Documentation Parser

Парсит официальную документацию Wildberries API через Firecrawl MCP
и сохраняет в Markdown формате для LLM в docs/api-reference/wildberries/

Usage:
    python3 scripts/parse_wb_openapi.py --all              # Все категории
    python3 scripts/parse_wb_openapi.py --category content # Одна категория
    python3 scripts/parse_wb_openapi.py --list             # Список категорий
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

# Категории API и их документация (из mcp/wb-mcp/src/utils/auth.ts)
WB_API_CATEGORIES = {
    "content": {
        "name": "Content",
        "base_url": "https://content-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/work-with-products",
        "rate_limits": "60 req/60s, interval 1000ms, burst 5",
        "description": "Управление товарами, категории, характеристики, медиафайлы, теги, цены и скидки, остатки",
    },
    "common": {
        "name": "General (Common)",
        "base_url": "https://common-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/api-information",
        "rate_limits": "Varies by endpoint",
        "description": "Общая информация об API, авторизация, проверка подключения, новости, информация о продавце",
    },
    "marketplace": {
        "name": "Marketplace (FBS Orders)",
        "base_url": "https://marketplace-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/orders-fbs",
        "rate_limits": "300 req/60s, interval 200ms, burst 20",
        "description": "Управление заказами FBS (Fulfillment by Seller)",
    },
    "orders-dbs": {
        "name": "Orders DBS (Delivery by Seller)",
        "base_url": "https://marketplace-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/orders-dbs",
        "rate_limits": "300 req/60s, interval 200ms, burst 20",
        "description": "Управление заказами DBS - продавец доставляет заказы покупателям",
    },
    "orders-dbw": {
        "name": "Orders DBW (Delivery by WB Courier)",
        "base_url": "https://marketplace-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/orders-dbw",
        "rate_limits": "300 req/60s, interval 200ms, burst 20",
        "description": "Управление заказами DBW - доставка курьером Wildberries",
    },
    "in-store-pickup": {
        "name": "In-Store Pickup",
        "base_url": "https://marketplace-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/in-store-pickup",
        "rate_limits": "300 req/60s, interval 200ms, burst 20",
        "description": "Управление заказами самовывоза",
    },
    "supplies": {
        "name": "Supplies (FBW)",
        "base_url": "https://supplies-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/orders-fbw",
        "rate_limits": "30 req/60s, interval 2s, burst 10",
        "description": "Управление поставками FBW (Fulfillment by Wildberries) на склады WB",
    },
    "advert": {
        "name": "Promotion (Advert)",
        "base_url": "https://advert-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/promotion",
        "rate_limits": "300 req/60s, interval 200ms, burst 10",
        "description": "Управление рекламными кампаниями на Wildberries",
    },
    "feedbacks": {
        "name": "Feedbacks (Reviews & Q&A)",
        "base_url": "https://feedbacks-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/user-communication",
        "rate_limits": "300 req/60s, interval 200ms, burst 10",
        "description": "Управление отзывами, вопросами, чатом с покупателями и возвратами",
    },
    "analytics": {
        "name": "Analytics",
        "base_url": "https://seller-analytics-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/analytics",
        "rate_limits": "60 req/60s, interval 1000ms, burst 5",
        "description": "Аналитика продаж, воронки, поисковые запросы, остатки (⚠️ требует подписку 'Джем')",
    },
    "reports": {
        "name": "Reports",
        "base_url": "https://statistics-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/reports",
        "rate_limits": "60 req/60s, interval 1000ms, burst 5",
        "description": "Отчёты по продажам, остаткам, маркировке, хранению, регионам",
    },
    "documents": {
        "name": "Documents (Financial Reports)",
        "base_url": "https://documents-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/financial-reports-and-accounting",
        "rate_limits": "Varies by endpoint",
        "description": "Финансовые отчёты, баланс, документы, акты",
    },
    "tariffs": {
        "name": "Tariffs",
        "base_url": "https://common-api.wildberries.ru",
        "doc_url": "https://dev.wildberries.ru/openapi/wb-tariffs",
        "rate_limits": "Varies by endpoint (1-60 req/60s)",
        "description": "Тарифы WB: комиссии, хранение, доставка, возвраты",
    },
}


class WBOpenAPIParser:
    """Parser for Wildberries OpenAPI documentation"""

    def __init__(self, output_dir: str = "docs/api-reference/wildberries"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def create_markdown_header(self, category_key: str, category_info: Dict) -> str:
        """Create standard markdown header for category documentation"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        header = f"""# {category_info['name']} API

> **Base URL:** `{category_info['base_url']}`
> **Rate Limits:** {category_info['rate_limits']}
> **Документация:** {category_info['doc_url']}
> **Сгенерировано:** {timestamp}

## Описание

{category_info['description']}

---

"""
        return header

    def create_main_readme(self) -> None:
        """Create main README.md index of all categories"""
        timestamp = datetime.now().strftime("%Y-%m-%d")

        readme_content = f"""# Wildberries API Reference

> **Официальная документация:** https://dev.wildberries.ru
> **Последнее обновление:** {timestamp}
> **Всего категорий:** {len(WB_API_CATEGORIES)}

## Описание

Полная документация Wildberries API в LLM-friendly формате. Все эндпоинты, параметры запросов, ответы и примеры использования.

---

## Категории API

"""

        for i, (key, info) in enumerate(WB_API_CATEGORIES.items(), 1):
            readme_content += f"""### {i}. {info['name']}

**Файл:** [`{key}.md`](./{key}.md)
**Base URL:** `{info['base_url']}`
**Документация:** {info['doc_url']}

{info['description']}

---

"""

        readme_content += """
## Авторизация

Все запросы требуют токен в заголовке `Authorization`.

**Создание токена:** https://seller.wildberries.ru/api-integrations

---

## Дополнительные ресурсы

- **Официальная документация:** https://dev.wildberries.ru
- **Release Notes:** https://dev.wildberries.ru/release-notes
- **Telegram канал:** https://t.me/wb_api_notifications

---

**Дата генерации:** """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """
**Генератор:** Firecrawl MCP + Claude Code
"""

        readme_file = self.output_dir / "README.md"
        readme_file.write_text(readme_content, encoding="utf-8")
        print(f"✅ Created main README: {readme_file}")

    def list_categories(self) -> None:
        """List all available categories"""
        print("\n📋 Available WB API Categories:\n")
        for key, info in WB_API_CATEGORIES.items():
            print(f"  {key:20} - {info['name']}")
            print(f"  {'':20}   {info['doc_url']}")
            print()


def main():
    parser = argparse.ArgumentParser(
        description="Parse Wildberries OpenAPI documentation via Firecrawl MCP"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available categories",
    )
    parser.add_argument(
        "--create-readme",
        action="store_true",
        help="Create/update main README.md index",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="docs/api-reference/wildberries",
        help="Output directory (default: docs/api-reference/wildberries)",
    )

    args = parser.parse_args()
    wb_parser = WBOpenAPIParser(output_dir=args.output)

    if args.list:
        wb_parser.list_categories()
        return

    if args.create_readme:
        wb_parser.create_main_readme()
        return

    parser.print_help()
    print("\n💡 Note: Actual scraping must be done via Claude Code MCP")
    print("   Use Firecrawl MCP tools in Claude Code to scrape each category")


if __name__ == "__main__":
    main()
