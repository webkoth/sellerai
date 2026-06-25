import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LOGO_PATHS, LOGO_VIEWBOX } from "./logoPaths";

/**
 * Анимированный логотип KOTELNIKOVARTIFACT (ядро + обёртки).
 *
 * Состав logo_anime.svg (18 контуров):
 *   [0] надпись · [1] тег-лайн · [2] линия · [3..9] штрихи-метеоры · [10..16] дубль · [17] клякса-заливка
 *
 * Анимация: штрихи-метеоры влетают по очереди (метеорный дождь) → надпись пишется
 * слева-направо (буквы по очереди) → линия из центра → тег-лайн → мягкий settle.
 */

const LOGO_W = 980;
const LOGO_H = Math.round((LOGO_W * 333) / 789);

const WORDMARK = [LOGO_PATHS[0]];
const TAGLINE = [LOGO_PATHS[1]];
const LINE = [LOGO_PATHS[2]];
const COMET_STREAKS = LOGO_PATHS.slice(3, 10); // только чистые штрихи

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const START = { x: -320, y: -440 };
const LEN = Math.hypot(START.x, START.y);
const DIR = { x: START.x / LEN, y: START.y / LEN };

export type MiniDef = { x: number; y: number; delay: number; len: number; thick: number; travel: number };

export type LogoRevealOptions = {
  /** Цвет надписи/линии/тег-лайна. */
  color: string;
  /** Цвет метеоров. */
  meteorColor: string;
  /** Свечение метеоров (drop-shadow), напр. cyan на тёмном фоне. */
  glow?: string;
  /** Сколько копий в хвосте метеора (1 = только голова). */
  trailCopies: number;
  /** Шаг хвоста, px (длина следа). */
  trailLen: number;
  /** Дистанция влёта, px. */
  dist: number;
  /** Лаг между штрихами, эффективные кадры. */
  stagger: number;
  /** Темп: >1 медленнее, <1 быстрее (под хронометраж). */
  pace: number;
  /** Лёгкий блюр всего лок-апа для смягчения, px (0 = чётко). */
  blur?: number;
  /** Фоновые пролёты-метеоры. */
  minis: MiniDef[];
};

const PartSvg = ({
  paths,
  color,
  maskImage,
  glow,
}: {
  paths: string[];
  color: string;
  maskImage?: string;
  glow?: string;
}) => (
  <svg
    width={LOGO_W}
    height={LOGO_H}
    viewBox={LOGO_VIEWBOX}
    style={{
      position: "absolute",
      inset: 0,
      overflow: "visible",
      maskImage,
      WebkitMaskImage: maskImage,
      filter: glow ? `drop-shadow(0 0 10px ${glow})` : undefined,
    }}
  >
    {paths.map((d, i) => (
      <path key={i} d={d} fill={color} />
    ))}
  </svg>
);

const writeOnMask = (progress: number, feather = 5) => {
  const edge = -feather + progress * (100 + feather * 2);
  return `linear-gradient(95deg, #000 ${edge}%, transparent ${edge + feather}%)`;
};

const centerOutMask = (progress: number) => {
  const w = progress * 60;
  return `linear-gradient(90deg, transparent ${50 - w}%, #000 ${50 - w + 4}%, #000 ${50 + w - 4}%, transparent ${50 + w}%)`;
};

