import { Stage } from "./kit";
import { ThemeProvider, useAccent } from "./ThemeContext";
import { LogoRevealCore, type MiniDef } from "./LogoReveal";

/**
 * Космическая копия логотипа: тёмный constellation-фон (как в Reel-5-Types-Cyan),
 * светлый логотип (читается на тёмном), удлинённые хвосты метеоров с cyan-свечением,
 * больше фоновых пролётов, более «грандиозный» (медленный) темп сборки.
 */

const LIGHT = "#EAF1F5"; // мягкий светлый — логотип на тёмном фоне

// Плотный непрерывный метеорный дождь (16 пролётов), растянут по всему таймлайну.
const MINIS: MiniDef[] = [
  { x: 60, y: 240, delay: 2, len: 200, thick: 4, travel: 340 },
  { x: 840, y: 180, delay: 6, len: 140, thick: 3, travel: 260 },
  { x: 360, y: 120, delay: 10, len: 230, thick: 5, travel: 380 },
  { x: 640, y: 480, delay: 15, len: 120, thick: 3, travel: 230 },
  { x: 160, y: 600, delay: 20, len: 170, thick: 4, travel: 300 },
  { x: 900, y: 520, delay: 26, len: 110, thick: 3, travel: 210 },
  { x: 280, y: 80, delay: 32, len: 190, thick: 4, travel: 330 },
  { x: 720, y: 120, delay: 38, len: 150, thick: 3, travel: 270 },
  { x: 40, y: 420, delay: 46, len: 160, thick: 4, travel: 300 },
  { x: 520, y: 60, delay: 54, len: 210, thick: 5, travel: 360 },
  { x: 820, y: 360, delay: 62, len: 120, thick: 3, travel: 230 },
  { x: 200, y: 780, delay: 70, len: 140, thick: 3, travel: 260 },
  { x: 600, y: 640, delay: 80, len: 170, thick: 4, travel: 300 },
  { x: 920, y: 700, delay: 88, len: 110, thick: 3, travel: 210 },
  { x: 120, y: 160, delay: 94, len: 180, thick: 4, travel: 320 },
  { x: 700, y: 760, delay: 100, len: 130, thick: 3, travel: 250 },
];

const CosmicInner = () => {
  const a = useAccent(); // cyan
  return (
    <Stage brand={null} showChevron={false}>
      <LogoRevealCore
        color={LIGHT}
        meteorColor={LIGHT}
        glow={a.glow}
        trailCopies={14}
        trailLen={120}
        dist={480}
        stagger={3}
        pace={1.25}
        blur={1.5}
        minis={MINIS}
      />
    </Stage>
  );
};

/** Логотип на космическом фоне (cyan-тема). */
export const LogoRevealCosmic = () => (
  <ThemeProvider name="cyan">
    <CosmicInner />
  </ThemeProvider>
);
