import type { CSSProperties } from "react";
import { random, useCurrentFrame } from "remotion";
import { tokenizeTitle } from "./kit";
import { colors } from "./theme";
import { useAccent } from "./ThemeContext";

/**
 * Заголовок «собирается из созвездия»: к каждой букве слетаются звёзды-частицы
 * (с кометными хвостами), глиф проходит «дешифровку» (случайные символы →
 * финальный), на защёлкивании — акцентная вспышка с glow и focus-pull (блюр→резкость).
 * Посимвольный stagger слева-направо. Детерминирован (random по seed), чистый по frame.
 */

const GLYPHS = [..."АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789#%✦✧✷⟡"];
const PARTICLES_PER_CHAR = 4;
const ASSEMBLE = 18; // кадры: схождение частиц + дешифровка
const FLASH = 10; // кадры: кроссфейд «энергия → финальная буква»

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);

/** Одна звезда-частица: летит к центру буквы, тащит за собой кометный хвост. */
const Particle = ({ seed, prog, accent, glow }: { seed: string; prog: number; accent: string; glow: string }) => {
  const ang = random(`ang-${seed}`) * Math.PI * 2;
  const rad = 60 + random(`rad-${seed}`) * 150;
  const e = easeOutCubic(prog);
  const remaining = rad * (1 - e);
  const x = Math.cos(ang) * remaining;
  const y = Math.sin(ang) * remaining;
  const op = Math.sin(Math.PI * clamp01(prog)); // 0 → 1 → 0
  const streak = Math.min(remaining, 48) * (1 - e * 0.3);
  const deg = (ang * 180) / Math.PI;
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(${x}px, ${y}px)`, opacity: op }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: streak,
          height: 2,
          transformOrigin: "left center",
          transform: `rotate(${deg + 180}deg)`,
          background: `linear-gradient(90deg, ${accent} 0%, ${accent}00 100%)`,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -3,
          top: -3,
          width: 6,
          height: 6,
          borderRadius: 6,
          background: "#fff",
          boxShadow: `0 0 10px ${glow}, 0 0 4px ${accent}`,
        }}
      />
    </div>
  );
};

/** Одна буква: width-holder (держит ширину) + два слоя (энергия/финал) + частицы. */
const CharCell = ({
  ch,
  hl,
  order,
  startAt,
  perChar,
}: {
  ch: string;
  hl: boolean;
  order: number;
  startAt: number;
  perChar: number;
}) => {
  const frame = useCurrentFrame();
  const a = useAccent();

  const charStart = startAt + order * perChar;
  const f = frame - charStart;
  const prog = clamp01(f / ASSEMBLE);
  const resolved = f >= ASSEMBLE;
  const e = easeOutCubic(prog);

  const glyphOp = clamp01(f / 6);
  const blur = (1 - e) * 7;
  const flash = resolved ? clamp01((f - ASSEMBLE) / FLASH) : 0;

  const display = resolved ? ch : GLYPHS[Math.floor(random(`g-${order}-${Math.floor(frame / 2)}`) * GLYPHS.length)];
  const hold = ch === " " ? " " : ch;

  const layer: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const energyOp = resolved ? 1 - flash : glyphOp;
  const finalOp = resolved ? flash : 0;
  const showParticles = ch !== " " && f > -2 && f < ASSEMBLE + 2;

  return (
    <span style={{ position: "relative", display: "inline-block", whiteSpace: "pre" }}>
      <span style={{ opacity: 0 }}>{hold}</span>
      {ch !== " " ? (
        <>
          <span style={{ ...layer, color: a.accent, opacity: energyOp, filter: `blur(${blur}px) drop-shadow(0 0 14px ${a.glow})` }}>
            {display}
          </span>
          <span
            style={{
              ...layer,
              color: hl ? a.accent : colors.title,
              opacity: finalOp,
              filter: hl ? `drop-shadow(0 0 18px ${a.glow})` : undefined,
            }}
          >
            {ch}
          </span>
          {showParticles
            ? Array.from({ length: PARTICLES_PER_CHAR }, (_, k) => (
                <Particle key={k} seed={`${order}-${k}`} prog={prog} accent={a.accent} glow={a.glow} />
              ))
            : null}
        </>
      ) : null}
    </span>
  );
};

export type ConstellationTextProps = {
  /** Текст; сегмент в `*…*` остаётся акцентным. Поддерживает несколько слов. */
  text: string;
  /** Кадр старта анимации. */
  startAt?: number;
  /** Размер шрифта, px. */
  size?: number;
  /** Лаг защёлкивания между буквами (кадры). */
  perChar?: number;
  /** Доп. стиль контейнера (напр. textTransform/цвет для подзаголовка). */
  style?: CSSProperties;
};

/** Текст, собирающийся из созвездия (per-char). */
export const ConstellationText = ({ text, startAt = 0, size = 110, perChar = 3, style }: ConstellationTextProps) => {
  const words = tokenizeTitle(text);
  let order = 0;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0.14em 0.36em",
        fontSize: size,
        fontWeight: 800,
        letterSpacing: "-0.01em",
        lineHeight: 1.06,
        textTransform: "uppercase",
        color: colors.title,
        maxWidth: 980,
        ...style,
      }}
    >
      {words.map((w, wi) => (
        <span key={wi} style={{ display: "inline-flex" }}>
          {Array.from(w.w).map((ch, ci) => {
            const o = order++;
            return <CharCell key={ci} ch={ch} hl={w.hl} order={o} startAt={startAt} perChar={perChar} />;
          })}
        </span>
      ))}
    </div>
  );
};
