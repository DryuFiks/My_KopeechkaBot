import { useCallback, useState } from "react";
import { TabBar, type TabId } from "@/widgets/tab-bar";
import { OverviewPage } from "@/pages/overview";
import { BudgetPage } from "@/pages/budget";
import { GoalsPage } from "@/pages/goals";
import { OnboardingPage } from "@/pages/onboarding";
import { ProfilePage } from "@/pages/profile";
import { AddExpensePage, AddIncomePage } from "@/pages/add-expense";
import { ProgressToasts } from "@/widgets/progress-toasts";
import { QuickAdd, type QuickAddPreset } from "@/features/quick-add";
import { fetchSettings } from "@/entities/plan";
import { undoTransaction } from "@/entities/transaction";
import { ActionToast, Status } from "@/shared/ui";
import { useAsync } from "@/shared/lib/useAsync";
import { useBackButton } from "@/shared/lib/useBackButton";
import { haptic } from "@/shared/lib/telegram";
import { ErrorBoundary } from "./ErrorBoundary";

type PageProps = {
  go: (tab: TabId) => void;
  quickAdd: (preset?: QuickAddPreset) => void;
  restartOnboarding: () => void;
};

const PAGES: Record<TabId, (props: PageProps) => JSX.Element> = {
  overview: OverviewPage,
  budget: BudgetPage,
  goals: GoalsPage,
  profile: ProfilePage,
  "add-expense": AddExpensePage,
  "add-income": AddIncomePage,
};

function Tabs({ restartOnboarding }: { restartOnboarding: () => void }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [sheet, setSheet] = useState<QuickAddPreset | null>(null);
  const [saved, setSaved] = useState<{ id: number; text: string } | null>(null);
  // Смена ключа перерисовывает текущую вкладку со свежими данными после записи или отмены.
  const [refresh, setRefresh] = useState(0);
  const goHome = useCallback(() => setTab("overview"), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const hideSaved = useCallback(() => setSaved(null), []);
  // «Назад» в шапке Telegram закрывает шторку, иначе возвращает на главную из любой другой вкладки.
  useBackButton(sheet !== null || tab !== "overview", sheet !== null ? closeSheet : goHome);

  const quickAdd = (preset: QuickAddPreset = { type: "expense" }) => {
    haptic("tap");
    setSheet(preset);
  };
  const Page = PAGES[tab];
  return (
    <>
      <main className="page">
        <Page key={`${tab}:${refresh}`} go={setTab} quickAdd={quickAdd} restartOnboarding={restartOnboarding} />
      </main>
      <TabBar
        active={tab}
        onChange={(id) => {
          haptic("tap");
          setTab(id);
        }}
        onAdd={() => quickAdd()}
      />
      {sheet && (
        <QuickAdd
          preset={sheet}
          onClose={closeSheet}
          onSaved={(id, text) => {
            setSheet(null);
            setSaved({ id, text });
            setRefresh((r) => r + 1);
          }}
          onStepwise={(type) => {
            setSheet(null);
            setTab(type === "income" ? "add-income" : "add-expense");
          }}
        />
      )}
      {saved && (
        <ActionToast
          key={saved.id}
          text={saved.text}
          actionLabel="Отменить"
          onDone={hideSaved}
          onAction={() => {
            setSaved(null);
            void undoTransaction(saved.id).finally(() => setRefresh((r) => r + 1));
          }}
        />
      )}
    </>
  );
}

export function App() {
  const settings = useAsync(fetchSettings);
  return (
    <ErrorBoundary>
      <ProgressToasts />
      <Status state={settings}>
        {(s) =>
          s.onboarded ? (
            <Tabs restartOnboarding={settings.reload} />
          ) : (
            <OnboardingPage onFinish={settings.reload} />
          )
        }
      </Status>
    </ErrorBoundary>
  );
}
