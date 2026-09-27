import { drizzleWriteStore, latestStockSnapshots, loadChannels, loadOrdersSince, loadPoolState, savePoolRun, type Db } from "@sync2/db"
import { MAX_STOCK_CHANGES_PER_RUN, MAX_STOCK_TO_ZERO_PER_RUN, WB_SETTLE_MINUTES, planStockWrites, reconcilePool, toPoolOrders } from "@sync2/domain"
import { executeWrites, type WriteOp } from "@sync2/platforms"
import { CHANNELS, type Channel, type WriteMode } from "@sync2/shared"
import { ORDERS_WINDOW_DAYS } from "./ingest"

/** Снимок старше этого в план не берётся: цель считалась бы от устаревшего остатка площадки. */
export const SNAPSHOT_FRESH_MINUTES = 20

/** Отправителя на площадки в 1.3b нет: запись подключается при переключении (1.4). */
const noSender = async (): Promise<never> => {
  throw new Error("запись на площадки подключается на этапе 1.4")
}

export async function runPool(deps: { db: Db; now: () => Date; runId: string; globalMode: WriteMode }) {
  const { db, runId } = deps
  const now = deps.now()
  const counters: Record<string, number> = {}
  const channels = await loadChannels(db)
  const snaps = await latestStockSnapshots(db)
  const fresh = (takenAt: string) => now.getTime() - Date.parse(takenAt) <= SNAPSHOT_FRESH_MINUTES * 60_000

  const wbId = channels.get("wb")!.id
  const wb = snaps.get(wbId)
  if (!wb || !fresh(wb.takenAt)) {
    counters.noFreshWb = 1
    return { status: "partial" as const, counters }
  }

  const state = await loadPoolState(db)
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

  // WB пишет старый синк (режим external) — в план только зеркала со свежим снимком.
  const mirrors: Array<{ channel: Channel; stocks: typeof wb.stocks }> = []
  let stale = 0
  for (const c of ["ozon", "ym", "kit"] as const) {
    const snap = snaps.get(channels.get(c)!.id)
    if (snap && fresh(snap.takenAt)) mirrors.push({ channel: c, stocks: snap.stocks })
    else stale++
  }
  counters.staleSnapshots = stale

  const plan = planStockWrites(result.items, mirrors, { maxChanges: MAX_STOCK_CHANGES_PER_RUN, maxToZero: MAX_STOCK_TO_ZERO_PER_RUN })
  if (plan.aborted) {
    counters[`aborted_${plan.aborted.reason}`] = plan.aborted.count
    return { status: "partial" as const, counters }
  }
  const ops: WriteOp[] = plan.changes.map((c) => ({ channel: c.channel, barcode: c.barcode, field: "stock", before: c.before, after: c.after }))
  const channelModes = Object.fromEntries(CHANNELS.map((c) => [c, channels.get(c)?.writeMode ?? "off"])) as Record<Channel, WriteMode>
  const outcomes = await executeWrites(ops, { globalMode: deps.globalMode, channelModes, send: noSender, record: drizzleWriteStore(db, runId, channels) })
  for (const c of ["ozon", "ym", "kit"] as const) counters[`${c}Planned`] = outcomes.filter((o) => o.channel === c).length
  return { status: "ok" as const, counters }
}
