import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {},
  schema: {},
}))

vi.mock("@/lib/ai/queries", () => ({
  getActiveStaffWithAvailability: vi.fn(),
  getGroupsWithStaffingRules: vi.fn(),
  getAbsencesInPeriod: vi.fn(),
  getPlanningRules: vi.fn(),
}))

import { formatInput } from "@/lib/ai/format-input"
import {
  getAbsencesInPeriod,
  getActiveStaffWithAvailability,
  getGroupsWithStaffingRules,
  getPlanningRules,
} from "@/lib/ai/queries"
import { planningInputSchema } from "@/lib/ai/types"

const TZ = "Europe/Copenhagen"

const PLANNING_RULES_ROW = {
  id: "pr1",
  minPedagogueRatio: 0.5,
  minStaffRatio: 0.1,
  breakMinutes: 30,
  breakThresholdHours: 5,
}

function staffRow(
  overrides: Partial<{
    id: string
    name: string
    role: "pedagogue" | "assistant" | "substitute"
    weeklyMaxHours: number
    active: boolean
  }> = {}
) {
  return {
    id: "s1",
    name: "Alice",
    email: null,
    role: "pedagogue" as const,
    weeklyMaxHours: 37,
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
}

function availabilityRow(
  staffId: string,
  weekday: number,
  startTime: string,
  endTime: string
) {
  return {
    id: `${staffId}-${weekday}`,
    staffId,
    weekday,
    startTime,
    endTime,
  }
}

function groupRow() {
  return {
    id: "g1",
    name: "Solsikker",
    openTime: "06:30:00",
    closeTime: "17:00:00",
    expectedChildren: 12,
  }
}

function staffingRuleRow(
  overrides: Partial<{
    startTime: string
    endTime: string
    minStaff: number
    minPedagoger: number
  }> = {}
) {
  return {
    id: "sr1",
    groupId: "g1",
    startTime: "06:30:00",
    endTime: "17:00:00",
    minStaff: 2,
    minPedagoger: 1,
    ...overrides,
  }
}

function setMocks(opts: {
  staffRows: unknown[]
  groupRows: unknown[]
  absences: unknown[]
  planningRules?: unknown
}) {
  vi.mocked(getActiveStaffWithAvailability).mockResolvedValue(
    opts.staffRows as never
  )
  vi.mocked(getGroupsWithStaffingRules).mockResolvedValue(
    opts.groupRows as never
  )
  vi.mocked(getAbsencesInPeriod).mockResolvedValue(opts.absences as never)
  const rules =
    "planningRules" in opts ? opts.planningRules : PLANNING_RULES_ROW
  vi.mocked(getPlanningRules).mockResolvedValue(rules as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("formatInput", () => {
  it("produces a valid PlanningInput with weekday availability expanded to UTC", async () => {
    // Mon 2026-05-04 → Mon 2026-05-11, exclusive end (one full week)
    const periodStart = new Date("2026-05-03T22:00:00Z") // 2026-05-04 00:00 in CPH
    const periodEnd = new Date("2026-05-10T22:00:00Z") // 2026-05-11 00:00 in CPH

    setMocks({
      staffRows: [
        // Mon (0) and Wed (2) availability
        {
          staff: staffRow(),
          staff_availability: availabilityRow("s1", 0, "08:00:00", "16:00:00"),
        },
        {
          staff: staffRow(),
          staff_availability: availabilityRow("s1", 2, "09:00:00", "15:00:00"),
        },
      ],
      groupRows: [{ groups: groupRow(), staffing_rules: staffingRuleRow() }],
      absences: [],
    })

    const result = await formatInput(periodStart, periodEnd, TZ)

    expect(planningInputSchema.parse(result)).toBeTruthy()
    expect(result.staff).toEqual([
      { id: "s1", name: "Alice", role: "pedagogue", weeklyMaxHours: 37 },
    ])
    expect(result.availability).toHaveLength(2)
    expect(result.availability[0]).toEqual({
      staffId: "s1",
      date: "2026-05-04",
      startUtc: "2026-05-04T06:00:00.000Z", // 08:00 CEST = 06:00 UTC
      endUtc: "2026-05-04T14:00:00.000Z",
    })
    expect(result.availability[1]).toEqual({
      staffId: "s1",
      date: "2026-05-06",
      startUtc: "2026-05-06T07:00:00.000Z",
      endUtc: "2026-05-06T13:00:00.000Z",
    })
    expect(result.groups).toEqual([
      {
        id: "g1",
        name: "Solsikker",
        openTime: "06:30:00",
        closeTime: "17:00:00",
        expectedChildren: 12,
        staffingRules: [
          {
            startTime: "06:30:00",
            endTime: "17:00:00",
            minStaff: 2,
            minPedagoger: 1,
          },
        ],
      },
    ])
    expect(result.rules).toEqual({
      minPedagogueRatio: 0.5,
      minStaffRatio: 0.1,
      breakMinutes: 30,
      breakThresholdHours: 5,
    })
  })

  it("drops inactive staff defensively", async () => {
    setMocks({
      staffRows: [
        {
          staff: staffRow({ active: false }),
          staff_availability: availabilityRow("s1", 0, "08:00", "16:00"),
        },
      ],
      groupRows: [{ groups: groupRow(), staffing_rules: null }],
      absences: [],
    })

    const result = await formatInput(
      new Date("2026-05-03T22:00:00Z"),
      new Date("2026-05-10T22:00:00Z"),
      TZ
    )

    expect(result.staff).toEqual([])
    expect(result.availability).toEqual([])
  })

  it("drops staff fully absent for the entire period", async () => {
    const periodStart = new Date("2026-05-03T22:00:00Z")
    const periodEnd = new Date("2026-05-10T22:00:00Z")

    setMocks({
      staffRows: [
        {
          staff: staffRow(),
          staff_availability: availabilityRow("s1", 0, "08:00:00", "16:00:00"),
        },
      ],
      groupRows: [{ groups: groupRow(), staffing_rules: null }],
      absences: [
        {
          id: "a1",
          staffId: "s1",
          startsAt: new Date("2026-05-01T00:00:00Z"),
          endsAt: new Date("2026-05-15T00:00:00Z"),
          type: "vacation",
        },
      ],
    })

    const result = await formatInput(periodStart, periodEnd, TZ)
    expect(result.staff).toEqual([])
    expect(result.availability).toEqual([])
    expect(result.absences).toEqual([])
  })

  it("keeps partially-absent staff and includes their absence", async () => {
    const periodStart = new Date("2026-05-03T22:00:00Z")
    const periodEnd = new Date("2026-05-10T22:00:00Z")

    setMocks({
      staffRows: [
        {
          staff: staffRow(),
          staff_availability: availabilityRow("s1", 0, "08:00:00", "16:00:00"),
        },
      ],
      groupRows: [{ groups: groupRow(), staffing_rules: null }],
      absences: [
        {
          id: "a1",
          staffId: "s1",
          startsAt: new Date("2026-05-04T00:00:00Z"),
          endsAt: new Date("2026-05-05T00:00:00Z"),
          type: "sick",
        },
      ],
    })

    const result = await formatInput(periodStart, periodEnd, TZ)
    expect(result.staff).toHaveLength(1)
    expect(result.absences).toEqual([
      {
        staffId: "s1",
        startsAt: "2026-05-04T00:00:00.000Z",
        endsAt: "2026-05-05T00:00:00.000Z",
        type: "sick",
      },
    ])
  })

  it("omits days with no matching availability", async () => {
    setMocks({
      staffRows: [
        {
          staff: staffRow(),
          // Only Sunday availability (weekday 6)
          staff_availability: availabilityRow("s1", 6, "10:00:00", "14:00:00"),
        },
      ],
      groupRows: [{ groups: groupRow(), staffing_rules: null }],
      absences: [],
    })

    // Mon-Fri only, Sunday excluded
    const result = await formatInput(
      new Date("2026-05-03T22:00:00Z"),
      new Date("2026-05-08T22:00:00Z"),
      TZ
    )
    expect(result.availability).toEqual([])
  })

  it("handles DST spring-forward correctly", async () => {
    // 2026 spring-forward in Europe/Copenhagen: 2026-03-29 02:00 → 03:00 local
    // Period covers Sun 2026-03-29 only.
    const periodStart = new Date("2026-03-28T23:00:00Z") // CET = 2026-03-29 00:00 local
    const periodEnd = new Date("2026-03-29T22:00:00Z") // CEST = 2026-03-30 00:00 local

    setMocks({
      staffRows: [
        {
          staff: staffRow(),
          // Sunday = weekday 6
          staff_availability: availabilityRow("s1", 6, "08:00:00", "16:00:00"),
        },
      ],
      groupRows: [{ groups: groupRow(), staffing_rules: null }],
      absences: [],
    })

    const result = await formatInput(periodStart, periodEnd, TZ)
    expect(result.availability).toEqual([
      {
        staffId: "s1",
        date: "2026-03-29",
        // After spring-forward, CPH is CEST (UTC+2)
        startUtc: "2026-03-29T06:00:00.000Z",
        endUtc: "2026-03-29T14:00:00.000Z",
      },
    ])
  })

  it("throws when planning_rules is missing", async () => {
    setMocks({
      staffRows: [],
      groupRows: [],
      absences: [],
      planningRules: null,
    })

    await expect(
      formatInput(
        new Date("2026-05-03T22:00:00Z"),
        new Date("2026-05-10T22:00:00Z"),
        TZ
      )
    ).rejects.toThrow(/planning_rules/)
  })

  it("throws when periodStart is not before periodEnd", async () => {
    await expect(
      formatInput(
        new Date("2026-05-10T22:00:00Z"),
        new Date("2026-05-03T22:00:00Z"),
        TZ
      )
    ).rejects.toThrow(/periodStart/)
  })

  it("collapses left-joined rows: multiple availability rows per staff", async () => {
    setMocks({
      staffRows: [
        {
          staff: staffRow(),
          staff_availability: availabilityRow("s1", 0, "08:00:00", "12:00:00"),
        },
        {
          staff: staffRow(),
          staff_availability: availabilityRow("s1", 1, "09:00:00", "13:00:00"),
        },
      ],
      groupRows: [{ groups: groupRow(), staffing_rules: null }],
      absences: [],
    })

    const result = await formatInput(
      new Date("2026-05-03T22:00:00Z"),
      new Date("2026-05-10T22:00:00Z"),
      TZ
    )

    expect(result.staff).toHaveLength(1)
    expect(result.availability.map((w) => w.date).sort()).toEqual([
      "2026-05-04",
      "2026-05-05",
    ])
  })

  it("collapses groups with multiple staffing rules", async () => {
    setMocks({
      staffRows: [],
      groupRows: [
        {
          groups: groupRow(),
          staffing_rules: staffingRuleRow({
            startTime: "06:30:00",
            endTime: "10:00:00",
          }),
        },
        {
          groups: groupRow(),
          staffing_rules: staffingRuleRow({
            startTime: "10:00:00",
            endTime: "17:00:00",
          }),
        },
      ],
      absences: [],
    })

    const result = await formatInput(
      new Date("2026-05-03T22:00:00Z"),
      new Date("2026-05-10T22:00:00Z"),
      TZ
    )

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].staffingRules).toHaveLength(2)
  })
})
