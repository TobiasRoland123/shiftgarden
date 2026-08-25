import { describe, expect, it } from "vitest"

import { getGroupReadiness } from "@/lib/shift-schedule/readiness"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"

const daysOfWeek = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

function createScheduleInput(
  overrides: Partial<ScheduleInput> = {}
): ScheduleInput {
  return {
    group: { id: "group-1", name: "Blue room" },
    openingHours: daysOfWeek.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: "07:00",
      endTime: "17:00",
    })),
    staff: [
      {
        id: "pedagog-1",
        firstName: "Ada",
        lastName: "Lovelace",
        role: "pedagog",
        maxHoursPerWeek: 37,
        active: true,
        availability: [],
      },
      {
        id: "assistant-1",
        firstName: "Grace",
        lastName: "Hopper",
        role: "assistant",
        maxHoursPerWeek: 37,
        active: true,
        availability: [],
      },
    ],
    rules: [
      {
        dayOfWeek: "monday",
        startTime: "09:00",
        endTime: "12:00",
        minPedagogs: 1,
        minStaff: 2,
      },
    ],
    ...overrides,
  }
}

function blockingCodes(scheduleInput: ScheduleInput) {
  return getGroupReadiness(scheduleInput).blockingIssues.map(
    (issue) => issue.code
  )
}

describe("getGroupReadiness", () => {
  it("reports a fully ready group as generatable", () => {
    const readiness = getGroupReadiness(createScheduleInput())

    expect(readiness.blockingIssues).toEqual([])
    expect(readiness.canGenerate).toBe(true)
    expect(readiness.linkedActiveStaffCount).toBe(2)
    expect(readiness.linkedStaffCount).toBe(2)
    expect(readiness.staffingRuleCount).toBe(1)
    expect(readiness.openingHoursCount).toBe(7)
  })

  it("blocks generation when the institution has no opening hours", () => {
    expect(blockingCodes(createScheduleInput({ openingHours: [] }))).toContain(
      "no_opening_hours"
    )
  })

  it("blocks generation when the group has no staffing rules", () => {
    expect(blockingCodes(createScheduleInput({ rules: [] }))).toContain(
      "no_staffing_rules"
    )
  })

  it("blocks generation when the group has no linked active staff", () => {
    const scheduleInput = createScheduleInput()
    const inactiveOnly = createScheduleInput({
      staff: scheduleInput.staff.map((staff) => ({ ...staff, active: false })),
    })

    expect(blockingCodes(inactiveOnly)).toContain("no_linked_active_staff")
    expect(getGroupReadiness(inactiveOnly).linkedStaffCount).toBe(2)
    expect(getGroupReadiness(inactiveOnly).linkedActiveStaffCount).toBe(0)
  })

  it("blocks generation when a staffing rule falls outside opening hours", () => {
    const readiness = getGroupReadiness(
      createScheduleInput({
        openingHours: [
          { dayOfWeek: "monday", startTime: "07:00", endTime: "17:00" },
        ],
        rules: [
          {
            dayOfWeek: "monday",
            startTime: "16:00",
            endTime: "18:00",
            minPedagogs: 1,
            minStaff: 2,
          },
        ],
      })
    )

    expect(readiness.canGenerate).toBe(false)
    expect(readiness.blockingIssues).toEqual([
      {
        code: "staffing_rule_outside_opening_hours",
        dayOfWeek: "monday",
        startTime: "16:00",
        endTime: "18:00",
        ruleIndex: 0,
      },
    ])
  })

  it("blocks generation when a staffing rule crosses a gap between opening hours", () => {
    expect(
      blockingCodes(
        createScheduleInput({
          openingHours: [
            { dayOfWeek: "monday", startTime: "07:00", endTime: "12:00" },
            { dayOfWeek: "monday", startTime: "13:00", endTime: "17:00" },
          ],
          rules: [
            {
              dayOfWeek: "monday",
              startTime: "11:00",
              endTime: "14:00",
              minPedagogs: 1,
              minStaff: 2,
            },
          ],
        })
      )
    ).toContain("staffing_rule_outside_opening_hours")
  })

  it("reports both capacity shortfalls without blocking generation", () => {
    const readiness = getGroupReadiness(
      createScheduleInput({
        staff: [
          {
            id: "assistant-1",
            firstName: "Grace",
            lastName: "Hopper",
            role: "assistant",
            maxHoursPerWeek: 1,
            active: true,
            availability: [],
          },
        ],
        rules: [
          {
            dayOfWeek: "monday",
            startTime: "09:00",
            endTime: "17:00",
            minPedagogs: 2,
            minStaff: 3,
          },
        ],
      })
    )

    expect(readiness.canGenerate).toBe(true)
    expect(readiness.blockingIssues).toEqual([])
    expect(readiness.capacityShortfall.totalShortfallHours).toBeGreaterThan(0)
    expect(readiness.capacityShortfall.pedagogShortfallHours).toBeGreaterThan(0)
  })

  it("does not count inactive staff toward capacity", () => {
    const readiness = getGroupReadiness(
      createScheduleInput({
        staff: [
          {
            id: "pedagog-1",
            firstName: "Ada",
            lastName: "Lovelace",
            role: "pedagog",
            maxHoursPerWeek: 37,
            active: false,
            availability: [],
          },
          {
            id: "assistant-1",
            firstName: "Grace",
            lastName: "Hopper",
            role: "assistant",
            maxHoursPerWeek: 37,
            active: true,
            availability: [],
          },
        ],
      })
    )

    expect(readiness.capacityShortfall.totalCapacityHours).toBe(37)
    expect(readiness.capacityShortfall.pedagogCapacityHours).toBe(0)
  })
})
