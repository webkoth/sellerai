import { and, count, eq, exists, gte, inArray, lt, ne, sql } from "drizzle-orm"
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core"
import type { Db } from "./client"
import { poolEvents } from "./schema"

/**
 * Окно шума двойного счёта — одно для метрики и для пометки у строк diff. В режиме
 * external старый синк списывает WB по заказу зеркала раньше, чем sync2 видит этот
 * заказ: снимок WB уже на единицу меньше (сигнал WB), потом приходит сам заказ — в
 * пуле sync2 минус два. Исправляющий сигнал WB приходит не раньше WB_SETTLE_MINUTES
 * (20) после заказа, и ещё до двух тиков (по 10 мин): снимок WB снимается внутри
 * ingest, а occurredAt всех событий — момент начала pool. Отсюда 40.
 */
export const DOUBLE_COUNT_WINDOW_MINUTES = 40

/**
 * Заказ или отмена зеркала, реально сдвинувшие базу: заказы холодного старта
 * (delta 0 — учтены без вычитания) шума двойного счёта не дают.
 */
const movedBase = (t: { kind: AnyPgColumn; delta: AnyPgColumn }) =>
  and(inArray(t.kind, ["order", "cancel"]), ne(t.delta, 0))

/** Баркоды, по которым с момента sinceIso было событие заказа или отмены зеркала (кроме холодного старта). */
export async function mirrorOrderBarcodesSince(db: Db, sinceIso: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ barcode: poolEvents.barcode })
    .from(poolEvents)
    .where(and(movedBase(poolEvents), gte(poolEvents.occurredAt, sinceIso)))
  return new Set(rows.map((r) => r.barcode))
}

/**
 * «Подозрение на двойной счёт» — метрика приёмки: сигналы WB с момента sinceIso,
 * которым не дальше чем за DOUBLE_COUNT_WINDOW_MINUTES (и строго раньше — не в том
 * же прогоне) предшествовало событие заказа или отмены зеркала по тому же баркоду
 * (кроме холодного старта). В норме после заказа, учтённого sync2 первым, сигнала WB нет вовсе: ожидание уже
 * равно факту. Сигнал сразу после заказа — чаще всего возврат лишней единицы.
 */
export async function countSuspectedDoubleCounts(db: Db, sinceIso: string): Promise<number> {
  const prior = alias(poolEvents, "prior")
  const [row] = await db
    .select({ n: count() })
    .from(poolEvents)
    .where(
      and(
        eq(poolEvents.kind, "wb_signal"),
        gte(poolEvents.occurredAt, sinceIso),
        exists(
          db
            .select({ one: sql`1` })
            .from(prior)
            .where(
              and(
                eq(prior.barcode, poolEvents.barcode),
                movedBase(prior),
                lt(prior.occurredAt, poolEvents.occurredAt),
                gte(prior.occurredAt, sql`${poolEvents.occurredAt} - make_interval(mins => ${DOUBLE_COUNT_WINDOW_MINUTES})`),
              ),
            ),
        ),
      ),
    )
  return row?.n ?? 0
}
