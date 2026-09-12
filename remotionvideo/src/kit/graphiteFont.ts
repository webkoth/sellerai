/** Шрифты набора «графит-космос»: Unbounded (дисплейные заголовки) + Onest (подписи). */
import { loadFont as loadUnbounded } from "@remotion/google-fonts/Unbounded";
import { loadFont as loadOnest } from "@remotion/google-fonts/Onest";

export const display = loadUnbounded("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin", "cyrillic"],
}).fontFamily;

export const text = loadOnest("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin", "cyrillic"],
}).fontFamily;
