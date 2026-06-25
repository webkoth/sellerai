import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Appear, Centered, HighlightWord, Kicker, tokenizeTitle } from "./kit";
import { colors } from "./theme";
import { useAccent } from "./ThemeContext";
import type { OverlayItem } from "./types";

/**
 * STATEMENT — ключевая фраза прямо на космо-фоне (без кремовой карточки).
 * Замена примитивного KEY. Два варианта (поле `variant` в OverlayItem):
 *   center — по центру, акцентная черта-«прочерк» сверху, пословный вход;
 *   quote  — пулл-квот: вертикальная акцентная черта слева, акцентный сегмент цветом+свечением.
 */

/** Размер фразы под самую длинную строку (звёздочки не считаем). */
const fitSize = (text: string) => {
  const longest = text
    .replace(/\*/g, "")
    .split("\n")
    .reduce((m, l) => Math.max(m, l.length), 0);
  return longest > 38 ? 54 : longest > 28 ? 64 : longest > 18 ? 76 : 90;
};

/** Акцентная черта со свечением, «прочерчивается» (scaleX). */
const AccentRule = ({ delay }: { delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = useAccent();
  const p = spring({ frame, fps, delay, durationInFrames: 18, config: { damping: 200 } });
  return (
    <div
      style={{
        width: 132,
        height: 5,
        borderRadius: 5,
        background: a.gradient,
        boxShadow: `0 0 20px ${a.glow}`,
        transform: `scaleX(${Math.max(0, Math.min(1, p))})`,
        transformOrigin: "center",
      }}
    />
  );
};

/** Вертикальная акцентная черта слева, растёт (scaleY) со свечением. */
const VerticalBar = ({ delay }: { delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = useAccent();
  const p = spring({ frame, fps, delay, durationInFrames: 18, config: { damping: 200 } });
  return (
    <div
      style={{
        width: 8,
        alignSelf: "stretch",
        borderRadius: 8,
        background: a.gradient,
        boxShadow: `0 0 22px ${a.glow}`,
        transform: `scaleY(${Math.max(0, Math.min(1, p))})`,
        transformOrigin: "top",
        flex: "0 0 auto",
      }}
    />
  );
};

/** Вариант center: фраза по центру, акцентная черта сверху, пословный slide-up. */
const Center = ({ item }: { item: OverlayItem }) => {
  const tokens = tokenizeTitle(item.text);
  const penDelay = 16 + tokens.length * 5 + 4;
  const size = fitSize(item.text);
  return (
    <Centered>
      {item.kicker ? (
        <Appear delay={2} from="up">
          <Kicker>{item.kicker}</Kicker>
        </Appear>
      ) : null}
      <AccentRule delay={8} />
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 18px", maxWidth: 900 }}>
        {tokens.map((t, i) => (
          <Appear key={i} delay={16 + i * 5} from="up">
            <div
              style={{
                fontSize: size,
                fontWeight: 800,
                lineHeight: 1.12,
                letterSpacing: "-0.015em",
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

/** Вариант quote: пулл-квот с чертой слева, акцентный сегмент — цвет + свечение. */
const Quote = ({ item }: { item: OverlayItem }) => {
  const a = useAccent();
  const tokens = tokenizeTitle(item.text);
  const size = fitSize(item.text);
  return (
    <Centered align="start">
      <div style={{ display: "flex", gap: 34, alignItems: "stretch", maxWidth: 940 }}>
        <VerticalBar delay={6} />
        <div>
          {item.kicker ? (
            <Appear delay={2} from="left" style={{ marginBottom: 14 }}>
              <Kicker>{item.kicker}</Kicker>
            </Appear>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
            {tokens.map((t, i) => (
              <Appear key={i} delay={14 + i * 5} from="up">
                <div
                  style={{
                    fontSize: size,
                    fontWeight: 800,
                    lineHeight: 1.14,
                    letterSpacing: "-0.015em",
                    color: t.hl ? a.accent : colors.title,
                    textShadow: t.hl ? `0 0 26px ${a.glow}` : undefined,
                  }}
                >
                  {t.w}
                </div>
              </Appear>
            ))}
          </div>
        </div>
      </div>
    </Centered>
  );
};

/** STATEMENT — ключевая фраза на космо-фоне (center / quote). */
export const Statement = ({ item }: { item: OverlayItem }) =>
  item.variant === "quote" ? <Quote item={item} /> : <Center item={item} />;
