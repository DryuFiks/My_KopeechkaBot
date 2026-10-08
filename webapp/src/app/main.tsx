import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initTelegram } from "@/shared/lib/telegram";
import { App } from "./App";
import "./styles/global.css";
import "./styles/budget.css";

initTelegram();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
