import { describe, expect, it } from "vitest"
import { ozonLifecycle } from "./lifecycle"

const p = (status: string, cancelled_after_ship?: boolean) =>
  ({ status, cancellation: cancelled_after_ship === undefined ? undefined : { cancelled_after_ship } }) as never

describe("ozonLifecycle", () => {
  it("отмена до отгрузки — cancelled_before_ship", () => expect(ozonLifecycle(p("cancelled", false))).toBe("cancelled_before_ship"))
  it("отмена без данных об отгрузке — returned: при сомнении не возвращаем единицу сами", () =>
    expect(ozonLifecycle(p("cancelled"))).toBe("returned"))
  it("отправление разделено на новые — cancelled_before_ship: новые отправления спишут единицу сами", () =>
    expect(ozonLifecycle(p("cancelled_from_split_pending"))).toBe("cancelled_before_ship"))
  it("отмена после отгрузки — returned: товар едет назад", () => expect(ozonLifecycle(p("cancelled", true))).toBe("returned"))
  it("в доставке и доставлен — shipped", () => {
    for (const s of ["delivering", "driver_pickup", "delivered", "sent_by_seller", "arbitration", "client_arbitration"]) {
      expect(ozonLifecycle(p(s))).toBe("shipped")
    }
  })
  it("ждёт сборки — open", () => expect(ozonLifecycle(p("awaiting_packaging"))).toBe("open"))
})
