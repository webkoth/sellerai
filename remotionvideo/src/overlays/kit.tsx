import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { inter } from "./fonts";
import { BG, colors, GRAIN, PAD } from "./theme";
import { useAccent } from "./ThemeContext";

// ============================================================
// Shared kit — примитивы фирменного стиля (порт из эталона
// content-factory: WeeklyMotionOverlays / TimelineWeeklyCard).
// ============================================================

/** Spring-вход с задержкой. */
export const useSpringIn = (delay: number, damping = 22, stiffness = 110) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: { damping, stiffness, mass: 0.6 },
  });
};

// ---------- Constellation background ----------

const MESH_COUNT = 34;
const MESH_LINK_DIST = 0.17;
const meshNodes = Array.from({ length: MESH_COUNT }, (_, i) => ({
  x: 0.06 + Math.pow(random(`mt-mesh-x-${i}`), 0.6) * 0.96,
  y: 0.04 + random(`mt-mesh-y-${i}`) * 0.93,
}));
const meshEdges: Array<[number, number]> = (() => {
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < meshNodes.length; i++) {
    for (let j = i + 1; j < meshNodes.length; j++) {
      const dx = meshNodes[i].x - meshNodes[j].x;
      const dy = meshNodes[i].y - meshNodes[j].y;
      if (Math.hypot(dx, dy) < MESH_LINK_DIST) edges.push([i, j]);
    }
  }
  return edges;
})();

const ConstellationBg = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pos = meshNodes.map((n, i) => {
    const dx = Math.sin(frame * 0.015 + i * 0.7) * 0.005;
    const dy = Math.cos(frame * 0.013 + i * 1.1) * 0.005;
    return { x: (n.x + dx) * width, y: (n.y + dy) * height };
  });
  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, opacity: fadeIn }}
    >
      {meshEdges.map(([a, b], k) => (
        <line
          key={k}
          x1={pos[a].x}
          y1={pos[a].y}
          x2={pos[b].x}
          y2={pos[b].y}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={1}
        />
      ))}
      {pos.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.4}
          fill="rgba(255, 255, 255, 0.26)"
        />
      ))}
    </svg>
  );
};

const GrainOverlay = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage: GRAIN,
      backgroundSize: "140px 140px",
      opacity: 0.07,
      mixBlendMode: "multiply",
      pointerEvents: "none",
    }}
  />
);

const Chevron = () => {
  const opacity = interpolate(useSpringIn(14, 22, 120), [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
      }}
    >
      <svg width={34} height={34} viewBox="0 0 24 24" fill="none">
        <path
          d="M6 9l6 6 6-6"
          stroke={colors.chevron}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const BrandTag = ({ label }: { label: string }) => {
  const opacity = interpolate(useSpringIn(10, 22, 120), [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: PAD,
        right: PAD,
        fontFamily: inter,
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: "0.14em",
        color: colors.brand,
        opacity,
      }}
    >
      {label}
    </div>
  );
};

/** Бренд-тег и шеврон одним слоем — для отложенного появления (напр. в Template после интро). */
export const BrandChrome = ({
  brand = "KOTELNIKOVARTIFACT",
}: {
  brand?: string;
}) => (
  <>
    <Chevron />
    <BrandTag label={brand} />
  </>
);

/** Продукт-фото под космической тонировкой (необязательно). */
const FootageLayer = ({ src }: { src: string }) => (
  <AbsoluteFill>
    <Img
      src={staticFile(src)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: 0.5,
        scale: 1.496,
        translate: "-9.3px -446.6px",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(15,16,20,0.42) 0%, rgba(15,16,20,0.30) 40%, rgba(15,16,20,0.86) 100%)",
      }}
    />
  </AbsoluteFill>
);

/** Постоянная космическая сцена-фон на весь ролик (фон не моргает между бит-сценами). */
export const Stage = ({
  brand = "KOTELNIKOVARTIFACT",
  footage,
  showChevron = true,
  children,
}: {
  brand?: string | null;
  footage?: string;
  showChevron?: boolean;
  children: ReactNode;
}) => (
  <AbsoluteFill style={{ fontFamily: inter, background: BG }}>
    {footage ? <FootageLayer src={footage} /> : null}
    <ConstellationBg />
    <GrainOverlay />
    {showChevron ? <Chevron /> : null}
    {brand ? <BrandTag label={brand} /> : null}
    {children}
  </AbsoluteFill>
);

/** Центрированная контент-область сцены (вход/выход между сценами делают переходы). */
export const Centered = ({
  align = "center",
  children,
}: {
  align?: "center" | "start";
  children: ReactNode;
}) => (
  <AbsoluteFill
    style={{
      padding: PAD,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: align === "center" ? "center" : "flex-start",
      textAlign: align === "center" ? "center" : "left",
      gap: 36,
    }}
  >
    {children}
  </AbsoluteFill>
);

// ---------- Typewriter (string slicing + мигающий курсор) ----------

