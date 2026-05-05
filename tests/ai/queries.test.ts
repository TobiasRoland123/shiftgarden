import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {},
  schema: {},
}))

import {
  getAbsencesInPeriod,
  getActiveStaffWithAvailability,
  getGroupsWithStaffingRules,
  getPlanningRules,
} from "@/lib/ai/queries"
import {
  absences,
  groups,
  planningRules,
  staff,
  staffAvailability,
  staffingRules,
} from "@/drizzle/schema"
import type { db as realDb } from "@/lib/db"

type Calls = {
  from: unknown[]
  leftJoin: unknown[][]
  where: unknown[]
  limit: number[]
}

type Builder = {
  from: (table: unknown) => Builder
  leftJoin: (table: unknown, on: unknown) => Builder
  where: (predicate: unknown) => Builder
  limit: (n: number) => Builder
  then: <T, U = never>(
    onFulfilled: (v: unknown) => T | PromiseLike<T>,
    onRejected?: (e: unknown) => U | PromiseLike<U>
  ) => Promise<T | U>
}

function createDbMock(result: unknown) {
  const calls: Calls = { from: [], leftJoin: [], where: [], limit: [] }

  const builder: Builder = {
    from(table) {
      calls.from.push(table)
      return builder
    },
    leftJoin(table, on) {
      calls.leftJoin.push([table, on])
      return builder
    },
    where(predicate) {
      calls.where.push(predicate)
      return builder
    },
    limit(n) {
      calls.limit.push(n)
      return builder
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected)
    },
  }

  const select = vi.fn(() => builder)
  const database = { select } as unknown as typeof realDb

  return { database, select, calls }
}

describe("getActiveStaffWithAvailability", () => {
  it("selects from staff, left joins availability, filters active = true", async () => {
    const rows = [
      { staff: { id: "s1", active: true }, staff_availability: null },
    ]
    const { database, select, calls } = createDbMock(rows)

    const result = await getActiveStaffWithAvailability(database)

    expect(select).toHaveBeenCalledOnce()
    expect(calls.from).toEqual([staff])
    expect(calls.leftJoin).toHaveLength(1)
    expect(calls.leftJoin[0][0]).toBe(staffAvailability)
    expect(calls.where).toHaveLength(1)
    expect(result).toEqual(rows)
  })
})

describe("getGroupsWithStaffingRules", () => {
  it("selects from groups, left joins staffing rules, no where clause", async () => {
    const rows = [{ groups: { id: "g1" }, staffing_rules: null }]
    const { database, calls } = createDbMock(rows)

    const result = await getGroupsWithStaffingRules(database)

    expect(calls.from).toEqual([groups])
    expect(calls.leftJoin).toHaveLength(1)
    expect(calls.leftJoin[0][0]).toBe(staffingRules)
    expect(calls.where).toHaveLength(0)
    expect(result).toEqual(rows)
  })
})

describe("getAbsencesInPeriod", () => {
  it("queries absences with an overlap predicate", async () => {
    const rows = [{ id: "a1" }]
    const { database, calls } = createDbMock(rows)

    const periodStart = new Date("2026-05-04T00:00:00Z")
    const periodEnd = new Date("2026-05-11T00:00:00Z")

    const result = await getAbsencesInPeriod(periodStart, periodEnd, database)

    expect(calls.from).toEqual([absences])
    expect(calls.where).toHaveLength(1)
    expect(result).toEqual(rows)
  })

  it("returns rows whose absence range overlaps the period (filtered by mock predicate)", async () => {
    const periodStart = new Date("2026-05-04T00:00:00Z")
    const periodEnd = new Date("2026-05-11T00:00:00Z")

    const fixtures = [
      {
        id: "inside",
        startsAt: new Date("2026-05-05T00:00:00Z"),
        endsAt: new Date("2026-05-06T00:00:00Z"),
      },
      {
        id: "ends-at-start",
        startsAt: new Date("2026-05-01T00:00:00Z"),
        endsAt: periodStart,
      },
      {
        id: "starts-at-end",
        startsAt: periodEnd,
        endsAt: new Date("2026-05-20T00:00:00Z"),
      },
    ]

    const overlapping = fixtures.filter(
      (a) => a.startsAt < periodEnd && a.endsAt > periodStart
    )
    const { database } = createDbMock(overlapping)

    const result = (await getAbsencesInPeriod(
      periodStart,
      periodEnd,
      database
    )) as typeof fixtures

    expect(result.map((r) => r.id)).toEqual(["inside"])
  })
})

describe("getPlanningRules", () => {
  it("returns the first row when present", async () => {
    const row = {
      id: "pr1",
      minPedagogueRatio: 0.5,
      minStaffRatio: 0.1,
      breakMinutes: 30,
      breakThresholdHours: 5,
    }
    const { database, calls } = createDbMock([row])

    const result = await getPlanningRules(database)

    expect(calls.from).toEqual([planningRules])
    expect(calls.limit).toEqual([1])
    expect(result).toEqual(row)
  })

  it("returns null when no rows exist", async () => {
    const { database } = createDbMock([])

    const result = await getPlanningRules(database)

    expect(result).toBeNull()
  })
})
