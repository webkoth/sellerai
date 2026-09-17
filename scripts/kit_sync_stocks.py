"""Остатки Яндекс KIT из общего пула Wildberries.

Источник — `sync/scripts/kit-pool.mjs`: FBS-остаток WB на складе «Краснодар» минус открытые
заказы Ozon и ЯМ. Те же цифры получают Ozon и Маркет, поэтому KIT не продаст то, что уже
продано на другой площадке. FBO на складах самого WB в пул не входит: эти единицы
физически у WB, покупателю KIT их не отправить.

Сопоставление WB → KIT по штрихкоду. Варианты KIT без штрихкода в пуле не трогаются.
Количество пишется абсолютное (`POST /v1/variants/stocks/bulk_update`, атомарно).

Защита от пустого или битого чтения WB — иначе один сбой обнулил бы витрину:
- в пуле WB должно быть не меньше MIN_POOL_ITEMS позиций;
- изменений не больше MAX_CHANGES, и в ноль не больше MAX_TO_ZERO разом;
- при сбое чтения заказов Ozon/ЯМ запись не делается.

Запуск:
    node sync/scripts/kit-pool.mjs <pool.json>
    python3 scripts/kit_sync_stocks.py <pool.json>            # показать изменения
    python3 scripts/kit_sync_stocks.py <pool.json> --apply    # записать
"""
from pathlib import Path
import datetime
import json
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.kit.yandex.net"
WAREHOUSE = "01980d4c-1b53-7aa1-ab23-1b7c23604704"   # «Склад Краснодар», единственный склад продаж
MIN_POOL_ITEMS = 40
MAX_CHANGES = 60
MAX_TO_ZERO = 20
TIMEOUT = 30

TOK = next(l.split("=", 1)[1].strip().strip('"')
           for l in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
           if l.startswith("YAKIT_API_TOKEN="))


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Authorization": "Bearer " + TOK}
    if body is not None:
        h["Content-Type"] = "application/json"
    for attempt in range(6):
        r = urllib.request.Request(API + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(r, timeout=TIMEOUT) as resp:
                return resp.status, json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 + attempt)
                continue
            return e.code, e.read()[:800].decode()
        except (urllib.error.URLError, OSError, TimeoutError):
            time.sleep(2 + attempt)
    return 0, "нет ответа"


def kit_variants():
    out, page = [], 1
    while True:
        code, d = req("GET", f"/v1/variants?per_page=100&page={page}")
        if code != 200:
            raise SystemExit(f"KIT не отдал варианты: {code} {d}")
        it = d.get("variants") or []
        out += it
        if len(it) < 100:
            return out
        page += 1


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    apply = "--apply" in sys.argv
    pool = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

    if pool.get("orderErrors"):
        raise SystemExit(f"стоп: сбой чтения заказов Ozon/ЯМ {pool['orderErrors']} — пул неточный")
    if len(pool["items"]) < MIN_POOL_ITEMS:
        raise SystemExit(f"стоп: в пуле WB всего {len(pool['items'])} позиций — похоже на сбой чтения")

    by_bc = {i["barcode"]: i for i in pool["items"]}
    changes = []
    for v in kit_variants():
        bc = str(v.get("barcode") or "")
        if bc not in by_bc:
            continue
        cur = sum(int(s.get("quantity", 0)) for s in (v.get("stocks") or []) if s.get("warehouse_id") == WAREHOUSE)
        new = int(by_bc[bc]["available"])
        if cur != new:
            changes.append({"variant_id": v["id"], "barcode": bc, "status": v.get("status"),
                            "name": (v.get("name") or "")[:60], "was": cur, "becomes": new})

    to_zero = [c for c in changes if c["becomes"] == 0]
    print(f"изменений: {len(changes)} · в ноль: {len(to_zero)} · режим: {'запись' if apply else 'просмотр'}")
    for c in sorted(changes, key=lambda c: (c["becomes"] > c["was"], c["name"])):
        print(f"  {c['was']:>2} → {c['becomes']:<2} {c['status']:<10} {c['name']}")

    if len(changes) > MAX_CHANGES or len(to_zero) > MAX_TO_ZERO:
        raise SystemExit(f"стоп: изменений {len(changes)} (порог {MAX_CHANGES}), в ноль {len(to_zero)} "
                         f"(порог {MAX_TO_ZERO}) — проверьте пул руками")
    if not apply or not changes:
        return

    items = [{"variant_id": c["variant_id"], "warehouse_id": WAREHOUSE, "quantity": c["becomes"]} for c in changes]
    code, d = req("POST", "/v1/variants/stocks/bulk_update", {"items": items})
    if code not in (200, 201, 204):
        raise SystemExit(f"KIT отклонил пакет, ничего не записано: {code} {d}")

    report = ROOT / "reports" / f"kit-stocks-{datetime.date.today()}.json"
    report.parent.mkdir(exist_ok=True)
    report.write_text(json.dumps({"at": datetime.datetime.now().isoformat(timespec="seconds"),
                                  "pool_ledger": pool.get("ledgerUpdated"), "changes": changes},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"записано: {len(items)} · отчёт {report.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
