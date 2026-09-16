# -*- coding: utf-8 -*-
"""
Вырезание изделий из студийных фото: rembg (u2net) + обрезка по границам объекта.

Исходники кладём в remotionvideo/public/kit-src/, готовые PNG с альфой появляются
в remotionvideo/public/kit-cutouts/ — оттуда их берут баннеры (src/kit/premiumBanners.ts).
Уже готовые файлы пропускаются, так что можно докладывать новые снимки по мере съёмки.

Требует отдельного venv (в системный Python macOS ставить нельзя, PEP 668):
    python3 -m venv /tmp/rembg-venv && /tmp/rembg-venv/bin/pip install rembg onnxruntime pillow scipy
    /tmp/rembg-venv/bin/python scripts/cutout_products.py

После прогона — «полировка» краёв: см. README в site-assets/kit-banners-premium/
(вычистка белого фона внутри браслетов + подрезка ореола).
"""
import sys, glob, os
from PIL import Image
from rembg import remove, new_session

SRC = "/Users/minas/projects/sai_kotelnikovartifact/remotionvideo/public/kit-src"
DST = "/Users/minas/projects/sai_kotelnikovartifact/remotionvideo/public/kit-cutouts"
os.makedirs(DST, exist_ok=True)
session = new_session("u2net")

for path in sorted(glob.glob(f"{SRC}/*.jpg")):
    name = os.path.splitext(os.path.basename(path))[0]
    out = f"{DST}/{name}.png"
    if os.path.exists(out):
        print(f"  = {name} (уже есть)", flush=True); continue
    im = Image.open(path).convert("RGB")
    # уменьшаем до 2400 по большей стороне: быстрее и достаточно для баннеров 2400×1200
    im.thumbnail((2400, 2400), Image.LANCZOS)
    cut = remove(im, session=session, post_process_mask=True)
    bbox = cut.getchannel("A").getbbox()
    if bbox:
        pad = 12
        x0, y0, x1, y1 = bbox
        cut = cut.crop((max(0, x0 - pad), max(0, y0 - pad),
                        min(cut.width, x1 + pad), min(cut.height, y1 + pad)))
    cut.save(out, optimize=True)
    print(f"  ✓ {name:32} {cut.size[0]}x{cut.size[1]}  {os.path.getsize(out)//1024} КБ", flush=True)
print("ГОТОВО")