const Cursor = ({ frame }: { frame: number }) => {
  const opacity = interpolate(frame % 16, [0, 8, 16], [1, 0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <span style={{ opacity }}>▌</span>;
};

export const Typewriter = ({
  text,
  startAt = 0,
  charFrames = 2,
  style,
}: {
  text: string;
  startAt?: number;
  charFrames?: number;
  style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const n = Math.max(
    0,
    Math.min(text.length, Math.floor((frame - startAt) / charFrames)),
  );
  return (
    <span style={style}>
      {text.slice(0, n)}
      <Cursor frame={frame} />
    </span>
  );
};

const BigTitle = ({
  children,
  size = 104,
}: {
  children: ReactNode;
  size?: number;
}) => (
  <div
    style={{
      fontSize: size,
      fontWeight: 800,
      lineHeight: 0.98,
      letterSpacing: "-0.02em",
      textTransform: "uppercase",
      color: colors.title,
      whiteSpace: "pre-line",
    }}
  >
    {children}
  </div>
);
export { BigTitle };

// ---------- Inline content primitives ----------

type AppearFrom = "up" | "down" | "left" | "right" | "scale";
export const Appear = ({
  delay,
  from = "up",
  style,
  children,
}: {
  delay: number;
  from?: AppearFrom;
  style?: CSSProperties;
  children: ReactNode;
}) => {
  const s = useSpringIn(delay);
  const opacity = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const d = (a: number, b: number) =>
    interpolate(s, [0, 1], [a, b], { extrapolateRight: "clamp" });
  let transform = "";
  if (from === "up") transform = `translateY(${d(26, 0)}px)`;
  else if (from === "down") transform = `translateY(${d(-26, 0)}px)`;
  else if (from === "left") transform = `translateX(${d(-40, 0)}px)`;
  else if (from === "right") transform = `translateX(${d(40, 0)}px)`;
  else if (from === "scale") transform = `scale(${d(0.82, 1)})`;
  return <div style={{ opacity, transform, ...style }}>{children}</div>;
};

export const Kicker = ({ children }: { children: ReactNode }) => {
  const a = useAccent();
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: a.accent,
      }}
    >
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 999,
          background: a.accent,
          boxShadow: `0 0 16px ${a.glow}`,
        }}
      />
      {children}
    </div>
  );
};

/** Маркерная подсветка слова: акцентный градиент «прочерчивается» (spring scaleX). */
export const HighlightWord = ({
  children,
  delay,
}: {
  children: ReactNode;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = useAccent();
  const p = spring({
    fps,
    frame,
    delay,
    durationInFrames: 16,
    config: { damping: 200 },
  });
  const scaleX = Math.max(0, Math.min(1, p));
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        style={{
          position: "absolute",
          left: "-0.06em",
          right: "-0.06em",
          top: "50%",
          height: "1.06em",
          transform: `translateY(-50%) scaleX(${scaleX})`,
          transformOrigin: "left center",
          background: a.gradient,
          borderRadius: "0.16em",
          zIndex: 0,
        }}
      />
      <span
        style={{
          position: "relative",
          zIndex: 1,
          color: scaleX > 0.5 ? a.accentTitle : colors.title,
        }}
      >
        {children}
      </span>
    </span>
  );
};

/** Кремовая карточка с зерном (для текстовых блоков). */
export const Card = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <div
    style={{
      position: "relative",
      overflow: "hidden",
      borderRadius: 30,
      background: colors.cardLight,
      boxShadow: "0 28px 64px rgba(0, 0, 0, 0.4)",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: GRAIN,
        backgroundSize: "140px 140px",
        opacity: 0.07,
        mixBlendMode: "multiply",
        pointerEvents: "none",
      }}
    />
    <div style={{ position: "relative" }}>{children}</div>
  </div>
);

/** Разбор текста с маркерами `*...*` → акцентный цвет (для карточек/субтитров). */
export const renderHighlighted = (
  text: string,
  accentColor: string,
): ReactNode[] => {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    const hl = part.startsWith("*") && part.endsWith("*");
    const clean = hl ? part.slice(1, -1) : part;
    if (!hl) return <span key={i}>{clean}</span>;
    return (
      <span key={i} style={{ color: accentColor, fontWeight: 800 }}>
        {clean}
      </span>
    );
  });
};

/** Токенизация заголовка: слова + флаг подсветки. Многословные `*...*` и хвостовая
 *  пунктуация обрабатываются корректно (без «торчащих» звёздочек). */
export const tokenizeTitle = (
  text: string,
): Array<{ w: string; hl: boolean }> => {
  const raw: Array<{ w: string; hl: boolean }> = [];
  text
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .forEach((part) => {
      const hl = part.startsWith("*") && part.endsWith("*");
      const clean = hl ? part.slice(1, -1) : part;
      clean
        .split(/\s+/)
        .filter((w) => w !== "")
        .forEach((w) => raw.push({ w, hl }));
    });
  // Пунктуацию-«одиночку» приклеиваем к предыдущему слову.
  const tokens: Array<{ w: string; hl: boolean }> = [];
  raw.forEach((t) => {
    if (/^[?!.,:;…»)»]+$/.test(t.w) && tokens.length > 0) {
      tokens[tokens.length - 1].w += t.w;
    } else {
      tokens.push({ w: t.w, hl: t.hl });
    }
  });
  return tokens;
};
