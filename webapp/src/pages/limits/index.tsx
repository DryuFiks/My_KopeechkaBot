import { MonthLimits } from "@/widgets/month-limits";

/** Лимиты и прогноз текущего месяца — отдельная вкладка. */
export function LimitsPage() {
  return (
    <>
      <h1>Лимиты и прогноз</h1>
      <MonthLimits onChanged={() => undefined} />
    </>
  );
}
