import { describe, expect, it } from "vitest"
import { YM_AFTER_SHIP_SUBSTATUSES, ymLifecycle } from "./lifecycle"

describe("ymLifecycle", () => {
  it("отмена до отправки — cancelled_before_ship", () => {
    expect(ymLifecycle({ status: "CANCELLED", substatus: "USER_CHANGED_MIND" })).toBe("cancelled_before_ship")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "PROCESSING_EXPIRED" })).toBe("cancelled_before_ship")
  })
  it("отмена после отправки — returned: товар едет назад", () => {
    expect(ymLifecycle({ status: "CANCELLED", substatus: "USER_REFUSED_PRODUCT" })).toBe("returned")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "PICKUP_EXPIRED" })).toBe("returned")
  })
  it("возврат — returned", () => {
    expect(ymLifecycle({ status: "RETURNED" })).toBe("returned")
    expect(ymLifecycle({ status: "PARTIALLY_RETURNED" })).toBe("returned")
  })
  it("в доставке — shipped; в обработке — open", () => {
    expect(ymLifecycle({ status: "DELIVERY" })).toBe("shipped")
    expect(ymLifecycle({ status: "DELIVERED" })).toBe("shipped")
    expect(ymLifecycle({ status: "PROCESSING", substatus: "STARTED" })).toBe("open")
  })
  it("список «после отправки» — 18 подстатусов из плана", () => {
    expect(YM_AFTER_SHIP_SUBSTATUSES.size).toBe(18)
  })
})
