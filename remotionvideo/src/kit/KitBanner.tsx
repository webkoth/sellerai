import { Img, staticFile } from "remotion";
import { ACCENTS, BG, colors, GRAIN, type ThemeName } from "../overlays/theme";
import { tokenizeTitle } from "../overlays/kit";

/**
 * Статичные баннеры витрины Яндекс KIT в фирменном стиле серии «Метеориты»:
 * тёмный космо-фон + Inter КАПС + акцентная подсветка ключевого слова + вырезка товара.
 *
 * Один компонент на все слоты витрины — раскладка задаётся через `layout`,
 * размер кадра — через размеры композиции в Root.tsx.
 *
 * В заголовке слово(а) в `*звёздочках*` получают акцентную маркер-подсветку.
 */

export type KitLayout = "wide" | "portrait" | "strip" | "square";

export type KitBannerProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  cta?: string;
  photo?: string;
  layout: KitLayout;
  theme: ThemeName;
  /** Доля ширины кадра под фото товара. */
  photoScale?: number;
};

const SIZES: Record<KitLayout, { pad: number; title: number; kicker: number; sub: number; textW: string }> = {
  wide: { pad: 110, title: 108, kicker: 26, sub: 40, textW: "56%" },
  portrait: { pad: 76, title: 92, kicker: 24, sub: 36, textW: "100%" },
  strip: { pad: 64, title: 52, kicker: 18, sub: 26, textW: "72%" },
  square: { pad: 64, title: 74, kicker: 20, sub: 28, textW: "100%" },
};

/** Заголовок с маркерной подсветкой слов в *звёздочках*. */
const Headline = ({ title, size, accent }: { title: string; size: number; accent: (typeof ACCENTS)[ThemeName] }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: `${size * 0.06}px ${size * 0.22}px` }}>
    {tokenizeTitle(title).map((t, i) =>
      t.hl ? (
        <span
          key={i}
          style={{
            position: "relative",
            fontSize: size,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: accent.accentTitle,
            padding: `0 ${size * 0.12}px`,
            background: accent.gradient,
            borderRadius: size * 0.1,
            boxShadow: `0 0 ${size * 0.5}px ${accent.glowSoft}`,
          }}
        >
          {t.w}
        </span>
      ) : (
        <span
          key={i}
          style={{
            fontSize: size,
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: colors.title,
          }}
        >
          {t.w}
        </span>
      ),
    )}
  </div>
);

export const KitBanner = ({
  kicker,
  title,
  subtitle,
  cta,
  photo,
  layout,
  theme,
  photoScale,
}: KitBannerProps) => {
  const a = ACCENTS[theme];
  const s = SIZES[layout];
  const vertical = layout === "portrait" || layout === "square";
  const photoW = photoScale ?? (layout === "wide" ? 0.5 : layout === "strip" ? 0.2 : 0.86);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: BG,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: vertical ? "flex-start" : "center",
        justifyContent: vertical ? "flex-start" : "space-between",
        padding: s.pad,
        gap: s.pad * 0.4,
      }}
    >
      {/* Свечение из-под товара — «атмосферный вход». */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: vertical
            ? `radial-gradient(60% 40% at 50% 78%, ${a.glowSoft} 0%, transparent 70%)`
            : `radial-gradient(46% 78% at 78% 58%, ${a.glowSoft} 0%, transparent 72%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "absolute", inset: 0, backgroundImage: GRAIN, opacity: 0.5, pointerEvents: "none" }} />

      {/* Текстовый блок */}
      <div style={{ position: "relative", width: s.textW, maxWidth: vertical ? "100%" : "58%" }}>
        {kicker ? (
          <div
            style={{
              fontSize: s.kicker,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: a.accentSoft,
              marginBottom: s.pad * 0.28,
            }}
          >
            {kicker}
          </div>
        ) : null}
        <Headline title={title} size={s.title} accent={a} />
        {subtitle ? (
          <div
            style={{
              marginTop: s.pad * 0.34,
              fontSize: s.sub,
              lineHeight: 1.35,
              color: colors.textMuted,
              maxWidth: layout === "wide" ? "88%" : "100%",
            }}
          >
            {subtitle}
          </div>
        ) : null}
        {cta ? (
          <div
            style={{
              display: "inline-block",
              marginTop: s.pad * 0.44,
              padding: `${s.sub * 0.52}px ${s.sub * 1.25}px`,
              borderRadius: 999,
              background: a.gradient,
              color: a.accentTitle,
              fontSize: s.sub * 0.86,
              fontWeight: 700,
              letterSpacing: "0.02em",
              boxShadow: `0 0 ${s.sub}px ${a.glowSoft}`,
            }}
          >
            {cta}
          </div>
        ) : null}
      </div>

      {/* Товар */}
      {photo ? (
        <div
          style={{
            position: vertical ? "absolute" : "relative",
            ...(vertical
              ? { left: 0, right: 0, bottom: -s.pad * 0.15, display: "flex", justifyContent: "center", alignItems: "flex-end", height: "68%" }
              : { height: "112%", display: "flex", alignItems: "center", justifyContent: "flex-end", marginRight: -s.pad * 0.45 }),
            width: vertical ? "100%" : `${photoW * 100}%`,
            flexShrink: 0,
          }}
        >
          <Img
            src={staticFile(photo)}
            style={{
              width: vertical ? `${photoW * 100}%` : "auto",
              maxWidth: "100%",
              maxHeight: "100%",
              display: "block",
              objectFit: "contain",
              filter: `drop-shadow(0 30px 60px rgba(0,0,0,0.65)) drop-shadow(0 0 40px ${a.glowSoft})`,
            }}
          />
        </div>
      ) : null}

      {/* Бренд */}
      <div
        style={{
          position: "absolute",
          left: s.pad,
          bottom: s.pad * 0.5,
          fontSize: s.kicker * 0.82,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: colors.textFaint,
        }}
      >
        KOTELNIKOVARTIFACT
      </div>
    </div>
  );
};
