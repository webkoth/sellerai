#!/usr/bin/env python3
"""
Собирает payload для импорта товаров WB → Яндекс.Маркет из data/wb_products_in_stock.json.

Выходные файлы (dry-run, НЕ отправляют в YM — только готовят данные):
  - data/ym_import/products.json   — для ym_update_products
  - data/ym_import/prices.json     — для ym_update_prices
  - data/ym_import/stocks.json     — для ym_update_stocks
  - data/ym_import/skipped.json    — карточки, которые не удалось смапить

Особенности:
  - offerId = баркод (уникален для каждого размера, см. SKILL.md)
  - Один nmID с несколькими размерами превращается в несколько offerId
  - Описание обрезается до 2000 символов (лимит YM)
  - Фото — до 10 штук
  - manufacturerCountries — из характеристики «Страна производства», иначе ["Россия"]
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IN_FILE = ROOT / "data" / "wb_products_in_stock.json"
OUT_DIR = ROOT / "data" / "ym_import"
DESCRIPTION_LIMIT = 2000
MAX_PICTURES = 10


def extract_country(characteristics):
    for ch in characteristics or []:
        name = (ch.get("name") or "").lower()
        if "страна" in name and "производ" in name:
            v = ch.get("value")
            if isinstance(v, list) and v:
                return [str(x) for x in v]
            if isinstance(v, str):
                return [v]
    return ["Россия"]


def extract_dimensions(dims):
    if not dims:
        return None
    length = dims.get("length")
    width = dims.get("width")
    height = dims.get("height")
    weight = dims.get("weightBrutto") or dims.get("weight")
    if not all([length, width, height, weight]):
        return None
    return {
        "length": float(length),
        "width": float(width),
        "height": float(height),
        "weight": float(weight),
    }


def main():
    data = json.loads(IN_FILE.read_text())
    products_in = data["products"]

    products_out = []
    prices_out = []
    stocks_out = []
    skipped = []

    for p in products_in:
        ym_cat = (p.get("targetCategories") or {}).get("yandexMarket")
        if not ym_cat:
            skipped.append({
                "nmId": p["nmId"],
                "vendorCode": p["vendorCode"],
                "title": p["title"],
                "subjectName": p["subjectName"],
                "reason": "no YM category mapping (см. WB_TO_YM_CATEGORY)",
            })
            continue

        dims = extract_dimensions(p.get("dimensions"))
        countries = extract_country(p.get("characteristics"))
        pictures = (p.get("photos") or [])[:MAX_PICTURES]
        description = (p.get("description") or "")[:DESCRIPTION_LIMIT]

        for size in p.get("sizes", []):
            barcode = size["barcode"]
            if not barcode or size.get("stock", 0) <= 0:
                continue

            product_payload = {
                "offerId": barcode,
                "name": p["title"],
                "description": description,
                "vendor": p["brand"],
                "manufacturer": p["brand"],
                "vendorCode": p["vendorCode"],
                "barcodes": [barcode],
                "pictures": pictures,
                "manufacturerCountries": countries,
                "marketCategoryId": ym_cat["id"],
            }
            if dims:
                product_payload["weightDimensions"] = dims
            products_out.append(product_payload)

            # Цена — до скидки (база), со скидкой — через oldPrice
            base_price = p.get("price")
            final_price = p.get("discountedPrice") or base_price
            price_payload = {
                "offerId": barcode,
                "price": final_price,
            }
            if base_price and base_price > final_price:
                price_payload["discountBase"] = base_price
            prices_out.append(price_payload)

            stocks_out.append({
                "sku": barcode,
                "warehouseId": 1872191,  # Склад Краснодар
                "count": int(size["stock"]),
            })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "products.json").write_text(json.dumps(products_out, ensure_ascii=False, indent=2))
    (OUT_DIR / "prices.json").write_text(json.dumps(prices_out, ensure_ascii=False, indent=2))
    (OUT_DIR / "stocks.json").write_text(json.dumps(stocks_out, ensure_ascii=False, indent=2))
    (OUT_DIR / "skipped.json").write_text(json.dumps(skipped, ensure_ascii=False, indent=2))

    print(f"Готов payload для YM:")
    print(f"  products: {len(products_out)}")
    print(f"  prices:   {len(prices_out)}")
    print(f"  stocks:   {len(stocks_out)}")
    print(f"  skipped:  {len(skipped)}")
    if skipped:
        print()
        for s in skipped:
            print(f"   ⏭  {s['nmId']} / {s['subjectName']}: {s['title'][:60]}")

    # Контроль по категориям
    from collections import Counter
    by_cat = Counter((o["marketCategoryId"]) for o in products_out)
    print()
    print("Распределение по категориям YM:")
    for cat_id, cnt in by_cat.most_common():
        print(f"  {cat_id}: {cnt} офферов")


if __name__ == "__main__":
    main()
