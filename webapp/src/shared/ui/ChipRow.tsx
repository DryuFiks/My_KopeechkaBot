/** Быстрые варианты: нажал — значение подставилось. */
export function ChipRow({ options, onPick, label }: { options: string[]; onPick: (value: string) => void; label: string }) {
  return (
    <div className="chiprow" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className="chip chip--soft" onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
