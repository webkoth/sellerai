import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { inter } from "./fonts";
import { Overlay } from "./Overlay";
import { ThemeProvider } from "./ThemeContext";
import type { ThemeName } from "./theme";
import type { OverlayItem } from "./types";

/**
 * Одиночная плашка в стиле Template-Cyan на ПРОЗРАЧНОМ фоне — для наложения
 * на любой футаж во внешнем редакторе. В отличие от `Template`: нет `Stage`
 * (космо-фона), брендинга и шеврона — только контент роли (FACT/STATEMENT/…)
 * с фирменной анимацией входа и cyan-акцентом.
 *
 * Каждая плашка — отдельная композиция (см. `Root.tsx`), рендерится в
 * alpha-ProRes (`calculateMetadata` задаёт prores / yuva444p10le / 4444).
 */
export type TemplatePlateProps = { item: OverlayItem; theme?: ThemeName };

export const TemplatePlate = ({ item, theme = "cyan" }: TemplatePlateProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // Мягкий хвостовой fade-out, чтобы плашка была самодостаточным клипом.
  const out = interpolate(
    frame,
    [durationInFrames - 14, durationInFrames - 2],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <ThemeProvider name={theme}>
      {/* Фон не задаём — холст остаётся прозрачным (alpha). */}
      <AbsoluteFill style={{ fontFamily: inter, opacity: out }}>
        <Overlay item={item} />
      </AbsoluteFill>
    </ThemeProvider>
  );
};
