import { Sequence, useVideoConfig } from "remotion";
import { Stage } from "./kit";
import { Subtitle, type SubtitleVariant } from "./Subtitle";
import { ThemeProvider } from "./ThemeContext";
import type { ThemeName } from "./theme";

/** Реплика субтитра на таймлайне. */
export type SubtitleCue = {
  text: string;
  fromSec: number;
  durationSec: number;
  variant?: SubtitleVariant;
};

export type SubtitleTrackProps = {
  cues: SubtitleCue[];
  theme?: ThemeName;
  /** Фон: фото из public/ под космической тонировкой (как в Reel-4). */
  footage?: string;
  /** Сегмент `*…*` рисуется маркером-«прочерком» (единый стиль с заголовками). */
  animatedHighlight?: boolean;
};

/** Демо-набор: показывает обе плашки (glass + solid) с подсветкой ключевого слова. */
export const SUBTITLE_DEMO: SubtitleCue[] = [
  { text: "Это не просто *камень* из космоса", fromSec: 0.3, durationSec: 3.0, variant: "glass" },
  { text: "Ему около *4,5 миллиарда лет*", fromSec: 3.5, durationSec: 3.0, variant: "solid" },
  { text: "И второго такого *не существует*", fromSec: 6.8, durationSec: 3.4, variant: "glass" },
];

export const subtitleTrackDuration = (cues: SubtitleCue[], fps: number) => {
  const end = cues.reduce((m, c) => Math.max(m, c.fromSec + c.durationSec), 0);
  return Math.max(1, Math.round((end + 0.6) * fps));
};

/** Дорожка субтитров поверх фона/футажа. */
export const SubtitleTrack = ({ cues, theme = "ember", footage, animatedHighlight = false }: SubtitleTrackProps) => {
  const { fps } = useVideoConfig();
  return (
    <ThemeProvider name={theme}>
      <Stage footage={footage}>
        {cues.map((c, i) => {
          const dur = Math.round(c.durationSec * fps);
          return (
            <Sequence key={i} from={Math.round(c.fromSec * fps)} durationInFrames={dur} layout="none">
              <Subtitle text={c.text} variant={c.variant} durationInFrames={dur} animatedHighlight={animatedHighlight} />
            </Sequence>
          );
        })}
      </Stage>
    </ThemeProvider>
  );
};
