import type { ReactNode } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { inter } from "./fonts";
import { Stage, BrandChrome } from "./kit";
import { ThemeProvider } from "./ThemeContext";
import type { ThemeName } from "./theme";
import { CosmicLogoContent } from "./LogoRevealCosmic";
import { Overlay } from "./Overlay";
import { Subtitle, type SubtitleVariant } from "./Subtitle";
import { presentationFor, timingFor, TRANSITION_FRAMES } from "./ReelOverlays";
import type { OverlayItem } from "./types";

/**
 * Канонная сквозная витрина единого стиля: интро Logo-Cosmic → по одной сцене
 * каждой роли (+ оба варианта Statement) → демо-плашки субтитров. Всё на ОДНОМ фоне.
 */

const INTRO_SEC = 5.5;
const SUB_TAIL_SEC = 0.4;

/** Демо-роли: по одной сцене каждого приёма (Statement — оба варианта). */
const ROLES: OverlayItem[] = [
  { role: "TITLE", text: "Фрагмент *космоса*", kicker: "KOTELNIKOVARTIFACT", durationSec: 3.4 },
  { role: "FACT", text: "4,5 млрд лет", caption: "древнейшее вещество Солнечной системы", durationSec: 3.4, transition: "wipe" },
  { role: "STATEMENT", text: "Не чудо. *Напоминание*.", durationSec: 3.0, transition: "wipe", variant: "center" },
  { role: "STATEMENT", text: "Металл, что *не из земли* — а с неба", durationSec: 3.4, transition: "wipe", variant: "quote" },
  { role: "TYPE", text: "Спецификация стиля: kicker, цифра, печать", kicker: "Typewriter", durationSec: 4.0, transition: "wipe" },
  { role: "CTA", text: "Выбери\nсвой артефакт", durationSec: 3.6, transition: "wipe" },
];

/** Демо-плашки субтитров в финале (glass + solid). */
const SUB_CUES: { text: string; variant: SubtitleVariant; durationSec: number }[] = [
  { text: "Это не просто *камень* из космоса", variant: "glass", durationSec: 3.0 },
  { text: "И второго такого *не существует*", variant: "solid", durationSec: 3.2 },
];

const f = (sec: number, fps: number) => Math.round(sec * fps);

const subDurInFrames = (fps: number) =>
  SUB_CUES.reduce((a, c) => a + f(c.durationSec, fps), 0) + f(SUB_TAIL_SEC, fps);

/** Финальный акт: плашки субтитров друг за другом (на общем фоне). */
const SubtitleAct = () => {
  const { fps } = useVideoConfig();
  let from = 0;
  const nodes: ReactNode[] = SUB_CUES.map((c, i) => {
    const dur = f(c.durationSec, fps);
    const node = (
      <Sequence key={i} from={from} durationInFrames={dur} layout="none">
        <Subtitle text={c.text} variant={c.variant} durationInFrames={dur} />
      </Sequence>
    );
    from += dur;
    return node;
  });
  return <>{nodes}</>;
};

/** Длительность всей витрины (кадры): сумма актов − перекрытия переходов. */
export const templateDurationInFrames = (fps: number) => {
  const intro = f(INTRO_SEC, fps);
  const roles = ROLES.reduce((a, r) => a + f(r.durationSec, fps), 0);
  const subs = subDurInFrames(fps);
  // Переходы: интро→роли (1) + между ролями (ROLES.length−1) + роли→субтитры (1).
  const transitions = (1 + (ROLES.length - 1) + 1) * TRANSITION_FRAMES;
  return Math.max(1, intro + roles + subs - transitions);
};

export type TemplateProps = { theme?: ThemeName; footage?: string };

/** Канонная сквозная витрина стиля «KOTELNIKOVARTIFACT». */
export const Template = ({ theme = "ember", footage }: TemplateProps) => {
  const { fps } = useVideoConfig();
  const introDur = f(INTRO_SEC, fps);
  const series: ReactNode[] = [];

  // 1. Интро — космо-логотип поверх общего фона.
  series.push(
    <TransitionSeries.Sequence key="intro" durationInFrames={introDur}>
      <CosmicLogoContent />
    </TransitionSeries.Sequence>,
  );
  series.push(<TransitionSeries.Transition key="t-intro" presentation={wipe()} timing={timingFor("wipe")} />);

  // 2. Роли.
  ROLES.forEach((item, i) => {
    if (i > 0) {
      series.push(
        <TransitionSeries.Transition
          key={`t-role-${i}`}
          presentation={presentationFor(item.transition)}
          timing={timingFor(item.transition)}
        />,
      );
    }
    series.push(
      <TransitionSeries.Sequence key={`role-${i}`} durationInFrames={f(item.durationSec, fps)}>
        <Overlay item={item} />
      </TransitionSeries.Sequence>,
    );
  });

  // 3. Субтитры.
  series.push(<TransitionSeries.Transition key="t-subs" presentation={wipe()} timing={timingFor("wipe")} />);
  series.push(
    <TransitionSeries.Sequence key="subs" durationInFrames={subDurInFrames(fps)}>
      <SubtitleAct />
    </TransitionSeries.Sequence>,
  );

  return (
    <ThemeProvider name={theme}>
      <AbsoluteFill style={{ fontFamily: inter }}>
        {/* Единый фон на весь ролик. Бренд/шеврон скрыты — добавим отдельным слоем после интро. */}
        <Stage footage={footage} brand={null} showChevron={false}>
          {null}
        </Stage>
        <Sequence from={Math.max(0, introDur - TRANSITION_FRAMES)} layout="none">
          <BrandChrome />
        </Sequence>
        <TransitionSeries>{series}</TransitionSeries>
      </AbsoluteFill>
    </ThemeProvider>
  );
};
