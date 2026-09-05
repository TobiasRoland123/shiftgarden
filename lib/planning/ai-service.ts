import {
  assertReviewedPlanningInputs,
  loadCurrentPlanningContext,
} from "./context"
export { loadCurrentPlanningContext } from "./context"
import { and, eq } from "drizzle-orm"
import {
  planningDrafts,
  planningDraftShifts,
  planningGenerationRequests,
  planningPeriods,
  planningProposals,
  planningProposalOperations,
} from "@/lib/db/schema"
import { withPlanningCoordination } from "./source-coordination"
import { PlanningConflictError, recordGenerationAttempt } from "./repository"
import { flattenSchedule, validateDatedSchedule } from "./validate"
import { validateProposalPatch } from "./patch"
import { generateValidated } from "./generate"
import {
  generateDatedSchedule,
  generateScheduleProposal,
  planningModel,
  type GeneratedDatedSchedule,
} from "./ai-model"
import type {
  CalendarScope,
  DatedSchedule,
  ProposalPatch,
  ShiftPatchOperation,
} from "./contracts"

function withStableIds(output: GeneratedDatedSchedule): DatedSchedule {
  return {
    ...output,
    days: output.days.map((day) => ({
      ...day,
      shifts: day.shifts.map((shift) => ({
        ...shift,
        id: crypto.randomUUID(),
        locked: false,
      })),
    })),
  }
}

