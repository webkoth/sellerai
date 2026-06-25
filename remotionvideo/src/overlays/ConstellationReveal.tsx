import { Appear, Centered, Kicker, Stage } from "./kit";
import { colors, type ThemeName } from "./theme";
import { ThemeProvider } from "./ThemeContext";
import { ConstellationText } from "./ConstellationText";

/**
 * Флагманский пример «Сборка из созвездия»: заголовок собирается из звёзд-частиц
 * с дешифровкой, под ним — подзаголовок, который собирается следом. На космо-фоне.
 */

export type ConstellationRevealProps = { theme?: ThemeName };

export const ConstellationReveal = ({ theme = "cyan" }: ConstellationRevealProps) => (
  <ThemeProvider name={theme}>
    <Stage brand={null} showChevron={false}>
      <Centered>
        <Appear delay={2} from="up">
          <Kicker>KOTELNIKOVARTIFACT · МЕТЕОРИТЫ</Kicker>
        </Appear>
        <ConstellationText text="РОЖДЁН ИЗ *ЗВЁЗД*" startAt={12} size={124} perChar={3} />
        <ConstellationText
          text="каждый атом старше Солнца"
          startAt={80}
          size={42}
          perChar={1.6}
          style={{ textTransform: "none", fontWeight: 600, color: colors.textMuted, maxWidth: 840 }}
        />
      </Centered>
    </Stage>
  </ThemeProvider>
);
