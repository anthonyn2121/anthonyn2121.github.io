import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/b612/400.css";
import "@fontsource/b612/700.css";
import "@fontsource/b612-mono/400.css";
import "@fontsource/b612-mono/700.css";
import "./styles/base.css";
import "./styles/sections.css";
import "./styles/carrier.css";
import { CarrierApp } from "./carrier/CarrierApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CarrierApp />
  </StrictMode>,
);
