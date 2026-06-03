#!/usr/bin/env python3
"""
Зеркальный аналог export_wb_products_for_migration.py — но для Яндекс.Маркета.

Выгружает все товары YM-магазина с положительным остатком в data/ym_products_in_stock.json.

Источники:
  - /v2/campaigns/{id}/offers              — список офферов с маппингом категории
  - /businesses/{id}/offer-cards           — детальные карточки (фото, описание, габариты)
  - /v2/campaigns/{id}/offer-prices        — текущие цены
  - /v2/campaigns/{id}/offers/stocks       — остатки на складах
  - /v2/businesses/{id}/warehouses         — справочник складов

В файл попадают ТОЛЬКО офферы с totalStock > 0.

После импорта на YM запустить заново — увидим зеркало того, что лежит на маркетплейсе.
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
OUT_FILE = ROOT / "data" / "ym_products_in_stock.json"
API_BASE = "https://api.partner.market.yandex.ru"


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


def fetch(path, body=None, method="GET", max_retries=4):
    url = API_BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Api-Key": os.environ["YM_API_TOKEN"],
            "Content-Type": "application/json",
        },
        method=method,
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
            raise RuntimeError(f"YM API {e.code} {path}: {err_body}") from e


def get_warehouses(business_id):
    d = fetch(f"/v2/businesses/{business_id}/warehouses")
    return d.get("result", {}).get("warehouses", []) or []


def get_all_offer_mappings(business_id):
    """Возвращает все офферы бизнеса с привязанной категорией.
    Используем business-эндпоинт, т.к. campaigns/{id}/offers может долго «догонять»
    свежезагруженные товары и возвращать пустые страницы с одним и тем же токеном.
    """
    out = []
    page_token = None
    seen_tokens = set()
    while True:
        body = {"limit": 200}
        if page_token:
            body["page_token"] = page_token
        d = fetch(f"/businesses/{business_id}/offer-mappings", body, "POST")
        result = d.get("result", {})
        batch = result.get("offerMappings", []) or []
        out.extend(batch)
        page_token = (result.get("paging") or {}).get("nextPageToken")
        if not page_token:
            break
        if page_token in seen_tokens:
            print("  warn: повторный pageToken — прерываем (защита от зацикливания)")
            break
        seen_tokens.add(page_token)
    return out


def get_offer_cards(business_id, offer_ids):
    """Детальные карточки (фото, описание, габариты, manufacturerCountries)."""
    out = []
    for i in range(0, len(offer_ids), 200):
        batch = offer_ids[i : i + 200]
        d = fetch(
            f"/businesses/{business_id}/offer-cards",
            {"offerIds": batch},
            "POST",
        )
        out.extend(d.get("result", {}).get("offerCards", []) or [])
    return out


def get_prices(campaign_id, offer_ids):
    """Текущие цены — индексируем по offerId."""
    prices = {}
    for i in range(0, len(offer_ids), 500):
        batch = offer_ids[i : i + 500]
        d = fetch(
            f"/v2/campaigns/{campaign_id}/offer-prices",
            {"offerIds": batch, "limit": 500},
            "POST",
        )
        for o in d.get("result", {}).get("offers", []) or []:
            prices[o.get("offerId")] = o.get("price") or {}
    return prices


def get_stocks(campaign_id):
    """Остатки на всех складах. Без фильтра — берём все, потом отфильтруем по amount>0."""
    out = []
    page_token = None
    while True:
        body = {"limit": 500, "withTurnover": False}
        if page_token:
            body["page_token"] = page_token
        d = fetch(f"/v2/campaigns/{campaign_id}/offers/stocks", body, "POST")
        result = d.get("result", {})
        out.extend(result.get("warehouses", []) or [])
        page_token = (result.get("paging") or {}).get("nextPageToken")
        if not page_token:
            break
    return out


def aggregate_stocks(warehouse_blocks):
    """warehouseBlocks → {offerId: {warehouseId: count, ...}}."""
    by_offer = {}
    for wh in warehouse_blocks:
        wh_id = wh.get("warehouseId")
        for o in wh.get("offers", []) or []:
            offer_id = o.get("offerId")
            stocks_list = o.get("stocks") or []
            available = sum(
                int(s.get("count", 0))
                for s in stocks_list
                if s.get("type") in ("AVAILABLE", "FIT")
            )
            if available <= 0:
                continue
            by_offer.setdefault(offer_id, {})[wh_id] = (
                by_offer.get(offer_id, {}).get(wh_id, 0) + available
            )
    return by_offer


def main():
    load_env()
    business_id = int(os.environ.get("YM_BUSINESS_ID", "0"))
    campaign_id = int(os.environ.get("YM_CAMPAIGN_ID", "0"))
    if not business_id or not campaign_id:
        sys.exit("YM_BUSINESS_ID и YM_CAMPAIGN_ID должны быть в .env")

    print("Получаем склады...", flush=True)
    warehouses = get_warehouses(business_id)
    warehouses_info = {
        w["id"]: {
            "id": w["id"],
            "name": w.get("name"),
            "campaignId": w.get("campaignId"),
            "type": w.get("type"),
        }
        for w in warehouses
    }
    print(f"  складов: {len(warehouses)}", flush=True)

    print("Получаем офферы (mappings)...", flush=True)
    mappings = get_all_offer_mappings(business_id)
    offer_ids = [m["offer"]["offerId"] for m in mappings if m.get("offer")]
    print(f"  офферов в магазине: {len(offer_ids)}", flush=True)

    if not offer_ids:
        out = {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "yandex_market",
            "mode": "fbs",
            "businessId": business_id,
            "campaignId": campaign_id,
            "warehouses": warehouses_info,
            "summary": {
                "totalOffers": 0,
                "productsInStock": 0,
                "totalUnits": 0,
                "totalValue": 0,
            },
            "products": [],
        }
        OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2))
        print(f"\n✅ Сохранено (магазин пуст): {OUT_FILE.relative_to(ROOT)}")
        return

    print("Получаем детальные карточки...", flush=True)
    cards = get_offer_cards(business_id, offer_ids)
    card_by_id = {c.get("offerId"): c for c in cards}

    print("Получаем цены...", flush=True)
    prices = get_prices(campaign_id, offer_ids)

    print("Получаем остатки...", flush=True)
    stocks_blocks = get_stocks(campaign_id)
    stock_by_offer = aggregate_stocks(stocks_blocks)
    print(f"  офферов с остатком > 0: {len(stock_by_offer)}", flush=True)

    products = []
    for m in mappings:
        offer = m.get("offer") or {}
        mapping = m.get("mapping") or {}
        offer_id = offer.get("offerId")
        wh_stocks = stock_by_offer.get(offer_id)
        if not wh_stocks:
            continue
        total_stock = sum(wh_stocks.values())
        card = card_by_id.get(offer_id, {}) or {}
        # Поле фото в offer-cards: pictures[]
        pictures = []
        for p in card.get("pictures", []) or []:
            url = p.get("url") if isinstance(p, dict) else p
            if url:
                pictures.append(url)
        if not pictures:
            for p in offer.get("pictures", []) or []:
                pictures.append(p)
        description = card.get("description") or offer.get("description") or ""
        countries = card.get("manufacturerCountries") or offer.get("manufacturerCountries") or []
        wd = card.get("weightDimensions") or offer.get("weightDimensions") or {}
        price_block = prices.get(offer_id, {}) or {}

        products.append({
            "offerId": offer_id,
            "name": offer.get("name") or card.get("name"),
            "description": description,
            "vendor": offer.get("vendor") or card.get("vendor"),
            "vendorCode": offer.get("vendorCode") or card.get("vendorCode"),
            "barcodes": offer.get("barcodes") or card.get("barcodes") or [],
            "pictures": pictures,
            "manufacturerCountries": countries,
            "weightDimensions": wd or None,
            "marketCategoryId": mapping.get("marketCategoryId"),
            "marketCategoryName": mapping.get("marketCategoryName") or mapping.get("categoryName"),
            "marketSku": mapping.get("marketSku"),
            "mappingStatus": mapping.get("mappingStatus") or m.get("status"),
            "price": price_block.get("value"),
            "currencyId": price_block.get("currencyId"),
            "discountBase": price_block.get("discountBase"),
            "totalStock": total_stock,
            "warehouses": wh_stocks,
            "meta": {
                "hasPhoto": bool(pictures),
                "photosCount": len(pictures),
                "hasDescription": bool(description),
                "descriptionLength": len(description),
            },
        })

    products.sort(key=lambda p: (-p["totalStock"], -(p.get("price") or 0)))

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "yandex_market",
        "mode": "fbs",
        "businessId": business_id,
        "campaignId": campaign_id,
        "warehouses": warehouses_info,
        "summary": {
            "totalOffers": len(offer_ids),
            "productsInStock": len(products),
            "totalUnits": sum(p["totalStock"] for p in products),
            "totalValue": round(
                sum(p["totalStock"] * (p.get("price") or 0) for p in products), 2
            ),
        },
        "products": products,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    s = out["summary"]
    print()
    print(f"✅ Сохранено: {OUT_FILE.relative_to(ROOT)}")
    print(f"   Офферов всего:    {s['totalOffers']}")
    print(f"   С остатком:       {s['productsInStock']}")
    print(f"   Единиц товара:    {s['totalUnits']}")
    print(f"   Стоимость:        {s['totalValue']:,.2f} ₽".replace(",", " "))


if __name__ == "__main__":
    main()
