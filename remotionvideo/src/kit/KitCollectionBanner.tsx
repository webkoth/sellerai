import { Img, staticFile, useVideoConfig } from "remotion";
import { editorialFont, posterFont, promoFont } from "./collectionFonts";

/**
 * Коллекция баннеров по референсам из `new_collection/`.
 *
 * Три модели, у каждой своя типографика и своя работа:
 * - `promo`     — светлая сцена, заголовок + выгода + оффер + кнопка (Bridal Jewelry, Telegram-промо);
 * - `editorial` — имиджевый кадр, абзац с выделениями и метки по углам (VOSHKA, ч/б профиль);
 * - `poster`    — тёмный постер, только имя вещи и материал (GRAFT, CAD Maker).
 *
 * Текст всегда ложится на готовый кадр: сцены сняты вокруг реальных изделий,
 * отдельный слой с вырезкой не нужен.
 */

export type CollectionVariant = "promo" | "editorial" | "poster";

export type KitCollectionBannerProps = {
  variant: CollectionVariant;
  scene: string;
  /** Сторона, свободная от предмета: туда уходит текст. */
  side?: "left" | "right";
  kicker?: string;
  title: string;
  /** Промо: строка выгоды. Имидж: абзац, слова в *звёздочках* — полужирные. */
  body?: string;
  offer?: string;
  cta?: string;
  /** Постер: строка материала под именем вещи. */
  spec?: string;
  price?: string;
  /** Тёмная сцена (по умолчанию) или светлая — меняет цвет текста. */
  light?: boolean;
  /** object-position кадра: спасает вертикальную сцену в широком формате. */
  focus?: string;
};

const INK = "#14161B";
const IVORY = "#F7F5F1";
const GOLD = "#B08D57";
const CYAN = "#4FA5B2";

const renderBold = (text: string, key: string) =>
  text.split(/(\*[^*]+\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") ? (
      <b key={`${key}-${i}`} style={{ fontWeight: 600 }}>{part.slice(1, -1)}</b>
    ) : (
      <span key={`${key}-${i}`}>{part}</span>
    ),
  );

