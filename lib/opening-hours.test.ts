import { describe, expect, it } from "vitest"

import { intervalFitsWithin, validateOpeningHours } from "@/lib/opening-hours"

describe("institution opening hours", () => {
  it("supports multiple non-overlapping intervals on all seven days", () => {
    expect(
      validateOpeningHours([
        { dayOfWeek: "monday", startTime: "07:00", endTime: "12:00" },
        { dayOfWeek: "monday", startTime: "13:00", endTime: "18:00" },
        { dayOfWeek: "sunday", startTime: "09:00", endTime: "14:00" },
      ])
    ).toEqual([])
  })

  it("rejects invalid and overlapping intervals", () => {
    expect(
      validateOpeningHours([
        { dayOfWeek: "monday", startTime: "12:00", endTime: "11:00" },
        { dayOfWeek: "sunday", startTime: "09:00", endTime: "14:00" },
        { dayOfWeek: "sunday", startTime: "13:00", endTime: "16:00" },
      ])
    ).toEqual([
      "Opening-hours end time must be after start time.",
      "Opening-hours intervals on the same day cannot overlap.",
    ])
  })

  it("requires an interval to fit one opening interval rather than a union", () => {
    const openingHours = [
      { dayOfWeek: "saturday" as const, startTime: "08:00", endTime: "12:00" },
      { dayOfWeek: "saturday" as const, startTime: "13:00", endTime: "16:00" },
    ]

    expect(
      intervalFitsWithin(
        { dayOfWeek: "saturday", startTime: "09:00", endTime: "11:00" },
        openingHours
      )
    ).toBe(true)
    expect(
      intervalFitsWithin(
        { dayOfWeek: "saturday", startTime: "11:00", endTime: "14:00" },
        openingHours
      )
    ).toBe(false)
  })
})
