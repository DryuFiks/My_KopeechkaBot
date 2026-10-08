import type { ReactNode } from "react";

interface Props {
  step: number;
  total: number;
  title: string;
  children: ReactNode;
  nextLabel?: string;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
  busy?: boolean;
}

/** Каркас шага онбординга: прогресс-точки, заголовок, содержимое и навигация. */
export function OnboardingStepper({ step, total, title, children, nextLabel = "Далее", onBack, onNext, onSkip, busy }: Props) {
  return (
    <main className="page">
      <ol className="dots" aria-label={`Шаг ${step + 1} из ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className={i === step ? "is-active" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined} />
        ))}
      </ol>
      <h1>{title}</h1>
      {children}
      <div className="stepper-nav">
        {onBack && (
          <button className="chip chip--soft" onClick={onBack} disabled={busy}>
            Назад
          </button>
        )}
        <button className="primary" onClick={onNext} disabled={busy}>
          {nextLabel}
        </button>
      </div>
      <button className="link center" onClick={onSkip} disabled={busy}>
        Пропустить, заполню позже
      </button>
    </main>
  );
}
