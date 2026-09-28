import {
  counterStreak,
  drizzleWriteStore,
  lastRunCounters,
  lastRunStatus,
  latestStockSnapshots,
  loadChannels,
  loadOrdersSince,
  loadPoolState,
  loadWbChrtIds,
  savePoolRun,
  type Db,
} from "@sync2/db"
import {
  MAX_STOCK_CHANGES_PER_RUN,
  MAX_STOCK_TO_ZERO_PER_RUN,
  WB_SETTLE_MINUTES,
  WB_SETTLE_MINUTES_SELF,
  aggregateStockByBarcode,
  applyWbWriteOutcomes,
  barcodesWithSeveralKeys,
  planStockWrites,
  reconcilePool,
  toPoolOrders,
  wbWriteGate,
  type StockChange,
  type WbWriteResult,
} from "@sync2/domain"
import { WriteJournalError, effectiveMode, executeWrites, failed, type SendResult, type Sender, type WriteOp, type WriteOutcome } from "@sync2/platforms"
import { CHANNELS, CHANNEL_LABELS, errorText, type Channel, type NormalizedStock, type WriteMode } from "@sync2/shared"
import { ORDERS_WINDOW_DAYS } from "./ingest"

/** Снимок старше этого в план не берётся: цель считалась бы от устаревшего остатка площадки. */
export const SNAPSHOT_FRESH_MINUTES = 20
/** Ошибок записи в runs.error — не больше стольких, остальное счётом. */
const MAX_WRITE_ERRORS_SHOWN = 5

/** Зеркала, отсутствие или старость снимка которых считается в staleSnapshots (как в 1.3b). */
const MIRRORS = ["ozon", "ym", "kit"] as const

/**
 * Сайт планируется своим вызовом, как и каждая площадка (этап 1.4). Снимков сайта нет вовсе —
 * сайт не подключён (SITE_API_TOKEN не задан, ingest его не читает): счётчиков сайта нет, пул
 * ведёт себя как до 1.3c. Снимок есть, но старый — siteStale.
 */
const SITE = "site" as const

/**
 * Площадки, чьи заказы входят в пул. Сбой их чтения в последнем ingest запись НЕ блокирует
 * (решение владельца 28.09, п. 1): заказы хранятся в базе, pool пишет по последним известным;
 * уведомление шлёт переход ingest в partial. Здесь — только счётчик mirrorOrdersFailed.
 */
const ORDER_CHANNELS = ["ozon", "ym", "kit", "site"] as const
const LABEL = CHANNEL_LABELS
/** Порядок записи: WB первым — окно между перечитыванием остатка WB и записью короче, фиксация WB раньше. */
const WRITE_ORDER: readonly Channel[] = ["wb", "ozon", "ym", "kit", "site"]

/** Текст отказа WB-позиции без chrtId в каталоге — до сети, в журнал writes. */
export const WB_NO_CHRT_ID = "WB: нет chrtId размера в каталоге (products.wb_chrt_id) — запись невозможна, проверьте карточку WB"

/**
 * Отправитель по умолчанию: без переданного отправителя любая попытка записи — отказ позиции в журнале.
 * Именно отказ, а не «неизвестно»: в сеть ничего не уходило.
 */
export const noSender: Sender = async (_channel, ops) => ops.map((o) => failed(o, "отправитель не передан — запись на площадки невозможна"))

export interface PoolJobResult {
  status: "ok" | "partial"
  counters: Record<string, number>
  error?: string
}

export interface PoolDeps {
  db: Db
  now: () => Date
  runId: string
  globalMode: WriteMode
  /** Отправка на площадки — buildSender (apps/worker/src/senders.ts). Не передан — запись невозможна. */
  send?: Sender
  /** Склад WB, на который пишет sync2 (WB_WAREHOUSE_ID); null или не передан — запись WB невозможна. */
  wbWarehouseId?: number | null
  /** Склад ЯМ, на который пишет sync2 (первый из YM_WAREHOUSE_IDS); null или не передан — запись ЯМ невозможна. */
  ymWarehouseId?: number | null
  /** FBS-склад Ozon, на который пишет sync2 (OZON_WAREHOUSE_ID); null или не передан — запись Ozon невозможна. */
  ozonWarehouseId?: number | null
}

/**
 * FBS-склады Ozon в снимке, кроме склада записи. Снимок Ozon несёт склады в поле warehouse
 * («fbs:<id,…>», ozon/mapper.ts); «fbs» без списка — площадка склады не назвала, не чужой.
 */
