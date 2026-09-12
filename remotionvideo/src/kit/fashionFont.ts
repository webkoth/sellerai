/** Шрифты fashion-набора: Playfair Display (заголовки) + Inter (подписи, разрядка). */
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const serif = loadPlayfair("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin", "cyrillic"],
}).fontFamily;

export const sans = loadInter("normal", {
  weights: ["400", "500"],
  subsets: ["latin", "cyrillic"],
}).fontFamily;
