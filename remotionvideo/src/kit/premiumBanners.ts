import type { GraphiteSlot } from "./graphiteBanners";

/**
 * Набор на исходных фото изделий: студийные снимки 12 Мп, фон срезан локально
 * (rembg u2net) в `public/kit-cutouts/`. Подложка — синий графит, приём «вырезка
 * на фоне», типографика Unbounded + циановая плашка.
 */
const HERO = [
  {
    id: "p-hero-1-material",
    slot: "Слайдшоу на главной, слайд 1",
    kicker: "Коллекция образцов",
    title: "Материя *старше Земли*",
    subtitle: "Железные, каменные и палласиты — с названием падения, весом и историей.",
    cta: "Смотреть коллекцию",
    photo: "kit-cutouts/meteorite-stone.png",
    scaleWide: 0.5,
    scaleMobile: 0.9,
  },
  {
    id: "p-hero-2-cosmos",
    slot: "Слайдшоу на главной, слайд 2",
    kicker: "Украшения",
    title: "Космос *в оправе*",
    subtitle: "Палласиты и метеориты в серебре. Природный рисунок не повторяется.",
    cta: "В каталог",
    photo: "kit-cutouts/pendant-pallasite-round.png",
    scaleWide: 0.42,
    scaleMobile: 0.78,
  },
  {
    id: "p-hero-3-sign",
    slot: "Слайдшоу на главной, слайд 3",
    kicker: "Амулеты и обереги",
    title: "Знак, *который носят*",
    subtitle: "Драконы, Пи Яо, бусины Дзи. Сакральная символика в металле и камне.",
    cta: "Выбрать оберег",
    photo: "kit-cutouts/medallion-dragon.png",
    scaleWide: 0.44,
    scaleMobile: 0.82,
  },
];

const CATEGORIES = [
  { id: "p-cat-meteorites", slot: "Обложка категории «Метеориты и минералы»", title: "Метеориты *и минералы*", photo: "kit-cutouts/meteorite-shard.png", scale: 0.72 },
  { id: "p-cat-collection", slot: "Обложка категории «Коллекционные образцы»", title: "Коллекционные *образцы*", photo: "kit-cutouts/pendant-pallasite-rect.png", scale: 0.62 },
  { id: "p-cat-jewelry", slot: "Обложка категории «Украшения»", title: "Украшения *ручной работы*", photo: "kit-cutouts/bracelet-labradorite.png", scale: 0.94 },
  { id: "p-cat-amulets", slot: "Обложка категории «Амулеты и обереги»", title: "Амулеты *и обереги*", photo: "kit-cutouts/piyao-meteorite.png", scale: 0.58 },
];

export const PREMIUM_SLOTS: GraphiteSlot[] = [
  ...HERO.flatMap((h) => [
    {
      id: `${h.id}-desktop`,
      width: 2400,
      height: 1200,
      slot: `${h.slot} — десктоп (2:1)`,
      props: { mode: "object" as const, tone: "blue" as const, kicker: h.kicker, title: h.title, subtitle: h.subtitle, cta: h.cta, photo: h.photo, layout: "wide" as const, photoScale: h.scaleWide },
    },
    {
      id: `${h.id}-mobile`,
      width: 1080,
      height: 1440,
      slot: `${h.slot} — мобильный (4:3)`,
      props: { mode: "object" as const, tone: "blue" as const, kicker: h.kicker, title: h.title, subtitle: h.subtitle, cta: h.cta, photo: h.photo, layout: "portrait" as const, photoScale: h.scaleMobile },
    },
  ]),
  {
    id: "p-strip-delivery",
    width: 2400,
    height: 480,
    slot: "Промо-полоса под слайдшоу (5:1)",
    props: {
      mode: "object", tone: "blue",
      kicker: "Доставка",
      title: "Отправляем из *Краснодара* по всей России",
      subtitle: "Упаковка для хрупких образцов · трек-номер в день отправки",
      photo: "kit-cutouts/dzi-gold.png",
      layout: "strip",
      photoScale: 0.26,
    },
  },
  {
    id: "p-modal-subscribe",
    width: 1280,
    height: 720,
    slot: "Окно подписки (16:9)",
    props: {
      mode: "object", tone: "blue",
      kicker: "Новые поступления",
      title: "Первыми о *новых образцах*",
      subtitle: "Раз в неделю — что появилось в наличии. Без спама.",
      photo: "kit-cutouts/pendant-flower-of-life.png",
      layout: "wide",
      photoScale: 0.32,
    },
  },
  ...CATEGORIES.map((c) => ({
    id: c.id,
    width: 1000,
    height: 1000,
    slot: c.slot,
    props: { mode: "object" as const, tone: "blue" as const, kicker: "Категория", title: c.title, photo: c.photo, layout: "square" as const, photoScale: c.scale },
  })),
];
