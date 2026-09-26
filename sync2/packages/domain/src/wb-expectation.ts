import type { PoolItemState } from "./pool"

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

/** Итог попытки записать остаток барcoда на WB в этом прогоне. */
export type WbWriteResult = "applied" | "failed" | "unknown"

/**
 * Режим «WB пишет sync2»: `reconcilePool` ставит ожидание WB равным базе, как
 * будто запись точно дойдёт. После попытки записи ожидание поправляется по
 * факту — по трём сценариям, из-за которых наивное «применилась → база, иначе
 * → факт» ломается:
 *
 * 1. Баркод не принят в этом прогоне (`accepted` не содержит его) — значит
 *    снимок, из которого считался пул, либо старый, либо ещё не устоялся
 *    после прошлой правки. На WB могла случиться отложенная продажа, которую
 *    этот снимок ещё не видел; затереть её нашей записью — потерять сигнал.
 *    Состояние reconcile не трогаем: следующий свежий снимок сам разберётся.
 * 2. Запись отправлена, но итог неизвестен (таймаут) — не считаем её ни
 *    успешной, ни провалившейся. Если фактический остаток на WB (по тому же
 *    снимку) больше базы — берём факт: писать базу означало бы поверить в
 *    несостоявшуюся запись и создать фантомный остаток, которого на складе
 *    может не быть. Если факт меньше базы — берём базу: здесь хуже — ложное
 *    списание на один прогон, а не продажа несуществующей единицы.
 * 3. Запись применилась — ожидание становится равным базе, а момент правки —
 *    «сейчас»: окно устаканивания (`expectedAt + settle`) должно накрыть
 *    задержку распространения остатка внутри самого WB. Без этого следующий
 *    снимок, снятый до того, как WB разнёс изменение, прочитался бы как
 *    отставание = пополнение.
 *
 * @param items состояние ПОСЛЕ reconcilePool
 * @param accepted баркоды, чей сигнал WB принят в этом прогоне — результат acceptedWbBarcodes по состоянию ДО прогона
 * @param wbActual остаток WB по снимку, из которого считался пул (баркод → количество)
 * @param results баркод → итог попытки записи на WB; нет в карте — запись не отправлялась
 * @param now момент правки ожидания, ISO — параметр, а не часы: функция чистая
 */
export function applyWbWriteOutcomes(
  items: PoolItemState[],
  accepted: ReadonlySet<string>,
  wbActual: ReadonlyMap<string, number>,
  results: ReadonlyMap<string, WbWriteResult>,
  now: string,
): PoolItemState[] {
  return items.map((item) => {
    if (!accepted.has(item.barcode)) return { ...item }

    const actual = wbActual.get(item.barcode) ?? 0
    const result = results.get(item.barcode)

    if (result === "applied") return { ...item, wbExpected: item.base, expectedAt: now }
    if (result === "unknown") return { ...item, wbExpected: Math.max(item.base, actual), expectedAt: now }
    // "failed" или запись не отправлялась вовсе — доверяем факту, момент прежней правки не двигаем.
    return { ...item, wbExpected: actual }
  })
}
