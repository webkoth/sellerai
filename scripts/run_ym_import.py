#!/usr/bin/env python3
"""
Запускает импорт WB→YM в 3 шага, читая готовые файлы из data/ym_import/.

Использует те же endpoints, что и ym-mcp:
  1. POST /businesses/{id}/offer-mappings/update    (создание/обновление карточек)
  2. POST /v2/campaigns/{id}/offer-prices/updates   (цены)
  3. PUT  /v2/campaigns/{id}/offers/stocks          (остатки, updatedAt = now)

Параметры запуска:
  --dry-run     показать только summary, ничего не отправлять
  --step S      запустить только указанный шаг: products | prices | stocks
                (по умолчанию все три по очереди)
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "ym_import"
API_BASE = "https://api.partner.market.yandex.ru"
BATCH_SIZE = 20  # YM лимит: 500 КБ на запрос; ~25 КБ на оффер с длинным описанием


def load_env():
    env_path = ROOT / ".env"
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def call(path, body, method="POST"):
    url = API_BASE + path
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Api-Key": os.environ["YM_API_TOKEN"],
            "Content-Type": "application/json",
        },
        method=method,
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req) as r:
                txt = r.read()
                return json.loads(txt) if txt else {}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            if e.code == 429 and attempt < 3:
                wait = 5 * (attempt + 1)
                print(f"    429 — ждём {wait}с", flush=True)
                time.sleep(wait)
                continue
            raise RuntimeError(f"YM API {e.code} {path}: {err_body}") from e


def chunk(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


def upload_products(business_id, products):
    """POST /businesses/{businessId}/offer-mappings/update"""
    print(f"\n[1/3] Загружаем {len(products)} карточек батчами по {BATCH_SIZE}...")
    total_ok = 0
    errors = []
    for n, batch in enumerate(chunk(products, BATCH_SIZE), 1):
        offer_mappings = []
        for p in batch:
            mapping = {"marketCategoryId": p.pop("marketCategoryId", None)}
            offer_mappings.append({"offer": p, "mapping": mapping})
        body = {"offerMappings": offer_mappings}
        try:
            resp = call(f"/businesses/{business_id}/offer-mappings/update", body)
            # YM возвращает {status: "OK"} либо {status: "ERROR", errors: [...]}
            errs = resp.get("errors") or []
            if errs:
                for e in errs:
                    errors.append(e)
                print(f"  батч {n}: status={resp.get('status')}, ошибок: {len(errs)}")
            else:
                total_ok += len(batch)
                print(f"  батч {n}: status={resp.get('status', 'OK')}, отправлено: {len(batch)}")
        except Exception as e:
            print(f"  батч {n}: FAIL — {e}")
            errors.append({"batch": n, "error": str(e)})
    print(f"  итог: успешно отправлено {total_ok}/{len(products)}, ошибок: {len(errors)}")
    if errors:
        (DATA_DIR / "errors_products.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2))
    return total_ok, errors


def upload_prices(business_id, prices):
    """POST /businesses/{businessId}/offer-prices/updates"""
    print(f"\n[2/3] Устанавливаем {len(prices)} цен...")
    total_ok = 0
    errors = []
    for n, batch in enumerate(chunk(prices, BATCH_SIZE), 1):
        offers = []
        for p in batch:
            entry = {
                "offerId": p["offerId"],
                "price": {"value": p["price"], "currencyId": "RUR"},
            }
            if p.get("discountBase"):
                entry["price"]["discountBase"] = p["discountBase"]
            offers.append(entry)
        body = {"offers": offers}
        try:
            resp = call(f"/businesses/{business_id}/offer-prices/updates", body)
            errs = resp.get("errors") or []
            if errs:
                errors.extend(errs)
                print(f"  батч {n}: ошибок: {len(errs)}")
            else:
                total_ok += len(batch)
                print(f"  батч {n}: ок, {len(batch)} цен")
        except Exception as e:
            print(f"  батч {n}: FAIL — {e}")
            errors.append({"batch": n, "error": str(e)})
    print(f"  итог: успешно {total_ok}/{len(prices)}")
    if errors:
        (DATA_DIR / "errors_prices.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2))
    return total_ok, errors


def upload_stocks(campaign_id, stocks):
    """PUT /v2/campaigns/{campaignId}/offers/stocks"""
    print(f"\n[3/3] Устанавливаем остатки на {len(stocks)} офферов...")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    total_ok = 0
    errors = []
    for n, batch in enumerate(chunk(stocks, BATCH_SIZE), 1):
        skus = []
        for s in batch:
            skus.append({
                "sku": s["sku"],
                "warehouseId": s["warehouseId"],
                "items": [{"type": "FIT", "count": int(s["count"]), "updatedAt": now}],
            })
        body = {"skus": skus}
        try:
            resp = call(f"/v2/campaigns/{campaign_id}/offers/stocks", body, method="PUT")
            errs = resp.get("errors") or []
            if errs:
                errors.extend(errs)
                print(f"  батч {n}: ошибок: {len(errs)}")
            else:
                total_ok += len(batch)
                print(f"  батч {n}: ок, {len(batch)} остатков")
        except Exception as e:
            print(f"  батч {n}: FAIL — {e}")
            errors.append({"batch": n, "error": str(e)})
    print(f"  итог: успешно {total_ok}/{len(stocks)}")
    if errors:
        (DATA_DIR / "errors_stocks.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2))
    return total_ok, errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--step", choices=["products", "prices", "stocks"], default=None)
    args = ap.parse_args()

    load_env()
    business_id = int(os.environ["YM_BUSINESS_ID"])
    campaign_id = int(os.environ["YM_CAMPAIGN_ID"])

    products = json.loads((DATA_DIR / "products.json").read_text())
    prices = json.loads((DATA_DIR / "prices.json").read_text())
    stocks = json.loads((DATA_DIR / "stocks.json").read_text())

    print(f"Бизнес: {business_id}, магазин: {campaign_id}")
    print(f"К загрузке: products={len(products)}, prices={len(prices)}, stocks={len(stocks)}")
    print(f"Сумма остатков: {sum(s['count'] for s in stocks)} шт")

    if args.dry_run:
        print("\n--dry-run: ничего не отправлено.")
        return

    if args.step in (None, "products"):
        upload_products(business_id, products)
    if args.step in (None, "prices"):
        upload_prices(business_id, prices)
    if args.step in (None, "stocks"):
        upload_stocks(campaign_id, stocks)


if __name__ == "__main__":
    main()
