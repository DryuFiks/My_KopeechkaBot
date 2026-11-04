import { useState } from "react";
import { MonthLimits } from "@/widgets/month-limits";
import { Segmented } from "@/shared/ui";
import { MonthHistory } from "./ui/MonthHistory";

type View = "spending" | "limits";

/** Вкладка «Бюджет»: траты по месяцам и лимиты с прогнозом текущего месяца. */
export function BudgetPage() {
  const [view, setView] = useState<View>("spending");
  return (
    <>
      <h1>Бюджет</h1>
      <Segmented
        label="Раздел бюджета"
        options={[
          { id: "spending", label: "Траты" },
          { id: "limits", label: "Лимиты" },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "spending" ? <MonthHistory /> : <MonthLimits onChanged={() => undefined} />}
    </>
  );
}
