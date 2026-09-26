import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { seedChannels } from "./channels-seed"
import { loadOrdersSince, upsertOrders, type OrderUpsert } from "./orders"
import { channels, ordersRaw } from "./schema"
import { TEST_DATABASE_URL, freshTestDb } from "./test-db"

const o = (externalId: string, patch: Partial<OrderUpsert> = {}): OrderUpsert => ({
  externalId,
  line: 0,
  barcode: "A",
  quantity: 1,
  lifecycle: "open",
  occurredAt: "2026-09-26T10:00:00.000Z",
  raw: { id: externalId },
  ...patch,
})

describe.skipIf(!TEST_DATABASE_URL)("хранилище заказов", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ozon: number
  beforeAll(async () => {
    h = await freshTestDb()
    await seedChannels(h.db)
    ozon = (await h.db.select().from(channels).where(eq(channels.code, "ozon")))[0]!.id
  })
  afterAll(async () => h?.close())

  it("повторная запись заказа обновляет статус, а не дублирует строку", async () => {
    await upsertOrders(h.db, ozon, [o("OZ-1")])
    await upsertOrders(h.db, ozon, [o("OZ-1", { lifecycle: "cancelled_before_ship" })])
    const rows = await h.db.select().from(ordersRaw).where(eq(ordersRaw.externalId, "OZ-1"))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.lifecycle).toBe("cancelled_before_ship")
    expect(Date.parse(rows[0]!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(rows[0]!.firstSeenAt))
  })

  it("пустой список — без запроса и без ошибки", async () => {
    expect(await upsertOrders(h.db, ozon, [])).toBe(0)
  })

  it("чтение с даты: id числом, время в ISO", async () => {
    await upsertOrders(h.db, ozon, [o("OZ-OLD", { occurredAt: "2026-08-01T00:00:00.000Z" })])
    const rows = await loadOrdersSince(h.db, "2026-09-01T00:00:00.000Z")
    expect(rows.map((r) => r.lifecycle)).toEqual(["cancelled_before_ship"])
    expect(typeof rows[0]!.id).toBe("number")
    expect(rows[0]).toMatchObject({ channelId: ozon, barcode: "A", quantity: 1, occurredAt: "2026-09-26T10:00:00.000Z" })
  })
})
