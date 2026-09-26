import type { PoolItemState } from "./pool"

/**
 * Задержка приёма сигнала WB, когда WB пишет сам синк: запись применяется в
 * том же прогоне, и следующий снимок уже её видит. 2 минуты — запас на
 * распространение остатка внутри WB. При чужой записи (старый sync/) действует
 * WB_SETTLE_MINUTES из pool.ts.
 */
export const WB_SETTLE_MINUTES_SELF = 2

/**
 * Режим «WB пишет sync2»: reconcilePool ставит ожидание WB равным базе, как
 * будто запись точно дойдёт. После записи ожидание поправляется по факту:
 * применилась → база; не применилась или не отправлялась → то, что стоит на
 * WB по снимку. Иначе неудачная запись в следующем снимке выглядела бы
 * пополнением, и синк продал бы единицу, которой нет.
 *
 * @param wbActual остаток WB по снимку, из которого считался пул (баркод → количество)
 * @param applied баркоды, запись остатка которых на WB применилась в этом прогоне
 */
export function applyWbWriteOutcomes(
  items: PoolItemState[],
  wbActual: ReadonlyMap<string, number>,
  applied: ReadonlySet<string>,
): PoolItemState[] {
  return items.map((item) => ({
    ...item,
    wbExpected: applied.has(item.barcode) ? item.base : (wbActual.get(item.barcode) ?? 0),
  }))
}
