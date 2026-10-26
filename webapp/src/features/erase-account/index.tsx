import { useState } from "react";
import { eraseAccount } from "@/entities/plan";
import { Card, Hint } from "@/shared/ui";
import { useAction } from "@/shared/lib/useAction";

const CONFIRM_WORD = "УДАЛИТЬ";

/** Полное стирание данных пользователя; подтверждение — ввод слова, чтобы не нажать случайно. */
export function EraseAccount({ onErased }: { onErased: () => void }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const { error, busy, run } = useAction(onErased);

  return (
    <Card title="Стереть все данные">
      <Hint>
        Удалятся операции, категории, лимиты, цели, долги, доходы, расходы, настройки и награды. Вернуть их
        будет нельзя. После этого приложение откроется как при первом входе.
      </Hint>
      {!open ? (
        <button className="chip" onClick={() => setOpen(true)}>
          Стереть всё и начать заново
        </button>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (word.trim().toUpperCase() === CONFIRM_WORD) void run(eraseAccount);
          }}
        >
          <input
            aria-label={`Для подтверждения введите ${CONFIRM_WORD}`}
            placeholder={`Введите ${CONFIRM_WORD}`}
            value={word}
            autoFocus
            onChange={(e) => setWord(e.target.value)}
          />
          <button type="submit" disabled={busy || word.trim().toUpperCase() !== CONFIRM_WORD}>
            Стереть безвозвратно
          </button>
          <button type="button" className="link" disabled={busy} onClick={() => setOpen(false)}>
            Отмена
          </button>
        </form>
      )}
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
