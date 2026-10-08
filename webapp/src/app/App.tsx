import { useCallback, useState } from "react";
import { TabBar, type TabId } from "@/widgets/tab-bar";
import { OverviewPage } from "@/pages/overview";
import { BudgetPage } from "@/pages/budget";
import { DebtsPage } from "@/pages/debts";
import { CushionPage } from "@/pages/cushion";
import { GoalsPage } from "@/pages/goals";
import { OnboardingPage } from "@/pages/onboarding";
import { fetchSettings } from "@/entities/plan";
import { Status } from "@/shared/ui";
import { useAsync } from "@/shared/lib/useAsync";
import { useBackButton } from "@/shared/lib/useBackButton";
import { haptic } from "@/shared/lib/telegram";
import { ErrorBoundary } from "./ErrorBoundary";

const PAGES: Record<TabId, () => JSX.Element> = {
  overview: OverviewPage,
  budget: BudgetPage,
  debts: DebtsPage,
  cushion: CushionPage,
  goals: GoalsPage,
};

function Tabs() {
  const [tab, setTab] = useState<TabId>("overview");
  const goHome = useCallback(() => setTab("overview"), []);
  // «Назад» в шапке Telegram возвращает на обзор из любой другой вкладки.
  useBackButton(tab !== "overview", goHome);

  const Page = PAGES[tab];
  return (
    <>
      <main className="page">
        <Page key={tab} />
      </main>
      <TabBar
        active={tab}
        onChange={(id) => {
          haptic("tap");
          setTab(id);
        }}
      />
    </>
  );
}

export function App() {
  const settings = useAsync(fetchSettings);
  return (
    <ErrorBoundary>
      <Status state={settings}>
        {(s) => (s.onboarded ? <Tabs /> : <OnboardingPage onFinish={settings.reload} />)}
      </Status>
    </ErrorBoundary>
  );
}
