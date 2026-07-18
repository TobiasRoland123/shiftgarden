import { describe, expect, it } from "vitest"

import { validateCrossGroupConflicts } from "@/lib/shift-schedule/cross-group-conflicts"
import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"

const generatedSchedule: GeneratedSchedule = {
  groupId: "group-blue",
  days: [
    {
      dayOfWeek: "monday",
      shifts: [
        {
          staffId: "staff-1",
          startTime: "09:00",
          endTime: "12:00",
        },
      ],
    },
  ],
  warnings: [],
}

function activeShift(startTime: string, endTime: string) {
  return {
    dayOfWeek: "monday",
    endTime,
    groupId: "group-green",
    groupName: "Green room",
    planId: "plan-green",
    staffId: "staff-1",
    startTime,
  }
}

describe("cross-group schedule conflicts", () => {
  it("returns a blocking issue with conflicting plan and group context", () => {
    const result = validateCrossGroupConflicts({
      activePlanShifts: [activeShift("11:00", "14:00")],
      generatedSchedule,
    })

    expect(result.valid).toBe(false)
    expect(result.issues).toMatchObject([
      {
        code: "cross_group_conflict",
        severity: "error",
        conflictingGroupId: "group-green",
        conflictingGroupName: "Green room",
        conflictingPlanId: "plan-green",
      },
    ])
  })

  it.each([
    ["07:00", "09:00"],
    ["12:00", "14:00"],
  ])("allows adjacent shift %s-%s", (startTime, endTime) => {
    const result = validateCrossGroupConflicts({
      activePlanShifts: [activeShift(startTime, endTime)],
      generatedSchedule,
    })

    expect(result).toEqual({ valid: true, issues: [] })
  })

  it("ignores a different weekday or staff member", () => {
    const result = validateCrossGroupConflicts({
      activePlanShifts: [
        { ...activeShift("10:00", "11:00"), dayOfWeek: "tuesday" },
        { ...activeShift("10:00", "11:00"), staffId: "staff-2" },
      ],
      generatedSchedule,
    })

    expect(result.valid).toBe(true)
  })
})
