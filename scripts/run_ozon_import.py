#!/usr/bin/env python3
"""
Запускает импорт на Ozon в 3 шага, читая готовые файлы из data/ozon_import/.

  1. POST /v3/product/import          — 40 новых карточек → task_id
  2. POST /v1/product/import/info     — опрос статуса до готовности
  3. POST /v1/product/import/prices   — цены (70 офферов)
  4. POST /v2/products/stocks         — остатки (70 офферов)

Параметры:
  --dry-run           показать только summary, не отправлять
  --step S            запустить только шаг: products|prices|stocks
                      (по умолчанию все по очереди)
  --skip-import-wait  не ждать завершения модерации (если прошлый task уже в работе)
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "ozon_import"
API_BASE = "https://api-seller.ozon.ru"
PRODUCTS_BATCH = 100  # Ozon принимает до 100 в /v3/product/import
PRICES_BATCH = 1000   # до 1000 в /v1/product/import/prices
STOCKS_BATCH = 100    # до 100 в /v2/products/stocks


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def call(path, body, retries=4):
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
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req) as r:
                txt = r.read()
                return {"ok": True, "body": json.loads(txt) if txt else {}}
        except urllib.error.HTTPError as e:
            body_text = e.read().decode("utf-8", errors="replace")
            if e.code == 429 and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            return {"ok": False, "code": e.code, "body": body_text}


def chunk(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


def wait_import(task_id, max_wait_sec=300):
    """Опрос /v1/product/import/info до завершения."""
    start = time.time()
    while time.time() - start < max_wait_sec:
        r = call("/v1/product/import/info", {"task_id": task_id})
        if not r["ok"]:
            print(f"    ошибка опроса: {r}")
            return False, None
        result = r["body"].get("result") or {}
        total = result.get("total", 0)
        items = result.get("items") or []
        pending = [i for i in items if i.get("status") == "pending"]
        print(f"    task {task_id}: total={total}, pending={len(pending)}")
        if not pending:
            # Все обработаны — собираем итог
            ok = [i for i in items if i.get("status") == "imported"]
            failed = [i for i in items if i.get("status") == "failed"]
            return True, {"total": total, "ok": len(ok), "failed": len(failed), "items": items}
        time.sleep(5)
    return False, None


def import_products(products, skip_wait=False):
    print(f"\n[1/3] Импорт {len(products)} карточек батчами по {PRODUCTS_BATCH}...")
    task_ids = []
    for n, batch in enumerate(chunk(products, PRODUCTS_BATCH), 1):
        r = call("/v3/product/import", {"items": batch})
        if not r["ok"]:
            print(f"  батч {n}: FAIL {r.get('code')}: {str(r.get('body'))[:400]}")
            continue
        task_id = r["body"].get("result", {}).get("task_id")
        print(f"  батч {n}: task_id={task_id}")
        if task_id:
            task_ids.append(task_id)
        time.sleep(1)

    if skip_wait:
        print(f"  → task_id(s): {task_ids}, опрос пропущен")
        return task_ids

    # Ждём завершения всех
    results = []
    for tid in task_ids:
        print(f"\n  опрашиваем статус task {tid}...")
        ok, info = wait_import(tid)
        if ok and info:
            print(f"    ✅ imported={info['ok']}, failed={info['failed']}")
            if info["failed"]:
                errors = []
                for it in info["items"]:
                    if it.get("status") == "failed":
                        errors.append({
                            "offer_id": it.get("offer_id"),
                            "errors": it.get("errors") or [],
                        })
                (DATA_DIR / f"errors_import_task_{tid}.json").write_text(
                    json.dumps(errors, ensure_ascii=False, indent=2)
                )
                print(f"    сохранено: errors_import_task_{tid}.json")
        results.append({"task_id": tid, "ok": ok, "info": info})
    return task_ids


def update_prices(prices):
    print(f"\n[2/3] Обновляем {len(prices)} цен...")
    ok_count = 0
    errors = []
    for n, batch in enumerate(chunk(prices, PRICES_BATCH), 1):
        r = call("/v1/product/import/prices", {"prices": batch})
        if not r["ok"]:
            print(f"  батч {n}: FAIL {r.get('code')}: {str(r.get('body'))[:300]}")
            errors.append({"batch": n, "error": r.get("body")})
            continue
        items = r["body"].get("result") or []
        batch_ok = sum(1 for it in items if it.get("updated"))
        batch_fail = [it for it in items if not it.get("updated")]
        ok_count += batch_ok
        print(f"  батч {n}: updated={batch_ok}/{len(items)}")
        if batch_fail:
            errors.extend(batch_fail)
        time.sleep(1)
    print(f"  итог: обновлено {ok_count}/{len(prices)}")
    if errors:
        (DATA_DIR / "errors_prices.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2))


def update_stocks(stocks):
    print(f"\n[3/3] Обновляем {len(stocks)} остатков...")
    ok_count = 0
    errors = []
    for n, batch in enumerate(chunk(stocks, STOCKS_BATCH), 1):
        r = call("/v2/products/stocks", {"stocks": batch})
        if not r["ok"]:
            print(f"  батч {n}: FAIL {r.get('code')}: {str(r.get('body'))[:300]}")
            errors.append({"batch": n, "error": r.get("body")})
            continue
        items = r["body"].get("result") or []
        batch_ok = sum(1 for it in items if it.get("updated"))
        batch_fail = [it for it in items if not it.get("updated")]
        ok_count += batch_ok
        print(f"  батч {n}: updated={batch_ok}/{len(items)}")
        if batch_fail:
            errors.extend(batch_fail)
        time.sleep(1)
    print(f"  итог: обновлено {ok_count}/{len(stocks)}")
    if errors:
        (DATA_DIR / "errors_stocks.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--step", choices=["products", "prices", "stocks"], default=None)
    ap.add_argument("--skip-import-wait", action="store_true")
    args = ap.parse_args()

    load_env()
    products = json.loads((DATA_DIR / "products.json").read_text())
    prices = json.loads((DATA_DIR / "prices.json").read_text())
    stocks = json.loads((DATA_DIR / "stocks.json").read_text())

    print(f"К загрузке: products={len(products)}, prices={len(prices)}, stocks={len(stocks)}")

    if args.dry_run:
        print("--dry-run: ничего не отправлено.")
        return

    if args.step in (None, "products"):
        import_products(products, skip_wait=args.skip_import_wait)
    if args.step in (None, "prices"):
        update_prices(prices)
    if args.step in (None, "stocks"):
        update_stocks(stocks)


if __name__ == "__main__":
    main()
