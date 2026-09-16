#!/usr/bin/env python3
"""
SEO-разметка товаров Яндекс KIT: seo_title, seo_description, seo_h1.

Требования KIT к заголовку: 50-70 символов, название товара в начале, бренд в конце,
без повторов слов подряд. Описание строится из названия и фразы по типу изделия
(метеорит / оберег / браслет / подвеска), фраза выбирается так, чтобы не повторять
начало названия.

Использование:
    python scripts/kit_seo_products.py                    # предпросмотр
    python scripts/kit_seo_products.py --apply            # записать всем товарам
    python scripts/kit_seo_products.py --apply --only-published
"""

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.kit.yandex.net"
BRAND = " — KOTELNIKOVARTIFACT"
CORE_MAX = 70 - len(BRAND)          # 49
CORE_MIN = 50 - len(BRAND)          # 29

MET_A = "Коллекционный образец с фото реального экземпляра. Отправка из Краснодара по России, упаковка для хрупких образцов."
MET_B = "Каждый образец уникален: вес, форма и природный рисунок не повторяются. Отправка из Краснодара, упаковка для хрупких образцов."

# slug категории -> (хвост для короткого заголовка, основная фраза, запасная фраза)
CAT = {
    "kollekcionnye-obrazcy": ("коллекционный образец", MET_A, MET_B),
    "meteority-i-mineraly": ("коллекционный образец", MET_A, MET_B),
    "oberegi": ("оберег ручной работы",
                "Оберег ручной работы с натуральными камнями и сакральной символикой. Отправка из Краснодара по всей России.",
                "Ручная работа, авторское изделие с натуральными камнями и сакральной символикой. Отправка из Краснодара по России."),
    "amulety-i-oberegi": ("оберег ручной работы",
                "Оберег ручной работы с натуральными камнями и сакральной символикой. Отправка из Краснодара по всей России.",
                "Ручная работа, авторское изделие с натуральными камнями и сакральной символикой. Отправка из Краснодара по России."),
    "podveski-i-kulony": ("украшение ручной работы",
                "Авторская подвеска ручной работы, собирается вручную в единственном экземпляре. Отправка из Краснодара по всей России.",
                "Ручная работа, изделие собирается вручную в единственном экземпляре. Отправка из Краснодара по всей России."),
    "braslety": ("украшение ручной работы",
                "Браслет ручной сборки из натуральных камней. Каждое изделие собирается вручную. Отправка из Краснодара по России.",
                "Ручная сборка из натуральных камней, каждое изделие уникально. Отправка из Краснодара по всей России."),
    "sharmy-podveski": ("украшение ручной работы",
                "Шарм-подвеска ручной работы. Дополняет браслет или цепочку. Отправка из Краснодара по всей России.",
                "Ручная работа, дополняет браслет или цепочку. Отправка из Краснодара по всей России."),
    "kolca": ("украшение ручной работы",
                "Авторское кольцо ручной работы. Отправка из Краснодара по всей России.",
                "Ручная работа, авторское изделие. Отправка из Краснодара по всей России."),
    "sergi": ("украшение ручной работы",
                "Авторские серьги ручной работы. Отправка из Краснодара по всей России.",
                "Ручная работа, авторское изделие. Отправка из Краснодара по всей России."),
    "chasy-naruchnye": ("", "Наручные часы из ассортимента KOTELNIKOVARTIFACT. Отправка из Краснодара по всей России.",
                "Из ассортимента KOTELNIKOVARTIFACT. Отправка из Краснодара по всей России."),
    "otkrytki": ("", "Открытка и подарочное оформление к украшениям KOTELNIKOVARTIFACT.",
                "Подарочное оформление к украшениям KOTELNIKOVARTIFACT."),
}
DEFAULT = ("украшение со смыслом",
           "Авторское изделие ручной работы. Отправка из Краснодара по всей России.",
           "Ручная работа, авторское изделие. Отправка из Краснодара по всей России.")


