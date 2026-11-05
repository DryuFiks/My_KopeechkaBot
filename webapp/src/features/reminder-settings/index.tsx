import { updateSettings, type Settings } from "@/entities/plan";
import { Hint } from "@/shared/ui";
import { useAction } from "@/shared/lib/useAction";

const HOURS = [18, 19, 20, 21, 22, 23];

/**
 * Напоминания (MKB-057): вечернее «Сегодня ничего не записано. Были траты?» — только если включить.
 * Приходит в выбранный час, если за день нет ни одной записи; в самом сообщении есть «Не напоминать».
 */
export function ReminderSettings({ settings, onChanged }: { settings: Settings; onChanged: () => void }) {
  const { error, busy, run } = useAction(onChanged);
  return (
    <>
      <Hint>
        Бот напишет вечером, только если за день не записано ни одной операции. Отключить можно прямо в
        сообщении.
      </Hint>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.remindEvening}
          disabled={busy}
          onChange={(e) => void run(() => updateSettings({ remindEvening: e.target.checked }))}
        />
        Напоминать вечером записать траты
      </label>
      <label className="check">
        Во сколько
        <select
          value={settings.remindHour}
          disabled={busy || !settings.remindEvening}
          onChange={(e) => void run(() => updateSettings({ remindHour: Number(e.target.value) }))}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.weeklyDigest}
          disabled={busy}
          onChange={(e) => void run(() => updateSettings({ weeklyDigest: e.target.checked }))}
        />
        Итоги недели по воскресеньям в 19:00
      </label>
      {error && (
        <p className="hint" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
