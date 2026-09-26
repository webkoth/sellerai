import { describe, expect, it } from "vitest"

describe("каркас", () => {
  it("vitest видит пакеты воркспейса", async () => {
    const mod = await import("@sync2/shared")
    expect(mod).toBeTypeOf("object")
  })
})
