"""Список популярных товаров по фактическим продажам Wildberries.

WB отдаёт статистику продаж не чаще раза в минуту, поэтому ответ кэшируется в
reports/wb-sales-<дата>.json и повторный запуск данные не перезапрашивает.

Сопоставление WB → KIT идёт по штрихкоду: имена в двух системах расходятся, штрихкод один.
В результат попадают только товары, которые есть в наличии в KIT.

Запуск: python3 scripts/wb_top_sellers.py [дней, по умолчанию 180]
Результат: reports/wb-top-sellers.json — продажи, выручка, product_card_id для коллекции.
"""
from pathlib import Path
import collections
import datetime
import json
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 180


def env(key):
    return next(l.split("=", 1)[1].strip().strip('"')
                for l in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
                if l.startswith(key + "="))


def wb_sales(days):
    cache = REPORTS / f"wb-sales-{datetime.date.today()}-{days}d.json"
    if cache.exists():
        print(f"беру из кэша: {cache.name}", flush=True)
        return json.loads(cache.read_text(encoding="utf-8"))
    frm = (datetime.date.today() - datetime.timedelta(days=days)).isoformat()
    url = f"https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom={frm}&flag=0"
    r = urllib.request.Request(url, headers={"Authorization": env("WB_API_TOKEN")})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                data = json.loads(resp.read())
            REPORTS.mkdir(exist_ok=True)
            cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            return data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print(f"  WB просит подождать, попытка {attempt + 1}", flush=True)
                time.sleep(65)
                continue
            raise
    raise SystemExit("WB так и не отдал статистику")


def kit_variants():
    tok = env("YAKIT_API_TOKEN")
    out, page = [], 1
    while True:
        r = urllib.request.Request(f"https://api.kit.yandex.net/v1/variants?per_page=100&page={page}",
                                   headers={"Authorization": "Bearer " + tok})
        with urllib.request.urlopen(r, timeout=30) as resp:
            it = json.loads(resp.read()).get("variants") or []
        out += it
        if len(it) < 100:
            return out
        page += 1


def main():
    sales = wb_sales(DAYS)
    print(f"продаж за {DAYS} дней: {len(sales)}", flush=True)
    cnt, rub = collections.Counter(), collections.Counter()
    for s in sales:
        b = str(s.get("barcode") or "")
        if not b:
            continue
        cnt[b] += 1
        rub[b] += float(s.get("forPay") or 0)

    by_barcode = {}
    for v in kit_variants():
        b = str(v.get("barcode") or "")
        if b:
            by_barcode.setdefault(b, []).append(v)

    def in_stock(v):
        return v.get("status") == "PUBLISHED" and sum(
            int(s.get("quantity", 0)) for s in (v.get("stocks") or [])) > 0

    top = []
    for b, n in cnt.most_common():
        for v in by_barcode.get(b, []):
            if in_stock(v):
                top.append({"sales": n, "rub": round(rub[b]), "barcode": b,
                            "name": v["name"], "variant_id": v["id"],
                            "product_card_id": v["product_card_id"]})
                break

    REPORTS.mkdir(exist_ok=True)
    (REPORTS / "wb-top-sellers.json").write_text(
        json.dumps(top, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"продавалось и есть в наличии в KIT: {len(top)}", flush=True)
    for t in top[:20]:
        print(f'  {t["sales"]:>3} шт  {t["rub"]:>7} ₽  {t["name"][:52]}', flush=True)


if __name__ == "__main__":
    main()
