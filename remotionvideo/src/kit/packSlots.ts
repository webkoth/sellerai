import type { KitArtifactBannerProps } from "./KitArtifactBanner";
import type { ArtifactSlot } from "./artifactBanners";

/** Фото упаковки в галерее карточки товара — 16.09.2026.
 *
 *  Заменяют три прежних общих фото WB со старой упаковкой (белый и синий мешочки,
 *  золотое тиснение). Сцены сняты в Higgsfield по фото настоящей упаковки: серый
 *  бархатный мешочек, чёрная и белая коробочки, серебряное тиснение.
 *
 *  Тексты — по смыслу прежних фото, без обещаний:
 *  «Ваши артефакты упакованы в фирменные мешочки и коробочки» → pack-1,
 *  «KOTELNIKOVARTIFACT meteorites & jewelry» → pack-2,
 *  «Ваше украшение заслуживает достойной упаковки» → pack-3 («украшение» убрано:
 *  фото стоит и на коллекционных образцах).
 *
 *  Линия заголовка 0.76, а не 0.68 как у главных фото: упаковка в сценах доходит
 *  до 0.73, и подгонка масштабом загнала бы коробку под строку бренда. Это фото
 *  галереи, в сетке каталога оно не стоит, поэтому общая линия ему не нужна. */
const base = {
  productInBackground: true, layout: "poster", textScale: 1.35, titleTop: 0.76,
} as const;

export const PACK_SLOTS: ArtifactSlot[] = [
  {
    id: "pack-1", width: 1200, height: 1600,
    slot: "Галерея карточки — фирменная упаковка",
    props: {
      ...base,
      background: "kit-pack-hs/pack_1_meshochki.jpg",
      photo: "kit-pack-hs/pack_1_meshochki.jpg",
      titleScale: 0.66,
      series: "В каждом заказе", title: "ФИРМЕННАЯ УПАКОВКА",
      subtitle: "мешочек и коробочка с логотипом бренда",
      meta: "Входит в заказ без доплаты",
    } as KitArtifactBannerProps,
  },
  {
    id: "pack-2", width: 1200, height: 1600,
    slot: "Галерея карточки — коробочка бренда",
    props: {
      ...base,
      background: "kit-pack-hs/pack_2_brand.jpg",
      photo: "kit-pack-hs/pack_2_brand.jpg",
      titleScale: 0.66,
      series: "Метеориты и украшения", title: "ГОТОВО К ВРУЧЕНИЮ",
      subtitle: "серебряное тиснение на матовой коробочке",
      meta: "Welcome to space community",
    } as KitArtifactBannerProps,
  },
  {
    id: "pack-3", width: 1200, height: 1600,
    slot: "Галерея карточки — достойная упаковка",
    props: {
      ...base,
      background: "kit-pack-hs/pack_3_dostoynaya.jpg",
      photo: "kit-pack-hs/pack_3_dostoynaya.jpg",
      onLight: true,
      titleScale: 0.66,
      series: "Подарочная упаковка", title: "ДОСТОЙНАЯ УПАКОВКА",
      subtitle: "для вашего артефакта",
      meta: "Бархатный мешочек · коробочка",
    } as KitArtifactBannerProps,
  },
];
