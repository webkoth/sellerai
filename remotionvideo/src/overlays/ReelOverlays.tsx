import type { ReactNode } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  linearTiming,
  springTiming,
  TransitionSeries,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Overlay } from "./Overlay";
import { Stage } from "./kit";
import { inter } from "./fonts";
import { ThemeProvider } from "./ThemeContext";
import type { ThemeName } from "./theme";
import type { OverlayItem, TransitionKind } from "./types";

/** Длительность перехода между сценами (кадры). */
export const TRANSITION_FRAMES = 16;

/** Презентация перехода по виду (общая для ReelOverlays и Template). */
export const presentationFor = (
  k: TransitionKind = "fade",
): TransitionPresentation<Record<string, unknown>> =>
  (k === "slide"
    ? slide({ direction: "from-right" })
    : k === "wipe"
      ? wipe()
      : fade()) as TransitionPresentation<Record<string, unknown>>;

/** Тайминг перехода по виду. */
export const timingFor = (k: TransitionKind = "fade") =>
  k === "slide"
    ? springTiming({
        config: { damping: 200 },
        durationInFrames: TRANSITION_FRAMES,
      })
    : linearTiming({ durationInFrames: TRANSITION_FRAMES });

export type ReelOverlaysProps = {
  /** Список бит-сцен (см. reels.ts). */
  items: OverlayItem[];
  /** Цветовая тема акцента (ember / cyan). */
  theme?: ThemeName;
  /** Общий фон-футаж из public/ (под космической тонировкой), на весь ролик. */
  footage?: string;
  /** Сдвиг контента вниз, px (фон не двигается). По умолчанию 0 — по центру. */
  contentShiftY?: number;
};

/** Итоговая длительность: сумма сцен минус перекрытия переходов. */
export const reelDurationInFrames = (items: OverlayItem[], fps: number) => {
  const sum = items.reduce((a, o) => a + Math.round(o.durationSec * fps), 0);
  return Math.max(1, sum - Math.max(0, items.length - 1) * TRANSITION_FRAMES);
};

/** Сборщик ролика: бит-сцены через TransitionSeries (fade / slide / wipe). */
export const ReelOverlays = ({
  items,
  theme = "ember",
  footage,
  contentShiftY = 0,
}: ReelOverlaysProps) => {
  const { fps } = useVideoConfig();
  const children: ReactNode[] = [];

  items.forEach((item, i) => {
    if (i > 0) {
      children.push(
        <TransitionSeries.Transition
          key={`t-${i}`}
          presentation={presentationFor(item.transition)}
          timing={timingFor(item.transition)}
        />,
      );
    }
    children.push(
      <TransitionSeries.Sequence
        key={`s-${i}`}
        durationInFrames={Math.round(item.durationSec * fps)}
      >
        <Overlay item={item} />
      </TransitionSeries.Sequence>,
    );
  });

  // Фон — ОДИН на весь ролик (не уезжает при слайдах). Контент слайдится поверх него.
  return (
    <ThemeProvider name={theme}>
      <AbsoluteFill style={{ fontFamily: inter }}>
        <Stage footage={footage}>{null}</Stage>
        <AbsoluteFill
          style={
            contentShiftY
              ? { transform: `translateY(${contentShiftY}px)` }
              : undefined
          }
        >
          <TransitionSeries
            style={{
              translate: "1px -160px",
            }}
          >
            {children}
          </TransitionSeries>
        </AbsoluteFill>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
