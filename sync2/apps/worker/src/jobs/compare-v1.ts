import { readFileSync } from "node:fs"
import { countFailedRunsSince, loadPoolState, plannedWritesSince, type Db } from "@sync2/db"
import { errorText, type Channel } from "@sync2/shared"
import type { Notifier } from "../notify"

/** Сутки — окно сводки compare-v1: и для упавших запусков, и для плана записей. */
export const COMPARE_WINDOW_MS = 24 * 60 * 60 * 1000

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

const MAX_DIFF_LINES = 10

function formatList(items: string[]): string {
  return items.length === 0 ? "—" : items.join(", ")
}

/** Короткая сводка для Telegram — не отчёт с рекомендацией, а числа для решения владельца. */
export function formatComparison(r: ComparisonResult, extra: { failedRuns: number; planned: Record<Channel, number> }): string {
  const total = r.same + r.diff.length + r.onlyV1.length + r.onlyV2.length
  const shown = r.diff.slice(0, MAX_DIFF_LINES).map((d) => `${d.barcode}: старый ${d.v1}, новый ${d.v2}`)
  const diffTail = r.diff.length > MAX_DIFF_LINES ? `, … (ещё ${r.diff.length - MAX_DIFF_LINES})` : ""
  const diffLine = r.diff.length === 0 ? "расходится 0" : `расходится ${r.diff.length}: ${shown.join(", ")}${diffTail}`
  const onlyV1Line = formatList(r.onlyV1.map((i) => `${i.barcode} (${i.v1})`))
  const onlyV2Line = formatList(r.onlyV2.map((i) => `${i.barcode} (${i.v2})`))

  return [
    "🔎 sync2 ↔ старый синк, сверка пула",
    `совпадает ${r.same} из ${total}`,
    diffLine,
    `Только у старого: ${onlyV1Line}  Только у нового: ${onlyV2Line}`,
    `План записей за сутки (dry-run): Ozon ${extra.planned.ozon}, ЯМ ${extra.planned.ym}, KIT ${extra.planned.kit}`,
    `Упавших прогонов за сутки: ${extra.failedRuns}`,
  ].join("\n")
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
 * Сверка пула sync2 с леджером старого синка + сводка за сутки (упавшие
 * прогоны, план записей по площадкам) — раз в сутки в Telegram.
 */
export async function runCompareV1(deps: { db: Db; ledgerPath: string; notifier: Notifier; now: () => Date }): Promise<{
  same: number
  diff: number
  onlyV1: number
  onlyV2: number
}> {
  const since = new Date(deps.now().getTime() - COMPARE_WINDOW_MS).toISOString()
  const [{ items }, ledger, failedRuns, planned] = await Promise.all([
    loadPoolState(deps.db),
    Promise.resolve(readLedger(deps.ledgerPath)),
    countFailedRunsSince(deps.db, since),
    plannedWritesSince(deps.db, since),
  ])

  const result = comparePools(items.map((i) => ({ barcode: i.barcode, base: i.base })), ledger)
  await deps.notifier.send(formatComparison(result, { failedRuns, planned }))
  return { same: result.same, diff: result.diff.length, onlyV1: result.onlyV1.length, onlyV2: result.onlyV2.length }
}