export function ozonForeignWarehouses(stocks: NormalizedStock[], warehouseId: number): string[] {
  const own = String(warehouseId)
  const ids = new Set<string>()
  for (const s of stocks) {
    const list = s.warehouse?.startsWith("fbs:") ? s.warehouse.slice(4).split(",") : []
    for (const id of list) if (id && id !== own) ids.add(id)
  }
  return [...ids].sort()
}

/**
 * Склады в снимке площадки, кроме склада записи. Остаток площадки в плане — сумма её складов в
 * снимке (WB — все склады продавца, ЯМ — все склады из YM_WAREHOUSE_IDS), а пишем мы на один: при
 * втором складе цель «пул» на одном складе дала бы сумму больше пула. Склад записи не задан — чужие
 * все склады снимка.
 */
export function foreignWarehouses(stocks: NormalizedStock[], warehouseId: number | null): string[] {
  const own = warehouseId === null ? null : String(warehouseId)
  return [...new Set(stocks.map((s) => s.warehouse ?? "без склада"))].filter((w) => w !== own).sort()
}


/**
 * WB-позиции без ключа записи (chrtId) отказываются здесь, до отправителя: причина в журнале —
 * понятная, а не общее «нет ключа», и отправитель WB не читает остаток ради заведомого отказа.
 * Сбой отправителя по остальным — итог неизвестен у них, отказ без ключа остаётся отказом.
 */
function withWbKeyCheck(send: Sender): Sender {
  return async (channel, ops) => {
    if (channel !== "wb") return send(channel, ops)
    const noKey = ops.filter((o) => o.externalSku === null)
    const rest = ops.filter((o) => o.externalSku !== null)
    const results: SendResult[] = noKey.map((o) => failed(o, WB_NO_CHRT_ID))
    if (rest.length === 0) return results
    try {
      const sent = await send(channel, rest)
      if (!Array.isArray(sent)) throw new Error("площадка вернула ответ не списком")
      results.push(...sent)
    } catch (e: unknown) {
      for (const o of rest) results.push(failed(o, errorText(e), { uncertain: true }))
    }
    return results
  }
}

/**
 * Прогон пула (этап 1.4): пересчёт → план записей по каждой площадке отдельно → запись.
 *
 * WB пишет sync2 (режим self) ровно тогда, когда у WB действующий apply; иначе WB пишет старый
 * синк (external, семантика finstock). В self: шлюз WB по состоянию ДО прогона, приём сигнала
 * через WB_SETTLE_MINUTES_SELF, план WB с удержанием непринятых баркодов, и ожидание WB — по итогам
 * записи (applyWbWriteOutcomes). Пул фиксируется ДО сети с итогом «неизвестно» для уходящих
 * WB-позиций и второй раз — по фактическим итогам: процесс, убитый между записью и фиксацией
 * (timeout крона, OOM), оставляет безопасное ожидание max(база, факт).
 *
 * Блокировки прогона (площадка в журнале как dry-run, в сеть не уходит, partial с текстом;
 * действуют только на площадки в apply — в dry-run/off ничего не меняют):
 * отклонённый каталог WB в последнем ingest — все площадки; витрина сайта не на пуле — сайт;
 * второй склад WB или не задан склад записи — WB. Сбой чтения заказов зеркала — НЕ блокировка
 * (решение владельца 28.09, п. 1), только счётчик mirrorOrdersFailed.
 */
