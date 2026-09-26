import { sql } from "drizzle-orm"
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { CHANNELS, WRITE_MODES } from "@sync2/shared"

/** 'a','b','c' для check-ограничения из закрытого списка — единый источник в @sync2/shared. */
const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "))

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" })

export const ORDER_LIFECYCLES = ["open", "shipped", "cancelled_before_ship", "returned"] as const
export const POOL_EVENT_KINDS = ["order", "cancel", "wb_signal", "cold_start", "manual"] as const
export const RUN_STATUSES = ["running", "ok", "partial", "failed"] as const
export const WRITE_FIELDS = ["stock", "price"] as const

/** Площадки. Режим записи площадки — второй ключ выключателя, рядом с глобальным SYNC_WRITE_MODE. */
export const channels = pgTable(
  "channels",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    writeMode: text("write_mode").notNull().default("off"),
    /** Склад площадки, куда пишется остаток: id склада WB/Ozon/ЯМ, склад KIT. */
    warehouseRef: text("warehouse_ref"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("channels_code_idx").on(t.code),
    check("channels_code_check", sql`${t.code} in (${inList(CHANNELS)})`),
    check("channels_write_mode_check", sql`${t.writeMode} in (${inList(WRITE_MODES)})`),
  ],
)

/** Товар. Ключ — баркод WB: он общий для всех площадок, артикул WB на Ozon/ЯМ совпадает с offer_id не везде. */
export const products = pgTable("products", {
  barcode: text("barcode").primaryKey(),
  vendorCode: text("vendor_code"),
  nmId: bigint("nm_id", { mode: "number" }),
  title: text("title").notNull().default(""),
  wbSubject: text("wb_subject"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})

/** Товар на площадке: чем он там называется и в каком состоянии. */
export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    barcode: text("barcode").notNull().references(() => products.barcode),
    /** offer_id Ozon/ЯМ, variant_id KIT, id товара сайта, chrtID WB. */
    externalId: text("external_id").notNull(),
    status: text("status").notNull().default("active"),
    contentHash: text("content_hash"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("listings_channel_barcode_idx").on(t.channelId, t.barcode)],
)

/** Сырой снимок остатков площадки. Только дописывается. */
export const stockSnapshotsRaw = pgTable(
  "stock_snapshots_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    takenAt: ts("taken_at").notNull(),
    runId: uuid("run_id").notNull(),
    /** [{ barcode, externalId, quantity }] — уже нормализованный адаптером вид. */
    stocks: jsonb("stocks").notNull(),
  },
  (t) => [uniqueIndex("stock_snapshots_channel_taken_idx").on(t.channelId, t.takenAt)],
)

/** Строка заказа любой площадки. Статус обновляется, строка не удаляется. */
export const ordersRaw = pgTable(
  "orders_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    externalId: text("external_id").notNull(),
    line: integer("line").notNull().default(0),
    barcode: text("barcode"),
    quantity: integer("quantity").notNull(),
    lifecycle: text("lifecycle").notNull(),
    occurredAt: ts("occurred_at").notNull(),
    raw: jsonb("raw").notNull(),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_raw_channel_ext_line_idx").on(t.channelId, t.externalId, t.line),
    index("orders_raw_barcode_idx").on(t.barcode),
    check("orders_raw_lifecycle_check", sql`${t.lifecycle} in (${inList(ORDER_LIFECYCLES)})`),
    check("orders_raw_quantity_check", sql`${t.quantity} > 0`),
  ],
)

/** Состояние пула на баркод — те же поля, что PoolItemState в finstock/packages/domain/src/pool.ts. */
export const poolItems = pgTable("pool_items", {
  barcode: text("barcode").primaryKey().references(() => products.barcode),
  base: integer("base").notNull(),
  wbExpected: integer("wb_expected").notNull(),
  expectedAt: ts("expected_at"),
  wbSnapshotAt: ts("wb_snapshot_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
})

/** Журнал пула. Дубль события отсекает база, а не код. */
export const poolEvents = pgTable(
  "pool_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    barcode: text("barcode").notNull(),
    kind: text("kind").notNull(),
    delta: integer("delta").notNull(),
    baseBefore: integer("base_before").notNull(),
    baseAfter: integer("base_after").notNull(),
    channelId: integer("channel_id").references(() => channels.id),
    orderId: bigint("order_id", { mode: "number" }).references(() => ordersRaw.id),
    snapshotAt: ts("snapshot_at"),
    occurredAt: ts("occurred_at").notNull(),
    runId: uuid("run_id").notNull(),
    detail: jsonb("detail"),
  },
  (t) => [
    check("pool_events_kind_check", sql`${t.kind} in (${inList(POOL_EVENT_KINDS)})`),
    // Заказ списывается ровно один раз и отменяется ровно один раз.
    uniqueIndex("pool_events_order_kind_idx").on(t.orderId, t.kind).where(sql`${t.orderId} is not null`),
    // Один снимок WB даёт не больше одного сигнала на баркод.
    uniqueIndex("pool_events_snapshot_kind_idx")
      .on(t.barcode, t.kind, t.snapshotAt)
      .where(sql`${t.snapshotAt} is not null`),
  ],
)

/** Журнал запусков джоб. */
export const runs = pgTable(
  "runs",
  {
    runId: uuid("run_id").primaryKey(),
    job: text("job").notNull(),
    status: text("status").notNull(),
    writeMode: text("write_mode").notNull(),
    startedAt: ts("started_at").notNull(),
    finishedAt: ts("finished_at"),
    counters: jsonb("counters").notNull().default({}),
    error: text("error"),
  },
  (t) => [
    check("runs_status_check", sql`${t.status} in (${inList(RUN_STATUSES)})`),
    check("runs_write_mode_check", sql`${t.writeMode} in (${inList(WRITE_MODES)})`),
    index("runs_job_started_idx").on(t.job, t.startedAt),
  ],
)

/** Каждая запись на площадку — было → стало, режим, ответ. */
export const writes = pgTable(
  "writes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: uuid("run_id").notNull().references(() => runs.runId),
    channelId: integer("channel_id").notNull().references(() => channels.id),
    barcode: text("barcode").notNull(),
    field: text("field").notNull(),
    before: integer("before"),
    after: integer("after").notNull(),
    mode: text("mode").notNull(),
    applied: boolean("applied").notNull(),
    response: jsonb("response"),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("writes_run_channel_barcode_field_idx").on(t.runId, t.channelId, t.barcode, t.field),
    check("writes_field_check", sql`${t.field} in (${inList(WRITE_FIELDS)})`),
    check("writes_mode_check", sql`${t.mode} in (${inList(WRITE_MODES)})`),
  ],
)
