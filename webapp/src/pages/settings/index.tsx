import { CurrencyStep } from "@/features/choose-currency";
import { EraseAccount } from "@/features/erase-account";
import { IncomeStep } from "@/features/income-step";
import { ExpenseStep } from "@/features/expense-step";
import { ReminderSettings } from "@/features/reminder-settings";
import { fetchPlan, fetchSettings, resetOnboarding } from "@/entities/plan";
import { CollapsibleCard, Hint, Status } from "@/shared/ui";
import { useAction } from "@/shared/lib/useAction";
import { useAsync } from "@/shared/lib/useAsync";

/** Настройки: валюта, обменный коэффициент и повторный запуск мастера первого входа. */
export function SettingsPage({ restartOnboarding }: { restartOnboarding: () => void }) {
  const settings = useAsync(fetchSettings);
  const plan = useAsync(fetchPlan);
  const restart = useAction(restartOnboarding);
  const s = settings.data;
  const currencyNote = s
    ? s.exchangeFactor === 1
      ? s.displayCurrency
      : `${s.displayCurrency} · ×${s.exchangeFactor}`
    : undefined;
  return (
    <>
      <h2>Настройки</h2>
      <CollapsibleCard title="Валюта и курс" note={currencyNote}>
        <Status state={settings}>{(s) => <CurrencyStep settings={s} onChanged={settings.reload} />}</Status>
      </CollapsibleCard>
      <CollapsibleCard
        title="Напоминания"
        note={s ? [s.remindEvening && `вечером в ${s.remindHour}:00`, s.weeklyDigest && "итоги недели"].filter(Boolean).join(", ") || "выключены" : undefined}
      >
        <Status state={settings}>{(s) => <ReminderSettings settings={s} onChanged={settings.reload} />}</Status>
      </CollapsibleCard>
      <CollapsibleCard title="Доходы" note={plan.data ? String(plan.data.incomes.length) : undefined}>
        <Status state={plan}>{(p) => <IncomeStep plan={p} onChanged={plan.reload} />}</Status>
      </CollapsibleCard>
      <CollapsibleCard
        title="Обязательные расходы"
        note={plan.data ? String(plan.data.expenses.length) : undefined}
      >
        <Status state={plan}>{(p) => <ExpenseStep plan={p} onChanged={plan.reload} />}</Status>
      </CollapsibleCard>
      <CollapsibleCard title="Первый вход">
        <Hint>
          Мастер снова проведёт по шагам: валюта, доходы, обязательные расходы, цели и бюджет. Уже введённые
          данные не удаляются — вы увидите их и сможете поправить.
        </Hint>
        <button className="primary" disabled={restart.busy} onClick={() => restart.run(resetOnboarding)}>
          Пройти онбординг заново
        </button>
        {restart.error && (
          <p className="hint" role="alert">
            {restart.error}
          </p>
        )}
      </CollapsibleCard>
      <EraseAccount onErased={restartOnboarding} />
    </>
  );
}
