import type { ReactNode } from "react";

/** Карточка, свёрнутая до одной строки; `note` — короткая подпись справа (например, текущее значение). */
export function CollapsibleCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <details className="card collapsible">
      <summary>
        <span>{title}</span>
        {note && <span className="collapsible__note">{note}</span>}
      </summary>
      <div className="collapsible__body">{children}</div>
    </details>
  );
}
