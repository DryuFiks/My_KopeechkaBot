import { getRecentCategories } from "./db";
import { listExpenseCategories } from "./db/categories";
import type { TransactionType } from "./parser";

export const MAX_CATEGORY_OPTIONS = 20;

/**
 * Categories offered when adding an operation: recently/most used first, then every other
 * category the user has (budget limits created in the WebApp included). Shared by the chat
 * wizard and the WebApp so both show the same list in the same order.
 */
export async function getCategoryOptions(userId: number, type: TransactionType): Promise<string[]> {
  const recent = await getRecentCategories(userId, type, MAX_CATEGORY_OPTIONS);
  const rest = type === "expense" ? await listExpenseCategories(userId) : [];
  return [...new Set([...recent, ...rest])].slice(0, MAX_CATEGORY_OPTIONS);
}
