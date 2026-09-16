import type { KitArtifactBannerProps } from "./KitArtifactBanner";
import type { ArtifactSlot } from "./artifactBanners";

/**
 * Баннеры витрины Яндекс KIT под рекламные группы РСЯ.
 *
 * Пропорции сняты 14.09.2026 из конструктора KIT (`/api/business/v1/constructor/versions/latest/content`)
 * и проверены на живом сайте — слот режет по `object-fit: cover`, поэтому кадр делаем ровно
 * в пропорции слота, а не «примерно»:
 *
 * | Страница | Секция | Десктоп | Телефон |
 * |---|---|---|---|
 * | Главная | Слайдшоу-герой | 5:2 | 4:3 |
 * | Главная | Коллекции и категории, плитки | 1:1 (imageFit: contain) | 1:1 |
 * | Главная | Слайдшоу-полоса | 10:1 | 7:1 |
 * | Главная | Коллекции и категории, крупные блоки | 4:3 | 4:3 |
 * | Карточка товара | Коллекции и категории | 3:4 | 3:4 |
 * | Карточка товара, поиск | Слайдшоу-полоса | 5:1 | 5:2 |
 *
 * Каждый слайд героя соответствует своей группе РСЯ и ведёт на ту же посадочную,
 * что и объявление: клик из рекламы и клик с главной приводят в одно место.
 */

const BG = (bg: string, o: Record<string, unknown>) => ({
  background: `kit-hs/${bg}`,
  photo: `kit-hs/${bg}`,
  productInBackground: true,
  ...o,
}) as KitArtifactBannerProps;

const SCENE = (n: number, o: Record<string, unknown>) => ({
  background: `kit-scenes-hs/scene_${String(n).padStart(3, "0")}.jpg`,
  photo: `kit-scenes-hs/scene_${String(n).padStart(3, "0")}.jpg`,
  productInBackground: true,
  ...o,
}) as KitArtifactBannerProps;

/** Пять групп РСЯ: кадр, тексты и посадочная у слайда те же, что в объявлении. */
const GROUPS = [
  {
    key: "meteority", tilePos: "50% 86.8%", bg: "rsya-meteority-wide.png", scene: 15, onLight: true, sceneLight: true,
    series: "Коллекционные метеориты", title: "Настоящий метеорит\nс сертификатом",
    subtitle: "Сихотэ-Алинь, Дронино, Царёв",
    meta: "Каждый образец в одном экземпляре", note: "Вес и место падения — в карточке",
    short: "Метеориты", href: "/collections/meteority",
  },
  {
    key: "amulety", tilePos: "50% 99.8%", bg: "rsya-amulety-wide.png", scene: 39, onLight: true, sceneLight: true,
    series: "Амулеты из метеорита", title: "Резьба\nпо небесному железу",
    subtitle: "кулоны, бусины Дзи, фигурки из Алетая",
    meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба",
    short: "Амулеты", href: "/collections/amulety-iz-meteorita",
  },
  {
    key: "braslety", tilePos: "50% 63.1%", bg: "rsya-braslety-wide.png", scene: 5, onLight: true, sceneLight: true,
    series: "Браслеты и подвески", title: "Носить космос\nкаждый день",
    subtitle: "браслеты ручной сборки с метеоритом",
    meta: "От 6 900 ₽", note: "Размер подбираем по запястью",
    short: "Браслеты", href: "/collections/ukrasheniya-s-meteoritom",
  },
  {
    key: "podarki", tilePos: "50% 82.0%", bg: "rsya-podarki-wide.png", scene: 18, onLight: false, sceneLight: false,
    series: "Необычный подарок", title: "Подарок,\nкоторый старше Земли",
    subtitle: "метеорит в коробке с сертификатом",
    meta: "Доставка по России бесплатно", note: "Возврат 7 дней",
    short: "Подарки", href: "/collections/podarki",
  },
  {
    key: "chasy", tilePos: "50% 99.4%", bg: "rsya-chasy-light.png", scene: 3, onLight: true, sceneLight: false,
    series: "Часы с метеоритом", title: "Космос\nна запястье",
    subtitle: "вставка из метеорита Муонионалуста",
    meta: "Муонионалуста · Швеция · 1906", note: "Сертификат и коробка",
    short: "Часы", href: "/products/chasy-naruchnye-jenskie-s-meteoritom-muonionalusta-podarok-100174",
  },
] as const;

