import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Appear, HighlightWord, Stage, tokenizeTitle, useSpringIn } from "./kit";
import { colors, PAD, type ThemeName } from "./theme";
import { ThemeProvider, useAccent } from "./ThemeContext";

/**
 * Превью-кадр (обложка) ролика серии «Метеориты KOTELNIKOVARTIFACT».
 * Космо-фон + крупный заголовок слева-сверху (ключевое слово под акцентной
 * подсветкой) + фото мастера (removebg) в правом нижнем углу. Вертикаль 9:16.
 * Параметризуется заголовком и фото — один компонент на все ролики серии.
 *
 * В заголовке слово(а) в `*звёздочках*` получают акцентную маркер-подсветку.
 */

/** Фото мастера в правом нижнем углу: вход справа + лёгкий «дыхательный» float. */
const MasterPhoto = ({ photo }: { photo: string }) => {
  const frame = useCurrentFrame();
  const a = useAccent();
  const s = useSpringIn(12, 26, 90);
  const opacity = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const x = interpolate(s, [0, 1], [90, 0], { extrapolateRight: "clamp" });
  const float = Math.sin(frame * 0.045) * 7;
  const W = 720;
  return (
    <div
      style={{
        position: "absolute",
        right: -8,
        bottom: 0,
        width: W,
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      {/* Космическое свечение-подложка под фигурой. */}
      <div
        style={{
          position: "absolute",
          left: "8%",
          right: "2%",
          bottom: 0,
          height: W * 0.92,
          background: `radial-gradient(58% 52% at 58% 72%, ${a.glowSoft} 0%, transparent 72%)`,
          filter: "blur(26px)",
          pointerEvents: "none",
        }}
      />
      <Img
        src={staticFile(photo)}
        style={{
          position: "relative",
          width: "100%",
          display: "block",
          transform: `translateY(${float}px)`,
          filter: `drop-shadow(0 26px 54px rgba(0,0,0,0.6)) drop-shadow(0 0 30px ${a.glowSoft})`,
        }}
      />
    </div>
  );
};

/** Заголовок слева-сверху: акцентная черта + крупная фраза с подсветкой ключевого слова. */
const Headline = ({ title }: { title: string }) => {
  const tokens = tokenizeTitle(title);
  const penDelay = 18 + tokens.length * 5 + 6;
  const { fps } = useVideoConfig();
  const a = useAccent();
  const rule = spring({ frame: useCurrentFrame(), fps, delay: 6, durationInFrames: 18, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", left: PAD, right: PAD, top: 232, maxWidth: 760 }}>
      <div
        style={{
          width: 120,
          height: 5,
          borderRadius: 5,
          marginBottom: 30,
          background: a.gradient,
          boxShadow: `0 0 20px ${a.glow}`,
          transform: `scaleX(${Math.max(0, Math.min(1, rule))})`,
          transformOrigin: "left center",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
        {tokens.map((t, i) => (
          <Appear key={i} delay={16 + i * 5} from="up">
            <div
              style={{
                fontSize: 96,
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: "-0.02em",
                color: colors.title,
              }}
            >
              {t.hl ? <HighlightWord delay={penDelay}>{t.w}</HighlightWord> : t.w}
            </div>
          </Appear>
        ))}
      </div>
    </div>
  );
};

export type ReelPreviewProps = {
  title: string;
  photo: string;
  theme?: ThemeName;
};

/** Превью-обложка ролика серии (вертикаль 9:16). */
export const ReelPreview = ({ title, photo, theme = "cyan" }: ReelPreviewProps) => (
  <ThemeProvider name={theme}>
    <Stage brand="KOTELNIKOVARTIFACT">
      <Headline title={title} />
      <MasterPhoto photo={photo} />
    </Stage>
  </ThemeProvider>
);

export const reelPreviewDuration = (fps: number) => fps * 4;
