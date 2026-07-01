import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted fonts (bundled by Vite) so the game looks identical offline / as an installed PWA.
// Latin subset only — keeps the precache small.
import "@fontsource/pirata-one/latin-400.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-600.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import { App } from "./ui/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