/** Один штрих-метеор: влетает со своим лагом + хвост из копий, тормозит на месте. */
const Streak = ({
  d,
  index,
  f,
  fps,
  o,
}: {
  d: string;
  index: number;
  f: number;
  fps: number;
  o: LogoRevealOptions;
}) => {
  const s = spring({ frame: f - index * o.stagger, fps, config: { damping: 30, stiffness: 90, mass: 0.7 } });
  const p = Math.min(1.2, Math.max(0, s));
  const speed = Math.max(0, 1 - p);
  const appear = interpolate(p, [0, 0.16], [0, 1], clamp);
  const baseX = DIR.x * o.dist * (1 - p);
  const baseY = DIR.y * o.dist * (1 - p);
  const n = Math.max(1, o.trailCopies);
  // Плавный motion-blur хвост: слои с нарастающим размытием и затуханием.
  // Голова (k=0) резкая и со свечением; к концу хвост мягко растворяется.
  return (
    <>
      {Array.from({ length: n }, (_, j) => {
        const k = n - 1 - j; // рисуем от хвоста к голове, чтобы голова была сверху
        const frac = n > 1 ? k / (n - 1) : 0; // 0 — голова, 1 — конец хвоста
        const off = frac * o.trailLen * speed;
        const x = baseX + DIR.x * off;
        const y = baseY + DIR.y * off;
        const op = (1 - frac * 0.92) * appear;
        const blur = frac * 7;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${x}px, ${y}px)`,
              opacity: op,
              filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
            }}
          >
            <PartSvg paths={[d]} color={o.meteorColor} glow={k === 0 ? o.glow : undefined} />
          </div>
        );
      })}
    </>
  );
};

const MiniMeteor = ({ def, f, color, glow }: { def: MiniDef; f: number; color: string; glow?: string }) => {
  const t = interpolate(f, [def.delay, def.delay + 26], [0, 1], { ...clamp, easing: EASE_OUT });
  const tx = def.travel * 0.62 * t;
  const ty = def.travel * t;
  const op = interpolate(t, [0, 0.18, 0.7, 1], [0, 0.55, 0.55, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: def.x,
        top: def.y,
        transform: `translate(${tx}px, ${ty}px) rotate(58deg)`,
        opacity: op,
      }}
    >
      <div
        style={{
          width: def.len,
          height: def.thick,
          borderRadius: def.thick,
          background: `linear-gradient(90deg, ${color}00 0%, ${color} 100%)`,
          boxShadow: glow ? `0 0 8px ${glow}` : undefined,
        }}
      />
    </div>
  );
};

/** Ядро: метеоры + проявление лок-апа. Без собственного фона (фон даёт обёртка). */
export const LogoRevealCore = (o: LogoRevealOptions) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame / o.pace; // эффективный кадр для темпа

  const wordProgress = interpolate(f, [18, 60], [0, 1], clamp);
  const lineProgress = interpolate(f, [58, 72], [0, 1], { ...clamp, easing: EASE_OUT });
  // Тег-лайн — fade снизу (прозрачность + подъём).
  const tagProgress = interpolate(f, [66, 86], [0, 1], { ...clamp, easing: EASE_OUT });
  const tagY = (1 - tagProgress) * 32;

  const settle = spring({ frame: f, fps, config: { damping: 200, stiffness: 80, mass: 0.9 } });
  const scale = interpolate(settle, [0, 1], [0.975, 1], clamp);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {o.minis.map((m, i) => (
        <MiniMeteor key={i} def={m} f={f} color={o.meteorColor} glow={o.glow} />
      ))}
      <div
        style={{
          position: "relative",
          width: LOGO_W,
          height: LOGO_H,
          overflow: "visible",
          transform: `scale(${scale})`,
          filter: o.blur ? `blur(${o.blur}px)` : undefined,
        }}
      >
        {COMET_STREAKS.map((d, i) => (
          <Streak key={i} d={d} index={i} f={f} fps={fps} o={o} />
        ))}
        <PartSvg paths={WORDMARK} color={o.color} maskImage={writeOnMask(wordProgress, 4)} />
        <PartSvg paths={LINE} color={o.color} maskImage={centerOutMask(lineProgress)} />
        <div style={{ position: "absolute", inset: 0, opacity: tagProgress, transform: `translateY(${tagY}px)` }}>
          <PartSvg paths={TAGLINE} color={o.color} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const NAVY = "#3D4757";

/** Базовый вариант: оригинальный navy на ПРОЗРАЧНОМ фоне. */
export const LogoReveal = () => (
  <AbsoluteFill style={{ background: "transparent" }}>
    <LogoRevealCore
      color={NAVY}
      meteorColor={NAVY}
      trailCopies={10}
      trailLen={90}
      dist={360}
      stagger={2.5}
      pace={1}
      blur={0.7}
      minis={[
        { x: 140, y: 360, delay: 2, len: 150, thick: 4, travel: 260 },
        { x: 780, y: 300, delay: 9, len: 110, thick: 3, travel: 220 },
        { x: 420, y: 250, delay: 16, len: 190, thick: 5, travel: 300 },
        { x: 620, y: 520, delay: 24, len: 90, thick: 3, travel: 180 },
      ]}
    />
  </AbsoluteFill>
);
