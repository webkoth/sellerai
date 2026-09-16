#!/usr/bin/env python3
"""
Матрица «фон × изделие» для витрины KIT.

Для каждого вырезанного изделия собирает контактный лист со всеми фонами
(remotionvideo/public/kit-bg) — чтобы выбирать сочетания глазами, а не наугад.
Композит делается напрямую в PIL: Remotion для перебора 8×21 избыточен.

    python3 scripts/kit_bg_matrix.py            # листы по изделиям
    python3 scripts/kit_bg_matrix.py --by-bg    # плюс листы по фонам
"""
import argparse
import glob
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG_DIR = f"{ROOT}/remotionvideo/public/kit-bg"
CUT_DIR = f"{ROOT}/remotionvideo/public/kit-cutouts"
OUT = f"{ROOT}/site-assets/kit-bg-matrix"

CELL_W, CELL_H, PAD = 560, 747, 16          # 3:4, как карточка товара
LABEL_H = 34


def font(size: int):
    for p in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def cell(bg_path: str, cut_path: str, caption: str) -> Image.Image:
    bg = Image.open(bg_path).convert("RGB")
    # кроп по центру в пропорцию ячейки
    scale = max(CELL_W / bg.width, CELL_H / bg.height)
    bg = bg.resize((int(bg.width * scale), int(bg.height * scale)), Image.LANCZOS)
    left, top = (bg.width - CELL_W) // 2, (bg.height - CELL_H) // 2
    im = bg.crop((left, top, left + CELL_W, top + CELL_H))

    cut = Image.open(cut_path).convert("RGBA")
    cut.thumbnail((int(CELL_W * 0.62), int(CELL_H * 0.62)), Image.LANCZOS)
    im.paste(cut, ((CELL_W - cut.width) // 2, (CELL_H - cut.height) // 2 - 10), cut)

    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, CELL_H - LABEL_H, CELL_W, CELL_H], fill=(8, 12, 18, 205))
    d.text((12, CELL_H - LABEL_H + 8), caption[:52], font=font(17), fill=(230, 240, 245))
    return im


def sheet(items, cols, title, out_path):
    rows = (len(items) + cols - 1) // cols
    W = cols * CELL_W + (cols + 1) * PAD
    H = rows * CELL_H + (rows + 1) * PAD + 54
    canvas = Image.new("RGB", (W, H), (16, 18, 24))
    ImageDraw.Draw(canvas).text((PAD, 16), title, font=font(26), fill=(240, 245, 250))
    for i, im in enumerate(items):
        x = PAD + (i % cols) * (CELL_W + PAD)
        y = 54 + PAD + (i // cols) * (CELL_H + PAD)
        canvas.paste(im, (x, y))
    canvas.save(out_path, quality=86)
    return out_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--by-bg", action="store_true", help="дополнительно листы «один фон × все изделия»")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    bgs = sorted(glob.glob(f"{BG_DIR}/*.png"))
    cuts = sorted(glob.glob(f"{CUT_DIR}/*.png"))
    print(f"фонов: {len(bgs)} · изделий: {len(cuts)} · сочетаний: {len(bgs) * len(cuts)}")

    for c in cuts:
        name = os.path.splitext(os.path.basename(c))[0]
        cells = [cell(b, c, os.path.basename(b).replace("bg_", "").replace(".png", "")) for b in bgs]
        p = sheet(cells, 4, f"{name}  —  все фоны", f"{OUT}/izdelie_{name}.jpg")
        print("  ✓", os.path.basename(p), flush=True)

    if args.by_bg:
        for b in bgs:
            name = os.path.basename(b).replace("bg_", "").replace(".png", "")
            cells = [cell(b, c, os.path.splitext(os.path.basename(c))[0]) for c in cuts]
            p = sheet(cells, 7, f"фон {name}  —  все изделия", f"{OUT}/fon_{name}.jpg")
            print("  ✓", os.path.basename(p), flush=True)
    print("ГОТОВО")


if __name__ == "__main__":
    main()
