import { readFileSync } from "node:fs"
import {
  channelsWithSnapshotSince,
  countFailedRunsSince,
  countStuckRunsSince,
  countSuspectedDoubleCounts,
  DOUBLE_COUNT_WINDOW_MINUTES,
  lastRunWithCounterAt,
  loadPoolState,
  mirrorOrderBarcodesSince,
  plannedWritesSince,
  type Db,
  type PlannedWrites,
} from "@sync2/db"
import { errorText, type Channel } from "@sync2/shared"
import type { Notifier } from "../notify"

/** Сутки — окно сводки compare-v1: и для упавших запусков, и для плана записей. */
export const COMPARE_WINDOW_MS = 24 * 60 * 60 * 1000
/** Прогон `running` дольше этого — «зависший»: процесс убит, закрывающей записи не будет. */
export const STUCK_RUN_MS = 30 * 60 * 1000
/** Пул не пересчитывался дольше этого — пометка в сводке (тик — раз в 5 минут, этап 1.4). */
export const POOL_STALE_MS = 60 * 60 * 1000
/** Лимит Telegram — 4096 символов; с запасом. */
export const MAX_TELEGRAM_TEXT = 4000

/** Позиция пула sync2 — как её видит сверка. */
export interface V2PoolItem {
  barcode: string
  base: number
}

/** Леджер старого синка (`sync/src/types.ts`, `data/state/inventory.json`): нас интересует только база на баркод. */
export interface V1Ledger {
  items: Record<string, { base: number }>
}

export interface ComparisonResult {
  /** Баркоды, есть в обоих пулах, база совпадает. */
  same: number
  diff: Array<{ barcode: string; v1: number; v2: number }>
  /** Есть только у старого синка, с ненулевой базой. */
  onlyV1: Array<{ barcode: string; v1: number }>
  /** Есть только у sync2, с ненулевой базой. */
  onlyV2: Array<{ barcode: string; v2: number }>
}

/**
 * Пул sync2 против леджера старого синка. Нулевая база у товара, которого нет
 * в другом пуле, — не расхождение: старый синк, как и sync2, не хранит нулевые
 * позиции вечно, отсутствие строки с нулём ничего не значит.
 */
export function comparePools(v2: V2PoolItem[], v1: V1Ledger): ComparisonResult {
  let same = 0
  const diff: ComparisonResult["diff"] = []
  const onlyV2: ComparisonResult["onlyV2"] = []
  const seen = new Set<string>()

  for (const item of v2) {
    seen.add(item.barcode)
    const v1Item = v1.items[item.barcode]
    if (v1Item === undefined) {
      if (item.base > 0) onlyV2.push({ barcode: item.barcode, v2: item.base })
      continue
    }
    if (v1Item.base === item.base) same++
    else diff.push({ barcode: item.barcode, v1: v1Item.base, v2: item.base })
  }

  const onlyV1: ComparisonResult["onlyV1"] = []
  for (const [barcode, v1Item] of Object.entries(v1.items)) {
    if (seen.has(barcode)) continue
    if (v1Item.base > 0) onlyV1.push({ barcode, v1: v1Item.base })
  }

  return { same, diff, onlyV1, onlyV2 }
}

const MAX_LIST_LINES = 10
const TRUNCATED_MARK = "\n… (сводка обрезана)"

/** Первые MAX_LIST_LINES через запятую и «… (ещё N)»; пусто — «—». */
function formatList(items: string[]): string {
  if (items.length === 0) return "—"
  const tail = items.length > MAX_LIST_LINES ? `, … (ещё ${items.length - MAX_LIST_LINES})` : ""
  return items.slice(0, MAX_LIST_LINES).join(", ") + tail
}

/** Время для владельца: «27.09 14:50 МСК» (Москва — UTC+3 без перехода на летнее). */
export function formatMsk(iso: string): string {
  const t = new Date(Date.parse(iso) + 3 * 60 * 60 * 1000).toISOString()
  return `${t.slice(8, 10)}.${t.slice(5, 7)} ${t.slice(11, 16)} МСК`
}

/** Всё, кроме самой сверки пулов, что попадает в сводку. */
export interface SummaryExtra {
  now: Date
  failedRuns: number
  /** `running` старше STUCK_RUN_MS за сутки. */
  stuckRuns: number
  planned: Record<Channel, PlannedWrites>
  /** Начало последнего прогона pool, пересчитавшего пул (есть счётчик events); ни одного — null. */
  lastPoolRecalcAt: string | null
  /** Баркоды с заказом/отменой зеркала за последние DOUBLE_COUNT_WINDOW_MINUTES — пометка у строк diff. */
  recentOrderBarcodes: ReadonlySet<string>
  suspectedDoubleCounts: number
  /**
   * Расхождение витрины сайта с пулом за сутки: план сайта в журнале с mode = 'off'
   * (этап 1.3c) или 'dry-run' (1.4). null — сайт не подключён: за сутки ни снимка
   * сайта, ни строк его плана.
   */
  siteDiff: PlannedWrites | null
}

function poolLine(recalcAt: string | null, now: Date): string {
  if (recalcAt === null) return "Пул: ⚠️ пул ни разу не пересчитан"
  const ageMs = now.getTime() - Date.parse(recalcAt)
  const stale = ageMs > POOL_STALE_MS ? ` ⚠️ пул не пересчитывался ${Math.floor(ageMs / 3_600_000)} ч` : ""
  return `Пул пересчитан: ${formatMsk(recalcAt)}${stale}`
}

