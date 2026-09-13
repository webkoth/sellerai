"""Креативы РСЯ из сцен Higgsfield — тот же визуальный язык, что у витрины KIT.

Зачем переделали (2026-09-13): прежние креативы были вырезками на белом фоне, а витрина
после пересъёмки карточек — тёмные и светлые «мистические» сцены. Объявление и посадочная
выглядели как два разных магазина, это ломает узнавание после клика.

Правила, по которым собран кадр (справка Директа + research-rsya-2026.md):
- текста на картинке нет: РСЯ сама рисует заголовок и текст рядом, а картинку обрезает
  до 30% по бокам, 40% снизу и 25% сверху — надпись почти наверняка потеряется;
- изделие занимает ~52% кадра и стоит по центру, внутри безопасной зоны обрезки;
- три варианта на группу — три разных товара из той же коллекции, куда ведёт объявление.

Источники: remotionvideo/public/kit-scenes-hs (сцены карточек, изделие по центру) и kit-hs
(широкие сцены; из них годится только та, где изделие в центре — у остальных изделие в правой
трети под текст, а текста мы не ставим, и при обрезке РСЯ оно уезжает за край).
Результат: marketing/direct/images/<группа>-<a|b|c>-<1x1|4x3|16x9>.jpg
"""
from PIL import Image
import json, os

ROOT = '/Users/minas/projects/sai_kotelnikovartifact'
PUB = f'{ROOT}/remotionvideo/public'
OUT = f'{ROOT}/marketing/direct/images'

FORMATS = {'1x1': (1200, 1200), '4x3': (1600, 1200), '16x9': (1920, 1080)}
FILL = 0.52          # доля кадра, которую занимает изделие по большей стороне
CY = 0.47            # центр изделия по вертикали внутри кадра

# файл -> (x0, y0, x1, y1) габариты изделия в долях сцены, снято глазами по сетке 10%
SRC = {
    'kit-hs/rsya-meteority-wide.png': (0.575, 0.335, 0.870, 0.655),
    'kit-hs/rsya-amulety-wide.png':   (0.715, 0.280, 0.900, 0.650),
    'kit-hs/rsya-podarki-wide.png':   (0.680, 0.300, 0.890, 0.850),
    'kit-hs/rsya-braslety-wide.png':  (0.645, 0.405, 0.955, 0.715),
    'kit-hs/rsya-chasy-wide.png':     (0.620, 0.280, 0.880, 0.780),
    'kit-hs/rsya-chasy-light.png':    (0.355, 0.190, 0.740, 0.640),
    'kit-scenes-hs/scene_009.jpg': (0.32, 0.44, 0.62, 0.68),
    'kit-scenes-hs/scene_016.jpg': (0.12, 0.40, 0.88, 0.65),
    'kit-scenes-hs/scene_039.jpg': (0.38, 0.36, 0.68, 0.69),
    'kit-scenes-hs/scene_042.jpg': (0.36, 0.30, 0.68, 0.72),
    'kit-scenes-hs/scene_015.jpg': (0.30, 0.38, 0.68, 0.65),
    'kit-scenes-hs/scene_012.jpg': (0.40, 0.40, 0.72, 0.66),
    'kit-scenes-hs/scene_007.jpg': (0.26, 0.42, 0.76, 0.58),
    'kit-scenes-hs/scene_026.jpg': (0.38, 0.46, 0.62, 0.63),
    'kit-scenes-hs/scene_005.jpg': (0.18, 0.44, 0.86, 0.57),
    'kit-scenes-hs/scene_008.jpg': (0.16, 0.38, 0.92, 0.60),
    'kit-scenes-hs/scene_018.jpg': (0.28, 0.28, 0.72, 0.72),
    'kit-scenes-hs/scene_037.jpg': (0.28, 0.44, 0.75, 0.66),
    'kit-scenes-hs/scene_003.jpg': (0.34, 0.36, 0.68, 0.72),
}

# группа -> вариант -> (сцена, артикул KIT товара на кадре)
PLAN = {
    'meteority': {
        'a': ('kit-scenes-hs/scene_009.jpg', '100205'),
        'b': ('kit-scenes-hs/scene_015.jpg', '100211'),
        'c': ('kit-scenes-hs/scene_012.jpg', '100133'),
    },
    'amulety': {
        'a': ('kit-scenes-hs/scene_039.jpg', '100026'),
        'b': ('kit-scenes-hs/scene_007.jpg', '100186'),
        'c': ('kit-scenes-hs/scene_026.jpg', '100112'),
    },
    'braslety': {
        'a': ('kit-scenes-hs/scene_016.jpg', '100207'),
        'b': ('kit-scenes-hs/scene_005.jpg', '100166'),
        'c': ('kit-scenes-hs/scene_008.jpg', '100155'),
    },
    'podarki': {
        'a': ('kit-scenes-hs/scene_042.jpg', '100021'),
        'b': ('kit-scenes-hs/scene_018.jpg', '100135'),
        'c': ('kit-scenes-hs/scene_037.jpg', '100106'),
    },
    'chasy': {
        'a': ('kit-hs/rsya-chasy-light.png', '100174'),
        'b': ('kit-scenes-hs/scene_003.jpg', '100174'),
        'c': ('kit-hs/rsya-chasy-wide.png', '100174'),
    },
}


def crop(src, W, H):
    """Кадр W×H: изделие занимает FILL по большей стороне, центр в (0.5, CY)."""
    im = Image.open(f'{PUB}/{src}').convert('RGB')
    sw, sh = im.size
    x0, y0, x1, y1 = SRC[src]
    pw, ph = (x1 - x0) * sw, (y1 - y0) * sh
    ar = W / H
    cw = max(pw, ph * ar) / FILL
    ch = cw / ar
    # не вылезаем за пределы сцены
    if cw > sw:
        cw, ch = sw, sw / ar
    if ch > sh:
        ch, cw = sh, sh * ar
    pcx, pcy = (x0 + x1) / 2 * sw, (y0 + y1) / 2 * sh
    # если изделие стоит близко к краю сцены, прижатый к краю кадр уводит его вбок,
    # а РСЯ режет до 30% по бокам — поэтому лучше сузить кадр, чем сдвинуть изделие
    if pcx - cw / 2 < 0 or pcx + cw / 2 > sw:
        cw = 2 * min(pcx, sw - pcx)
        ch = cw / ar
        if ch > sh:
            ch, cw = sh, sh * ar
    cx0 = max(0, min(sw - cw, pcx - cw / 2))
    cy0 = max(0, min(sh - ch, pcy - ch * CY))
    box = (round(cx0), round(cy0), round(cx0 + cw), round(cy0 + ch))
    return im.crop(box).resize((W, H), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []
    for group, variants in PLAN.items():
        for v, (src, kit_id) in variants.items():
            for fmt, (W, H) in FORMATS.items():
                out = f'{OUT}/{group}-{v}-{fmt}.jpg'
                crop(src, W, H).save(out, quality=92, subsampling=0, optimize=True)
                made.append({'key': f'{group}-{v}-{fmt}', 'src': src, 'kit_id': kit_id,
                             'size': [W, H], 'bytes': os.path.getsize(out)})
    json.dump(made, open(f'{OUT}/_sources.json', 'w'), ensure_ascii=False, indent=1)
    big = [m for m in made if m['bytes'] > 10 * 1024 * 1024]
    print(f'готово: {len(made)} файлов, крупнее 10 МБ: {len(big)}')


if __name__ == '__main__':
    main()
