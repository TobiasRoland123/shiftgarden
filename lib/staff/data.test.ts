import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const orderBy = vi.fn().mockResolvedValue([])
  const from = vi.fn(() => ({ orderBy }))
  const select = vi.fn(() => ({ from }))
  const asc = vi.fn((column: unknown) => ({ column }))

  return { asc, from, orderBy, select }
})

vi.mock("drizzle-orm", () => ({ asc: mocks.asc }))
vi.mock("@/lib/db", () => ({ db: { select: mocks.select } }))

import { staffMembers } from "@/lib/db/schema"

import { getStaffMembers } from "./data"

describe("getStaffMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("selects all staff ordered by last name, then first name", async () => {
    await getStaffMembers()

    expect(mocks.select).toHaveBeenCalledWith()
    expect(mocks.from).toHaveBeenCalledWith(staffMembers)
    expect(mocks.asc).toHaveBeenNthCalledWith(1, staffMembers.lastName)
    expect(mocks.asc).toHaveBeenNthCalledWith(2, staffMembers.firstName)
    expect(mocks.orderBy).toHaveBeenCalledWith(
      { column: staffMembers.lastName },
      { column: staffMembers.firstName }
    )
  })
})