/**
 * Короткая сводка для Telegram — не отчёт с рекомендацией, а числа для решения владельца.
 * Не длиннее MAX_TELEGRAM_TEXT: длиннее Telegram не примет вовсе.
 */
export function formatComparison(r: ComparisonResult, extra: SummaryExtra): string {
  const total = r.same + r.diff.length + r.onlyV1.length + r.onlyV2.length
  const recent = ` (заказ ≤${DOUBLE_COUNT_WINDOW_MINUTES} мин)`
  const diffItems = r.diff.map((d) => `${d.barcode}: старый ${d.v1}, новый ${d.v2}${extra.recentOrderBarcodes.has(d.barcode) ? recent : ""}`)
  const diffLine = r.diff.length === 0 ? "расходится 0" : `расходится ${r.diff.length}: ${formatList(diffItems)}`
  const p = extra.planned
  const plan = (c: Channel) => `${p[c].barcodes}/${p[c].rows}`

  const text = [
    "🔎 sync2 ↔ старый синк, сверка пула",
    `совпадает ${r.same} из ${total}`,
    diffLine,
    `Только у старого (${r.onlyV1.length}): ${formatList(r.onlyV1.map((i) => `${i.barcode} (${i.v1})`))}`,
    `Только у нового (${r.onlyV2.length}): ${formatList(r.onlyV2.map((i) => `${i.barcode} (${i.v2})`))}`,
    `Подозрение на двойной счёт: ${extra.suspectedDoubleCounts}`,
    `План записей за сутки (dry-run, баркодов/строк): Ozon ${plan("ozon")}, ЯМ ${plan("ym")}, KIT ${plan("kit")}`,
    extra.siteDiff === null
      ? "Сайт ↔ пул за сутки: не подключён"
      : `Сайт ↔ пул за сутки (витрина не меняется, записи off/dry-run; баркодов/строк): ${extra.siteDiff.barcodes}/${extra.siteDiff.rows}`,
    poolLine(extra.lastPoolRecalcAt, extra.now),
    `Упавших прогонов за сутки: ${extra.failedRuns}, зависших (running > ${STUCK_RUN_MS / 60_000} мин): ${extra.stuckRuns}`,
  ].join("\n")
  return text.length <= MAX_TELEGRAM_TEXT ? text : text.slice(0, MAX_TELEGRAM_TEXT - TRUNCATED_MARK.length) + TRUNCATED_MARK
}

/** Леджер JSON старого синка. Файла нет или он битый — ошибка, а не пустой пул по умолчанию: сверка вслепую хуже, чем её отсутствие. */
function readLedger(path: string): V1Ledger {
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch (e) {
    throw new Error(`леджер старого синка не читается (${path}): ${errorText(e)}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error(`леджер старого синка не разбирается как JSON (${path}): ${errorText(e)}`)
  }
  const items = (parsed as { items?: unknown } | null)?.items
  if (typeof items !== "object" || items === null) throw new Error(`леджер старого синка без поля items (${path})`)
  return { items: items as V1Ledger["items"] }
}

/**
 * Сверка пула sync2 с леджером старого синка + сводка за сутки (упавшие и зависшие
 * прогоны, план записей по площадкам, свежесть пула, шум двойного счёта) — раз в
 * сутки в Telegram. Сводка не доставлена — ошибка: иначе джоба ok, а владелец
 * ничего не получил.
 */
export async function runCompareV1(deps: { db: Db; ledgerPath: string; notifier: Notifier; now: () => Date }): Promise<{
  same: number
  diff: number
  onlyV1: number
  onlyV2: number
  suspectedDoubleCounts: number
  stuckRuns: number
}> {
  const { db } = deps
  const now = deps.now()
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const since = ago(COMPARE_WINDOW_MS)
  // Леджер — до запросов к базе: нет леджера — нет и сверки.
  const ledger = readLedger(deps.ledgerPath)
  const [{ items }, failedRuns, stuckRuns, planned, lastPoolRecalcAt, recentOrderBarcodes, suspectedDoubleCounts, sitePlanned, withSnapshot] = await Promise.all([
    loadPoolState(db),
    countFailedRunsSince(db, since),
    countStuckRunsSince(db, since, ago(STUCK_RUN_MS)),
    plannedWritesSince(db, since),
    lastRunWithCounterAt(db, "pool", "events"),
    mirrorOrderBarcodesSince(db, ago(DOUBLE_COUNT_WINDOW_MINUTES * 60_000)),
    countSuspectedDoubleCounts(db, since),
    // Режим записи сайта в 1.3c — off, в 1.4 — dry-run перед apply: считаются оба.
    plannedWritesSince(db, since, ["off", "dry-run"]),
    channelsWithSnapshotSince(db, since),
  ])
  const siteDiff = withSnapshot.has("site") || sitePlanned.site.rows > 0 ? sitePlanned.site : null

  const result = comparePools(items.map((i) => ({ barcode: i.barcode, base: i.base })), ledger)
  const text = formatComparison(result, { now, failedRuns, stuckRuns, planned, lastPoolRecalcAt, recentOrderBarcodes, suspectedDoubleCounts, siteDiff })
  if (!(await deps.notifier.send(text))) throw new Error("сводка сверки не доставлена в Telegram (бот не настроен или Telegram отказал)")
  return {
    same: result.same,
    diff: result.diff.length,
    onlyV1: result.onlyV1.length,
    onlyV2: result.onlyV2.length,
    suspectedDoubleCounts,
    stuckRuns,
  }
}
