import type { KitBannerProps } from "./KitBanner";

/**
 * Слоты витрины Яндекс KIT: что рендерим и в какой размер.
 * Размеры — из требований KIT: слайдшоу 2:1 (десктоп) и 4:3 (мобильный),
 * промо-полоса 5:1, модальное окно подписки 16:9, обложка категории — квадрат.
 */
export type KitSlot = {
  /** Часть id композиции и имени файла. */
  id: string;
  width: number;
  height: number;
  /** Куда этот файл ставится в конструкторе. */
  slot: string;
  props: KitBannerProps;
};

const HERO = [
  {
    id: "hero-1-meteorites",
    slot: "Слайдшоу на главной, слайд 1",
    kicker: "Коллекционные образцы",
    title: "Метеориты *старше Земли*",
    subtitle:
      "Железные, каменные и палласиты. У каждого образца — название падения, вес и своя история.",
    cta: "Смотреть образцы",
    photo: "footage/meteorite-iron-removebg.png",
    theme: "cyan" as const,
  },
  {
    id: "hero-2-jewelry",
    slot: "Слайдшоу на главной, слайд 2",
    kicker: "Ручная работа",
    title: "Украшения *со смыслом*",
    subtitle:
      "Подвески и браслеты с метеоритами и натуральными камнями. Каждое изделие в единственном экземпляре.",
    cta: "В каталог",
    photo: "footage/sericho-pendant-removebg.png",
    theme: "ember" as const,
  },
  {
    id: "hero-3-amulets",
    slot: "Слайдшоу на главной, слайд 3",
    kicker: "Амулеты и обереги",
    title: "Знак *вашего пути*",
    subtitle:
      "Сакральные символы: Дзи, Меркаба, Пи Яо. Ручная сборка, натуральные камни и метеорит.",
    cta: "Выбрать оберег",
    photo: "footage/meteorite-sacred-removebg.png",
    theme: "cyan" as const,
  },
];

const CATEGORIES = [
  { id: "cat-meteorites", slot: "Обложка категории «Метеориты и минералы»", title: "Метеориты *и минералы*", photo: "footage/meteorite-iron-removebg.png", theme: "cyan" as const },
  { id: "cat-collection", slot: "Обложка категории «Коллекционные образцы»", title: "Коллекционные *образцы*", photo: "footage/meteorite-pallasite-removebg.png", theme: "cyan" as const },
  { id: "cat-jewelry", slot: "Обложка категории «Украшения»", title: "Украшения *ручной работы*", photo: "footage/sericho-pendant-removebg.png", theme: "ember" as const },
  { id: "cat-amulets", slot: "Обложка категории «Амулеты и обереги»", title: "Амулеты *и обереги*", photo: "footage/meteorite-sacred-removebg.png", theme: "ember" as const },
];

export const KIT_SLOTS: KitSlot[] = [
  ...HERO.flatMap((h) => [
    {
      id: `${h.id}_desktop`,
      width: 2400,
      height: 1200,
      slot: `${h.slot} — десктоп (2:1)`,
      props: { kicker: h.kicker, title: h.title, subtitle: h.subtitle, cta: h.cta, photo: h.photo, layout: "wide" as const, theme: h.theme },
    },
    {
      id: `${h.id}_mobile`,
      width: 1080,
      height: 1440,
      slot: `${h.slot} — мобильный (4:3)`,
      props: { kicker: h.kicker, title: h.title, subtitle: h.subtitle, cta: h.cta, photo: h.photo, layout: "portrait" as const, theme: h.theme, photoScale: 0.88 },
    },
  ]),
  {
    id: "strip-delivery",
    width: 2400,
    height: 480,
    slot: "Промо-полоса под слайдшоу (5:1)",
    props: {
      title: "Отправляем из *Краснодара* по всей России",
      subtitle: "Упаковка для хрупких образцов · трек-номер в день отправки",
      photo: "footage/meteorite-pallasite-removebg.png",
      layout: "strip",
      theme: "cyan",
      photoScale: 0.16,
    },
  },
  {
    id: "modal-subscribe",
    width: 1280,
    height: 720,
    slot: "Окно подписки (16:9)",
    props: {
      kicker: "Новые поступления",
      title: "Узнавайте о *новых образцах* первыми",
      subtitle: "Раз в неделю — о том, что появилось в наличии. Без спама.",
      photo: "footage/meteorite-stony-removebg.png",
      layout: "wide",
      theme: "ember",
      photoScale: 0.4,
    },
  },
  ...CATEGORIES.map((c) => ({
    id: c.id,
    width: 1000,
    height: 1000,
    slot: c.slot,
    props: { title: c.title, photo: c.photo, layout: "square" as const, theme: c.theme, photoScale: 0.92 },
  })),
];
