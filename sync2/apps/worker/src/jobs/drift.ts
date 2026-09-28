import {
  barcodesAppliedSince,
  countFailedRunsSince,
  countStuckRunsSince,
  lastRunWithCounterAt,
  latestStockSnapshots,
  loadChannels,
  loadPoolState,
  writeStatsSince,
  REPEATED_WRITES_MIN,
  type Db,
  type WriteStats,
} from "@sync2/db"
import { aggregateStockByBarcode } from "@sync2/domain"
import { CHANNELS, CHANNEL_LABELS, type Channel, type NormalizedStock } from "@sync2/shared"
import type { Notifier } from "../notify"
import { COMPARE_WINDOW_MS, MAX_TELEGRAM_TEXT, STUCK_RUN_MS, formatMsk } from "./compare-v1"

const LABEL = CHANNEL_LABELS
const MAX_LIST = 10
const TRUNCATED_MARK = "\n… (сводка обрезана)"

/** Пул против последнего снимка одной площадки. */
export interface ChannelDrift {
  channel: Channel
  takenAt: string
  /** Штрихкодов в снимке площадки. */
  compared: number
  /** Расходились бы, но запись применена после снимка — следующий снимок её увидит. */
  inFlight: number
  mismatches: Array<{ barcode: string; pool: number; actual: number }>
}

/**
 * Расхождение площадки с пулом. Штрихкод площадки, которого нет в пуле, — цель 0 (как в
 * planStockWrites): сирота с остатком — расхождение, с нулём — нет.
 */
export function channelDrift(channel: Channel, takenAt: string, pool: ReadonlyMap<string, number>, stocks: NormalizedStock[], inFlight: ReadonlySet<string>): ChannelDrift {
  const mismatches: ChannelDrift["mismatches"] = []
  let compared = 0
  let flight = 0
  for (const [barcode, { quantity }] of aggregateStockByBarcode(stocks)) {
    compared++
    const target = Math.max(0, pool.get(barcode) ?? 0)
    if (quantity === target) continue
    if (inFlight.has(barcode)) {
      flight++
      continue
    }
    mismatches.push({ barcode, pool: target, actual: quantity })
  }
  mismatches.sort((a, b) => (a.barcode < b.barcode ? -1 : a.barcode > b.barcode ? 1 : 0))
  return { channel, takenAt, compared, inFlight: flight, mismatches }
}

function driftLine(d: ChannelDrift, now: Date): string {
  const age = Math.round((now.getTime() - Date.parse(d.takenAt)) / 60_000)
  const head = `${LABEL[d.channel]}: расходится ${d.mismatches.length} из ${d.compared} (снимок ${age} мин, в пути ${d.inFlight})`
  if (d.mismatches.length === 0) return head
  const shown = d.mismatches.slice(0, MAX_LIST).map((m) => `${m.barcode}: пул ${m.pool}, на площадке ${m.actual}`)
  const rest = d.mismatches.length > shown.length ? `, … (ещё ${d.mismatches.length - shown.length})` : ""
  return `${head} — ${shown.join(", ")}${rest}`
}

/** Суточная сводка «пул ↔ площадки» для Telegram — числа для решения, не отчёт с рекомендацией. */
export function formatDrift(
  drifts: ChannelDrift[],
  stats: Record<Channel, WriteStats>,
  extra: { now: Date; lastPoolRecalcAt: string | null; failedRuns: number; stuckRuns: number },
): string {
  const writesLine = CHANNELS.map((c) => `${LABEL[c]} ${stats[c].applied}/${stats[c].failed}/${stats[c].barcodes}`).join(" · ")
  const repeated = CHANNELS.flatMap((c) => stats[c].repeated.map((r) => `${LABEL[c]} ${r.barcode} ×${r.times}`))
  const text = [
    "📏 sync2: пул ↔ площадки",
    ...drifts.map((d) => driftLine(d, extra.now)),
    `Записи за сутки (применено/ошибок/баркодов): ${writesLine}`,
    `Повторные записи (≥${REPEATED_WRITES_MIN} за сутки): ${repeated.length ? repeated.slice(0, MAX_LIST).join(", ") : "—"}`,
    extra.lastPoolRecalcAt === null ? "Пул: ⚠️ ни разу не пересчитан" : `Пул пересчитан: ${formatMsk(extra.lastPoolRecalcAt)}`,
    `Упавших прогонов за сутки: ${extra.failedRuns}, зависших (running > ${STUCK_RUN_MS / 60_000} мин): ${extra.stuckRuns}`,
  ].join("\n")
  return text.length <= MAX_TELEGRAM_TEXT ? text : text.slice(0, MAX_TELEGRAM_TEXT - TRUNCATED_MARK.length) + TRUNCATED_MARK
}

/** Пул против последних снимков всех площадок, у которых снимок есть. */
async function currentDrifts(db: Db): Promise<ChannelDrift[]> {
  const channels = await loadChannels(db)
  const snaps = await latestStockSnapshots(db)
  const { items } = await loadPoolState(db)
  const pool = new Map(items.map((i) => [i.barcode, i.base]))
  const out: ChannelDrift[] = []
  for (const c of CHANNELS) {
    const ch = channels.get(c)
    const snap = ch ? snaps.get(ch.id) : undefined
    if (!ch || !snap) continue
    out.push(channelDrift(c, snap.takenAt, pool, snap.stocks, await barcodesAppliedSince(db, ch.id, snap.takenAt)))
  }
  return out
}

/** Готовность к шагу B: снимок WB последнего тика совпадает с пулом по всем штрихкодам. null — снимка WB нет. */
export async function wbDriftNow(db: Db): Promise<ChannelDrift | null> {
  return (await currentDrifts(db)).find((d) => d.channel === "wb") ?? null
}

/** Сводка drift: print — в терминал, иначе в Telegram (не доставлено — ошибка, как у compare-v1). */
export async function runDrift(deps: { db: Db; notifier: Notifier; now: () => Date; print: boolean }): Promise<Record<string, number>> {
  const { db } = deps
  const now = deps.now()
  const since = new Date(now.getTime() - COMPARE_WINDOW_MS).toISOString()
  const [drifts, stats, lastPoolRecalcAt, failedRuns, stuckRuns] = await Promise.all([
    currentDrifts(db),
    writeStatsSince(db, since),
    lastRunWithCounterAt(db, "pool", "events"),
    countFailedRunsSince(db, since),
    countStuckRunsSince(db, since, new Date(now.getTime() - STUCK_RUN_MS).toISOString()),
  ])
  const text = formatDrift(drifts, stats, { now, lastPoolRecalcAt, failedRuns, stuckRuns })
  if (deps.print) console.log(text)
  else if (!(await deps.notifier.send(text))) throw new Error("сводка drift не доставлена в Telegram (бот не настроен или Telegram отказал)")
  const counters: Record<string, number> = { repeated: CHANNELS.reduce((n, c) => n + stats[c].repeated.length, 0) }
  for (const d of drifts) counters[`${d.channel}Drift`] = d.mismatches.length
  return counters
}
