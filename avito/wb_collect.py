"""Сбор данных WB для фида Авито: карточки, цены, остаток своего склада, медиана СПП за 30 дней.
Каждый шаг кэшируется в wb_<шаг>.json рядом со скриптом: повторный запуск не тратит лимиты."""
import json, os, statistics, time, urllib.request, urllib.error, datetime as dt

TOKEN = os.environ["WB_API_TOKEN"]
WH = 1408913
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "cache", "avito")


def cached(name, fn):
    p = os.path.join(DIR, f"wb_{name}.json")
    if os.path.exists(p):
        return json.load(open(p))
    v = fn()
    json.dump(v, open(p, "w"), ensure_ascii=False)
    return v


def req(url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method="POST" if data else "GET",
                               headers={"Authorization": TOKEN, "Content-Type": "application/json"})
    for _ in range(60):
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print("429, жду", url[:70], flush=True)
                time.sleep(65)
                continue
            raise RuntimeError(f"{url}: {e.code} {e.read()[:300]}")
    raise RuntimeError(f"{url}: 429 x60")


def get_cards():
    cards, cursor = [], {"limit": 100}
    while True:
        res = req("https://content-api.wildberries.ru/content/v2/get/cards/list",
                  {"settings": {"cursor": cursor, "filter": {"withPhoto": -1}}})
        cards += res["cards"]
        c = res["cursor"]
        if c["total"] < 100:
            return cards
        cursor = {"limit": 100, "updatedAt": c["updatedAt"], "nmID": c["nmID"]}


def get_prices():
    prices, offset = [], 0
    while True:
        goods = req(f"https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter"
                    f"?limit=1000&offset={offset}")["data"]["listGoods"]
        prices += goods
        if len(goods) < 1000:
            return prices
        offset += 1000


def get_stocks(cards):
    skus = [s for c in cards for sz in c.get("sizes", []) for s in sz.get("skus", [])]
    out = []
    for i in range(0, len(skus), 1000):
        out += req(f"https://marketplace-api.wildberries.ru/api/v3/stocks/{WH}", {"skus": skus[i:i + 1000]})["stocks"]
    return out


def get_fin():
    to = dt.date.today()
    frm = to - dt.timedelta(days=30)
    rows, rrdid = [], 0
    while True:
        res = req("https://finance-api.wildberries.ru/api/finance/v1/sales-reports/detailed",
                  {"dateFrom": str(frm), "dateTo": str(to), "limit": 100000, "rrdId": rrdid})
        if not res:
            break
        rows += res
        rrdid = res[-1]["rrdId"]
        if len(res) < 100000:
            break
    return {"period": [str(frm), str(to)], "rows": rows}


cards = cached("cards", get_cards)
print("cards", len(cards), flush=True)
stocks = cached("stocks", lambda: get_stocks(cards))
print("stocks", len(stocks), "positive", sum(1 for s in stocks if s["amount"] > 0), flush=True)
fin = cached("fin", get_fin)
spp = [float(r["spp"]) for r in fin["rows"] if r.get("docTypeName") == "Продажа" and float(r.get("retailPriceWithDisc") or 0) > 0]
print("fin rows", len(fin["rows"]), "sales", len(spp), "spp median", statistics.median(spp) if spp else None, flush=True)
prices = cached("prices", get_prices)
print("prices", len(prices), flush=True)
