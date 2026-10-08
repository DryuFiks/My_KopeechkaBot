export type TabId = "overview" | "budget" | "debts" | "cushion" | "goals";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "🏠 Обзор" },
  { id: "budget", label: "📊 Бюджет" },
  { id: "debts", label: "💳 Долги" },
  { id: "cushion", label: "🛟 Подушка" },
  { id: "goals", label: "🎯 Цели" },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.id} className={t.id === active ? "is-active" : ""} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
