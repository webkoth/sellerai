import type { ArtifactLayout, KitArtifactBannerProps } from "./KitArtifactBanner";

/** Слот витрины в стиле макетов «Книга небесного железа». */
export type ArtifactSlot = {
  id: string;
  width: number;
  height: number;
  slot: string;
  props: KitArtifactBannerProps;
};

/**
 * Форматы из документации KIT (site-editor → слайдшоу): десктоп 2:1, 5:2, 7:2, 5:1, 10:1
 * и полноэкранный; мобильный 4:3, 7:3, 5:2, 7:1. Плюс вертикальный портрет — он в списке
 * не значится, но нужен под мобильную обложку и сторис.
 */
export const FORMATS = [
  { key: "desktop_2-1", width: 2400, height: 1200, label: "десктоп 2:1" },
  { key: "desktop_5-2", width: 2400, height: 960, label: "десктоп 5:2" },
  { key: "desktop_7-2", width: 2450, height: 700, label: "десктоп 7:2" },
  { key: "desktop_5-1", width: 2400, height: 480, label: "десктоп 5:1" },
  { key: "desktop_10-1", width: 2400, height: 240, label: "десктоп 10:1" },
  { key: "desktop_fullscreen", width: 1920, height: 1080, label: "десктоп полноэкранный" },
  { key: "mobile_4-3", width: 1080, height: 810, label: "мобильный 4:3" },
  { key: "mobile_7-3", width: 1080, height: 463, label: "мобильный 7:3" },
  { key: "mobile_5-2", width: 1080, height: 432, label: "мобильный 5:2" },
  { key: "mobile_7-1", width: 1080, height: 154, label: "мобильный 7:1" },
  { key: "mobile_portrait", width: 1080, height: 1440, label: "мобильный портрет 3:4" },
] as const;

/** Раскладка подбирается по пропорции кадра: чем ниже полоса, тем меньше в ней помещается. */
const layoutFor = (w: number, h: number): ArtifactLayout => {
  const r = h / w;
  if (r >= 0.9) return "poster";
  if (r >= 0.33) return "wide";
  if (r >= 0.14) return "strip";
  return "ribbon";
};

const scaleFor = (l: ArtifactLayout, base: { poster: number; wide: number }) =>
  l === "poster" ? base.poster : l === "wide" ? base.wide : l === "strip" ? 0.22 : 0.12;

/**
 * Тексты собраны по схеме макета: серия → заголовок-обещание → уточнение → доказательство → факт.
 * Заголовок продаёт не предмет, а то, чем предмет становится для владельца; мета и факт
 * закрывают вопрос «чем докажете» — для чека 20 000 ₽ это важнее эпитетов.
 */
const HERO = [
  {
    id: "a-hero-1-material",
    slot: "Слайдшоу, слайд 1 — коллекционные образцы",
    background: "kit-bg/bg_plaque_space-milkyway.png",
    photo: "kit-cutouts/meteorite-stone.png",
    series: "Коллекция образцов",
    title: "Возраст, который не подделать",
    subtitle: "железо, застывшее за миллиард лет до Земли",
    meta: "Железные · каменные · палласиты",
    note: "Возраст: 4,5 миллиарда лет",
    scale: { poster: 0.6, wide: 0.32 },
  },
  {
    id: "a-hero-2-cosmos",
    slot: "Слайдшоу, слайд 2 — украшения",
    background: "kit-bg/bg_medallion_ink-teal.png",
    photo: "kit-cutouts/pendant-pallasite-round.png",
    series: "Книга небесного железа",
    title: "Срез, который не повторится",
    subtitle: "палласит в серебре — оливины светятся на просвет",
    meta: "Палласит · оливин в железе",
    note: "Рисунок каждого среза уникален",
    scale: { poster: 0.5, wide: 0.26 },
  },
  {
    id: "a-hero-3-sign",
    slot: "Слайдшоу, слайд 3 — амулеты",
    background: "kit-bg/bg_tsarev_basalt-cyan.png",
    photo: "kit-cutouts/medallion-dragon.png",
    series: "Амулеты и обереги",
    title: "Знак, а не украшение",
    subtitle: "резьба по небесному железу, вручную",
    meta: "Метеорит Aletai · Китай · 1898",
    note: "Единственный экземпляр",
    scale: { poster: 0.52, wide: 0.27 },
  },
  {
    id: "a-hero-4-delivery",
    slot: "Промо-полоса — доставка",
    background: "kit-bg/bg_medallion_ink-plume.png",
    photo: "kit-cutouts/dzi-gold.png",
    series: "Доставка",
    title: "Бережная отправка по России",
    subtitle: "образец фиксируется в упаковке · трек-номер в день отправки",
    meta: "Отправляем из Краснодара",
    note: undefined,
    scale: { poster: 0.44, wide: 0.22 },
  },
];

