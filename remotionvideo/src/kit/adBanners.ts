import type { KitCollectionBannerProps } from "./KitCollectionBanner";

/**
 * Креативы для РСЯ (Директ), кампания «РСЯ · KOTELNIKOVARTIFACT магазин», 2026-09.
 * Стиль — «новая коллекция» (промо-модель: светлая студийная сцена, изделие справа, текст слева).
 * Сцены собирает marketing/direct/make_scenes.py из студийных 12 Мп фото в public/kit-ad/.
 * Тексты только проверяемые: происхождение, сертификат, доставка. Никаких свойств изделий.
 */
export const AD_FORMATS = [
  { key: "1x1", width: 1200, height: 1200, label: "квадрат 1:1" },
  { key: "4x3", width: 1600, height: 1200, label: "4:3" },
  { key: "16x9", width: 1920, height: 1080, label: "16:9" },
] as const;

export type AdSlot = { id: string; props: Omit<KitCollectionBannerProps, "scene"> };

const P = (o: AdSlot["props"]) => o;

export const AD_SLOTS: AdSlot[] = [
  {
    id: "meteority",
    props: P({
      variant: "promo", side: "left", light: true,
      kicker: "Коллекционные метеориты", title: "Старше\nЗемли",
      body: "Сихотэ-Алинь, Дронино, Царёв. Сертификат подлинности.",
      offer: "Бесплатная доставка по России", cta: "Смотреть",
    }),
  },
  {
    id: "amulety",
    props: P({
      variant: "promo", side: "left", light: true,
      kicker: "Амулеты из метеорита", title: "Резьба по\nнебесному железу",
      body: "Метеорит Алетай, группа IIIE-an. Сертификат IMCA.",
      offer: "Подарочная упаковка", cta: "Смотреть",
    }),
  },
  {
    id: "braslety",
    props: P({
      variant: "promo", side: "left", light: true,
      kicker: "Браслеты", title: "Носится\nкаждый день",
      body: "Натуральные камни и метеорит Алетай, найден в 1898 году.",
      offer: "Бесплатная доставка по России", cta: "Выбрать", price: "от 7 000 ₽",
    }),
  },
  {
    id: "podarki",
    props: P({
      variant: "promo", side: "left", light: true,
      kicker: "Подарок мужчине", title: "Подарок,\nкоторый старше Земли",
      body: "Метеорит с сертификатом в подарочной коробке.",
      offer: "Доставка бесплатно · возврат 7 дней", cta: "Выбрать",
    }),
  },
  {
    id: "chasy",
    props: P({
      variant: "promo", side: "left", light: true,
      kicker: "Часы с метеоритом", title: "Космос\nна запястье",
      body: "Вставка из метеорита Муонионалуста, Швеция. Узор не повторяется.",
      offer: "Подарочная упаковка", cta: "Смотреть",
    }),
  },
];
