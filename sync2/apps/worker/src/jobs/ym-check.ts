import { drizzleWriteStore, loadChannels, type Db } from "@sync2/db"
import { executeWrites, fetchYmBarcodes, fetchYmOfferStock, writeYmStocks, ymStocksBody, type WriteOp, type YmStockEntry, type YmStockWriterConfig } from "@sync2/platforms"
import { CHANNELS, type Channel, type WriteMode } from "@sync2/shared"

export interface YmCheckResult {
  /** Код выхода CLI: 0 — проверка прошла (или предпросмотр), 1 — запись не прошла, 2 — проверять нечего. */
  code: 0 | 1 | 2
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}

/** Остаток, который пишет отправитель ЯМ (`type: "FIT"`), — его и перезаписываем тем же числом. */
const fitCount = (entries: YmStockEntry[] | null): number | null => entries?.find((e) => e.type === "FIT")?.count ?? null

/**
 * Живая проверка тела записи ЯМ на одном оффере перед шагом B (решение владельца 28.09, п. 6).
 * Без confirm — только чтение: текущий остаток (FIT) оффера на складе записи и тело запроса, которое
 * соберёт `ymStocksBody` (то же, что уйдёт в сеть: `writeYmStocks` собирает его той же функцией с тем же
 * моментом `now`). С confirm — запись ТОГО ЖЕ числа через `writeYmStocks` (остаток не меняется), чтение
 * обратно; успех — status OK и прочитанное число не изменилось. Запись идёт через executeWrites с режимом
 * ЯМ apply только для этой команды (площадка до шага B в dry-run; глобальный SYNC_WRITE_MODE главнее) —
 * строка в журнале `writes` (before = after), прогон в `runs` с job «ym-check» — признак проверки.
 */
export async function runYmCheck(deps: {
  db: Db
  runId: string
  globalMode: WriteMode
  now: () => Date
  cfg: YmStockWriterConfig
  offerId: string
  confirm: boolean
  print: (line: string) => void
}): Promise<YmCheckResult> {
  const { cfg, offerId, print } = deps
  const current = fitCount(await fetchYmOfferStock(cfg, offerId, cfg.warehouseId))
  if (current === null) {
    return { code: 2, status: "partial", counters: {}, error: `ЯМ: оффер ${offerId} не найден на складе записи ${cfg.warehouseId} (нет записи остатка FIT) — проверять нечего` }
  }
  const now = deps.now()
  print(`ЯМ ${offerId}: склад ${cfg.warehouseId}, остаток сейчас ${current}; тело записи (ymStocksBody):`)
  print(JSON.stringify(ymStocksBody([{ offerId, count: current }], cfg.warehouseId, now.toISOString())))
  const counters: Record<string, number> = { current }
  if (!deps.confirm) {
    print("предпросмотр: в сеть ничего не записано; запись того же числа — с --confirm")
    return { code: 0, status: "ok", counters }
  }
  if (deps.globalMode !== "apply") {
    return { code: 1, status: "partial", counters, error: `запись не делалась: SYNC_WRITE_MODE=${deps.globalMode}` }
  }

  const barcode = (await fetchYmBarcodes(cfg, [offerId])).get(offerId)?.[0] ?? offerId
  const op: WriteOp = { channel: "ym", barcode, field: "stock", before: current, after: current, externalSku: offerId }
  const channelModes = Object.fromEntries(CHANNELS.map((c) => [c, c === "ym" ? "apply" : "off"])) as Record<Channel, WriteMode>
  const [outcome] = await executeWrites([op], {
    globalMode: deps.globalMode,
    channelModes,
    send: (_c, ops) => writeYmStocks({ ...cfg, now: () => now }, ops),
    record: drizzleWriteStore(deps.db, deps.runId, await loadChannels(deps.db)),
  })
  const status = (outcome?.response as { status?: unknown } | null)?.status
  const readBack = fitCount(await fetchYmOfferStock(cfg, offerId, cfg.warehouseId))
  counters.applied = outcome?.applied ? 1 : 0
  if (readBack !== null) counters.readBack = readBack
  print(`итог: ${outcome?.applied ? `status ${String(status ?? "OK")}` : `ошибка: ${outcome?.error ?? "нет итога"}`}, прочитано ${readBack ?? "—"}`)
  if (outcome?.applied && readBack === current) return { code: 0, status: "ok", counters }
  const why = !outcome?.applied ? `запись не принята: ${outcome?.error ?? "нет итога"}` : `прочитано ${readBack ?? "—"}, ожидалось ${current}`
  return { code: 1, status: "partial", counters, error: `ЯМ ${offerId}: проверка не прошла — ${why}` }
}
