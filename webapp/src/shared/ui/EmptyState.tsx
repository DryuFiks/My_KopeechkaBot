import { Icon, type IconName } from "./Icon";

/** Пустой экран или список: одна фраза и, если есть, одно действие (MKB-054). */
export function EmptyState({
  icon,
  text,
  action,
}: {
  icon: IconName;
  text: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={28} />
      </span>
      <p>{text}</p>
      {action && (
        <button className="chip" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
