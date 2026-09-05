import { describe, expect, it } from "vitest"
import { composeEffectiveInputs } from "./effective-inputs"
import { fixturePeriod, fixtureRecurring } from "./domain.fixture"
import type { PlanningShift, ProposalPatch } from "./contracts"
import { applyProposalPatch } from "./patch"

const existing: PlanningShift = {
  id: "shift-1",
  groupId: "group-1",
  staffId: "staff-p",
  date: "2026-09-07",
  startTime: "09:00",
  endTime: "12:00",
  locked: true,
}

function proposal(
  inputs: ReturnType<typeof composeEffectiveInputs>,
  operations: ProposalPatch["operations"],
  scope: ProposalPatch["scope"] = { kind: "day", date: "2026-09-07" }
): ProposalPatch {
  return {
    requestId: "request",
    periodId: fixturePeriod.id,
    groupId: fixturePeriod.groupId,
    baseDraftRevision: 1,
    inputFingerprint: inputs.fingerprint,
    scope,
    operations,
  }
}

describe("reviewed proposal patch checks", () => {
  it("rejects stale and locked patches without mutating the draft", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const proposal: ProposalPatch = {
      requestId: "request-1",
      periodId: fixturePeriod.id,
      groupId: fixturePeriod.groupId,
      baseDraftRevision: 1,
      inputFingerprint: inputs.fingerprint,
      scope: { kind: "day", date: existing.date },
      operations: [{ type: "delete", shiftId: existing.id }],
    }
    const result = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [existing],
      currentDraftRevision: 2,
      currentInputFingerprint: inputs.fingerprint,
      proposal,
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map((entry) => entry.code)).toContain("stale_proposal")
    expect(result.issues.map((entry) => entry.code)).toContain("locked_shift")
  })

  it("rejects an operation outside its declared day before candidate validation", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const proposal: ProposalPatch = {
      requestId: "request-2",
      periodId: fixturePeriod.id,
      groupId: fixturePeriod.groupId,
      baseDraftRevision: 1,
      inputFingerprint: inputs.fingerprint,
      scope: { kind: "day", date: "2026-09-07" },
      operations: [
        {
          type: "create",
          shift: {
            id: "shift-2",
            groupId: "group-1",
            staffId: "staff-p",
            date: "2026-09-08",
            startTime: "09:00",
            endTime: "12:00",
            locked: false,
          },
        },
      ],
    }
    const result = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [],
      currentDraftRevision: 1,
      currentInputFingerprint: inputs.fingerprint,
      proposal,
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map((entry) => entry.code)).toContain("out_of_scope")
    expect(result.candidate).toBeUndefined()
  })

  it("rejects an unknown operation type instead of treating it as a deletion", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const unlocked = { ...existing, locked: false }
    const malformed = proposal(inputs, [
      { type: "rename", shiftId: existing.id } as never,
    ])
    const result = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [unlocked],
      currentDraftRevision: 1,
      currentInputFingerprint: inputs.fingerprint,
      proposal: malformed,
    })
    expect(result.issues.map((entry) => entry.code)).toContain(
      "malformed_patch"
    )
    expect(result.candidate).toBeUndefined()
  })

  it("rejects lock changes and locked creates", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const unlocked = { ...existing, locked: false }
    const lockUpdate = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [unlocked],
      currentDraftRevision: 1,
      currentInputFingerprint: inputs.fingerprint,
      proposal: proposal(inputs, [
        { type: "update", shiftId: existing.id, changes: { locked: true } },
      ]),
    })
    const lockedCreate = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [],
      currentDraftRevision: 1,
      currentInputFingerprint: inputs.fingerprint,
      proposal: proposal(inputs, [
        { type: "create", shift: { ...unlocked, id: "new", locked: true } },
      ]),
    })
    expect(lockUpdate.issues.map((entry) => entry.code)).toContain(
      "locked_shift"
    )
    expect(lockedCreate.issues.map((entry) => entry.code)).toContain(
      "malformed_patch"
    )
    expect(lockUpdate.candidate).toBeUndefined()
    expect(lockedCreate.candidate).toBeUndefined()
  })

  it("accepts unchanged persisted lock and group snapshot fields", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const unlocked = { ...existing, locked: false }
    const result = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [unlocked],
      currentDraftRevision: 1,
      currentInputFingerprint: inputs.fingerprint,
      proposal: proposal(inputs, [
        {
          type: "update",
          shiftId: existing.id,
          changes: { groupId: "group-1", locked: false, startTime: "08:30" },
        },
      ]),
    })
    expect(
      result.candidate?.find((shift) => shift.id === existing.id)?.startTime
    ).toBe("08:30")
    expect(
      result.issues.some(
        (entry) =>
          entry.code === "malformed_patch" || entry.code === "locked_shift"
      )
    ).toBe(false)
  })

  it("rejects extra operation fields and invalid week scopes without throwing", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const unlocked = { ...existing, locked: false }
    const extraField = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [unlocked],
      currentDraftRevision: 1,
      currentInputFingerprint: inputs.fingerprint,
      proposal: proposal(inputs, [
        { type: "delete", shiftId: existing.id, reason: "surprise" } as never,
      ]),
    })
    const invalidWeek = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [unlocked],
      currentDraftRevision: 1,
      currentInputFingerprint: inputs.fingerprint,
      proposal: proposal(inputs, [{ type: "delete", shiftId: existing.id }], {
        kind: "week",
        week: "2021-W53",
      }),
    })
    expect(extraField.issues.map((entry) => entry.code)).toContain(
      "malformed_patch"
    )
    expect(invalidWeek.issues.map((entry) => entry.code)).toContain(
      "malformed_patch"
    )
  })

  it("rejects repeated operations on one stable shift", () => {
    const inputs = composeEffectiveInputs({
      period: fixturePeriod,
      recurring: fixtureRecurring,
    })
    const unlocked = { ...existing, locked: false }
    const result = applyProposalPatch({
      period: fixturePeriod,
      effectiveInputs: inputs,
      draft: [unlocked],
      currentDraftRevision: 1,
      currentInputFingerprint: inputs.fingerprint,
      proposal: proposal(inputs, [
        {
          type: "update",
          shiftId: existing.id,
          changes: { startTime: "08:30" },
        },
        { type: "delete", shiftId: existing.id },
      ]),
    })
    expect(result.issues.map((entry) => entry.code)).toContain(
      "malformed_patch"
    )
    expect(result.candidate).toBeUndefined()
  })
})
