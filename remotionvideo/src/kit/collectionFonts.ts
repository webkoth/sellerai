/** Шрифты новой коллекции — подобраны под референсы из new_collection/. */
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPrata } from "@remotion/google-fonts/Prata";
import { loadFont as loadCondensed } from "@remotion/google-fonts/RobotoCondensed";

/** Промо: геометрический гротеск, как в Bridal Jewelry и Telegram-промо. */
export const promoFont = loadMontserrat("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
}).fontFamily;

/** Имиджевые: высококонтрастный сериф вместо Bodoni из GRAFT (у Bodoni нет кириллицы). */
export const editorialFont = loadPrata("normal", {
  weights: ["400"],
  subsets: ["latin", "cyrillic"],
}).fontFamily;

/** Постеры: узкий гротеск капсом, как в VOSHKA. */
export const posterFont = loadCondensed("normal", {
  weights: ["300", "400", "500", "700"],
  subsets: ["latin", "cyrillic"],
}).fontFamily;
