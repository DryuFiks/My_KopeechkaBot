import { AchievementGrid, RankCard, fetchProgress } from "@/entities/progress";
import { SettingsPage } from "@/pages/settings";
import { Hint, Status } from "@/shared/ui";
import { useAsync } from "@/shared/lib/useAsync";

/** Профиль: ранг и награды, ниже — настройки. */
export function ProfilePage({ restartOnboarding }: { restartOnboarding: () => void }) {
  const progress = useAsync(fetchProgress);
  return (
    <>
      <h1>Профиль</h1>
      <Status state={progress}>
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
      <SettingsPage restartOnboarding={restartOnboarding} />
    </>
  );
}
