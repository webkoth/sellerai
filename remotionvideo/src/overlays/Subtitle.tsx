import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { inter } from "./fonts";
import { renderHighlighted } from "./kit";
import { colors } from "./theme";
import { useAccent } from "./ThemeContext";

/** Вид плашки субтитра. */
export type SubtitleVariant = "glass" | "solid";

/**
 * Анимированная плашка субтитра (нижняя треть).
 * Вход: spring slide-up + fade (как сцены Reel-4). Выход: fade в конце.
 * Сегмент `*…*` подсвечивается акцентом темы.
 */
export const Subtitle = ({
  text,
  variant = "glass",
  durationInFrames,
}: {
  text: string;
  variant?: SubtitleVariant;
  durationInFrames: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = useAccent();

  const inS = spring({ frame, fps, config: { damping: 200, stiffness: 120, mass: 0.6 } });
  const y = interpolate(inS, [0, 1], [44, 0], { extrapolateRight: "clamp" });
  const opIn = interpolate(inS, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const opOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(opIn, opOut);
  const glass = variant === "glass";

  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 360, paddingLeft: 70, paddingRight: 70 }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${y}px)`,
          maxWidth: 920,
          background: glass ? "rgba(12, 13, 18, 0.66)" : colors.cardLight,
          backdropFilter: glass ? "blur(10px)" : undefined,
          WebkitBackdropFilter: glass ? "blur(10px)" : undefined,
          border: glass ? `1px solid ${colors.hairline}` : "none",
          borderRadius: 18,
          padding: "24px 36px",
          boxShadow: glass ? "0 18px 50px rgba(0,0,0,0.45)" : "0 18px 50px rgba(0,0,0,0.30)",
        }}
      >
        <div
          style={{
            fontFamily: inter,
            fontWeight: 800,
            fontSize: 52,
            lineHeight: 1.18,
            letterSpacing: "-0.01em",
            textAlign: "center",
            color: glass ? colors.title : colors.cardLightTitle,
          }}
        >
          {renderHighlighted(text, a.accent)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
