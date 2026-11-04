import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTelegram } from "@/shared/lib/telegram";
import { sendBeacon } from "@/shared/api/client";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/budget.css";
import "./styles/onboarding.css";
import "./styles/a11y.css";

initTelegram();
sendBeacon("/app-open");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
