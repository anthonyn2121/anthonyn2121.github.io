import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/b612/400.css";
import "@fontsource/b612/700.css";
import "@fontsource/b612-mono/400.css";
import "@fontsource/b612-mono/700.css";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/eb-garamond/600.css";
import "../styles/base.css";
import "../styles/skies.css";
import { takePitchUp } from "../lib/pages";
import { SkiesApp } from "./SkiesApp";

// Read once, outside React, so StrictMode's double render can't consume the flag twice.
const pitchUp = takePitchUp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SkiesApp pitchUp={pitchUp} />
  </StrictMode>,
);