export async function runPool(deps: PoolDeps): Promise<PoolJobResult> {
  const { db, runId } = deps
  const now = deps.now()
  const nowIso = now.toISOString()
  const counters: Record<string, number> = {}
  const channels = await loadChannels(db)
  const missing = CHANNELS.filter((c) => !channels.has(c))
  if (missing.length > 0) throw new Error(`площадки не заведены — выполните seed-channels (нет: ${missing.join(", ")})`)
  const channelId = (c: Channel) => channels.get(c)!.id

  // Действующий режим площадки — меньший из глобального и её собственного (как в executeWrites).
  const configured = Object.fromEntries(CHANNELS.map((c) => [c, effectiveMode(deps.globalMode, channels.get(c)!.writeMode)])) as Record<Channel, WriteMode>
  // Откат WB в dry-run возвращает семантику external сам, без отдельного переключателя.
  const wbSelf = configured.wb === "apply"
  const settle = wbSelf ? WB_SETTLE_MINUTES_SELF : WB_SETTLE_MINUTES
  counters.wbSelf = wbSelf ? 1 : 0

  const snaps = await latestStockSnapshots(db)
  const fresh = (takenAt: string) => now.getTime() - Date.parse(takenAt) <= SNAPSHOT_FRESH_MINUTES * 60_000

  const wb = snaps.get(channelId("wb"))
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

  // Шлюз WB — по состоянию ДО прогона (wb-expectation.ts).
  const gate = wbWriteGate(state.items, wb, settle)
  const rows = await loadOrdersSince(db, new Date(now.getTime() - ORDERS_WINDOW_DAYS * 86_400_000).toISOString())
  const { orders, skipped } = toPoolOrders(rows, channelId("wb"))
  const result = reconcilePool({
    now: nowIso,
    items: state.items,
    wbSnapshot: wb,
    orders,
    applied: state.applied,
    cancelledApplied: state.cancelledApplied,
    settleMinutes: settle,
  })
  counters.events = result.events.length
  counters.ordersNoBarcode = skipped.noBarcode
  counters.noBase = result.skipped.noBase

  // ── Блокировки записи этого прогона ──
  const modes: Record<Channel, WriteMode> = { ...configured }
  const problems: string[] = []
  const block = (list: readonly Channel[], counter: string, text: string) => {
    let hit = false
    for (const c of list) {
      if (modes[c] !== "apply") continue
      modes[c] = "dry-run"
      hit = true
    }
    if (!hit) return
    counters[counter] = 1
    problems.push(text)
  }
  /**
   * Блок по складам записи: в apply — как block; площадка в dry-run — только счётчик, без текста и partial:
   * так «чужой склад»/«не задан склад записи» видно в plan/drift ещё до переключения (шаг B).
   */
  const blockWarehouse = (c: Channel, counter: string, text: string) => {
    if (configured[c] === "off") return
    if (modes[c] === "apply") block([c], counter, text)
    else counters[counter] = 1
  }
  const ingestCounters = (await lastRunCounters(db, "ingest")) ?? {}
  const failedOrders = ORDER_CHANNELS.filter((c) => ingestCounters[`${c}OrdersFailed`] === 1)
  if (failedOrders.length > 0) counters.mirrorOrdersFailed = failedOrders.length
  if (ingestCounters.catalogRejected === 1) {
    block(CHANNELS, "writesBlockedCatalog", "запись остатков не делалась: каталог WB отклонён в последнем ingest — заказы и снимки не прочитаны")
  }
  if (ingestCounters.siteSourcePool !== 1) {
    block(
      [SITE],
      "siteWriteBlocked",
      ingestCounters.siteSourcePool === undefined
        ? "сайт: снимок витрины не прочитан в последнем ingest — источник остатка витрины неизвестен, запись сайта не делалась"
        : "сайт: витрина берёт остаток не из пула (STOCK_SOURCE≠pool) — запись сайта не делалась",
    )
  }
  const wbWarehouseId = deps.wbWarehouseId ?? null
  const foreign = foreignWarehouses(wb.stocks, wbWarehouseId)
  if (foreign.length > 0) {
    blockWarehouse(
      "wb",
      "wbForeignWarehouse",
      wbWarehouseId === null
        ? "WB: не задан WB_WAREHOUSE_ID — запись WB не делалась"
        : `WB: в снимке склады ${foreign.join(", ")} помимо склада записи ${wbWarehouseId} — запись WB не делалась`,
    )
  }
  const ozonSnap = snaps.get(channelId("ozon"))
  const ozonWarehouseId = deps.ozonWarehouseId ?? null
  if (ozonWarehouseId === null) {
    blockWarehouse("ozon", "ozonForeignWarehouse", "Ozon: не задан OZON_WAREHOUSE_ID — запись Ozon не делалась")
  } else if (ozonSnap && fresh(ozonSnap.takenAt)) {
    const ozonForeign = ozonForeignWarehouses(ozonSnap.stocks, ozonWarehouseId)
    if (ozonForeign.length > 0) {
      blockWarehouse(
        "ozon",
        "ozonForeignWarehouse",
        `Ozon: в снимке склады FBS ${ozonForeign.join(", ")} помимо склада записи ${ozonWarehouseId} — запись Ozon не делалась`,
      )
    }
  }
  const ymSnap = snaps.get(channelId("ym"))
  const ymWarehouseId = deps.ymWarehouseId ?? null
  const ymForeign = ymSnap && fresh(ymSnap.takenAt) ? foreignWarehouses(ymSnap.stocks, ymWarehouseId) : []
  if (ymForeign.length > 0) {
    blockWarehouse(
      "ym",
      "ymForeignWarehouse",
      ymWarehouseId === null
        ? "ЯМ: не задан склад записи (YM_WAREHOUSE_IDS) — запись ЯМ не делалась"
        : `ЯМ: в снимке склады ${ymForeign.join(", ")} помимо склада записи ${ymWarehouseId} — запись ЯМ не делалась`,
    )
  }

  // ── Планы: каждая площадка — отдельный вызов со своими предохранителями ──
  // WB первым: окно между перечитыванием остатка WB в отправителе и записью короче.
  const targets: Array<{ channel: Channel; stocks: NormalizedStock[] }> = []
  if (configured.wb !== "off") targets.push({ channel: "wb", stocks: wb.stocks })
  let stale = 0
  for (const c of MIRRORS) {
    const snap = snaps.get(channelId(c))
    if (snap && fresh(snap.takenAt)) targets.push({ channel: c, stocks: snap.stocks })
    else stale++
  }
  counters.staleSnapshots = stale
  const siteSnap = snaps.get(channelId(SITE))
  if (siteSnap && !fresh(siteSnap.takenAt)) counters.siteStale = 1
  else if (siteSnap) targets.push({ channel: SITE, stocks: siteSnap.stocks })

  const limits = { maxChanges: MAX_STOCK_CHANGES_PER_RUN, maxToZero: MAX_STOCK_TO_ZERO_PER_RUN }
  const changes: StockChange[] = []
  for (const t of targets) {
    // Штрихкод на нескольких товарах зеркала — не пишем (ключ WB — chrtId из каталога, сайт — штрихкод).
    let hold: Map<Channel, ReadonlySet<string>> | undefined = t.channel === "wb" ? gate.hold : undefined
    if (t.channel !== "wb" && t.channel !== SITE) {
      const dup = barcodesWithSeveralKeys(t.stocks)
      if (dup.size > 0) {
        hold = new Map([[t.channel, new Set(dup.keys())]])
        counters[`${t.channel}DupKey`] = dup.size
        if (configured[t.channel] === "apply") {
          const shown = [...dup].slice(0, MAX_WRITE_ERRORS_SHOWN).map(([barcode, keys]) => `${barcode} (${keys.join(", ")})`)
          const rest = dup.size > shown.length ? `, … ещё ${dup.size - shown.length}` : ""
          problems.push(`${LABEL[t.channel]}: штрихкод на нескольких товарах площадки — запись не делается: ${shown.join(", ")}${rest}`)
        }
      }
    }
    const plan = planStockWrites(result.items, [t], hold ? { ...limits, hold } : limits)
    if (plan.aborted) {
      counters[`${t.channel}Aborted_${plan.aborted.reason}`] = plan.aborted.count
      problems.push(`${LABEL[t.channel]}: план отклонён предохранителем (${plan.aborted.reason}: ${plan.aborted.count} при пределе ${plan.aborted.max})`)
      continue
    }
    changes.push(...plan.changes)
  }

  // Ключ записи: WB — chrtId размера из каталога (снимок WB несёт артикул, а не chrtId); сайт —
  // сам штрихкод; остальные — ключ из снимка (offer_id Ozon, offerId ЯМ, id варианта KIT).
  const chrtIds = changes.some((c) => c.channel === "wb") ? await loadWbChrtIds(db) : new Map<string, number>()
  const ops: WriteOp[] = changes.map((c) => ({
    channel: c.channel,
    barcode: c.barcode,
    field: "stock",
    before: c.before,
    after: c.after,
    externalSku: c.channel === "wb" ? (chrtIds.get(c.barcode)?.toString() ?? null) : c.channel === SITE ? c.barcode : c.externalSku,
  }))
  const wbNoChrtId = ops.filter((o) => o.channel === "wb" && o.externalSku === null).length
  if (wbNoChrtId > 0) counters.wbNoChrtId = wbNoChrtId

  // ── Фиксация пула и запись ──
  const wbActual = new Map([...aggregateStockByBarcode(wb.stocks)].map(([barcode, a]) => [barcode, a.quantity]))
  const itemsAfter = (results: ReadonlyMap<string, WbWriteResult>) =>
    wbSelf ? applyWbWriteOutcomes(result.items, state.items, gate.accepted, wbActual, results, nowIso) : result.items
  // До сети: уходящие на WB позиции — «итог неизвестен». Позиции без chrtId в сеть не уйдут.
  const pending = new Map<string, WbWriteResult>()
  if (modes.wb === "apply") for (const o of ops) if (o.channel === "wb" && o.externalSku !== null) pending.set(o.barcode, "unknown")
  await savePoolRun(db, { runId, items: itemsAfter(pending), events: result.events })

  // Запись — площадка за площадкой, WB первым, каждая своим executeWrites: журнал площадки пишется
  // сразу после её записи, а итоги WB фиксируются в пуле до зеркал — зависший или упавший запрос
  // зеркала и сбой журнала не задерживают и не теряют фиксацию WB (ревью ядра 1.4, I2).
  const send = withWbKeyCheck(deps.send ?? noSender)
  const record = drizzleWriteStore(db, runId, channels)
  const outcomes: WriteOutcome[] = []
  if (wbSelf) counters.wbWriteUnknown = 0
  for (const c of WRITE_ORDER) {
    const channelOps = ops.filter((o) => o.channel === c)
    if (channelOps.length === 0) continue
    let channelOutcomes: WriteOutcome[]
    try {
      channelOutcomes = await executeWrites(channelOps, { globalMode: deps.globalMode, channelModes: modes, send, record })
    } catch (e: unknown) {
      if (!(e instanceof WriteJournalError)) throw e
      // На площадке изменения уже могли пройти — итоги едут вместе с ошибкой: по ним фиксируем пул,
      // а строки журнала этой площадки потеряны — partial с текстом.
      channelOutcomes = e.outcomes
      counters.journalErrors = (counters.journalErrors ?? 0) + 1
      problems.push(`журнал записей ${LABEL[c]} не сохранён: ${errorText(e.cause)}`)
    }
    outcomes.push(...channelOutcomes)
    if (c === "wb" && wbSelf) {
      const results = new Map<string, WbWriteResult>()
      for (const o of channelOutcomes) {
        if (o.mode !== "apply") continue
        results.set(o.barcode, o.applied ? "applied" : o.uncertain ? "unknown" : "failed")
      }
      await savePoolRun(db, { runId, items: itemsAfter(results), events: [] })
      counters.wbWriteUnknown = [...results.values()].filter((r) => r === "unknown").length
    }
  }

  if (configured.wb !== "off") counters.wbPlanned = outcomes.filter((o) => o.channel === "wb").length
  for (const c of MIRRORS) counters[`${c}Planned`] = outcomes.filter((o) => o.channel === c).length
  if (siteSnap) counters[`${SITE}Planned`] = outcomes.filter((o) => o.channel === SITE).length
  for (const c of CHANNELS) {
    const applied = outcomes.filter((o) => o.channel === c && o.applied).length
    if (applied > 0) counters[`${c}Applied`] = applied
    // Запись площадки не проходит (отказ или итог неизвестен) — счётчик и длина серии прогонов подряд:
    // по ней CLI шлёт «площадка X: запись не проходит N тиков подряд» (transition.ts, writeFailureAlerts).
    // Серия считается только по прогонам, где запись площадки реально пыталась (`WriteAttempted`):
    // ранний выход pool (noFreshWb, coldStartRefused) её не обрывает и не даёт «снова проходит».
    const attempted = outcomes.filter((o) => o.channel === c && o.mode === "apply").length
    if (attempted === 0) continue
    counters[`${c}WriteAttempted`] = attempted
    const writeFailed = outcomes.filter((o) => o.channel === c && o.mode === "apply" && o.error !== null).length
    const before = await counterStreak(db, "pool", `${c}WriteFailed`, `${c}WriteAttempted`)
    if (writeFailed > 0) {
      counters[`${c}WriteFailed`] = writeFailed
      counters[`${c}WriteFailedRuns`] = before + 1
    } else if (before > 0) {
      counters[`${c}WriteRecoveredAfter`] = before
    }
  }

  const failedOutcomes = outcomes.filter((o) => o.error !== null)
  if (failedOutcomes.length > 0) {
    counters.writeErrors = failedOutcomes.length
    const shown = failedOutcomes.slice(0, MAX_WRITE_ERRORS_SHOWN).map((o) => `${o.channel} ${o.barcode}: ${o.error}`)
    const rest = failedOutcomes.length > shown.length ? `; … ещё ${failedOutcomes.length - shown.length}` : ""
    problems.push(`ошибки записи: ${shown.join("; ")}${rest}`)
  }
  if (problems.length > 0) return { status: "partial", counters, error: problems.join("; ") }
  return { status: "ok", counters }
}
