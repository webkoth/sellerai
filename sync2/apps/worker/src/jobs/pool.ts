import { drizzleWriteStore, lastRunStatus, latestStockSnapshots, loadChannels, loadOrdersSince, loadPoolState, savePoolRun, type Db } from "@sync2/db"
import {
  MAX_STOCK_CHANGES_PER_RUN,
  MAX_STOCK_TO_ZERO_PER_RUN,
  WB_SETTLE_MINUTES,
  planStockWrites,
  reconcilePool,
  toPoolOrders,
  type StockChange,
} from "@sync2/domain"
import { executeWrites, type WriteOp } from "@sync2/platforms"
import { CHANNELS, type Channel, type WriteMode } from "@sync2/shared"
import { ORDERS_WINDOW_DAYS } from "./ingest"

/** Снимок старше этого в план не берётся: цель считалась бы от устаревшего остатка площадки. */
export const SNAPSHOT_FRESH_MINUTES = 20
/** Ошибок записи в runs.error — не больше стольких, остальное счётом. */
const MAX_WRITE_ERRORS_SHOWN = 5

const MIRRORS = ["ozon", "ym", "kit"] as const

/**
 * Сайт планируется отдельно от зеркал (этап 1.3c): его остаток в 1.3c — витрина
 * с источником WB (синк сайта раз в 3 часа), и расхождение с пулом там обычно.
 * В общем вызове planStockWrites баркоды сайта считались бы вместе с Ozon/ЯМ/KIT,
 * и сайт мог бы отклонить план всех зеркал. Отдельный вызов — свои пределы и свой
 * отказ. Режим записи сайта в 1.3c — off: строки плана попадают в журнал с
 * mode = 'off' — это и есть расхождение витрины с пулом (сводка compare-v1).
 *
 * Снимков сайта нет вовсе — сайт не подключён (SITE_API_TOKEN не задан, ingest
 * его не читает): счётчиков сайта нет, пул ведёт себя как до 1.3c. Снимок есть,
 * но старый — siteStale.
 */
const SITE = "site" as const

/** Отправителя на площадки в 1.3b нет: запись подключается при переключении (1.4). */
const noSender = async (): Promise<never> => {
  throw new Error("запись на площадки подключается на этапе 1.4")
}

export interface PoolJobResult {
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}

export async function runPool(deps: { db: Db; now: () => Date; runId: string; globalMode: WriteMode }): Promise<PoolJobResult> {
  const { db, runId } = deps
  const now = deps.now()
  const counters: Record<string, number> = {}
  const channels = await loadChannels(db)
  const missing = (["wb", ...MIRRORS, SITE] as const).filter((c) => !channels.has(c))
  if (missing.length > 0) throw new Error(`площадки не заведены — выполните seed-channels (нет: ${missing.join(", ")})`)
  const channelId = (c: Channel) => channels.get(c)!.id

  const snaps = await latestStockSnapshots(db)
  const fresh = (takenAt: string) => now.getTime() - Date.parse(takenAt) <= SNAPSHOT_FRESH_MINUTES * 60_000

  const wbId = channelId("wb")
  const wb = snaps.get(wbId)
  if (!wb || !fresh(wb.takenAt)) {
    counters.noFreshWb = 1
    return { status: "partial", counters }
  }
  counters.wbSnapshotAgeMin = Math.round((now.getTime() - Date.parse(wb.takenAt)) / 60_000)

  const state = await loadPoolState(db)
  // Холодный старт считает все открытые заказы зеркал уже учтёнными: если ingest
  // последний раз прочитал не всё (partial), база построится от неполной картины навсегда.
  if (state.items.length === 0 && (await lastRunStatus(db, "ingest")) !== "ok") {
    counters.coldStartRefused = 1
    return { status: "partial", counters }
  }

  const rows = await loadOrdersSince(db, new Date(now.getTime() - ORDERS_WINDOW_DAYS * 86_400_000).toISOString())
  const { orders, skipped } = toPoolOrders(rows, wbId)
  const result = reconcilePool({
    now: now.toISOString(),
    items: state.items,
    wbSnapshot: wb,
    orders,
    applied: state.applied,
    cancelledApplied: state.cancelledApplied,
    settleMinutes: WB_SETTLE_MINUTES,
  })
  await savePoolRun(db, { runId, items: result.items, events: result.events })
  counters.events = result.events.length
  counters.ordersNoBarcode = skipped.noBarcode
  counters.noBase = result.skipped.noBase

  // WB пишет старый синк (режим external) — в план только зеркала со свежим снимком.
  const mirrors: Array<{ channel: Channel; stocks: typeof wb.stocks }> = []
  let stale = 0
  for (const c of MIRRORS) {
    const snap = snaps.get(channelId(c))
    if (snap && fresh(snap.takenAt)) mirrors.push({ channel: c, stocks: snap.stocks })
    else stale++
  }
  counters.staleSnapshots = stale

  const limits = { maxChanges: MAX_STOCK_CHANGES_PER_RUN, maxToZero: MAX_STOCK_TO_ZERO_PER_RUN }
  const plan = planStockWrites(result.items, mirrors, limits)
  if (plan.aborted) {
    counters[`aborted_${plan.aborted.reason}`] = plan.aborted.count
    return { status: "partial", counters }
  }

  let siteChanges: StockChange[] = []
  let siteAborted: string | null = null
  const siteSnap = snaps.get(channelId(SITE))
  if (siteSnap && !fresh(siteSnap.takenAt)) {
    counters.siteStale = 1
  } else if (siteSnap) {
    const sitePlan = planStockWrites(result.items, [{ channel: SITE, stocks: siteSnap.stocks }], limits)
    if (sitePlan.aborted) {
      counters[`siteAborted_${sitePlan.aborted.reason}`] = sitePlan.aborted.count
      siteAborted = `сайт: план отклонён предохранителем (${sitePlan.aborted.reason}: ${sitePlan.aborted.count} при пределе ${sitePlan.aborted.max})`
    } else {
      siteChanges = sitePlan.changes
    }
  }

  const ops: WriteOp[] = [...plan.changes, ...siteChanges].map((c) => ({ channel: c.channel, barcode: c.barcode, field: "stock", before: c.before, after: c.after }))
  const channelModes = Object.fromEntries(CHANNELS.map((c) => [c, channels.get(c)?.writeMode ?? "off"])) as Record<Channel, WriteMode>
  const outcomes = await executeWrites(ops, { globalMode: deps.globalMode, channelModes, send: noSender, record: drizzleWriteStore(db, runId, channels) })
  for (const c of MIRRORS) counters[`${c}Planned`] = outcomes.filter((o) => o.channel === c).length
  if (siteSnap) counters[`${SITE}Planned`] = outcomes.filter((o) => o.channel === SITE).length

  const problems: string[] = []
  if (siteAborted) problems.push(siteAborted)
  const failed = outcomes.filter((o) => o.error !== null)
  if (failed.length > 0) {
    counters.writeErrors = failed.length
    const shown = failed.slice(0, MAX_WRITE_ERRORS_SHOWN).map((o) => `${o.channel} ${o.barcode}: ${o.error}`)
    const rest = failed.length > shown.length ? `; … ещё ${failed.length - shown.length}` : ""
    problems.push(`ошибки записи: ${shown.join("; ")}${rest}`)
  }
  if (problems.length > 0) return { status: "partial", counters, error: problems.join("; ") }
  return { status: "ok", counters }
}
