import { useState } from "react";
import { createTransaction, fetchCategoryOptions, undoTransaction } from "@/entities/transaction";
import type { TransactionType } from "@/entities/transaction";
import { fetchSettings } from "@/entities/plan";
import { Card, ChipRow, Hint, Status } from "@/shared/ui";
import { CURRENCY_SIGN, formatMoney, type Currency } from "@/shared/lib/money";
import { parseAmount, useAction } from "@/shared/lib/useAction";
import { useAsync } from "@/shared/lib/useAsync";
import { isValidAmount, nextStep, previousStep, type Step } from "./steps";

const NEW_CATEGORY = "__new__";
const NO_CATEGORY = "__none__";
const ALL_CURRENCIES: Currency[] = ["GEL", "RUB", "USD"];

const TITLE: Record<TransactionType, string> = { expense: "Новый расход", income: "Новый доход" };

/**
 * Мастер добавления операции — те же шаги, что и в чате: валюта → категория → сумма →
 * проверка (сохранить / отмена, комментарий по желанию).
 */
export function AddTransaction({
  type,
  onClose,
}: {
  type: TransactionType;
  onClose: () => void;
}) {
  const settings = useAsync(fetchSettings);
  const categories = useAsync(() => fetchCategoryOptions(type));
  const [step, setStep] = useState<Step>("currency");
  const [currency, setCurrency] = useState<Currency>("GEL");
  const [choice, setChoice] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [savedId, setSavedId] = useState<number>();
  const save = useAction();
  const undo = useAction();

  const category = choice === NEW_CATEGORY ? newName.trim() : choice === NO_CATEGORY ? "" : choice;
  const value = parseAmount(amount);
  const sign = type === "expense" ? "−" : "+";

  if (savedId !== undefined) {
    return (
      <Card title="Готово">
        <p className="bignum bignum--ok">
          {sign}
          {formatMoney(value, currency)}
        </p>
        <p className="hint">
          {category ? `Категория: ${category}.` : "Без категории."} Операция записана.
        </p>
        <div className="stepper-nav">
          <button
            className="chip chip--soft"
            disabled={undo.busy}
            onClick={() =>
              undo.run(async () => {
                await undoTransaction(savedId);
                onClose();
              })
            }
          >
            ↩️ Отменить
          </button>
          <button className="primary" onClick={onClose}>
            Готово
          </button>
        </div>
        {undo.error && (
          <p className="hint" role="alert">
            {undo.error}
          </p>
        )}
      </Card>
    );
  }

  return (
    <>
      <ol className="dots" aria-label="Шаги">
        {(["currency", "category", "amount", "confirm"] as Step[]).map((s, i, all) => (
          <li
            key={s}
            className={s === step ? "is-active" : all.indexOf(step) > i ? "is-done" : ""}
            aria-current={s === step ? "step" : undefined}
          />
        ))}
      </ol>
      <h1>{TITLE[type]}</h1>

      {step === "currency" && (
        <>
          <Hint>В какой валюте вы заплатили? Основная валюта показана первой.</Hint>
          <Status state={settings}>
            {(s) => {
              const order = [s.displayCurrency, ...ALL_CURRENCIES.filter((c) => c !== s.displayCurrency)];
              return (
                <div className="segmented" role="radiogroup" aria-label="Валюта">
                  {order.map((c) => (
                    <button
                      key={c}
                      role="radio"
                      aria-checked={currency === c}
                      className={currency === c ? "is-active" : ""}
                      onClick={() => {
                        setCurrency(c);
                        setStep(nextStep("currency"));
                      }}
                    >
                      {CURRENCY_SIGN[c]} {c}
                    </button>
                  ))}
                </div>
              );
            }}
          </Status>
        </>
      )}

      {step === "category" && (
        <>
          <Hint example="Еда, Транспорт, Кофе">Выберите категорию или добавьте свою.</Hint>
          <Status state={categories}>
            {(c) => (
              <>
                <ChipRow
                  label="Категории"
                  options={c.categories}
                  onPick={(name) => {
                    setChoice(name);
                    setStep(nextStep("category"));
                  }}
                />
                {c.categories.length === 0 && <p className="hint">Категорий пока нет — добавьте первую.</p>}
              </>
            )}
          </Status>
          <div className="stepper-nav">
            <button className="chip chip--soft" onClick={() => setChoice(NEW_CATEGORY)}>
              ➕ Добавить категорию
            </button>
            <button
              className="chip chip--soft"
              onClick={() => {
                setChoice(NO_CATEGORY);
                setStep(nextStep("category"));
              }}
            >
              Без категории
            </button>
          </div>
          {choice === NEW_CATEGORY && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim()) setStep(nextStep("category"));
              }}
            >
              <input
                aria-label="Название новой категории"
                placeholder="Название новой категории"
                value={newName}
                maxLength={60}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="submit" disabled={!newName.trim()}>
                Далее
              </button>
            </form>
          )}
        </>
      )}

      {step === "amount" && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (isValidAmount(value)) setStep(nextStep("amount"));
          }}
        >
          <Hint>
            {category ? `Категория: ${category}. ` : "Без категории. "}Введите сумму числом.
          </Hint>
          <input
            aria-label={`Сумма, ${currency}`}
            placeholder={`Сумма, ${CURRENCY_SIGN[currency]}`}
            inputMode="decimal"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
          />
          <button type="submit" disabled={!isValidAmount(value)}>
            Далее
          </button>
        </form>
      )}

      {step === "confirm" && (
        <Card title="Проверьте операцию">
          <p className="bignum">
            {sign}
            {formatMoney(value, currency)}
          </p>
          <div className="row">
            <span>Категория</span>
            <b>{category || "—"}</b>
          </div>
          <div className="row">
            <span>Комментарий</span>
            <b>{note.trim() || "—"}</b>
          </div>
          {showNote ? (
            <input
              aria-label="Комментарий (необязательно)"
              placeholder="Комментарий (необязательно)"
              value={note}
              maxLength={200}
              autoFocus
              onChange={(e) => setNote(e.target.value)}
            />
          ) : (
            <button className="link" onClick={() => setShowNote(true)}>
              💬 {note.trim() ? "Изменить комментарий" : "Добавить комментарий"}
            </button>
          )}
          <div className="stepper-nav">
            <button className="chip chip--soft" disabled={save.busy} onClick={onClose}>
              ❌ Отмена
            </button>
            <button
              className="primary"
              disabled={save.busy || !isValidAmount(value)}
              onClick={() =>
                save.run(async () => {
                  const created = await createTransaction({
                    type,
                    amount: value,
                    currency,
                    category: category || null,
                    note: note.trim() || null,
                  });
                  setSavedId(created.id);
                })
              }
            >
              ✅ Сохранить
            </button>
          </div>
          {save.error && (
            <p className="hint" role="alert">
              {save.error}
            </p>
          )}
        </Card>
      )}

      <div className="stepper-nav">
        {step !== "currency" && (
          <button className="chip chip--soft" onClick={() => setStep(previousStep(step))}>
            Назад
          </button>
        )}
        {step !== "confirm" && (
          <button className="link" onClick={onClose}>
            Отмена
          </button>
        )}
      </div>
    </>
  );
}
