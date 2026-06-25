import { SubtitleTrack, subtitleTrackDuration, type SubtitleCue } from "./SubtitleTrack";

/**
 * Дронино «в виде субтитров»: те же ключевые фразы, что в Reel-Dronino, но в едином
 * субтитровом стиле — субтитровый размер букв + анимация плашки (slide-up + fade),
 * а акцент на `*слово*` — наша текущая анимация (маркер-«прочерк», `animatedHighlight`).
 */
const CUES: SubtitleCue[] = [
  { text: "Метеорит *Дронино*", fromSec: 0.3, durationSec: 3.0, variant: "glass" },
  { text: "Природный рельеф — *не подделать*", fromSec: 3.5, durationSec: 3.2, variant: "glass" },
  { text: "Существует в *одном* экземпляре", fromSec: 6.9, durationSec: 3.2, variant: "glass" },
];

/** Длительность дорожки (кадры). */
export const droninoSubsDuration = (fps: number) => subtitleTrackDuration(CUES, fps);

export const DroninoSubs = () => (
  <SubtitleTrack cues={CUES} theme="cyan" footage="footage/dronino.png" animatedHighlight />
);
