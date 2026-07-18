import { describe, expect, it } from "vitest"

import {
  buildShiftSchedulePlanInsertValues,
  buildShiftScheduleShiftInsertValues,
} from "@/lib/shift-schedule/save"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import type { AcceptedSchedulePlan } from "@/lib/shift-schedule/validation-types"

const scheduleInput: ScheduleInput = {
  group: {
    id: "group-1",
    name: "Blue room",
  },
  staff: [
    {
      id: "staff-1",
      firstName: "Ada",
      lastName: "Lovelace",
      role: "pedagog",
      maxHoursPerWeek: 37,
      active: true,
      availability: [
        {
          dayOfWeek: "monday",
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        },
      ],
    },
  ],
  rules: [
    {
      dayOfWeek: "monday",
      startTime: "08:00",
      endTime: "16:00",
      minPedagogs: 1,
      minStaff: 2,
    },
  ],
}

const generatedSchedule: AcceptedSchedulePlan = {
  groupId: "group-1",
  days: [
    {
      dayOfWeek: "monday",
      shifts: [
        {
          staffId: "staff-1",
          startTime: "08:00",
          endTime: "12:00",
        },
      ],
    },
    {
      dayOfWeek: "tuesday",
      shifts: [],
    },
  ],
  warnings: ["Could not cover Tuesday."],
  validationWarnings: [
    {
      code: "max_hours_exceeded",
      severity: "warning",
      message: "Hours are close to the weekly capacity.",
      staffId: "staff-1",
    },
  ],
}

describe("shift schedule save values", () => {
  it("builds plan insert values from generated output and input JSON", () => {
    expect(
      buildShiftSchedulePlanInsertValues({
        model: "openai/gpt-5.4",
        plan: generatedSchedule,
        scheduleInput,
      })
    ).toEqual({
      groupId: "group-1",
      inputJson: scheduleInput,
      warnings: ["Could not cover Tuesday."],
      validationWarnings: [
        {
          code: "max_hours_exceeded",
          severity: "warning",
          message: "Hours are close to the weekly capacity.",
          staffId: "staff-1",
        },
      ],
      model: "openai/gpt-5.4",
    })
  })

  it("flattens generated day shifts into shift insert values", () => {
    expect(
      buildShiftScheduleShiftInsertValues({
        plan: generatedSchedule,
        planId: "plan-1",
      })
    ).toEqual([
      {
        planId: "plan-1",
        staffMemberId: "staff-1",
        dayOfWeek: "monday",
        startTime: "08:00",
        endTime: "12:00",
      },
    ])
  })
})
