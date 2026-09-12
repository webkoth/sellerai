import { Img, staticFile } from "remotion";
import { display, text } from "./graphiteFont";
import { tokenizeTitle } from "../overlays/kit";

/**
 * Набор «графит-космос» для витрины KIT.
 *
 * Два приёма в одном компоненте:
 * - `mode: "object"` — вырезанный образец на графитовом фоне, текст на фоне (приём первого набора);
 * - `mode: "photo"` — реальный кадр из карточки во весь баннер, текст прямо на фото
 *   под графитовой вуалью.
 *
 * Типографика — Unbounded (дисплейный) вместо Inter/Playfair, акцент — циан `#22D3EE`
 * плашкой под словами в `*звёздочках*`.
 */

export type GraphiteLayout = "wide" | "portrait" | "strip" | "square";

export type KitGraphiteBannerProps = {
  mode: "object" | "photo";
  kicker?: string;
  title: string;
  subtitle?: string;
  cta?: string;
  photo: string;
  /** Кадрирование для mode="photo". */
  focus?: string;
  layout: GraphiteLayout;
  photoScale?: number;
  /** Подложка: нейтральный графит или синеватый. */
  tone?: GraphiteTone;
};

const CYAN = "#22D3EE";
const CYAN_INK = "#06222B";

/** Тон подложки: нейтральный графит и синеватый графит («холодная сталь»). */
export type GraphiteTone = "graphite" | "blue";

const TONES: Record<GraphiteTone, { bg: string; veil: string; flat: string }> = {
  graphite: {
    bg: "linear-gradient(158deg, #33363D 0%, #23262C 38%, #16181D 72%, #0E1014 100%)",
    veil:
      "linear-gradient(180deg, rgba(14,16,20,0.30) 0%, rgba(14,16,20,0.06) 26%, rgba(12,14,18,0.62) 56%, rgba(9,11,14,0.93) 78%, rgba(8,10,13,0.98) 100%)",
    flat: "#14161A",
  },
  blue: {
    bg: "linear-gradient(158deg, #2B3542 0%, #1D2733 38%, #131C28 72%, #0B121B 100%)",
    veil:
      "linear-gradient(180deg, rgba(11,18,27,0.32) 0%, rgba(11,18,27,0.06) 26%, rgba(10,17,26,0.64) 56%, rgba(8,14,22,0.94) 78%, rgba(7,12,19,0.98) 100%)",
    flat: "#101823",
  },
};

const S: Record<GraphiteLayout, { pad: number; title: number; kicker: number; sub: number }> = {
  wide: { pad: 116, title: 82, kicker: 22, sub: 32 },
  portrait: { pad: 78, title: 66, kicker: 20, sub: 29 },
  strip: { pad: 60, title: 38, kicker: 16, sub: 22 },
  square: { pad: 68, title: 54, kicker: 18, sub: 25 },
};

const Headline = ({ title, size }: { title: string; size: number }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: `${size * 0.14}px ${size * 0.24}px` }}>
    {tokenizeTitle(title).map((t, i) => (
      <span
        key={i}
        style={{
          fontFamily: display,
          fontSize: size,
          lineHeight: 1.14,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: t.hl ? CYAN_INK : "#FFFFFF",
          ...(t.hl
            ? {
                background: CYAN,
                padding: `${size * 0.06}px ${size * 0.16}px`,
                borderRadius: size * 0.14,
                boxShadow: `0 0 ${size * 0.6}px rgba(34,211,238,0.34)`,
              }
            : {}),
        }}
      >
        {t.w}
      </span>
    ))}
  </div>
);

export const KitGraphiteBanner = ({
  mode,
  kicker,
  title,
  subtitle,
  cta,
  photo,
  focus = "50% 50%",
  layout,
  photoScale,
  tone = "graphite",
}: KitGraphiteBannerProps) => {
  const s = S[layout];
  const t = TONES[tone];
  const vertical = layout === "portrait" || layout === "square";
  const objW = photoScale ?? (layout === "wide" ? 0.52 : layout === "strip" ? 0.18 : 0.8);

  const Copy = (
    <div style={{ position: "relative", maxWidth: mode === "photo" ? "100%" : vertical ? "100%" : "56%" }}>
      {kicker ? (
        <div
          style={{
            fontFamily: text,
            fontSize: s.kicker,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: CYAN,
            fontWeight: 500,
            marginBottom: s.pad * 0.3,
          }}
        >
          {kicker}
        </div>
      ) : null}
      <Headline title={title} size={s.title} />
      {subtitle ? (
        <div
          style={{
            marginTop: s.pad * 0.36,
            fontFamily: text,
            fontSize: s.sub,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.66)",
            maxWidth: mode === "photo" ? "80%" : "90%",
          }}
        >
          {subtitle}
        </div>
      ) : null}
      {cta ? (
        <div
          style={{
            display: "inline-block",
            marginTop: s.pad * 0.42,
            padding: `${s.sub * 0.5}px ${s.sub * 1.2}px`,
            borderRadius: 999,
            background: CYAN,
            color: CYAN_INK,
            fontFamily: text,
            fontSize: s.sub * 0.84,
            fontWeight: 600,
            letterSpacing: "0.04em",
            boxShadow: "0 0 40px rgba(34,211,238,0.3)",
          }}
        >
          {cta}
        </div>
      ) : null}
    </div>
  );

  const Brand = (
    <div
      style={{
        position: "absolute",
        left: s.pad,
        bottom: s.pad * 0.5,
        fontFamily: text,
        fontSize: s.kicker * 0.8,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.34)",
      }}
    >
      KOTELNIKOVARTIFACT
    </div>
  );

  if (mode === "photo") {
    // Реальный кадр во весь баннер: текст прямо на фото под графитовой вуалью.
    return (
      <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: t.flat }}>
        <Img
          src={staticFile(photo)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: focus }}
        />
        {/* Вуаль: графит снизу, лёгкий холодный тон сверху. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: t.veil,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: s.pad,
            right: s.pad,
            bottom: s.pad * 1.55,
          }}
        >
          {Copy}
        </div>
        {Brand}
      </div>
    );
  }

  // Вырезанный образец на графитовом фоне.
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: t.bg,
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: vertical ? "flex-start" : "center",
        justifyContent: "space-between",
        padding: s.pad,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: vertical
            ? "radial-gradient(58% 34% at 50% 74%, rgba(34,211,238,0.22) 0%, transparent 70%)"
            : "radial-gradient(42% 72% at 76% 56%, rgba(34,211,238,0.22) 0%, transparent 72%)",
        }}
      />
      {Copy}
      <div
        style={{
          position: vertical ? "absolute" : "relative",
          ...(vertical
            ? { left: 0, right: 0, bottom: -s.pad * 0.15, height: "62%", display: "flex", alignItems: "flex-end", justifyContent: "center" }
            : { height: "108%", display: "flex", alignItems: "center", justifyContent: "flex-end", marginRight: -s.pad * 0.4 }),
          width: vertical ? "100%" : `${objW * 100}%`,
          flexShrink: 0,
        }}
      >
        <Img
          src={staticFile(photo)}
          style={{
            width: vertical ? `${objW * 100}%` : "auto",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 34px 60px rgba(0,0,0,0.7)) drop-shadow(0 0 46px rgba(34,211,238,0.28))",
          }}
        />
      </div>
      {Brand}
    </div>
  );
};
