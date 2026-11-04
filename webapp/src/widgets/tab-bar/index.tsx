import { Icon, type IconName } from "@/shared/ui";

export type TabId =
  "overview" | "history" | "limits" | "debts" | "goals" | "profile" | "add-expense" | "add-income";

/** Вкладки в нижней панели; добавление операций открывается кнопками с «Обзора» и в панели не показывается. */

const TABS: { id: Exclude<TabId, "add-expense" | "add-income">; label: string; icon: IconName }[] = [
  { id: "overview", label: "Обзор", icon: "home" },
  { id: "history", label: "Бюджет", icon: "chart" },
  { id: "limits", label: "Лимиты", icon: "sliders" },
  { id: "debts", label: "Долги", icon: "card" },
  { id: "goals", label: "Цели", icon: "target" },
  { id: "profile", label: "Профиль", icon: "user" },
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
          <Icon name={t.icon} size={24} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}
