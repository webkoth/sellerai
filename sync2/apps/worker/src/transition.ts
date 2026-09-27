import type { RunOutcome } from "./run"

type DoneStatus = RunOutcome["status"]

/** Напоминание о затянувшемся не-ok — каждые 36 прогонов подряд (≈6 ч при тике раз в 10 минут). */
export const REMIND_EVERY_RUNS = 36

/** Короткое описание исхода запуска для Telegram: текст ошибок площадок, иначе — счётчики. */
export function describeOutcome(outcome: Pick<RunOutcome, "error" | "counters">): string {
  if (outcome.error) return outcome.error
  const entries = Object.entries(outcome.counters)
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(", ") : "без деталей"
}

/**
 * Текст уведомления о прогоне джобы или null — молчать. Чистая функция: решение
 * отделено от отправки, таблица переходов проверяется тестом.
 *
 * - первый прогон (prev = null) в ok — молчим: переходом это не считается;
 * - любая смена статуса, где текущий не ok (включая первый прогон сразу в
 *   partial/failed и partial ↔ failed), — предупреждение;
 * - не ok → ok — «снова в норме»;
 * - тот же не-ok подряд — молчим, но каждые REMIND_EVERY_RUNS прогонов серии
 *   (nonOkStreak — не-ok прогонов подряд, включая текущий) — напоминание:
 *   иначе затянувшийся сбой виден только в первом сообщении.
 */
export function decideNotification(input: {
  job: string
  prev: DoneStatus | null
  cur: { status: DoneStatus; detail: string }
  nonOkStreak: number
}): string | null {
  const { job, prev, cur, nonOkStreak } = input
  if (cur.status === "ok") return prev !== null && prev !== "ok" ? `✅ sync2 ${job} снова в норме` : null
  if (prev !== cur.status) return `⚠️ sync2 ${job}: ${cur.status} — ${cur.detail}`
  if (nonOkStreak > 0 && nonOkStreak % REMIND_EVERY_RUNS === 0) {
    return `⚠️ sync2 ${job}: всё ещё ${cur.status} (${nonOkStreak} прогонов подряд) — ${cur.detail}`
  }
  return null
}
