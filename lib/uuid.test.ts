import { describe, expect, it } from "vitest"

import { uuidPattern } from "@/lib/uuid"

describe("uuidPattern", () => {
  it("accepts standard group ids from the app", () => {
    expect(uuidPattern.test("4f6d6879-33ec-48c6-ad10-88f5dff00502")).toBe(true)
  })

  it("rejects malformed ids", () => {
    expect(uuidPattern.test("4f6d6879-33ec-48c6-ad10-88f5dff00502-extra")).toBe(
      false
    )
  })
})
