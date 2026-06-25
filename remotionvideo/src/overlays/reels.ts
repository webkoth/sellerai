import type { OverlayItem } from "./types";

/**
 * Бит-сцены по 6 роликам серии «Метеориты».
 * Тексты — из docs/video-scripts/meteorites/*.md. Сегмент в `*звёздочках*` → подсветка.
 *
 * Это самостоятельные графические ролики (полноэкранные сцены через переходы).
 * Длительности подобраны под темп Shorts (~17–19 c). Под закадровый голос подправить.
 */
export interface Reel {
  id: string;
  title: string;
  /** Общий фон-футаж на весь ролик (необязательно). */
  footage?: string;
  items: OverlayItem[];
}

export const REELS: Reel[] = [
  {
    id: "Reel-1-Care",
    title: "1. Уход за метеоритами",
    items: [
      { role: "TITLE", text: "Держи его *сухим*", kicker: "Уход за метеоритом", durationSec: 3.6 },
      { role: "STATEMENT", text: "Железо и никель боятся *влаги*", durationSec: 3.4, transition: "slide", variant: "quote" },
      { role: "STATEMENT", text: "Не в ванной. Не на подоконнике.", durationSec: 3.0 },
      { role: "FACT", text: "Силикагель", kicker: "Лайфхак", caption: "сухая витрина + пакетик — и образец как новый", durationSec: 3.8, transition: "wipe" },
      { role: "CTA", text: "Сохрани,\nчтобы не потерять", kicker: "Уход", durationSec: 4.0 },
    ],
  },
  {
    id: "Reel-2-Radiation",
    title: "2. Безопасность: радиация",
    items: [
      { role: "TITLE", text: "Метеорит *радиоактивен*?", kicker: "Частый вопрос", durationSec: 3.6 },
      { role: "FACT", text: "Обычно — нет", caption: "у большинства метеоритов фон как в комнате", durationSec: 3.8 },
      { role: "STATEMENT", text: "Дозиметр покажет *фон комнаты*", durationSec: 3.2, transition: "slide" },
      { role: "STATEMENT", text: "Не пили и не шлифуй дома", durationSec: 3.0 },
      { role: "CTA", text: "Сохрани\nи пришли\nсомневающимся", durationSec: 4.0 },
    ],
  },
  {
    id: "Reel-3-Strength",
    title: "3. Метеорит как символ силы",
    items: [
      { role: "TITLE", text: "Самый *сильный* камень?", kicker: "Артефакт", durationSec: 3.6 },
      { role: "FACT", text: "4,5 млрд лет", caption: "старше Земли в её нынешнем виде", durationSec: 3.8 },
      { role: "STATEMENT", text: "Камень воли, пути и космической памяти", durationSec: 3.5, transition: "slide" },
      { role: "STATEMENT", text: "Не чудо. *Напоминание*.", durationSec: 3.0, variant: "quote" },
      { role: "CTA", text: "Выбери тот,\nчто откликается", durationSec: 4.0 },
    ],
  },
  {
    id: "Reel-4-Product",
    title: "4. Обзор изделия (пример: Дронино)",
    footage: "footage/dronino.png",
    items: [
      { role: "TITLE", text: "Метеорит *Дронино*", kicker: "Обзор", durationSec: 3.6 },
      { role: "FACT", text: "60,2 г", kicker: "Вес образца", caption: "железный · находка 2000, Рязанская обл.", durationSec: 3.8 },
      { role: "STATEMENT", text: "Природный рельеф — *не подделать*", durationSec: 3.2, transition: "slide" },
      { role: "STATEMENT", text: "Существует в *одном* экземпляре", durationSec: 3.2 },
      { role: "CTA", text: "Цена —\nв описании", kicker: "KOTELNIKOVARTIFACT", durationSec: 4.0 },
    ],
  },
  {
    id: "Reel-5-Types",
    title: "5. Виды метеоритов",
    items: [
      { role: "TITLE", text: "*3 группы* метеоритов", kicker: "Ликбез", durationSec: 3.6 },
      { role: "FACT", text: "Каменные", kicker: "Тип 1", caption: "хондры — зёрна ранней Солнечной системы", durationSec: 3.5 },
      { role: "FACT", text: "Железные", kicker: "Тип 2", caption: "Fe + Ni, узор Видманштеттена", durationSec: 3.5, transition: "slide" },
      { role: "FACT", text: "Каменно-\nжелезные", kicker: "Тип 3", caption: "палласиты: металл + кристаллы оливина", durationSec: 3.5, transition: "slide" },
      { role: "CTA", text: "Какой\nближе тебе?", durationSec: 4.0 },
    ],
  },
  {
    id: "Reel-6-Sacred",
    title: "6. Алхимия и сакральность",
    items: [
      { role: "TITLE", text: "Священный *до науки*", kicker: "История", durationSec: 3.6 },
      { role: "STATEMENT", text: "Металл, что *не из земли* — а с неба", durationSec: 3.5 },
      { role: "TYPE", text: "Кинжал Тутанхамона выкован из метеорита", kicker: "Факт", caption: "задолго до железного века", durationSec: 5.0, transition: "slide" },
      { role: "STATEMENT", text: "Небо и земля в *одном* предмете", durationSec: 3.2, variant: "quote" },
      { role: "CTA", text: "Выбери\nсвой артефакт", durationSec: 4.0 },
    ],
  },
];
