import type { Strategy } from "@/entities/debt";
import { Hint } from "@/shared/ui";

const EXPLANATION: Record<Strategy, { text: string; example: string }> = {
  avalanche: {
    text: "Минимум платите по всем долгам, а всё остальное отдавайте долгу с самой высокой ставкой. Так проценты съедают меньше всего денег.",
    example: "карта под 28% и кредит под 16% — сначала гасим карту",
  },
  snowball: {
    text: "Всё лишнее отдавайте самому маленькому долгу. Первые долги закрываются быстро — это мотивирует, но переплата может оказаться чуть больше.",
    example: "рассрочка 600 ₾ и кредит 3500 ₾ — сначала закрываем рассрочку",
  },
};

export function StrategyToggle({ value, onChange }: { value: Strategy; onChange: (s: Strategy) => void }) {
  const info = EXPLANATION[value];
  return (
    <>
      <div className="segmented" role="radiogroup" aria-label="Способ погашения">
        <button
          role="radio"
          aria-checked={value === "avalanche"}
          className={value === "avalanche" ? "is-active" : ""}
          onClick={() => onChange("avalanche")}
        >
          Лавина
        </button>
        <button
          role="radio"
          aria-checked={value === "snowball"}
          className={value === "snowball" ? "is-active" : ""}
          onClick={() => onChange("snowball")}
        >
          Снежный ком
        </button>
      </div>
      <Hint example={info.example}>{info.text}</Hint>
      <details className="more">
        <summary>Как это работает и что выбрать</summary>
        <p>
          В обоих способах вы вносите минимальный платёж по каждому долгу, а сверх этого — «лишние» деньги идут на один
          приоритетный долг. Когда он закрыт, его платёж переходит на следующий, поэтому общая сумма платежа в месяц не
          меняется.
        </p>
        <p>
          <b>Лавина</b> математически выгоднее: меньше процентов и обычно раньше свобода от долгов.
          <br />
          <b>Снежный ком</b> психологически легче: быстрее видны первые закрытые долги.
        </p>
        <p>Если ставки у долгов почти одинаковые, разница небольшая — выберите тот способ, которого проще держаться.</p>
      </details>
    </>
  );
}
