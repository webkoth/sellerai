import "./index.css";
import { Composition, type CalculateMetadataFunction } from "remotion";
import {
  OverlayShowcase,
  showcaseDurationInFrames,
  type OverlayShowcaseProps,
} from "./overlays/OverlayShowcase";
import { KitBanner } from "./kit/KitBanner";
import { KIT_SLOTS } from "./kit/banners";
import { KitFashionBanner } from "./kit/KitFashionBanner";
import { FASHION_SLOTS } from "./kit/fashionBanners";
import { KitGraphiteBanner } from "./kit/KitGraphiteBanner";
import { BLUE_SLOTS, GRAPHITE_SLOTS } from "./kit/graphiteBanners";
import { PREMIUM_SLOTS } from "./kit/premiumBanners";
import { KitArtifactBanner } from "./kit/KitArtifactBanner";
import { ARTIFACT_SLOTS, HS_SLOTS, CARD_SLOTS } from "./kit/artifactBanners";
import { PRODUCT_CARD_SLOTS, GLAV_SLOTS, GLAV_MOBILE_SLOTS } from "./kit/cardSlots";
import { HS_CARD_SLOTS } from "./kit/hsCardSlots";
import { KitCollectionBanner } from "./kit/KitCollectionBanner";
import { COLLECTION, COLLECTION_FORMATS } from "./kit/collectionBanners";
import { LogoReveal } from "./overlays/LogoReveal";
import { LogoRevealCosmic } from "./overlays/LogoRevealCosmic";
import { Template, templateDurationInFrames } from "./overlays/Template";
import { TemplatePlate } from "./overlays/TemplatePlate";
import { DroninoReel, droninoReelDuration } from "./overlays/DroninoReel";
import { DroninoSubs, droninoSubsDuration } from "./overlays/DroninoSubs";
import { CareReel, careReelDuration } from "./overlays/CareReel";
import { ReelPreview, reelPreviewDuration } from "./overlays/ReelPreview";
import { YouTubePreview, youTubePreviewDuration } from "./overlays/YouTubePreview";
import { ConstellationReveal } from "./overlays/ConstellationReveal";
import {
  ReelOverlays,
  reelDurationInFrames,
  type ReelOverlaysProps,
} from "./overlays/ReelOverlays";
import {
  SubtitleTrack,
  subtitleTrackDuration,
  SUBTITLE_DEMO,
  type SubtitleTrackProps,
} from "./overlays/SubtitleTrack";
import { REELS } from "./overlays/reels";
import { FPS, VIDEO, type ThemeName } from "./overlays/theme";
import type { OverlayItem } from "./overlays/types";

const THEMES: ThemeName[] = ["ember", "cyan"];
/** Суффикс id: ember — без суффикса (основной), cyan — копия. */
const suffix = (t: ThemeName) => (t === "ember" ? "" : "-Cyan");

/** Метаданные alpha-ProRes — прозрачный фон при рендере (как у LogoReveal). */
const alphaMeta = () =>
  ({
    defaultCodec: "prores",
    defaultVideoImageFormat: "png",
    defaultPixelFormat: "yuva444p10le",
    defaultProResProfile: "4444",
  }) as const;

/** Отдельные плашки в стиле Template-Cyan на прозрачном фоне (наложение на футаж). */
const PLATES: { id: string; item: OverlayItem }[] = [
  {
    id: "Plate-Age-Cyan",
    item: {
      role: "FACT",
      text: "4,5 млрд лет",
      caption: "древнейшее вещество Солнечной системы",
      durationSec: 4,
    },
  },
  {
    id: "Plate-Widmanstatten-Cyan",
    item: {
      role: "STATEMENT",
      text: "Видманштеттенова *структура*",
      durationSec: 4,
      variant: "center",
    },
  },
];

/** Подсерия «Виды метеоритов» — отдельные ролики по каждому типу (05a/05b/05c). */
const SUB_REELS: { reelId: string; prefix: string }[] = [
  { reelId: "Reel-5a-Stony", prefix: "M5a" },
  { reelId: "Reel-5b-Iron", prefix: "M5b" },
  { reelId: "Reel-5c-StonyIron", prefix: "M5c" },
  // Обзор изделия: подвеска «Звёздная мандала» с метеоритом Серичо (videos/meteorites/04-sericho-pendant)
  { reelId: "Reel-4-Sericho", prefix: "M4S" },
];

