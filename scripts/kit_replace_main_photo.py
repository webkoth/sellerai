"""Замена главного фото карточки товара в KIT на карточку из site-assets/kit-cards-2026-09-13.

Главное фото — это media с display_sequence 0. Оно показывается в каталоге, в поиске
и в рекламе. Список медиа собирается заново из двух частей: новая карточка первой,
затем исходные фото WB в прежнем порядке (`old_media` из плана). Поэтому скрипт
идемпотентен: сколько раз ни запусти, карточка на витрине будет ровно одна и первой.

Запуск: python3 scripts/kit_replace_main_photo.py
После прогона перезаписывается site-assets/kit-cards-2026-09-13/manifest.json:
у каждой записи появляется image_id и публичный url, status_v_kit становится «залито».
"""
from pathlib import Path
import json
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "site-assets/kit-cards-2026-09-13"
PLAN = ROOT / "site-assets/kit-cards-plan-2026-09-12.json"
API = "https://api.kit.yandex.net"

TOK = next(l.split("=", 1)[1].strip().strip('"')
           for l in (ROOT / ".env").read_text(encoding="utf-8").splitlines()
           if l.startswith("YAKIT_API_TOKEN="))


def req(method, path, body=None, raw=None, ctype=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    headers = {"Authorization": "Bearer " + TOK}
    if ctype:
        headers["Content-Type"] = ctype
    elif body is not None:
        headers["Content-Type"] = "application/merge-patch+json"
    for attempt in range(6):
        r = urllib.request.Request(API + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(r) as resp:
                return resp.status, json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503):
                time.sleep(1.5 + attempt)
                continue
            return e.code, e.read()[:300].decode()
    return 0, "нет ответа"


def upload(path):
    b = "----kit" + uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
            f"Content-Type: image/png\r\n\r\n").encode() + path.read_bytes() + f"\r\n--{b}--\r\n".encode()
    code, d = req("POST", "/v1/files", raw=body, ctype=f"multipart/form-data; boundary={b}")
    if code != 200:
        raise SystemExit(f"{path.name}: загрузка не прошла, {code} {d}")
    return d


def main():
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    manifest = {m["file"]: m for m in json.loads((CARDS / "manifest.json").read_text(encoding="utf-8"))}
    errors = 0
    for n, x in enumerate(plan, 1):
        card = CARDS / f"{x['slot_id']}.png"
        f = upload(card)
        old = sorted(x["old_media"], key=lambda m: m["display_sequence"])
        media = [{"type": "IMAGE", "display_sequence": 0, "image_id": f["id"]}]
        media += [{"type": "IMAGE", "display_sequence": i, "image_id": m["image_id"]}
                  for i, m in enumerate(old, start=1)]
        code, d = req("PATCH", f"/v1/variants/{x['vid']}", body={"media": media})
        rec = manifest[card.name]
        if code != 200:
            errors += 1
            rec["status_v_kit"] = f"ошибка {code}"
            print(f"  ошибка {x['slot_id']}: {code} {d}")
        else:
            rec["status_v_kit"] = "залито"
            rec["image_id"] = f["id"]
            rec["url"] = f["url"]
            rec["current_main_image_id"] = f["id"]
        if n % 10 == 0:
            print(f"  {n}/{len(plan)}")
        time.sleep(0.3)
    (CARDS / "manifest.json").write_text(
        json.dumps(list(manifest.values()), ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"заменено главных фото: {len(plan) - errors}, ошибок: {errors}")


if __name__ == "__main__":
    main()
