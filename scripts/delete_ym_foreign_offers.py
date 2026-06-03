#!/usr/bin/env python3
"""
Удаляет 17 «старых» офферов из YM-бизнеса:
  1. Обнуляет остатки (PUT /v2/campaigns/{id}/offers/stocks, count=0)
  2. Удаляет карточки (POST /businesses/{id}/offer-mappings/delete)

Список офферов — статически зафиксирован в коде (только без продаж за 90 дней).
"""
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WAREHOUSE_ID = 1872191
API_BASE = "https://api.partner.market.yandex.ru"

# 17 офферов: все БЕЗ продаж за 90 дней, со старыми неверными категориями (в т.ч. «ювелирные»)
TARGETS = [
    "2042285696378", "2042354181293", "2042770600729", "2043464730241",
    "2044230961111", "2044473196868", "2044504255403", "2044890706589",
    "2045712649466", "2045909364332", "2045909417847", "2046267534986",
    "2046601922097", "2046803609222", "2046830790368", "2047095090323",
    "2047426280997",
]


def load_env():
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def call(path, body, method="POST"):
    req = urllib.request.Request(
        API_BASE + path,
        data=json.dumps(body).encode(),
        headers={"Api-Key": os.environ["YM_API_TOKEN"], "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read()
            return {"ok": True, "body": json.loads(txt) if txt else {}}
    except urllib.error.HTTPError as e:
        return {"ok": False, "code": e.code, "body": e.read().decode("utf-8", errors="replace")}


def zero_stocks(campaign_id):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    skus = [
        {
            "sku": sku,
            "warehouseId": WAREHOUSE_ID,
            "items": [{"type": "FIT", "count": 0, "updatedAt": now}],
        }
        for sku in TARGETS
    ]
    print(f"[1/2] Обнуляю остатки на {len(skus)} офферах...")
    r = call(f"/v2/campaigns/{campaign_id}/offers/stocks", {"skus": skus}, "PUT")
    if r["ok"]:
        print(f"  OK: {r['body']}")
    else:
        print(f"  FAIL {r.get('code')}: {r.get('body')}")
    return r["ok"]


def delete_offers(business_id):
    print(f"[2/2] Удаляю {len(TARGETS)} карточек...")
    # Используем /offer-mappings/delete (актуальный endpoint)
    r = call(f"/businesses/{business_id}/offer-mappings/delete", {"offerIds": TARGETS})
    if r["ok"]:
        body = r["body"]
        print(f"  OK: status={body.get('status')}")
        res = body.get("result") or {}
        if res.get("notDeletedOfferIds"):
            print(f"  ⚠️  не удалено: {res['notDeletedOfferIds']}")
        return True
    print(f"  первая попытка неудачна ({r.get('code')}): {str(r.get('body'))[:200]}")
    # Пробуем альтернативный endpoint
    print("  пробую /offer-cards/removals ...")
    r2 = call(
        f"/businesses/{business_id}/offer-cards/removals",
        {"removeFromArchive": False, "offerIds": TARGETS},
    )
    if r2["ok"]:
        print(f"  OK: {r2['body']}")
        return True
    print(f"  FAIL {r2.get('code')}: {str(r2.get('body'))[:300]}")
    return False


def main():
    load_env()
    business_id = int(os.environ["YM_BUSINESS_ID"])
    campaign_id = int(os.environ["YM_CAMPAIGN_ID"])
    print(f"Бизнес {business_id}, магазин {campaign_id}, склад {WAREHOUSE_ID}")
    print(f"Целевых офферов: {len(TARGETS)}")
    ok1 = zero_stocks(campaign_id)
    if not ok1:
        print("\n⛔ Шаг 1 не прошёл — удаление отменяем.")
        return
    ok2 = delete_offers(business_id)
    print()
    print("ИТОГ:", "✅ всё выполнено" if ok2 else "🟡 остатки обнулены, удаление не прошло (см. выше)")


if __name__ == "__main__":
    main()
