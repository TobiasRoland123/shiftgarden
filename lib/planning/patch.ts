import { isValidDate, isoWeekKey, isoWeekStart } from "@/lib/planning/dates"
import type {
  EffectiveInputs,
  PlanningPeriod,
  PlanningShift,
  ProposalCheck,
  ProposalPatch,
  ShiftPatchOperation,
  ValidationIssue,
} from "@/lib/planning/contracts"
import { validateDatedSchedule } from "@/lib/planning/validate"

type PatchContext = {
  period: PlanningPeriod
  effectiveInputs: EffectiveInputs
  draft: PlanningShift[]
  currentDraftRevision: number
  currentInputFingerprint: string
}

const proposalFields = new Set([
  "id",
  "requestId",
  "periodId",
  "groupId",
  "baseDraftRevision",
  "inputFingerprint",
  "scope",
  "operations",
])
const shiftFields = new Set([
  "id",
  "groupId",
  "staffId",
  "date",
  "startTime",
  "endTime",
  "locked",
])
const updateFields = new Set([
  "groupId",
  "staffId",
  "date",
  "startTime",
  "endTime",
  "locked",
])

function scopeContains(scope: ProposalPatch["scope"], date: string): boolean {
  if (!scope || typeof scope !== "object" || !isValidDate(date)) return false
  if (scope.kind === "period") return true
  if (scope.kind === "day")
    return isValidDate(scope.date) && scope.date === date
  try {
    return (
      isoWeekKey(isoWeekStart(scope.week)) === scope.week &&
      isoWeekKey(date) === scope.week
    )
  } catch {
    return false
  }
}

function patchIssue(
  code: ValidationIssue["code"],
  message: string,
  details: Partial<ValidationIssue> = {}
): ValidationIssue {
  return { code, severity: "error", message, ...details }
}

function applyOperations(
  draft: PlanningShift[],
  operations: ShiftPatchOperation[],
  groupId: string
): PlanningShift[] {
  const result = draft.map((shift) => ({ ...shift }))
  for (const operation of operations) {
    switch (operation.type) {
      case "create":
        result.push({
          ...operation.shift,
          groupId: operation.shift.groupId ?? groupId,
        })
        break
      case "update": {
        const index = result.findIndex(
          (shift) => shift.id === operation.shiftId
        )
        if (index >= 0)
          result[index] = {
            ...result[index],
            ...operation.changes,
            id: result[index].id,
          }
        break
      }
      case "delete": {
        const index = result.findIndex(
          (shift) => shift.id === operation.shiftId
        )
        if (index >= 0) result.splice(index, 1)
        break
      }
    }
  }
  return result
}

function validScope(scope: unknown): scope is ProposalPatch["scope"] {
  if (!scope || typeof scope !== "object") return false
  const value = scope as Record<string, unknown>
  if (value.kind === "period")
    return Object.keys(value).every((key) => key === "kind")
  if (value.kind === "day")
    return (
      Object.keys(value).every((key) => key === "kind" || key === "date") &&
      typeof value.date === "string" &&
      isValidDate(value.date)
    )
  if (
    value.kind !== "week" ||
    !Object.keys(value).every((key) => key === "kind" || key === "week") ||
    typeof value.week !== "string"
  )
    return false
  try {
    return isoWeekKey(isoWeekStart(value.week)) === value.week
  } catch {
    return false
  }
}

