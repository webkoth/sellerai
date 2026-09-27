import { and, count, eq, exists, gte, inArray, lt, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import type { Db } from "./client"
import { poolEvents } from "./schema"

/**
 * Окно шума двойного счёта. В режиме external старый синк списывает WB по заказу
 * зеркала раньше, чем sync2 видит этот заказ: снимок WB уже на единицу меньше
 * (сигнал WB), потом приходит сам заказ — в пуле sync2 минус два. Через
 * WB_SETTLE_MINUTES следующий сигнал WB возвращает единицу. 30 минут — settle
 * плюс тик пула.
 */
export const DOUBLE_COUNT_WINDOW_MINUTES = 30

/** Баркоды, по которым с момента sinceIso было событие заказа или отмены зеркала. */
export async function mirrorOrderBarcodesSince(db: Db, sinceIso: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ barcode: poolEvents.barcode })
    .from(poolEvents)
    .where(and(inArray(poolEvents.kind, ["order", "cancel"]), gte(poolEvents.occurredAt, sinceIso)))
  return new Set(rows.map((r) => r.barcode))
}

/**
 * «Подозрение на двойной счёт» — метрика приёмки: сигналы WB с момента sinceIso,
 * которым не дальше чем за DOUBLE_COUNT_WINDOW_MINUTES (и строго раньше — не в том
 * же прогоне) предшествовало событие заказа или отмены зеркала по тому же баркоду.
 * В норме после заказа, учтённого sync2 первым, сигнала WB нет вовсе: ожидание уже
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
                inArray(prior.kind, ["order", "cancel"]),
                lt(prior.occurredAt, poolEvents.occurredAt),
                gte(prior.occurredAt, sql`${poolEvents.occurredAt} - make_interval(mins => ${DOUBLE_COUNT_WINDOW_MINUTES})`),
              ),
            ),
        ),
      ),
    )
  return row?.n ?? 0
}
