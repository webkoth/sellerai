import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { inter } from "./fonts";
import {
  BigTitle,
  Kicker,
  renderHighlighted,
  Stage,
  useSpringIn,
} from "./kit";
import { Cta } from "./Cta";
import { Subtitle, type SubtitleVariant } from "./Subtitle";
import { colors, FPS, GRAIN } from "./theme";
import { ThemeProvider, useAccent } from "./ThemeContext";

// ============================================================
// Ролик 1 «Уход за метеоритами» — говорящая голова (dual-system,
// чистый звук + липсинк) + субтитры + чипы-акценты + аутро-CTA.
// Источник видео: footage/care-tight.mp4 (плотный рез, 91с).
// ============================================================

const VIDEO_SEC = 91.0;
const OUTRO_SEC = 2.6;

/** Субтитр на плотном таймлайне (сек). `*…*` — акцентное слово. */
type Cue = { from: number; dur: number; text: string; v: SubtitleVariant };
const SUBS: Cue[] = [
  { from: 0.4, dur: 5.0, text: "Метеорит пережил миллионы лет в космосе", v: "glass" },
  { from: 7.4, dur: 5.6, text: "но дома его портит обычная *влага*", v: "solid" },
  { from: 13.6, dur: 5.0, text: "Сихотэ-Алинь · Кампо-дель-Сьело · Муонионалуста", v: "glass" },
  { from: 18.8, dur: 4.6, text: "это *железоникелевый* сплав", v: "solid" },
  { from: 23.6, dur: 4.0, text: "он легко поддаётся коррозии", v: "glass" },
  { from: 27.8, dur: 5.8, text: "храните в сухом месте, без воды", v: "solid" },
  { from: 34.0, dur: 8.8, text: "хранить лучше — с *силикагелем*", v: "glass" },
  { from: 43.4, dur: 4.8, text: "носите изделие — снимайте его", v: "solid" },
  { from: 48.4, dur: 5.4, text: "перед *спортом, морем и сном*", v: "glass" },
  { from: 54.0, dur: 8.2, text: "так *видманштеттенов* узор живёт дольше", v: "solid" },
  { from: 62.8, dur: 2.4, text: "железо боится *коррозии*", v: "glass" },
  { from: 65.6, dur: 2.5, text: "появилась *ржавчина*?", v: "solid" },
  { from: 68.4, dur: 4.0, text: "её можно почистить дома", v: "glass" },
  { from: 72.6, dur: 4.8, text: "*ультразвуковая* ванночка", v: "solid" },
  { from: 77.6, dur: 4.8, text: "зубная паста с *содой*", v: "glass" },
  { from: 82.6, dur: 7.9, text: "или вода с *лимонной кислотой*", v: "solid" },
];

/** Верхний чип-акцент (kicker + мысль). */
type Chip = { from: number; dur: number; kicker: string; text: string };
const CHIPS: Chip[] = [
  { from: 18.6, dur: 6.0, kicker: "Факт", text: "Fe + Ni → боится влаги" },
  { from: 34.4, dur: 8.0, kicker: "Хранение", text: "*Силикагель* — друг метеорита" },
  { from: 48.2, dur: 5.6, kicker: "Украшение", text: "Снимай: спорт · море · сон" },
  { from: 54.6, dur: 7.2, kicker: "Узор", text: "*Видманштеттеновы* фигуры" },
  { from: 65.4, dur: 3.2, kicker: "Главное", text: "Ржавчина — *не приговор*" },
  { from: 72.4, dur: 15.6, kicker: "Чистка", text: "Ультразвук · сода · *лимонная кислота*" },
];

/** Лёгкое зерно + виньетка поверх видео (фирменная фактура). */
const VideoTreat = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 100% at 50% 38%, rgba(0,0,0,0) 46%, rgba(8,9,12,0.55) 100%)",
      }}
    />
    <AbsoluteFill
      style={{
        backgroundImage: GRAIN,
        backgroundSize: "140px 140px",
        opacity: 0.05,
        mixBlendMode: "overlay",
      }}
    />
  </AbsoluteFill>
);

