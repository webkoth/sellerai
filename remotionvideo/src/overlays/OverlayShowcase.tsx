import { ReelOverlays, reelDurationInFrames } from "./ReelOverlays";
import type { ThemeName } from "./theme";
import type { OverlayItem } from "./types";

/** Витрина ролей: по одной сцене каждого приёма + переходы (+ оба варианта Statement). */
const DEMO: OverlayItem[] = [
  { role: "TITLE", text: "Фрагмент *космоса*", kicker: "KOTELNIKOVARTIFACT", durationSec: 3.6 },
  { role: "FACT", text: "4,5 млрд лет", caption: "древнейшее вещество Солнечной системы", durationSec: 3.6, transition: "slide" },
  { role: "STATEMENT", text: "Не чудо. *Напоминание*.", durationSec: 3.0, transition: "wipe", variant: "center" },
  { role: "STATEMENT", text: "Металл, что *не из земли* — а с неба", durationSec: 3.4, transition: "slide", variant: "quote" },
  { role: "TYPE", text: "Спецификация стиля: kicker, цифра, печать", kicker: "Typewriter", durationSec: 4.2, transition: "slide" },
  { role: "CTA", text: "Выбери\nсвой артефакт", durationSec: 3.8 },
];

export type OverlayShowcaseProps = { theme?: ThemeName };

/** Длительность витрины ролей (кадры). */
export const showcaseDurationInFrames = (fps: number) => reelDurationInFrames(DEMO, fps);

export const OverlayShowcase = ({ theme = "ember" }: OverlayShowcaseProps) => (
  <ReelOverlays items={DEMO} theme={theme} />
);