/** Слайдшоу главной, десктоп 5:2. */
export const SITE_HERO_D: ArtifactSlot[] = GROUPS.map((g) => ({
  id: `site-hero-d-${g.key}`, width: 2400, height: 960,
  slot: `Главная, слайд — ${g.series} → ${g.href}`,
  props: BG(g.bg, {
    layout: "wide", textScale: 1.05,
    series: g.series, title: g.title, subtitle: g.subtitle, meta: g.meta,
  }),
}));

/** Слайдшоу главной, телефон 4:3. */
export const SITE_HERO_M: ArtifactSlot[] = GROUPS.map((g) => ({
  id: `site-hero-m-${g.key}`, width: 1440, height: 1080,
  slot: `Главная мобильная, слайд — ${g.series} → ${g.href}`,
  props: BG(g.bg, {
    layout: "wide", textScale: 0.92,
    series: g.series, title: g.title, subtitle: g.subtitle, meta: g.meta,
  }),
}));

/**
 * Баннеры главной, ведущие в каталог. Все в одной светлой теме: тёмная плитка среди
 * светлых читается как чужая, а ряд должен смотреться одной сеткой.
 *
 * «Подарки» убраны: категории больше нет, подарочное намерение закрывает весь каталог.
 * Вместо них «Подвески» — вторая по величине категория, 12 товаров в наличии.
 *
 * `tilePos` и `titleTop` посчитаны от низа изделия в сцене: квадрат режет портретный кадр,
 * и без сдвига окна заголовок ложится прямо на предмет.
 */
const CATS = [
  { key: "meteority", short: "Метеориты", series: "Коллекционные метеориты",
    sub: "железные и каменные образцы", meta: "Каждый в одном экземпляре",
    href: "/catalog/meteority-i-mineraly",
    scene: 15, tilePos: "50% 89.7%", titleTop: 0.65,
    wide: "rsya-meteority-wide.png", blockPos: "75% 50%" },
  { key: "amulety", short: "Амулеты", series: "Амулеты из метеорита",
    sub: "резьба по метеоритному железу", meta: "Метеорит Aletai · Китай · 1898",
    href: "/catalog/amulety-i-oberegi",
    scene: 39, tilePos: "50% 100%", titleTop: 0.65,
    wide: "rsya-amulety-wide.png", blockPos: "85% 50%" },
  { key: "braslety", short: "Браслеты", series: "Браслеты с метеоритом",
    sub: "ручная сборка, натуральный камень", meta: "От 6 900 ₽",
    href: "/catalog/braslety",
    scene: 5, tilePos: "50% 66.1%", titleTop: 0.65,
    wide: "rsya-braslety-wide.png", blockPos: "100% 50%" },
  { key: "podveski", short: "Подвески", series: "Подвески и кулоны",
    sub: "метеорит в серебре и титане", meta: "Ручная работа · Краснодар",
    href: "/catalog/podveski-i-kulony",
    scene: 62, tilePos: "50% 73.2%", titleTop: 0.65,
    wide: null, blockPos: null },
  { key: "chasy", short: "Часы", series: "Часы с метеоритом",
    sub: "вставка из метеорита Муонионалуста", meta: "Швеция · 1906",
    href: "/catalog/chasy-naruchnye",
    scene: null, tilePos: null, titleTop: 0.65,
    wide: "rsya-chasy-wide-light.png", blockPos: "100% 50%" },
] as const;

/** Плитки «Коллекции и категории» на главной, 1:1. */
export const SITE_TILE: ArtifactSlot[] = CATS.map((c) => ({
  id: `site-tile-${c.key}`, width: 1200, height: 1200,
  slot: `Главная, плитка — ${c.short} → ${c.href}`,
  props: c.scene
    ? SCENE(c.scene, {
        layout: "poster", onLight: true, textScale: 1.1,
        bgPosition: c.tilePos, titleTop: c.titleTop,
        series: c.series, title: c.short.toUpperCase(), subtitle: c.sub, meta: c.meta,
      })
    // у часов светлая сцена только широкая: увеличиваем и поднимаем кадр, чтобы часы
    // встали над строкой заголовка и квадрат остался закрыт
    : BG("rsya-chasy-square.png", {
        layout: "poster", onLight: true, textScale: 1.1,
        bgScale: 1.53, bgTop: 0, titleTop: c.titleTop,
        series: c.series, title: c.short.toUpperCase(), subtitle: c.sub, meta: c.meta,
      }),
}));

