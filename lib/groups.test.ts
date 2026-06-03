import { describe, expect, it } from "vitest"

import {
  calculateGroupCapacityShortfall,
  calculateLinkedActivePedagogCapacityMinutes,
  calculateLinkedActiveStaffCapacityMinutes,
  calculateWeeklyPedagogDemandMinutes,
  calculateWeeklyStaffDemandMinutes,
  type GroupCapacityStaffingRule,
  type GroupCapacityStaffMember,
} from "./groups"

function weekdayRule(
  overrides: Partial<GroupCapacityStaffingRule> = {}
): GroupCapacityStaffingRule {
  return {
    startTime: "06:00",
    endTime: "17:00",
    minStaff: 3,
    minPedagogs: 1,
    ...overrides,
  }
}

function staffMember(
  overrides: Partial<GroupCapacityStaffMember> = {}
): GroupCapacityStaffMember {
  return {
    active: true,
    role: "assistant",
    maxHoursPerWeek: 37,
    ...overrides,
  }
}

describe("group capacity calculations", () => {
  it("calculates weekly staff demand from staffing rules", () => {
    const rules = Array.from({ length: 5 }, () => weekdayRule())

    expect(calculateWeeklyStaffDemandMinutes(rules) / 60).toBe(165)
  })

  it("calculates linked active staff capacity", () => {
    const linkedStaff = Array.from({ length: 3 }, () => staffMember())

    expect(calculateLinkedActiveStaffCapacityMinutes(linkedStaff) / 60).toBe(
      111
    )
  })

  it("excludes inactive linked staff from total capacity", () => {
    const linkedStaff = [staffMember(), staffMember({ active: false })]

    expect(calculateLinkedActiveStaffCapacityMinutes(linkedStaff) / 60).toBe(37)
  })

  it("only counts staff passed as linked staff", () => {
    const linkedStaff = [staffMember()]

    expect(calculateLinkedActiveStaffCapacityMinutes(linkedStaff) / 60).toBe(37)
  })

  it("returns no shortfall when total capacity equals or exceeds demand", () => {
    expect(
      calculateGroupCapacityShortfall(
        [weekdayRule({ startTime: "09:00", endTime: "12:00", minStaff: 2 })],
        [staffMember({ maxHoursPerWeek: 6 })]
      ).totalShortfallHours
    ).toBe(0)

    expect(
      calculateGroupCapacityShortfall(
        [weekdayRule({ startTime: "09:00", endTime: "12:00", minStaff: 2 })],
        [staffMember({ maxHoursPerWeek: 7 })]
      ).totalShortfallHours
    ).toBe(0)
  })

  it("returns no shortfall when there are no staffing rules", () => {
    const shortfall = calculateGroupCapacityShortfall([], [staffMember()])

    expect(shortfall.totalShortfallHours).toBe(0)
    expect(shortfall.pedagogShortfallHours).toBe(0)
  })

  it("calculates weekly pedagog demand and linked active pedagog capacity", () => {
    const rules = Array.from({ length: 5 }, () => weekdayRule())
    const linkedStaff = [
      staffMember({ role: "pedagog" }),
      staffMember({ role: "assistant" }),
    ]

    expect(calculateWeeklyPedagogDemandMinutes(rules) / 60).toBe(55)
    expect(calculateLinkedActivePedagogCapacityMinutes(linkedStaff) / 60).toBe(
      37
    )
  })

  it("excludes non-pedagog and inactive pedagog staff from pedagog capacity", () => {
    const linkedStaff = [
      staffMember({ role: "pedagog" }),
      staffMember({ role: "assistant" }),
      staffMember({ role: "pedagog", active: false }),
    ]

    expect(calculateLinkedActivePedagogCapacityMinutes(linkedStaff) / 60).toBe(
      37
    )
  })

  it("only counts pedagog staff passed as linked staff", () => {
    const linkedStaff = [staffMember({ role: "pedagog" })]

    expect(calculateLinkedActivePedagogCapacityMinutes(linkedStaff) / 60).toBe(
      37
    )
  })

  it("exposes fractional-hour shortfalls", () => {
    const shortfall = calculateGroupCapacityShortfall(
      [
        weekdayRule({
          startTime: "09:00",
          endTime: "10:15",
          minStaff: 1,
          minPedagogs: 1,
        }),
      ],
      [staffMember({ role: "pedagog", maxHoursPerWeek: 1 })]
    )

    expect(shortfall.totalShortfallHours).toBe(0.25)
    expect(shortfall.pedagogShortfallHours).toBe(0.25)
  })
})