const CATEGORIES = [
  {
    id: "a-cat-meteorites", slot: "Обложка категории «Метеориты и минералы»",
    background: "kit-bg/bg_tsarev_chart-navy.png", photo: "kit-cutouts/meteorite-shard.png",
    series: "Каталог", title: "Метеориты и минералы",
    subtitle: "падение, вес и тип — в каждой карточке",
    meta: "Железо · камень · палласит", scale: 0.5,
  },
  {
    id: "a-cat-collection", slot: "Обложка категории «Коллекционные образцы»",
    background: "kit-bg/bg_plaque_space-minimal.png", photo: "kit-cutouts/pendant-pallasite-rect.png",
    series: "Каталог", title: "Коллекционные образцы",
    subtitle: "то, что редко попадает в частные руки",
    meta: "Единственный экземпляр", scale: 0.44,
  },
  {
    id: "a-cat-jewelry", slot: "Обложка категории «Украшения»",
    background: "kit-bg/bg_medallion_teal-raw.png", photo: "kit-cutouts/bracelet-labradorite.png",
    series: "Каталог", title: "Украшения ручной работы",
    subtitle: "натуральный камень и небесное железо",
    meta: "Браслеты · подвески · кольца", scale: 0.82,
  },
  {
    id: "a-cat-amulets", slot: "Обложка категории «Амулеты и обереги»",
    background: "kit-bg/bg_medallion_ink-plume.png", photo: "kit-cutouts/piyao-meteorite.png",
    series: "Каталог", title: "Амулеты и обереги",
    subtitle: "сакральные символы в металле и камне",
    meta: "Дзи · Пи Яо · Меркаба", scale: 0.42,
  },
];

export const ARTIFACT_SLOTS: ArtifactSlot[] = [
  // каждый сюжет — во всех форматах слайдшоу из документации KIT
  ...HERO.flatMap((h) =>
    FORMATS.map((f) => {
      const layout = layoutFor(f.width, f.height);
      return {
        id: `${h.id}-${f.key}`,
        width: f.width,
        height: f.height,
        slot: `${h.slot} — ${f.label}`,
        props: {
          background: h.background, photo: h.photo, series: h.series, title: h.title,
          subtitle: h.subtitle, meta: h.meta, note: h.note,
          layout, photoScale: scaleFor(layout, h.scale),
        } as KitArtifactBannerProps,
      };
    }),
  ),
  {
    id: "a-modal-subscribe", width: 1280, height: 720,
    slot: "Окно подписки (16:9)",
    props: {
      background: "kit-bg/bg_plaque_space-minimal.png", photo: "kit-cutouts/pendant-flower-of-life.png",
      series: "Новые поступления", title: "Узнавайте о находках первыми",
      subtitle: "письмо раз в неделю: что появилось и что уже забрали",
      meta: "Без спама · отписка в один клик", layout: "wide", photoScale: 0.24,
    },
  },
  ...CATEGORIES.map((c) => ({
    id: c.id, width: 1000, height: 1000, slot: c.slot,
    props: { background: c.background, photo: c.photo, series: c.series, title: c.title, subtitle: c.subtitle, meta: c.meta, layout: "poster" as const, photoScale: c.scale },
  })),
  {
    id: "a-card-dragon", width: 1200, height: 1607,
    slot: "Карточка товара (3:4) — тёмный фон",
    props: {
      background: "kit-bg/bg_medallion_ink-teal.png", photo: "kit-cutouts/pendant-dragon-meteorite.png",
      series: "Книга небесного железа", title: "Хранитель пути",
      subtitle: "вырезан в небесном железе", meta: "Железный метеорит · видманштеттен",
      note: "Возраст: 4,5 миллиарда лет", layout: "poster", photoScale: 0.52,
    },
  },
  {
    id: "a-card-buddha", width: 1200, height: 1607,
    slot: "Карточка товара (3:4) — пергамент",
    props: {
      background: "kit-bg/bg_tsarev_chart-comet.png", photo: "kit-cutouts/buddha-head.png",
      series: "Книга небесного железа", title: "Тихий ум",
      subtitle: "резьба по натуральному камню", meta: "Ручная работа · единственный экземпляр",
      note: undefined, layout: "poster", photoScale: 0.42, onLight: true,
    },
  },
];

