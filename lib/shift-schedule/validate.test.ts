import { describe, expect, it } from "vitest"

import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import { validateGeneratedSchedule } from "@/lib/shift-schedule/validate-generated"
import { validateScheduleInputSupport } from "@/lib/shift-schedule/validate-input"

const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const

const daysOfWeek = [...weekdays, "saturday", "sunday"] as const

function createScheduleInput(
  overrides: Partial<ScheduleInput> = {}
): ScheduleInput {
  const scheduleInput: ScheduleInput = {
    group: {
      id: "group-1",
      name: "Blue room",
    },
    openingHours: daysOfWeek.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: "08:00",
      endTime: "16:00",
    })),
    staff: [
      {
        id: "pedagog-1",
        firstName: "Ada",
        lastName: "Lovelace",
        role: "pedagog",
        maxHoursPerWeek: 37,
        active: true,
        availability: weekdays.map((dayOfWeek) => ({
          dayOfWeek,
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        })),
      },
      {
        id: "assistant-1",
        firstName: "Grace",
        lastName: "Hopper",
        role: "assistant",
        maxHoursPerWeek: 37,
        active: true,
        availability: weekdays.map((dayOfWeek) => ({
          dayOfWeek,
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        })),
      },
      {
        id: "pedagog-2",
        firstName: "Katherine",
        lastName: "Johnson",
        role: "pedagog",
        maxHoursPerWeek: 37,
        active: true,
        availability: weekdays.map((dayOfWeek) => ({
          dayOfWeek,
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        })),
      },
      {
        id: "inactive-1",
        firstName: "Inactive",
        lastName: "Person",
        role: "assistant",
        maxHoursPerWeek: 37,
        active: false,
        availability: weekdays.map((dayOfWeek) => ({
          dayOfWeek,
          startAvailabilityTime: "08:00",
          endAvailabilityTime: "16:00",
        })),
      },
    ],
    rules: weekdays.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: "09:00",
      endTime: "15:00",
      minPedagogs: 1,
      minStaff: 2,
    })),
  }

  return {
    ...scheduleInput,
    ...overrides,
  }
}

function createGeneratedSchedule(
  overrides: Partial<GeneratedSchedule> = {}
): GeneratedSchedule {
  const generatedSchedule: GeneratedSchedule = {
    groupId: "group-1",
    days: daysOfWeek.map((dayOfWeek) => ({
      dayOfWeek,
      shifts: weekdays.includes(dayOfWeek as (typeof weekdays)[number])
        ? [
            {
              staffId: "pedagog-1",
              startTime: "09:00",
              endTime: "15:00",
            },
            {
              staffId: "assistant-1",
              startTime: "09:00",
              endTime: "15:00",
            },
          ]
        : [],
    })),
    warnings: [],
  }

  return {
    ...generatedSchedule,
    ...overrides,
  }
}

function codesFor(result: ReturnType<typeof validateGeneratedSchedule>) {
  return result.issues.map((issue) => issue.code)
}

