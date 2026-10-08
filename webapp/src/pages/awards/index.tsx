import { AchievementGrid, RankCard, fetchProgress } from "@/entities/progress";
import { Hint, Status } from "@/shared/ui";
import { useAsync } from "@/shared/lib/useAsync";

export function AwardsPage() {
  const state = useAsync(fetchProgress);
  return (
    <>
      <h1>Награды</h1>
      <Status state={state}>
        {(p) => (
          <>
            <RankCard p={p} />
            <Hint>
              Опыт дают регулярные записи, план месяца, цели и накопления. Ранг и полученные достижения никогда не
              отбираются.
            </Hint>
            <AchievementGrid items={p.achievements} fresh={p.newlyUnlocked} />
          </>
        )}
      </Status>
    </>
  );
}
