import { useState } from "react";
import { api } from "@/shared/api/client";
import { CollapsibleCard, Hint } from "@/shared/ui";
import { useAction } from "@/shared/lib/useAction";

const MAX = 1000;

/** «Написать разработчику»: текст уходит администратору в Telegram (MKB-047). */
export function SendFeedback() {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const { error, busy, run } = useAction(() => {
    setText("");
    setSent(true);
  });
  const trimmed = text.trim();

  return (
    <CollapsibleCard title="Написать разработчику">
      <Hint>Идея, ошибка или что-то неудобно — напишите как есть. Сообщение сразу увидит разработчик.</Hint>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) void run(() => api.post("/feedback", { text: trimmed }));
        }}
      >
        <textarea
          aria-label="Сообщение разработчику"
          rows={4}
          maxLength={MAX}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSent(false);
          }}
        />
        <small>
          {text.length} / {MAX}
        </small>
        <button type="submit" disabled={busy || !trimmed}>
          Отправить
        </button>
      </form>
      {sent && (
        <p className="hint" role="status">
          Спасибо! Сообщение отправлено.
        </p>
      )}
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
    </CollapsibleCard>
  );
}
