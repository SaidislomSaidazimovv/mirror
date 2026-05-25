import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// v02 §2 stack #12 — self-hosted JetBrains Mono via @fontsource so
// the browser never hits Google Fonts for the data face. Noto Sans
// SC and Switzer stay on CDN: Noto's chinese-simplified subset is
// ~1 MB per weight at npm package level — Google Fonts auto-subsets
// it to the handful of hanzi we actually render, which is the
// faster path. Spec §5.3 explicitly permits "CDN options also work".
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";

import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
