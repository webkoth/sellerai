import type { KitArtifactBannerProps } from "./KitArtifactBanner";
import type { ArtifactSlot } from "./artifactBanners";

/** Карточки товара: фактурный фон + вырезка этого изделия + типографика «Книги небесного железа». */
const CARD = (bg: string, photo: string, o: Record<string, unknown>) => ({
  background: `kit-bg/${bg}`, photo: `kit-cards/${photo}`, layout: "poster", ...o,
});

export const PRODUCT_CARD_SLOTS: ArtifactSlot[] = [
  {
    id: "card-001", width: 1200, height: 1600,
    slot: "Карточка — Шарм подвеска с Метеоритом",
    props: CARD("bg_medallion_ink-teal.png", "cut_001.png", {
      series: "Украшения", title: "ПОДВЕСКА",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Ручная работа · Краснодар", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-002", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Царев (горбушка) 34,5 гр.",
    props: CARD("bg_plaque_space-milkyway.png", "cut_002.png", {
      series: "Коллекционные образцы", title: "ЦАРЁВ",
      subtitle: "коллекционный образец",
      meta: "Метеорит Царёв · Волгоградская область · 1968", note: "Вес: 34,5 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-003", width: 1200, height: 1600,
    slot: "Карточка — Часы наручные женские с метеоритом Муонионалуста",
    props: CARD("bg_medallion_ink-plume.png", "cut_003.png", {
      series: "Украшения", title: "МУОНИОНАЛУСТА",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Муонионалуста · Швеция · 1906", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-004", width: 1200, height: 1600,
    slot: "Карточка — Браслет из натуральных камней с метеоритом Муони",
    props: CARD("bg_plaque_space-minimal.png", "cut_004.png", {
      series: "Украшения", title: "МУОНИОНАЛУСТА",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Метеорит Муонионалуста · Швеция · 1906", note: "Размер подбираем по запястью", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-005", width: 1200, height: 1600,
    slot: "Карточка — Мужской браслет Прометей лабрадорит с метеоритом",
    props: CARD("bg_medallion_teal-raw.png", "cut_005.png", {
      series: "Украшения", title: "ПРОМЕТЕЙ",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Метеорит Aletai · Китай · 1898", note: "Размер подбираем по запястью", photoScale: 0.95,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-006", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Дронино железный коллекционный образец ",
    props: CARD("bg_tsarev_chart-comet.png", "cut_006.png", {
      series: "Коллекционные образцы", title: "ДРОНИНО",
      subtitle: "железный метеорит",
      meta: "Метеорит Дронино · Рязанская область · 2000", note: "Вес: 27,8 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-007", width: 1200, height: 1600,
    slot: "Карточка — Бусина Дзи 9 глаз метеорит Алетай, золото, амуле",
    props: CARD("bg_tsarev_basalt-cyan.png", "cut_007.png", {
      series: "Книга небесного железа", title: "ДЕВЯТЬ ГЛАЗ",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба", photoScale: 0.95,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-008", width: 1200, height: 1600,
    slot: "Карточка — Браслет женский Сердце Будды с метеоритом Алетай",
    props: CARD("bg_plaque_space-minimal.png", "cut_008.png", {
      series: "Украшения", title: "ALETAI",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Метеорит Aletai · Китай · 1898", note: "Размер подбираем по запястью", photoScale: 0.95,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-009", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь железный, образец 55,7 гр,",
    props: CARD("bg_tsarev_chart-comet.png", "cut_009.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "железный метеорит",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", note: "Вес: 55,7 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-010", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь железный, образец 31,1 гр,",
    props: CARD("bg_tsarev_chart-navy.png", "cut_010.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "железный метеорит",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", note: "Вес: 31,1 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-011", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Дронино железный, коллекционный образец",
    props: CARD("bg_plaque_space-milkyway.png", "cut_011.png", {
      series: "Коллекционные образцы", title: "ДРОНИНО",
      subtitle: "железный метеорит",
      meta: "Метеорит Дронино · Рязанская область · 2000", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-012", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Царёв каменный образец 34 гр, оберег по",
    props: CARD("bg_tsarev_chart-comet.png", "cut_012.png", {
      series: "Коллекционные образцы", title: "ЦАРЁВ",
      subtitle: "каменный метеорит",
      meta: "Метеорит Царёв · Волгоградская область · 1968", note: "Вес: 34 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-013", width: 1200, height: 1600,
    slot: "Карточка — Кулон-амулет паук из индошинита, тектит, оберег ",
    props: CARD("bg_tsarev_basalt-cyan.png", "cut_013.png", {
      series: "Книга небесного железа", title: "ПАУК",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Индошинит · Юго-Восточная Азия", note: "Ручная резьба", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-014", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь железный, коллекционный об",
    props: CARD("bg_plaque_space-milkyway.png", "cut_014.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "железный метеорит",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-015", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь железный коллекционный, об",
    props: CARD("bg_tsarev_chart-comet.png", "cut_015.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "железный метеорит",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-016", width: 1200, height: 1600,
    slot: "Карточка — Мужской браслет из натуральных камней с метеорит",
    props: CARD("bg_plaque_space-minimal.png", "cut_016.png", {
      series: "Украшения", title: "ALETAI",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Метеорит Aletai · Китай · 1898", note: "Размер подбираем по запястью", photoScale: 0.95,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-017", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Царёв каменный образец 18 гр, оберег по",
    props: CARD("bg_plaque_space-milkyway.png", "cut_017.png", {
      series: "Коллекционные образцы", title: "ЦАРЁВ",
      subtitle: "каменный метеорит",
      meta: "Метеорит Царёв · Волгоградская область · 1968", note: "Вес: 18 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-018", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Дронино железный, коллекционный образец",
    props: CARD("bg_tsarev_chart-comet.png", "cut_018.png", {
      series: "Коллекционные образцы", title: "ДРОНИНО",
      subtitle: "железный метеорит",
      meta: "Метеорит Дронино · Рязанская область · 2000", note: "Вес: 62,1 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-019", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь железный, коллекционный об",
    props: CARD("bg_tsarev_chart-navy.png", "cut_019.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "железный метеорит",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-020", width: 1200, height: 1600,
    slot: "Карточка — Бусина Дзи из метеорита Алетай",
    props: CARD("bg_medallion_teal-raw.png", "cut_020.png", {
      series: "Книга небесного железа", title: "БУСИНА ДЗИ",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба", photoScale: 0.95,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-021", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Царёв каменный, коллекционный образец 2",
    props: CARD("bg_tsarev_chart-comet.png", "cut_021.png", {
      series: "Коллекционные образцы", title: "ЦАРЁВ",
      subtitle: "каменный метеорит",
      meta: "Метеорит Царёв · Волгоградская область · 1968", note: "Вес: 29,3 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-022", width: 1200, height: 1600,
    slot: "Карточка — Кулон Чжун Куй из индошинита, амулет защиты, обе",
    props: CARD("bg_medallion_teal-raw.png", "cut_022.png", {
      series: "Книга небесного железа", title: "ЧЖУН КУЙ",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Индошинит · Юго-Восточная Азия", note: "Ручная резьба", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-023", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Дронино железный коллекционный образец,",
    props: CARD("bg_plaque_space-milkyway.png", "cut_023.png", {
      series: "Коллекционные образцы", title: "ДРОНИНО",
      subtitle: "железный метеорит",
      meta: "Метеорит Дронино · Рязанская область · 2000", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-024", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь коллекционный образец 12 г",
    props: CARD("bg_tsarev_chart-comet.png", "cut_024.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "коллекционный образец",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", note: "Вес: 12 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-025", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь железный, образец 19,4 гр,",
    props: CARD("bg_tsarev_chart-navy.png", "cut_025.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "железный метеорит",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", note: "Вес: 19,4 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-026", width: 1200, height: 1600,
    slot: "Карточка — Фигурка Будда из каменного метеорита, коллекцион",
    props: CARD("bg_medallion_teal-raw.png", "cut_026.png", {
      series: "Книга небесного железа", title: "БУДДА",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Ручная работа · Краснодар", note: "Ручная резьба", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-027", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Дронино железный, коллекционный образец",
    props: CARD("bg_tsarev_chart-comet.png", "cut_027.png", {
      series: "Коллекционные образцы", title: "ДРОНИНО",
      subtitle: "железный метеорит",
      meta: "Метеорит Дронино · Рязанская область · 2000", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-028", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Царёв каменный образец 30 гр, оберег ко",
    props: CARD("bg_tsarev_chart-navy.png", "cut_028.png", {
      series: "Коллекционные образцы", title: "ЦАРЁВ",
      subtitle: "каменный метеорит",
      meta: "Метеорит Царёв · Волгоградская область · 1968", note: "Вес: 30 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-029", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Кампо-дель-Сьело железный коллекционный",
    props: CARD("bg_plaque_space-milkyway.png", "cut_029.png", {
      series: "Коллекционные образцы", title: "КАМПО-ДЕЛЬ-СЬЕЛО",
      subtitle: "железный метеорит",
      meta: "Метеорит Кампо-дель-Сьело · Аргентина · 1576", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-030", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Царёв каменный образец 64 гр, оберег по",
    props: CARD("bg_tsarev_chart-comet.png", "cut_030.png", {
      series: "Коллекционные образцы", title: "ЦАРЁВ",
      subtitle: "каменный метеорит",
      meta: "Метеорит Царёв · Волгоградская область · 1968", note: "Вес: 64 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-031", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Дронино железный, коллекционный образец",
    props: CARD("bg_tsarev_chart-navy.png", "cut_031.png", {
      series: "Коллекционные образцы", title: "ДРОНИНО",
      subtitle: "железный метеорит",
      meta: "Метеорит Дронино · Рязанская область · 2000", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-032", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь коллекционный образец 24 г",
    props: CARD("bg_plaque_space-milkyway.png", "cut_032.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "коллекционный образец",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", note: "Вес: 24 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-033", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Кампо-дель-Сьело железный образец 27,1 ",
    props: CARD("bg_tsarev_chart-comet.png", "cut_033.png", {
      series: "Коллекционные образцы", title: "КАМПО-ДЕЛЬ-СЬЕЛО",
      subtitle: "железный метеорит",
      meta: "Метеорит Кампо-дель-Сьело · Аргентина · 1576", note: "Вес: 27,1 г", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-034", width: 1200, height: 1600,
    slot: "Карточка — Браслет Синергия с метеоритом Алетай и лабрадори",
    props: CARD("bg_plaque_space-minimal.png", "cut_034.png", {
      series: "Украшения", title: "СИНЕРГИЯ",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Метеорит Aletai · Китай · 1898", note: "Размер подбираем по запястью", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-036", width: 1200, height: 1600,
    slot: "Карточка — Подвеска женская Сияние с метеоритом Муонионалус",
    props: CARD("bg_medallion_ink-plume.png", "cut_036.png", {
      series: "Украшения", title: "МУОНИОНАЛУСТА",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Муонионалуста · Швеция · 1906", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-037", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Царёв каменный образец 119 гр, подарок ",
    props: CARD("bg_tsarev_chart-navy.png", "cut_037.png", {
      series: "Коллекционные образцы", title: "ЦАРЁВ",
      subtitle: "каменный метеорит",
      meta: "Метеорит Царёв · Волгоградская область · 1968", note: "Вес: 119 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-038", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь железный, коллекционный об",
    props: CARD("bg_plaque_space-milkyway.png", "cut_038.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "железный метеорит",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-039", width: 1200, height: 1600,
    slot: "Карточка — Кулон Дракон из метеорита Алетай, амулет оберег ",
    props: CARD("bg_tsarev_basalt-cyan.png", "cut_039.png", {
      series: "Книга небесного железа", title: "ДРАКОН",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-040", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Царёв каменный образец 33 гр, оберег ко",
    props: CARD("bg_tsarev_chart-navy.png", "cut_040.png", {
      series: "Коллекционные образцы", title: "ЦАРЁВ",
      subtitle: "каменный метеорит",
      meta: "Метеорит Царёв · Волгоградская область · 1968", note: "Вес: 33 г", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-041", width: 1200, height: 1600,
    slot: "Карточка — Бусина Дзи 9 глаз из метеорита Алетай, амулет об",
    props: CARD("bg_tsarev_basalt-cyan.png", "cut_041.png", {
      series: "Книга небесного железа", title: "ДЕВЯТЬ ГЛАЗ",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба", photoScale: 0.95,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-042", width: 1200, height: 1600,
    slot: "Карточка — Кулон из метеорита Алетай, оберег амулет",
    props: CARD("bg_medallion_ink-plume.png", "cut_042.png", {
      series: "Украшения", title: "ALETAI",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Aletai · Китай · 1898", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-044", width: 1200, height: 1600,
    slot: "Карточка — Подвеска Манджушри из метеорита Алетай, амулет о",
    props: CARD("bg_medallion_teal-raw.png", "cut_044.png", {
      series: "Книга небесного железа", title: "МАНДЖУШРИ",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-045", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Дронино железный, коллекционный образец",
    props: CARD("bg_tsarev_chart-comet.png", "cut_045.png", {
      series: "Коллекционные образцы", title: "ДРОНИНО",
      subtitle: "железный метеорит",
      meta: "Метеорит Дронино · Рязанская область · 2000", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-046", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Кампо-дель-Сьело железный образец 23,2 ",
    props: CARD("bg_tsarev_chart-navy.png", "cut_046.png", {
      series: "Коллекционные образцы", title: "КАМПО-ДЕЛЬ-СЬЕЛО",
      subtitle: "железный метеорит",
      meta: "Метеорит Кампо-дель-Сьело · Аргентина · 1576", note: "Вес: 23,2 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-047", width: 1200, height: 1600,
    slot: "Карточка — Крест с метеоритом Муонионалуста, подвеска обере",
    props: CARD("bg_medallion_ink-teal.png", "cut_047.png", {
      series: "Украшения", title: "МУОНИОНАЛУСТА",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Муонионалуста · Швеция · 1906", photoScale: 0.95,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-048", width: 1200, height: 1600,
    slot: "Карточка — Подвеска женская мелонг из метеорита Алетай, аму",
    props: CARD("bg_medallion_teal-raw.png", "cut_048.png", {
      series: "Книга небесного железа", title: "МЕЛОНГ",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-049", width: 1200, height: 1600,
    slot: "Карточка — Подвеска с метеоритом Муонионалуста и Молдавитом",
    props: CARD("bg_medallion_ink-teal.png", "cut_049.png", {
      series: "Украшения", title: "МУОНИОНАЛУСТА",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Муонионалуста · Швеция · 1906", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-050", width: 1200, height: 1600,
    slot: "Карточка — Кулон Чжун Куй из индошинита, амулет защиты, обе",
    props: CARD("bg_medallion_teal-raw.png", "cut_050.png", {
      series: "Книга небесного железа", title: "ЧЖУН КУЙ",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Индошинит · Юго-Восточная Азия", note: "Ручная резьба", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-052", width: 1200, height: 1600,
    slot: "Карточка — Подвеска с метеоритом",
    props: CARD("bg_medallion_ink-plume.png", "cut_052.png", {
      series: "Украшения", title: "ПОДВЕСКА",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Ручная работа · Краснодар", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-053", width: 1200, height: 1600,
    slot: "Карточка — Кулон \"Денежный страж\" из метеорита Муонионалуст",
    props: CARD("bg_medallion_ink-teal.png", "cut_053.png", {
      series: "Украшения", title: "ДЕНЕЖНЫЙ СТРАЖ",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Муонионалуста · Швеция · 1906", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-054", width: 1200, height: 1600,
    slot: "Карточка — Подвеска с метеоритом Серичо",
    props: CARD("bg_medallion_ink-plume.png", "cut_054.png", {
      series: "Украшения", title: "SERICHO",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Sericho · Кения · 2016", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-056", width: 1200, height: 1600,
    slot: "Карточка — Браслет из индошинита с бусиной Дзи, натуральные",
    props: CARD("bg_plaque_space-minimal.png", "cut_056.png", {
      series: "Украшения", title: "ИНДОШИНИТ",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Индошинит · Юго-Восточная Азия", note: "Размер подбираем по запястью", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-057", width: 1200, height: 1600,
    slot: "Карточка — Фигурка Будда из каменного метеорита, 77,3 гр, о",
    props: CARD("bg_tsarev_basalt-cyan.png", "cut_057.png", {
      series: "Книга небесного железа", title: "БУДДА",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Ручная работа · Краснодар", note: "Вес: 77,3 г", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-058", width: 1200, height: 1600,
    slot: "Карточка — Кулон женский из метеорита Алетай, амулет оберег",
    props: CARD("bg_medallion_ink-plume.png", "cut_058.png", {
      series: "Украшения", title: "ALETAI",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Aletai · Китай · 1898", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-059", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Дронино железный коллекционный образец ",
    props: CARD("bg_plaque_space-milkyway.png", "cut_059.png", {
      series: "Коллекционные образцы", title: "ДРОНИНО",
      subtitle: "железный метеорит",
      meta: "Метеорит Дронино · Рязанская область · 2000", note: "Вес: 60,2 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-060", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Сихотэ-Алинь железный, осколок, образец",
    props: CARD("bg_tsarev_chart-comet.png", "cut_060.png", {
      series: "Коллекционные образцы", title: "СИХОТЭ-АЛИНЬ",
      subtitle: "железный метеорит",
      meta: "Метеорит Сихотэ-Алинь · Приморский край · 1947", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-061", width: 1200, height: 1600,
    slot: "Карточка — Метеорит Каньон Дьябло - коллекционный образец: ",
    props: CARD("bg_tsarev_chart-navy.png", "cut_061.png", {
      series: "Коллекционные образцы", title: "КАНЬОН ДЬЯБЛО",
      subtitle: "коллекционный образец",
      meta: "Метеорит Каньон Дьябло · Аризона, США · 1891", note: "Вес: 14,2 г", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-062", width: 1200, height: 1600,
    slot: "Карточка — Подвеска с метеоритом Серичо",
    props: CARD("bg_medallion_ink-plume.png", "cut_062.png", {
      series: "Украшения", title: "SERICHO",
      subtitle: "оправа ручной работы, метеоритная вставка",
      meta: "Метеорит Sericho · Кения · 2016", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-063", width: 1200, height: 1600,
    slot: "Карточка — Кулон Пи Яо из метеорита Алетай, амулет изобилия",
    props: CARD("bg_tsarev_basalt-cyan.png", "cut_063.png", {
      series: "Книга небесного железа", title: "ПИ ЯО",
      subtitle: "резьба вручную по метеоритному железу",
      meta: "Метеорит Aletai · Китай · 1898", note: "Ручная резьба", photoScale: 0.81,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-064", width: 1200, height: 1600,
    slot: "Карточка — Браслет Вершитель с метеоритом Муонионалуста и л",
    props: CARD("bg_plaque_space-minimal.png", "cut_064.png", {
      series: "Украшения", title: "ВЕРШИТЕЛЬ",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Метеорит Муонионалуста · Швеция · 1906", note: "Размер подбираем по запястью", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-065", width: 1200, height: 1600,
    slot: "Карточка — Браслет \"Мудрость Будды\" с бусиной и мантрой для",
    props: CARD("bg_medallion_teal-raw.png", "cut_065.png", {
      series: "Украшения", title: "МУДРОСТЬ БУДДЫ",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Ручная работа · Краснодар", note: "Размер подбираем по запястью", photoScale: 0.95,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-066", width: 1200, height: 1600,
    slot: "Карточка — Браслет Синергия с метеоритом Алетай и лабрадори",
    props: CARD("bg_plaque_space-minimal.png", "cut_066.png", {
      series: "Украшения", title: "СИНЕРГИЯ",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Метеорит Aletai · Китай · 1898", note: "Размер подбираем по запястью", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
  {
    id: "card-067", width: 1200, height: 1600,
    slot: "Карточка — Браслет Звёздный маг с метеоритом Алетай и бусин",
    props: CARD("bg_medallion_teal-raw.png", "cut_067.png", {
      series: "Украшения", title: "ЗВЁЗДНЫЙ МАГ",
      subtitle: "ручная сборка, натуральный камень и метеорит",
      meta: "Метеорит Aletai · Китай · 1898", note: "Размер подбираем по запястью", photoScale: 0.89,
    }) as KitArtifactBannerProps,
  },
];

/** Слайдшоу главной на кадрах Higgsfield: изделие в кадре справа, текст слева. */
const GLAV = (photo: string, o: Record<string, unknown>) => ({
  background: `kit-hs/${photo}`, photo: `kit-hs/${photo}`, productInBackground: true, ...o,
});

export const GLAV_SLOTS: ArtifactSlot[] = [
  {
    id: "glav-1-material", width: 2400, height: 1200,
    slot: "Главная, слайд 1 — коллекционные образцы",
    props: GLAV("glav-d1-material.png", {
      series: "Коллекционные образцы", title: "Возраст, который не подделать",
      subtitle: "железные, каменные и палласиты · у каждого своё имя",
      meta: "Сихотэ-Алинь · Приморский край · 1947",
      note: "Вес и место падения — в каждой карточке", layout: "wide",
    }) as KitArtifactBannerProps,
  },
  {
    id: "glav-2-cosmos", width: 2400, height: 1200,
    slot: "Главная, слайд 2 — украшения",
    props: GLAV("glav-d2-cosmos.png", {
      series: "Украшения", title: "Срез, который не повторится",
      subtitle: "палласит в серебре — оливины светятся на просвет",
      meta: "Метеорит Sericho · Кения · 2016",
      note: "Рисунок среза уникален", layout: "wide",
    }) as KitArtifactBannerProps,
  },
  {
    id: "glav-3-sign", width: 2400, height: 1200,
    slot: "Главная, слайд 3 — амулеты и обереги",
    props: GLAV("glav-d3-sign.png", {
      series: "Амулеты и обереги", title: "Знак, а не украшение",
      subtitle: "резьба по небесному железу, вручную",
      meta: "Метеорит Aletai · Китай · 1898",
      note: "Ручная резьба", layout: "wide",
    }) as KitArtifactBannerProps,
  },
  {
    id: "glav-4-delivery", width: 2400, height: 1200,
    slot: "Главная, слайд 4 — доставка",
    props: GLAV("glav-d4-delivery.png", {
      series: "Доставка", title: "Бережная отправка по России",
      subtitle: "упаковка для хрупких образцов · трек-номер в день отправки",
      meta: "Отправляем из Краснодара", layout: "wide",
    }) as KitArtifactBannerProps,
  },
];

export const GLAV_MOBILE_SLOTS: ArtifactSlot[] = [
  { id: "glavm-1-material", width: 1080, height: 1440, slot: "Главная мобильная — коллекционные образцы",
    props: GLAV("glavm-1.png", { series: "Коллекционные образцы", title: "Возраст, который не подделать",
      subtitle: "железные, каменные и палласиты", meta: "Сихотэ-Алинь · Приморский край · 1947", layout: "poster" }) as KitArtifactBannerProps },
  { id: "glavm-2-cosmos", width: 1080, height: 1440, slot: "Главная мобильная — украшения",
    props: GLAV("glavm-2.png", { series: "Украшения", title: "Срез, который не повторится",
      subtitle: "палласит в серебре, оливины на просвет", meta: "Метеорит Sericho · Кения · 2016", layout: "poster" }) as KitArtifactBannerProps },
  { id: "glavm-3-sign", width: 1080, height: 1440, slot: "Главная мобильная — амулеты",
    props: GLAV("glavm-3.png", { series: "Амулеты и обереги", title: "Знак, а не украшение",
      subtitle: "резьба по небесному железу, вручную", meta: "Метеорит Aletai · Китай · 1898", layout: "poster" }) as KitArtifactBannerProps },
  { id: "glavm-4-delivery", width: 1080, height: 1440, slot: "Главная мобильная — доставка",
    props: GLAV("glavm-4.png", { series: "Доставка", title: "Бережная отправка по России",
      subtitle: "упаковка для хрупких образцов", meta: "Трек-номер в день отправки", layout: "poster" }) as KitArtifactBannerProps },
];
