import { describe, expect, it } from "vitest"
import { planningCommandSchema } from "./action-schema"

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
describe("planning mutation boundary", () => {
  it("rejects publication without the reviewed input and official base", () => {
    const command = {
      type: "publish",
      periodId: id,
      requestId: id,
      expectedRevision: 2,
    }
    expect(planningCommandSchema.safeParse(command).success).toBe(false)
    expect(
      planningCommandSchema.safeParse({
        ...command,
        reviewedFingerprint: "current",
        expectedBaseVersionId: null,
      }).success
    ).toBe(true)
  })
  it("rejects overnight edits and missing planner history identity", () => {
    const command = {
      type: "saveShift",
      periodId: id,
      expectedRevision: 1,
      actorId: id,
      shift: {
        id,
        staffId: id,
        date: "2026-09-05",
        startTime: "22:00",
        endTime: "07:00",
        locked: false,
      },
    }
    expect(planningCommandSchema.safeParse(command).success).toBe(false)
    expect(
      planningCommandSchema.safeParse({
        ...command,
        actorId: undefined,
        shift: { ...command.shift, endTime: "23:00" },
      }).success
    ).toBe(false)
  })
  it("rejects nonexistent dates and ISO weeks before model invocation", () => {
    const command = {
      type: "requestAi",
      periodId: id,
      requestId: id,
      expectedRevision: 1,
      prompt: "Cover the gap",
    }
    expect(
      planningCommandSchema.safeParse({
        ...command,
        scope: { kind: "day", date: "2026-02-30" },
      }).success
    ).toBe(false)
    expect(
      planningCommandSchema.safeParse({
        ...command,
        scope: { kind: "week", week: "2025-W53" },
      }).success
    ).toBe(false)
    expect(
      planningCommandSchema.safeParse({
        ...command,
        scope: { kind: "week", week: "2026-W53" },
      }).success
    ).toBe(true)
  })
})
