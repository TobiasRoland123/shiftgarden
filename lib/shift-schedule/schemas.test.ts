import { describe, expect, it } from "vitest"

import { generatedScheduleSchema } from "@/lib/shift-schedule/schemas"

const validGeneratedSchedule = {
  groupId: "group-1",
  days: [
    {
      dayOfWeek: "monday",
      shifts: [
        {
          staffId: "staff-1",
          startTime: "08:00",
          endTime: "12:30",
        },
      ],
    },
  ],
  warnings: [],
}

describe("generatedScheduleSchema", () => {
  it("accepts a valid generated schedule", () => {
    expect(
      generatedScheduleSchema.safeParse(validGeneratedSchedule).success
    ).toBe(true)
  })

  it("rejects invalid HH:mm times", () => {
    const result = generatedScheduleSchema.safeParse({
      ...validGeneratedSchedule,
      days: [
        {
          dayOfWeek: "monday",
          shifts: [
            {
              staffId: "staff-1",
              startTime: "8:00",
              endTime: "25:00",
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it("rejects generated schedules without warnings", () => {
    const withoutWarnings: Partial<typeof validGeneratedSchedule> = {
      ...validGeneratedSchedule,
    }
    delete withoutWarnings.warnings

    expect(generatedScheduleSchema.safeParse(withoutWarnings).success).toBe(
      false
    )
  })

  it("rejects unsupported output days", () => {
    const result = generatedScheduleSchema.safeParse({
      ...validGeneratedSchedule,
      days: [
        {
          dayOfWeek: "saturday",
          shifts: [],
        },
      ],
    })

    expect(result.success).toBe(false)
  })

  it("rejects malformed shifts", () => {
    const result = generatedScheduleSchema.safeParse({
      ...validGeneratedSchedule,
      days: [
        {
          dayOfWeek: "monday",
          shifts: [
            {
              staffId: 123,
              startTime: "08:00",
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(false)
  })
})
