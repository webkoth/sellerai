import "./index.css";
import { Composition, type CalculateMetadataFunction } from "remotion";
import {
  OverlayShowcase,
  showcaseDurationInFrames,
  type OverlayShowcaseProps,
} from "./overlays/OverlayShowcase";
import { LogoReveal } from "./overlays/LogoReveal";
import { LogoRevealCosmic } from "./overlays/LogoRevealCosmic";
import { Template, templateDurationInFrames } from "./overlays/Template";
import { TemplatePlate } from "./overlays/TemplatePlate";
import { DroninoReel, droninoReelDuration } from "./overlays/DroninoReel";
import { DroninoSubs, droninoSubsDuration } from "./overlays/DroninoSubs";
import { CareReel, careReelDuration } from "./overlays/CareReel";
import { ReelPreview, reelPreviewDuration } from "./overlays/ReelPreview";
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
    </>
  );
};
