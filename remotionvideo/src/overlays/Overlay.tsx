import { Title } from "./Title";
import { Fact } from "./Fact";
import { Key } from "./Key";
import { Cta } from "./Cta";
import { Type } from "./Type";
import type { OverlayItem } from "./types";

/** Диспетчер: по роли выбирает сцену. */
export const Overlay = ({ item }: { item: OverlayItem }) => {
  switch (item.role) {
    case "TITLE":
      return <Title item={item} />;
    case "FACT":
      return <Fact item={item} />;
    case "KEY":
      return <Key item={item} />;
    case "TYPE":
      return <Type item={item} />;
    case "CTA":
      return <Cta item={item} />;
  }
};
