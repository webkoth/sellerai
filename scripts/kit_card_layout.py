"""Посадка нижнего текста на карточках товара: считает `bottomInset` для каждой сцены.

Задача: текст не должен лежать на изделии, но и не должен уезжать под плашки Wildberries.
Совместить удаётся не всегда — у части сцен изделие опускается почти до низа кадра.
Приоритет: изделие важнее плашки. Правило:

    низ_блока = clamp(низ_изделия + зазор + высота_блока,  минимум = над плашками,
                                                           максимум = исходный низ кадра)

Откуда берутся числа:

- **низ изделия** — из самой сцены. Фон у сцен ровный по горизонтали (туман, мрамор,
  сланец), изделие — единственное, что заметно отличается от медианы своей строки.
  Считаем долю таких пикселей в центральных 70% ширины и идём вниз от пика.
  Проверено на 15 сценах, размеченных глазами по сетке: средняя ошибка 0.04 высоты,
  промах всегда в сторону «ниже, чем есть» — то есть в безопасную.
- **высота блока** — из маски текста. Композиция рендерится второй раз с плоским фоном
  (`--props` подменяет background и photo на kit-bg/flat-mask.png), вуаль постоянна вдоль
  строки, поэтому текст видно как отклонение от построчной медианы.
- **зона плашек WB** — замерена по DOM на живом Wildberries 13.09.2026, см. README
  в site-assets/kit-cards-2026-09-13.

Запуск (нужны отрендеренные маски в /private/tmp/hmask):
    npx remotion bundle --out-dir=/private/tmp/hbundle
    for id in ...; do npx remotion still /private/tmp/hbundle "Kit-$id" /private/tmp/hmask/$id.png \
        --props='{"background":"kit-bg/flat-mask.png","photo":"kit-bg/flat-mask.png"}'; done
    python3 scripts/kit_card_layout.py
"""
from pathlib import Path
import json

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCENES = ROOT / "remotionvideo/public/kit-scenes-hs"
MASKS = Path("/private/tmp/hmask")
PLAN = ROOT / "site-assets/kit-cards-plan-2026-09-12.json"
OUT = ROOT / "site-assets/kit-cards-2026-09-13/layout.json"

W, H = 1200, 1600
TEXT_SCALE = 1.35
NOTE_SLOT = (22 * TEXT_SCALE * 1.25 + 18 * TEXT_SCALE) / H   # строка веса + отступ над ней
WB_BADGE_TOP = 0.836                                          # верх зоны плашек Wildberries
LOWEST = 1 - 86.4 / H                                         # ниже исходного низа не опускаемся
CLEARANCE = 0.010                                             # зазор между изделием и текстом


def product_bottom(i: int) -> float:
    """Низ изделия в сцене, доля высоты кадра."""
    a = np.asarray(Image.open(SCENES / f"scene_{i:03d}.jpg").convert("L").resize((W, H), Image.LANCZOS),
                   dtype=np.float32)
    c = a[:, int(W * 0.15):int(W * 0.85)]
    p = (np.abs(c - np.median(c, axis=1, keepdims=True)) > 85).sum(axis=1) / c.shape[1]
    rows = np.where(p > 0.07)[0]
    rows = rows[(rows > H * 0.2) & (rows < H * 0.92)]
    if not len(rows):
        return 0.70
    y = rows[np.argmax(p[rows])]
    gap = 0
    while y < H * 0.92 - 1 and gap < 25:
        y += 1
        gap = 0 if p[y] > 0.07 else gap + 1
    return (y - gap) / H


def text_block(i: int) -> tuple[float, float]:
    """Верх и низ нижнего текстового блока по маске, доли высоты кадра."""
    a = np.asarray(Image.open(MASKS / f"hcard-{i:03d}.png").convert("L"), dtype=np.float32)
    rows = (np.abs(a - np.median(a, axis=1, keepdims=True)) > 25).sum(axis=1)
    lo = int(H * 0.45)
    idx = np.where(rows[lo:] > 8)[0]
    return (lo + idx[0]) / H, (lo + idx[-1]) / H


def main() -> None:
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    fix = json.loads(Path("/tmp/cards-fix.json").read_text(encoding="utf-8"))
    out = []
    for x in plan:
        i = x["i"]
        pb = product_bottom(i)
        top, bot = text_block(i)
        block_h = bot - top
        has_note = bool(fix[str(i)]["note"])
        ideal = WB_BADGE_TOP + (NOTE_SLOT if has_note else 0)
        bottom = min(LOWEST, max(ideal, pb + CLEARANCE + block_h))
        out.append({"i": i, "slot_id": x["slot_id"], "product_bottom": round(pb, 3),
                    "block_height": round(block_h, 3), "bottom_inset": round(1 - bottom, 4),
                    "text_top": round(bottom - block_h, 3),
                    "clears_wb_badges": bool(bottom <= ideal + 1e-6)})
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    over = [o for o in out if o["text_top"] < o["product_bottom"]]
    print(f"посчитано: {len(out)} | над плашками WB: {sum(o['clears_wb_badges'] for o in out)} | "
          f"текст всё ещё близко к изделию: {len(over)}")
    for o in over:
        print(f"  #{o['i']}: низ изделия {o['product_bottom']}, верх текста {o['text_top']} "
              f"(ниже опускать некуда)")


if __name__ == "__main__":
    main()
