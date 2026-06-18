import { Img, staticFile } from "remotion";
import { Appear, Centered } from "./kit";

/** Финальная заставка: фирменный логотип на светлой карточке (поверх общего фона). */
export const Endcard = () => (
  <Centered>
    <Appear delay={6} from="scale">
      <div
        style={{
          width: 800,
          background: "#F7F8FA",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 30px 90px rgba(0, 0, 0, 0.5)",
        }}
      >
        <Img src={staticFile("brand/logo.png")} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
    </Appear>
  </Centered>
);
