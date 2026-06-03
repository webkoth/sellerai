#!/usr/bin/env python3
"""
Зеркальный аналог export_ym_products_for_migration.py — для Ozon.

Выгружает все товары Ozon-магазина в data/ozon_products_in_stock.json.

Источники (Ozon Seller API):
  - POST /v3/product/list                — список product_id + offer_id
  - POST /v3/product/info/list           — детальная информация батчем
  - POST /v4/product/info/attributes     — атрибуты + категория + описание
  - POST /v5/product/info/prices         — цены и комиссии
  - POST /v4/product/info/stocks         — остатки FBO/FBS

В файл попадают ВСЕ товары (для полной диагностики), с разделением:
  - withStock / withoutStock
  - hasName / namelessZombies (карточки без имени — обычно битые)
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "ozon_products_in_stock.json"
API_BASE = "https://api-seller.ozon.ru"


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def fetch(path, body, max_retries=4):
    req = urllib.request.Request(
        API_BASE + path,
        data=json.dumps(body).encode(),
        headers={
            "Client-Id": os.environ["OZON_CLIENT_ID"],
            "Api-Key": os.environ["OZON_API_TOKEN"],
            "Content-Type": "application/json",
        },
        method="POST",
    )
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req) as r:
                txt = r.read()
                return json.loads(txt) if txt else {}
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                wait = 5 * (attempt + 1)
                print(f"  429 — ждём {wait}с", flush=True)
                time.sleep(wait)
                continue
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Ozon API {e.code} {path}: {err_body}") from e


def list_all_products():
    """POST /v3/product/list — все товары с пагинацией."""
    out = []
    last_id = ""
    while True:
        body = {"filter": {"visibility": "ALL"}, "limit": 1000, "last_id": last_id}
        d = fetch("/v3/product/list", body)
        result = d.get("result", {})
        items = result.get("items") or []
        out.extend(items)
        last_id = result.get("last_id") or ""
        if not last_id or not items:
            break
    return out


def info_batch(product_ids):
    """POST /v3/product/info/list — детали батчем до 1000."""
    out = []
    for i in range(0, len(product_ids), 1000):
        batch = product_ids[i : i + 1000]
        d = fetch("/v3/product/info/list", {"product_id": batch})
        out.extend(d.get("items") or [])
    return out


def attributes_batch(product_ids):
    """POST /v4/product/info/attributes — атрибуты + описание + категория."""
    out = []
    for i in range(0, len(product_ids), 100):
        batch = product_ids[i : i + 100]
        body = {
            "filter": {"product_id": [str(x) for x in batch], "visibility": "ALL"},
            "limit": 100,
            "sort_dir": "ASC",
        }
        d = fetch("/v4/product/info/attributes", body)
        out.extend(d.get("result") or [])
    return out


def prices_batch(product_ids):
    """POST /v5/product/info/prices."""
    out = []
    cursor = ""
    while True:
        body = {
            "filter": {"product_id": [str(x) for x in product_ids], "visibility": "ALL"},
            "limit": 1000,
            "cursor": cursor,
        }
        d = fetch("/v5/product/info/prices", body)
        items = d.get("items") or []
        out.extend(items)
        cursor = d.get("cursor") or ""
        if not cursor or not items:
            break
    return out


def stocks_batch(product_ids):
    """POST /v4/product/info/stocks."""
    out = []
    cursor = ""
    while True:
        body = {
            "filter": {"product_id": [str(x) for x in product_ids], "visibility": "ALL"},
            "limit": 1000,
            "cursor": cursor,
        }
        d = fetch("/v4/product/info/stocks", body)
        items = d.get("items") or []
        out.extend(items)
        cursor = d.get("cursor") or ""
        if not cursor or not items:
            break
    return out


def main():
    load_env()

    print("Получаем список товаров...", flush=True)
    items = list_all_products()
    print(f"  всего товаров в магазине: {len(items)}", flush=True)
    if not items:
        out = {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "ozon",
            "summary": {"total": 0, "withStock": 0, "withName": 0},
            "products": [],
        }
        OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2))
        print("✅ Магазин пуст. Сохранили заглушку.")
        return

    product_ids = [it["product_id"] for it in items]

    print("Получаем детальную инфу...", flush=True)
    infos = info_batch(product_ids)
    info_by_id = {i.get("id"): i for i in infos}

    print("Получаем атрибуты + категории...", flush=True)
    attrs = attributes_batch(product_ids)
    attr_by_id = {a.get("id"): a for a in attrs}

    print("Получаем цены...", flush=True)
    prices = prices_batch(product_ids)
    price_by_id = {p.get("product_id"): p for p in prices}

    print("Получаем остатки...", flush=True)
    stocks = stocks_batch(product_ids)
    stock_by_id = {s.get("product_id"): s for s in stocks}

    products = []
    with_stock = 0
    with_name = 0
    nameless = 0
    for it in items:
        pid = it["product_id"]
        info = info_by_id.get(pid, {}) or {}
        attr = attr_by_id.get(pid, {}) or {}
        price = price_by_id.get(pid, {}) or {}
        stock = stock_by_id.get(pid, {}) or {}

        # Остатки
        total_stock = 0
        stock_breakdown = []
        for s in stock.get("stocks", []) or []:
            present = int(s.get("present", 0) or 0)
            stock_breakdown.append({
                "type": s.get("type"),
                "present": present,
                "reserved": s.get("reserved", 0),
                "sku": s.get("sku"),
            })
            if s.get("type") == "fbs":
                total_stock += present
        if total_stock > 0:
            with_stock += 1

        name = info.get("name") or attr.get("name") or ""
        if name:
            with_name += 1
        else:
            nameless += 1

        # Цена
        p_block = price.get("price", {}) or {}
        commissions = price.get("commissions", {}) or {}

        products.append({
            "productId": pid,
            "offerId": it.get("offer_id"),
            "name": name,
            "barcodes": info.get("barcodes") or [info.get("barcode")] if info.get("barcode") else [],
            "descriptionCategoryId": attr.get("description_category_id") or info.get("description_category_id"),
            "typeId": attr.get("type_id") or info.get("type_id"),
            "categoryName": attr.get("type_name"),
            "brand": next(
                (a.get("values", [{}])[0].get("value") for a in attr.get("attributes", []) if a.get("attribute_id") == 85),
                None,
            ),
            "images": info.get("images") or [],
            "imagesCount": len(info.get("images") or []),
            "weight": info.get("weight"),
            "depth": info.get("depth"),
            "height": info.get("height"),
            "width": info.get("width"),
            "price": p_block.get("price"),
            "oldPrice": p_block.get("old_price"),
            "currencyCode": p_block.get("currency_code"),
            "marketingPrice": p_block.get("marketing_price"),
            "minPrice": p_block.get("min_price"),
            "vat": p_block.get("vat"),
            "commissions": {
                "fboPercent": commissions.get("fbo_percent"),
                "fbsPercent": commissions.get("fbs_percent"),
            },
            "stocks": stock_breakdown,
            "totalStockFbs": total_stock,
            "statuses": {
                "stateName": (info.get("statuses") or {}).get("state_name"),
                "stateDescription": (info.get("statuses") or {}).get("state_description"),
                "isCreated": (info.get("statuses") or {}).get("is_created"),
                "moderateStatus": (info.get("statuses") or {}).get("moderate_status"),
                "validationState": (info.get("statuses") or {}).get("validation_state"),
                "itemErrors": info.get("statuses", {}).get("item_errors") or [],
            },
            "visibilityDetails": info.get("visibility_details"),
            "isArchived": it.get("archived"),
            "attributesCount": len(attr.get("attributes") or []),
        })

    products.sort(key=lambda p: (-p["totalStockFbs"], p["offerId"] or ""))

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "ozon",
        "summary": {
            "total": len(products),
            "withStock": with_stock,
            "withName": with_name,
            "nameless": nameless,
            "totalUnits": sum(p["totalStockFbs"] for p in products),
        },
        "products": products,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    s = out["summary"]
    print()
    print(f"✅ Сохранено: {OUT_FILE.relative_to(ROOT)}")
    print(f"   Всего:       {s['total']}")
    print(f"   С именем:    {s['withName']}")
    print(f"   Без имени:   {s['nameless']}")
    print(f"   С остатком:  {s['withStock']}")
    print(f"   Единиц:      {s['totalUnits']}")


if __name__ == "__main__":
    main()
