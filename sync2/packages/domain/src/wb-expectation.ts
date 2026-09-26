import type { Channel, NormalizedStock } from "@sync2/shared"
import type { PoolItemState } from "./pool"
import { aggregateStockByBarcode } from "./stock"

/**
 * Задержка приёма сигнала WB, когда WB пишет сам синк: запись применяется в
 * том же прогоне, и следующий снимок уже её видит. 2 минуты — запас на
 * распространение остатка внутри WB. При чужой записи (старый sync/) действует
 * WB_SETTLE_MINUTES из pool.ts.
 */
export const WB_SETTLE_MINUTES_SELF = 2

/**
 * Принят ли в этом прогоне сигнал WB по баркоду — то же условие, что внутри
 * `reconcilePool` (снимок новее принятого и снят не раньше `expectedAt +
 * settle`), но проверяется по состоянию ДО прогона: applyWbWriteOutcomes
 * вызывается после reconcilePool, а его свежие `expectedAt`/`wbSnapshotAt` уже
 * не годятся для этого вопроса — «а этот прогон вообще увидел сигнал WB по
 * этому баркоду, или снимок был старый/неустоявшийся?».
 * Нет состояния — холодный старт из этого снимка, считается принятым.
 */
export function wbSignalAccepted(prev: PoolItemState | undefined, snapshotTakenAt: string, settleMinutes: number): boolean {
  if (!prev) return true
  const at = Date.parse(snapshotTakenAt)
  const isNew = prev.wbSnapshotAt === null || Date.parse(prev.wbSnapshotAt) < at
  const settled = prev.expectedAt === null || at >= Date.parse(prev.expectedAt) + settleMinutes * 60_000
  return isNew && settled
}

/**
 * Баркоды, чей сигнал WB принят в этом прогоне — по объединению состояния до
 * прогона и баркодов снимка (сирота снимка без состояния — холодный старт,
 * тоже принят).
 */
export function acceptedWbBarcodes(
  prevItems: PoolItemState[],
  snapshotBarcodes: Iterable<string>,
  snapshotTakenAt: string,
  settleMinutes: number,
): Set<string> {
  const prevByBarcode = new Map(prevItems.map((i) => [i.barcode, i]))
  const barcodes = new Set<string>(prevByBarcode.keys())
  for (const barcode of snapshotBarcodes) barcodes.add(barcode)

  const accepted = new Set<string>()
  for (const barcode of barcodes) {
    if (wbSignalAccepted(prevByBarcode.get(barcode), snapshotTakenAt, settleMinutes)) accepted.add(barcode)
  }
  return accepted
}

/**
 * Шлюз перед записью на WB: какие баркоды приняты в этом прогоне (`accepted`),
 * и что поэтому нельзя писать на площадку "wb" прямо сейчас (`hold` — готов к
 * передаче в `planStockWrites`). Это единственный законный способ построить
 * удержание для WB: запись по баркоду, минуя это удержание, — ошибка, которую
 * `applyWbWriteOutcomes` отклоняет исключением (см. ниже).
 */
export function wbWriteGate(
  prevItems: PoolItemState[],
  wbSnapshot: { takenAt: string; stocks: NormalizedStock[] },
  settleMinutes: number,
): { accepted: Set<string>; hold: Map<Channel, Set<string>> } {
  const snapshotBarcodes = [...aggregateStockByBarcode(wbSnapshot.stocks).keys()]
  const accepted = acceptedWbBarcodes(prevItems, snapshotBarcodes, wbSnapshot.takenAt, settleMinutes)

  const universe = new Set<string>(prevItems.map((i) => i.barcode))
  for (const barcode of snapshotBarcodes) universe.add(barcode)

  const notAccepted = new Set<string>()
  for (const barcode of universe) if (!accepted.has(barcode)) notAccepted.add(barcode)

  return { accepted, hold: new Map<Channel, Set<string>>([["wb", notAccepted]]) }
}

/** Итог попытки записать остаток баркода на WB в этом прогоне. */
export type WbWriteResult = "applied" | "failed" | "unknown"

