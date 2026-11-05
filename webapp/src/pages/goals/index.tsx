import { useState } from "react";
import { Segmented } from "@/shared/ui";
import { Debts } from "./ui/Debts";
import { Savings } from "./ui/Savings";

type View = "save" | "repay";

/** Вкладка «Цели»: накопления (подушка и цели) и погашение долгов. */
export function GoalsPage() {
  const [view, setView] = useState<View>("save");
  return (
    <>
      <h1>Цели</h1>
      <Segmented
        label="Раздел целей"
        options={[
          { id: "save", label: "Копить" },
          { id: "repay", label: "Гасить долги" },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "save" ? <Savings /> : <Debts />}
    </>
  );
}
