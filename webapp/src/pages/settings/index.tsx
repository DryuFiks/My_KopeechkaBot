import { CurrencyStep } from "@/features/choose-currency";
import { fetchSettings, resetOnboarding } from "@/entities/plan";
import { Card, Hint, Status } from "@/shared/ui";
import { useAction } from "@/shared/lib/useAction";
import { useAsync } from "@/shared/lib/useAsync";

/** Настройки: валюта, обменный коэффициент и повторный запуск мастера первого входа. */
export function SettingsPage({ restartOnboarding }: { restartOnboarding: () => void }) {
  const settings = useAsync(fetchSettings);
  const restart = useAction(restartOnboarding);
  return (
    <>
      <h1>Настройки</h1>
      <Card title="Валюта и курс">
        <Status state={settings}>{(s) => <CurrencyStep settings={s} onChanged={settings.reload} />}</Status>
      </Card>
      <Card title="Первый вход">
        <Hint>
          Мастер снова проведёт по шагам: валюта, доходы, обязательные расходы, цели и бюджет. Уже введённые данные
          не удаляются — вы увидите их и сможете поправить.
        </Hint>
        <button className="primary" disabled={restart.busy} onClick={() => restart.run(resetOnboarding)}>
          Пройти онбординг заново
        </button>
        {restart.error && (
          <p className="hint" role="alert">
            {restart.error}
          </p>
        )}
      </Card>
    </>
  );
}
