import { ReelOverlays, reelDurationInFrames } from "./ReelOverlays";
import type { OverlayItem } from "./types";

/**
 * Продуктовый ролик на базе Reel-4-Product-Cyan, обрезанный до сути:
 * заголовок «Дронино» → природный рельеф → единственный экземпляр.
 * Контент опущен ниже центра, чтобы не перекрывать продукт на футаже.
 */
const ITEMS: OverlayItem[] = [
  { role: "TITLE", text: "Метеорит *Дронино*", kicker: "Обзор", durationSec: 3.6 },
  { role: "STATEMENT", text: "Природный рельеф — *не подделать*", durationSec: 3.4, transition: "slide" },
  { role: "STATEMENT", text: "Существует в *одном* экземпляре", durationSec: 3.4, transition: "wipe" },
];

/** Длительность ролика (кадры). */
export const droninoReelDuration = (fps: number) => reelDurationInFrames(ITEMS, fps);

export type DroninoReelProps = { contentShiftY?: number };

/** Дронино — продуктовый ролик (cyan, футаж дронино, контент опущен ниже). */
export const DroninoReel = ({ contentShiftY = 160 }: DroninoReelProps) => (
  <ReelOverlays items={ITEMS} theme="cyan" footage="footage/dronino.png" contentShiftY={contentShiftY} />
);
