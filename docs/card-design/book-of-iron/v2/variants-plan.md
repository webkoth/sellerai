# План: по 3 варианта каждого из 5 фаворитов v2 (15 генераций)

Фавориты оператора (2026-07-16): `v2_medallion_ink`, `v2_tsarev_basalt`, `v2_medallion_teal-stone`,
`v2_tsarev_star-chart`, `v2_plaque_space`. Задача — по 3 новых варианта каждого стиля:
та же композиция, товар и тексты, меняется только трактовка фона.

## Параметры генерации (HS MCP)

- `model: "nano_banana_pro"`, `aspect_ratio: "3:4"`, `resolution: "2k"`
- Реф — финальный v2-кадр по job id: `medias: [{value: "<job_id>", role: "image"}]`

| Стиль | Ref job id |
|-------|-----------|
| medallion_teal-stone | `e8e41d3a-ff33-4323-9334-ff31282993c2` |
| medallion_ink | `b81f2aca-4b47-4ef4-8520-42931ce4be35` |
| plaque_space | `b30b06ee-183f-41aa-906d-3dd3dc1fd3f1` |
| tsarev_star-chart | `bfeca07f-cc46-4315-b9b7-9b3fa21b2bab` |
| tsarev_basalt | `8a0ec751-7b88-40b5-8f4f-4fb4cc8a620c` |

## Общий каркас промпта

```
Take this reference product card and ONLY replace the background with {BG}.
Keep the layout, the product and ALL text word-for-word identical, same sizes and
positions, no frame (full-bleed). {TEXT_NOTE}
Crisp legible Cyrillic, photorealistic, premium card.
```

`{TEXT_NOTE}` по умолчанию: «Keep all text colors exactly as in the reference.»
Меняется только там, где фон меняет класс яркости (помечено ниже).

## 15 вариантов

### Медальон · бирюза-хризоколла (ref e8e41d3a…)

| Файл | {BG} |
|------|------|
| `v2_medallion_teal-raw.png` | raw untreated turquoise stone — matte blue-green surface crossed by a fine dark spiderweb matrix of veins, natural, tactile, dark enough for white text |
| `v2_medallion_teal-malachite.png` | polished blue-green malachite-azurite stone — large concentric banded swirls in deep teal and dark green, glossy mineral, dark enough for white text |
| `v2_medallion_teal-petrol.png` | deep petrol-teal near-solid backdrop (~#0d2b30) — very subtle fine stone grain, gentle vignette darkening toward edges, quiet and premium |

### Медальон · чернила в воде (ref b81f2aca…)

| Файл | {BG} |
|------|------|
| `v2_medallion_ink-gold.png` | dark ink clouds in deep water with fine shimmering gold dust particles suspended in the swirls, edges near-black, esoteric and luxurious |
| `v2_medallion_ink-teal.png` | teal-cyan ink plumes billowing in near-black deep water — brand blue-green ink glow behind the product, edges near-black |
| `v2_medallion_ink-plume.png` | one single dense column of graphite ink rising behind the product like slow smoke, the rest of the water clean near-black, minimal and hypnotic |

### Плакетка · глубокий космос (ref b30b06ee…)

| Файл | {BG} |
|------|------|
| `v2_plaque_space-nebula.png` | deep space with a rich glowing teal-and-emerald nebula occupying the upper third, scattered pinpoint stars, near-black edges |
| `v2_plaque_space-milkyway.png` | deep space with a diagonal band of the Milky Way — dense faint star dust crossing the frame behind the product, very dark elegant sky |
| `v2_plaque_space-minimal.png` | almost pure black space, only a handful of faint stars and a thin glowing planet horizon arc at the very bottom, ultra-minimal |

### Царев · карта неба (ref bfeca07f…)

| Файл | {BG} | Текст |
|------|------|-------|
| `v2_tsarev_chart-zodiac.png` | antique celestial chart on darker aged parchment — engraved zodiac constellation figures (subtle sepia etchings of mythical beasts), astronomical circles | графит, как в рефе |
| `v2_tsarev_chart-navy.png` | antique celestial star chart inverted: deep navy-blue night sky plate with fine white-gold engraved constellation lines and stars | **сменить**: title/subtitle/bottom → clean white, series/spec — cyan #7fe3f0 |
| `v2_tsarev_chart-comet.png` | aged cream parchment star chart with a dotted engraved trajectory of a falling bolide crossing the sheet toward the product, small sepia annotations | графит, как в рефе |

### Царев · чёрный базальт (ref 8a0ec751…)

| Файл | {BG} |
|------|------|
| `v2_tsarev_basalt-columns.png` | hexagonal columnar basalt wall — vertical volcanic columns lit by raking side light, deep charcoal, geometric and monumental |
| `v2_tsarev_basalt-wet.png` | wet polished black basalt slab — dark mirror-like sheen with soft specular highlights, rain-glazed volcanic stone |
| `v2_tsarev_basalt-cyan.png` | matte black basalt slab with cold cyan rim light grazing the micro-relief from one edge (brand teal glow), deep charcoal shadows |

## Статус

- [x] Выполнено 2026-07-16, все 15 файлов в этой папке. Job id — в README (секция «Вариации фаворитов»).
- basalt-columns потребовал 2 точечные правки затемнения (15283bb7 → f4a92559 → 12a98cac).
