import { and, asc, desc, eq, gte, lte, ne } from "drizzle-orm"
import {
  planningDrafts,
  planningDraftShifts,
  planningPeriods,
  planningProposals,
  planningProposalOperations,
  planningPublishedVersions,
  planningPublishedVersionShifts,
  institutionSettings,
} from "@/lib/db/schema"
import {
  assertReviewedPlanningInputs,
  loadCurrentPlanningContext,
} from "./context"
import {
  getInstitutionSettings,
  touchPlanningSource,
  withPlanningCoordination,
  type PlanningExecutor,
} from "./source-coordination"
import {
  getDraftForPeriod,
  getPlanningPeriod,
  PlanningConflictError,
} from "./repository"
import { manualShiftSchema } from "./action-schema"
import { validateDatedSchedule } from "./validate"
import { validateProposalPatch } from "./patch"
import type {
  PlanningShift,
  ProposalPatch,
  CalendarScope,
  ShiftPatchOperation,
} from "./contracts"

type Context = Awaited<ReturnType<typeof loadCurrentPlanningContext>>
function assertRevision(context: Context, revision: number) {
  if (context.draft.revision !== revision)
    throw new PlanningConflictError(
      "stale_revision",
      "The draft changed in another session. Refresh to see the saved changes."
    )
}
function assertEditing(context: Context) {
  if (context.draft.state !== "editing")
    throw new PlanningConflictError(
      "draft_not_editable",
      "Generate a draft or open an official schedule for revision before editing shifts."
    )
}
function assertStructural(context: Context, shifts: PlanningShift[]) {
  const ids = new Set<string>()
  for (const shift of shifts) {
    manualShiftSchema.parse(shift)
    if (ids.has(shift.id))
      throw new PlanningConflictError(
        "duplicate_shift",
        "Each shift must have a unique identity."
      )
    ids.add(shift.id)
    if (shift.groupId && shift.groupId !== context.period.groupId)
      throw new PlanningConflictError(
        "wrong_group",
        "The shift belongs to another group."
      )
    if (
      shift.date < context.period.startDate ||
      shift.date > context.period.endDate
    )
      throw new PlanningConflictError(
        "out_of_period",
        "The shift is outside this period."
      )
    if (
      !context.inputs.staff.some((staff) => staff.id === shift.staffId) &&
      !context.shifts.some(
        (saved) => saved.id === shift.id && saved.staffId === shift.staffId
      )
    )
      throw new PlanningConflictError(
        "unknown_staff",
        "Choose staff linked to this group."
      )
  }
}
async function writeShifts(
  tx: PlanningExecutor,
  context: Context,
  shifts: PlanningShift[],
  actorId: string | null
) {
  assertStructural(context, shifts)
  const validation = validateDatedSchedule({
    period: context.period,
    effectiveInputs: context.inputs,
    shifts,
  })
  await tx
    .delete(planningDraftShifts)
    .where(eq(planningDraftShifts.draftId, context.draft.id))
  if (shifts.length)
    await tx.insert(planningDraftShifts).values(
      shifts.map((shift) => ({
        id: shift.id,
        draftId: context.draft.id,
        staffMemberId: shift.staffId,
        actualDate: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        locked: shift.locked,
      }))
    )
  await tx
    .update(planningDrafts)
    .set({
      revision: context.draft.revision + 1,
      lastValidation: validation,
      updatedAt: new Date(),
      undoSnapshot: actorId ? context.shifts : null,
      undoActorId: actorId,
      undoRevision: actorId ? context.draft.revision + 1 : null,
    })
    .where(eq(planningDrafts.id, context.draft.id))
  await tx
    .update(planningProposals)
    .set({ state: "superseded" })
    .where(
      and(
        eq(planningProposals.draftId, context.draft.id),
        eq(planningProposals.state, "pending")
      )
    )
  return { revision: context.draft.revision + 1, validation }
}
async function assertNoOverlap(
  tx: PlanningExecutor,
  groupId: string,
  startDate: string,
  endDate: string,
  exceptId?: string
) {
  if (startDate > endDate)
    throw new PlanningConflictError(
      "invalid_range",
      "The end date must be on or after the start date."
    )
  const [conflict] = await tx
    .select()
    .from(planningPeriods)
    .where(
      and(
        eq(planningPeriods.groupId, groupId),
        ne(planningPeriods.lifecycle, "abandoned"),
        ne(planningPeriods.lifecycle, "discarded"),
        lte(planningPeriods.startDate, endDate),
        gte(planningPeriods.endDate, startDate),
        exceptId ? ne(planningPeriods.id, exceptId) : undefined
      )
    )
    .limit(1)
  if (conflict)
    throw new PlanningConflictError(
      "period_overlap",
      `These dates overlap ${conflict.startDate} to ${conflict.endDate}. Open that period to continue.`,
      { periodId: conflict.id }
    )
}
export async function savePreparation(input: {
  groupId: string
  startDate: string
  endDate: string
}) {
  return withPlanningCoordination(async (tx) => {
    await assertNoOverlap(tx, input.groupId, input.startDate, input.endDate)
    const settings = await getInstitutionSettings(tx)
    const [period] = await tx
      .insert(planningPeriods)
      .values({ ...input, timezone: settings.timezone })
      .returning()
    await tx
      .insert(planningDrafts)
      .values({ periodId: period.id, state: "preparation" })
    const context = await loadCurrentPlanningContext(period.id, tx)
    await tx
      .update(planningDrafts)
      .set({
        inputSnapshot: context.inputs,
        inputFingerprint: context.inputs.fingerprint,
      })
      .where(eq(planningDrafts.id, context.draft.id))
    return period
  })
}
export async function updatePreparation(input: {
  periodId: string
  expectedRevision: number
  startDate: string
  endDate: string
}) {
  return withPlanningCoordination(async (tx) => {
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    assertRevision(context, input.expectedRevision)
    if (
      !["preparation", "failed"].includes(context.draft.state) ||
      context.shifts.length ||
      context.period.currentPublishedVersionId
    )
      throw new PlanningConflictError(
        "fixed_dates",
        "Generated periods have fixed dates. Create an adjacent period for additional dates."
      )
    await assertNoOverlap(
      tx,
      context.period.groupId,
      input.startDate,
      input.endDate,
      input.periodId
    )
    await tx
      .update(planningPeriods)
      .set({
        startDate: input.startDate,
        endDate: input.endDate,
        updatedAt: new Date(),
      })
      .where(eq(planningPeriods.id, input.periodId))
    const fresh = await loadCurrentPlanningContext(input.periodId, tx)
    await tx
      .update(planningDrafts)
      .set({
        state: "preparation",
        revision: context.draft.revision + 1,
        inputSnapshot: fresh.inputs,
        inputFingerprint: fresh.inputs.fingerprint,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(planningDrafts.id, context.draft.id))
  })
}
export async function mutateShifts(input: {
  periodId: string
  expectedRevision: number
  actorId: string
  mutate: (shifts: PlanningShift[]) => PlanningShift[]
}) {
  return withPlanningCoordination(async (tx) => {
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    assertRevision(context, input.expectedRevision)
    assertEditing(context)
    return writeShifts(
      tx,
      context,
      input.mutate(context.shifts.map((shift) => ({ ...shift }))),
      input.actorId
    )
  })
}
export async function undoDraft(input: {
  periodId: string
  expectedRevision: number
  actorId: string
}) {
  return withPlanningCoordination(async (tx) => {
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    assertRevision(context, input.expectedRevision)
    assertEditing(context)
    if (
      context.draft.undoActorId !== input.actorId ||
      context.draft.undoRevision !== input.expectedRevision ||
      !context.draft.undoSnapshot
    )
      throw new PlanningConflictError(
        "stale_undo",
        "Your latest edit can no longer be undone because the draft changed or this session has no saved edit."
      )
    return writeShifts(
      tx,
      context,
      context.draft.undoSnapshot as PlanningShift[],
      null
    )
  })
}
export async function refreshDraftInputs(input: {
  periodId: string
  expectedRevision: number
}) {
  return withPlanningCoordination(async (tx) => {
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    assertRevision(context, input.expectedRevision)
    if (context.draft.state === "generating")
      throw new PlanningConflictError(
        "generation_running",
        "Wait for generation or retry an interrupted request."
      )
    const validation = validateDatedSchedule({
      period: context.period,
      effectiveInputs: context.inputs,
      shifts: context.shifts,
    })
    await tx
      .update(planningDrafts)
      .set({
        inputSnapshot: context.inputs,
        inputFingerprint: context.inputs.fingerprint,
        lastValidation: validation,
        revision: context.draft.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(planningDrafts.id, context.draft.id))
    await tx
      .update(planningProposals)
      .set({ state: "superseded" })
      .where(
        and(
          eq(planningProposals.draftId, context.draft.id),
          eq(planningProposals.state, "pending")
        )
      )
  })
}
export async function createRevision(periodId: string) {
  return withPlanningCoordination(async (tx) => {
    const period = await getPlanningPeriod(periodId, tx)
    if (!period?.currentPublishedVersionId)
      throw new PlanningConflictError(
        "not_published",
        "This period has no official schedule to revise."
      )
    const existing = await getDraftForPeriod(periodId, tx)
    if (existing) return existing
    const [version] = await tx
      .select()
      .from(planningPublishedVersions)
      .where(eq(planningPublishedVersions.id, period.currentPublishedVersionId))
    const [draft] = await tx
      .insert(planningDrafts)
      .values({
        periodId,
        basePublishedVersionId: version.id,
        state: "editing",
        inputSnapshot: version.inputSnapshot,
        inputFingerprint: version.inputFingerprint,
      })
      .returning()
    const shifts = await tx
      .select()
      .from(planningPublishedVersionShifts)
      .where(eq(planningPublishedVersionShifts.versionId, version.id))
    if (shifts.length)
      await tx.insert(planningDraftShifts).values(
        shifts.map((shift) => ({
          id: shift.shiftId,
          draftId: draft.id,
          staffMemberId: shift.staffMemberId!,
          actualDate: shift.actualDate,
          startTime: shift.startTime,
          endTime: shift.endTime,
          locked:
            (
              version.displaySnapshot as { shifts?: PlanningShift[] }
            ).shifts?.find((saved) => saved.id === shift.shiftId)?.locked ??
            false,
        }))
      )
    return draft
  })
}
export async function discardWorkingDraft(input: {
  periodId: string
  expectedRevision: number
}) {
  return withPlanningCoordination(async (tx) => {
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    assertRevision(context, input.expectedRevision)
    await tx
      .update(planningDrafts)
      .set({
        discardedAt: new Date(),
        state: "discarded",
        revision: context.draft.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(planningDrafts.id, context.draft.id))
    await tx
      .delete(planningDraftShifts)
      .where(eq(planningDraftShifts.draftId, context.draft.id))
    if (!context.period.currentPublishedVersionId)
      await tx
        .update(planningPeriods)
        .set({ lifecycle: "abandoned", discardedAt: new Date() })
        .where(eq(planningPeriods.id, input.periodId))
  })
}
export async function applyProposal(input: {
  periodId: string
  proposalId: string
  requestId: string
  expectedRevision: number
  reviewedFingerprint: string
  actorId: string
}) {
  return withPlanningCoordination(async (tx) => {
    const [proposal] = await tx
      .select()
      .from(planningProposals)
      .where(eq(planningProposals.id, input.proposalId))
    if (!proposal)
      throw new PlanningConflictError("proposal_missing", "Proposal not found.")
    if (
      proposal.state === "applied" &&
      proposal.applicationRequestId === input.requestId
    ) {
      const [owner] = await tx
        .select({ periodId: planningDrafts.periodId })
        .from(planningDrafts)
        .where(eq(planningDrafts.id, proposal.draftId))
      if (owner?.periodId !== input.periodId)
        throw new PlanningConflictError(
          "stale_proposal",
          "The proposal belongs to a different period."
        )
      return proposal.applicationOutcome
    }
    if (proposal.state !== "pending")
      throw new PlanningConflictError(
        "proposal_closed",
        "This proposal is no longer pending."
      )
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    assertRevision(context, input.expectedRevision)
    assertEditing(context)
    assertReviewedPlanningInputs(context)
    if (
      proposal.draftId !== context.draft.id ||
      input.reviewedFingerprint !== context.inputs.fingerprint
    )
      throw new PlanningConflictError(
        "stale_proposal",
        "The proposal or current inputs changed. Request a new proposal."
      )
    const rows = await tx
      .select()
      .from(planningProposalOperations)
      .where(eq(planningProposalOperations.proposalId, proposal.id))
      .orderBy(asc(planningProposalOperations.operationIndex))
    const operations: ShiftPatchOperation[] = rows.map((row) =>
      row.operation === "create"
        ? { type: "create", shift: row.afterSnapshot as PlanningShift }
        : row.operation === "delete"
          ? { type: "delete", shiftId: row.targetShiftId! }
          : {
              type: "update",
              shiftId: row.targetShiftId!,
              changes: Object.fromEntries(
                Object.entries(row.afterSnapshot as PlanningShift).filter(
                  ([key]) => !["id", "locked", "groupId"].includes(key)
                )
              ),
            }
    )
    const patch: ProposalPatch = {
      requestId: proposal.requestId,
      periodId: input.periodId,
      groupId: context.period.groupId,
      baseDraftRevision: proposal.draftRevision,
      inputFingerprint: proposal.inputFingerprint,
      scope: proposal.scope as CalendarScope,
      operations,
    }
    const checked = validateProposalPatch({
      proposal: patch,
      context: {
        period: context.period,
        effectiveInputs: context.inputs,
        draft: context.shifts,
        currentDraftRevision: context.draft.revision,
        currentInputFingerprint: context.inputs.fingerprint,
      },
    })
    if (!checked.valid || !checked.candidate)
      throw new PlanningConflictError(
        "invalid_proposal",
        "This proposal cannot be applied. Review its current validation issues.",
        { issues: checked.issues }
      )
    const result = await writeShifts(
      tx,
      context,
      checked.candidate,
      input.actorId
    )
    const outcome = { periodId: input.periodId, revision: result.revision }
    await tx
      .update(planningProposals)
      .set({
        state: "applied",
        applicationRequestId: input.requestId,
        applicationOutcome: outcome,
        appliedAt: new Date(),
      })
      .where(eq(planningProposals.id, proposal.id))
    return outcome
  })
}
export async function publishDraft(input: {
  periodId: string
  requestId: string
  expectedRevision: number
  expectedBaseVersionId: string | null
  reviewedFingerprint: string
}) {
  return withPlanningCoordination(async (tx) => {
    const [existing] = await tx
      .select()
      .from(planningPublishedVersions)
      .where(
        eq(planningPublishedVersions.publicationRequestId, input.requestId)
      )
    if (existing) {
      if (existing.periodId !== input.periodId)
        throw new PlanningConflictError(
          "request_mismatch",
          "This publication request belongs to another period."
        )
      return existing
    }
    const context = await loadCurrentPlanningContext(input.periodId, tx)
    assertRevision(context, input.expectedRevision)
    assertEditing(context)
    if (
      (context.period.currentPublishedVersionId ?? null) !==
        input.expectedBaseVersionId ||
      context.draft.basePublishedVersionId !== input.expectedBaseVersionId
    )
      throw new PlanningConflictError(
        "stale_base",
        "The official schedule changed. Reopen its current revision."
      )
    if (
      context.inputs.fingerprint !== input.reviewedFingerprint ||
      context.draft.inputFingerprint !== input.reviewedFingerprint
    )
      throw new PlanningConflictError(
        "stale_inputs",
        "Relevant inputs changed. Refresh and review them before publication."
      )
    assertStructural(context, context.shifts)
    const validation = validateDatedSchedule({
      period: context.period,
      effectiveInputs: context.inputs,
      shifts: context.shifts,
    })
    if (!validation.valid)
      throw new PlanningConflictError(
        "validation_failed",
        "Resolve the current scheduling errors before publication.",
        { issues: validation.issues }
      )
    const [latest] = await tx
      .select()
      .from(planningPublishedVersions)
      .where(eq(planningPublishedVersions.periodId, input.periodId))
      .orderBy(desc(planningPublishedVersions.versionNumber))
      .limit(1)
    const [version] = await tx
      .insert(planningPublishedVersions)
      .values({
        periodId: input.periodId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        priorVersionId: input.expectedBaseVersionId,
        inputSnapshot: context.inputs,
        inputFingerprint: context.inputs.fingerprint,
        validationSnapshot: validation,
        displaySnapshot: {
          group: context.inputs.group,
          staff: context.inputs.staff,
          shifts: context.shifts,
          aiNotes: context.draft.aiNotes,
        },
        publicationRequestId: input.requestId,
      })
      .returning()
    if (context.shifts.length)
      await tx.insert(planningPublishedVersionShifts).values(
        context.shifts.map((shift) => {
          const staff = context.inputs.staff.find(
            (member) => member.id === shift.staffId
          )!
          return {
            versionId: version.id,
            shiftId: shift.id,
            staffMemberId: staff.id,
            staffFirstName: staff.firstName ?? "",
            staffLastName: staff.lastName ?? "",
            staffRole: staff.role,
            actualDate: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
          }
        })
      )
    await tx
      .update(planningPeriods)
      .set({
        lifecycle: "published",
        currentPublishedVersionId: version.id,
        updatedAt: new Date(),
      })
      .where(eq(planningPeriods.id, input.periodId))
    await tx
      .update(planningDrafts)
      .set({
        discardedAt: new Date(),
        state: "discarded",
        revision: context.draft.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(planningDrafts.id, context.draft.id))
    await tx
      .delete(planningDraftShifts)
      .where(eq(planningDraftShifts.draftId, context.draft.id))
    await touchPlanningSource("published_version", input.periodId, tx)
    return version
  })
}
export async function saveInstitutionTimezone(timezone: string) {
  return withPlanningCoordination(async (tx) => {
    await getInstitutionSettings(tx)
    await tx
      .update(institutionSettings)
      .set({ timezone })
      .where(eq(institutionSettings.id, 1))
    await touchPlanningSource("institution_settings", "1", tx)
  })
}
