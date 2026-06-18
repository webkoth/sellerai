import { createContext, useContext, type ReactNode } from "react";
import { ACCENTS, type Accent, type ThemeName } from "./theme";

const AccentContext = createContext<Accent>(ACCENTS.ember);

/** Текущая акцентная палитра (берётся из ближайшего ThemeProvider). */
export const useAccent = () => useContext(AccentContext);

/** Оборачивает поддерево в выбранную цветовую тему. */
export const ThemeProvider = ({
  name = "ember",
  children,
}: {
  name?: ThemeName;
  children: ReactNode;
}) => <AccentContext.Provider value={ACCENTS[name]}>{children}</AccentContext.Provider>;
