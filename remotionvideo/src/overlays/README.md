# Оверлеи серии «Метеориты KOTELNIKOVARTIFACT»

Полноэкранные графические сцены для вертикальных роликов (9:16, 1080×1920, 30 fps) в едином фирменном стиле. Дизайн-система перенесена из эталона `content-factory/video` (karpov-style): **тёмный constellation-фон + Inter КАПС + тёпло-оранжевый акцент + кремовые карточки + переходы**.

## Быстрый старт

```bash
cd remotionvideo
npm run dev          # Remotion Studio
```

Начни с композиции **`Template`** — это канонная сквозная витрина единого стиля: интро `Logo-Cosmic` → по одной сцене каждой роли (оба варианта `Statement`) → демо-плашки субтитров. `Overlays-Showcase` — только роли (без логотипа/субтитров). Ролики серии — `Reel-1-Care` … `Reel-6-Sacred`.

## 5 ролей (приёмов)

| Роль | Приём | Стиль |
|------|-------|-------|
| `TITLE` | кинетический заголовок | слова появляются по очереди (spring), сегмент в `*…*` — маркерная подсветка |
| `FACT` | цифра/термин | крупный акцентный градиент со свечением + подпись (`caption`) |
| `STATEMENT` | ключевая фраза | крупный текст на космо-фоне (без карточки), 2 варианта через `variant`: `center` (акцентная черта-«прочерк» сверху) и `quote` (вертикальная акцентная черта слева) |
| `TYPE` | печатная машинка | typewriter (string slicing) + мигающий курсор + подпись |
| `CTA` | призыв | kicker + крупный КАПС + стрелка с брендом |

Подсветка/акцент задаётся прямо в тексте звёздочками: `"Не чудо. *Напоминание*."`

## Переходы

Сцены сшиваются через `@remotion/transitions`. У каждой сцены поле `transition`: `"fade"` (по умолчанию) · `"slide"` · `"wipe"`. Итоговая длительность ролика = сумма сцен − перекрытия (считается в `reelDurationInFrames`).

## Файлы

| Файл | Назначение |
|------|-----------|
| `theme.ts` | **единый стиль**: палитра, фон `BG`, `ACCENT_GRAD`, зерно, `PAD`. Главная точка кастомизации. |
| `fonts.ts` | Inter (latin + cyrillic) |
| `kit.tsx` | примитивы: `Stage` (космос-фон), `BrandChrome`, `Centered`, `Appear`, `Kicker`, `HighlightWord`, `BigTitle`, `Card`, `Typewriter`, `renderHighlighted` |
| `Title/Fact/Statement/Type/Cta.tsx` | сцены по ролям |
| `Overlay.tsx` | диспетчер по роли |
| `ReelOverlays.tsx` | сборщик ролика на `TransitionSeries` + расчёт длительности (экспортирует `presentationFor`/`timingFor`) |
| `reels.ts` | **данные всех 6 роликов** (сцены, тексты, тайминги, переходы) |
| `Template.tsx` | **сквозная витрина-эталон**: Logo-Cosmic → роли → субтитры на едином фоне |
| `OverlayShowcase.tsx` | витрина ролей (без логотипа/субтитров) |
| `ConstellationText.tsx` / `ConstellationReveal.tsx` | **флагман** «сборка из созвездия»: частицы + посимвольная дешифровка |
| `DroninoReel.tsx` | продуктовый ролик на базе Reel-4 (3 сцены, контент опущен через `contentShiftY`) |

## Цветовые темы

Акцент вынесен в **темы** (`theme.ts` → `ACCENTS`) и раздаётся через `ThemeProvider` (context). Доступны две:

| Тема | Акцент | id-композиций |
|------|--------|---------------|
| `ember` | тёпло-оранжевый `#FB4A29` (как эталон) | без суффикса: `Reel-1-Care`, `Overlays-Showcase`, `SubtitlePlates` |
| `cyan` | космический cyan `#22D3EE` | суффикс `-Cyan`: `Reel-1-Care-Cyan`, `Overlays-Showcase-Cyan`, … |

Каждый ролик/витрина/субтитры зарегистрированы в **обеих** темах — это копии, можно сравнивать рядом в Studio.

- Сменить тему сцены/ролика — проп `theme="cyan"` у `ReelOverlays` / `SubtitleTrack` / `OverlayShowcase`.
- Добавить новую тему — допиши палитру в `ACCENTS` (`theme.ts`) и добавь имя в `THEMES` (`Root.tsx`).

## Логотип (анимация)

`LogoReveal.tsx` — анимированный логотип KOTELNIKOVARTIFACT из `logo_anime.svg` (контуры в `logoPaths.ts`):
1. метеорный дождь — мелкие метеоры с хвостами летят по диагонали;
2. основной метеор-знак влетает с motion-blur хвостом и тормозит;
3. надпись проявляется слева-направо (буквы по очереди, write-on маской);
4. линия раскрывается из центра, тег-лайн дорисовывается;
5. лок-ап мягко оседает.

Ядро вынесено в `LogoRevealCore` (параметры: `color`, `meteorColor`, `glow`, `trailCopies`, `trailLen`, `dist`, `stagger`, `pace`, `minis`). Два готовых варианта:

