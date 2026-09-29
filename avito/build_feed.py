"""Фид автозагрузки Авито из данных WB.

Берёт кэш wb_collect.py (data/cache/avito/), отбирает карточки с остатком на своём складе
«Мой склад Краснодар» без серебра, считает цену по правилу KIT и пишет в OUT:
  feed.xml          — фид для «Автозагрузки»
  img/<nmID>-N.jpg  — фото WB, перегнанные из webp в JPEG (Авито принимает только JPEG/PNG)
  report.json       — что вошло, что нет и почему

Формат полей — docs/api-reference/openapi/avito/autoload-fields/.
Решения: business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md, п. 10 и 20;
карточка business-os/cards/podklyuchenie-avito.md.

Запуск: python3 avito/build_feed.py --base-url https://<хост>/<путь> [--out avito/out]
"""
import argparse, io, json, math, os, re, statistics, urllib.request
from xml.sax.saxutils import escape

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "cache", "avito")

ADDRESS = "Краснодарский край, Краснодар"
DELIVERY_FLOOR = 500          # ₽, доставка в полу цены, как у KIT (п. 20)
MAX_PHOTOS = 10
TITLE_MAX = 50
SILVER = re.compile(r"серебр(?!ист)|925")
SAMPLE = re.compile(r"^метеорит|образец|коллекционн", re.I)
FOOTER = ("\n\nВ наличии в Краснодаре: самовывоз или Авито Доставка по всей России. "
          "Отвечаем в сообщениях.")


def load(name):
    return json.load(open(os.path.join(CACHE, f"wb_{name}.json")))


def spp_and_net(fin):
    sales = [r for r in fin["rows"] if r.get("docTypeName") == "Продажа" and float(r.get("retailPriceWithDisc") or 0) > 0]
    spp = statistics.median(float(r["spp"]) for r in sales) / 100
    net = statistics.median(float(r["forPay"]) / float(r["retailPriceWithDisc"]) for r in sales)
    return spp, net, len(sales)


def price_for(seller, spp, net):
    """П. 10: цена продавца × (1 − СПП); не ниже нетто WB + доставка, не выше цены продавца.
    П. 20: округление вверх до 100 ₽."""
    target = max(seller * (1 - spp), seller * net + DELIVERY_FLOOR)
    return int(min(math.ceil(target / 100) * 100, math.ceil(seller)))


def is_silver(card):
    text = card.get("title", "") + " " + " ".join(
        str(ch.get("value")) for ch in card.get("characteristics", []) if "Цвет" not in ch["name"])
    return bool(SILVER.search(text.lower()))


def category(card):
    """(Category, GoodsType, GoodsSubType) или None, если площадка не принимает без данных, которых нет."""
    # в WB-предмете «Обереги» лежат и браслеты, и серьги, и фигурки — вид берём из названия
    subj, title = card["subjectName"], card.get("title", "")
    if subj == "Часы наручные":
        return None  # обязателен Brand из справочника brendy_fashion, его нет
    jewelry = lambda sub: ("Часы и украшения", "Бижутерия", sub)
    if subj == "Природные материалы для творчества" or SAMPLE.search(title) or re.search(r"фигурк", title, re.I):
        return ("Коллекционирование", "Другое", None)
    if re.search(r"браслет", title, re.I) or subj == "Браслеты":
        return jewelry("Браслеты")
    if re.search(r"серьг", title, re.I) or subj == "Серьги":
        return jewelry("Серьги")
    if re.search(r"кольц|перстен", title, re.I) or subj == "Кольца":
        return jewelry("Кольца и перстни")
    if re.search(r"бусин", title, re.I):
        return jewelry("Другое")
    if subj in ("Подвески бижутерные", "Шармы-подвески", "Обереги"):
        return jewelry("Кулоны и подвески")
    return None


WEIGHT = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:гр|г)\b\.?", re.I)
DANGLING = {"с", "и", "в", "из", "на", "для", "от", "по", "к", "у", "о", "а", "-", "–", "—", ":"}


def cut_words(text, limit):
    words, out = text.split(), ""
    for w in words:
        if len(out) + len(w) + (1 if out else 0) > limit:
            break
        out = f"{out} {w}".strip()
    parts = out.split()
    if len(parts) < len(words):
        # обрезано: не оставлять на конце предлог или прилагательное без существительного
        while parts and (parts[-1].lower().strip(",.:") in DANGLING
                         or re.search(r"(ым|им|ой|ого|его|ую|юю|ая|яя|ыми|ими)$", parts[-1].lower())):
            parts.pop()
    return " ".join(parts).rstrip(" ,.-–:")


def weight_of(card):
    m = WEIGHT.search(card.get("title", ""))
    if m:
        return m.group(1).replace(".", ",")
    for ch in card.get("characteristics", []):
        if ch["name"] == "Вес товара без упаковки (г)":
            v = ch.get("value")
            v = v[0] if isinstance(v, list) else v
            return str(v).replace(".", ",") if v else None
    return None


def short_title(card, sample):
    """До 50 символов, без обрыва на предлоге; у образца — вес в конце, иначе заголовки совпадают."""
    t = re.sub(r"\s+", " ", card["title"]).strip()
    t = re.sub(r"^коллекционный образец метеорит", "Метеорит", t, flags=re.I)
    w = weight_of(card) if sample else None
    num = re.search(r"№\s*\d+", t) if sample and not w else None
    if num:
        base = cut_words(t.split(",")[0].strip(), TITLE_MAX - len(num.group(0)) - 1)
        return f"{base} {num.group(0)}"
    if not w and len(t) <= TITLE_MAX:
        return t
    base = WEIGHT.sub("", t) if w else t
    base = re.sub(r"\s*(коллекционный образец|образец)\s*[:\-–]?\s*$", "", base.split(",")[0].strip(), flags=re.I)
    base = re.sub(r"[\s:\-–]+$", "", base)
    if w:
        tail = f", {w} г"
        return cut_words(base, TITLE_MAX - len(tail)) + tail
    return cut_words(base if len(base) <= TITLE_MAX else t, TITLE_MAX)


