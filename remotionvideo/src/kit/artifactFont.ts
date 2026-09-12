/** Шрифт набора «Книга небесного железа» — Montserrat, как в макетах Figma. */
import { loadFont } from "@remotion/google-fonts/Montserrat";

export const artifact = loadFont("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
}).fontFamily;
