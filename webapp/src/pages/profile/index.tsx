import { AchievementGrid, RankCard, fetchProgress } from "@/entities/progress";
import { SettingsPage } from "@/pages/settings";
import { SendFeedback } from "@/features/send-feedback";
import { HomeScreenShortcut } from "@/features/home-screen-shortcut";
import { CollapsibleCard, Hint, Status } from "@/shared/ui";
import { useAsync } from "@/shared/lib/useAsync";

/** Профиль: текущий ранг; награды и настройки свёрнуты до одной строки. */
export function ProfilePage({ restartOnboarding }: { restartOnboarding: () => void }) {
  const progress = useAsync(fetchProgress);
  return (
    <>
      <h1>Профиль</h1>
      <Status state={progress}>
        {(p) => (
          <>
            <RankCard p={p} />
            <CollapsibleCard title="Ранги и достижения">
              <Hint>
                Опыт дают регулярные записи, план месяца, цели и накопления. Ранг и полученные достижения
                никогда не отбираются.
              </Hint>
              <AchievementGrid items={p.achievements} fresh={p.newlyUnlocked} />
            </CollapsibleCard>
          </>
        )}
      </Status>
      <HomeScreenShortcut />
      <SendFeedback />
      <SettingsPage restartOnboarding={restartOnboarding} />
    </>
  );
}
