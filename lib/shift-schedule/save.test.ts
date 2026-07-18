import { describe, expect, it } from "vitest"

import {
  buildShiftSchedulePlanInsertValues,
  buildShiftScheduleShiftInsertValues,
} from "@/lib/shift-schedule/save"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"

const scheduleInput: ScheduleInput = {
  group: {
    id: "group-1",
    name: "Blue room",
  },
  openingHours: [
    {
      dayOfWeek: "monday",
      startTime: "07:00",
      endTime: "18:00",
    },
  ],
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

const generatedSchedule: GeneratedSchedule = {
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
    {
      dayOfWeek: "sunday",
      shifts: [
        {
          staffId: "staff-1",
          startTime: "10:00",
          endTime: "12:00",
        },
      ],
    },
  ],
  warnings: ["Could not cover Tuesday."],
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
      {
        planId: "plan-1",
        staffMemberId: "staff-1",
        dayOfWeek: "sunday",
        startTime: "10:00",
        endTime: "12:00",
      },
    ])
  })
})
