#!/usr/bin/env python3
"""
Wildberries Inventory Stock Script

Получает список товаров продавца с Wildberries API
и выводит в формате Markdown-таблицы.

Режимы работы:
1. --all: Все товары с ценами (независимо от остатков)
2. --fbo: Только товары с остатками на складах WB (FBO модель)
3. --fbs: Остатки на складах продавца (FBS модель) - требует ID склада

API endpoints:
- Content API: список карточек товаров
- Prices API: цены и скидки
- Statistics API: остатки на складах WB (FBO)
- Marketplace API: остатки на складах продавца (FBS)

Требуемые категории токена:
- Контент (для карточек товаров)
- Цены и скидки (для цен)
- Статистика (для остатков FBO)
- Маркетплейс (для остатков FBS)
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from pathlib import Path


# API Base URLs
CONTENT_API = "https://content-api.wildberries.ru"
STATISTICS_API = "https://statistics-api.wildberries.ru"
PRICES_API = "https://discounts-prices-api.wildberries.ru"
MARKETPLACE_API = "https://marketplace-api.wildberries.ru"


def load_dotenv(env_path: Optional[Path] = None) -> None:
    """Load environment variables from .env file."""
    search_paths = []
    
    if env_path:
        search_paths.append(env_path)
    
    # Search in current dir and parent dirs up to 3 levels
    current = Path.cwd()
    for _ in range(4):
        search_paths.append(current / ".env")
        if current.parent == current:
            break
        current = current.parent
    
    for path in search_paths:
        if path.exists():
            with open(path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = value
            return


def get_api_token() -> str:
    """Get API token from environment variable or config file."""
    # First try to load from .env
    load_dotenv()
    
    token = os.environ.get("WB_API_TOKEN")
    if token:
        return token
    
    config_paths = [
        Path.cwd() / ".wb_token",
        Path.home() / ".wb_token",
        Path.home() / ".config" / "wb" / "token",
    ]
    
    for path in config_paths:
        if path.exists():
            return path.read_text().strip()
    
    raise ValueError(
        "API token not found. Options:\n"
        "  1. Create .env file with WB_API_TOKEN=your_token\n"
        "  2. Set WB_API_TOKEN environment variable\n"
        "  3. Create ~/.wb_token file with your token"
    )


def api_request(url: str, token: str, method: str = "GET", data: Optional[dict] = None) -> dict:
    """Make API request to Wildberries."""
    headers = {
        "Authorization": token,
        "Content-Type": "application/json",
    }
    
    req = Request(url, headers=headers, method=method)
    
    if data:
        req.data = json.dumps(data).encode("utf-8")
    
    try:
        with urlopen(req, timeout=60) as response:
            if response.status == 204:
                return {}
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"API Error {e.code}: {e.reason}\n{error_body}")
    except URLError as e:
        raise RuntimeError(f"Connection error: {e.reason}")


def get_cards(token: str, limit: int = 100) -> list[dict]:
    """
    Get all product cards using Content API.
    
    Endpoint: POST /content/v2/get/cards/list
    Returns all product cards with pagination.
    """
    url = f"{CONTENT_API}/content/v2/get/cards/list"
    all_cards = []
    
    cursor = {"limit": limit}
    
    while True:
        payload = {
            "settings": {
                "cursor": cursor,
                "filter": {"withPhoto": -1}  # All cards
            }
        }
        
        result = api_request(url, token, method="POST", data=payload)
        
        if not result:
            break
        
        cards = result.get("cards", [])
        if not cards:
            break
        
        all_cards.extend(cards)
        
        # Check pagination
        cursor_resp = result.get("cursor", {})
        total = cursor_resp.get("total", 0)
        
        if total < limit:
            break
        
        # Update cursor for next page
        cursor = {
            "limit": limit,
            "updatedAt": cursor_resp.get("updatedAt"),
            "nmID": cursor_resp.get("nmID")
        }
    
    return all_cards


def get_stocks_fbo(token: str) -> list[dict]:
    """
    Get all stocks from WB warehouses (FBO model).
    
    Endpoint: GET /api/v1/supplier/stocks
    Returns stocks on Wildberries warehouses.
    
    Note: This only returns items physically stored at WB warehouses.
    If you use FBS model (seller's warehouse), use get_stocks_fbs instead.
    """
    date_from = "2019-01-01"
    url = f"{STATISTICS_API}/api/v1/supplier/stocks?dateFrom={date_from}"
    
    all_stocks = []
    
    while True:
        result = api_request(url, token)
        
        if not result:
            break
            
        all_stocks.extend(result)
        
        # Check if we need pagination
        if len(result) >= 60000 and result:
            last_date = result[-1].get("lastChangeDate", "")
            if last_date:
                url = f"{STATISTICS_API}/api/v1/supplier/stocks?dateFrom={last_date}"
            else:
                break
        else:
            break
    
    return all_stocks


def get_seller_warehouses(token: str) -> list[dict]:
    """
    Get list of seller's warehouses (for FBS model).
    
    Endpoint: GET /api/v3/warehouses
    """
    url = f"{MARKETPLACE_API}/api/v3/warehouses"
    result = api_request(url, token)
    return result if isinstance(result, list) else []


def get_stocks_fbs(token: str, warehouse_id: int, skus: list[str]) -> list[dict]:
    """
    Get stocks from seller's warehouse (FBS model).
    
    Endpoint: POST /api/v3/stocks/{warehouseId}
    """
    url = f"{MARKETPLACE_API}/api/v3/stocks/{warehouse_id}"
    
    # API accepts max 1000 SKUs per request
    all_stocks = []
    batch_size = 1000
    
    for i in range(0, len(skus), batch_size):
        batch = skus[i:i + batch_size]
        payload = {"skus": batch}
        
        result = api_request(url, token, method="POST", data=payload)
        stocks = result.get("stocks", [])
        all_stocks.extend(stocks)
    
    return all_stocks


def get_prices(token: str, limit: int = 1000) -> list[dict]:
    """
    Get prices and discounts for all products.
    
    Endpoint: GET /api/v2/list/goods/filter
    Returns prices with pagination.
    """
    all_goods = []
    offset = 0
    
    while True:
        url = f"{PRICES_API}/api/v2/list/goods/filter?limit={limit}&offset={offset}"
        result = api_request(url, token)
        
        if not result:
            break
            
        goods = result.get("data", {}).get("listGoods", [])
        if not goods:
            break
            
        all_goods.extend(goods)
        
        if len(goods) < limit:
            break
            
        offset += limit
    
    return all_goods


def merge_data(prices: list[dict], stocks: list[dict] = None, min_quantity: int = 0) -> list[dict]:
    """
    Merge price data with stock data by nmId.
    
    Args:
        prices: List of products with prices from Prices API
        stocks: Optional list of stocks from Statistics API (FBO)
        min_quantity: Minimum quantity filter (0 = show all)
    
    Returns:
        List of merged product data
    """
    # Create stock lookup by nmId (aggregate by nmId)
    stock_map = {}
    if stocks:
        for item in stocks:
            nm_id = item.get("nmId")
            if not nm_id:
                continue
            
            if nm_id not in stock_map:
                stock_map[nm_id] = {
                    "quantity": 0,
                    "inWayToClient": 0,
                    "inWayFromClient": 0,
                    "warehouses": set(),
                    "supplierArticle": item.get("supplierArticle", ""),
                    "subject": item.get("subject", ""),
                    "brand": item.get("brand", ""),
                }
            
            stock_map[nm_id]["quantity"] += item.get("quantity", 0)
            stock_map[nm_id]["inWayToClient"] += item.get("inWayToClient", 0)
            stock_map[nm_id]["inWayFromClient"] += item.get("inWayFromClient", 0)
            
            warehouse = item.get("warehouseName", "")
            if warehouse:
                stock_map[nm_id]["warehouses"].add(warehouse)
    
    # Build result from prices (main source)
    result = []
    for item in prices:
        nm_id = item.get("nmID")
        if not nm_id:
            continue
        
        # Get price info from sizes array
        sizes = item.get("sizes", [])
        first_size = sizes[0] if sizes else {}
        
        price = first_size.get("price", 0)
        discounted_price = first_size.get("discountedPrice", 0)
        discount = item.get("discount", 0)
        
        # Get stock info if available
        stock_data = stock_map.get(nm_id, {})
        quantity = stock_data.get("quantity", 0)
        
        # Apply quantity filter
        if min_quantity > 0 and quantity < min_quantity:
            continue
        
        result.append({
            "nmId": nm_id,
            "article": item.get("vendorCode", stock_data.get("supplierArticle", "")),
            "name": stock_data.get("subject", f"Товар {nm_id}"),
            "brand": stock_data.get("brand", ""),
            "quantity": quantity,
            "inWayToClient": stock_data.get("inWayToClient", 0),
            "inWayFromClient": stock_data.get("inWayFromClient", 0),
            "warehouses": ", ".join(sorted(stock_data.get("warehouses", set()))),
            "price": price,
            "discountedPrice": discounted_price,
            "discount": discount,
            "hasStock": quantity > 0,
        })
    
    # Sort: first by hasStock (in stock first), then by quantity descending
    result.sort(key=lambda x: (-x["hasStock"], -x["quantity"]))
    
    return result


def format_markdown_table(items: list[dict], show_warehouses: bool = False, mode: str = "all") -> str:
    """Format items as Markdown table."""
    if not items:
        return "Товары не найдены."
    
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    
    # Count items with stock
    items_with_stock = sum(1 for i in items if i["quantity"] > 0)
    
    if mode == "fbo":
        title = "Товары на складах Wildberries (FBO)"
    elif mode == "all":
        title = "Все товары продавца"
    else:
        title = "Товары Wildberries"
    
    lines = [
        f"# {title}",
        f"",
        f"*Обновлено: {timestamp}*",
        f"",
        f"Всего товаров: **{len(items)}**",
    ]
    
    if mode == "all":
        lines.append(f"Товаров с остатками на складах WB: **{items_with_stock}**")
    
    lines.append("")
    
    # Table header
    if show_warehouses:
        lines.append("| Название | Артикул | Кол-во | Цена | Цена со скидкой | Скидка | Склады |")
        lines.append("|----------|---------|-------:|-----:|----------------:|-------:|--------|")
    else:
        lines.append("| Название | Артикул | Кол-во | Цена | Цена со скидкой | Скидка |")
        lines.append("|----------|---------|-------:|-----:|----------------:|-------:|")
    
    # Table rows
    for item in items:
        name = item["name"][:40] + "..." if len(item["name"]) > 40 else item["name"]
        if not name or name == f"Товар {item['nmId']}":
            name = f"nmId: {item['nmId']}"
        article = item["article"][:15] if item["article"] else str(item["nmId"])
        quantity = item["quantity"] if item["quantity"] > 0 else "-"
        price = f"{item['price']:,.0f}₽" if item['price'] else "-"
        discounted = f"{item['discountedPrice']:,.0f}₽" if item['discountedPrice'] else "-"
        discount = f"{item['discount']}%" if item['discount'] else "-"
        
        if show_warehouses:
            warehouses = item["warehouses"][:30] + "..." if len(item["warehouses"]) > 30 else item["warehouses"]
            if not warehouses:
                warehouses = "-"
            lines.append(f"| {name} | {article} | {quantity} | {price} | {discounted} | {discount} | {warehouses} |")
        else:
            lines.append(f"| {name} | {article} | {quantity} | {price} | {discounted} | {discount} |")
    
    # Summary
    total_quantity = sum(item["quantity"] for item in items)
    total_value = sum(item["discountedPrice"] * item["quantity"] for item in items if item["discountedPrice"] and item["quantity"])
    
    lines.extend([
        "",
        "---",
        "",
        f"**Итого единиц товара на складах:** {total_quantity:,}",
        f"**Общая стоимость товаров на складах:** {total_value:,.0f}₽",
    ])
    
    return "\n".join(lines)


def format_json(items: list[dict]) -> str:
    """Format items as JSON."""
    return json.dumps(items, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Get Wildberries inventory with prices",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  %(prog)s --all              # Все товары с ценами
  %(prog)s --fbo              # Только товары на складах WB (с остатками)
  %(prog)s --fbo -q 5         # Товары на складах WB с остатком >= 5
  %(prog)s --all -w           # Все товары + показать склады
  %(prog)s --all -f json      # Вывод в формате JSON
        """
    )
    
    # Mode selection
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--all", "-a",
        action="store_true",
        default=True,
        help="Показать все товары с ценами (по умолчанию)"
    )
    mode_group.add_argument(
        "--fbo",
        action="store_true",
        help="Только товары с остатками на складах WB (FBO модель)"
    )
    
    parser.add_argument(
        "--format", "-f",
        choices=["markdown", "json"],
        default="markdown",
        help="Формат вывода (default: markdown)"
    )
    parser.add_argument(
        "--warehouses", "-w",
        action="store_true",
        help="Показать названия складов"
    )
    parser.add_argument(
        "--min-quantity", "-q",
        type=int,
        default=0,
        help="Минимальное количество для фильтра (default: 0)"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        help="Путь к файлу для вывода (default: stdout)"
    )
    
    args = parser.parse_args()
    
    # If --fbo is set, default min_quantity to 1 if not specified
    if args.fbo and args.min_quantity == 0:
        args.min_quantity = 1
    
    try:
        token = get_api_token()
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Fetch prices (always needed)
    print("Загрузка цен из WB API...", file=sys.stderr)
    try:
        prices = get_prices(token)
        print(f"  Получено товаров с ценами: {len(prices)}", file=sys.stderr)
    except RuntimeError as e:
        print(f"Ошибка получения цен: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Fetch stocks from WB warehouses (FBO)
    print("Загрузка остатков со складов WB (FBO)...", file=sys.stderr)
    stocks = []
    try:
        stocks = get_stocks_fbo(token)
        print(f"  Получено записей об остатках: {len(stocks)}", file=sys.stderr)
        
        # Count actual items with stock
        stock_count = {}
        for s in stocks:
            nm_id = s.get("nmId")
            if nm_id:
                stock_count[nm_id] = stock_count.get(nm_id, 0) + s.get("quantity", 0)
        items_with_stock = sum(1 for q in stock_count.values() if q > 0)
        print(f"  Товаров с остатком > 0: {items_with_stock}", file=sys.stderr)
        
    except RuntimeError as e:
        print(f"Предупреждение: не удалось получить остатки: {e}", file=sys.stderr)
        if args.fbo:
            print("Режим --fbo требует доступа к остаткам. Проверьте права токена.", file=sys.stderr)
            sys.exit(1)
    
    # Merge data
    print("Объединение данных...", file=sys.stderr)
    items = merge_data(prices, stocks, min_quantity=args.min_quantity)
    print(f"  Итого товаров в результате: {len(items)}", file=sys.stderr)
    
    # Determine mode for output formatting
    mode = "fbo" if args.fbo else "all"
    
    # Format output
    if args.format == "json":
        output = format_json(items)
    else:
        output = format_markdown_table(items, show_warehouses=args.warehouses, mode=mode)
    
    # Write output
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Результат записан в {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()