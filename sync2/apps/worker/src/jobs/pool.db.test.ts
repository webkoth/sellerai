import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { channels, drizzleRunStore, insertStockSnapshot, loadChannels, loadPoolState, seedChannels, upsertOrders, writes } from "@sync2/db"
import { TEST_DATABASE_URL, freshTestDb, insertRun } from "@sync2/db/test-db"
import { eq } from "drizzle-orm"
import { runPool } from "./pool"

const s = (barcode: string, quantity: number) => ({ barcode, externalSku: null, quantity, warehouse: null })

describe.skipIf(!TEST_DATABASE_URL)("runPool", () => {
  let h: Awaited<ReturnType<typeof freshTestDb>>
  let ids: Awaited<ReturnType<typeof loadChannels>>
  let n = 0
  const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
  const runId = async () => {
    const id = nextId()
    await insertRun(h.db, id)
    return id
  }
  /** Завершённый прогон ingest в журнале — от его статуса зависит холодный старт пула. */
  const ingestRun = async (status: "ok" | "partial", at: string) => {
    const store = drizzleRunStore(h.db)
    const id = nextId()
    await store.start({ runId: id, job: "ingest", writeMode: "dry-run", startedAt: at })
    await store.finish(id, { status, finishedAt: at, counters: {}, error: null })
  }
  beforeAll(async () => {
    h = await freshTestDb()
  })
  afterAll(async () => h?.close())

  const now = new Date("2026-09-27T10:10:00.000Z")

  it("площадки не заведены — понятная ошибка, а не падение на undefined", async () => {
    await expect(runPool({ db: h.db, now: () => now, runId: await runId(), globalMode: "dry-run" })).rejects.toThrow(
      /площадки не заведены — выполните seed-channels/,
    )
  })

  describe("после seed-channels", () => {
    beforeAll(async () => {
      await seedChannels(h.db)
      for (const c of ["ozon", "ym", "kit"] as const) await h.db.update(channels).set({ writeMode: "dry-run" }).where(eq(channels.code, c))
      ids = await loadChannels(h.db)
    })

    it("без свежего снимка WB пул не пересчитывается", async () => {
      const r = await runPool({ db: h.db, now: () => now, runId: await runId(), globalMode: "dry-run" })
      expect(r).toMatchObject({ status: "partial", counters: { noFreshWb: 1 } })
      expect((await loadPoolState(h.db)).items).toEqual([])
    })

    it("холодный старт при не-ok последнем ingest — отказ: пул пуст, база не строится от неполных заказов", async () => {
      await ingestRun("partial", "2026-09-27T10:04:00.000Z")
      const id = await runId()
      await insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: id, takenAt: "2026-09-27T10:05:00.000Z", stocks: [s("A", 3), s("B", 1)] })
      const r = await runPool({ db: h.db, now: () => now, runId: await runId(), globalMode: "dry-run" })
      expect(r).toMatchObject({ status: "partial", counters: { coldStartRefused: 1 } })
      expect((await loadPoolState(h.db)).items).toEqual([])
    })

    it("холодный старт от WB, заказ KIT, план записей в dry-run — в журнале, на площадки ничего", async () => {
      await ingestRun("ok", "2026-09-27T10:06:00.000Z")
      const id = await runId()
      await insertStockSnapshot(h.db, { channelId: ids.get("kit")!.id, runId: id, takenAt: "2026-09-27T10:05:00.000Z", stocks: [s("A", 3), s("B", 1), s("Z", 1)] })
      await upsertOrders(h.db, ids.get("kit")!.id, [
        { externalId: "K1", line: 0, barcode: "A", quantity: 1, lifecycle: "open", occurredAt: "2026-09-27T10:06:00.000Z", raw: {} },
        // Баркода нет ни в пуле, ни у WB — пропущено без базы.
        { externalId: "K2", line: 0, barcode: "NOPE", quantity: 1, lifecycle: "open", occurredAt: "2026-09-27T10:06:00.000Z", raw: {} },
      ])
      const pid = await runId()
      const r = await runPool({ db: h.db, now: () => now, runId: pid, globalMode: "dry-run" })
      expect(r.status).toBe("ok")
      expect(r.counters).toMatchObject({ noBase: 1, wbSnapshotAgeMin: 5 })
      // Холодный старт считает открытый заказ KIT уже учтённым старым синком на WB — база 3.
      expect((await loadPoolState(h.db)).items.find((i) => i.barcode === "A")?.base).toBe(3)
      const logged = await h.db.select().from(writes).where(eq(writes.runId, pid))
      expect(logged.map((w) => [w.barcode, w.before, w.after, w.mode, w.applied])).toEqual([["Z", 1, 0, "dry-run", false]])
    })

    it("снимок зеркала старше 20 минут в план не попадает", async () => {
      const sid = await runId()
      // Свежий WB (10:35), KIT остался от 10:05 — к 10:40 он устарел; Ozon и ЯМ снимков нет вовсе.
      await insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: sid, takenAt: "2026-09-27T10:35:00.000Z", stocks: [s("A", 3), s("B", 1)] })
      const pid = await runId()
      const r = await runPool({ db: h.db, now: () => new Date("2026-09-27T10:40:00.000Z"), runId: pid, globalMode: "dry-run" })
      expect(r.status).toBe("ok")
      expect(r.counters).toMatchObject({ staleSnapshots: 3, kitPlanned: 0 })
    })

    it("ошибки в итогах записи — partial с текстом, а не ok", async () => {
      // apply на площадке и глобально: отправителя в 1.3b нет — каждая позиция получает ошибку.
      await h.db.update(channels).set({ writeMode: "apply" }).where(eq(channels.code, "kit"))
      ids = await loadChannels(h.db)
      const sid = await runId()
      await insertStockSnapshot(h.db, { channelId: ids.get("wb")!.id, runId: sid, takenAt: "2026-09-27T10:45:00.000Z", stocks: [s("A", 3), s("B", 1)] })
      await insertStockSnapshot(h.db, { channelId: ids.get("kit")!.id, runId: sid, takenAt: "2026-09-27T10:45:00.000Z", stocks: [s("A", 1), s("B", 1)] })
      const r = await runPool({ db: h.db, now: () => new Date("2026-09-27T10:50:00.000Z"), runId: await runId(), globalMode: "apply" })
      expect(r.status).toBe("partial")
      expect(r.counters).toMatchObject({ writeErrors: 1 })
      expect(r.error).toMatch(/kit A: запись на площадки подключается на этапе 1\.4/)
    })
  })
})
