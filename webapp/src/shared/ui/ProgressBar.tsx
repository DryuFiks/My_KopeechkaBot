export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress__fill" style={{ width: `${value}%` }} />
      {label && <span className="progress__label">{label}</span>}
    </div>
  );
}
