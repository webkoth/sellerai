import { Img, staticFile, useVideoConfig } from "remotion";
import { artifact } from "./artifactFont";

/**
 * Памятка по уходу — последнее фото в карточке товара.
 *
 * Та же типографика, что у карточек: бренд разрядкой, hairline, заголовок капсом,
 * дальше короткие правила по одному в строку. Фон — сцена из того же набора,
 * сильно затемнённая: здесь читается текст, а не предмет.
 */

export type KitCareCardProps = {
  background: string;
  kicker: string;
  title: string;
  rules: string[];
  footer?: string;
  onLight?: boolean;
};

const LIGHT = "#FAFAFA";
const INK = "#123A44";
const CYAN = "#4FA5B2";

export const KitCareCard = ({
  background, kicker, title, rules, footer, onLight = false,
}: KitCareCardProps) => {
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1200;
  const text = onLight ? INK : LIGHT;
  const soft = onLight ? "rgba(18,58,68,0.78)" : "rgba(250,250,250,0.82)";
  const accent = onLight ? "#2C7C8A" : CYAN;
  const rule = onLight ? "rgba(18,58,68,0.34)" : "rgba(250,250,250,0.42)";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden",
      background: onLight ? "#EFEAE0" : "#0B121B" }}>
      <Img src={staticFile(background)} style={{ position: "absolute", inset: 0,
        width: "100%", height: "100%", objectFit: "cover", maxWidth: "none", maxHeight: "none" }} />
      {/* Плотная вуаль: памятка — это текст, фактура под ним только фон */}
      <div style={{ position: "absolute", inset: 0, background: onLight
        ? "linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.80) 100%)"
        : "linear-gradient(180deg, rgba(6,11,18,0.88) 0%, rgba(6,11,18,0.82) 100%)" }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", padding: `${96 * u}px ${84 * u}px` }}>
        <div style={{ fontFamily: artifact, fontSize: 30 * u, fontWeight: 400, letterSpacing: "0.4em",
          textTransform: "uppercase", color: text, whiteSpace: "nowrap" }}>
          KOTELNIKOVARTIFACT
        </div>
        <div style={{ width: "48%", height: 2, background: rule, margin: `${26 * u}px 0` }} />
        <div style={{ fontFamily: artifact, fontSize: 25 * u, fontWeight: 500, letterSpacing: "0.42em",
          textTransform: "uppercase", color: accent, whiteSpace: "nowrap" }}>
          {kicker}
        </div>

        <div style={{ fontFamily: artifact, fontSize: 68 * u, fontWeight: 700, letterSpacing: "0.02em",
          textTransform: "uppercase", color: text, textAlign: "center", lineHeight: 1.08,
          marginTop: `${62 * u}px` }}>
          {title}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: `${34 * u}px`,
          marginTop: `${70 * u}px`, width: "100%" }}>
          {rules.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: `${26 * u}px` }}>
              <div style={{ fontFamily: artifact, fontSize: 30 * u, fontWeight: 600, color: accent,
                minWidth: `${44 * u}px`, lineHeight: 1.35 }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontFamily: artifact, fontSize: 34 * u, fontWeight: 300, color: soft,
                lineHeight: 1.35 }}>{r}</div>
            </div>
          ))}
        </div>

        {footer ? (
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column",
            alignItems: "center", gap: `${22 * u}px` }}>
            <div style={{ width: 300 * u, height: 2, background: accent, opacity: 0.9 }} />
            <div style={{ fontFamily: artifact, fontSize: 26 * u, fontWeight: 500, letterSpacing: "0.22em",
              textTransform: "uppercase", color: accent, textAlign: "center" }}>{footer}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
