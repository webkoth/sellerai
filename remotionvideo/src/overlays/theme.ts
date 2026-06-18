/**
 * Стиль оверлеев «Метеориты KOTELNIKOVARTIFACT».
 * Дизайн-система из эталона content-factory (karpov-style):
 * тёмный constellation-фон + Inter КАПС + акцент + кремовые карточки + переходы.
 *
 * Акцент вынесен в ТЕМЫ (ember / cyan) — задаётся через ThemeProvider, чтобы
 * один и тот же ролик можно было собрать в разных цветовых схемах.
 */

export const FPS = 30;

export const VIDEO = {
  width: 1080,
  height: 1920,
} as const;

/** Внутренний отступ сцены. */
export const PAD = 84;

/** Постоянные (не зависят от темы) цвета. */
export const colors = {
  title: "#ffffff",
  textMuted: "rgba(255, 255, 255, 0.62)",
  textFaint: "rgba(255, 255, 255, 0.4)",
  brand: "rgba(255, 255, 255, 0.9)",
  chevron: "rgba(255, 255, 255, 0.4)",
  hairline: "rgba(255, 255, 255, 0.12)",
  /** Кремовая карточка для текстовых блоков. */
  cardLight: "#F2F0EB",
  cardLightTitle: "#1B1C22",
  cardLightText: "rgba(27, 28, 34, 0.86)",
  cardLightMuted: "rgba(27, 28, 34, 0.5)",
} as const;

/** Тёмный космический фон-сцена. */
export const BG =
  "radial-gradient(125% 120% at 72% 14%, #1C1E25 0%, #131419 58%, #0F1014 100%)";

/** Плёночное зерно (data-URI feTurbulence). */
export const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

// ==================== ТЕМЫ (акцент) ====================

export type ThemeName = "ember" | "cyan";

export type Accent = {
  /** Базовый акцентный цвет. */
  accent: string;
  /** Светлый оттенок акцента. */
  accentSoft: string;
  /** Цвет текста под маркерной подсветкой (читается поверх акцента). */
  accentTitle: string;
  /** Свечение (тени/glow). */
  glow: string;
  glowSoft: string;
  /** Градиент для цифр и маркерной подсветки. */
  gradient: string;
};

export const ACCENTS: Record<ThemeName, Accent> = {
  /** Тёпло-оранжевый — «огонь входа в атмосферу» (как в эталоне). */
  ember: {
    accent: "#FB4A29",
    accentSoft: "#FF8A5B",
    accentTitle: "#1A1410",
    glow: "rgba(251, 74, 41, 0.7)",
    glowSoft: "rgba(251, 74, 41, 0.34)",
    gradient: "linear-gradient(135deg, #FF8A5B 0%, #FB4A29 55%, #FF5E3A 100%)",
  },
  /** Космический cyan. */
  cyan: {
    accent: "#22D3EE",
    accentSoft: "#67E8F9",
    accentTitle: "#06222B",
    glow: "rgba(34, 211, 238, 0.7)",
    glowSoft: "rgba(34, 211, 238, 0.34)",
    gradient: "linear-gradient(135deg, #67E8F9 0%, #22D3EE 52%, #06B6D4 100%)",
  },
};
