import "./index.css";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { OverlayShowcase } from "./overlays/OverlayShowcase";
import { LogoReveal } from "./overlays/LogoReveal";
import { LogoRevealCosmic } from "./overlays/LogoRevealCosmic";
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

const THEMES: ThemeName[] = ["ember", "cyan"];
/** Суффикс id: ember — без суффикса (основной), cyan — копия. */
const suffix = (t: ThemeName) => (t === "ember" ? "" : "-Cyan");

const calcReel: CalculateMetadataFunction<ReelOverlaysProps> = ({ props }) => ({
  durationInFrames: reelDurationInFrames(props.items, FPS, props.endcard),
});

const calcSub: CalculateMetadataFunction<SubtitleTrackProps> = ({ props }) => ({
  durationInFrames: subtitleTrackDuration(props.cues, FPS),
});

export const RemotionRoot = () => {
  return (
    <>
      {THEMES.map((theme) => (
        <Composition
          key={`showcase-${theme}`}
          id={`Overlays-Showcase${suffix(theme)}`}
          component={OverlayShowcase}
          durationInFrames={562}
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
            defaultProps={{ items: reel.items, endcard: false, theme, footage: reel.footage }}
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

      {/* Космическая копия: тёмный фон-созвездие, светлый логотип, усиленные метеоры. */}
      <Composition
        id="LogoReveal-Cosmic"
        component={LogoRevealCosmic}
        durationInFrames={FPS * 6}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
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
          defaultProps={{ cues: SUBTITLE_DEMO, theme, footage: "footage/dronino.png" }}
        />
      ))}
    </>
  );
};
