import { Appear, Centered, Kicker } from "./kit";
import { colors } from "./theme";
import { useAccent } from "./ThemeContext";
import type { OverlayItem } from "./types";

/** FACT — крупная цифра/термин акцентным градиентом со свечением + подпись. */
export const Fact = ({ item }: { item: OverlayItem }) => {
  const a = useAccent();
  const longest = item.text.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  const size = longest > 16 ? 76 : longest > 11 ? 92 : longest > 7 ? 118 : 150;

  return (
    <Centered>
        {item.kicker ? (
          <Appear delay={4} from="up">
            <Kicker>{item.kicker}</Kicker>
          </Appear>
        ) : null}
        <Appear delay={12} from="scale">
          <div
            style={{
              fontSize: size,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              backgroundImage: a.gradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: `drop-shadow(0 8px 36px ${a.glowSoft})`,
              whiteSpace: "pre-line",
              fontVariantNumeric: "tabular-nums",
              maxWidth: 912,
            }}
          >
            {item.text}
          </div>
        </Appear>
        {item.caption ? (
          <Appear delay={24} from="up">
            <div style={{ fontSize: 42, fontWeight: 600, color: colors.textMuted, maxWidth: 860, lineHeight: 1.3 }}>
              {item.caption}
            </div>
          </Appear>
        ) : null}
    </Centered>
  );
};
