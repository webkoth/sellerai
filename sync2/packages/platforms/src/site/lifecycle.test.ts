import { describe, expect, it } from "vitest"
import { siteLifecycle } from "./lifecycle"

describe("siteLifecycle", () => {
  it("new — open: заказ принят, единица держится до решения владельца", () => {
    expect(siteLifecycle("new")).toBe("open")
  })
  it("любой другой статус — returned: при сомнении не возвращаем единицу сами", () => {
    for (const s of ["cancelled", "done", "NEW", ""]) expect(siteLifecycle(s)).toBe("returned")
  })
})
