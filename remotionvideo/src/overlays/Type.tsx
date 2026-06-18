import { Appear, Centered, Kicker, Typewriter } from "./kit";
import { colors } from "./theme";
import type { OverlayItem } from "./types";

/** TYPE — текст набирается «печатной машинкой» (string slicing + курсор). */
export const Type = ({ item }: { item: OverlayItem }) => {
  const captionDelay = 12 + item.text.length * 2 + 8;

  return (
    <Centered align="start">
        {item.kicker ? (
          <Appear delay={4} from="left">
            <Kicker>{item.kicker}</Kicker>
          </Appear>
        ) : null}
        <div
          style={{
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.18,
            letterSpacing: "-0.01em",
            color: colors.title,
            textAlign: "left",
            maxWidth: 900,
          }}
        >
          <Typewriter text={item.text} startAt={12} charFrames={2} />
        </div>
        {item.caption ? (
          <Appear delay={captionDelay} from="up">
            <div style={{ fontSize: 40, fontWeight: 600, color: colors.textMuted, maxWidth: 860, lineHeight: 1.3 }}>
              {item.caption}
            </div>
          </Appear>
        ) : null}
    </Centered>
  );
};
