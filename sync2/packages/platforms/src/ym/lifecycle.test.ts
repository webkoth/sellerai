import { describe, expect, it } from "vitest"
import { YM_BEFORE_SHIP_SUBSTATUSES, ymLifecycle } from "./lifecycle"

describe("ymLifecycle", () => {
  it("отмена до отправки — cancelled_before_ship: подстатус из явного списка", () => {
    expect(ymLifecycle({ status: "CANCELLED", substatus: "USER_CHANGED_MIND" })).toBe("cancelled_before_ship")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "PROCESSING_EXPIRED" })).toBe("cancelled_before_ship")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "USER_NOT_PAID" })).toBe("cancelled_before_ship")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "COURIER_NOT_COME_FOR_ORDER" })).toBe("cancelled_before_ship")
  })
  it("отмена после отправки — returned: товар едет назад", () => {
    expect(ymLifecycle({ status: "CANCELLED", substatus: "USER_REFUSED_PRODUCT" })).toBe("returned")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "PICKUP_EXPIRED" })).toBe("returned")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "SHIPPED_TO_WRONG_DELIVERY_SERVICE" })).toBe("returned")
  })
  it("неизвестный, новый или пустой подстатус отмены — returned: при сомнении единицу сами не возвращаем", () => {
    expect(ymLifecycle({ status: "CANCELLED", substatus: "SOMETHING_NEW_2027" })).toBe("returned")
    expect(ymLifecycle({ status: "CANCELLED", substatus: "UNKNOWN" })).toBe("returned")
    expect(ymLifecycle({ status: "CANCELLED" })).toBe("returned")
  })
  it("возврат — returned", () => {
    expect(ymLifecycle({ status: "RETURNED" })).toBe("returned")
    expect(ymLifecycle({ status: "PARTIALLY_RETURNED" })).toBe("returned")
  })
  it("в доставке — shipped; в обработке и неоплачен — open", () => {
    expect(ymLifecycle({ status: "DELIVERY" })).toBe("shipped")
    expect(ymLifecycle({ status: "PICKUP" })).toBe("shipped")
    expect(ymLifecycle({ status: "DELIVERED" })).toBe("shipped")
    expect(ymLifecycle({ status: "PROCESSING", substatus: "STARTED" })).toBe("open")
    expect(ymLifecycle({ status: "UNPAID" })).toBe("open")
  })
  it("в списке «до отправки» нет подстатусов, при которых товар уже уехал", () => {
    for (const s of ["USER_REFUSED_PRODUCT", "USER_REFUSED_QUALITY", "PICKUP_EXPIRED", "DELIVERY_SERVICE_UNDELIVERED", "LOST"]) {
      expect(YM_BEFORE_SHIP_SUBSTATUSES.has(s)).toBe(false)
    }
  })
})
