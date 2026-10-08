import { useEffect } from "react";
import { getWebApp } from "./telegram";

/** Показывает нативную кнопку «Назад» Telegram, пока visible=true; клик вызывает onBack. */
export function useBackButton(visible: boolean, onBack: () => void): void {
  useEffect(() => {
    const button = getWebApp()?.BackButton;
    if (!button) return;
    if (!visible) {
      button.hide();
      return;
    }
    button.show();
    button.onClick(onBack);
    return () => button.offClick(onBack);
  }, [visible, onBack]);
}
