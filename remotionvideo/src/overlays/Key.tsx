import { Appear, Card, Centered, Kicker, renderHighlighted } from "./kit";
import { colors } from "./theme";
import { useAccent } from "./ThemeContext";
import type { OverlayItem } from "./types";

/** KEY — ключевая мысль на кремовой карточке, акцентом выделен сегмент в `*…*`. */
export const Key = ({ item }: { item: OverlayItem }) => {
  const a = useAccent();
  return (
    <Centered>
        {item.kicker ? (
          <Appear delay={4} from="up" style={{ marginBottom: 4 }}>
            <Kicker>{item.kicker}</Kicker>
          </Appear>
        ) : null}
        <Appear delay={10} from="scale">
          <Card style={{ maxWidth: 840 }}>
            <div
              style={{
                padding: "46px 52px",
                fontSize: 60,
                fontWeight: 800,
                lineHeight: 1.18,
                letterSpacing: "-0.01em",
                color: colors.cardLightTitle,
                textAlign: "left",
              }}
            >
              {renderHighlighted(item.text, a.accent)}
            </div>
          </Card>
        </Appear>
    </Centered>
  );
};
