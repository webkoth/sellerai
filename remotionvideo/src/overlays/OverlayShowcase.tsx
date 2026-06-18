import { ReelOverlays } from "./ReelOverlays";
import type { ThemeName } from "./theme";
import type { OverlayItem } from "./types";

/** Витрина стиля: по одной сцене каждой роли + переходы + финальный логотип. */
const DEMO: OverlayItem[] = [
  { role: "TITLE", text: "Фрагмент *космоса*", kicker: "KOTELNIKOVARTIFACT", durationSec: 3.6 },
  { role: "FACT", text: "4,5 млрд лет", caption: "древнейшее вещество Солнечной системы", durationSec: 3.6, transition: "slide" },
  { role: "KEY", text: "Не чудо. *Напоминание*.", durationSec: 3.2, transition: "wipe" },
  { role: "TYPE", text: "Спецификация стиля: kicker, цифра, карточка, печать", kicker: "Typewriter", durationSec: 4.2, transition: "slide" },
  { role: "CTA", text: "Выбери\nсвой артефакт", durationSec: 3.8 },
];

export type OverlayShowcaseProps = { theme?: ThemeName };

export const OverlayShowcase = ({ theme = "ember" }: OverlayShowcaseProps) => (
  <ReelOverlays items={DEMO} endcard theme={theme} />
);