/** Крупные блоки «Коллекции и категории» на главной, 4:3. */
export const SITE_BLOCK: ArtifactSlot[] = CATS.filter((c) => c.wide).map((c) => ({
  id: `site-block-${c.key}`, width: 1600, height: 1200,
  slot: `Главная, крупный блок — ${c.series} → ${c.href}`,
  props: BG(c.wide as string, {
    layout: "wide", onLight: true, textScale: 0.95, bgPosition: c.blockPos as string,
    series: c.series, title: c.short.toUpperCase(), subtitle: c.sub, meta: c.meta,
  }),
}));

/** Блоки «Коллекции и категории» на карточке товара, 3:4 — вместо демо-баннеров шаблона. */
export const SITE_PCARD: ArtifactSlot[] = GROUPS.slice(0, 3).map((g) => ({
  id: `site-pcard-${g.key}`, width: 1200, height: 1600,
  slot: `Карточка товара, блок — ${g.series} → ${g.href}`,
  props: SCENE(g.scene, {
    layout: "poster", onLight: g.sceneLight, textScale: 1.3, bottomInset: 0.1,
    series: g.series, title: g.short.toUpperCase(), subtitle: g.subtitle.split(",")[0],
    meta: g.meta,
  }),
}));

/** Полосы: доставка и гарантии. Ведут на /delivery. */
export const SITE_STRIP: ArtifactSlot[] = [
  {
    id: "site-strip-d-10x1", width: 2400, height: 240,
    slot: "Главная, полоса десктоп 10:1 → /delivery",
    props: BG("glav-d4-delivery.png", {
      layout: "ribbon", textScale: 1.0,
      series: "Доставка", title: "Отправляем из Краснодара",
      subtitle: "упаковка для хрупких образцов",
      meta: "Бесплатно по России · трек-номер в день отправки",
    }),
  },
  {
    id: "site-strip-m-7x1", width: 1680, height: 240,
    slot: "Главная, полоса телефон 7:1 → /delivery",
    props: BG("glav-d4-delivery.png", {
      layout: "ribbon", textScale: 0.92,
      series: "Доставка", title: "Отправляем из Краснодара",
      subtitle: "бесплатно по России",
      meta: "Трек-номер в день отправки",
    }),
  },
  {
    id: "site-strip-p-5x1", width: 2400, height: 480,
    slot: "Карточка товара и поиск, полоса десктоп 5:1 → /delivery",
    props: BG("glav-d4-delivery.png", {
      layout: "wide", textScale: 0.8,
      series: "Сертификат и доставка", title: "Сертификат подлинности\nв каждом заказе",
      subtitle: "коробка · доставка по России бесплатно · возврат 7 дней",
      meta: "Отправляем из Краснодара",
    }),
  },
  {
    id: "site-strip-p-5x2", width: 1440, height: 576,
    slot: "Карточка товара и поиск, полоса телефон 5:2 → /delivery",
    props: BG("glav-d4-delivery.png", {
      layout: "wide", textScale: 0.7,
      series: "Сертификат и доставка", title: "Сертификат\nв каждом заказе",
      subtitle: "коробка и доставка бесплатно",
      meta: "Возврат 7 дней",
    }),
  },
];

export const SITE_SLOTS: ArtifactSlot[] = [
  ...SITE_HERO_D, ...SITE_HERO_M, ...SITE_TILE, ...SITE_BLOCK, ...SITE_PCARD, ...SITE_STRIP,
];

/** Куда ведёт каждый слот — для инструкции по заполнению кабинета. */
export const SITE_LINKS: Record<string, string> = Object.fromEntries([
  ...GROUPS.flatMap((g) => [
    [`site-hero-d-${g.key}`, g.href], [`site-hero-m-${g.key}`, g.href],
    [`site-tile-${g.key}`, g.href], [`site-block-${g.key}`, g.href],
    [`site-pcard-${g.key}`, g.href],
  ]),
  ["site-strip-d-10x1", "/delivery"], ["site-strip-m-7x1", "/delivery"],
  ["site-strip-p-5x1", "/delivery"], ["site-strip-p-5x2", "/delivery"],
]);

