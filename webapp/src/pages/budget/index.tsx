import { useState } from "react";
import { MonthLimits } from "@/widgets/month-limits";
import { Segmented } from "@/shared/ui";
import { MonthHistory } from "./ui/MonthHistory";
import { Payments } from "./ui/Payments";

type View = "spending" | "limits" | "payments";

/** Вкладка «Бюджет»: траты по месяцам, лимиты с прогнозом и регулярные платежи. */
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
          { id: "payments", label: "Платежи" },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "spending" && <MonthHistory />}
      {view === "limits" && <MonthLimits onChanged={() => undefined} />}
      {view === "payments" && <Payments />}
    </>
  );
}
