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
    key: "meteority", bg: "rsya-meteority-wide.png", scene: 15, onLight: true, sceneLight: true,
    series: "Коллекционные метеориты", title: "Настоящий метеорит\nс сертификатом",
    subtitle: "Сихотэ-Алинь, Дронино, Царёв",
    meta: "Каждый образец в одном экземпляре", note: "Вес и место падения — в карточке",
    short: "Метеориты", href: "/collections/meteority",
  },
  {
    key: "amulety", bg: "rsya-amulety-wide.png", scene: 39, onLight: true, sceneLight: true,
    series: "Амулеты из метеорита", title: "Резьба\nпо небесному железу",
    subtitle: "кулоны, бусины Дзи, фигурки из Алетая",
    meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба",
    short: "Амулеты", href: "/collections/amulety-iz-meteorita",
  },
  {
    key: "braslety", bg: "rsya-braslety-wide.png", scene: 5, onLight: true, sceneLight: true,
    series: "Браслеты и подвески", title: "Носить космос\nкаждый день",
    subtitle: "браслеты ручной сборки с метеоритом",
    meta: "От 6 900 ₽", note: "Размер подбираем по запястью",
    short: "Браслеты", href: "/collections/ukrasheniya-s-meteoritom",
  },
  {
    key: "podarki", bg: "rsya-podarki-wide.png", scene: 18, onLight: false, sceneLight: false,
    series: "Необычный подарок", title: "Подарок,\nкоторый старше Земли",
    subtitle: "метеорит в коробке с сертификатом",
    meta: "Доставка по России бесплатно", note: "Возврат 7 дней",
    short: "Подарки", href: "/collections/podarki",
  },
  {
    key: "chasy", bg: "rsya-chasy-light.png", scene: 3, onLight: true, sceneLight: false,
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

/** Плитки «Коллекции и категории» на главной, 1:1. */
export const SITE_TILE: ArtifactSlot[] = GROUPS.map((g) => ({
  id: `site-tile-${g.key}`, width: 1200, height: 1200,
  slot: `Главная, плитка — ${g.short} → ${g.href}`,
  props: SCENE(g.scene, {
    layout: "poster", onLight: g.sceneLight, textScale: 1.15, bottomInset: 0.1,
    series: g.series, title: g.short.toUpperCase(), subtitle: g.subtitle.split(",")[0],
    meta: g.meta,
  }),
}));

/** Крупные блоки «Коллекции и категории» на главной, 4:3. */
export const SITE_BLOCK: ArtifactSlot[] = GROUPS.slice(0, 4).map((g) => ({
  id: `site-block-${g.key}`, width: 1600, height: 1200,
  slot: `Главная, крупный блок — ${g.series} → ${g.href}`,
  // Ландшафтный блок: широкая сцена и текст слева. Портретная сцена в 4:3 режется так,
  // что изделие уходит в середину кадра и заголовок ложится прямо на него.
  props: BG(g.bg, {
    layout: "wide", textScale: 0.95,
    series: g.series, title: g.short.toUpperCase(), subtitle: g.subtitle.split(",")[0],
    meta: g.meta,
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
