import { describe, expect, it } from "vitest"

import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import {
  scheduleInputFormat,
  serializeScheduleInput,
} from "@/lib/shift-schedule/serialize-input"

const representativeDays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const
const representativeFirstNames = [
  "Ada",
  "Grace",
  "Linus",
  "Margaret",
  "Edsger",
  "Barbara",
  "Donald",
  "Frances",
]
const representativeLastNames = [
  "Lovelace",
  "Hopper",
  "Torvalds",
  "Hamilton",
  "Dijkstra",
  "Liskov",
  "Knuth",
  "Allen",
]

type ColumnarTable = {
  columns: string[]
  rows: unknown[][]
}

function createRepresentativeInput(
  staffCount: number,
  dayCount: number
): ScheduleInput {
  const days = representativeDays.slice(0, dayCount)

  return {
    group: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Blue Room",
    },
    staff: Array.from({ length: staffCount }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      firstName: representativeFirstNames[index] ?? `Staff ${index + 1}`,
      lastName: representativeLastNames[index] ?? "Member",
      role:
        index % 3 === 0
          ? ("pedagog" as const)
          : index % 3 === 1
            ? ("assistant" as const)
            : ("substitute" as const),
      maxHoursPerWeek: 32 - index,
      active: true,
      availability: days.map((dayOfWeek) => ({
        dayOfWeek,
        startAvailabilityTime: "08:00",
        endAvailabilityTime: "16:00",
      })),
    })),
    rules: days.map((dayOfWeek) => ({
      dayOfWeek,
      startTime: "08:00",
      endTime: "16:00",
      minPedagogs: 1,
      minStaff: 2,
    })),
  }
}

function records({ columns, rows }: ColumnarTable) {
  return rows.map((row) =>
    Object.fromEntries(columns.map((key, i) => [key, row[i]]))
  )
}

function deserializeForTest(serialized: string): ScheduleInput {
  const parsed = JSON.parse(serialized) as {
    format: string
    group: ColumnarTable
    staff: ColumnarTable
    availability: ColumnarTable
    rules: ColumnarTable
  }
  const [group] = records(parsed.group)
  const availability = records(parsed.availability)

  expect(parsed.format).toBe(scheduleInputFormat)

  return {
    group: group as ScheduleInput["group"],
    staff: records(parsed.staff).map((staffMember) => ({
      ...(staffMember as Omit<ScheduleInput["staff"][number], "availability">),
      availability: availability
        .filter((entry) => entry.staffId === staffMember.id)
        .map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          startAvailabilityTime: entry.startTime,
          endAvailabilityTime: entry.endTime,
        })) as ScheduleInput["staff"][number]["availability"],
    })),
    rules: records(parsed.rules) as ScheduleInput["rules"],
  }
}

describe("serializeScheduleInput", () => {
  it("preserves schedule input semantics", () => {
    const input: ScheduleInput = {
      group: { id: "group-1", name: "Blue room" },
      staff: [
        {
          id: "staff-1",
          firstName: "Ada",
          lastName: "Lovelace",
          role: "pedagog",
          maxHoursPerWeek: 32,
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
        {
          id: "staff-2",
          firstName: "Grace",
          lastName: "Hopper",
          role: "assistant",
          maxHoursPerWeek: 30,
          active: false,
          availability: [],
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

    expect(deserializeForTest(serializeScheduleInput(input))).toEqual(input)
  })

  it("safely preserves special characters in strings", () => {
    const input: ScheduleInput = {
      group: { id: 'group,"\\\n-id', name: 'Rød, "Blue"\\Room\nNorth' },
      staff: [
        {
          id: "staff\t1",
          firstName: "Ada, Jane",
          lastName: 'O\'Connor "Test"',
          role: "substitute",
          maxHoursPerWeek: 8,
          active: true,
          availability: [],
        },
      ],
      rules: [],
    }

    expect(deserializeForTest(serializeScheduleInput(input))).toEqual(input)
  })

  it("represents empty staff, availability, and rule tables without ambiguity", () => {
    const input: ScheduleInput = {
      group: { id: "group-1", name: "Empty group" },
      staff: [],
      rules: [],
    }
    const serialized = serializeScheduleInput(input)
    const parsed = JSON.parse(serialized) as {
      staff: ColumnarTable
      availability: ColumnarTable
      rules: ColumnarTable
    }

    expect(parsed.staff.rows).toEqual([])
    expect(parsed.availability.rows).toEqual([])
    expect(parsed.rules.rows).toEqual([])
    expect(deserializeForTest(serialized)).toEqual(input)
  })

  it.each([
    {
      name: "small",
      input: createRepresentativeInput(2, 1),
      expectedPretty: 1004,
      expectedMinified: 666,
      expectedColumnar: 720,
    },
    {
      name: "typical",
      input: createRepresentativeInput(8, 5),
      expectedPretty: 8291,
      expectedMinified: 5263,
      expectedColumnar: 3885,
    },
  ])(
    "matches the documented $name fixture character costs",
    ({ input, expectedPretty, expectedMinified, expectedColumnar }) => {
      expect(JSON.stringify(input, null, 2)).toHaveLength(expectedPretty)
      expect(JSON.stringify(input)).toHaveLength(expectedMinified)
      expect(serializeScheduleInput(input)).toHaveLength(expectedColumnar)
    }
  )
})
