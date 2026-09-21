"""Цены Яндекс KIT по ценам Wildberries.

Правило то же, по которому карточки KIT заводились: «цена до скидки» KIT = базовая цена WB,
«цена со скидкой» KIT (`manual_discount_price`) = цена WB после скидки продавца, округлённая
до рубля. СПП и кошелёк WB сюда не входят: это скидки самой площадки, продавцу они не видны
через API цен.

Сопоставление WB → KIT по штрихкоду; размер карточки WB — по chrtID = sizeID цен.
Варианты KIT без штрихкода или без цены WB не трогаются.

Цены WB (`discounts-prices-api`) отдаются 1 запросом в несколько минут, повтор до конца окна
его продлевает. Поэтому снимок сохраняется в reports/, а запись идёт по тому же снимку:
    python3 scripts/kit_sync_prices.py                          # снять цены WB, показать изменения
    python3 scripts/kit_sync_prices.py --from <снимок.json>     # показать по сохранённому снимку
    python3 scripts/kit_sync_prices.py --from <снимок.json> --apply
    python3 scripts/kit_sync_prices.py --from <снимок.json> --apply --allow-jump <штрихкод,...>

Защита от битого чтения WB:
- в снимке должно быть не меньше MIN_WB_GOODS товаров;
- изменение цены со скидкой больше чем на MAX_JUMP в любую сторону не записывается,
  пока штрихкод не разрешён в --allow-jump после проверки руками;
- изменений не больше MAX_CHANGES за прогон.
"""
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
import datetime
import json
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
KIT_API = "https://api.kit.yandex.net"
WB_PRICES = "https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter"
WB_CARDS = "https://content-api.wildberries.ru/content/v2/get/cards/list"
MIN_WB_GOODS = 100
MAX_JUMP = 0.6
MAX_CHANGES = 400
TIMEOUT = 60

ENV = dict(l.split("=", 1) for l in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
           if "=" in l and not l.startswith("#"))
KIT_TOK = ENV["YAKIT_API_TOKEN"].strip().strip('"')
WB_TOK = ENV["WB_API_TOKEN"].strip().strip('"')


