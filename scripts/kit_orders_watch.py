#!/usr/bin/env python3
"""
Монитор заказов Яндекс KIT → Telegram.

Опрашивает GET /v1/orders, сравнивает со снимком в data/state/kit-orders.json
и шлёт в Telegram новые заказы и смены статуса. Вебхуки KIT требуют публичный
HTTPS-эндпоинт — поллинг обходится без него.

Использование:
    python scripts/kit_orders_watch.py --dry-run     # показать, ничего не слать
    python scripts/kit_orders_watch.py               # слать в Telegram
    python scripts/kit_orders_watch.py --seed        # запомнить текущие заказы без уведомлений

Крон (каждые 5 минут):
    */5 * * * * /usr/bin/python3 /opt/sellerai-sync/scripts/kit_orders_watch.py >> /opt/sellerai-sync/logs/cron-kit-orders.log 2>&1
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "data" / "state" / "kit-orders.json"
API = "https://api.kit.yandex.net"

STATUS_RU = {
    "NEW": "новый",
    "PENDING_PAYMENT": "ждёт оплаты",
    "ORDER_PLACED": "оформлен",
    "WAIT_FOR_CONFIRMATION": "ждёт подтверждения",
    "CREATING_INITIAL_RECEIPT": "создаётся чек",
    "SETUP_DELIVERY": "настройка доставки",
    "WAIT_FOR_DELIVERY": "ждёт доставки",
    "CANCELLATION_IN_PROGRESS": "отменяется",
    "DELIVERED": "доставлен",
    "CANCELLED": "отменён",
    "COMPLETED": "завершён",
}


def env(name: str) -> str:
    val = os.environ.get(name)
    if val:
        return val
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    return ""


def kit_get(path: str) -> dict:
    req = urllib.request.Request(API + path, headers={"Authorization": "Bearer " + env("YAKIT_API_TOKEN")})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 * (attempt + 1))
                continue
            raise SystemExit(f"KIT API {e.code}: {e.read().decode()[:200]}")
        except OSError:
            time.sleep(2 * (attempt + 1))
    raise SystemExit("KIT API: не отвечает")


def fetch_orders() -> list:
    orders, page = [], 1
    while True:
        batch = kit_get(f"/v1/orders?per_page=100&page={page}").get("orders", [])
        orders += batch
        if len(batch) < 100:
            return orders
        page += 1


def money(v) -> str:
    try:
        return f"{float(v):,.0f} ₽".replace(",", " ")
    except (TypeError, ValueError):
        return "—"


def describe(o: dict) -> str:
    num = o.get("order_number") or o.get("id", "")[:8]
    total = money(o.get("total_final_price") or o.get("total_price"))
    status = STATUS_RU.get(o.get("status"), o.get("status", "?"))
    client = o.get("client") or {}
    who = " ".join(x for x in (client.get("name"), client.get("phone")) if x)
    items = o.get("items") or []
    lines = [f"🛒 <b>KIT · заказ #{num}</b>", f"Статус: {status} · {total}"]
    if who:
        lines.append(f"Покупатель: {who}")
    if items:
        lines.append(f"Позиций: {len(items)}")
    return "\n".join(lines)


def notify(text: str, dry: bool) -> None:
    if dry:
        print("[dry-run]\n" + text + "\n")
        return
    token = env("TELEGRAM_BOT_TOKEN")
    chat = json.loads((ROOT / "data" / "mappings" / "sync-config.json").read_text(encoding="utf-8"))["telegram"]["chat_id"]
    data = urllib.parse.urlencode({"chat_id": chat, "text": text, "parse_mode": "HTML"}).encode()
    try:
        with urllib.request.urlopen(f"https://api.telegram.org/bot{token}/sendMessage", data=data, timeout=30) as r:
            r.read()
    except urllib.error.HTTPError as e:
        print(f"Telegram {e.code}: {e.read().decode()[:200]}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="показать, ничего не отправлять")
    ap.add_argument("--seed", action="store_true", help="записать текущее состояние без уведомлений")
    args = ap.parse_args()

    seen = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    orders = fetch_orders()
    fresh, changed = [], []

    for o in orders:
        oid = o.get("id")
        prev = seen.get(oid)
        if prev is None:
            fresh.append(o)
        elif prev.get("status") != o.get("status"):
            changed.append((prev.get("status"), o))
        seen[oid] = {"status": o.get("status"), "order_number": o.get("order_number"),
                     "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    if args.seed:
        STATE.write_text(json.dumps(seen, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"запомнено заказов: {len(seen)} (уведомления не отправлялись)")
        return

    for o in fresh:
        notify(describe(o), args.dry_run)
    for was, o in changed:
        notify(describe(o) + f"\n<i>было: {STATUS_RU.get(was, was)}</i>", args.dry_run)

    if not args.dry_run:
        STATE.write_text(json.dumps(seen, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"заказов всего: {len(orders)} | новых: {len(fresh)} | сменили статус: {len(changed)}")


if __name__ == "__main__":
    main()
