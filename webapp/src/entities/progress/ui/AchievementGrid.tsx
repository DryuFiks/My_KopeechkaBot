import type { Achievement } from "../model/api";

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Открытые достижения — цветные с датой, закрытые — серые с подсказкой, как их получить. */
export function AchievementGrid({ items, fresh }: { items: Achievement[]; fresh: string[] }) {
  return (
    <ul className="achievements">
      {items.map((a) => {
        const unlocked = a.unlockedAt !== null;
        return (
          <li key={a.code} className={unlocked ? "ach ach--on" : "ach"}>
            <span className="ach__icon" aria-hidden="true">
              {unlocked ? a.emoji : "🔒"}
            </span>
            <div>
              <b>
                {a.title}
                {fresh.includes(a.code) && <span className="ach__new"> Новое!</span>}
              </b>
              <p className="hint">{a.description}</p>
              <small className="hint">{unlocked ? `Получено ${when(a.unlockedAt as string)} · +${a.xp} XP` : `+${a.xp} XP`}</small>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
