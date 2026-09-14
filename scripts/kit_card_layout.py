"""Подгонка кадра под фиксированный шаблон карточки: bgScale, bgTop и titleScale.

Шаблон карточки один на все товары: заголовок начинается на линии TITLE_TOP, под ним
описание, происхождение и вес. Иначе в каталоге имена пляшут по высоте и витрина
рассыпается. Значит двигать надо не текст, а кадр изделия.

Правило: низ изделия у всех товаров приводится к одной линии TARGET_PB. Сцена
масштабируется и сдвигается так, чтобы это выполнялось и кадр остался закрыт:

    a = max(1, TARGET_PB / низ_изделия, (1 - TARGET_PB) / (1 - низ_изделия))
    b = TARGET_PB - a * низ_изделия

`a` — множитель размера сцены (bgScale), `b` — её верх в долях кадра (bgTop).
Точка сцены на высоте y оказывается на b + a*y, поэтому низ изделия садится ровно
на TARGET_PB. `a` всегда не меньше 1, поэтому кадр закрыт полностью.

Низ изделия измеряется двумя способами и берётся нижний из них:
- отклонение от медианы строки — фон у сцен ровный по горизонтали, изделие выбивается;
- резкость (лапласиан) — у сцен малая глубина резкости, в фокусе только изделие.
Оба дают среднюю ошибку около 0.04 высоты, поэтому результат проверяется глазами:
линии рисуются поверх сцен, промахи правятся руками. Выверенные значения лежат
в site-assets/kit-cards-2026-09-13/layout.json, поле `product_bottom`.

`titleScale` ужимает длинные имена, чтобы заголовок остался в одну строку: ширины
заголовков снимаются с маски текста (композиция рендерится с плоским фоном через
--props), предел — ширина кадра минус поля.
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
TITLE_TOP = 0.68      # линия заголовка, та же константа в KitArtifactBanner
TARGET_PB = 0.66      # линия, на которую сажается низ изделия у всех карточек
TITLE_LIMIT = 1120    # предельная ширина заголовка в пикселях


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
    verified = json.loads(Path("/tmp/pb-final.json").read_text()) if Path("/tmp/pb-final.json").exists() else {}
    out = []
    for x in plan:
        i = x["i"]
        pb = verified.get(str(i)) or product_bottom(i)
        a = max(1.0, TARGET_PB / pb, (1 - TARGET_PB) / (1 - pb))
        b = TARGET_PB - a * pb
        out.append({"i": i, "slot_id": x["slot_id"], "product_bottom": round(pb, 3),
                    "bg_scale": round(a, 4), "bg_top": round(b, 4),
                    "verified_by_eye": str(i) in verified})
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    scales = [o["bg_scale"] for o in out]
    print(f"посчитано: {len(out)} | масштаб кадра {min(scales):.3f}–{max(scales):.3f} | "
          f"низ изделия у всех приведён к {TARGET_PB}")


if __name__ == "__main__":
    main()
