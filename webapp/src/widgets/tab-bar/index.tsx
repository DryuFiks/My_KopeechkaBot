export type TabId =
  "overview" | "history" | "limits" | "debts" | "goals" | "profile" | "add-expense" | "add-income";

/** Вкладки в нижней панели; добавление операций открывается кнопками с «Обзора» и в панели не показывается. */

const TABS: { id: Exclude<TabId, "add-expense" | "add-income">; label: string }[] = [
  { id: "overview", label: "🏠 Обзор" },
  { id: "history", label: "📊 Бюджет" },
  { id: "limits", label: "🎚 Лимиты" },
  { id: "debts", label: "💳 Долги" },
  { id: "goals", label: "🎯 Цели" },
  { id: "profile", label: "👤 Профиль" },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Разделы">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={t.id === active ? "is-active" : ""}
          aria-current={t.id === active ? "page" : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