def to_jpeg(url, path):
    if os.path.exists(path):
        return
    with urllib.request.urlopen(url, timeout=60) as r:
        im = Image.open(io.BytesIO(r.read())).convert("RGB")
    im.save(path, "JPEG", quality=90)


def tag(name, value):
    return f"    <{name}>{escape(str(value))}</{name}>\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", required=True, help="где будут лежать feed.xml и img/")
    ap.add_argument("--out", default=os.path.join(ROOT, "avito", "out"))
    args = ap.parse_args()
    base = args.base_url.rstrip("/")
    os.makedirs(os.path.join(args.out, "img"), exist_ok=True)

    cards, prices, stocks, fin = load("cards"), load("prices"), load("stocks"), load("fin")
    spp, net, n_sales = spp_and_net(fin)
    amount = {s["sku"]: s["amount"] for s in stocks}
    price_by_size = {sz["sizeID"]: sz["discountedPrice"] for p in prices for sz in p["sizes"]}

    ads, skipped = [], []
    for c in cards:
        in_stock = [(sz, sum(amount.get(s, 0) for s in sz.get("skus", []))) for sz in c.get("sizes", [])]
        in_stock = [(sz, n) for sz, n in in_stock if n > 0]
        if not in_stock:
            continue
        why = None
        cat = category(c)
        if is_silver(c):
            why = "серебро 925: нужен спецучёт Пробирной палаты на Авито"
        elif cat is None:
            why = f"{c['subjectName']}: нет обязательного поля (Brand)"
        elif not c.get("photos"):
            why = "нет фото"
        seller = [price_by_size.get(sz["chrtID"]) for sz, _ in in_stock]
        seller = [p for p in seller if p]
        if not why and not seller:
            why = "нет цены WB"
        if why:
            skipped.append({"nmID": c["nmID"], "title": c["title"], "why": why})
            continue

        seller_price = min(seller)
        price = price_for(seller_price, spp, net)
        imgs = []
        for i, ph in enumerate(c["photos"][:MAX_PHOTOS], 1):
            name = f"{c['nmID']}-{i}.jpg"
            to_jpeg(ph["big"], os.path.join(args.out, "img", name))
            imgs.append(f"{base}/img/{name}")

        desc = (c.get("description") or c["title"]).strip()
        sizes = [sz.get("techSize") for sz, _ in in_stock if sz.get("techSize") not in (None, "0", "")]
        if sizes:
            desc += "\n\nВ наличии размеры: " + ", ".join(sizes) + "."
        desc = (desc + FOOTER)[:7500]
        d = c.get("dimensions") or {}
        ads.append({
            "nmID": c["nmID"], "vendorCode": c.get("vendorCode"), "title": short_title(c, cat[0] == "Коллекционирование"),
            "wb_title": c["title"], "category": cat, "seller_price": seller_price, "price": price,
            "units": sum(n for _, n in in_stock), "images": imgs, "description": desc, "dims": d,
        })

    xml = ['<?xml version="1.0" encoding="UTF-8"?>\n<Ads formatVersion="3" target="Avito.ru">\n']
    for a in ads:
        cat, gtype, sub = a["category"]
        x = "  <Ad>\n" + tag("Id", f"wb-{a['nmID']}") + tag("Address", ADDRESS)
        x += tag("Category", cat) + tag("GoodsType", gtype)
        if sub:
            x += tag("GoodsSubType", sub)
        x += tag("AdType", "Товар приобретен на продажу") + tag("Condition", "Новое")
        x += tag("Title", a["title"]) + tag("Price", a["price"])
        x += f"    <Description><![CDATA[{a['description'].replace(']]>', ']] >')}]]></Description>\n"
        x += "    <Images>\n" + "".join(f'      <Image url="{escape(u)}"/>\n' for u in a["images"]) + "    </Images>\n"
        x += tag("ContactMethod", "В сообщениях")
        x += "    <Delivery>\n" + "".join(f"      <Option>{o}</Option>\n" for o in ("ПВЗ", "Курьер", "Постамат")) + "    </Delivery>\n"
        dm = a["dims"]
        if dm.get("weightBrutto"):
            x += tag("WeightForDelivery", dm["weightBrutto"])
        for k, t in (("length", "LengthForDelivery"), ("height", "HeightForDelivery"), ("width", "WidthForDelivery")):
            if dm.get(k):
                x += tag(t, dm[k])
        xml.append(x + "  </Ad>\n")
    xml.append("</Ads>\n")
    open(os.path.join(args.out, "feed.xml"), "w").write("".join(xml))

    report = {"spp_median": round(spp, 4), "net_share": round(net, 4), "sales_in_median": n_sales,
              "period": fin["period"], "ads": len(ads), "units": sum(a["units"] for a in ads),
              "skipped": skipped,
              "items": [{k: a[k] for k in ("nmID", "vendorCode", "title", "category", "seller_price", "price", "units")}
                        for a in ads]}
    json.dump(report, open(os.path.join(args.out, "report.json"), "w"), ensure_ascii=False, indent=1)
    print(f"объявлений {len(ads)}, штук {report['units']}, пропущено {len(skipped)}; "
          f"СПП {spp:.1%}, нетто {net:.1%} по {n_sales} продажам")


if __name__ == "__main__":
    main()
