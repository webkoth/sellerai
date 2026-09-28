"""Jev: площадки РСЯ KIT и поисковые кластеры WB -> черновики исключений на утверждение."""
import json, os, collections, urllib.request
from concurrent.futures import ThreadPoolExecutor

S = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ["TYPESAFE_API_KEY"]
PLACEMENTS = "/Users/minas/.claude/projects/-Users-minas-projects/74234d8b-edf8-4b48-bec3-bd64eed686b4/tool-results/mcp-yandex-yandex_direct_report-1790594030407.txt"


def jev(state, questions):
    body = json.dumps({"state": state, "model": "jev-latest", "questions": questions}).encode()
    req = urllib.request.Request("https://api.typesafe.ai/v1/systemone", data=body, method="POST",
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    for _ in range(4):
        try:
            return json.load(urllib.request.urlopen(req, timeout=30))
        except Exception as ex:
            err = ex
    raise err


# ---------- РСЯ KIT: площадки ----------
agg = collections.defaultdict(lambda: {"impr": 0, "clicks": 0, "cost": 0.0, "conv": 0, "groups": set()})
for line in open(PLACEMENTS, encoding="utf-8").read().splitlines()[1:]:
    p = line.split("\t")
    if len(p) < 6: continue
    a = agg[p[0].strip()]
    a["impr"] += int(p[2]); a["clicks"] += int(p[3]); a["cost"] += float(p[4]); a["conv"] += int(p[5] or 0); a["groups"].add(p[1])

PLACE_Q = {"kind": {
    "type": "choice",
    "instructions": "Что это за рекламная площадка `placement` (домен сайта или идентификатор мобильного приложения)? Судить по названию.",
    "criteria": {
        "content": "Сайт или приложение с содержательной аудиторией: новости, погода, почта, справочники, тематические сайты, магазины, сервисы Яндекса и Mail",
        "game": "Мобильная или браузерная игра: головоломки, три в ряд, казуальные, аркады, симуляторы",
        "utility": "Служебное приложение: фонарик, VPN, очистка памяти, клавиатура, обои, скачивание файлов, конвертеры, сканеры QR",
        "unclear": "По названию нельзя понять, что это за площадка",
    },
}}

def ask_place(item):
    name, a = item
    r = jev({"placement": name}, PLACE_Q)["answers"]["kind"]
    return {"placement": name, "kind": r["choice"], "conf": r["confidence"], "clicks": a["clicks"],
            "cost": round(a["cost"], 2), "impr": a["impr"], "conv": a["conv"], "groups": sorted(a["groups"])}

paid = [(k, v) for k, v in agg.items() if v["clicks"] > 0]
with ThreadPoolExecutor(8) as ex:
    places = list(ex.map(ask_place, paid))
json.dump(places, open(f"{S}/kit_places_jev.json", "w"), ensure_ascii=False, indent=1)
print("РСЯ: площадок всего", len(agg), "с кликами", len(paid))

# ---------- WB: поисковые кластеры ----------
cards = json.load(open(f"{S}/wb_cards.json"))
stats = json.load(open(f"{S}/nq_stats.json"))["stats"]
adverts = {a["id"]: a["settings"]["name"] for a in json.load(open(f"{S}/wb_adverts.json"))["adverts"]}

WB_Q = {"fit": {
    "type": "choice",
    "instructions": "Покупатель ввёл поисковый запрос `query` на Wildberries. Подходит ли под этот запрос рекламируемый товар `product`?",
    "criteria": {
        "fits": "Товар отвечает запросу: тот же вид изделия, материал или тема (метеорит, амулет, оберег, браслет, подвеска и т.п.), покупатель мог искать именно такое",
        "other_item": "Запрос про другой вид товара или другую вещь: не то изделие, не тот материал, не для той аудитории",
        "other_brand": "Запрос про чужой бренд или конкретный чужой товар",
        "junk": "Бессмысленный, слишком общий или случайный запрос",
    },
}}

jobs = []
for s in stats:
    c = cards.get(str(s["nm_id"]), {})
    for q in s.get("stats") or []:
        if q["spend"] <= 0: continue
        jobs.append((s["advert_id"], s["nm_id"], c, q))

def ask_wb(job):
    adv, nm, c, q = job
    state = {"query": q["norm_query"], "product": {"title": c.get("title"), "category": c.get("subject"), "description": c.get("desc", "")[:300]}}
    r = jev(state, WB_Q)["answers"]["fit"]
    return {"advert": adv, "campaign": adverts.get(adv), "nm": nm, "title": c.get("title"), "query": q["norm_query"],
            "fit": r["choice"], "conf": r["confidence"], "spend": q["spend"], "clicks": q["clicks"],
            "atbs": q["atbs"], "orders": q["orders"], "views": q["views"]}

with ThreadPoolExecutor(8) as ex:
    wb = list(ex.map(ask_wb, jobs))
json.dump(wb, open(f"{S}/wb_clusters_jev.json", "w"), ensure_ascii=False, indent=1)
print("WB: пар кластер-товар с расходом", len(wb))
