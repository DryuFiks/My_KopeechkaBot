import { useEffect } from "react";

/** Сообщение внизу экрана с одним действием (например, «Отменить»); само исчезает через `ms`. */
export function ActionToast({
  text,
  actionLabel,
  onAction,
  onDone,
  ms = 5000,
}: {
  text: string;
  actionLabel: string;
  onAction: () => void;
  onDone: () => void;
  ms?: number;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [onDone, ms]);

  return (
    <div className="action-toast" role="status" aria-live="polite">
      <span>{text}</span>
      <button className="link" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
