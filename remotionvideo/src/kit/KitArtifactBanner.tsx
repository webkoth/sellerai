import { Img, staticFile, useVideoConfig } from "remotion";
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
  /** Масштаб фона и его верх в долях кадра: подгоняют изделие под фиксированный шаблон. */
  bgScale?: number;
  bgTop?: number;
  /** Множитель кегля заголовка: длинные имена ужимаются, чтобы остаться в одну строку. */
  titleScale?: number;
  /** Линия заголовка в долях высоты. По умолчанию 0.68 — общий шаблон карточек. */
  titleTop?: number;
  /** object-position фона: выбирает окно кадра, когда сцена выше слота. */
  bgPosition?: string;
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
  bgScale,
  bgTop,
  titleScale = 1,
  titleTop,
  bgPosition,
}: KitArtifactBannerProps) => {
  const { height } = useVideoConfig();
  const poster = layout === "poster";
  // Wildberries рисует поверх главного фото свои плашки. Замерено на живом WB 13.09.2026
  // (доли от кадра 3:4): скидка, «Хорошая цена» и кешбэк занимают низ-лево x 0.03–0.44,
  // y 0.836–0.978; сердце — верх-право x 0.855–1, y 0–0.109; значок сравнения — верх-лево
  // x 0–0.145, y 0–0.109. Линия заголовка ниже выбрана так, чтобы название, описание
  // и строка происхождения оставались выше 0.836, а под плашками была только строка веса.
  const strip = layout === "strip";
  const ribbon = layout === "ribbon";
  const text = onLight ? INK : LIGHT;
  const soft = onLight ? "rgba(18,58,68,0.72)" : "rgba(250,250,250,0.78)";
  const rule = onLight ? "rgba(18,58,68,0.34)" : "rgba(250,250,250,0.42)";
  const accent = onLight ? "#2C7C8A" : CYAN;

  // размеры в долях от меньшей стороны кадра — одинаковая оптика во всех форматах
  const u = (poster ? 1 : ribbon ? 0.52 : strip ? 0.9 : 1.5) * textScale;
  const S = {
    brand: 30 * u,
    series: 25 * u,
    title: (ribbon ? 46 : strip ? 44 : 62) * (ribbon || strip ? textScale : u),
    sub: 30 * u,
    meta: 20 * u,
    note: 22 * u,
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

  // Низ постера: держим над зоной плашек всё, кроме строки веса — её слот вычитаем.
  // Шаблон карточки фиксирован: заголовок у всех товаров начинается на одной линии,
  // и под эту линию подгоняется кадр изделия (bgScale/bgTop считает kit_card_layout.py).
  // Иначе в каталоге имена пляшут по высоте и витрина рассыпается.
  const TITLE_TOP = titleTop ?? 0.68;

  const Head = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: poster ? "center" : "flex-start", gap: S.gapS }}>
      <Spaced size={S.brand} color={text} spacing="0.4em" weight={400}>{brand}</Spaced>
      <Hairline w={poster ? "52%" : "78%"} />
      <Spaced size={S.series} color={accent} spacing="0.42em">{series}</Spaced>
    </div>
  );

  const Foot = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: poster ? "center" : "flex-start", gap: S.gapS }}>
      <div style={{ fontFamily: artifact, fontSize: S.title * titleScale, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: text, lineHeight: 1.05, textAlign: poster ? "center" : "left", whiteSpace: poster ? "nowrap" : "normal" }}>
        {title}
      </div>
      <div style={{ fontFamily: artifact, fontSize: S.sub, fontWeight: 300, color: soft, letterSpacing: "0.01em", textAlign: poster ? "center" : "left" }}>
        {subtitle}
      </div>
      <div style={{ marginTop: S.gapS * 0.6, marginBottom: S.gapS * 0.4 }}>
        <Hairline w={poster ? 300 * u : 240 * u} bright />
      </div>
      <Spaced size={S.meta} color={accent} spacing="0.32em">{meta}</Spaced>
      {note ? (
        <div style={{ fontFamily: artifact, fontSize: S.note, fontWeight: 400, color: soft }}>{note}</div>
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
      <Img
        src={staticFile(background)}
        style={bgScale && bgTop !== undefined
          // maxWidth/maxHeight none обязательны: preflight tailwind ставит img{max-width:100%},
          // и кадр, увеличенный до bgScale, обрезался обратно до ширины карточки — справа
          // оставалась пустая полоса цвета фона шириной (bgScale-1)/2.
          ? { position: "absolute", left: `${((1 - bgScale) / 2) * 100}%`, top: `${bgTop * 100}%`,
              width: `${bgScale * 100}%`, height: `${bgScale * 100}%`,
              maxWidth: "none", maxHeight: "none", objectFit: "cover" }
          : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
              objectPosition: bgPosition ?? "50% 50%" }}
      />
      {/* Лёгкая вуаль: макеты держат текст читаемым поверх фактуры. */}
      <div style={{ position: "absolute", inset: 0, background: onLight
        ? "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 42%, rgba(255,255,255,0.34) 100%)"
        : productInBackground
          ? "linear-gradient(180deg, rgba(6,11,18,0.74) 0%, rgba(6,11,18,0.16) 30%, rgba(6,11,18,0.20) 58%, rgba(5,9,15,0.82) 100%)"
          : "linear-gradient(180deg, rgba(8,14,22,0.52) 0%, rgba(8,14,22,0.18) 40%, rgba(8,14,22,0.62) 100%)" }} />

      {productInBackground && !poster ? (
        // Вуаль под текст слева. Светлая для светлой темы, иначе тёмный текст на тёмной вуали.
        <div style={{ position: "absolute", inset: 0, background: onLight
          ? "linear-gradient(90deg, rgba(247,245,241,0.94) 0%, rgba(247,245,241,0.80) 26%, rgba(247,245,241,0.38) 46%, transparent 64%)"
          : "linear-gradient(90deg, rgba(5,9,15,0.90) 0%, rgba(5,9,15,0.66) 26%, rgba(5,9,15,0.22) 46%, transparent 62%)" }} />
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
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: `${86 * u}px`, padding: `0 ${56 * u}px`, display: "flex", justifyContent: "center" }}>
            {Head}
          </div>
          {productInBackground ? null : (
            <div style={{ position: "absolute", left: 0, right: 0, top: `${230 * u}px`, height: `${TITLE_TOP * height - 280 * u}px`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: `${(photoScale ?? 0.5) * 100}%`, display: "flex", alignItems: "center", justifyContent: "center" }}>{Product}</div>
            </div>
          )}
          <div style={{ position: "absolute", left: 0, right: 0, top: `${TITLE_TOP * height}px`, padding: `0 ${56 * u}px`, display: "flex", justifyContent: "center" }}>
            {Foot}
          </div>
        </>
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
