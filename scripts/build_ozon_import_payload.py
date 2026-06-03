#!/usr/bin/env python3
"""
Готовит payload для импорта на Ozon из data/wb_products_in_stock.json.

Стратегия B (безопасная):
  - 40 WB-карточек, которых НЕТ на Ozon → импортируем как новые (import/prices/stocks).
  - 30 WB-карточек, которые УЖЕ есть на Ozon (по offer_id=vendorCode) → только обновляем
    остатки и цены, структуру не трогаем.
  - «Часы наручные» (1 WB-карточка) пропускаем — нет подходящего type_id в категории
    «Бижутерные украшения».

Все 70 попадут в payload для prices и stocks (30 пересечений + 40 новых = 70).
Один WB subjectName → один Ozon type_id (см. MAP_TYPE).

Выход: data/ozon_import/{products,prices,stocks,skipped,meta}.json
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WB_FILE = ROOT / "data" / "wb_products_in_stock.json"
OZON_FILE = ROOT / "data" / "ozon_products_in_stock.json"
OUT_DIR = ROOT / "data" / "ozon_import"

DESCRIPTION_CATEGORY_ID = 17027899  # Бижутерные украшения
WAREHOUSE_ID = 1020005003459950  # «Краснодар» (FBS, status=created)
VAT = "0"  # НДС 0% для физлиц/ИП на спецрежимах

# subjectName (WB) → type_id (Ozon), внутри категории «Бижутерные украшения»
MAP_TYPE = {
    "Подвески бижутерные": 87458901,  # Подвеска
    "Обереги":             87458901,  # Подвеска (обереги = подвески)
    "Шармы-подвески":      87593414,  # Шарм
    "Браслеты":            87458883,  # Браслет
    "Кольца":              87458895,  # Кольцо
    "Природные материалы для творчества": 971038154,  # Камень бижутерный
    # "Часы наручные" — намеренно пропущено
}

# Общие атрибуты, скопированные с уже одобренной Ozon-карточки клиента
# (значения взяты из /tmp/ozon_sample_attrs.json — карточка 3320038150)
COMMON_ATTRS = [
    # === обязательные ===
    {"id":    85, "complex_id": 0, "values": [{"dictionary_value_id": 126745801, "value": "Нет бренда"}]},  # Бренд
    {"id":  9163, "complex_id": 0, "values": [{"dictionary_value_id": 22880, "value": "Мужской"},
                                                {"dictionary_value_id": 22881, "value": "Женский"}]},  # Пол: унисекс
    # 8229 Тип — ставим отдельно per type_id ниже
    # 9048 Название модели — ставим отдельно per товар (= vendorCode)
    # === рекомендованные, с копии образца ===
    {"id":  9390, "complex_id": 0, "values": [{"dictionary_value_id": 43241, "value": "Взрослая"}]},
    {"id":  4389, "complex_id": 0, "values": [{"dictionary_value_id": 90295, "value": "Россия"}]},
    {"id":  5326, "complex_id": 0, "values": [{"dictionary_value_id": 39290, "value": "Безразмерный"}]},
    {"id": 22270, "complex_id": 0, "values": [{"dictionary_value_id": 971417783, "value": "Ручная, авторская работа"}]},
    {"id": 11364, "complex_id": 0, "values": [{"dictionary_value_id": 971149016, "value": "Без покрытия"}]},
    {"id":  5292, "complex_id": 0, "values": [{"dictionary_value_id": 970941536, "value": "Натуральный камень"}]},
    {"id": 10016, "complex_id": 0, "values": [{"dictionary_value_id": 970672426, "value": "Повседневный"}]},
    {"id":  9917, "complex_id": 0, "values": [{"dictionary_value_id": 970673584, "value": "Символика"}]},
    {"id":  4386, "complex_id": 0, "values": [{"dictionary_value_id": 85843, "value": "Подарочная коробка"}]},
    {"id":  5309, "complex_id": 0, "values": [{"dictionary_value_id": 62099, "value": "Сталь"}]},  # Материал
    {"id": 10096, "complex_id": 0, "values": [{"dictionary_value_id": 61576, "value": "серый"}]},  # Цвет по умолчанию
]

# Доп. атрибуты, осмысленные только для Браслета
BRACELET_EXTRA = [
    {"id":  5308, "complex_id": 0, "values": [{"dictionary_value_id": 972086488, "value": "Затягивающийся"}]},
    {"id":  9925, "complex_id": 0, "values": [{"dictionary_value_id": 970630277, "value": "со вставками"}]},
    {"id": 23073, "complex_id": 0, "values": [{"dictionary_value_id": 972086681, "value": "на запястье"}]},
    {"id": 23326, "complex_id": 0, "values": [{"dictionary_value_id": 972866483, "value": "Браслет на руку"}]},
]


def extract_color(characteristics):
    """Цвет из WB-характеристик → ближайший dict_value Ozon."""
    color_map = {
        "серебристый": 61576,
        "серый": 61576,
        "золотистый": 61572,
        "чёрный": 61574, "черный": 61574,
        "черный каменный": 61574,
        "коричневый": 61577,
        "белый": 61571,
    }
    for ch in characteristics or []:
        if ch.get("name", "").lower() == "цвет":
            v = ch.get("value") or []
            if isinstance(v, list) and v:
                key = str(v[0]).lower()
                if key in color_map:
                    return color_map[key], str(v[0])
    return None, None


def extract_country(characteristics):
    for ch in characteristics or []:
        name = (ch.get("name") or "").lower()
        if "страна" in name and "производ" in name:
            v = ch.get("value") or []
            if isinstance(v, list) and v:
                val = str(v[0])
                if val.lower() == "россия":
                    return 90295
                if val.lower() == "китай":
                    return 90298
    return 90295  # Россия по умолчанию


def build_attributes(product, type_id):
    """Полный массив атрибутов под один товар."""
    attrs = list(COMMON_ATTRS)  # копия

    # Тип — привязан к type_id (в словаре 1960 id значения == type_id)
    attrs.append({"id": 8229, "complex_id": 0, "values": [{"dictionary_value_id": type_id, "value": ""}]})

    # Название модели (для объединения) = vendorCode
    attrs.append({"id": 9048, "complex_id": 0, "values": [{"dictionary_value_id": 0, "value": product["vendorCode"]}]})
    # Название (marketing) = title
    attrs.append({"id": 4180, "complex_id": 0, "values": [{"dictionary_value_id": 0, "value": product["title"][:200]}]})
    # Аннотация = description
    desc = (product.get("description") or "")[:6000]
    if desc:
        attrs.append({"id": 4191, "complex_id": 0, "values": [{"dictionary_value_id": 0, "value": desc}]})
    # Код продавца = vendorCode
    attrs.append({"id": 9024, "complex_id": 0, "values": [{"dictionary_value_id": 0, "value": product["vendorCode"]}]})

    # Вес в граммах
    dims = product.get("dimensions") or {}
    weight_kg = dims.get("weightBrutto") or dims.get("weight") or 0.1
    attrs.append({"id": 4383, "complex_id": 0, "values": [{"dictionary_value_id": 0, "value": str(int(weight_kg * 1000))}]})

    # Перекрываем цвет, если найден в характеристиках
    color_id, color_name = extract_color(product.get("characteristics"))
    if color_id:
        attrs = [a for a in attrs if a["id"] != 10096]
        attrs.append({"id": 10096, "complex_id": 0, "values": [{"dictionary_value_id": color_id, "value": color_name}]})

    # Перекрываем страну
    country_id = extract_country(product.get("characteristics"))
    attrs = [a for a in attrs if a["id"] != 4389]
    attrs.append({"id": 4389, "complex_id": 0, "values": [{"dictionary_value_id": country_id, "value": ""}]})

    # Доп. атрибуты для Браслета
    if type_id == 87458883:  # Браслет
        attrs.extend(BRACELET_EXTRA)

    return attrs


def build_product_payload(product, type_id):
    """Один элемент для POST /v3/product/import."""
    dims = product.get("dimensions") or {}
    length = dims.get("length") or 30
    width = dims.get("width") or 20
    height = dims.get("height") or 10
    weight_kg = dims.get("weightBrutto") or dims.get("weight") or 0.1

    # Баркод — первый из sizes[].barcode
    barcode = ""
    for s in product.get("sizes", []):
        if s.get("barcode"):
            barcode = s["barcode"]; break

    pictures = (product.get("photos") or [])[:15]
    price_final = product.get("discountedPrice") or product.get("price") or 0
    price_base = product.get("price") or price_final

    payload = {
        "offer_id": product["vendorCode"],
        "name": product["title"][:200],
        "description_category_id": DESCRIPTION_CATEGORY_ID,
        "type_id": type_id,
        "price": str(int(price_final)),
        "old_price": str(int(price_base)) if price_base > price_final else "0",
        "vat": VAT,
        "weight": int(weight_kg * 1000),  # граммы
        "weight_unit": "g",
        "depth": int(length * 10),        # мм
        "width": int(width * 10),
        "height": int(height * 10),
        "dimension_unit": "mm",
        "barcode": barcode,
        "images": pictures,
        "primary_image": pictures[0] if pictures else "",
        "attributes": build_attributes(product, type_id),
    }
    return payload


def main():
    wb = json.loads(WB_FILE.read_text())
    ozon = json.loads(OZON_FILE.read_text())
    ozon_offers = {p["offerId"] for p in ozon["products"] if p.get("offerId")}

    new_products = []
    prices = []
    stocks = []
    skipped = []
    updates_only = []  # уже есть на Ozon — только цена и остаток

    for p in wb["products"]:
        type_id = MAP_TYPE.get(p.get("subjectName"))
        if not type_id:
            skipped.append({
                "nmId": p["nmId"], "vendorCode": p["vendorCode"],
                "subjectName": p.get("subjectName"), "title": p["title"],
                "reason": "нет Ozon type_id для этой WB-категории",
            })
            continue

        price_final = p.get("discountedPrice") or p.get("price") or 0
        price_base = p.get("price") or price_final

        # Остаток суммируем по всем размерам (на Ozon одна карточка на vendorCode)
        total_stock = sum(s["stock"] for s in p.get("sizes", []))

        # Цены и остатки — для ВСЕХ (существующих и новых)
        prices.append({
            "offer_id": p["vendorCode"],
            "price": str(int(price_final)),
            "old_price": str(int(price_base)) if price_base > price_final else "0",
            "min_price": str(int(price_final * 0.8)),  # 80% от текущей — минимум для Ozon
            "currency_code": "RUB",
        })
        stocks.append({
            "offer_id": p["vendorCode"],
            "warehouse_id": WAREHOUSE_ID,
            "stock": int(total_stock),
        })

        if p["vendorCode"] in ozon_offers:
            updates_only.append(p["vendorCode"])
        else:
            new_products.append(build_product_payload(p, type_id))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "products.json").write_text(json.dumps(new_products, ensure_ascii=False, indent=2))
    (OUT_DIR / "prices.json").write_text(json.dumps(prices, ensure_ascii=False, indent=2))
    (OUT_DIR / "stocks.json").write_text(json.dumps(stocks, ensure_ascii=False, indent=2))
    (OUT_DIR / "skipped.json").write_text(json.dumps(skipped, ensure_ascii=False, indent=2))
    (OUT_DIR / "meta.json").write_text(json.dumps({
        "description_category_id": DESCRIPTION_CATEGORY_ID,
        "warehouse_id": WAREHOUSE_ID,
        "mapTypeByWbSubject": MAP_TYPE,
        "updatesOnlyOfferIds": updates_only,
        "counts": {
            "wbInStock": len(wb["products"]),
            "newToImport": len(new_products),
            "updatesOnly": len(updates_only),
            "prices": len(prices),
            "stocks": len(stocks),
            "skipped": len(skipped),
        },
    }, ensure_ascii=False, indent=2))

    print(f"✅ Payload готов: data/ozon_import/")
    print(f"   Новых карточек:      {len(new_products)}")
    print(f"   Только обновить:     {len(updates_only)} (уже на Ozon)")
    print(f"   Цен всего:           {len(prices)}")
    print(f"   Остатков всего:      {len(stocks)}")
    print(f"   Пропущено:           {len(skipped)}")
    if skipped:
        for s in skipped:
            print(f"     ⏭  {s['vendorCode']} / {s['subjectName']}: {s['title'][:60]}")

    # Распределение по type_id
    from collections import Counter
    by_type = Counter(p["type_id"] for p in new_products)
    print(f"\n  Новых по type_id:")
    type_names = {87458901: "Подвеска", 87458883: "Браслет", 87458895: "Кольцо",
                   87593414: "Шарм", 971038154: "Камень бижутерный"}
    for tid, n in by_type.most_common():
        print(f"    {type_names.get(tid, tid)} ({tid}): {n}")


if __name__ == "__main__":
    main()
