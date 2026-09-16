"""Убирает со всех карточек старое главное фото WB — то, что с вшитым названием и описанием.

После пересъёмки главным стал наш кадр, а прежнее главное уехало на второе место и осталось
висеть: белый фон, чужая типографика, дубль текста, который уже есть в карточке.

Список медиа собирается заново: наш кадр первым, затем исходные фото WB **кроме первого**.
Скрипт идемпотентен — повторный запуск не меняет результат.

Запуск: python3 scripts/kit_drop_second_photo.py
"""
from pathlib import Path
import json
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "site-assets/kit-cards-2026-09-13"
PLAN = ROOT / "site-assets/kit-cards-plan-2026-09-12.json"
API = "https://api.kit.yandex.net"
TIMEOUT = 25

TOK = next(l.split("=", 1)[1].strip().strip('"')
           for l in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
           if l.startswith("YAKIT_API_TOKEN="))


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Authorization": "Bearer " + TOK}
    if body is not None:
        h["Content-Type"] = "application/merge-patch+json"
    for attempt in range(6):
        r = urllib.request.Request(API + path, data=data, method=method, headers=h)
        try:
            # без таймаута запрос может висеть вечно — так уже подвешивало прогон
            with urllib.request.urlopen(r, timeout=TIMEOUT) as resp:
                return resp.status, json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 + attempt)
                continue
            return e.code, e.read()[:200].decode()
        except (urllib.error.URLError, OSError, TimeoutError):
            time.sleep(2 + attempt)
            continue
    return 0, "нет ответа"


def main():
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    man = {m["file"]: m for m in json.loads((CARDS / "manifest.json").read_text(encoding="utf-8"))}
    ok = err = 0
    log = []
    for n, x in enumerate(plan, 1):
        rec = man[f"{x['slot_id']}.png"]
        old = sorted(x["old_media"], key=lambda m: m["display_sequence"])
        media = [{"type": "IMAGE", "display_sequence": 0, "image_id": rec["image_id"]}]
        media += [{"type": "IMAGE", "display_sequence": i, "image_id": m["image_id"]}
                  for i, m in enumerate(old[1:], start=1)]
        code, d = req("PATCH", f"/v1/variants/{x['vid']}", body={"media": media})
        if code in (200, 201, 204):
            ok += 1
            log.append({"vid": x["vid"], "slot": x["slot_id"],
                        "removed_image_id": old[0]["image_id"], "photos_left": len(media)})
        else:
            err += 1
            print(f"  ошибка {x['slot_id']}: {code} {d}", flush=True)
        if n % 10 == 0:
            print(f"  {n}/{len(plan)}", flush=True)
        time.sleep(0.2)
    (CARDS / "removed-second-photo.json").write_text(
        json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"убрано второе фото: {ok}, ошибок: {err}", flush=True)


if __name__ == "__main__":
    main()
