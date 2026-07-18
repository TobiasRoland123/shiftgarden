import { describe, expect, it } from "vitest"

import {
  buildAvailableStaffOptions,
  getAvailabilityHoursMismatch,
  type StaffAvailabilityInterval,
  type StaffGroupRow,
} from "./staff"

function row(overrides: Partial<StaffGroupRow> = {}): StaffGroupRow {
  return {
    staffMemberId: "staff-1",
    firstName: "Jonas",
    lastName: "Petersen",
    groupId: null,
    groupName: null,
    ...overrides,
  }
}

describe("buildAvailableStaffOptions", () => {
  it("keeps staff members with no linked groups", () => {
    expect(buildAvailableStaffOptions([row()], new Set())).toEqual([
      { id: "staff-1", name: "Jonas Petersen", groups: [] },
    ])
  })

  it("includes a staff member's linked group", () => {
    expect(
      buildAvailableStaffOptions(
        [row({ groupId: "group-1", groupName: "Alfestuen" })],
        new Set()
      )
    ).toEqual([
      {
        id: "staff-1",
        name: "Jonas Petersen",
        groups: [{ id: "group-1", name: "Alfestuen" }],
      },
    ])
  })

  it("sorts multiple linked groups and removes staff already linked here", () => {
    const rows = [
      row({ groupId: "group-2", groupName: "Mumistuen" }),
      row({ groupId: "group-1", groupName: "Alfestuen" }),
      row({
        staffMemberId: "staff-2",
        firstName: "Ada",
        lastName: "Larsen",
        groupId: "group-3",
        groupName: "Solstuen",
      }),
    ]

    expect(buildAvailableStaffOptions(rows, new Set(["staff-2"]))).toEqual([
      {
        id: "staff-1",
        name: "Jonas Petersen",
        groups: [
          { id: "group-1", name: "Alfestuen" },
          { id: "group-2", name: "Mumistuen" },
        ],
      },
    ])
  })
})

describe("getAvailabilityHoursMismatch", () => {
  const availability: StaffAvailabilityInterval[] = [
    { startAvailabilityTime: "06:00", endAvailabilityTime: "17:00" },
    { startAvailabilityTime: "06:00", endAvailabilityTime: "17:00" },
    { startAvailabilityTime: "06:00", endAvailabilityTime: "17:00" },
    { startAvailabilityTime: "06:00", endAvailabilityTime: "14:00" },
    { startAvailabilityTime: "06:00", endAvailabilityTime: "17:00" },
  ]

  it("returns the available and maximum hours when they differ", () => {
    expect(getAvailabilityHoursMismatch(availability, 70)).toEqual({
      availableHours: 52,
      maxHours: 70,
    })
  })

  it("returns no mismatch when available hours equal maximum hours", () => {
    expect(getAvailabilityHoursMismatch(availability, 52)).toBeNull()
  })
})
