import type { RunInfo } from "@sync2/db"
import type { Channel } from "@sync2/shared"

/** План старше этого для решения «включать apply» не годится — сначала tick. */
export const APPLY_PREVIEW_MAX_AGE_MIN = 15

/**
 * Можно ли включать apply площадки по последнему прогону pool (решение 4 плана 1.4): план свежий,
 * пул пересчитан (есть счётчик events), и план этой площадки не отклонён предохранителем.
 */
export function checkApplyPreview(run: RunInfo | null, channel: Channel, now: Date): { ok: true } | { ok: false; reason: string } {
  if (!run) return { ok: false, reason: "pool ещё не запускался — сначала tick" }
  if (run.status !== "ok" && run.status !== "partial") return { ok: false, reason: `последний pool — ${run.status}` }
  if (!("events" in run.counters)) return { ok: false, reason: "в последнем pool пул не пересчитан (нет свежего снимка WB или отказ холодного старта)" }
  const ageMin = Math.round((now.getTime() - Date.parse(run.startedAt)) / 60_000)
  if (ageMin > APPLY_PREVIEW_MAX_AGE_MIN) return { ok: false, reason: `последний pool ${ageMin} мин назад — план устарел, сначала tick` }
  const aborted = Object.keys(run.counters).filter((k) => k.startsWith(`${channel}Aborted_`))
  if (aborted.length > 0) return { ok: false, reason: `план ${channel} отклонён предохранителем (${aborted.join(", ")}) — разобрать до apply` }
  return { ok: true }
}
