import { and, eq, gte, sql } from "drizzle-orm"
import type { OrderRowForPool } from "@sync2/domain"
import type { Channel, OrderLifecycle } from "@sync2/shared"
import type { Db } from "./client"
import { channels, ordersRaw, runs } from "./schema"
import { toIso } from "./time"

/** Строка заказа от адаптера площадки: статус уже переведён в жизненный цикл синка. */
export interface OrderUpsert {
  externalId: string
  line: number
  barcode: string | null
  quantity: number
  lifecycle: OrderLifecycle
  occurredAt: string
  raw: unknown
}

/** База или открытая транзакция: запись заказов и базовая точка идут одной транзакцией. */
type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]

/**
 * Идемпотентная запись заказов площадки: новая строка вставляется, известная —
 * обновляет статус, баркод, количество и сырьё. updated_at ставится явно:
 * defaultNow() работает только на вставке.
 *
 * Внутри одной пачки строки с одинаковым `(externalId, line)` схлопываются в
 * последнюю: постранично пересекающиеся выдачи площадки иначе дают дубль
 * ключа в одном INSERT, и Postgres роняет весь запрос ("ON CONFLICT DO UPDATE
 * command cannot affect row a second time" — конфликтовать со строкой можно
 * только один раз за команду).
 *
 * `runId` — прогон ingest, записавший строку: пишется в `first_run_id` только при
 * вставке и не обновляется (по нему пул узнаёт заказы базового прогона площадки).
 */
export async function upsertOrders(db: DbOrTx, channelId: number, rows: OrderUpsert[], runId?: string): Promise<number> {
  if (rows.length === 0) return 0
  const dedup = new Map<string, OrderUpsert>()
  for (const r of rows) dedup.set(`${r.externalId}\u0000${r.line}`, r)
  const values = [...dedup.values()]
  await db
    .insert(ordersRaw)
    .values(values.map((r) => ({ ...r, channelId, firstRunId: runId ?? null })))
    .onConflictDoUpdate({
      target: [ordersRaw.channelId, ordersRaw.externalId, ordersRaw.line],
      set: {
        lifecycle: sql`excluded.lifecycle`,
        barcode: sql`excluded.barcode`,
        quantity: sql`excluded.quantity`,
        raw: sql`excluded.raw`,
        updatedAt: sql`now()`,
      },
    })
  return values.length
}

/**
 * Заказы площадки из прогона ingest — одной транзакцией с базовой точкой площадки
 * (`channels.orders_baseline_run_id`, этап 1.3c).
 *
 * Базовая точка ставится на этот прогон, когда площадка читается впервые: точки ещё
 * нет, строк площадки в `orders_raw` нет и ни один прогон ingest не записал счётчик
 * `<площадка>Orders` (площадка без заказов, которую уже читали, — тоже живая). Так
 * подключение новой площадки (сайта) к живому пулу не списывает её прошлые заказы
 * второй раз: пул примет заказы базового прогона холодным стартом по площадке.
 * Живым до 1.3c площадкам точка задним числом не ставится — они прошли общий
 * холодный старт пула. Пустой первый ответ тоже ставит точку: следующий заказ
 * площадки — уже новый. Точка не сбрасывается: после отключения и повторного
 * подключения заказы за перерыв списываются как новые.
 */
export async function ingestChannelOrders(
  db: Db,
  args: { channelId: number; code: Channel; runId: string; rows: OrderUpsert[] },
): Promise<{ written: number; baselineSet: boolean }> {
  return db.transaction(async (tx) => {
    const [channel] = await tx
      .select({ baseline: channels.ordersBaselineRunId })
      .from(channels)
      .where(eq(channels.id, args.channelId))
    let first = channel !== undefined && channel.baseline === null
    if (first) {
      const [hasRows] = await tx.select({ one: sql`1` }).from(ordersRaw).where(eq(ordersRaw.channelId, args.channelId)).limit(1)
      const counter = `${args.code}Orders`
      const [wasRead] = await tx
        .select({ one: sql`1` })
        .from(runs)
        .where(and(eq(runs.job, "ingest"), sql`${runs.counters} ->> ${counter} is not null`))
        .limit(1)
      first = hasRows === undefined && wasRead === undefined
    }
    const written = await upsertOrders(tx, args.channelId, args.rows, args.runId)
    if (first) await tx.update(channels).set({ ordersBaselineRunId: args.runId }).where(eq(channels.id, args.channelId))
    return { written, baselineSet: first }
  })
}

/**
 * Заказы всех площадок с момента `since` (ISO) — вход для toPoolOrders.
 *
 * `since` — щедрое скользящее окно, а не «с прошлого прогона»: обновление
 * жизненного цикла сохраняет исходный `occurredAt` заказа, поэтому поздняя
 * отмена старого заказа видна, только пока сам заказ ещё внутри окна. План —
 * не короче 60 дней (см. «Контракт адаптеров для плана 1.3»).
 *
 * `channelColdStart` — строка впервые записана базовым прогоном своей площадки
 * (`first_run_id = channels.orders_baseline_run_id`); у остальных поля нет.
 */
export async function loadOrdersSince(db: Db, since: string): Promise<OrderRowForPool[]> {
  const rows = await db
    .select({
      id: ordersRaw.id,
      channelId: ordersRaw.channelId,
      barcode: ordersRaw.barcode,
      quantity: ordersRaw.quantity,
      lifecycle: ordersRaw.lifecycle,
      occurredAt: ordersRaw.occurredAt,
      coldStart: sql<boolean>`coalesce(${ordersRaw.firstRunId} = ${channels.ordersBaselineRunId}, false)`,
    })
    .from(ordersRaw)
    .innerJoin(channels, eq(ordersRaw.channelId, channels.id))
    .where(gte(ordersRaw.occurredAt, since))
    .orderBy(ordersRaw.id)
  return rows.map(({ coldStart, ...r }) => ({
    ...r,
    lifecycle: r.lifecycle as OrderLifecycle,
    occurredAt: toIso(r.occurredAt),
    ...(coldStart ? { channelColdStart: true } : {}),
  }))
}
