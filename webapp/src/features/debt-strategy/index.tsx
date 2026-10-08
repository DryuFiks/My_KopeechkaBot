import type { Strategy } from "@/entities/debt";

export function StrategyToggle({ value, onChange }: { value: Strategy; onChange: (s: Strategy) => void }) {
  return (
    <div className="segmented">
      <button className={value === "avalanche" ? "is-active" : ""} onClick={() => onChange("avalanche")}>
        Лавина
      </button>
      <button className={value === "snowball" ? "is-active" : ""} onClick={() => onChange("snowball")}>
        Снежный ком
      </button>
    </div>
  );
}
