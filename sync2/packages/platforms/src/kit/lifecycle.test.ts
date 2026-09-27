import { describe, expect, it } from "vitest"
import { kitLifecycle } from "./lifecycle"

describe("kitLifecycle", () => {
  it("отмена до передачи — cancelled_before_ship", () => {
    expect(kitLifecycle("CANCELLED")).toBe("cancelled_before_ship")
    expect(kitLifecycle("DELIVERY_CANCELLED")).toBe("cancelled_before_ship")
  })
  it("возврат денег после покупки — returned", () => {
    expect(kitLifecycle("FULL_REFUND")).toBe("returned")
    expect(kitLifecycle("PARTIAL_REFUND")).toBe("returned")
  })
  it("передан в доставку и дальше — shipped", () => {
    for (const s of ["WAIT_FOR_DELIVERY", "DELIVERED", "COMPLETED"]) expect(kitLifecycle(s)).toBe("shipped")
  })
  it("новый, ждёт оплаты, отменяется — open: единица держится до финала", () => {
    for (const s of ["NEW", "PENDING_PAYMENT", "CANCELLATION_IN_PROGRESS"]) expect(kitLifecycle(s)).toBe("open")
  })
})
