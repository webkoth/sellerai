import type { KitCollectionBannerProps } from "./KitCollectionBanner";

/**
 * Коллекция баннеров по референсам из `new_collection/`.
 *
 * Тексты — из описаний карточек WB тех же изделий (факты о падениях, группах, весе
 * взяты дословно). Офферы согласованы с владельцем: −15 % на первый заказ за подписку,
 * бесплатная доставка по России, подарочная упаковка, возврат 7 дней.
 *
 * «Единственный экземпляр» стоит ТОЛЬКО на коллекционном образце метеорита —
 * остальные позиции серийные и есть в наличии.
 */
export type CollectionSlot = {
  id: string;
  slot: string;
  /** Форматы, в которых макет работает без обрезки предмета. */
  formats: Array<"wide" | "vertical">;
  props: KitCollectionBannerProps;
};

const M = (o: KitCollectionBannerProps) => o;

export const COLLECTION: CollectionSlot[] = [
  // ─── ПРОМО: светлые сцены, оффер и кнопка ────────────────────────────────
  {
    id: "promo-bracelet-marble", slot: "Промо · браслет Прометей", formats: ["wide"],
    props: M({
      variant: "promo", scene: "kit-scenes/promo_bracelet-marble.png", focus: "62% 50%", side: "left", light: true,
      kicker: "Браслеты", title: "Носится\nкаждый день",
      body: "Лабрадорит и метеорит Aletai — тот, что упал в Китае в 1898 году.",
      offer: "−15 % на первый заказ за подписку", cta: "В каталог", price: "от 9 345 ₽",
    }),
  },
  {
    id: "promo-dzi-silk", slot: "Промо · бусина Дзи с золотом", formats: ["wide", "vertical"],
    props: M({
      variant: "promo", scene: "kit-scenes/promo_dzi-silk.png", focus: "54% 52%", side: "right", light: true,
      kicker: "Амулеты", title: "Девять глаз,\nодин владелец",
      body: "Бусина Дзи из метеорита Aletai с золотой инкрустацией. Вес 22,7 г.",
      offer: "Подарочная упаковка в каждом заказе", cta: "Смотреть", price: "31 688 ₽",
    }),
  },
  {
    id: "promo-pallasite-limestone", slot: "Промо · подвеска Серичо", formats: ["wide"],
    props: M({
      variant: "promo", scene: "kit-scenes/promo_pallasite-limestone.png", side: "left", light: true,
      kicker: "Подвески", title: "Оливин,\nзастывший в железе",
      body: "Палласит Sericho, найден в Кении в 2016 году. Срез в серебряной оправе.",
      offer: "Бесплатная доставка по России", cta: "Выбрать", price: "14 700 ₽",
    }),
  },
  {
    id: "promo-lava-linen", slot: "Промо · браслет с лавой и Дзи", formats: ["wide"],
    props: M({
      variant: "promo", scene: "kit-scenes/promo_lava-linen.png", side: "right", light: true,
      kicker: "Мужская линия", title: "Чёрный\nбез компромиссов",
      body: "Вулканическая лава, гематит и резная бусина Дзи.",
      offer: "−15 % на первый заказ за подписку", cta: "Смотреть", price: "5 500 ₽",
    }),
  },
  {
    id: "promo-group-flatlay", slot: "Промо · подборка (три вещи)", formats: ["wide"],
    props: M({
      variant: "promo", scene: "kit-scenes/promo_group-flatlay.png", side: "left", light: true,
      kicker: "Коллекция", title: "Соберите\nсвой набор",
      body: "Браслет, бусина и подвеска из одного метеорита — как элементы одной истории.",
      offer: "Бесплатная доставка · подарочная упаковка", cta: "В каталог",
    }),
  },
  {
    id: "promo-medallion-travertine", slot: "Промо · медальон Дракон", formats: ["wide", "vertical"],
    props: M({
      variant: "promo", scene: "kit-scenes/promo_medallion-travertine.png", focus: "58% 50%", side: "left", light: true,
      kicker: "Обереги", title: "Резьба\nпо небесному железу",
      body: "Двусторонняя резьба по метеориту Aletai, химическая группа IIIE-an. Сертификат IMCA.",
      offer: "Возврат 7 дней · доставка бесплатно", cta: "Смотреть", price: "39 000 ₽",
    }),
  },
  {
    id: "promo-subscribe", slot: "Промо · подписка на новинки", formats: ["wide"],
    props: M({
      variant: "promo", scene: "kit-scenes/promo_dzi-silk.png", side: "left", light: true,
      kicker: "Новые поступления", title: "−15 %\nна первый заказ",
      body: "Подпишитесь на новинки: письмо раз в неделю о том, что появилось и что уже забрали.",
      offer: "Без спама · отписка в один клик", cta: "Подписаться",
    }),
  },
  {
    id: "promo-delivery", slot: "Промо · доставка и упаковка", formats: ["wide"],
    props: M({
      variant: "promo", scene: "kit-scenes/promo_group-flatlay.png", side: "right", light: true,
      kicker: "Доставка", title: "Приедет\nв подарочной коробке",
      body: "Отправляем из Краснодара, хрупкое фиксируем в упаковке, трек — в день отправки.",
      offer: "Бесплатная доставка по России", cta: "Как мы отправляем",
    }),
  },

  // ─── ИМИДЖЕВЫЕ: кадры на человеке, абзац с выделениями ───────────────────
  {
    id: "edit-medallion-neck", slot: "Имидж · медальон на шее", formats: ["vertical"],
    props: M({
      variant: "editorial", scene: "kit-scenes/image_medallion-neck.png", focus: "50% 62%", kicker: "Обереги",
      title: "Знак, а не украшение",
      body: "Двусторонняя резьба по метеориту *Aletai* — редчайшая химическая группа *IIIE-an*, сертификат IMCA. Будда в позе лотоса над драконом с жемчужиной мудрости: в традиции чань это *укрощённая сила*, а не подавленная.",
      spec: "Метеорит Aletai · Китай · 1898", price: "39 000 ₽",
    }),
  },
  {
    id: "edit-dzi-fingers", slot: "Имидж · бусина Дзи в пальцах", formats: ["vertical"],
    props: M({
      variant: "editorial", scene: "kit-scenes/image_dzi-fingers.png", kicker: "Амулеты",
      title: "Девять глаз",
      body: "Бусина Дзи из железного метеорита *Aletai* с золотой инкрустацией, вес *22,7 грамма*. Девять глаз в тибетской традиции — знак полноты и завершённости пути.",
      spec: "Железный метеорит · золото", price: "31 688 ₽",
    }),
  },
  {
    id: "edit-lava-wrist", slot: "Имидж · браслет на запястье", formats: ["vertical"],
    props: M({
      variant: "editorial", scene: "kit-scenes/image_lava-wrist.png", focus: "50% 55%", kicker: "Мужская линия",
      title: "Собранность",
      body: "Вулканическая лава, гематит и резная бусина *Дзи* — древний китайский символ процветания. Браслет собирается вручную, размер подбираем по запястью.",
      spec: "Лава · гематит · агат", price: "5 500 ₽",
    }),
  },
  {
    id: "edit-piyao-palm", slot: "Имидж · Пи Яо в ладони", formats: ["vertical"],
    props: M({
      variant: "editorial", scene: "kit-scenes/image_piyao-palm.png", kicker: "Обереги",
      title: "Хранитель порога",
      body: "Пи Яо — мифический зверь-страж китайской традиции, вырезанный в железном метеорите *Aletai* класса IIICD, найденном в Синьцзяне в *1898 году*. В традиции это символ врат: то, что входит, остаётся с владельцем.",
      spec: "Метеорит Aletai · класс IIICD", price: "29 250 ₽",
    }),
  },
  {
    id: "edit-bracelet-wrist", slot: "Имидж · браслет Прометей на руке", formats: ["vertical"],
    props: M({
      variant: "editorial", scene: "kit-hs/bracelet-on-wrist.png", kicker: "Браслеты",
      title: "Прометей",
      body: "Лабрадорит с переливом и метеорит *Aletai*, впервые найденный в Китае в *1898 году*. Гематитовые вставки и серебряная бусина в центре — ручная сборка.",
      spec: "Лабрадорит · метеорит · серебро", price: "9 345 ₽",
    }),
  },
  {
    id: "edit-pendant-neck", slot: "Имидж · подвеска на шее", formats: ["vertical"],
    props: M({
      variant: "editorial", scene: "kit-hs/pendant-on-neck.png", kicker: "Подвески",
      title: "Ближе к сердцу",
      body: "Пластина железного метеорита с *видманштеттеновым узором* — рисунком, который возникает только при остывании металла в космосе на протяжении миллионов лет. Подделать его невозможно.",
      spec: "Железный метеорит · резьба вручную",
    }),
  },
  {
    id: "edit-pallasite-scene", slot: "Имидж · палласит крупно", formats: ["wide"],
    props: M({
      variant: "editorial", scene: "kit-scenes/promo_pallasite-limestone.png", kicker: "Подвески",
      title: "Звёздная мандала",
      body: "Палласит *Sericho* из Кении, найден в *2016 году*. Оливины в железной матрице светятся на просвет — это вещество мантии разрушенного протопланетного тела.",
      spec: "Палласит · серебро 925", price: "14 700 ₽",
    }),
  },
  {
    id: "edit-buddha", slot: "Имидж · Будда, каменный метеорит", formats: ["vertical"],
    props: M({
      variant: "editorial", scene: "kit-scenes/poster_buddha-bw.png", kicker: "Коллекция",
      title: "Тихий ум",
      body: "Резьба по обыкновенному хондриту — каменному метеориту весом *46,8 грамма*, высотой 34,8 мм. Материал старше Земли, форма — из буддийской традиции.",
      spec: "Ordinary chondrite · 46,8 г", price: "51 255 ₽",
    }),
  },
  {
    id: "edit-shard", slot: "Имидж · коллекционный образец", formats: ["vertical"],
    props: M({
      variant: "editorial", scene: "kit-scenes/poster_shard-backlight.png", kicker: "Коллекционные образцы",
      title: "Сихотэ-Алинь",
      body: "Фрагмент железного метеорита, упавшего в Приморье *12 февраля 1947 года* — одно из немногих падений, которое видели и задокументировали. *Единственный экземпляр*: второго такого осколка не существует.",
      spec: "Железный метеорит · образец № 5", price: "40 000 ₽",
    }),
  },

  // ─── ПОСТЕРЫ: имя вещи и материал, больше ничего ─────────────────────────
  {
    id: "poster-shard", slot: "Постер · Сихотэ-Алинь", formats: ["vertical"],
    props: M({
      variant: "poster", scene: "kit-scenes/poster_shard-backlight.png", focus: "50% 58%",
      title: "Сихотэ-Алинь", spec: "Железный метеорит · падение 1947",
    }),
  },
  {
    id: "poster-buddha", slot: "Постер · Будда", formats: ["vertical"],
    props: M({
      variant: "poster", scene: "kit-scenes/poster_buddha-bw.png",
      title: "Тихий ум", spec: "Ordinary chondrite · 46,8 г",
    }),
  },
  {
    id: "poster-medallion", slot: "Постер · медальон Дракон", formats: ["vertical"],
    props: M({
      variant: "poster", scene: "kit-scenes/poster_medallion-smoke.png",
      title: "Хранитель", spec: "Метеорит Aletai · группа IIIE-an",
    }),
  },
  {
    id: "poster-piyao", slot: "Постер · Пи Яо", formats: ["vertical"],
    props: M({
      variant: "poster", scene: "kit-scenes/image_piyao-palm.png",
      title: "Пи Яо", spec: "Железный метеорит · класс IIICD",
    }),
  },
  {
    id: "poster-dzi", slot: "Постер · бусина Дзи", formats: ["vertical"],
    props: M({
      variant: "poster", scene: "kit-scenes/image_dzi-fingers.png",
      title: "Девять глаз", spec: "Метеорит Aletai · золото · 22,7 г",
    }),
  },
  ];

/** Два формата на каждый макет: баннер витрины и вертикальный пост. */
export const COLLECTION_FORMATS = [
  { key: "wide", width: 2400, height: 1200, label: "баннер 2:1" },
  { key: "vertical", width: 1200, height: 1500, label: "пост 4:5" },
] as const;
