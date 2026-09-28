import { drizzleWriteStore, lastRunWithCounterAt, loadChannels, loadPoolState, type Db } from "@sync2/db"
import { SITE_UNKNOWN_BARCODE, executeWrites, type Sender, type WriteOp } from "@sync2/platforms"
import { CHANNELS, type Channel, type WriteMode } from "@sync2/shared"

/** Пул старше этого на сайт целиком не выкладывается — сначала tick. */
export const SITE_PUSH_MAX_POOL_AGE_MIN = 15

/**
 * Шаг A этапа 1.4: весь пул на сайт (`PUT /api/internal/stocks`), все штрихкоды, нули включены —
 * до переключения витрины на STOCK_SOURCE=pool, иначе товары без строки в pool_stocks покажут 0.
 * Режим сайта на эту команду — apply (ручной запуск с --confirm); глобальный SYNC_WRITE_MODE главнее.
 * Штрихкоды пула, которых нет в каталоге сайта, — счётчик siteUnknown, не ошибка.
 */
export async function runSitePushAll(deps: { db: Db; now: () => Date; runId: string; globalMode: WriteMode; send: Sender }): Promise<{
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}> {
  const { db } = deps
  const recalcAt = await lastRunWithCounterAt(db, "pool", "events")
  if (recalcAt === null || deps.now().getTime() - Date.parse(recalcAt) > SITE_PUSH_MAX_POOL_AGE_MIN * 60_000) {
    throw new Error(`пул не пересчитывался последние ${SITE_PUSH_MAX_POOL_AGE_MIN} мин — сначала tick`)
  }
  const channels = await loadChannels(db)
  const { items } = await loadPoolState(db)
  // Ключ сайта — сам штрихкод (как в pool.ts).
  const ops: WriteOp[] = items.map((i) => ({ channel: "site", barcode: i.barcode, field: "stock", before: null, after: Math.max(0, i.base), externalSku: i.barcode }))
  const channelModes = Object.fromEntries(CHANNELS.map((c) => [c, c === "site" ? "apply" : "off"])) as Record<Channel, WriteMode>
  const outcomes = await executeWrites(ops, { globalMode: deps.globalMode, channelModes, send: deps.send, record: drizzleWriteStore(db, deps.runId, channels) })
  const isUnknown = (e: string | null) => e !== null && e.startsWith(SITE_UNKNOWN_BARCODE)
  const failed = outcomes.filter((o) => o.error !== null && !isUnknown(o.error))
  const counters = {
    sent: ops.length,
    applied: outcomes.filter((o) => o.applied).length,
    siteUnknown: outcomes.filter((o) => isUnknown(o.error)).length,
    failed: failed.length,
  }
  if (ops.length > 0 && outcomes.every((o) => o.mode !== "apply")) {
    return { status: "partial", counters, error: `запись не делалась: SYNC_WRITE_MODE=${deps.globalMode}` }
  }
  if (failed.length > 0) return { status: "partial", counters, error: failed.slice(0, 5).map((o) => `${o.barcode}: ${o.error}`).join("; ") }
  return { status: "ok", counters }
}
