import type { KitFashionBannerProps } from "./KitFashionBanner";

/**
 * Fashion-editorial набор для витрины KIT — на реальных макро-снимках образцов
 * из карточек магазина (вторые кадры галереи: без наложенного текста WB).
 */
export type FashionSlot = {
  id: string;
  width: number;
  height: number;
  slot: string;
  props: KitFashionBannerProps;
};

const HERO = [
  {
    id: "f-hero-1-material",
    slot: "Слайдшоу на главной, слайд 1",
    kicker: "Коллекция образцов",
    title: "Материя\nстарше Земли",
    subtitle:
      "Железные, каменные и палласиты — с названием падения, весом и историей. Каждый образец единственный.",
    cta: "Смотреть коллекцию",
    photo: "kit-photos/дронино-1.jpg",
    focus: "52% 48%",
    side: "left" as const,
  },
  {
    id: "f-hero-2-sign",
    slot: "Слайдшоу на главной, слайд 2",
    kicker: "Амулеты и обереги",
    title: "Знак,\nкоторый носят",
    subtitle:
      "Бусины Дзи, Меркаба, Пи Яо. Сакральная символика в металле и камне — ручная работа, единичные экземпляры.",
    cta: "Выбрать оберег",
    photo: "kit-photos/дзи-9-глаз-1.jpg",
    focus: "48% 45%",
    side: "right" as const,
  },
  {
    id: "f-hero-3-cosmos",
    slot: "Слайдшоу на главной, слайд 3",
    kicker: "Украшения",
    title: "Космос\nв оправе",
    subtitle:
      "Подвески и браслеты с метеоритами Серичо, Муонионалуста и Алетай. Природный рисунок не повторяется.",
    cta: "В каталог",
    photo: "kit-photos/серичо-1.jpg",
    focus: "55% 50%",
    side: "left" as const,
  },
];

const CATEGORIES = [
  { id: "f-cat-meteorites", slot: "Обложка категории «Метеориты и минералы»", kicker: "Категория", title: "Метеориты\nи минералы", photo: "kit-photos/сихотэ-1.jpg", focus: "50% 50%" },
  { id: "f-cat-collection", slot: "Обложка категории «Коллекционные образцы»", kicker: "Категория", title: "Коллекционные\nобразцы", photo: "kit-photos/дронино-1.jpg", focus: "52% 48%" },
  { id: "f-cat-jewelry", slot: "Обложка категории «Украшения»", kicker: "Категория", title: "Украшения\nручной работы", photo: "kit-photos/серичо-1.jpg", focus: "55% 50%" },
  { id: "f-cat-amulets", slot: "Обложка категории «Амулеты и обереги»", kicker: "Категория", title: "Амулеты\nи обереги", photo: "kit-photos/дзи-9-глаз-1.jpg", focus: "48% 45%" },
];

export const FASHION_SLOTS: FashionSlot[] = [
  ...HERO.flatMap((h) => [
    {
      id: `${h.id}-desktop`,
      width: 2400,
      height: 1200,
      slot: `${h.slot} — десктоп (2:1)`,
      props: { kicker: h.kicker, title: h.title, subtitle: h.subtitle, cta: h.cta, photo: h.photo, focus: h.focus, layout: "wide" as const, photoSide: h.side },
    },
    {
      id: `${h.id}-mobile`,
      width: 1080,
      height: 1440,
      slot: `${h.slot} — мобильный (4:3)`,
      props: { kicker: h.kicker, title: h.title, subtitle: h.subtitle, cta: h.cta, photo: h.photo, focus: h.focus, layout: "portrait" as const },
    },
  ]),
  {
    id: "f-strip-delivery",
    width: 2400,
    height: 480,
    slot: "Промо-полоса под слайдшоу (5:1)",
    props: {
      kicker: "Доставка",
      title: "Отправляем из Краснодара по всей России",
      subtitle: "Упаковка для хрупких образцов · трек-номер в день отправки",
      photo: "kit-photos/синергия-1.jpg",
      focus: "50% 45%",
      layout: "strip",
    },
  },
  {
    id: "f-modal-subscribe",
    width: 1280,
    height: 720,
    slot: "Окно подписки (16:9)",
    props: {
      kicker: "Новые поступления",
      title: "Первыми\nо новых образцах",
      subtitle: "Раз в неделю — что появилось в наличии. Без спама.",
      photo: "kit-photos/царев-1.jpg",
      focus: "50% 48%",
      layout: "wide",
      photoSide: "right",
    },
  },
  ...CATEGORIES.map((c) => ({
    id: c.id,
    width: 1000,
    height: 1000,
    slot: c.slot,
    props: { kicker: c.kicker, title: c.title, photo: c.photo, focus: c.focus, layout: "square" as const },
  })),
];