/** Бренд-тег в углу (поверх видео). */
const Brand = () => (
  <div
    style={{
      position: "absolute",
      top: 56,
      left: 70,
      fontFamily: inter,
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: "0.14em",
      color: "rgba(255,255,255,0.82)",
      textShadow: "0 2px 12px rgba(0,0,0,0.6)",
    }}
  >
    KOTELNIKOVARTIFACT
  </div>
);

/** Хук-заголовок (крупно, верхняя треть) — первые секунды. */
const Hook = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const s = useSpringIn(2);
  const opIn = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const opOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(s, [0, 1], [30, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 168 }}>
      <div style={{ opacity: Math.min(opIn, opOut), transform: `translateY(${y}px)`, textAlign: "center" }}>
        <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
          <Kicker>Правило №1</Kicker>
        </div>
        <BigTitle size={132}>{"ДЕРЖАТЬ\nСУХИМ"}</BigTitle>
      </div>
    </AbsoluteFill>
  );
};

/** Верхний чип. */
const ChipView = ({ kicker, text, durationInFrames }: { kicker: string; text: string; durationInFrames: number }) => {
  const a = useAccent();
  const frame = useCurrentFrame();
  const s = useSpringIn(0);
  const opIn = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const opOut = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(s, [0, 1], [-24, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 150 }}>
      <div
        style={{
          opacity: Math.min(opIn, opOut),
          transform: `translateY(${y}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          padding: "18px 30px",
          borderRadius: 18,
          background: "rgba(12, 13, 18, 0.62)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${a.glowSoft}`,
          boxShadow: "0 16px 44px rgba(0,0,0,0.45)",
          maxWidth: 900,
        }}
      >
        <Kicker>{kicker}</Kicker>
        <div
          style={{
            fontFamily: inter,
            fontWeight: 800,
            fontSize: 46,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            textAlign: "center",
            color: colors.title,
          }}
        >
          {renderHighlighted(text, a.accent)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const sec = (s: number) => Math.round(s * FPS);

const At = ({ from, dur, children }: { from: number; dur: number; children: ReactNode }) => (
  <Sequence from={sec(from)} durationInFrames={sec(dur)} layout="none">
    {children}
  </Sequence>
);

/** Длительность всего ролика (видео + аутро). */
export const careReelDuration = (fps: number) => Math.round((VIDEO_SEC + OUTRO_SEC) * fps);

export const CareReel = () => {
  const { fps } = useVideoConfig();
  const videoFrames = Math.round(VIDEO_SEC * fps);
  return (
    <ThemeProvider name="cyan">
      <AbsoluteFill style={{ background: "#000" }}>
        {/* Видео-блок: говорящая голова + чистый звук + оверлеи */}
        <Sequence durationInFrames={videoFrames}>
          <AbsoluteFill>
            <OffthreadVideo src={staticFile("footage/care-tight.mp4")} muted />
            <Audio src={staticFile("footage/care-tight.mp4")} />
            <VideoTreat />
            <Brand />
            <At from={0.3} dur={4.4}>
              <Hook durationInFrames={sec(4.4)} />
            </At>
            {CHIPS.map((c, i) => (
              <At key={`c${i}`} from={c.from} dur={c.dur}>
                <ChipView kicker={c.kicker} text={c.text} durationInFrames={sec(c.dur)} />
              </At>
            ))}
            {SUBS.map((c, i) => (
              <At key={`s${i}`} from={c.from} dur={c.dur}>
                <Subtitle text={c.text} variant={c.v} durationInFrames={sec(c.dur)} />
              </At>
            ))}
          </AbsoluteFill>
        </Sequence>
        {/* Аутро-CTA на космическом фоне */}
        <Sequence from={videoFrames}>
          <Stage brand={null} showChevron={false}>
            <Cta
              item={{
                role: "CTA",
                text: "СОХРАНИ\nСЕБЕ",
                durationSec: OUTRO_SEC,
                kicker: "KOTELNIKOVARTIFACT",
                caption: "каталог в описании",
              }}
            />
          </Stage>
        </Sequence>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