describe("validateScheduleInputSupport", () => {
  it("supports weekend staffing rules inside opening hours", () => {
    const result = validateScheduleInputSupport(
      createScheduleInput({
        rules: [
          {
            dayOfWeek: "saturday",
            startTime: "09:00",
            endTime: "12:00",
            minPedagogs: 1,
            minStaff: 2,
          },
        ],
      })
    )

    expect(result).toEqual({ valid: true, issues: [] })
  })

  it("rejects staffing rules that do not fit one opening interval", () => {
    const result = validateScheduleInputSupport(
      createScheduleInput({
        openingHours: [
          { dayOfWeek: "monday", startTime: "08:00", endTime: "12:00" },
          { dayOfWeek: "monday", startTime: "13:00", endTime: "16:00" },
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

    expect(result.issues).toMatchObject([
      { code: "staffing_rule_outside_opening_hours", severity: "error" },
    ])
  })
})

describe("validateGeneratedSchedule", () => {
  it("accepts a valid generated plan", () => {
    const result = validateGeneratedSchedule({
      scheduleInput: createScheduleInput(),
      generatedSchedule: createGeneratedSchedule(),
    })

    expect(result).toEqual({
      valid: true,
      issues: [],
    })
  })

  it("reports group mismatch, missing weekday, duplicate weekday, unknown staff, inactive staff, invalid time, availability, max-hours, and overlap failures", () => {
    const scheduleInput = createScheduleInput({
      staff: [
        {
          id: "pedagog-1",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "pedagog",
          maxHoursPerWeek: 1,
          active: true,
          availability: [
            {
              dayOfWeek: "monday",
              startAvailabilityTime: "09:00",
              endAvailabilityTime: "10:00",
            },
          ],
        },
        {
          id: "inactive-1",
          firstName: "Inactive",
          lastName: "Person",
          role: "assistant",
          maxHoursPerWeek: 37,
          active: false,
          availability: [
            {
              dayOfWeek: "monday",
              startAvailabilityTime: "09:00",
              endAvailabilityTime: "16:00",
            },
          ],
        },
      ],
      rules: [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "15:00",
          minPedagogs: 0,
          minStaff: 0,
        },
      ],
    })
    const generatedSchedule = createGeneratedSchedule({
      groupId: "other-group",
      days: [
        {
          dayOfWeek: "monday",
          shifts: [
            {
              staffId: "unknown-1",
              startTime: "09:00",
              endTime: "12:00",
            },
            {
              staffId: "inactive-1",
              startTime: "09:00",
              endTime: "12:00",
            },
            {
              staffId: "pedagog-1",
              startTime: "09:00",
              endTime: "12:00",
            },
            {
              staffId: "pedagog-1",
              startTime: "11:00",
              endTime: "11:00",
            },
          ],
        },
        {
          dayOfWeek: "monday",
          shifts: [],
        },
        {
          dayOfWeek: "tuesday",
          shifts: [],
        },
        {
          dayOfWeek: "wednesday",
          shifts: [],
        },
        {
          dayOfWeek: "friday",
          shifts: [],
        },
      ],
    })

    expect(
      codesFor(
        validateGeneratedSchedule({
          scheduleInput,
          generatedSchedule,
        })
      )
    ).toEqual(
      expect.arrayContaining([
        "group_id_mismatch",
        "missing_weekday",
        "duplicate_weekday",
        "unknown_staff",
        "inactive_staff",
        "invalid_shift_time",
        "outside_availability",
        "max_hours_exceeded",
        "overlapping_shift",
      ])
    )
  })

  it("rejects shifts that cross gaps between same-day availability intervals", () => {
    const scheduleInput = createScheduleInput({
      staff: [
        {
          id: "pedagog-1",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "pedagog",
          maxHoursPerWeek: 37,
          active: true,
          availability: [
            {
              dayOfWeek: "monday",
              startAvailabilityTime: "08:00",
              endAvailabilityTime: "12:00",
            },
            {
              dayOfWeek: "monday",
              startAvailabilityTime: "13:00",
              endAvailabilityTime: "16:00",
            },
          ],
        },
      ],
      rules: [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "15:00",
          minPedagogs: 0,
          minStaff: 0,
        },
      ],
    })

    const result = validateGeneratedSchedule({
      scheduleInput,
      generatedSchedule: createGeneratedSchedule({
        days: [
          {
            dayOfWeek: "monday",
            shifts: [
              {
                staffId: "pedagog-1",
                startTime: "11:00",
                endTime: "14:00",
              },
            ],
          },
          ...daysOfWeek.slice(1).map((dayOfWeek) => ({
            dayOfWeek,
            shifts: [],
          })),
        ],
      }),
    })

    expect(codesFor(result)).toContain("outside_availability")
  })

  it("allows adjacent shifts and counts partial-hour shifts toward weekly maximums", () => {
    const scheduleInput = createScheduleInput({
      staff: [
        {
          id: "pedagog-1",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "pedagog",
          maxHoursPerWeek: 4,
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
          startTime: "09:00",
          endTime: "13:45",
          minPedagogs: 0,
          minStaff: 0,
        },
      ],
    })

    const result = validateGeneratedSchedule({
      scheduleInput,
      generatedSchedule: createGeneratedSchedule({
        days: [
          {
            dayOfWeek: "monday",
            shifts: [
              {
                staffId: "pedagog-1",
                startTime: "09:00",
                endTime: "12:30",
              },
              {
                staffId: "pedagog-1",
                startTime: "12:30",
                endTime: "13:45",
              },
            ],
          },
          ...daysOfWeek.slice(1).map((dayOfWeek) => ({
            dayOfWeek,
            shifts: [],
          })),
        ],
      }),
    })

    expect(codesFor(result)).toContain("max_hours_exceeded")
    expect(codesFor(result)).not.toContain("overlapping_shift")
  })

  it("validates staffing coverage while allowing shifts outside rule periods but inside opening hours", () => {
    const scheduleInput = createScheduleInput({
      rules: [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          minPedagogs: 1,
          minStaff: 2,
        },
        {
          dayOfWeek: "monday",
          startTime: "10:00",
          endTime: "14:00",
          minPedagogs: 0,
          minStaff: 3,
        },
      ],
    })

    const result = validateGeneratedSchedule({
      scheduleInput,
      generatedSchedule: createGeneratedSchedule({
        days: [
          {
            dayOfWeek: "monday",
            shifts: [
              {
                staffId: "pedagog-1",
                startTime: "09:00",
                endTime: "12:00",
              },
              {
                staffId: "assistant-1",
                startTime: "09:00",
                endTime: "11:00",
              },
              {
                staffId: "pedagog-2",
                startTime: "14:00",
                endTime: "15:00",
              },
            ],
          },
          ...daysOfWeek.slice(1).map((dayOfWeek) => ({
            dayOfWeek,
            shifts: [],
          })),
        ],
      }),
    })

    expect(codesFor(result)).toContain("min_staff_unmet")
    expect(codesFor(result)).not.toContain("shift_outside_opening_hours")
    expect(codesFor(result)).not.toContain("min_pedagogs_unmet")
  })

  it("allows pedagog minimums above total staff minimum and shifts spanning adjacent rule periods", () => {
    const scheduleInput = createScheduleInput({
      rules: [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          minPedagogs: 2,
          minStaff: 1,
        },
        {
          dayOfWeek: "monday",
          startTime: "12:00",
          endTime: "15:00",
          minPedagogs: 2,
          minStaff: 1,
        },
      ],
    })

    const result = validateGeneratedSchedule({
      scheduleInput,
      generatedSchedule: createGeneratedSchedule({
        days: [
          {
            dayOfWeek: "monday",
            shifts: [
              {
                staffId: "pedagog-1",
                startTime: "09:00",
                endTime: "15:00",
              },
              {
                staffId: "pedagog-2",
                startTime: "09:00",
                endTime: "15:00",
              },
            ],
          },
          ...daysOfWeek.slice(1).map((dayOfWeek) => ({
            dayOfWeek,
            shifts: [],
          })),
        ],
      }),
    })

    expect(codesFor(result)).not.toEqual(
      expect.arrayContaining([
        "min_staff_unmet",
        "min_pedagogs_unmet",
        "shift_outside_opening_hours",
      ])
    )
  })

  it("rejects a shift crossing a gap between opening-hours intervals", () => {
    const result = validateGeneratedSchedule({
      scheduleInput: createScheduleInput({
        openingHours: [
          { dayOfWeek: "saturday", startTime: "08:00", endTime: "12:00" },
          { dayOfWeek: "saturday", startTime: "13:00", endTime: "16:00" },
        ],
        rules: [],
      }),
      generatedSchedule: createGeneratedSchedule({
        days: daysOfWeek.map((dayOfWeek) => ({
          dayOfWeek,
          shifts:
            dayOfWeek === "saturday"
              ? [{ staffId: "pedagog-1", startTime: "11:00", endTime: "14:00" }]
              : [],
        })),
      }),
    })

    expect(codesFor(result)).toContain("shift_outside_opening_hours")
  })

  it("enforces staffing coverage on weekends", () => {
    const result = validateGeneratedSchedule({
      scheduleInput: createScheduleInput({
        rules: [
          {
            dayOfWeek: "sunday",
            startTime: "09:00",
            endTime: "12:00",
            minPedagogs: 0,
            minStaff: 1,
          },
        ],
      }),
      generatedSchedule: createGeneratedSchedule({
        days: daysOfWeek.map((dayOfWeek) => ({ dayOfWeek, shifts: [] })),
      }),
    })

    expect(codesFor(result)).toContain("min_staff_unmet")
  })
})
