import { Img, staticFile } from "remotion";
import { artifact } from "./artifactFont";

/**
 * Набор в стиле карточек «Книга небесного железа» (макеты Figma).
 *
 * Структура эталона сверху вниз: бренд разрядкой → hairline → серия циановым капсом →
 * изделие → крупный заголовок капсом → тонкий подзаголовок → hairline → строка-мета
 * циановым капсом → возраст. Цвета сняты пипеткой с макетов:
 * акцент `#4FA5B2`, яркая линия `#15CADB`, текст `#FAFAFA`.
 *
 * `layout: "poster"` повторяет вертикальную карточку; `"wide"` раскладывает те же
 * элементы в колонку слева, изделие — справа (для баннеров 2:1, 16:9 и полосы 5:1).
 */

export type ArtifactLayout = "poster" | "wide" | "strip" | "ribbon";

export type KitArtifactBannerProps = {
  /** Фон из public/kit-bg. */
  background: string;
  /** Вырезка изделия из public/kit-cutouts. */
  photo: string;
  brand?: string;
  series: string;
  title: string;
  subtitle: string;
  meta: string;
  note?: string;
  layout: ArtifactLayout;
  /** Доля кадра под изделие. */
  photoScale?: number;
  /** Множитель размера текста: карточки товара требуют крупнее баннеров. */
  textScale?: number;
  /** Тёмный фон (по умолчанию) или светлый — для пергамента и травертина. */
  onLight?: boolean;
  /** Изделие уже снято внутри фонового кадра — отдельный слой с вырезкой не нужен. */
  productInBackground?: boolean;
};

const CYAN = "#4FA5B2";
const CYAN_BRIGHT = "#15CADB";
const LIGHT = "#FAFAFA";
const INK = "#123A44";

export const KitArtifactBanner = ({
  background,
  photo,
  brand = "KOTELNIKOVARTIFACT",
  series,
  title,
  subtitle,
  meta,
  note,
  layout,
  photoScale,
  onLight = false,
  productInBackground = false,
  textScale = 1,
}: KitArtifactBannerProps) => {
  const poster = layout === "poster";
  const strip = layout === "strip";
  const ribbon = layout === "ribbon";
  const text = onLight ? INK : LIGHT;
  const soft = onLight ? "rgba(18,58,68,0.72)" : "rgba(250,250,250,0.78)";
  const rule = onLight ? "rgba(18,58,68,0.34)" : "rgba(250,250,250,0.42)";
  const accent = onLight ? "#2C7C8A" : CYAN;

  // размеры в долях от меньшей стороны кадра — одинаковая оптика во всех форматах
  const u = (poster ? 1 : ribbon ? 0.52 : strip ? 0.9 : 1.5) * textScale;
  const S = {
    brand: 26 * u,
    series: 22 * u,
    title: (ribbon ? 46 : strip ? 44 : 62) * (ribbon || strip ? textScale : u),
    sub: 26 * u,
    meta: 20 * u,
    note: 20 * u,
    gapS: 18 * u,
    gapM: 30 * u,
  };

  const Spaced = ({
    children, size, color, weight = 500, spacing = "0.34em",
  }: { children: string; size: number; color: string; weight?: number; spacing?: string }) => (
    <div style={{ fontFamily: artifact, fontSize: size, fontWeight: weight, letterSpacing: spacing, textTransform: "uppercase", color, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );

  const Hairline = ({ w, bright = false }: { w: number | string; bright?: boolean }) => (
    <div style={{ width: w, height: 2, background: bright ? CYAN_BRIGHT : rule, opacity: bright ? 0.95 : 0.9, boxShadow: bright ? `0 0 12px ${CYAN_BRIGHT}66` : "none" }} />
  );

  const Head = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: poster ? "center" : "flex-start", gap: S.gapS }}>
      <Spaced size={S.brand} color={text} spacing="0.4em" weight={400}>{brand}</Spaced>
      <Hairline w={poster ? "52%" : "78%"} />
      <Spaced size={S.series} color={accent} spacing="0.42em">{series}</Spaced>
    </div>
  );

  const Foot = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: poster ? "center" : "flex-start", gap: S.gapS }}>
      <div style={{ fontFamily: artifact, fontSize: S.title, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: text, lineHeight: 1.05 }}>
        {title}
      </div>
      <div style={{ fontFamily: artifact, fontSize: S.sub, fontWeight: 300, color: soft, letterSpacing: "0.01em" }}>
        {subtitle}
      </div>
      <div style={{ marginTop: S.gapS * 0.6, marginBottom: S.gapS * 0.4 }}>
        <Hairline w={poster ? 300 * u : 240 * u} bright />
      </div>
      <Spaced size={S.meta} color={accent} spacing="0.32em">{meta}</Spaced>
      {note ? (
        <div style={{ fontFamily: artifact, fontSize: S.note, fontWeight: 300, color: soft }}>{note}</div>
      ) : null}
    </div>
  );

  const Product = (
    <Img
      src={staticFile(photo)}
      style={{
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        filter: onLight
          ? "drop-shadow(0 24px 44px rgba(0,0,0,0.42))"
          : "drop-shadow(0 30px 56px rgba(0,0,0,0.62)) drop-shadow(0 0 42px rgba(79,165,178,0.28))",
      }}
    />
  );

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: onLight ? "#EFEAE0" : "#0B121B" }}>
      <Img src={staticFile(background)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      {/* Лёгкая вуаль: макеты держат текст читаемым поверх фактуры. */}
      <div style={{ position: "absolute", inset: 0, background: onLight
        ? "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 42%, rgba(255,255,255,0.34) 100%)"
        : productInBackground
          ? "linear-gradient(180deg, rgba(6,11,18,0.74) 0%, rgba(6,11,18,0.16) 30%, rgba(6,11,18,0.20) 58%, rgba(5,9,15,0.82) 100%)"
          : "linear-gradient(180deg, rgba(8,14,22,0.52) 0%, rgba(8,14,22,0.18) 40%, rgba(8,14,22,0.62) 100%)" }} />

      {productInBackground && !poster ? (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(5,9,15,0.90) 0%, rgba(5,9,15,0.66) 26%, rgba(5,9,15,0.22) 46%, transparent 62%)" }} />
      ) : null}

      {ribbon ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 84px", gap: 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
            <div style={{ fontFamily: artifact, fontSize: S.title, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: text, whiteSpace: "nowrap" }}>
              {title}
            </div>
            <div style={{ fontFamily: artifact, fontSize: S.sub, fontWeight: 300, color: soft, whiteSpace: "nowrap" }}>{subtitle}</div>
          </div>
          <Spaced size={S.meta} color={accent} spacing="0.3em">{meta}</Spaced>
        </div>
      ) : poster ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: `${86 * u}px ${56 * u}px ${64 * u}px` }}>
          {Head}
          {productInBackground ? <div style={{ flex: 1 }} /> : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: `${(photoScale ?? 0.5) * 100}%`, padding: `${S.gapM}px 0` }}>{Product}</div>
          )}
          {Foot}
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: strip ? "0 110px" : "0 150px", gap: 72 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: strip ? S.gapS : S.gapM * 1.1, maxWidth: strip ? "62%" : productInBackground ? "40%" : "52%" }}>
            {strip ? null : Head}
            {Foot}
          </div>
          {productInBackground ? null : (
            <div style={{ height: strip ? "82%" : "80%", width: `${(photoScale ?? 0.3) * 100}%`, display: "flex", alignItems: "center", justifyContent: "center" }}>{Product}</div>
          )}
        </div>
      )}
    </div>
  );
};
