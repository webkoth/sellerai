import { describe, expect, it } from "vitest"
import { wbLifecycle } from "./lifecycle"

describe("wbLifecycle", () => {
  it("нет статуса — open", () => expect(wbLifecycle(undefined)).toBe("open"))
  it("отмена продавцом или покупателем — cancelled_before_ship", () => {
    expect(wbLifecycle({ id: 1, supplierStatus: "cancel", wbStatus: "waiting" })).toBe("cancelled_before_ship")
    expect(wbLifecycle({ id: 1, supplierStatus: "confirm", wbStatus: "canceled_by_client" })).toBe("cancelled_before_ship")
  })
  it("передан в доставку — shipped", () => expect(wbLifecycle({ id: 1, supplierStatus: "complete", wbStatus: "sorted" })).toBe("shipped"))
  it("на сборке — open", () => expect(wbLifecycle({ id: 1, supplierStatus: "confirm", wbStatus: "waiting" })).toBe("open"))
})
