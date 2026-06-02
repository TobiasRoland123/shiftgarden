import { describe, expect, it } from "vitest"

import {
  formatValidationFeedbackForRetry,
  formatValidationIssuesForUser,
} from "@/lib/shift-schedule/action-validation"
import type { ScheduleValidationResult } from "@/lib/shift-schedule/validation-types"

describe("shift schedule generation validation formatting", () => {
  it("formats validation issues for the user-facing generation flow", () => {
    const result: ScheduleValidationResult = {
      valid: false,
      issues: [
        {
          code: "unsupported_weekend_rule",
          severity: "error",
          message:
            "Generated schedule plans currently support Monday through Friday only.",
          dayOfWeek: "saturday",
          startTime: "09:00",
          endTime: "12:00",
          ruleIndex: 0,
        },
      ],
    }

    expect(formatValidationIssuesForUser(result)).toBe(
      "Generated schedule plans currently support Monday through Friday only. (saturday, 09:00-12:00, rule 0)"
    )
  })

  it("formats compact retry feedback with unique issue codes and capped examples", () => {
    const result: ScheduleValidationResult = {
      valid: false,
      issues: [
        {
          code: "outside_availability",
          severity: "error",
          message: "First outside availability issue.",
          dayOfWeek: "monday",
          staffId: "staff-1",
          startTime: "09:00",
          endTime: "12:00",
        },
        {
          code: "outside_availability",
          severity: "error",
          message: "Second outside availability issue.",
          dayOfWeek: "tuesday",
          staffId: "staff-1",
          startTime: "09:00",
          endTime: "12:00",
        },
        {
          code: "outside_availability",
          severity: "error",
          message: "Third outside availability issue.",
          dayOfWeek: "wednesday",
          staffId: "staff-1",
          startTime: "09:00",
          endTime: "12:00",
        },
        {
          code: "outside_availability",
          severity: "error",
          message: "Fourth outside availability issue.",
          dayOfWeek: "thursday",
          staffId: "staff-1",
          startTime: "09:00",
          endTime: "12:00",
        },
        {
          code: "min_staff_unmet",
          severity: "error",
          message: "Minimum staff issue.",
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          ruleIndex: 0,
        },
      ],
    }

    const feedback = formatValidationFeedbackForRetry(result)

    expect(feedback).toContain("- outside_availability:")
    expect(feedback).toContain("- min_staff_unmet:")
    expect(feedback).toContain("Third outside availability issue.")
    expect(feedback).not.toContain("Fourth outside availability issue.")
  })
})