/**
 * Режим «WB пишет sync2»: `reconcilePool` форсирует wbExpected = новая база
 * для КАЖДОГО баркода, как будто запись точно дойдёт, — независимо от того,
 * принят ли в этом прогоне сигнал WB по этому баркоду. После попытки записи
 * ожидание поправляется по факту — по четырём сценариям:
 *
 * 1. Баркод не принят в этом прогоне (`accepted` не содержит его — см.
 *    `wbWriteGate`, площадка "wb" держит его через `hold`, поэтому WB по нему
 *    в этом прогоне не писали). Но reconcilePool всё равно форсировал
 *    wbExpected = новая база: если оставить это значение, следующий прогон
 *    сравнит его с фактом WB и придумает несуществующую дельту. Возвращаем
 *    ПРЕЖНЕЕ ожидание (до этого прогона, `prevItems`) — оно всё ещё
 *    описывает то, что мы на самом деле ждём увидеть на WB; момент правки
 *    (`expectedAt`), который reconcilePool мог выставить в этом же прогоне
 *    (например, из-за заказа зеркала), не трогаем.
 * 2. Запись отправлена, но итог неизвестен (таймаут) — не считаем её ни
 *    успешной, ни провалившейся. Если фактический остаток на WB (по тому же
 *    снимку) больше базы — берём факт: писать базу означало бы поверить в
 *    несостоявшуюся запись и создать фантомный остаток, которого на складе
 *    может не быть. Если факт меньше базы — берём базу: потеря здесь —
 *    ложное списание, а не фантомная продажа, но она НЕ восстановится сама
 *    следующим прогоном (заниженное ожидание совпадёт с фактом, и сигнала не
 *    придёт) — понадобится ручная правка; это всё равно безопаснее.
 * 3. Запись применилась — ожидание становится равным базе, а момент правки —
 *    «сейчас»: окно устаканивания (`expectedAt + settle`) должно накрыть
 *    задержку распространения остатка внутри самого WB. Без этого следующий
 *    снимок, снятый до того, как WB разнёс изменение, прочитался бы как
 *    отставание = пополнение.
 * 4. Запись провалилась или не отправлялась вовсе — доверяем факту с WB,
 *    момент прежней правки не двигаем (устаканивание отсчитывается от неё).
 *
 * @param items состояние ПОСЛЕ reconcilePool
 * @param prevItems состояние ДО этого прогона — источник прежнего ожидания для непринятых баркодов (сценарий 1)
 * @param accepted баркоды, чей сигнал WB принят в этом прогоне — результат wbWriteGate/acceptedWbBarcodes по состоянию ДО прогона
 * @param wbActual остаток WB по снимку, из которого считался пул (баркод → количество)
 * @param results баркод → итог попытки записи на WB; нет в карте — запись не отправлялась
 * @param now момент правки ожидания, ISO — параметр, а не часы: функция чистая
 */
export function applyWbWriteOutcomes(
  items: PoolItemState[],
  prevItems: PoolItemState[],
  accepted: ReadonlySet<string>,
  wbActual: ReadonlyMap<string, number>,
  results: ReadonlyMap<string, WbWriteResult>,
  now: string,
): PoolItemState[] {
  // Fail fast: итог записи по непринятому баркоду означает, что шлюз
  // (wbWriteGate → hold → planStockWrites) обошли, и WB всё-таки написали
  // тогда, когда писать было нельзя.
  for (const barcode of results.keys()) {
    if (!accepted.has(barcode)) throw new Error(`запись WB по неподтверждённому баркоду: ${barcode}`)
  }

  const prevByBarcode = new Map(prevItems.map((i) => [i.barcode, i]))

  return items.map((item) => {
    if (!accepted.has(item.barcode)) {
      const prev = prevByBarcode.get(item.barcode)
      return { ...item, wbExpected: prev?.wbExpected ?? item.base }
    }

    const actual = wbActual.get(item.barcode) ?? 0
    const result = results.get(item.barcode)

    if (result === "applied") return { ...item, wbExpected: item.base, expectedAt: now }
    if (result === "unknown") return { ...item, wbExpected: Math.max(item.base, actual), expectedAt: now }
    // "failed" или запись не отправлялась вовсе — доверяем факту, момент прежней правки не двигаем.
    return { ...item, wbExpected: actual }
  })
}
