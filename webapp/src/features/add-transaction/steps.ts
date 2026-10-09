export type Step = "currency" | "category" | "amount" | "confirm";

const ORDER: Step[] = ["currency", "category", "amount", "confirm"];

export function nextStep(step: Step): Step {
  return ORDER[Math.min(ORDER.indexOf(step) + 1, ORDER.length - 1)];
}

export function previousStep(step: Step): Step {
  return ORDER[Math.max(ORDER.indexOf(step) - 1, 0)];
}

/** Сумма корректна, если это конечное число больше нуля и не больше миллиарда. */
export function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 1_000_000_000;
}