/**
 * Кадры Higgsfield (изделие уже снято в сцене) с той же типографикой «Книги небесного железа».
 * Отдельный слой с вырезкой не нужен — `productInBackground: true`.
 */
const HS = (photo: string, o: Record<string, unknown>) => ({
  background: `kit-hs/${photo}`, photo: `kit-hs/${photo}`, productInBackground: true, ...o,
});

export const HS_SLOTS: ArtifactSlot[] = [
  {
    id: "hs-cover-meteorites", width: 1080, height: 1440,
    slot: "Обложка категории 3:4 — метеориты и минералы",
    props: HS("meteorite-on-slate.png", {
      series: "Метеориты и минералы", title: "Найден, а не создан",
      subtitle: "железные, каменные и палласиты",
      meta: "Сихотэ-Алинь · Приморский край · 1947", layout: "poster",
    }) as KitArtifactBannerProps,
  },
  {
    id: "hs-cover-collection", width: 1080, height: 1440,
    slot: "Обложка категории 3:4 — коллекционные образцы",
    props: HS("specimen-on-plinth.png", {
      series: "Коллекционные образцы", title: "У каждого своё имя",
      subtitle: "вес, место и год падения известны",
      meta: "Царёв · Волгоградская область · 1968", layout: "poster",
    }) as KitArtifactBannerProps,
  },
  {
    id: "hs-bracelet-card", width: 1200, height: 1607,
    slot: "Карточка/сторис 3:4 — браслет на руке",
    props: HS("bracelet-on-wrist.png", {
      series: "Украшения", title: "Носится каждый день",
      subtitle: "браслет из лабрадорита с гематитом и серебром",
      meta: "Ручная сборка · единственный экземпляр",
      note: "Размер подбираем по запястью", layout: "poster",
    }) as KitArtifactBannerProps,
  },
  {
    id: "hs-bracelet-mobile", width: 1080, height: 1440,
    slot: "Слайдшоу, мобильный портрет — браслет на руке",
    props: HS("bracelet-on-wrist.png", {
      series: "Украшения", title: "Носится каждый день",
      subtitle: "браслет из лабрадорита с гематитом",
      meta: "Ручная сборка · единственный экземпляр", layout: "poster",
    }) as KitArtifactBannerProps,
  },
  {
    id: "hs-pendant-card", width: 1200, height: 1607,
    slot: "Карточка/сторис 3:4 — подвеска на шее",
    props: HS("pendant-on-neck.png", {
      series: "Книга небесного железа", title: "Ближе к сердцу",
      subtitle: "подвеска из железного метеорита, резьба вручную",
      meta: "Железный метеорит · видманштеттен",
      note: "Возраст: 4,5 миллиарда лет", layout: "poster",
    }) as KitArtifactBannerProps,
  },
  {
    id: "hs-pendant-mobile", width: 1080, height: 1440,
    slot: "Слайдшоу, мобильный портрет — подвеска на шее",
    props: HS("pendant-on-neck.png", {
      series: "Амулеты и обереги", title: "Ближе к сердцу",
      subtitle: "резьба по небесному железу",
      meta: "Единственный экземпляр", layout: "poster",
    }) as KitArtifactBannerProps,
  },
  {
    id: "hs-medallion-desktop-2-1", width: 2400, height: 1200,
    slot: "Слайдшоу, десктоп 2:1 — медальон на базальте",
    props: HS("medallion-on-basalt.png", {
      series: "Амулеты и обереги", title: "Знак, а не украшение",
      subtitle: "резьба по метеориту Aletai, вручную",
      meta: "Метеорит Aletai · Китай · 1898",
      note: "Единственный экземпляр", layout: "wide",
    }) as KitArtifactBannerProps,
  },
  {
    id: "hs-medallion-desktop-5-2", width: 2400, height: 960,
    slot: "Слайдшоу, десктоп 5:2 — медальон на базальте",
    props: HS("medallion-on-basalt.png", {
      series: "Амулеты и обереги", title: "Знак, а не украшение",
      subtitle: "резьба по метеориту Aletai, вручную",
      meta: "Метеорит Aletai · Китай · 1898", layout: "wide",
    }) as KitArtifactBannerProps,
  },
  {
    id: "hs-medallion-fullscreen", width: 1920, height: 1080,
    slot: "Слайдшоу, десктоп полноэкранный — медальон",
    props: HS("medallion-on-basalt.png", {
      series: "Книга небесного железа", title: "Знак, а не украшение",
      subtitle: "резьба по метеориту Aletai, вручную",
      meta: "Метеорит Aletai · Китай · 1898",
      note: "Возраст: 4,5 миллиарда лет", layout: "wide",
    }) as KitArtifactBannerProps,
  },
];

