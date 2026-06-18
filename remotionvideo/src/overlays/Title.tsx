import { Appear, Centered, HighlightWord, Kicker, tokenizeTitle } from "./kit";
import { colors } from "./theme";
import type { OverlayItem } from "./types";

/** TITLE — кинетический заголовок: слова по очереди, сегмент `*…*` — маркерная подсветка. */
export const Title = ({ item }: { item: OverlayItem }) => {
  const tokens = tokenizeTitle(item.text);
  const penDelay = 12 + tokens.length * 6 + 4;

  // Размер подбираем под самое длинное слово, чтобы оно не упиралось в края (ширина ≈ 912px).
  const maxLen = tokens.reduce((m, t) => Math.max(m, t.w.length), 0);
  const fontSize = maxLen <= 7 ? 108 : maxLen <= 9 ? 94 : maxLen <= 11 ? 82 : 72;

  return (
    <Centered>
        {item.kicker ? (
          <Appear delay={4} from="left">
            <Kicker>{item.kicker}</Kicker>
          </Appear>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 24px", maxWidth: 912 }}>
          {tokens.map((t, i) => (
            <Appear key={i} delay={12 + i * 6} from="up">
              <div
                style={{
                  fontSize,
                  fontWeight: 800,
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                  textTransform: "uppercase",
                  color: colors.title,
                }}
              >
                {t.hl ? <HighlightWord delay={penDelay}>{t.w}</HighlightWord> : t.w}
              </div>
            </Appear>
          ))}
        </div>
    </Centered>
  );
};