const calcReel: CalculateMetadataFunction<ReelOverlaysProps> = ({ props }) => ({
  durationInFrames: reelDurationInFrames(props.items, FPS),
});

const calcShowcase: CalculateMetadataFunction<OverlayShowcaseProps> = () => ({
  durationInFrames: showcaseDurationInFrames(FPS),
});

const calcSub: CalculateMetadataFunction<SubtitleTrackProps> = ({ props }) => ({
  durationInFrames: subtitleTrackDuration(props.cues, FPS),
});

export const RemotionRoot = () => {
  return (
    <>
      {/* Ролик 1 «Уход» — реальная говорящая голова (dual-system) + субтитры + чипы + аутро. */}
      <Composition
        id="Reel-01-Care"
        component={CareReel}
        durationInFrames={careReelDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      {/* Ролик 5 «Виды метеоритов» — оверлеи ОТДЕЛЬНЫМИ alpha-плашками (ProRes 4444,
          прозрачный фон) под наложение на футаж метеоритов в DaVinci. Тексты — из
          reels.ts (Reel-5-Types). Каждая сцена — самостоятельный клип со своей анимацией. */}
      {(REELS.find((r) => r.id === "Reel-5-Types")?.items ?? []).map(
        (item, i) => (
          <Composition
            key={`m5-overlay-${i}`}
            id={`M5-Overlay-${i + 1}-${item.role}`}
            component={TemplatePlate}
            durationInFrames={Math.round(item.durationSec * FPS)}
            fps={FPS}
            width={VIDEO.width}
            height={VIDEO.height}
            defaultProps={{ item, theme: "cyan" as ThemeName }}
            calculateMetadata={alphaMeta}
          />
        ),
      )}
      {/* Подсерия 5a/5b/5c «Каменные / Железные / Каменно-железные» — те же
          alpha-плашки под наложение на футаж. Тексты — из reels.ts. */}
      {SUB_REELS.flatMap(({ reelId, prefix }) =>
        (REELS.find((r) => r.id === reelId)?.items ?? []).map((item, i) => (
          <Composition
            key={`${prefix}-overlay-${i}`}
            id={`${prefix}-Overlay-${i + 1}-${item.role}`}
            component={TemplatePlate}
            durationInFrames={Math.round(item.durationSec * FPS)}
            fps={FPS}
            width={VIDEO.width}
            height={VIDEO.height}
            defaultProps={{ item, theme: "cyan" as ThemeName }}
            calculateMetadata={alphaMeta}
          />
        )),
      )}
      {/* YouTube-обложка промо-ролика — 16:9 (1920×1080), стиль превью сторис. */}
      <Composition
        id="YouTube-Promo-Preview"
        component={YouTubePreview}
        durationInFrames={youTubePreviewDuration(FPS)}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          title: "Как я соприкоснулась\nс *метеоритами*",
          photo: "footage/founder-chair-removebg.png",
          photoWidth: 690,
          heroPhoto: "footage/meteorite-iron-removebg.png",
          heroWidth: 470,
          theme: "cyan" as ThemeName,
        }}
      />
      {/* Превью роликов серии — обложка 9:16, фото мастера в углу + крупный заголовок. */}
      <Composition
        id="Reel-WhyMeteorites-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "Почему я работаю с *метеоритами*?",
          photo: "footage/kotelnokova_premovebg-preview.png",
          theme: "cyan" as ThemeName,
        }}
      />
      <Composition
        id="Reel-Care-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "Правила ухода за *метеоритами*",
          photo: "footage/pravila-uhoda-removebg-preview.png",
          theme: "cyan" as ThemeName,
        }}
      />
      {/* Превью ролика 2 «Безопасность: радиация»: hero — образец + бытовой дозиметр
          (0.05 µSv/h · NORMAL), сигнатурный кадр доверия ролика. */}
      <Composition
        id="Reel-Radiation-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "Метеорит — это *радиация*?",
          photo: "footage/meteorite-radiation-removebg.png",
          theme: "cyan" as ThemeName,
        }}
      />
      {/* Превью ролика 5 «Виды метеоритов»: фото мастера с образцом в руке + заголовок-вопрос. */}
      <Composition
        id="Reel-Types-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "Какие бывают *метеориты*?",
          photo: "footage/meteorite-removebg-preview.png",
          theme: "cyan" as ThemeName,
        }}
      />
      {/* Превью подсерии 5a/5b/5c — обложки по типам. Фото — removebg hero-кадра
          соответствующего футажа (см. videos/meteorites/<ролик>/README.md). */}
      <Composition
        id="Reel-Stony-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "Что внутри *каменного* метеорита?",
          photo: "footage/meteorite-stony-removebg.png",
          theme: "cyan" as ThemeName,
        }}
      />
      <Composition
        id="Reel-Iron-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "*Железный* узор,\nчто не подделать",
          photo: "footage/meteorite-iron-removebg.png",
          theme: "cyan" as ThemeName,
        }}
      />
      <Composition
        id="Reel-Pallasite-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "*Палласит* —\nвитраж из космоса",
          photo: "footage/meteorite-pallasite-removebg.png",
          theme: "cyan" as ThemeName,
        }}
      />
      {/* Превью обзора изделия «Серичо»: hero — removebg фото подвески с карточки WB. */}
      <Composition
        id="Reel-Sericho-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "Подвеска с метеоритом *Серичо*",
          photo: "footage/sericho-pendant-removebg.png",
          theme: "cyan" as ThemeName,
        }}
      />
      {/* Превью ролика 6 «Алхимия и сакральность»: тёплая тема ember (огонь падения /
          золото гробницы), фото кулона-артефакта (removebg). Заголовок — хук ролика. */}
      <Composition
        id="Reel-Alchemy-Preview"
        component={ReelPreview}
        durationInFrames={reelPreviewDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          title: "Алхимия и *сакральность* метеоритов",
          photo: "footage/meteorite-sacred-removebg.png",
          theme: "ember" as ThemeName,
        }}
      />
      {/* Канонная сквозная витрина стиля: Logo-Cosmic → роли → субтитры (обе темы). */}
      {THEMES.map((theme) => (
        <Composition
          key={`template-${theme}`}
          id={`Template${suffix(theme)}`}
          component={Template}
          durationInFrames={templateDurationInFrames(FPS)}
          fps={FPS}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ theme }}
        />
      ))}
      {/* Отдельные плашки Template-Cyan на ПРОЗРАЧНОМ фоне (alpha-ProRes) — для наложения. */}
      {PLATES.map(({ id, item }) => (
        <Composition
          key={id}
          id={id}
          component={TemplatePlate}
          durationInFrames={FPS * 4}
          fps={FPS}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ item, theme: "cyan" as ThemeName }}
          calculateMetadata={alphaMeta}
        />
      ))}
      {/* Флагман «Сборка из созвездия»: заголовок собирается из звёзд-частиц + дешифровка. */}
      {THEMES.map((theme) => (
        <Composition
          key={`constellation-${theme}`}
          id={`Constellation-Reveal${suffix(theme)}`}
          component={ConstellationReveal}
          durationInFrames={FPS * 6}
          fps={FPS}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ theme }}
        />
      ))}
      {/* Продуктовый ролик на базе Reel-4-Product-Cyan: 3 сцены, контент опущен ниже. */}
      <Composition
        id="Reel-Dronino-Cyan"
        component={DroninoReel}
        durationInFrames={droninoReelDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{ contentShiftY: 160 }}
      />
      {/* Дронино «в виде субтитров»: субтитровый размер + анимация плашки, акцент-слово — маркер-«прочерк». */}
      <Composition
        id="Reel-Dronino-Subs-Cyan"
        component={DroninoSubs}
        durationInFrames={droninoSubsDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="Reel-Dronino-Subs-Cyan1"
        component={DroninoSubs}
        durationInFrames={droninoSubsDuration(FPS)}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      {/* Витрина ролей (кубик): по одной сцене каждого приёма + переходы. */}
      {THEMES.map((theme) => (
        <Composition
          key={`showcase-${theme}`}
          id={`Overlays-Showcase${suffix(theme)}`}
          component={OverlayShowcase}
          durationInFrames={600}
          calculateMetadata={calcShowcase}
          fps={FPS}
          width={VIDEO.width}
          height={VIDEO.height}
          defaultProps={{ theme }}
        />
      ))}
      {THEMES.map((theme) =>
        REELS.map((reel) => (
          <Composition
            key={`${reel.id}-${theme}`}
            id={`${reel.id}${suffix(theme)}`}
            component={ReelOverlays}
            fps={FPS}
            width={VIDEO.width}
            height={VIDEO.height}
            durationInFrames={FPS * 20}
            calculateMetadata={calcReel}
            defaultProps={{ items: reel.items, theme, footage: reel.footage }}
          />
        )),
      )}
      {/* Анимированный логотип — оригинальный navy, прозрачный фон (alpha по умолчанию). */}
      <Composition
        id="LogoReveal"
        component={LogoReveal}
        durationInFrames={FPS * 5}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        calculateMetadata={() => ({
          defaultCodec: "prores",
          defaultVideoImageFormat: "png",
          defaultPixelFormat: "yuva444p10le",
          defaultProResProfile: "4444",
        })}
      />
      {/* Космическая копия (кубик #1): тёмный фон-созвездие, светлый логотип, усиленные метеоры. */}
      <Composition
        id="LogoReveal-Cosmic"
        component={LogoRevealCosmic}
        durationInFrames={FPS * 6}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{ theme: "cyan" }}
      />
      {THEMES.map((theme) => (
        <Composition
          key={`subs-${theme}`}
          id={`SubtitlePlates${suffix(theme)}`}
          component={SubtitleTrack}
          fps={FPS}
          width={VIDEO.width}
          height={VIDEO.height}
          durationInFrames={FPS * 11}
          calculateMetadata={calcSub}
          defaultProps={{
            cues: SUBTITLE_DEMO,
            theme,
            footage: "footage/dronino.png",
          }}
        />
      ))}

      {/* Баннеры витрины Яндекс KIT — статичные кадры (remotion still). */}
      {KIT_SLOTS.map((s) => (
        <Composition
          key={s.id}
          id={`Kit-${s.id.replace(/_/g, "-")}`}
          component={KitBanner}
          durationInFrames={1}
          fps={FPS}
          width={s.width}
          height={s.height}
          defaultProps={s.props}
        />
      ))}

      {/* Fashion-editorial набор на реальных фото образцов. */}
      {FASHION_SLOTS.map((s) => (
        <Composition
          key={s.id}
          id={`Kit-${s.id}`}
          component={KitFashionBanner}
          durationInFrames={1}
          fps={FPS}
          width={s.width}
          height={s.height}
          defaultProps={s.props}
        />
      ))}

      {/* Набор «графит-космос»: вырезки на графите + текст прямо на фото. */}
      {COLLECTION.flatMap((c) =>
        COLLECTION_FORMATS.filter((f) => c.formats.includes(f.key)).map((f) => (
          <Composition
            key={`${c.id}-${f.key}`}
            id={`Col-${c.id}-${f.key}`}
            component={KitCollectionBanner}
            durationInFrames={1}
            fps={FPS}
            width={f.width}
            height={f.height}
            defaultProps={c.props}
          />
        )),
      )}

      {[...ARTIFACT_SLOTS, ...HS_SLOTS, ...CARD_SLOTS, ...PRODUCT_CARD_SLOTS, ...GLAV_SLOTS, ...GLAV_MOBILE_SLOTS, ...HS_CARD_SLOTS].map((s) => (
        <Composition
          key={s.id}
          id={`Kit-${s.id.replace(/_/g, "-")}`}
          component={KitArtifactBanner}
          durationInFrames={1}
          fps={FPS}
          width={s.width}
          height={s.height}
          defaultProps={s.props}
        />
      ))}

      {[...GRAPHITE_SLOTS, ...BLUE_SLOTS, ...PREMIUM_SLOTS].map((s) => (
        <Composition
          key={s.id}
          id={`Kit-${s.id}`}
          component={KitGraphiteBanner}
          durationInFrames={1}
          fps={FPS}
          width={s.width}
          height={s.height}
          defaultProps={s.props}
        />
      ))}
    </>
  );
};
