import { Card, ProgressBar } from "@/shared/ui";
import { rankProgressPercent } from "../lib/rankProgress";
import type { ProgressData } from "../model/api";

/** Ранг, опыт и путь до следующего; необязательная кнопка ведёт ко всем наградам. */
export function RankCard({ p, onOpen }: { p: ProgressData; onOpen?: () => void }) {
  const percent = rankProgressPercent(p.xp, p.rank.minXp, p.next?.minXp ?? null);
  return (
    <Card title="Ваш ранг">
      <p className="rank">
        <span aria-hidden="true">{p.rank.emoji}</span> {p.rank.title}
      </p>
      <ProgressBar value={percent} label={`${p.xp} XP`} />
      <p className="hint">
        {p.next
          ? `До «${p.next.emoji} ${p.next.title}» осталось ${p.next.xpLeft} XP`
          : "Это высший ранг — вы мастер копеечного хранения!"}
      </p>
      {onOpen && (
        <button className="chip" onClick={onOpen}>
          Все награды
        </button>
      )}
    </Card>
  );
}