function validateProposalPatch({
  proposal,
  context,
}: {
  proposal: ProposalPatch
  context: PatchContext
}): ProposalCheck {
  const issues: ValidationIssue[] = []
  if (!proposal || typeof proposal !== "object") {
    return {
      valid: false,
      issues: [
        patchIssue("malformed_patch", "Proposal patch must be an object."),
      ],
    }
  }
  if (Object.keys(proposal).some((key) => !proposalFields.has(key))) {
    issues.push(
      patchIssue(
        "malformed_patch",
        "Proposal patch contains unsupported fields."
      )
    )
  }
  if (
    typeof proposal.requestId !== "string" ||
    proposal.requestId.length === 0 ||
    typeof proposal.periodId !== "string" ||
    proposal.periodId.length === 0 ||
    typeof proposal.groupId !== "string" ||
    proposal.groupId.length === 0 ||
    !Number.isInteger(proposal.baseDraftRevision) ||
    proposal.baseDraftRevision < 0 ||
    typeof proposal.inputFingerprint !== "string" ||
    proposal.inputFingerprint.length === 0 ||
    !validScope(proposal.scope) ||
    !Array.isArray(proposal.operations)
  ) {
    issues.push(
      patchIssue(
        "malformed_patch",
        "Proposal patch is missing valid base, scope, or operation fields."
      )
    )
  }
  if (
    proposal.periodId !== context.period.id ||
    proposal.groupId !== context.period.groupId
  ) {
    issues.push(
      patchIssue(
        "malformed_patch",
        "Proposal targets a different planning period or group."
      )
    )
  }
  if (
    proposal.baseDraftRevision !== context.currentDraftRevision ||
    proposal.inputFingerprint !== context.currentInputFingerprint ||
    context.currentInputFingerprint !== context.effectiveInputs.fingerprint
  ) {
    issues.push(
      patchIssue(
        "stale_proposal",
        "Proposal is stale because the draft revision or effective inputs changed."
      )
    )
  }

  const ids = new Set(context.draft.map((shift) => shift.id))
  const touched = new Set<string>()
  for (const rawOperation of Array.isArray(proposal.operations)
    ? (proposal.operations as unknown[])
    : []) {
    if (!rawOperation || typeof rawOperation !== "object") {
      issues.push(
        patchIssue("malformed_patch", "Patch contains a malformed operation.")
      )
      continue
    }
    const operation = rawOperation as Record<string, unknown>
    if (
      operation.type !== "create" &&
      operation.type !== "update" &&
      operation.type !== "delete"
    ) {
      issues.push(
        patchIssue(
          "malformed_patch",
          "Patch contains an unsupported operation type."
        )
      )
      continue
    }
    if (operation.type === "create") {
      if (
        Object.keys(operation).some((key) => key !== "type" && key !== "shift")
      ) {
        issues.push(
          patchIssue(
            "malformed_patch",
            "Create operation contains unsupported fields."
          )
        )
        continue
      }
      if (
        !operation.shift ||
        typeof operation.shift !== "object" ||
        Array.isArray(operation.shift)
      ) {
        issues.push(
          patchIssue(
            "malformed_patch",
            "Create operation contains an invalid shift."
          )
        )
        continue
      }
      const shift = operation.shift as unknown as PlanningShift
      if (
        Object.keys(shift).some((key) => !shiftFields.has(key)) ||
        typeof shift.id !== "string" ||
        shift.id.length === 0 ||
        typeof shift.staffId !== "string" ||
        shift.staffId.length === 0 ||
        typeof shift.date !== "string" ||
        typeof shift.startTime !== "string" ||
        typeof shift.endTime !== "string" ||
        shift.locked !== false
      ) {
        issues.push(
          patchIssue(
            "malformed_patch",
            "Create operation contains an invalid shift."
          )
        )
        continue
      }
      if (
        shift.groupId !== undefined &&
        shift.groupId !== context.period.groupId
      ) {
        issues.push(
          patchIssue(
            "group_id_mismatch",
            "Created shift belongs to another group.",
            { shiftId: shift.id, date: shift.date }
          )
        )
      }
      if (ids.has(shift.id) || touched.has(shift.id)) {
        issues.push(
          patchIssue(
            "malformed_patch",
            `Shift ID ${shift.id} is not a new stable ID.`,
            { shiftId: shift.id }
          )
        )
      }
      touched.add(shift.id)
      if (!scopeContains(proposal.scope, shift.date)) {
        issues.push(
          patchIssue(
            "out_of_scope",
            "Create operation is outside the declared calendar scope.",
            { shiftId: shift.id, date: shift.date }
          )
        )
      }
      continue
    }

    const expectedFields =
      operation.type === "update"
        ? new Set(["type", "shiftId", "changes"])
        : new Set(["type", "shiftId"])
    if (
      Object.keys(operation).some((key) => !expectedFields.has(key)) ||
      typeof operation.shiftId !== "string" ||
      operation.shiftId.length === 0
    ) {
      issues.push(
        patchIssue(
          "malformed_patch",
          "Patch operation has invalid or unsupported fields."
        )
      )
      continue
    }
    const shiftId = operation.shiftId
    if (touched.has(shiftId))
      issues.push(
        patchIssue(
          "malformed_patch",
          `Shift ${shiftId} is targeted more than once.`
        )
      )
    touched.add(shiftId)
    const existing = context.draft.find((shift) => shift.id === shiftId)
    if (!existing) {
      issues.push(
        patchIssue(
          "missing_shift",
          `Shift ${shiftId} does not exist in the draft.`,
          { shiftId }
        )
      )
      continue
    }
    if (!scopeContains(proposal.scope, existing.date)) {
      issues.push(
        patchIssue(
          "out_of_scope",
          "Operation targets a shift outside the declared calendar scope.",
          { shiftId, date: existing.date }
        )
      )
    }
    if (existing.locked) {
      issues.push(
        patchIssue(
          "locked_shift",
          "Locked shifts cannot be changed by a proposal.",
          { shiftId, date: existing.date }
        )
      )
    }
    if (operation.type === "delete") continue

    if (
      !operation.changes ||
      typeof operation.changes !== "object" ||
      Array.isArray(operation.changes)
    ) {
      issues.push(
        patchIssue("malformed_patch", "Update operation is missing changes.", {
          shiftId,
        })
      )
      continue
    }
    const changes = operation.changes as Partial<PlanningShift> &
      Record<string, unknown>
    if (
      Object.keys(changes).length === 0 ||
      Object.keys(changes).some((key) => !updateFields.has(key))
    ) {
      issues.push(
        patchIssue(
          "malformed_patch",
          "Update operation contains unsupported or empty shift changes.",
          { shiftId }
        )
      )
      continue
    }
    for (const key of ["staffId", "date", "startTime", "endTime"] as const) {
      if (
        changes[key] !== undefined &&
        (typeof changes[key] !== "string" || changes[key]!.length === 0)
      ) {
        issues.push(
          patchIssue(
            "malformed_patch",
            `Update operation contains an invalid ${key}.`,
            { shiftId }
          )
        )
      }
    }
    if (
      changes.groupId !== undefined &&
      changes.groupId !== context.period.groupId
    ) {
      issues.push(
        patchIssue(
          "group_id_mismatch",
          "Updated shift belongs to another group.",
          { shiftId }
        )
      )
    }
    if (changes.locked !== undefined && changes.locked !== existing.locked) {
      issues.push(
        patchIssue("locked_shift", "AI proposals cannot change shift locks.", {
          shiftId,
          date: existing.date,
        })
      )
    }
    const resultingDate =
      typeof changes.date === "string" ? changes.date : existing.date
    if (!scopeContains(proposal.scope, resultingDate)) {
      issues.push(
        patchIssue(
          "out_of_scope",
          "Updated shift would move outside the declared calendar scope.",
          { shiftId, date: resultingDate }
        )
      )
    }
  }

  if (issues.length > 0) return { valid: false, issues }
  const candidate = applyOperations(
    context.draft,
    proposal.operations,
    context.period.groupId
  )
  const validation = validateDatedSchedule({
    period: context.period,
    effectiveInputs: context.effectiveInputs,
    shifts: candidate,
  })
  return { ...validation, candidate }
}

function applyProposalPatch(
  context: PatchContext & { proposal: ProposalPatch }
): ProposalCheck {
  return validateProposalPatch({ proposal: context.proposal, context })
}

export {
  applyOperations,
  applyProposalPatch,
  scopeContains,
  validateProposalPatch,
}
export type { PatchContext }