export const KitCollectionBanner = ({
  variant, scene, side = "left", kicker, title, body, offer, cta, spec, price, light = false, focus = "50% 50%",
}: KitCollectionBannerProps) => {
  const { width, height } = useVideoConfig();
  // всё в em: базовый кегль считаем от меньшей стороны, поэтому одна вёрстка работает
  // и в баннере 2400×1200, и в вертикальном посте 1200×1500
  const base = Math.min(width, height) * 0.017;
  const text = light ? INK : IVORY;
  const muted = light ? "rgba(20,22,27,0.66)" : "rgba(247,245,241,0.72)";
  const rule = light ? "rgba(20,22,27,0.24)" : "rgba(247,245,241,0.3)";

  const Scene = (
    <>
      <Img src={staticFile(scene)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: focus }} />
      {variant === "promo" ? (
        <div style={{ position: "absolute", inset: 0, background: light
          ? `linear-gradient(${side === "left" ? "90deg" : "270deg"}, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.58) 34%, rgba(255,255,255,0) 60%)`
          : `linear-gradient(${side === "left" ? "90deg" : "270deg"}, rgba(10,13,18,0.88) 0%, rgba(10,13,18,0.5) 34%, rgba(10,13,18,0) 60%)` }} />
      ) : variant === "editorial" ? (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,10,14,0.58) 0%, rgba(8,10,14,0.06) 24%, rgba(8,10,14,0.34) 48%, rgba(5,7,11,0.90) 72%, rgba(4,6,9,0.97) 100%)" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,8,12,0.70) 0%, rgba(6,8,12,0.12) 40%, rgba(6,8,12,0.80) 100%)" }} />
      )}
    </>
  );

  if (variant === "promo") {
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: light ? IVORY : "#0A0D12", fontSize: base }}>
        {Scene}
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: side === "left" ? "flex-start" : "flex-end", padding: "0 7%",
        }}>
          <div style={{ maxWidth: "44%", display: "flex", flexDirection: "column", gap: "2.4%" }}>
            {kicker ? (
              <div style={{ fontFamily: promoFont, fontSize: "1.45em", letterSpacing: "0.3em", textTransform: "uppercase", color: light ? GOLD : CYAN, fontWeight: 500 }}>
                {kicker}
              </div>
            ) : null}
            <div style={{ fontFamily: promoFont, fontSize: "4.2em", lineHeight: 1.08, fontWeight: 700, color: text, letterSpacing: "-0.01em", whiteSpace: "pre-line" }}>
              {title}
            </div>
            {body ? (
              <div style={{ fontFamily: promoFont, fontSize: "1.75em", lineHeight: 1.45, fontWeight: 300, color: muted }}>{body}</div>
            ) : null}
            {offer ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.8em", marginTop: "0.6%" }}>
                <div style={{ width: "2.6em", height: 1, background: light ? GOLD : CYAN }} />
                <div style={{ fontFamily: promoFont, fontSize: "1.5em", fontWeight: 600, color: light ? GOLD : CYAN, letterSpacing: "0.02em" }}>{offer}</div>
              </div>
            ) : null}
            {cta ? (
              <div style={{
                alignSelf: "flex-start", marginTop: "1.6%", padding: "0.85em 2.1em",
                background: light ? INK : IVORY, color: light ? IVORY : INK,
                fontFamily: promoFont, fontSize: "1.45em", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
              }}>{cta}</div>
            ) : null}
            {price ? (
              <div style={{ fontFamily: promoFont, fontSize: "1.35em", color: muted, marginTop: "0.6%" }}>{price}</div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "editorial") {
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#0A0D12", fontSize: base }}>
        {Scene}
        {/* Метки по углам — приём VOSHKA */}
        <div style={{ position: "absolute", top: "5%", left: "6%", fontFamily: promoFont, fontSize: "1.25em", letterSpacing: "0.2em", textTransform: "uppercase", color: IVORY, opacity: 0.92, lineHeight: 1.4 }}>
          KOTELNIKOVARTIFACT
        </div>
        {kicker ? (
          <div style={{ position: "absolute", top: "5%", right: "6%", textAlign: "right", fontFamily: promoFont, fontSize: "1.25em", letterSpacing: "0.2em", textTransform: "uppercase", color: IVORY, opacity: 0.92, lineHeight: 1.4 }}>
            {kicker}
          </div>
        ) : null}
        <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "9%", display: "flex", flexDirection: "column", gap: "1.6%" }}>
          <div style={{ fontFamily: editorialFont, fontSize: "3.9em", lineHeight: 1.14, color: IVORY, letterSpacing: "0.01em" }}>
            {title}
          </div>
          {body ? (
            <div style={{ fontFamily: promoFont, fontSize: "1.62em", lineHeight: 1.62, fontWeight: 300, color: "rgba(247,245,241,0.84)", maxWidth: "78%", textAlign: "justify" }}>
              {renderBold(body, "ed")}
            </div>
          ) : null}
          {spec || price ? (
            <div style={{ display: "flex", gap: "1.6em", alignItems: "center", marginTop: "0.6%" }}>
              <div style={{ width: "3.4em", height: 1, background: rule }} />
              <div style={{ fontFamily: promoFont, fontSize: "1.3em", letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD }}>{spec}</div>
              {price ? <div style={{ fontFamily: promoFont, fontSize: "1.3em", color: "rgba(247,245,241,0.6)" }}>{price}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // poster
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#06080C", fontSize: base }}>
      {Scene}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "6% 7%" }}>
        <div style={{ fontFamily: posterFont, fontSize: "3.6em", fontWeight: 300, letterSpacing: "0.42em", textTransform: "uppercase", color: IVORY, textAlign: "center", lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2%" }}>
          {spec ? (
            <div style={{ fontFamily: posterFont, fontSize: "1.5em", fontWeight: 400, letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD, textAlign: "center" }}>
              {spec}
            </div>
          ) : null}
          <div style={{ width: "5em", height: 1, background: rule, margin: "0.6em 0" }} />
          <div style={{ fontFamily: posterFont, fontSize: "1.3em", fontWeight: 300, letterSpacing: "0.34em", textTransform: "uppercase", color: "rgba(247,245,241,0.66)" }}>
            KOTELNIKOVARTIFACT
          </div>
        </div>
      </div>
    </div>
  );
};
