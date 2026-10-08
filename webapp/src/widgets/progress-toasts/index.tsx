import { useEffect, useRef, useState } from "react";
import { fetchProgress, progressBus } from "@/entities/progress";
import { writeBus } from "@/shared/lib/events";
import { haptic } from "@/shared/lib/telegram";

interface Toast {
  id: number;
  text: string;
}

const SHOW_MS = 4500;
const RECHECK_DELAY_MS = 700;

/**
 * Всплывающие «Новое достижение!» и «Новый ранг!». Показывает всё, что сервер сообщил как новое
 * (в любом ответе о прогрессе), и после каждой записи один раз перепроверяет награды.
 */
export function ProgressToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const timers: number[] = [];
    let recheck: number | undefined;

    const offProgress = progressBus.on((p) => {
      const texts = [
        ...p.newlyUnlocked.flatMap((code) => {
          const a = p.achievements.find((x) => x.code === code);
          return a ? [`🏅 ${a.emoji} ${a.title} · +${a.xp} XP`] : [];
        }),
        ...(p.rankedUp ? [`⬆️ Новый ранг: ${p.rankedUp.emoji} ${p.rankedUp.title}`] : []),
      ];
      if (texts.length === 0) return;
      haptic("success");
      for (const text of texts) {
        const id = nextId.current++;
        setToasts((t) => [...t, { id, text }]);
        timers.push(window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), SHOW_MS));
      }
    });

    // Несколько записей подряд (пополнил, создал…) дают одну проверку, а не лавину запросов.
    const offWrite = writeBus.on(() => {
      window.clearTimeout(recheck);
      recheck = window.setTimeout(() => void fetchProgress().catch(() => {}), RECHECK_DELAY_MS);
    });

    return () => {
      offProgress();
      offWrite();
      window.clearTimeout(recheck);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}
