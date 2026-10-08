import { useState } from "react";
import { deleteCategory, fetchCategories, fetchCategoryUsage } from "@/entities/budget";
import type { CategoryUsage } from "@/entities/budget";
import { useAction } from "@/shared/lib/useAction";

const NEW = "__new__";

interface Plan {
  usage: CategoryUsage;
  others: string[];
}

function plural(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "операция";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "операции";
  return "операций";
}

/**
 * Удаление категории. Если в ней есть операции, приложение спрашивает, куда их перенести:
 * в существующую категорию или в новую. Лимиты тоже переезжают (суммируются с лимитом цели).
 */
export function DeleteCategory({ category, onDone }: { category: string; onDone: () => void }) {
  const [plan, setPlan] = useState<Plan>();
  const [choice, setChoice] = useState("");
  const [newName, setNewName] = useState("");
  const load = useAction();
  const remove = useAction(onDone);

  async function open() {
    await load.run(async () => {
      const [usage, all] = await Promise.all([fetchCategoryUsage(category), fetchCategories()]);
      const others = all.categories.filter((c) => c !== category);
      setPlan({ usage, others });
      setChoice(others[0] ?? NEW);
    });
  }

  const trash = (
    <button
      className="trash"
      aria-label={`Удалить категорию «${category}»`}
      title="Удалить категорию"
      disabled={load.busy || plan !== undefined}
      onClick={open}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M6 6l1 14h10l1-14" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );

  if (!plan) {
    return (
      <>
        {trash}
        {load.error && (
          <small className="hint" role="alert">
            {load.error}
          </small>
        )}
      </>
    );
  }

  const hasOps = plan.usage.transactions > 0;
  const target = choice === NEW ? newName.trim() : choice;
  const canConfirm = !hasOps || target.length > 0;

  return (
    <>
      {trash}
      <div className="delete-panel" role="group" aria-label={`Удаление категории ${category}`}>
      {hasOps ? (
        <>
          <p>
            В «{category}» {plan.usage.transactions} {plural(plan.usage.transactions)}. Куда их перенести? Лимиты
            категории тоже перейдут туда.
          </p>
          <label htmlFor={`move-${category}`} className="hint">
            Перенести в
          </label>
          <select id={`move-${category}`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            {plan.others.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW}>➕ Новая категория…</option>
          </select>
          {choice === NEW && (
            <input
              aria-label="Название новой категории"
              placeholder="Название новой категории"
              value={newName}
              maxLength={60}
              onChange={(e) => setNewName(e.target.value)}
            />
          )}
        </>
      ) : (
        <p>В «{category}» нет операций. Удалить категорию{plan.usage.budgetMonths > 0 ? " вместе с её лимитами" : ""}?</p>
      )}
      <div className="limit-controls">
        <button
          className="chip"
          disabled={remove.busy || !canConfirm}
          onClick={() => remove.run(() => deleteCategory(category, hasOps ? target : undefined))}
        >
          {hasOps ? "Перенести и удалить" : "Удалить"}
        </button>
        <button className="chip chip--soft" disabled={remove.busy} onClick={() => setPlan(undefined)}>
          Отмена
        </button>
      </div>
      {remove.error && (
        <small className="hint" role="alert">
          {remove.error}
        </small>
      )}
      </div>
    </>
  );
}
