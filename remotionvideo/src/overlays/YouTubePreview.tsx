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
 * YouTube-обложка (16:9, 1920×1080) в стиле превью сторис серии «Метеориты»:
 * космо-фон + крупный заголовок слева (ключевое слово под акцентной подсветкой)
 * + фото мастера (removebg) в правом нижнем углу. Горизонтальный порт ReelPreview.
 *
 * Рендер стилла — поздним кадром (~100), когда пружины устоялись:
 *   npx remotion still src/index.ts YouTube-Promo-Preview <out.png> --frame=100
 */

/** Фото мастера в правом нижнем углу: вход справа + космическое свечение-подложка. */
const MasterPhoto = ({ photo, width = 640 }: { photo: string; width?: number }) => {
  const frame = useCurrentFrame();
  const a = useAccent();
  const s = useSpringIn(12, 26, 90);
  const opacity = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const x = interpolate(s, [0, 1], [90, 0], { extrapolateRight: "clamp" });
  const float = Math.sin(frame * 0.045) * 7;
  return (
    <div
      style={{
        position: "absolute",
        right: 36,
        bottom: 0,
        width,
        opacity,
        transform: `translateX(${x}px)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "6%",
          right: "0%",
          bottom: 0,
          height: width * 0.94,
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

/** Метеорит-герой (removebg) между заголовком и фото: наклон + космическое свечение. */
const HeroObject = ({ photo, width = 400 }: { photo: string; width?: number }) => {
  const frame = useCurrentFrame();
  const a = useAccent();
  const s = useSpringIn(18, 26, 90);
  const opacity = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(s, [0, 1], [70, 0], { extrapolateRight: "clamp" });
  const float = Math.sin(frame * 0.04 + 1.4) * 6;
  return (
    <div
      style={{
        position: "absolute",
        left: 1015,
        bottom: -95,
        width,
        opacity,
        transform: `translateY(${y + float}px) rotate(-6deg)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "10% 0%",
          background: `radial-gradient(52% 46% at 50% 50%, ${a.glowSoft} 0%, transparent 72%)`,
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />
      <Img
        src={staticFile(photo)}
        style={{
          position: "relative",
          width: "100%",
          display: "block",
          filter: `drop-shadow(0 26px 54px rgba(0,0,0,0.6)) drop-shadow(0 0 34px ${a.glowSoft})`,
        }}
      />
    </div>
  );
};

/** Заголовок слева: акцентная черта + крупная фраза с подсветкой ключевого слова. */
const Headline = ({ title }: { title: string }) => {
  const tokens = tokenizeTitle(title);
  const penDelay = 18 + tokens.length * 5 + 6;
  const { fps } = useVideoConfig();
  const a = useAccent();
  const rule = spring({ frame: useCurrentFrame(), fps, delay: 6, durationInFrames: 18, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", left: PAD, top: 236, maxWidth: 1150 }}>
      <div
        style={{
          width: 140,
          height: 6,
          borderRadius: 6,
          marginBottom: 40,
          background: a.gradient,
          boxShadow: `0 0 20px ${a.glow}`,
          transform: `scaleX(${Math.max(0, Math.min(1, rule))})`,
          transformOrigin: "left center",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 26px" }}>
        {tokens.map((t, i) => (
          <Appear key={i} delay={16 + i * 5} from="up">
            <div
              style={{
                fontSize: 128,
                fontWeight: 800,
                lineHeight: 1.06,
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

export type YouTubePreviewProps = {
  title: string;
  photo: string;
  /** Ширина фото мастера в правом нижнем углу, px. */
  photoWidth?: number;
  /** Метеорит-герой (removebg) между заголовком и фото (необязательно). */
  heroPhoto?: string;
  heroWidth?: number;
  theme?: ThemeName;
};

/** YouTube-обложка промо (горизонталь 16:9). */
export const YouTubePreview = ({
  title,
  photo,
  photoWidth = 640,
  heroPhoto,
  heroWidth = 400,
  theme = "cyan",
}: YouTubePreviewProps) => (
  <ThemeProvider name={theme}>
    <Stage brand="KOTELNIKOVARTIFACT" showChevron={false}>
      {heroPhoto ? <HeroObject photo={heroPhoto} width={heroWidth} /> : null}
      <Headline title={title} />
      <MasterPhoto photo={photo} width={photoWidth} />
    </Stage>
  </ThemeProvider>
);

export const youTubePreviewDuration = (fps: number) => fps * 4;
