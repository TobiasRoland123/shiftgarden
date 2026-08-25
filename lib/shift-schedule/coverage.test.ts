import { describe, expect, it } from "vitest"

import { calculateCoverageSegments } from "@/lib/shift-schedule/coverage"
import type { CoverageSegment } from "@/lib/shift-schedule/coverage"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"

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
        id: "pedagog-2",
        firstName: "Katherine",
        lastName: "Johnson",
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
    rules: [],
    ...overrides,
  }
}

function createGeneratedSchedule(
  mondayShifts: GeneratedSchedule["days"][number]["shifts"]
): GeneratedSchedule {
  return {
    groupId: "group-1",
    warnings: [],
    days: daysOfWeek.map((dayOfWeek) => ({
      dayOfWeek,
      shifts: dayOfWeek === "monday" ? mondayShifts : [],
    })),
  }
}

function mondaySegments(
  rules: ScheduleInput["rules"],
  mondayShifts: GeneratedSchedule["days"][number]["shifts"]
) {
  return calculateCoverageSegments({
    scheduleInput: createScheduleInput({ rules }),
    generatedSchedule: createGeneratedSchedule(mondayShifts),
  }).filter((segment) => segment.dayOfWeek === "monday")
}

function summarize(segments: CoverageSegment[]) {
  return segments.map((segment) => ({
    range: `${segment.startTime}-${segment.endTime}`,
    staffCount: segment.staffCount,
    pedagogCount: segment.pedagogCount,
    minStaff: segment.minStaff,
    minPedagogs: segment.minPedagogs,
  }))
}

function unmetRanges(segments: CoverageSegment[]) {
  return segments
    .filter(
      (segment) =>
        segment.staffCount < segment.minStaff ||
        segment.pedagogCount < segment.minPedagogs
    )
    .map((segment) => `${segment.startTime}-${segment.endTime}`)
}

describe("calculateCoverageSegments", () => {
  it("reports a fully met rule as a single satisfied segment", () => {
    const segments = mondaySegments(
      [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          minPedagogs: 1,
          minStaff: 2,
        },
      ],
      [
        { staffId: "pedagog-1", startTime: "09:00", endTime: "12:00" },
        { staffId: "assistant-1", startTime: "09:00", endTime: "12:00" },
      ]
    )

    expect(summarize(segments)).toEqual([
      {
        range: "09:00-12:00",
        staffCount: 2,
        pedagogCount: 1,
        minStaff: 2,
        minPedagogs: 1,
      },
    ])
    expect(unmetRanges(segments)).toEqual([])
  })

  it("detects a single coverage gap inside a rule period", () => {
    const segments = mondaySegments(
      [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          minPedagogs: 0,
          minStaff: 2,
        },
      ],
      [
        { staffId: "pedagog-1", startTime: "09:00", endTime: "12:00" },
        { staffId: "assistant-1", startTime: "09:00", endTime: "11:00" },
      ]
    )

    expect(unmetRanges(segments)).toEqual(["11:00-12:00"])
  })

  it("reports every coverage gap inside one rule period", () => {
    const segments = mondaySegments(
      [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "15:00",
          minPedagogs: 0,
          minStaff: 2,
        },
      ],
      [
        { staffId: "pedagog-1", startTime: "09:00", endTime: "15:00" },
        { staffId: "assistant-1", startTime: "10:00", endTime: "13:00" },
      ]
    )

    expect(unmetRanges(segments)).toEqual(["09:00-10:00", "13:00-15:00"])
  })

  it("applies the highest minimum where staffing rules overlap", () => {
    const segments = mondaySegments(
      [
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
      [
        { staffId: "pedagog-1", startTime: "09:00", endTime: "14:00" },
        { staffId: "assistant-1", startTime: "09:00", endTime: "14:00" },
      ]
    )
    const overlapping = segments.find(
      (segment) => segment.startTime === "10:00" && segment.endTime === "12:00"
    )

    expect(overlapping).toMatchObject({
      staffCount: 2,
      minStaff: 3,
      minPedagogs: 1,
      ruleIndexes: [0, 1],
    })
    expect(unmetRanges(segments)).toEqual(["10:00-12:00", "12:00-14:00"])
  })

  it("detects a pedagog gap while total staff coverage is met", () => {
    const segments = mondaySegments(
      [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          minPedagogs: 1,
          minStaff: 2,
        },
      ],
      [
        { staffId: "assistant-1", startTime: "09:00", endTime: "12:00" },
        { staffId: "pedagog-1", startTime: "09:00", endTime: "10:00" },
      ]
    )

    expect(summarize(segments)).toEqual([
      {
        range: "09:00-10:00",
        staffCount: 2,
        pedagogCount: 1,
        minStaff: 2,
        minPedagogs: 1,
      },
      {
        range: "10:00-12:00",
        staffCount: 1,
        pedagogCount: 0,
        minStaff: 2,
        minPedagogs: 1,
      },
    ])
  })

  it("counts a pedagog toward total staff coverage rather than in addition", () => {
    const segments = mondaySegments(
      [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          minPedagogs: 1,
          minStaff: 2,
        },
      ],
      [
        { staffId: "pedagog-1", startTime: "09:00", endTime: "12:00" },
        { staffId: "assistant-1", startTime: "09:00", endTime: "12:00" },
      ]
    )

    expect(segments[0]).toMatchObject({ staffCount: 2, pedagogCount: 1 })
    expect(unmetRanges(segments)).toEqual([])
  })

  it("gives segments outside every staffing rule a zero minimum", () => {
    const segments = mondaySegments(
      [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          minPedagogs: 0,
          minStaff: 1,
        },
      ],
      [
        { staffId: "pedagog-1", startTime: "09:00", endTime: "12:00" },
        { staffId: "assistant-1", startTime: "13:00", endTime: "15:00" },
      ]
    )
    const outsideRules = segments.find(
      (segment) => segment.startTime === "13:00" && segment.endTime === "15:00"
    )

    expect(outsideRules).toMatchObject({
      staffCount: 1,
      minStaff: 0,
      minPedagogs: 0,
      ruleIndexes: [],
    })
    expect(unmetRanges(segments)).toEqual([])
  })

  it("ignores zero-length shifts when counting coverage", () => {
    const segments = mondaySegments(
      [
        {
          dayOfWeek: "monday",
          startTime: "09:00",
          endTime: "12:00",
          minPedagogs: 0,
          minStaff: 1,
        },
      ],
      [{ staffId: "pedagog-1", startTime: "10:00", endTime: "10:00" }]
    )

    expect(unmetRanges(segments)).toEqual(["09:00-12:00"])
  })

  it("produces no segments for a weekday with no rules and no shifts", () => {
    const segments = calculateCoverageSegments({
      scheduleInput: createScheduleInput({ rules: [] }),
      generatedSchedule: createGeneratedSchedule([]),
    })

    expect(segments).toEqual([])
  })
})
