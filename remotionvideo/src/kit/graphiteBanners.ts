import type { KitGraphiteBannerProps } from "./KitGraphiteBanner";

/**
 * Набор «графит-космос»: вырезанные образцы на графитовом фоне для слайдшоу
 * и реальные кадры карточек с текстом прямо на фото — для обложек категорий.
 */
export type GraphiteSlot = {
  id: string;
  width: number;
  height: number;
  slot: string;
  props: KitGraphiteBannerProps;
};

const HERO = [
  {
    id: "g-hero-1-material",
    slot: "Слайдшоу на главной, слайд 1",
    kicker: "Коллекция образцов",
    title: "Материя *старше Земли*",
    subtitle: "Железные, каменные и палласиты — с названием падения, весом и историей.",
    cta: "Смотреть коллекцию",
    photo: "footage/meteorite-iron-removebg.png",
  },
  {
    id: "g-hero-2-cosmos",
    slot: "Слайдшоу на главной, слайд 2",
    kicker: "Украшения",
    title: "Космос *в оправе*",
    subtitle: "Подвески и браслеты с метеоритами. Природный рисунок не повторяется.",
    cta: "В каталог",
    photo: "footage/sericho-pendant-removebg.png",
  },
  {
    id: "g-hero-3-sign",
    slot: "Слайдшоу на главной, слайд 3",
    kicker: "Амулеты и обереги",
    title: "Знак, *который носят*",
    subtitle: "Дзи, Меркаба, Пи Яо. Сакральная символика в металле и камне.",
    cta: "Выбрать оберег",
    photo: "footage/meteorite-sacred-removebg.png",
  },
];

/** Обложки категорий — приём «текст прямо на фото». */
const CATEGORIES = [
  { id: "g-cat-meteorites", slot: "Обложка категории «Метеориты и минералы»", kicker: "Категория", title: "Метеориты *и минералы*", photo: "kit-photos/сихотэ-1.jpg", focus: "50% 42%" },
  { id: "g-cat-collection", slot: "Обложка категории «Коллекционные образцы»", kicker: "Категория", title: "Коллекционные *образцы*", photo: "kit-photos/дронино-1.jpg", focus: "52% 40%" },
  { id: "g-cat-jewelry", slot: "Обложка категории «Украшения»", kicker: "Категория", title: "Украшения *ручной работы*", photo: "kit-photos/серичо-1.jpg", focus: "55% 40%" },
  { id: "g-cat-amulets", slot: "Обложка категории «Амулеты и обереги»", kicker: "Категория", title: "Амулеты *и обереги*", photo: "kit-photos/дзи-9-глаз-1.jpg", focus: "48% 38%" },
];

export const GRAPHITE_SLOTS: GraphiteSlot[] = [
  ...HERO.flatMap((h) => [
    {
      id: `${h.id}-desktop`,
      width: 2400,
      height: 1200,
      slot: `${h.slot} — десктоп (2:1)`,
      props: { mode: "object" as const, kicker: h.kicker, title: h.title, subtitle: h.subtitle, cta: h.cta, photo: h.photo, layout: "wide" as const },
    },
    {
      id: `${h.id}-mobile`,
      width: 1080,
      height: 1440,
      slot: `${h.slot} — мобильный (4:3)`,
      props: { mode: "object" as const, kicker: h.kicker, title: h.title, subtitle: h.subtitle, cta: h.cta, photo: h.photo, layout: "portrait" as const, photoScale: 0.9 },
    },
  ]),
  {
    id: "g-strip-delivery",
    width: 2400,
    height: 480,
    slot: "Промо-полоса под слайдшоу (5:1)",
    props: {
      mode: "object",
      kicker: "Доставка",
      title: "Отправляем из *Краснодара* по всей России",
      subtitle: "Упаковка для хрупких образцов · трек-номер в день отправки",
      photo: "footage/meteorite-pallasite-removebg.png",
      layout: "strip",
      photoScale: 0.17,
    },
  },
  {
    id: "g-modal-subscribe",
    width: 1280,
    height: 720,
    slot: "Окно подписки (16:9)",
    props: {
      mode: "object",
      kicker: "Новые поступления",
      title: "Первыми о *новых образцах*",
      subtitle: "Раз в неделю — что появилось в наличии. Без спама.",
      photo: "footage/meteorite-stony-removebg.png",
      layout: "wide",
      photoScale: 0.36,
    },
  },
  ...CATEGORIES.map((c) => ({
    id: c.id,
    width: 1000,
    height: 1000,
    slot: c.slot,
    props: { mode: "photo" as const, kicker: c.kicker, title: c.title, photo: c.photo, focus: c.focus, layout: "square" as const },
  })),
];

/** Тот же набор в синеватом тоне («холодная сталь») — id с префиксом b-. */
export const BLUE_SLOTS: GraphiteSlot[] = GRAPHITE_SLOTS.map((s) => ({
  ...s,
  id: s.id.replace(/^g-/, "b-"),
  props: { ...s.props, tone: "blue" as const },
}));
