// Pure rules for deleting an expense category (no DB). Deleting must never silently orphan
// or lose operations: when a category has operations, the user has to say where they go.

export const MAX_CATEGORY_NAME = 60;

export type CategoryMoveCheck =
  | { ok: true; moveTo: string | null }
  | { ok: false; reason: "invalid_from" | "invalid_target" | "same_category" | "target_required" };

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * `transactions` is how many operations currently use the category. With none, the category
 * can simply be deleted (a target is ignored); with some, a different target is mandatory.
 */
export function checkCategoryMove(from: unknown, moveTo: unknown, transactions: number): CategoryMoveCheck {
  const source = clean(from);
  if (!source || source.length > MAX_CATEGORY_NAME) return { ok: false, reason: "invalid_from" };
  if (transactions <= 0) return { ok: true, moveTo: null };

  const target = clean(moveTo);
  if (!target) return { ok: false, reason: "target_required" };
  if (target.length > MAX_CATEGORY_NAME) return { ok: false, reason: "invalid_target" };
  if (target === source) return { ok: false, reason: "same_category" };
  return { ok: true, moveTo: target };
}
