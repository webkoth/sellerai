import { Appear, BigTitle, Centered, Kicker } from "./kit";
import { colors } from "./theme";
import { useAccent } from "./ThemeContext";
import type { OverlayItem } from "./types";

/** CTA — мягкий призыв: kicker + крупный КАПС-заголовок + стрелка с брендом. */
export const Cta = ({ item }: { item: OverlayItem }) => {
  const a = useAccent();
  return (
    <Centered>
        <Appear delay={4} from="up">
          <Kicker>{item.kicker ?? "KOTELNIKOVARTIFACT"}</Kicker>
        </Appear>
        <Appear delay={12} from="up">
          <BigTitle size={104}>{item.text}</BigTitle>
        </Appear>
        <Appear delay={24} from="left" style={{ marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
            <svg width={44} height={26} viewBox="0 0 44 26" fill="none">
              <path
                d="M3 13h36m0 0l-10-10m10 10l-10 10"
                stroke={a.accent}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ color: colors.textMuted, letterSpacing: "0.04em" }}>
              {item.caption ?? "ссылка в описании"}
            </span>
          </div>
        </Appear>
    </Centered>
  );
};
