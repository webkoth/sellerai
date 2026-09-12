import { Img, staticFile } from "remotion";
import { sans, serif } from "./fashionFont";

/**
 * Fashion-editorial набор баннеров витрины KIT: светлая слоновая кость,
 * крупный сериф Playfair Display, hairline-линии, разрядка капсом, золото как
 * единственный акцент. Фото — реальные макро-снимки образцов из карточек магазина.
 *
 * Отличие от космического набора (`KitBanner`): фото не вырезка на тёмном фоне,
 * а кадрированный снимок в светлой рамке — подача ювелирного каталога.
 */

export type FashionLayout = "wide" | "portrait" | "strip" | "square";

export type KitFashionBannerProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  cta?: string;
  photo: string;
  /** Смещение кадра внутри рамки: "50% 50%" по умолчанию. */
  focus?: string;
  layout: FashionLayout;
  /** Фото слева (по умолчанию) или справа — для разнообразия слайдов. */
  photoSide?: "left" | "right";
};

const IVORY = "#F3F0EA";
const INK = "#191817";
const GOLD = "#A98C4F";
const MUTED = "rgba(25, 24, 23, 0.58)";

const S: Record<FashionLayout, { pad: number; title: number; kicker: number; sub: number; rule: number }> = {
  wide: { pad: 128, title: 118, kicker: 22, sub: 32, rule: 96 },
  portrait: { pad: 84, title: 88, kicker: 20, sub: 28, rule: 72 },
  strip: { pad: 56, title: 46, kicker: 16, sub: 22, rule: 56 },
  square: { pad: 72, title: 72, kicker: 18, sub: 24, rule: 64 },
};

const Kicker = ({ text, size }: { text: string; size: number }) => (
  <div
    style={{
      fontFamily: sans,
      fontSize: size,
      letterSpacing: "0.42em",
      textTransform: "uppercase",
      color: GOLD,
      fontWeight: 500,
    }}
  >
    {text}
  </div>
);

const Rule = ({ w }: { w: number }) => (
  <div style={{ width: w, height: 1, background: GOLD, opacity: 0.75, margin: `${w * 0.28}px 0` }} />
);

export const KitFashionBanner = ({
  kicker,
  title,
  subtitle,
  cta,
  photo,
  focus = "50% 50%",
  layout,
  photoSide = "left",
}: KitFashionBannerProps) => {
  const s = S[layout];
  const vertical = layout === "portrait" || layout === "square";
  const photoShare = layout === "wide" ? "46%" : layout === "strip" ? "22%" : "58%";

  const Photo = (
    <div
      style={{
        position: "relative",
        width: vertical ? "100%" : photoShare,
        height: vertical ? photoShare : "100%",
        flexShrink: 0,
        overflow: "hidden",
        background: "#EAE6DF",
      }}
    >
      <Img
        src={staticFile(photo)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus }}
      />
      {/* Тонкая внутренняя рамка — приём каталога. */}
      <div
        style={{
          position: "absolute",
          inset: s.pad * 0.18,
          border: "1px solid rgba(255,255,255,0.5)",
          pointerEvents: "none",
        }}
      />
    </div>
  );

  const Text = (
    <div
      style={{
        flex: 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: s.pad,
        paddingBottom: vertical ? s.pad * 1.9 : s.pad,
        background: IVORY,
      }}
    >
      {kicker ? <Kicker text={kicker} size={s.kicker} /> : null}
      {kicker ? <Rule w={s.rule} /> : null}
      <div
        style={{
          fontFamily: serif,
          fontSize: s.title,
          lineHeight: 1.08,
          fontWeight: 400,
          color: INK,
          letterSpacing: "-0.01em",
          whiteSpace: "pre-line",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: s.pad * 0.34,
            fontFamily: sans,
            fontSize: s.sub,
            lineHeight: 1.45,
            color: MUTED,
            maxWidth: "92%",
          }}
        >
          {subtitle}
        </div>
      ) : null}
      {cta ? (
        <div
          style={{
            marginTop: s.pad * 0.42,
            alignSelf: "flex-start",
            fontFamily: sans,
            fontSize: s.sub * 0.82,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: INK,
            borderBottom: `1px solid ${GOLD}`,
            paddingBottom: s.sub * 0.3,
          }}
        >
          {cta}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: s.pad,
          bottom: s.pad * 0.46,
          fontFamily: sans,
          fontSize: s.kicker * 0.78,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          color: "rgba(25,24,23,0.32)",
        }}
      >
        KOTELNIKOVARTIFACT
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: vertical ? "column" : photoSide === "left" ? "row" : "row-reverse",
        background: IVORY,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {Photo}
      {Text}
    </div>
  );
};