def token() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("YAKIT_API_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("YAKIT_API_TOKEN не найден в .env")


TOK = token()


def req(method: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(6):
        r = urllib.request.Request(API + path, data=data, method=method, headers={
            "Authorization": "Bearer " + TOK, "Content-Type": "application/merge-patch+json"})
        try:
            with urllib.request.urlopen(r, timeout=40) as resp:
                return resp.status, json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(1.5 * (attempt + 1))
                continue
            return e.code, e.read().decode()[:300]
        except OSError:
            time.sleep(1.5 * (attempt + 1))
    return 0, "retries exhausted"


def page_all(path: str, key: str) -> list:
    out, page = [], 1
    while True:
        code, d = req("GET", f"{path}{'&' if '?' in path else '?'}per_page=100&page={page}")
        if code != 200:
            raise SystemExit(f"{path}: {code} {d}")
        batch = d.get(key, [])
        out += batch
        if len(batch) < 100:
            return out
        page += 1


def clean(name: str) -> str:
    n = re.sub(r"\s+", " ", (name or "").strip())
    return re.sub(r"\s+[-–—]\s+", " — ", n)          # дефис внутри слова (Сихотэ-Алинь) не трогаем


def cut_words(s: str, limit: int) -> str:
    if len(s) <= limit:
        return s
    out = []
    for w in s.split(" "):
        if len(" ".join(out + [w])) > limit:
            break
        out.append(w)
    return re.sub(r"[\s,—\-–]+$", "", " ".join(out)) or s[:limit]


def make_title(name: str, tail: str) -> str:
    n = clean(name)
    if len(n) > CORE_MAX and " — " in n:             # режем по смысловой границе, а не посреди фразы
        head = n.split(" — ")[0].strip()
        if CORE_MIN <= len(head) <= CORE_MAX:
            n = head
    core = cut_words(n, CORE_MAX)
    for add in (tail, "подарок со смыслом", "купить"):
        if len(core) >= CORE_MIN or not add:
            break
        if add.split()[0].lower() in core.lower():
            continue
        cand = f"{core}, {add}"
        if len(cand) <= CORE_MAX:
            core = cand
    return core + BRAND


def make_desc(name: str, phrase: str, alt: str) -> str:
    n = clean(name)
    nl = n.lower()
    if nl.startswith(("метеорит", "коллекционный образец")) or "коллекционный образец" in nl:
        phrase, alt = MET_A, MET_B                   # тип изделия важнее категории, унаследованной от WB
    first = phrase.split()[0].lower().strip(".,:").replace("-", " ").split()[0]
    head = " ".join(phrase.split()[:2]).lower().strip(".,").replace("-", " ")
    flat = nl.replace("-", " ")
    if (head and head in flat) or first in flat.split()[:3]:
        phrase = alt
    sep = " " if n.endswith((".", "!", "?", "…")) else ". "
    d = f"{n}{sep}{phrase}"
    return cut_words(d, 175) + "…" if len(d) > 178 else d


def build(variants: list, prods: list, cats: list) -> list:
    pid2cat = {p["id"]: (p.get("category_ids") or []) for p in prods}
    cid2slug = {c["id"]: c["slug"] for c in cats}
    out = []
    for v in variants:
        if v["sku"] == "Тестовый":
            continue
        tail, phrase, alt = DEFAULT
        for cid in pid2cat.get(v.get("product_id"), []):
            slug = cid2slug.get(cid)
            if slug in CAT:
                tail, phrase, alt = CAT[slug]
                break
        out.append((v, {"seo_title": make_title(v["name"], tail),
                        "seo_description": make_desc(v["name"], phrase, alt),
                        "seo_h1": clean(v["name"])}))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--only-published", action="store_true")
    args = ap.parse_args()

    variants = page_all("/v1/variants", "variants")
    prods = page_all("/v1/products", "products")
    code, d = req("GET", "/v1/categories?status=ACTIVE&per_page=100")
    items = build(variants, prods, d["categories"])
    if args.only_published:
        items = [(v, s) for v, s in items if v["status"] == "PUBLISHED"]

    lens = [len(s["seo_title"]) for _, s in items]
    todo = [(v, s) for v, s in items if any((v.get(k) or "") != s[k] for k in s)]
    print(f"товаров: {len(items)} | title {min(lens)}-{max(lens)} симв., вне 50-70: "
          f"{sum(1 for x in lens if not 50 <= x <= 70)} | к обновлению: {len(todo)}")

    if not args.apply:
        for v, s in todo[:5]:
            print(f"\n{v['name'][:60]}\n  было: {(v.get('seo_description') or '—')[:110]}\n  стало: {s['seo_description'][:110]}")
        raise SystemExit("\n(предпросмотр; для записи --apply)")

    ok = err = 0
    for i, (v, s) in enumerate(todo, 1):
        code, r = req("PATCH", "/v1/variants/" + v["id"], s)
        if code == 200:
            ok += 1
        else:
            err += 1
            print(f"  ERR {v['name'][:40]} {code} {r}")
        if i % 25 == 0:
            print(f"  {i}/{len(todo)} ok={ok} err={err}", flush=True)
        time.sleep(0.1)
    print(f"ГОТОВО ok={ok} err={err}")


if __name__ == "__main__":
    main()
