import { useCallback, useState } from "react";
import { OnboardingStepper } from "@/widgets/onboarding-stepper";
import { CurrencyStep } from "@/features/choose-currency";
import { IncomeStep } from "@/features/income-step";
import { ExpenseStep } from "@/features/expense-step";
import { GoalTemplatesStep } from "@/features/goal-templates-step";
import { BudgetTemplatesStep } from "@/features/budget-templates-step";
import { TodayCard, completeOnboarding, fetchPlan, fetchSettings, fetchSummary } from "@/entities/plan";
import { Hint, Status } from "@/shared/ui";
import { useAction } from "@/shared/lib/useAction";
import { useAsync } from "@/shared/lib/useAsync";
import { useBackButton } from "@/shared/lib/useBackButton";

const TITLES = ["Добро пожаловать", "Валюта", "Доходы", "Обязательные расходы", "Ваш план на месяц", "Цели", "Бюджет"];

/** Первый вход: семь коротких шагов; каждый можно пропустить, данные потом правятся на вкладках. */
export function OnboardingPage({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const settings = useAsync(fetchSettings);
  const plan = useAsync(fetchPlan);
  const summary = useAsync(fetchSummary);
  const finish = useAction(onFinish);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);
  useBackButton(step > 0, back);

  const refresh = () => {
    settings.reload();
    plan.reload();
    summary.reload();
  };
  const last = step === TITLES.length - 1;
  const done = () => finish.run(completeOnboarding);

  return (
    <OnboardingStepper
      step={step}
      total={TITLES.length}
      title={TITLES[step]}
      nextLabel={last ? "Готово" : step === 0 ? "Начать" : "Далее"}
      onBack={step > 0 ? back : undefined}
      onNext={last ? done : () => setStep(step + 1)}
      onSkip={done}
      busy={finish.busy}
    >
      {step === 0 && (
        <>
          <Hint>
            За пару минут мы посчитаем главное: сколько можно тратить каждый день. Нужно указать валюту, доходы и
            обязательные платежи. Всё можно изменить позже.
          </Hint>
          <ul className="steps-list">
            <li>1. Выберем валюту</li>
            <li>2. Запишем доходы</li>
            <li>3. Запишем обязательные расходы</li>
            <li>4. Покажем, сколько свободно в день</li>
          </ul>
        </>
      )}
      {step === 1 && <Status state={settings}>{(s) => <CurrencyStep settings={s} onChanged={refresh} />}</Status>}
      {step === 2 && <Status state={plan}>{(p) => <IncomeStep plan={p} onChanged={refresh} />}</Status>}
      {step === 3 && <Status state={plan}>{(p) => <ExpenseStep plan={p} onChanged={refresh} />}</Status>}
      {step === 4 && (
        <>
          <Status state={summary}>{(s) => <TodayCard s={s} />}</Status>
          <Hint>
            Это оценка: чем точнее доходы и обязательные платежи, тем точнее число. Дальше — цели и бюджет по
            категориям: оба шага можно пропустить.
          </Hint>
        </>
      )}
      {step === 5 && <Status state={summary}>{(s) => <GoalTemplatesStep summary={s} />}</Status>}
      {step === 6 && <Status state={summary}>{(s) => <BudgetTemplatesStep summary={s} />}</Status>}
      {finish.error && (
        <p className="hint" role="alert">
          {finish.error}
        </p>
      )}
    </OnboardingStepper>
  );
}