def req(url, method="GET", body=None, auth=None, retry=True):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Authorization": auth}
    if body is not None:
        h["Content-Type"] = "application/json"
    for attempt in range(6 if retry else 1):
        r = urllib.request.Request(url, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(r, timeout=TIMEOUT) as resp:
                return resp.status, json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                return 429, e.headers.get("X-Ratelimit-Retry")
            if e.code in (500, 502, 503, 504) and retry:
                time.sleep(2 + attempt)
                continue
            return e.code, e.read()[:800].decode()
        except (urllib.error.URLError, OSError, TimeoutError):
            time.sleep(2 + attempt)
    return 0, "нет ответа"


def wb_snapshot():
    """Цены WB и карточки (штрихкод → nmID, chrtID) одним снимком."""
    goods, off = [], 0
    while True:
        # Без повторов: каждый лишний запрос до конца окна продлевает штраф WB.
        code, d = req(f"{WB_PRICES}?limit=1000&offset={off}", auth=WB_TOK, retry=False)
        if code == 429:
            raise SystemExit(f"WB цены: лимит, повторить через {d} с — не раньше")
        if code != 200:
            raise SystemExit(f"WB цены: {code} {d}")
        page = (d.get("data") or {}).get("listGoods") or []
        goods += page
        if len(page) < 1000:
            break
        off += 1000
    barcodes, cursor = {}, {"limit": 100}
    while True:
        code, d = req(WB_CARDS, "POST", {"settings": {"cursor": cursor, "filter": {"withPhoto": -1}}}, auth=WB_TOK)
        if code != 200:
            raise SystemExit(f"WB карточки: {code} {d}")
        for c in d.get("cards") or []:
            for s in c.get("sizes") or []:
                for bc in s.get("skus") or []:
                    barcodes[str(bc)] = {"nmID": c["nmID"], "chrtID": s.get("chrtID")}
        if (d.get("cursor") or {}).get("total", 0) < 100:
            break
        cursor = {"limit": 100, "updatedAt": d["cursor"]["updatedAt"], "nmID": d["cursor"]["nmID"]}
    snap = {"at": datetime.datetime.now().isoformat(timespec="seconds"), "goods": goods, "barcodes": barcodes}
    path = ROOT / "reports" / f"wb-prices-{datetime.date.today()}.json"
    path.write_text(json.dumps(snap, ensure_ascii=False), encoding="utf-8")
    print(f"снимок WB: {len(goods)} товаров, {len(barcodes)} штрихкодов · {path.relative_to(ROOT)}")
    return snap


def wb_price_by_barcode(snap):
    by_nm = {g["nmID"]: g for g in snap["goods"]}
    out = {}
    for bc, ref in snap["barcodes"].items():
        g = by_nm.get(ref["nmID"])
        if not g or not g.get("sizes"):
            continue
        size = next((s for s in g["sizes"] if s.get("sizeID") == ref["chrtID"]), g["sizes"][0])
        base, disc = Decimal(str(size.get("price") or 0)), Decimal(str(size.get("discountedPrice") or 0))
        if base > 0 and disc > 0:
            out[bc] = (base.quantize(Decimal(1), ROUND_HALF_UP), disc.quantize(Decimal(1), ROUND_HALF_UP))
    return out


def kit_variants():
    out, page = [], 1
    while True:
        code, d = req(f"{KIT_API}/v1/variants?per_page=100&page={page}", auth="Bearer " + KIT_TOK)
        if code != 200:
            raise SystemExit(f"KIT не отдал варианты: {code} {d}")
        it = d.get("variants") or []
        out += it
        if len(it) < 100:
            return out
        page += 1


def dec(x):
    return Decimal(str(x)).quantize(Decimal(1), ROUND_HALF_UP) if x not in (None, "") else None


def main():
    apply = "--apply" in sys.argv
    if "--from" in sys.argv:
        snap = json.loads(Path(sys.argv[sys.argv.index("--from") + 1]).read_text(encoding="utf-8"))
    elif apply:
        raise SystemExit("запись только по сохранённому снимку: --from <снимок.json> --apply")
    else:
        snap = wb_snapshot()
    if len(snap["goods"]) < MIN_WB_GOODS:
        raise SystemExit(f"стоп: в снимке WB всего {len(snap['goods'])} товаров — похоже на сбой чтения")

    allowed = set()
    if "--allow-jump" in sys.argv:
        allowed = set(sys.argv[sys.argv.index("--allow-jump") + 1].split(","))

    wb = wb_price_by_barcode(snap)
    changes, jumps = [], []
    for v in kit_variants():
        bc = str(v.get("barcode") or "")
        if bc not in wb:
            continue
        p = v.get("pricing") or {}
        was_base, was_disc = dec(p.get("price")), dec(p.get("manual_discount_price"))
        base, disc = wb[bc]
        if (was_base, was_disc) == (base, disc):
            continue
        c = {"variant_id": v["id"], "barcode": bc, "status": v.get("status"), "name": (v.get("name") or "")[:60],
             "was": [str(was_base), str(was_disc)], "becomes": [str(base), str(disc)]}
        ref = was_disc or was_base
        if ref and abs(disc - ref) / ref > Decimal(str(MAX_JUMP)) and bc not in allowed:
            jumps.append(c)
        else:
            changes.append(c)

    print(f"снимок WB от {snap['at']} · изменений: {len(changes)} · отложено скачков > {MAX_JUMP:.0%}: "
          f"{len(jumps)} · режим: {'запись' if apply else 'просмотр'}")
    for c in sorted(changes + jumps, key=lambda c: (c["status"] != "PUBLISHED", c["name"])):
        (wb_, wd), (nb, nd) = c["was"], c["becomes"]
        mark = f" ⚠ не записывается, проверить и разрешить: --allow-jump {c['barcode']}" if c in jumps else ""
        print(f"  {c['status']:<10} {wd:>7} → {nd:<7} (до скидки {wb_} → {nb}){mark}  {c['name']}")

    if len(changes) > MAX_CHANGES:
        raise SystemExit(f"стоп: изменений {len(changes)} (порог {MAX_CHANGES}) — разобрать руками")
    if not apply or not changes:
        return

    items = [{"variant_id": c["variant_id"], "price": c["becomes"][0], "manual_discount_price": c["becomes"][1]}
             for c in changes]
    code, d = req(f"{KIT_API}/v1/variants/prices/bulk_update", "POST", {"items": items}, auth="Bearer " + KIT_TOK)
    if code not in (200, 201, 204):
        raise SystemExit(f"KIT отклонил пакет, ничего не записано: {code} {d}")

    report = ROOT / "reports" / f"kit-prices-{datetime.date.today()}.json"
    report.write_text(json.dumps({"at": datetime.datetime.now().isoformat(timespec="seconds"),
                                  "wb_snapshot": snap["at"], "changes": changes, "held_jumps": jumps},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"записано: {len(items)} · отчёт {report.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
