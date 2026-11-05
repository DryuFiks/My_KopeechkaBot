import { Icon, type IconName } from "@/shared/ui";

export type TabId = "overview" | "budget" | "goals" | "profile" | "add-expense" | "add-income";

type NavTab = { id: Exclude<TabId, "add-expense" | "add-income">; label: string; icon: IconName };

const LEFT: NavTab[] = [
  { id: "overview", label: "Главная", icon: "home" },
  { id: "budget", label: "Бюджет", icon: "chart" },
];
const RIGHT: NavTab[] = [
  { id: "goals", label: "Цели", icon: "target" },
  { id: "profile", label: "Профиль", icon: "user" },
];

/** Нижняя панель (MKB-050): 4 раздела и круглая «＋» по центру — добавить операцию. */
export function TabBar({
  active,
  onChange,
  onAdd,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  onAdd: () => void;
}) {
  const tab = (t: NavTab) => (
    <button
      key={t.id}
      className={t.id === active ? "is-active" : ""}
      aria-current={t.id === active ? "page" : undefined}
      onClick={() => onChange(t.id)}
    >
      <Icon name={t.icon} size={24} />
      {t.label}
    </button>
  );
  return (
    <nav className="tabbar" aria-label="Разделы">
      {LEFT.map(tab)}
      <button className="tabbar__add" aria-label="Добавить операцию" onClick={onAdd}>
        <Icon name="plus" size={28} />
      </button>
      {RIGHT.map(tab)}
    </nav>
  );
}
