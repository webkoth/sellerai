# Оверлеи серии «Метеориты KOTELNIKOVARTIFACT»

Полноэкранные графические сцены для вертикальных роликов (9:16, 1080×1920, 30 fps) в едином фирменном стиле. Дизайн-система перенесена из эталона `content-factory/video` (karpov-style): **тёмный constellation-фон + Inter КАПС + тёпло-оранжевый акцент + кремовые карточки + переходы**.

## Быстрый старт

```bash
cd remotionvideo
npm run dev          # Remotion Studio
```

Начни с композиции **`Overlays-Showcase`** — она прогоняет все приёмы и финальный логотип. Ролики серии — `Reel-1-Care` … `Reel-6-Sacred`.

## 5 ролей (приёмов)

| Роль | Приём | Стиль |
|------|-------|-------|
| `TITLE` | кинетический заголовок | слова появляются по очереди (spring), сегмент в `*…*` — маркерная подсветка |
| `FACT` | цифра/термин | крупный акцентный градиент со свечением + подпись (`caption`) |
| `KEY` | ключевая мысль | кремовая карточка с зерном, `*…*` — акцентный цвет |
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
| `kit.tsx` | примитивы: `Stage` (космос-фон), `Centered`, `Appear`, `Kicker`, `HighlightWord`, `BigTitle`, `Card`, `Typewriter`, `renderHighlighted` |
| `Title/Fact/Key/Type/Cta.tsx` | сцены по ролям |
| `Overlay.tsx` | диспетчер по роли |
| `ReelOverlays.tsx` | сборщик ролика на `TransitionSeries` + расчёт длительности |
| `reels.ts` | **данные всех 6 роликов** (сцены, тексты, тайминги, переходы) |
| `Endcard.tsx` | финальная заставка с логотипом |
| `OverlayShowcase.tsx` | витрина стиля |

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
| `LogoReveal-Cosmic` | тёмный constellation (как Reel-5-Cyan) | светлый | длинные хвосты + cyan-glow, больше пролётов, темп `pace=1.3` |

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

## Сменить акцент под бренд

Если karpov-оранжевый и cyan не подходят и нужен navy логотипа — добавь третью тему в `ACCENTS` (`theme.ts`): `accent`, `accentSoft`, `accentTitle`, `glow`, `glowSoft`, `gradient`. Всё остальное подтянется.

## Собрать ролик

Сцены и тайминги — в `reels.ts`:

```ts
{ role: "KEY", text: "Железо и никель боятся *влаги*", durationSec: 3.4, transition: "slide" }
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

## Источник контента

Тексты — из `docs/video-scripts/meteorites/*.md`. Стандарт подачи — skill `artifact-video-scriptwriter`.