export async function generatePeriod(input: {
  periodId: string
  expectedRevision: number
  requestId: string
}) {
  const start = await withPlanningCoordination(async (tx) => {
    const [existing] = await tx
      .select()
      .from(planningGenerationRequests)
      .where(eq(planningGenerationRequests.requestId, input.requestId))
    if (existing) {
      if (existing.periodId !== input.periodId)
        throw new PlanningConflictError(
          "request_mismatch",
          "This request belongs to another period."
        )
      if (existing.status === "accepted") return { existing: true as const }
      throw new PlanningConflictError(
        existing.status,
        existing.error ??
          "This generation request is already running. Refresh to check its outcome."
      )
    }
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    assertReviewedPlanningInputs(context)
    if (context.draft.revision !== input.expectedRevision)
      throw new PlanningConflictError(
        "stale_revision",
        "The draft changed. Refresh before generating."
      )
    if (
      !["preparation", "failed", "generating"].includes(context.draft.state) ||
      context.shifts.length > 0
    )
      throw new PlanningConflictError(
        "already_generated",
        "Use the calendar to edit this draft."
      )
    if (context.inputs.issues.some((issue) => issue.severity === "error"))
      throw new PlanningConflictError(
        "input_conflict",
        "Resolve the input conflicts before generating.",
        { issues: context.inputs.issues }
      )
    // A timed-out request can be retried with a new identity. Completing the old
    // request is still forbidden once the replacement increments the revision.
    if (
      context.draft.state === "generating" &&
      Date.now() - context.draft.updatedAt.getTime() < 300_000
    )
      throw new PlanningConflictError(
        "generation_running",
        "Generation is still running. Refresh to check its outcome."
      )
    await tx
      .update(planningGenerationRequests)
      .set({
        status: "interrupted",
        error: "The request was interrupted. Retry from saved preparation.",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(planningGenerationRequests.draftId, context.draft.id),
          eq(planningGenerationRequests.status, "running")
        )
      )
    const revision = context.draft.revision + 1
    await tx.insert(planningGenerationRequests).values({
      requestId: input.requestId,
      periodId: input.periodId,
      draftId: context.draft.id,
      expectedDraftRevision: revision,
      inputFingerprint: context.inputs.fingerprint,
      scope: { kind: "period" },
      model: planningModel,
      status: "running",
    })
    await tx
      .update(planningDrafts)
      .set({
        state: "generating",
        revision,
        inputSnapshot: context.inputs,
        inputFingerprint: context.inputs.fingerprint,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(planningDrafts.id, context.draft.id))
    return { existing: false as const, ...context, revision }
  })
  if (start.existing) return
  try {
    const result = await generateValidated({
      prompt: `Dated effective inputs:\n${JSON.stringify(start.inputs)}`,
      generate: async (prompt) =>
        withStableIds(await generateDatedSchedule(prompt)),
      validate: (schedule) =>
        validateDatedSchedule({
          period: start.period,
          effectiveInputs: start.inputs,
          shifts: schedule,
        }),
      recordAttempt: async ({ attemptNumber, candidate, validation }) => {
        await recordGenerationAttempt({
          requestId: input.requestId,
          attemptNumber,
          model: planningModel,
          inputSnapshot: start.inputs,
          outputSnapshot: candidate,
          validationSnapshot: validation,
          status: validation.valid ? "accepted" : "validation_failed",
        })
      },
    })
    if (!result.validation.valid)
      throw new PlanningConflictError(
        "generation_invalid",
        "The generated schedule still has rule errors after one correction. Saved preparation is available for retry.",
        { issues: result.validation.issues }
      )
    await withPlanningCoordination(async (tx) => {
      const current = await loadCurrentPlanningContext(input.periodId, tx)
      if (
        current.draft.id !== start.draft.id ||
        current.draft.revision !== start.revision ||
        current.inputs.fingerprint !== start.inputs.fingerprint
      )
        throw new PlanningConflictError(
          "stale_generation",
          "Inputs or draft changed while generating. Review current inputs and retry."
        )
      const validation = validateDatedSchedule({
        period: current.period,
        effectiveInputs: current.inputs,
        shifts: result.candidate,
      })
      if (!validation.valid)
        throw new PlanningConflictError(
          "generation_invalid",
          "The full period no longer passes validation.",
          { issues: validation.issues }
        )
      const { shifts } = flattenSchedule(
        result.candidate,
        current.period.groupId
      )
      if (shifts.length)
        await tx.insert(planningDraftShifts).values(
          shifts.map((shift) => ({
            id: shift.id,
            draftId: current.draft.id,
            staffMemberId: shift.staffId,
            actualDate: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            locked: false,
          }))
        )
      await tx
        .update(planningDrafts)
        .set({
          state: "editing",
          revision: current.draft.revision + 1,
          lastValidation: validation,
          inputSnapshot: current.inputs,
          inputFingerprint: current.inputs.fingerprint,
          aiNotes: result.candidate.warnings ?? [],
          updatedAt: new Date(),
        })
        .where(eq(planningDrafts.id, current.draft.id))
      await tx
        .update(planningPeriods)
        .set({ lifecycle: "editing", updatedAt: new Date() })
        .where(eq(planningPeriods.id, input.periodId))
      await tx
        .update(planningGenerationRequests)
        .set({
          status: "accepted",
          outcomeDraftRevision: current.draft.revision + 1,
          outcomeJson: { periodId: input.periodId },
          completedAt: new Date(),
        })
        .where(eq(planningGenerationRequests.requestId, input.requestId))
    })
  } catch (error) {
    await withPlanningCoordination(async (tx) => {
      const message =
        error instanceof PlanningConflictError
          ? error.message
          : "Generation failed. Saved preparation is available; retry the request."
      await tx
        .update(planningGenerationRequests)
        .set({ status: "failed", error: message, completedAt: new Date() })
        .where(
          and(
            eq(planningGenerationRequests.requestId, input.requestId),
            eq(planningGenerationRequests.status, "running")
          )
        )
      await tx
        .update(planningDrafts)
        .set({
          state: "failed",
          lastError: message,
          lastValidation:
            error instanceof PlanningConflictError && error.details?.issues
              ? { valid: false, issues: error.details.issues }
              : undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(planningDrafts.id, start.draft.id),
            eq(planningDrafts.revision, start.revision),
            eq(planningDrafts.state, "generating")
          )
        )
    }).catch(() => {
      /* The persisted running request becomes recoverable after its lease expires. */
    })
    throw error
  }
}

export async function requestPlanningProposal(input: {
  periodId: string
  expectedRevision: number
  requestId: string
  scope: CalendarScope
  prompt: string
}) {
  const start = await withPlanningCoordination(async (tx) => {
    const [existing] = await tx
      .select()
      .from(planningProposals)
      .where(eq(planningProposals.requestId, input.requestId))
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    if (existing) {
      if (existing.draftId !== context.draft.id)
        throw new PlanningConflictError(
          "request_mismatch",
          "Proposal request belongs to another draft."
        )
      return { ...context, existing }
    }
    assertReviewedPlanningInputs(context)
    if (
      context.draft.revision !== input.expectedRevision ||
      context.draft.state !== "editing"
    )
      throw new PlanningConflictError(
        "stale_revision",
        "Open the current editable draft before asking AI."
      )
    if (context.inputs.issues.some((issue) => issue.severity === "error"))
      throw new PlanningConflictError(
        "input_conflict",
        "Resolve source conflicts before asking AI.",
        { issues: context.inputs.issues }
      )
    return { ...context, existing: undefined }
  })
  if (start.existing) return start.existing.id
  const output = await generateScheduleProposal(
    JSON.stringify({
      request: input.prompt,
      scope: input.scope,
      inputs: start.inputs,
      draft: start.shifts,
    })
  )
  const operations: ShiftPatchOperation[] = output.operations.map(
    (operation) => {
      if (operation.type === "delete") return operation
      const values = {
        staffId: operation.staffId,
        date: operation.date,
        startTime: operation.startTime,
        endTime: operation.endTime,
      }
      return operation.type === "create"
        ? {
            type: "create",
            shift: { ...values, id: crypto.randomUUID(), locked: false },
          }
        : { type: "update", shiftId: operation.shiftId, changes: values }
    }
  )
  const patch: ProposalPatch = {
    requestId: input.requestId,
    periodId: input.periodId,
    groupId: start.period.groupId,
    baseDraftRevision: start.draft.revision,
    inputFingerprint: start.inputs.fingerprint,
    scope: input.scope,
    operations,
  }
  return withPlanningCoordination(async (tx) => {
    const current = await loadCurrentPlanningContext(input.periodId, tx)
    const [existing] = await tx
      .select()
      .from(planningProposals)
      .where(eq(planningProposals.requestId, input.requestId))
    if (existing) {
      if (existing.draftId !== current.draft.id)
        throw new PlanningConflictError(
          "request_mismatch",
          "This request belongs to another draft."
        )
      return existing.id
    }
    if (
      current.draft.id !== start.draft.id ||
      current.draft.revision !== start.draft.revision ||
      current.inputs.fingerprint !== start.inputs.fingerprint
    )
      throw new PlanningConflictError(
        "stale_proposal",
        "The draft or its inputs changed while AI was working. Request a new proposal."
      )
    const checked = validateProposalPatch({
      proposal: patch,
      context: {
        period: current.period,
        effectiveInputs: current.inputs,
        draft: current.shifts,
        currentDraftRevision: current.draft.revision,
        currentInputFingerprint: current.inputs.fingerprint,
      },
    })
    // Candidate scheduling errors can be inspected, but structural/stale patches
    // have no candidate and must never reach the review workspace.
    if (!checked.candidate)
      throw new PlanningConflictError(
        "invalid_proposal",
        "The proposal is stale or violates its scope, references, or locks. Request a new proposal.",
        { issues: checked.issues }
      )
    await tx
      .update(planningProposals)
      .set({ state: "superseded" })
      .where(
        and(
          eq(planningProposals.draftId, current.draft.id),
          eq(planningProposals.state, "pending")
        )
      )
    const [proposal] = await tx
      .insert(planningProposals)
      .values({
        requestId: input.requestId,
        draftId: current.draft.id,
        draftRevision: current.draft.revision,
        inputFingerprint: current.inputs.fingerprint,
        scope: input.scope,
        requestText: input.prompt,
        beforeValidation: validateDatedSchedule({
          period: current.period,
          effectiveInputs: current.inputs,
          shifts: current.shifts,
        }),
        afterValidation: checked,
        notes: output.notes,
      })
      .returning()
    if (operations.length)
      await tx.insert(planningProposalOperations).values(
        operations.map((operation, index) => {
          const before =
            operation.type === "create"
              ? undefined
              : current.shifts.find((shift) => shift.id === operation.shiftId)
          const after =
            operation.type === "delete"
              ? undefined
              : checked.candidate!.find(
                  (shift) =>
                    shift.id ===
                    (operation.type === "create"
                      ? operation.shift.id
                      : operation.shiftId)
                )
          return {
            proposalId: proposal.id,
            operationIndex: index,
            operation: operation.type,
            targetShiftId:
              operation.type === "create"
                ? operation.shift.id
                : operation.shiftId,
            actualDate: after?.date ?? before?.date,
            staffMemberId: after?.staffId ?? before?.staffId,
            startTime: after?.startTime ?? before?.startTime,
            endTime: after?.endTime ?? before?.endTime,
            beforeSnapshot: before,
            afterSnapshot: after,
          }
        })
      )
    return proposal.id
  })
}

export async function discardPlanningProposal(
  periodId: string,
  proposalId: string,
  expectedRevision: number
) {
  return withPlanningCoordination(async (tx) => {
    const context = await loadCurrentPlanningContext(periodId, tx)
    if (context.draft.revision !== expectedRevision)
      throw new PlanningConflictError(
        "stale_revision",
        "Refresh the draft before discarding the proposal."
      )
    const [proposal] = await tx
      .update(planningProposals)
      .set({ state: "discarded" })
      .where(
        and(
          eq(planningProposals.id, proposalId),
          eq(planningProposals.draftId, context.draft.id),
          eq(planningProposals.state, "pending")
        )
      )
      .returning()
    if (!proposal)
      throw new PlanningConflictError(
        "proposal_missing",
        "This proposal is no longer pending."
      )
    return proposal
  })
}

export async function refinePlanningProposal(input: {
  periodId: string
  proposalId: string
  expectedRevision: number
  requestId: string
  prompt: string
}) {
  const start = await withPlanningCoordination(async (tx) => {
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    const [existing] = await tx
      .select()
      .from(planningProposals)
      .where(eq(planningProposals.requestId, input.requestId))
    if (existing) {
      if (existing.draftId !== context.draft.id)
        throw new PlanningConflictError(
          "request_mismatch",
          "This request belongs to another draft."
        )
      return { existingId: existing.id, scope: existing.scope as CalendarScope }
    }
    if (context.draft.revision !== input.expectedRevision)
      throw new PlanningConflictError(
        "stale_revision",
        "Refresh the draft before refining the proposal."
      )
    const [proposal] = await tx
      .select()
      .from(planningProposals)
      .where(
        and(
          eq(planningProposals.id, input.proposalId),
          eq(planningProposals.draftId, context.draft.id),
          eq(planningProposals.state, "pending")
        )
      )
    if (!proposal)
      throw new PlanningConflictError(
        "proposal_missing",
        "This proposal is no longer pending."
      )
    return { existingId: undefined, scope: proposal.scope as CalendarScope }
  })
  // Successful replacement persistence supersedes the original atomically.
  // A provider or validation failure leaves the current preview available.
  return (
    start.existingId ??
    requestPlanningProposal({ ...input, scope: start.scope })
  )
}
