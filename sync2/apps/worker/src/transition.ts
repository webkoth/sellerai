import { CHANNELS, type Channel } from "@sync2/shared"
import type { RunOutcome } from "./run"

type DoneStatus = RunOutcome["status"]

/** Напоминание о затянувшемся не-ok — каждые 72 прогона подряд (≈6 ч при тике раз в 5 минут, этап 1.4). */
export const REMIND_EVERY_RUNS = 72

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
 *   (streak — прогонов подряд с тем же статусом, что текущий, включая его;
 *   partial и failed не смешиваются) — напоминание: иначе затянувшийся сбой
 *   виден только в первом сообщении. Качели partial ↔ failed уведомляют на
 *   каждой смене — это смена статуса.
 */
export function decideNotification(input: {
  job: string
  prev: DoneStatus | null
  cur: { status: DoneStatus; detail: string }
  streak: number
}): string | null {
  const { job, prev, cur, streak } = input
  if (cur.status === "ok") return prev !== null && prev !== "ok" ? `✅ sync2 ${job} снова в норме` : null
  if (prev !== cur.status) return `⚠️ sync2 ${job}: ${cur.status} — ${cur.detail}`
  if (streak > 0 && streak % REMIND_EVERY_RUNS === 0) {
    return `⚠️ sync2 ${job}: всё ещё ${cur.status} (${streak} прогонов подряд) — ${cur.detail}`
  }
  return null
}

/** Запись площадки не проходит столько прогонов pool подряд — предупреждение (≈15 мин при тике раз в 5 минут). */
export const WRITE_FAIL_ALERT_RUNS = 3

const CHANNEL_LABEL: Record<Channel, string> = { wb: "WB", ozon: "Ozon", ym: "ЯМ", kit: "KIT", site: "сайт" }

/** «3 тика», «5 тиков», «72 тика» — для текста уведомления. */
function ticks(n: number): string {
  const d10 = n % 10
  const d100 = n % 100
  if (d10 === 1 && d100 !== 11) return `${n} тик`
  if (d10 >= 2 && d10 <= 4 && (d100 < 12 || d100 > 14)) return `${n} тика`
  return `${n} тиков`
}

/**
 * Уведомления «площадка X: запись не проходит N тиков подряд» по счётчикам pool
 * (`<площадка>WriteFailed`, `<площадка>WriteFailedRuns`, ревью 3–6, I2). Статус pool сам этого не
 * покажет: он уже partial по другой причине, и смены статуса нет. Серия дошла до
 * WRITE_FAIL_ALERT_RUNS — предупреждение, дальше — напоминание каждые REMIND_EVERY_RUNS прогонов;
 * серия от порога кончилась — «снова проходит». Чистая функция: prev — счётчики прошлого pool.
 */
export function writeFailureAlerts(prev: Record<string, unknown> | null, cur: Record<string, number>): string[] {
  const out: string[] = []
  for (const c of CHANNELS) {
    const runsNow = cur[`${c}WriteFailedRuns`] ?? 0
    if (runsNow > 0) {
      if (runsNow === WRITE_FAIL_ALERT_RUNS || (runsNow > WRITE_FAIL_ALERT_RUNS && runsNow % REMIND_EVERY_RUNS === 0)) {
        out.push(
          `⚠️ sync2 pool: площадка ${CHANNEL_LABEL[c]} — запись не проходит ${ticks(runsNow)} подряд (ошибок в последнем прогоне: ${cur[`${c}WriteFailed`] ?? 0}); подробности — plan ${c}`,
        )
      }
      continue
    }
    const before = prev?.[`${c}WriteFailedRuns`]
    if (typeof before === "number" && before >= WRITE_FAIL_ALERT_RUNS) {
      out.push(`✅ sync2 pool: площадка ${CHANNEL_LABEL[c]} — запись снова проходит (серия ошибок была ${ticks(before)})`)
    }
  }
  return out
}
