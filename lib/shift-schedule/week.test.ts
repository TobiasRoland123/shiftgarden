import { describe, expect, it } from "vitest"

import { isMondayWeekStart } from "@/lib/shift-schedule/week"

describe("week start", () => {
  it("accepts an ISO date that is a Monday", () => {
    expect(isMondayWeekStart("2026-07-13")).toBe(true)
  })

  it.each(["2026-07-14", "2026-02-30", "07/13/2026", ""])(
    "rejects invalid week start %s",
    (value) => {
      expect(isMondayWeekStart(value)).toBe(false)
    }
  )
})
