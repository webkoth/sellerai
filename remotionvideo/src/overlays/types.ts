/** Роль сцены — задаёт визуальный приём. */
export type OverlayRole = "TITLE" | "FACT" | "KEY" | "CTA" | "TYPE";

/** Тип перехода ПЕРЕД сценой. */
export type TransitionKind = "fade" | "slide" | "wipe";

/** Одна бит-сцена ролика. */
export interface OverlayItem {
  /** Роль (приём). */
  role: OverlayRole;
  /** Текст. Сегмент в `*звёздочках*` получает подсветку. Поддерживает `\n`. */
  text: string;
  /** Длительность сцены, секунды. */
  durationSec: number;
  /** Мелкий лейбл-kicker над контентом. */
  kicker?: string;
  /** Подпись под цифрой/термином (FACT, TYPE). */
  caption?: string;
  /** Переход перед этой сценой (по умолчанию fade). */
  transition?: TransitionKind;
}