/**
 * Обложки категорий и коллекций, 3:4 — тот же шаблон, что у карточек товара.
 * `bgScale`/`bgTop` взяты из site-assets/kit-cards-2026-09-13/layout.json: низ изделия
 * у всех обложек садится на ту же линию, что и на карточках, поэтому каталог читается
 * как одна сетка. Половина обложек до этого была старыми фото с белым фоном из WB.
 */
const COVERS = [
  { id: "cat-podveski", scene: 42, s: 1.1333, t: -0.1333, dark: true,
    series: "Подвески и кулоны", title: "КОСМОС В ОПРАВЕ",
    subtitle: "метеорит в серебре и титане", meta: "Ручная работа · Краснодар" },
  { id: "cat-braslety", scene: 5, s: 1.0855, t: 0.0, dark: false,
    series: "Браслеты", title: "СОБРАН ВРУЧНУЮ",
    subtitle: "натуральный камень и метеорит", meta: "Размер подбираем по запястью" },
  { id: "cat-chasy", scene: 3, s: 1.1333, t: -0.1333, dark: true,
    series: "Часы наручные", title: "КОСМОС НА ЗАПЯСТЬЕ",
    subtitle: "вставка из метеорита Муонионалуста", meta: "Швеция · 1906" },
  { id: "cat-sergi", scene: 68, s: 1.0749, t: 0.0, dark: true,
    series: "Серьги", title: "ТИХИЙ ЗНАК",
    subtitle: "серьги-пусеты с молдавитом", meta: "Молдавит, тектит · Чехия" },
  { id: "col-meteority", scene: 15, s: 1.0241, t: -0.0241, dark: false,
    series: "Коллекционные метеориты", title: "СТАРШЕ ЗЕМЛИ",
    subtitle: "железные, каменные и палласиты", meta: "Сертификат подлинности" },
  { id: "col-amulety", scene: 39, s: 1.1371, t: -0.1371, dark: false,
    series: "Амулеты из метеорита", title: "НЕБЕСНОЕ ЖЕЛЕЗО",
    subtitle: "резьба вручную по метеориту Алетай", meta: "Китай · 1898" },
  { id: "col-ukrasheniya", scene: 4, s: 1.0123, t: 0.0, dark: false,
    series: "Украшения с метеоритом", title: "НОСИТЬ КАЖДЫЙ ДЕНЬ",
    subtitle: "браслеты и подвески с метеоритом", meta: "От 6 900 ₽" },
  { id: "col-podarki", scene: 18, s: 1.0061, t: 0.0, dark: true,
    series: "Необычный подарок", title: "СТАРШЕ ЗЕМЛИ",
    subtitle: "метеорит в коробке с сертификатом", meta: "Доставка по России бесплатно" },
  { id: "met-iron", scene: 15, s: 1.0241, t: -0.0241, dark: false,
    series: "Метеориты", title: "ЖЕЛЕЗНЫЕ",
    subtitle: "Сихотэ-Алинь, Дронино, Кампо-дель-Сьело", meta: "22 образца в наличии" },
  { id: "met-stone", scene: 12, s: 1.0645, t: -0.0, dark: false,
    series: "Метеориты", title: "КАМЕННЫЕ",
    subtitle: "Царёв, обыкновенные хондриты", meta: "7 образцов в наличии" },
  { id: "populyarnye", scene: 16, s: 1.0625, t: -0.0625, dark: false,
    series: "Выбор покупателей", title: "ПОПУЛЯРНОЕ",
    subtitle: "что покупают чаще всего", meta: "По продажам за полгода" },
] as const;

export const SITE_COVERS: ArtifactSlot[] = COVERS.map((c) => ({
  id: `site-cover-${c.id}`, width: 1200, height: 1600,
  slot: `Обложка — ${c.series}`,
  props: SCENE(c.scene, {
    layout: "poster", onLight: !c.dark, textScale: 1.35,
    bgScale: c.s, bgTop: c.t,
    series: c.series, title: c.title, subtitle: c.subtitle, meta: c.meta,
  }),
}));
