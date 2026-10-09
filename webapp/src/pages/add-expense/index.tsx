import { AddTransaction } from "@/features/add-transaction";
import type { TabId } from "@/widgets/tab-bar";

/** Экран добавления расхода; по завершению или отмене возвращает на «Обзор». */
export function AddExpensePage({ go }: { go: (tab: TabId) => void }) {
  return <AddTransaction type="expense" onClose={() => go("overview")} />;
}