/** Карточки товара: фон-фактура + вырезка изделия + типографика «Книги небесного железа». */
const CARD = (bg: string, photo: string, o: Record<string, unknown>) => ({
  background: `kit-bg/${bg}`, photo: `kit-cutouts/${photo}`, layout: "poster", ...o,
});

export const CARD_SLOTS: ArtifactSlot[] = [
  {
    id: "card-kulon-drakon-aletai", width: 1200, height: 1600,
    slot: "Карточка — кулон Дракон из метеорита Алетай",
    props: CARD("bg_tsarev_basalt-cyan.png", "medallion-dragon.png", {
      series: "Книга небесного железа", title: "Дракон в небесном железе",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898",
      note: "Возраст: 4,5 миллиарда лет", scale: 0.62,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-busina-dzi-9-glaz", width: 1200, height: 1600,
    slot: "Карточка — бусина Дзи 9 глаз, метеорит Алетай",
    props: CARD("bg_medallion_ink-teal.png", "dzi-gold.png", {
      series: "Книга небесного железа", title: "Девять глаз",
      subtitle: "бусина Дзи из метеоритного железа",
      meta: "Метеорит Aletai · Китай · 1898",
      note: "Ручная резьба", scale: 0.6,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-kulon-piyao-aletai", width: 1200, height: 1600,
    slot: "Карточка — кулон Пи Яо из метеорита Алетай",
    props: CARD("bg_medallion_teal-raw.png", "piyao-meteorite.png", {
      series: "Книга небесного железа", title: "Пи Яо",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898",
      note: "Единственный экземпляр", scale: 0.6,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-meteorit-carev-345", width: 1200, height: 1600,
    slot: "Карточка — метеорит Царёв, горбушка, 34,5 г",
    props: CARD("bg_tsarev_chart-navy.png", "meteorite-stone.png", {
      series: "Коллекционные образцы", title: "Царёв",
      subtitle: "каменный метеорит, падение 1922 года",
      meta: "Волгоградская область · найден в 1968",
      note: "Вес: 34,5 г", scale: 0.58,
    }) as KitArtifactBannerProps,
  },
];
