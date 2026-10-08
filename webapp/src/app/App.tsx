import { useState } from "react";
import { TabBar, type TabId } from "@/widgets/tab-bar";
import { OverviewPage } from "@/pages/overview";
import { BudgetPage } from "@/pages/budget";
import { DebtsPage } from "@/pages/debts";
import { CushionPage } from "@/pages/cushion";
import { GoalsPage } from "@/pages/goals";

const PAGES: Record<TabId, () => JSX.Element> = {
  overview: OverviewPage,
  budget: BudgetPage,
  debts: DebtsPage,
  cushion: CushionPage,
  goals: GoalsPage,
};

export function App() {
  const [tab, setTab] = useState<TabId>("overview");
  const Page = PAGES[tab];
  return (
    <>
      <main className="page">
        <Page />
      </main>
      <TabBar active={tab} onChange={setTab} />
    </>
  );
}
