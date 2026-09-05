import { describe, expect, it } from "vitest"
import type { PlanningShift } from "./contracts"
import { composeEffectiveInputs } from "./effective-inputs"
import { fixturePeriod, fixtureRecurring } from "./domain.fixture"
import { validateDatedSchedule } from "./validate"

const shift = (
  id: string,
  staffId: string,
  date = "2026-09-07",
  startTime = "09:00",
  endTime = "12:00"
): PlanningShift => ({
  id,
  staffId,
  date,
  startTime,
  endTime,
  locked: false,
  groupId: "group-1",
})

const oneStaffRecurring = {
  ...fixtureRecurring,
  rules: [
    {
      dayOfWeek: "monday" as const,
      startTime: "09:00",
      endTime: "12:00",
      minStaff: 1,
      minPedagogs: 0,
    },
  ],
}

describe("dated schedule validation", () => {
  it("requires every generated actual date, including an empty closed date", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
      openingReplacements: [
        {
          id: "closure",
          institutionId: "institution-1",
          date: "2026-09-08",
          intervals: [],
        },
      ],
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: {
        groupId: "group-1",
        days: [{ date: "2026-09-07", shifts: [] }],
      },
    })
    expect(result.issues.map((entry) => entry.code)).toContain("missing_date")
  })

  it("reports independent exact coverage shortages and counts each staff member once", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [
        shift("one", "staff-p"),
        shift("duplicate", "staff-p", "2026-09-07", "10:00", "11:00"),
      ],
    })
    expect(
      result.issues.some(
        (entry) =>
          entry.code === "min_staff_unmet" && entry.date === "2026-09-07"
      )
    ).toBe(true)
    expect(
      result.issues.some((entry) => entry.code === "min_pedagogs_unmet")
    ).toBe(true)
    expect(
      result.issues.some((entry) => entry.code === "overlapping_shift")
    ).toBe(true)
  })

  it("includes counted events and authoritative commitments in weekly caps", () => {
    const recurring = {
      ...fixtureRecurring,
      staff: fixtureRecurring.staff.map((staff) =>
        staff.id === "staff-p" ? { ...staff, maxHoursPerWeek: 10 } : staff
      ),
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring,
      events: [
        {
          id: "training",
          ownerType: "institution",
          ownerId: "institution-1",
          kind: "training",
          date: "2026-09-13",
          startTime: "08:00",
          endTime: "12:00",
          participantStaffIds: ["staff-p"],
          countsTowardWeeklyHours: true,
        },
      ],
      commitments: [
        {
          id: "external",
          sourceGroupId: "other-group",
          versionId: "version-1",
          staffId: "staff-p",
          date: "2026-09-13",
          startTime: "12:00",
          endTime: "16:00",
          locked: true,
          authoritative: true,
        },
      ],
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [shift("one", "staff-p")],
    })
    expect(
      result.issues.some((entry) => entry.code === "max_hours_exceeded")
    ).toBe(true)
  })

  it("splits demand at shift boundaries so adjacent split shifts provide full coverage", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: oneStaffRecurring,
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [
        shift("first", "staff-p", "2026-09-07", "09:00", "10:30"),
        shift("second", "staff-a", "2026-09-07", "10:30", "12:00"),
      ],
    })
    expect(
      result.issues.some(
        (entry) =>
          entry.code === "min_staff_unmet" && entry.date === "2026-09-07"
      )
    ).toBe(false)
  })

  it("reports only the exact uncovered segment inside a larger demand interval", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: oneStaffRecurring,
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [
        shift("before", "staff-p", "2026-09-07", "09:00", "11:00"),
        shift("after", "staff-p", "2026-09-07", "11:30", "12:00"),
      ],
    })
    expect(
      result.issues.filter(
        (entry) =>
          entry.code === "min_staff_unmet" && entry.date === "2026-09-07"
      )
    ).toEqual([
      expect.objectContaining({ startTime: "11:00", endTime: "11:30" }),
    ])
  })

  it("does not count a whole-shift availability violation toward partial demand coverage", () => {
    const recurring = {
      ...oneStaffRecurring,
      staff: oneStaffRecurring.staff.map((staff) =>
        staff.id === "staff-p"
          ? {
              ...staff,
              availability: staff.availability.map((entry) =>
                entry.dayOfWeek === "monday"
                  ? { ...entry, startAvailabilityTime: "09:00" }
                  : entry
              ),
            }
          : staff
      ),
    }
    const inputs = composeEffectiveInputs({ period: fixturePeriod, recurring })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [shift("too-early", "staff-p", "2026-09-07", "08:00", "12:00")],
    })
    expect(
      result.issues.some((entry) => entry.code === "outside_availability")
    ).toBe(true)
    expect(
      result.issues.some(
        (entry) =>
          entry.code === "min_staff_unmet" &&
          entry.startTime === "09:00" &&
          entry.endTime === "12:00"
      )
    ).toBe(true)
  })

  it("does not count inactive, unknown, or externally committed staff toward coverage", () => {
    const recurring = {
      ...fixtureRecurring,
      staff: fixtureRecurring.staff.map((staff) =>
        staff.id === "staff-a" ? { ...staff, active: false } : staff
      ),
    }
    const commitment = {
      id: "same-group-adjacent",
      sourceGroupId: "group-1",
      sourcePeriodId: "adjacent-period",
      versionId: "version-1",
      staffId: "staff-p",
      date: "2026-09-07",
      startTime: "10:00",
      endTime: "11:00",
      locked: true,
      authoritative: true,
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring,
      commitments: [commitment],
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [
        shift("external", "staff-p"),
        shift("inactive", "staff-a"),
        shift("unknown", "missing"),
      ],
    })
    expect(
      result.issues.some(
        (entry) =>
          entry.code === "external_overlap" &&
          entry.startTime === "10:00" &&
          entry.endTime === "11:00"
      )
    ).toBe(true)
    expect(result.issues.some((entry) => entry.code === "inactive_staff")).toBe(
      true
    )
    expect(result.issues.some((entry) => entry.code === "unknown_staff")).toBe(
      true
    )
    expect(
      result.issues.some((entry) => entry.code === "min_staff_unmet")
    ).toBe(true)
    expect(
      result.issues.some((entry) => entry.code === "min_pedagogs_unmet")
    ).toBe(true)
  })

  it("allows half-open adjacency to an authoritative commitment", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: oneStaffRecurring,
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [shift("candidate", "staff-p")],
      externalCommitments: [
        {
          id: "later",
          sourceGroupId: "other",
          versionId: "v1",
          staffId: "staff-p",
          date: "2026-09-07",
          startTime: "12:00",
          endTime: "14:00",
          locked: true,
          authoritative: true,
        },
      ],
    })
    expect(
      result.issues.some((entry) => entry.code === "external_overlap")
    ).toBe(false)
  })

  it("deduplicates commitments supplied through both effective inputs and the call", () => {
    const recurring = {
      ...oneStaffRecurring,
      staff: oneStaffRecurring.staff.map((staff) =>
        staff.id === "staff-p" ? { ...staff, maxHoursPerWeek: 6 } : staff
      ),
    }
    const commitment = {
      id: "committed",
      sourceGroupId: "other",
      sourcePeriodId: "other-period",
      versionId: "v1",
      staffId: "staff-p",
      date: "2026-09-13",
      startTime: "09:00",
      endTime: "12:00",
      locked: true,
      authoritative: true,
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring,
      commitments: [commitment],
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [shift("candidate", "staff-p")],
      externalCommitments: [commitment],
    })
    expect(
      result.issues.some((entry) => entry.code === "max_hours_exceeded")
    ).toBe(false)
  })

  it("counts a duplicated shared event and participant at most once", () => {
    const recurring = {
      ...oneStaffRecurring,
      staff: oneStaffRecurring.staff.map((staff) =>
        staff.id === "staff-p" ? { ...staff, maxHoursPerWeek: 5 } : staff
      ),
    }
    const event = {
      id: "training",
      ownerType: "institution" as const,
      ownerId: "institution-1",
      kind: "training" as const,
      date: "2026-09-13",
      startTime: "08:00",
      endTime: "10:00",
      participantStaffIds: ["staff-p", "staff-p"],
      countsTowardWeeklyHours: true,
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring,
      events: [event, event],
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [shift("candidate", "staff-p")],
    })
    expect(
      result.issues.some((entry) => entry.code === "max_hours_exceeded")
    ).toBe(false)
  })

  it("reports FIFO inversions but does not compare equal starts", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: { ...fixtureRecurring, rules: [] },
    })
    const inverted = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [
        shift("early", "staff-p", "2026-09-07", "08:00", "16:00"),
        shift("late", "staff-a", "2026-09-07", "09:00", "15:00"),
      ],
    })
    const equal = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [
        shift("equal-a", "staff-p", "2026-09-07", "09:00", "16:00"),
        shift("equal-b", "staff-a", "2026-09-07", "09:00", "15:00"),
      ],
    })
    expect(
      inverted.issues.some((entry) => entry.code === "fifo_end_order_inversion")
    ).toBe(true)
    expect(
      equal.issues.some((entry) => entry.code === "fifo_end_order_inversion")
    ).toBe(false)
  })

  it("rejects a shift crossing an opening gap", () => {
    const recurring = {
      ...oneStaffRecurring,
      openingHours: [
        { dayOfWeek: "monday" as const, startTime: "08:00", endTime: "10:00" },
        { dayOfWeek: "monday" as const, startTime: "11:00", endTime: "16:00" },
      ],
      rules: [],
    }
    const inputs = composeEffectiveInputs({ period: fixturePeriod, recurring })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [shift("cross-gap", "staff-p", "2026-09-07", "09:00", "12:00")],
    })
    expect(
      result.issues.some(
        (entry) => entry.code === "shift_outside_opening_hours"
      )
    ).toBe(true)
  })

  it("reports duplicate and out-of-range generated date entries", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: {
        groupId: "group-1",
        days: [
          { date: "2026-09-07", shifts: [] },
          { date: "2026-09-07", shifts: [] },
          { date: "2026-09-09", shifts: [] },
        ],
      },
    })
    expect(
      result.issues.some(
        (entry) =>
          entry.code === "duplicate_date" && entry.date === "2026-09-07"
      )
    ).toBe(true)
    expect(
      result.issues.some(
        (entry) => entry.code === "missing_date" && entry.date === "2026-09-08"
      )
    ).toBe(true)
    expect(
      result.issues.some(
        (entry) =>
          entry.code === "out_of_range_date" && entry.date === "2026-09-09"
      )
    ).toBe(true)
  })

  it("reports other-draft overlap and weekly competition as non-blocking warnings", () => {
    const recurring = {
      ...oneStaffRecurring,
      staff: oneStaffRecurring.staff.map((staff) =>
        staff.id === "staff-p" ? { ...staff, maxHoursPerWeek: 5 } : staff
      ),
    }
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring,
      commitments: [
        {
          id: "overlap",
          sourceGroupId: "other",
          sourcePeriodId: "draft-a",
          staffId: "staff-p",
          date: "2026-09-07",
          startTime: "10:00",
          endTime: "11:00",
          locked: false,
          authoritative: false,
        },
        {
          id: "weekly",
          sourceGroupId: "other",
          sourcePeriodId: "draft-a",
          staffId: "staff-p",
          date: "2026-09-13",
          startTime: "09:00",
          endTime: "12:00",
          locked: false,
          authoritative: false,
        },
      ],
    })
    const result = validateDatedSchedule({
      period: fixturePeriod,
      effectiveInputs: inputs,
      shifts: [shift("candidate", "staff-p")],
    })
    const advisories = result.issues.filter(
      (entry) => entry.code === "other_draft_conflict"
    )
    expect(advisories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warning",
          startTime: "10:00",
          endTime: "11:00",
        }),
        expect.objectContaining({
          severity: "warning",
          details: expect.objectContaining({
            conflictType: "weekly_hours",
            week: "2026-W37",
          }),
        }),
      ])
    )
    expect(result.valid).toBe(true)
  })
})
