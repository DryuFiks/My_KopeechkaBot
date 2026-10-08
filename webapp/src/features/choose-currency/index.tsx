import { updateSettings } from "@/entities/plan";
import type { Settings } from "@/entities/plan";
import { Hint } from "@/shared/ui";
import type { Currency } from "@/shared/lib/money";
import { useAction } from "@/shared/lib/useAction";

const CURRENCIES: { code: Currency; label: string }[] = [
  { code: "GEL", label: "₾ Лари" },
  { code: "RUB", label: "₽ Рубли" },
  { code: "USD", label: "$ Доллары" },
];
const FACTORS = [1, 0.95, 0.9, 0.85];

/** Шаг 1: основная валюта и «обменный» коэффициент курса. */
export function CurrencyStep({ settings, onChanged }: { settings: Settings; onChanged: () => void }) {
  const { error, busy, run } = useAction(onChanged);
  return (
    <>
      <Hint example="вы живёте в Грузии и тратите в лари — выберите ₾, даже если доход приходит в рублях">
        Основная валюта — в ней показываются суммы. Доходы можно вводить в любой валюте, мы пересчитаем.
      </Hint>
      <div className="segmented" role="radiogroup" aria-label="Основная валюта">
        {CURRENCIES.map((c) => (
          <button
            key={c.code}
            role="radio"
            aria-checked={settings.displayCurrency === c.code}
            className={settings.displayCurrency === c.code ? "is-active" : ""}
            disabled={busy}
            onClick={() => run(() => updateSettings({ displayCurrency: c.code }))}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Hint example="официальный курс 31 ₽ за ₾, обменник даёт на 10% меньше — ставим ×0,9">
        В обменнике курс хуже официального. Коэффициент уменьшает, сколько лари вы получаете за рубли и доллары.
      </Hint>
      <div className="segmented" role="radiogroup" aria-label="Коэффициент обменника">
        {FACTORS.map((f) => (
          <button
            key={f}
            role="radio"
            aria-checked={settings.exchangeFactor === f}
            className={settings.exchangeFactor === f ? "is-active" : ""}
            disabled={busy}
            onClick={() => run(() => updateSettings({ exchangeFactor: f }))}
          >
            {f === 1 ? "Официальный" : `×${String(f).replace(".", ",")}`}
          </button>
        ))}
      </div>
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
