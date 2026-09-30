"""Профиль Авито KOTELNIKOVARTIFACT, светлая версия 30.09.2026: аватар и два баннера «про магазин».

Логотип — new_logo_ka.png (собственник, 30.09), товары — вырезки из remotionvideo/public/kit-cutouts,
только то, что выставлено на Авито и без серебра. Размеры — у минимума Авито: редактор кадрирования
не даёт уменьшить масштаб, рамка берёт ~1202 px исходника.

Запуск: python3 make.py  → avatar-1000.jpg, banner-desktop-1210x439.jpg, banner-mobile-1248x936.jpg, preview.jpg
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
LOGO = os.path.join(HERE, "new_logo_ka.png")
CUT = os.path.join(ROOT, "remotionvideo", "public", "kit-cutouts")
FONTS = os.path.expanduser("~/Library/Fonts")

INK = (63, 78, 99)          # цвет логотипа
INK_SOFT = (104, 118, 138)
BG_TOP, BG_BOTTOM = (250, 251, 253), (231, 236, 242)

HEADLINE = "Метеориты и украшения\nиз метеоритов"
SUBLINE = "Коллекционные образцы · амулеты · браслеты и подвески"
FOOTER = "Отправка по всей России · Авито Доставка"
PRODUCTS = ["medallion-dragon", "meteorite-stone", "piyao-meteorite", "bracelet-labradorite"]


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, f"Montserrat-{name}.otf"), size)


def gradient(w, h):
    g = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / (h - 1)
        d.line((0, y, w, y), fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))
    return g.convert("RGBA")


def logo_parts():
    im = Image.open(LOGO).convert("RGBA")
    w = im.width
    part = lambda y0, y1: im.crop((0, y0, w, y1)).crop(im.crop((0, y0, w, y1)).getbbox())
    return {"mark": part(70, 200), "word": part(240, 310), "line": part(330, 340), "tag": part(360, 400),
            "full": im.crop(im.getbbox())}


def fit(im, w=None, h=None):
    r = min(w / im.width if w else 1e9, h / im.height if h else 1e9)
    return im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)


def cutout(name, h):
    im = Image.open(os.path.join(CUT, f"{name}.png")).convert("RGBA")
    return fit(im.crop(im.getbbox()), h=h)


def paste_shadow(canvas, im, x, y, blur=18, offset=10, alpha=70):
    sh = Image.new("RGBA", im.size, (20, 30, 45, 0))
    sh.putalpha(im.split()[3].point(lambda a: a * alpha // 255))
    pad = blur * 3
    big = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    big.alpha_composite(sh, (pad, pad))
    big = big.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(big, (x - pad, y - pad + offset))
    canvas.alpha_composite(im, (x, y))


def text(d, xy, s, f, fill, spacing=0):
    d.multiline_text(xy, s, font=f, fill=fill, spacing=spacing)
    return d.multiline_textbbox(xy, s, font=f, spacing=spacing)


def avatar(p):
    S = 1000
    c = gradient(S, S)
    mark = fit(p["mark"], w=420)
    word = fit(p["word"], w=720)
    gap = 60
    top = (S - (mark.height + gap + word.height)) // 2
    c.alpha_composite(mark, ((S - mark.width) // 2, top))
    c.alpha_composite(word, ((S - word.width) // 2, top + mark.height + gap))
    return c


def products_row(c, names, x0, x1, base_y, h):
    items = [cutout(n, h if n not in ("dzi-gold", "bracelet-labradorite") else round(h * 0.55)) for n in names]
    total = sum(i.width for i in items)
    gap = max(10, ((x1 - x0) - total) // (len(items) - 1)) if len(items) > 1 else 0
    x = x0 + max(0, ((x1 - x0) - (total + gap * (len(items) - 1))) // 2)
    for i in items:
        paste_shadow(c, i, x, base_y - i.height)
        x += i.width + gap


def desktop(p, W=2420, H=878):
    c = gradient(W, H)
    d = ImageDraw.Draw(c)
    L = 150
    logo = fit(p["full"], w=560)
    c.alpha_composite(logo, (L, 105))
    y = 105 + logo.height + 70
    b = text(d, (L, y), HEADLINE, font("SemiBold", 76), INK, spacing=12)
    b = text(d, (L, b[3] + 34), SUBLINE, font("Regular", 34), INK_SOFT)
    d.line((L, b[3] + 44, L + 200, b[3] + 44), fill=(150, 165, 185), width=3)
    text(d, (L, b[3] + 72), FOOTER.upper(), font("Medium", 30), INK_SOFT)
    # товары справа ровным рядом на общей базовой линии
    row = [("medallion-dragon", 250), ("meteorite-stone", 280), ("piyao-meteorite", 230), ("bracelet-labradorite", 130)]
    items = [cutout(n, h) for n, h in row]
    x0, x1, base = 1330, 2330, 700
    gap = ((x1 - x0) - sum(i.width for i in items)) // (len(items) - 1)
    assert gap > 20, gap
    x = x0
    for i in items:
        paste_shadow(c, i, x, base - i.height)
        x += i.width + gap
    return c.resize((1210, 439), Image.LANCZOS)


def mobile(p, W=1248, H=936):
    c = gradient(W, H)
    d = ImageDraw.Draw(c)
    logo = fit(p["full"], w=560)
    c.alpha_composite(logo, ((W - logo.width) // 2, 70))
    f = font("SemiBold", 58)
    y = 70 + logo.height + 50
    for line in HEADLINE.split("\n"):
        tw = d.textlength(line, font=f)
        d.text(((W - tw) // 2, y), line, font=f, fill=INK)
        y += 72
    fs = font("Regular", 28)
    tw = d.textlength(SUBLINE, font=fs)
    d.text(((W - tw) // 2, y + 18), SUBLINE, font=fs, fill=INK_SOFT)
    products_row(c, ["medallion-dragon", "meteorite-stone", "piyao-meteorite"], 150, W - 150, H - 150, 250)
    ff = font("Medium", 24)
    tw = d.textlength(FOOTER.upper(), font=ff)
    d.text(((W - tw) // 2, H - 95), FOOTER.upper(), font=ff, fill=INK_SOFT)
    return c


def main():
    p = logo_parts()
    a, dk, mb = avatar(p), desktop(p), mobile(p)
    a.convert("RGB").save(os.path.join(HERE, "avatar-1000.jpg"), quality=93)
    dk.convert("RGB").save(os.path.join(HERE, "banner-desktop-1210x439.jpg"), quality=93)
    mb.convert("RGB").save(os.path.join(HERE, "banner-mobile-1248x936.jpg"), quality=93)

    pv = Image.new("RGB", (1300, 1010), "white")
    d = ImageDraw.Draw(pv)
    lab = font("Medium", 22)
    d.text((20, 12), "1. Аватар (в круге)", font=lab, fill="black")
    m = Image.new("L", (360, 360), 0)
    ImageDraw.Draw(m).ellipse((0, 0, 359, 359), fill=255)
    pv.paste(a.convert("RGB").resize((360, 360)), (20, 50), m)
    d.ellipse((20, 50, 379, 409), outline=(210, 214, 220), width=2)
    d.text((420, 12), "2. Смартфон 1248×936", font=lab, fill="black")
    pv.paste(mb.convert("RGB").resize((560, 420)), (420, 50))
    d.text((20, 490), "3. Компьютер и планшет 1210×439", font=lab, fill="black")
    pv.paste(dk.convert("RGB").resize((1260, 457)), (20, 530))
    pv.save(os.path.join(HERE, "preview.jpg"), quality=88)


if __name__ == "__main__":
    main()
