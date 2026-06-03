#!/usr/bin/env python3
"""
Экспорт всех товаров Wildberries с положительным остатком на FBS
в единый JSON-файл для импорта карточек на Ozon и Яндекс.Маркет.

В файл попадают ТОЛЬКО карточки с totalStock > 0.

Источники:
  - Content API:     карточки, характеристики, фото, размеры, габариты
  - Prices API:      цены и скидки
  - Marketplace API: остатки на FBS-складах

Обогащение для миграции:
  - meta:            флаги полноты карточки + readyToImport
  - mapping:         подсказка категории Ozon и Яндекс.Маркет по subjectName

Итог: data/wb_products_in_stock.json
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "wb_products_in_stock.json"

# Подсказки для маппинга категории на Ozon и Яндекс.Маркет.
# Продавец работает в сегменте БИЖУТЕРИИ — «ювелирные» категории исключены,
# т.к. требуют сертификата пробирной палаты.
# YM categoryId — из data/commissions/ym_commissions.json.
# Ozon — пока null: справочник Ozon ещё не выгружен.
WB_TO_YM_CATEGORY = {
    "Подвески бижутерные": {"id": 68749551, "name": "Подвески"},
    "Браслеты":            {"id": 67678046, "name": "Браслеты"},
    "Кольца":              {"id": 69264438, "name": "Кольца бижутерные"},
    "Шармы-подвески":      {"id": 68749551, "name": "Подвески"},
    "Обереги":             {"id": 64277833, "name": "Подвески декоративные"},
    "Природные материалы для творчества": {"id": 62920723, "name": "Минералы интерьерные"},
    "Часы наручные":       {"id": 91259,    "name": "Наручные часы"},
}

WB_TO_OZON_CATEGORY: dict = {}  # TODO: заполнить после ozon_get_categories


def load_env():
    env_path = ROOT / ".env"
    if not env_path.exists():
        sys.exit(f".env не найден: {env_path}")
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def fetch(url, body=None, method="GET"):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": os.environ["WB_API_TOKEN"],
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def get_all_cards():
    cards = []
    cursor = {"limit": 100}
    while True:
        body = {"settings": {"cursor": cursor, "filter": {"withPhoto": -1}}}
        d = fetch(
            "https://content-api.wildberries.ru/content/v2/get/cards/list",
            body,
            "POST",
        )
        page = d.get("cards", [])
        if not page:
            break
        cards.extend(page)
        if len(page) < 100:
            break
        cursor = {
            "limit": 100,
            "updatedAt": d["cursor"]["updatedAt"],
            "nmID": d["cursor"]["nmID"],
        }
    return cards


def get_prices():
    prices = {}
    offset = 0
    while True:
        url = (
            "https://discounts-prices-api.wildberries.ru"
            f"/api/v2/list/goods/filter?limit=1000&offset={offset}"
        )
        d = fetch(url)
        goods = d.get("data", {}).get("listGoods", [])
        if not goods:
            break
        for g in goods:
            size = (g.get("sizes") or [{}])[0]
            prices[g["nmID"]] = {
                "price": size.get("price", 0),
                "discountedPrice": size.get("discountedPrice", 0),
                "discount": g.get("discount", 0),
            }
        if len(goods) < 1000:
            break
        offset += 1000
    return prices


def get_warehouses():
    return fetch("https://marketplace-api.wildberries.ru/api/v3/warehouses")


def enrich_for_migration(product):
    """Добавляет в карточку поля, полезные для импорта: mapping и readyToImport."""
    subject = product.get("subjectName")
    ym_cat = WB_TO_YM_CATEGORY.get(subject)
    ozon_cat = WB_TO_OZON_CATEGORY.get(subject)

    dims = product.get("dimensions") or {}
    has_dims = all(dims.get(k) for k in ("length", "width", "height"))
    has_weight = bool(dims.get("weightBrutto") or dims.get("weight"))
    has_barcode = any(sz.get("barcode") for sz in product.get("sizes", []))

    missing = []
    if not product.get("title"):            missing.append("title")
    if not product.get("description"):      missing.append("description")
    if not product.get("photos"):           missing.append("photos")
    if not has_dims:                        missing.append("dimensions")
    if not has_weight:                      missing.append("weight")
    if not has_barcode:                     missing.append("barcode")
    if not product.get("discountedPrice"):  missing.append("price")

    product["targetCategories"] = {
        "yandexMarket": ym_cat,
        "ozon": ozon_cat,
    }
    product["meta"]["readyToImport"] = not missing
    product["meta"]["missingFields"] = missing


def get_fbs_stocks(warehouse_id, barcodes):
    """POST /api/v3/stocks/{warehouseId} — batches of 1000 barcodes."""
    result = {}
    for i in range(0, len(barcodes), 1000):
        batch = barcodes[i : i + 1000]
        d = fetch(
            f"https://marketplace-api.wildberries.ru/api/v3/stocks/{warehouse_id}",
            {"skus": batch},
            "POST",
        )
        for s in d.get("stocks", []):
            result[s["sku"]] = s.get("amount", 0)
    return result


def main():
    load_env()
    print("Получаем карточки...", flush=True)
    cards = get_all_cards()
    print(f"  карточек: {len(cards)}", flush=True)

    print("Получаем цены...", flush=True)
    prices = get_prices()

    print("Получаем список FBS-складов...", flush=True)
    warehouses = get_warehouses()
    print(f"  складов: {len(warehouses)}", flush=True)

    # Собираем все баркоды
    barcode_to_card = {}
    barcode_to_size = {}
    for c in cards:
        for sz in c.get("sizes", []):
            for sku in sz.get("skus", []):
                barcode_to_card[sku] = c
                barcode_to_size[sku] = {
                    "techSize": sz.get("techSize"),
                    "wbSize": sz.get("wbSize"),
                    "chrtID": sz.get("chrtID"),
                }
    all_barcodes = list(barcode_to_card.keys())
    print(f"  баркодов всего: {len(all_barcodes)}", flush=True)

    # Суммируем остатки по всем складам FBS
    print("Получаем остатки на FBS...", flush=True)
    stock_by_barcode_warehouse = {}  # barcode -> {warehouse_id: amount}
    for w in warehouses:
        stocks = get_fbs_stocks(w["id"], all_barcodes)
        for bc, amt in stocks.items():
            if amt <= 0:
                continue
            stock_by_barcode_warehouse.setdefault(bc, {})[w["id"]] = amt

    # Агрегируем по карточкам (nmID)
    products_map = {}
    for bc, per_warehouse in stock_by_barcode_warehouse.items():
        card = barcode_to_card[bc]
        nm = card["nmID"]
        total_qty = sum(per_warehouse.values())
        photos_raw = card.get("photos", []) or []
        entry = products_map.setdefault(
            nm,
            {
                "nmId": nm,
                "vendorCode": card.get("vendorCode"),
                "title": card.get("title"),
                "description": card.get("description"),
                "brand": card.get("brand"),
                "subjectName": card.get("subjectName"),
                "subjectID": card.get("subjectID"),
                "dimensions": card.get("dimensions"),
                "characteristics": [
                    {"id": ch.get("id"), "name": ch.get("name"), "value": ch.get("value")}
                    for ch in card.get("characteristics", [])
                ],
                "photos": [
                    p.get("big") or p.get("c516x688") or p.get("square")
                    for p in photos_raw
                ],
                "videoUrl": card.get("video"),
                "sizes": [],
                "totalStock": 0,
                "warehouses": {},
                "price": prices.get(nm, {}).get("price"),
                "discountedPrice": prices.get(nm, {}).get("discountedPrice"),
                "discount": prices.get(nm, {}).get("discount"),
                "meta": {
                    "createdAt": card.get("createdAt"),
                    "updatedAt": card.get("updatedAt"),
                    "hasPhoto": bool(photos_raw),
                    "hasVideo": bool(card.get("video")),
                    "hasDescription": bool(card.get("description")),
                    "descriptionLength": len(card.get("description") or ""),
                    "photosCount": len(photos_raw),
                    "characteristicsCount": len(card.get("characteristics", []) or []),
                },
            },
        )
        # Аккумулируем по размерам (для одежды/обуви, у артефактов обычно один размер)
        size_info = barcode_to_size[bc]
        entry["sizes"].append(
            {
                "barcode": bc,
                "techSize": size_info["techSize"],
                "wbSize": size_info["wbSize"],
                "chrtID": size_info["chrtID"],
                "stock": total_qty,
                "perWarehouse": per_warehouse,
            }
        )
        entry["totalStock"] += total_qty
        for wh_id, amt in per_warehouse.items():
            entry["warehouses"][wh_id] = entry["warehouses"].get(wh_id, 0) + amt

    # === Обогащение для миграции: маппинг категорий + флаги полноты карточки ===
    print("Готовим данные для миграции...", flush=True)
    for p in products_map.values():
        enrich_for_migration(p)

    # Сортируем: готовые к импорту вперёд, затем по остатку, затем по цене
    products = sorted(
        products_map.values(),
        key=lambda p: (
            not p["meta"]["readyToImport"],
            -p["totalStock"],
            -(p.get("discountedPrice") or 0),
        ),
    )

    warehouses_info = {
        w["id"]: {
            "id": w["id"],
            "name": w["name"],
            "officeId": w.get("officeId"),
            "cargoType": w.get("cargoType"),
            "deliveryType": w.get("deliveryType"),
        }
        for w in warehouses
    }

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "wildberries",
        "mode": "fbs",
        "warehouses": warehouses_info,
        "summary": {
            "totalCards": len(cards),
            "totalBarcodes": len(all_barcodes),
            "productsInStock": len(products),
            "totalUnits": sum(p["totalStock"] for p in products),
            "totalValue": round(
                sum(p["totalStock"] * (p.get("discountedPrice") or 0) for p in products),
                2,
            ),
            "readyToImport": sum(1 for p in products if p["meta"]["readyToImport"]),
            "missingData": sum(1 for p in products if not p["meta"]["readyToImport"]),
        },
        "referenceData": {
            "wbToYmCategoryMap": WB_TO_YM_CATEGORY,
            "wbToOzonCategoryMap": WB_TO_OZON_CATEGORY,
            "notes": [
                "Маппинг categoryName — подсказка для skill-импорта; проверьте при первом запуске.",
                "Сегмент — БИЖУТЕРИЯ, ювелирные категории YM исключены (нужен сертификат).",
                "Ozon-маппинг пустой: нужно выгрузить дерево категорий Ozon и заполнить.",
            ],
        },
        "products": products,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    s = out["summary"]
    print()
    print(f"✅ Сохранено: {OUT_FILE.relative_to(ROOT)}")
    print(f"   Карточек с остатком: {s['productsInStock']}")
    print(f"   Единиц товара:       {s['totalUnits']}")
    print(f"   Стоимость остатков:  {s['totalValue']:,.2f} ₽".replace(",", " "))


if __name__ == "__main__":
    main()