| Композиция | Фон | Логотип | Особенности |
|------------|-----|---------|-------------|
| `LogoReveal` | прозрачный (alpha-ProRes) | оригинальный navy | для наложения на любой футаж |
| `LogoReveal-Cosmic` | тёмный constellation (как Reel-5-Cyan) | светлый | длинные хвосты + glow акцента, больше пролётов, темп `pace=1.25`; принимает проп `theme` (дефолт `cyan`) |

Темп/длину следов/число пролётов крутим параметрами `LogoRevealCore` (`pace` >1 медленнее, `trailCopies`/`trailLen` — хвост, `minis[]` — пролёты).

```bash
npx remotion render LogoReveal out/logo.mov          # прозрачный .mov
npx remotion render LogoReveal-Cosmic out/logo-cosmic.mp4   # тёмный фон
```

## Субтитры

`Subtitle.tsx` — анимированная плашка (spring slide-up + fade, как сцены Reel-4), две на выбор:
- `glass` — тёмная полупрозрачная (blur) для тёмного футажа;
- `solid` — кремовая для светлого футажа.

Ключевое слово подсвечивается акцентом темы через `*…*`. Дорожка — `SubtitleTrack` (data-driven, `cues[]` с таймкодами), демо-композиции `SubtitlePlates` / `SubtitlePlates-Cyan` (поверх футажа Дронино).

## Флагман: «сборка из созвездия»

`ConstellationText.tsx` — заголовок собирается из разлетающихся звёзд-частиц с кометными хвостами (сходятся к каждой букве), параллельно идёт **посимвольная дешифровка** (случайные глифы резолвятся в финальный текст). На защёлкивании буквы — акцентная вспышка с glow + focus-pull (блюр→резкость). Композиция-витрина — `Constellation-Reveal` / `Constellation-Reveal-Cyan`.

Используемые приёмы (которых нет в базовых ролях): per-char анимация, scramble-decode, сходящиеся частицы, кометные хвосты, focus-pull. Параметры: `text` (с `*…*`), `startAt`, `size`, `perChar` (лаг защёлкивания).

```tsx
<ConstellationText text="РОЖДЁН ИЗ *ЗВЁЗД*" startAt={12} size={124} perChar={3} />
```

## Опустить контент (продуктовый ракурс)

У `ReelOverlays` есть проп `contentShiftY` — сдвигает **только контент** вниз (`translateY`), фон-футаж остаётся на месте. Применено в `DroninoReel.tsx` (композиция `Reel-Dronino-Cyan`): обрезанный до сути Reel-4 (Дронино → природный рельеф → единственный экземпляр), текст опущен ниже центра, чтобы не перекрывать продукт.

## Сменить акцент под бренд

Если karpov-оранжевый и cyan не подходят и нужен navy логотипа — добавь третью тему в `ACCENTS` (`theme.ts`): `accent`, `accentSoft`, `accentTitle`, `glow`, `glowSoft`, `gradient`. Всё остальное подтянется.

## Собрать ролик

Сцены и тайминги — в `reels.ts`:

```ts
{ role: "STATEMENT", text: "Железо и никель боятся *влаги*", durationSec: 3.4, transition: "slide", variant: "quote" }
```

> ⚠️ Длительности — под темп Shorts. Под закадровый голос подправить.

## Реальный футаж

Положи видео в `public/footage/`, укажи `footage` у сцены — продукт ляжет под космической тонировкой (тёмный скрим + constellation сверху). Для видео в `kit.tsx` (`FootageLayer`) замени `<Img>` на `<Video>` из `@remotion/media`.

> `public/footage/*.png` сейчас — **карточки WB как заглушки** (с впечатанным текстом). Для финала — чистый предметный футаж.

## Рендер

```bash
# финальный ролик MP4
npx remotion render Reel-4-Product out/reel-4.mp4

# витрина стиля целиком
npx remotion render Overlays-Showcase out/showcase.mp4

# один кадр для проверки
npx remotion still Overlays-Showcase out/check.png --frame=50 --scale=0.5
```

Это самостоятельные графические сцены (непрозрачный космический фон) — обычный MP4/PNG, ProRes-альфа не нужен.

## Прозрачные плашки (наложение на футаж)

`TemplatePlate.tsx` — одиночная плашка в стиле `Template` на **прозрачном** фоне (без `Stage`/брендинга, только контент роли + хвостовой fade-out). Зарегистрированы две в cyan-теме:

| Композиция | Роль | Контент |
|------------|------|---------|
| `Plate-Age-Cyan` | `FACT` | **4,5 млрд лет** + подпись |
| `Plate-Widmanstatten-Cyan` | `STATEMENT` (center) | **Видманштеттенова _структура_** |

> ⚠️ **Альфа-рендер.** CLI `npx remotion render` **игнорирует** alpha-настройки из `calculateMetadata` — по умолчанию `.mov` уходит в ProRes **HQ (yuv422, без альфы)**. Прозрачность только с явными флагами `--codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png`. Готовые скрипты:

```bash
npm run render:plates   # обе плашки → out/plate-age.mov, out/plate-widman.mov
npm run render:logo     # LogoReveal → out/logo.mov
# проверка альфы: ffprobe должен показать profile=4444, pix_fmt=yuva444p12le
```

## Источник контента

Тексты — из `docs/video-scripts/meteorites/*.md`. Стандарт подачи — skill `artifact-video-scriptwriter`.
