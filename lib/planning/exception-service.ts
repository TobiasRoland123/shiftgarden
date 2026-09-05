import { and, eq, gt, gte, inArray, lt, lte, ne, or } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  groups,
  institutionSettings,
  planningExceptionIntervals,
  planningExceptionParticipants,
  planningExceptions,
  staffMembers,
} from "@/lib/db/schema"
import {
  assertExceptionInput,
  type PlanningExceptionInput,
} from "@/lib/planning/exceptions"
import {
  touchPlanningSource,
  withPlanningCoordination,
} from "@/lib/planning/source-coordination"
import { PlanningConflictError } from "@/lib/planning/repository"

async function assertOwner(input: PlanningExceptionInput, executor: typeof db) {
  const owner = input.owner
  if (owner.ownerType === "institution") {
    if (!/^\d+$/.test(owner.ownerId))
      throw new PlanningConflictError(
        "invalid_owner",
        "Institution owner not found."
      )
    const [row] = await executor
      .select({ id: institutionSettings.id })
      .from(institutionSettings)
      .where(eq(institutionSettings.id, Number(owner.ownerId)))
      .limit(1)
    if (!row)
      throw new PlanningConflictError(
        "invalid_owner",
        "Institution owner not found."
      )
  } else if (owner.ownerType === "group") {
    const [row] = await executor
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, owner.ownerId))
      .limit(1)
    if (!row)
      throw new PlanningConflictError("invalid_owner", "Group owner not found.")
  } else {
    const [row] = await executor
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(eq(staffMembers.id, owner.ownerId))
      .limit(1)
    if (!row)
      throw new PlanningConflictError("invalid_owner", "Staff owner not found.")
  }
  const participantIds =
    input.type === "meeting" || input.type === "training"
      ? [
          ...new Set([
            ...(owner.ownerType === "staff" ? [owner.ownerId] : []),
            ...input.participantStaffIds,
          ]),
        ]
      : []
  if (participantIds.length > 0) {
    const rows = await executor
      .select({ id: staffMembers.id })
      .from(staffMembers)
    if (participantIds.some((id) => !rows.some((row) => row.id === id)))
      throw new PlanningConflictError(
        "invalid_participant",
        "An event participant was not found."
      )
  }
  return participantIds
}

function ownerId(row: typeof planningExceptions.$inferSelect) {
  return String(row.institutionId ?? row.groupId ?? row.staffMemberId ?? "")
}

function sourceType(type: PlanningExceptionInput["type"]) {
  return type === "meeting" || type === "training"
    ? ("event" as const)
    : ("exception" as const)
}

function replacementIntervals(input: PlanningExceptionInput) {
  if (input.type !== "opening_replacement" || input.intervals.length > 0)
    return input.intervals
  return input.startTime && input.endTime
    ? [{ startTime: input.startTime, endTime: input.endTime }]
    : []
}

async function assertNoConflictingException(
  input: PlanningExceptionInput,
  participantIds: string[],
  executor: typeof db,
  exceptId?: string
) {
  const dateOverlap = and(
    lte(planningExceptions.startDate, input.endDate),
    gte(planningExceptions.endDate, input.startDate)
  )
  const excluded = exceptId ? ne(planningExceptions.id, exceptId) : undefined

  if (input.type === "closed_date" || input.type === "opening_replacement") {
    const [conflict] = await executor
      .select({ id: planningExceptions.id })
      .from(planningExceptions)
      .where(
        and(
          dateOverlap,
          excluded,
          eq(planningExceptions.ownerType, "institution"),
          eq(planningExceptions.institutionId, Number(input.owner.ownerId)),
          or(
            eq(planningExceptions.type, "closed_date"),
            eq(planningExceptions.type, "opening_replacement")
          )
        )
      )
      .limit(1)
    if (conflict) {
      throw new PlanningConflictError(
        "conflicting_replacement",
        "These dates already have an institution opening replacement.",
        { exceptionId: conflict.id }
      )
    }
  }

  if (
    input.type === "staffing_replacement" &&
    input.startTime &&
    input.endTime
  ) {
    const [conflict] = await executor
      .select({ id: planningExceptions.id })
      .from(planningExceptions)
      .where(
        and(
          dateOverlap,
          excluded,
          eq(planningExceptions.ownerType, "group"),
          eq(planningExceptions.groupId, input.owner.ownerId),
          eq(planningExceptions.type, "staffing_replacement"),
          lt(planningExceptions.startTime, input.endTime),
          gt(planningExceptions.endTime, input.startTime)
        )
      )
      .limit(1)
    if (conflict) {
      throw new PlanningConflictError(
        "conflicting_replacement",
        "This staffing replacement overlaps another replacement for the group.",
        { exceptionId: conflict.id }
      )
    }
  }

  if (
    (input.type === "meeting" || input.type === "training") &&
    input.countsTowardWeeklyHours &&
    input.startTime &&
    input.endTime &&
    participantIds.length > 0
  ) {
    const candidates = await executor
      .select({ id: planningExceptions.id })
      .from(planningExceptions)
      .where(
        and(
          dateOverlap,
          excluded,
          or(
            eq(planningExceptions.type, "meeting"),
            eq(planningExceptions.type, "training")
          ),
          eq(planningExceptions.countsTowardWeeklyHours, true),
          lt(planningExceptions.startTime, input.endTime),
          gt(planningExceptions.endTime, input.startTime)
        )
      )
    if (candidates.length > 0) {
      const [participantConflict] = await executor
        .select({
          exceptionId: planningExceptionParticipants.exceptionId,
          staffMemberId: planningExceptionParticipants.staffMemberId,
        })
        .from(planningExceptionParticipants)
        .where(
          and(
            inArray(
              planningExceptionParticipants.exceptionId,
              candidates.map((candidate) => candidate.id)
            ),
            inArray(planningExceptionParticipants.staffMemberId, participantIds)
          )
        )
        .limit(1)
      if (participantConflict) {
        throw new PlanningConflictError(
          "overlapping_counted_event",
          "Counted event attendance overlaps for a participant.",
          participantConflict
        )
      }
    }
  }
}

async function createPlanningException(rawInput: unknown) {
  const input = assertExceptionInput(rawInput)
  return withPlanningCoordination(async (tx) => {
    const participantIds = await assertOwner(input, tx)
    await assertNoConflictingException(input, participantIds, tx)
    const ownerId = input.owner.ownerId
    const [exception] = await tx
      .insert(planningExceptions)
      .values({
        ownerType: input.owner.ownerType,
        institutionId:
          input.owner.ownerType === "institution" ? Number(ownerId) : null,
        groupId: input.owner.ownerType === "group" ? ownerId : null,
        staffMemberId: input.owner.ownerType === "staff" ? ownerId : null,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        reason: input.reason ?? null,
        minStaff: input.minStaff ?? null,
        minPedagogs: input.minPedagogs ?? null,
        countsTowardWeeklyHours: input.countsTowardWeeklyHours,
      })
      .returning()
    if (!exception) throw new Error("Exception could not be created.")
    const intervals = replacementIntervals(input)
    if (intervals.length > 0)
      await tx.insert(planningExceptionIntervals).values(
        intervals.map((interval) => ({
          exceptionId: exception.id,
          ...interval,
        }))
      )
    if (participantIds.length > 0)
      await tx.insert(planningExceptionParticipants).values(
        participantIds.map((staffMemberId) => ({
          exceptionId: exception.id,
          staffMemberId,
        }))
      )
    await touchPlanningSource(sourceType(input.type), exception.id, tx)
    return exception
  })
}

async function updatePlanningException(
  exceptionId: string,
  rawInput: unknown,
  expectedSourceRevision: number
) {
  const input = assertExceptionInput(rawInput)
  return withPlanningCoordination(async (tx) => {
    const [current] = await tx
      .select()
      .from(planningExceptions)
      .where(
        and(
          eq(planningExceptions.id, exceptionId),
          eq(planningExceptions.sourceRevision, expectedSourceRevision)
        )
      )
      .for("update")
    if (!current)
      throw new PlanningConflictError(
        "stale_source",
        "This exception changed in another session."
      )
    if (
      current.ownerType !== input.owner.ownerType ||
      ownerId(current) !== input.owner.ownerId
    ) {
      throw new PlanningConflictError(
        "owner_immutable",
        "An exception cannot be moved to another owner. Create a new exception on that owner instead."
      )
    }
    const participantIds = await assertOwner(input, tx)
    await assertNoConflictingException(input, participantIds, tx, exceptionId)
    const [exception] = await tx
      .update(planningExceptions)
      .set({
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        reason: input.reason ?? null,
        minStaff: input.minStaff ?? null,
        minPedagogs: input.minPedagogs ?? null,
        countsTowardWeeklyHours: input.countsTowardWeeklyHours,
        sourceRevision: expectedSourceRevision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(planningExceptions.id, exceptionId),
          eq(planningExceptions.sourceRevision, expectedSourceRevision)
        )
      )
      .returning()
    if (!exception)
      throw new PlanningConflictError(
        "stale_source",
        "This exception changed in another session."
      )
    await tx
      .delete(planningExceptionIntervals)
      .where(eq(planningExceptionIntervals.exceptionId, exceptionId))
    await tx
      .delete(planningExceptionParticipants)
      .where(eq(planningExceptionParticipants.exceptionId, exceptionId))
    const intervals = replacementIntervals(input)
    if (intervals.length > 0)
      await tx
        .insert(planningExceptionIntervals)
        .values(intervals.map((interval) => ({ exceptionId, ...interval })))
    if (participantIds.length > 0)
      await tx.insert(planningExceptionParticipants).values(
        participantIds.map((staffMemberId) => ({
          exceptionId,
          staffMemberId,
        }))
      )
    await touchPlanningSource(sourceType(current.type), exceptionId, tx)
    if (sourceType(current.type) !== sourceType(input.type))
      await touchPlanningSource(sourceType(input.type), exceptionId, tx)
    return exception
  })
}

async function deletePlanningException(
  exceptionId: string,
  expectedSourceRevision: number
) {
  return withPlanningCoordination(async (tx) => {
    const [deleted] = await tx
      .delete(planningExceptions)
      .where(
        and(
          eq(planningExceptions.id, exceptionId),
          eq(planningExceptions.sourceRevision, expectedSourceRevision)
        )
      )
      .returning({ id: planningExceptions.id, type: planningExceptions.type })
    if (!deleted)
      throw new PlanningConflictError(
        "stale_source",
        "This exception changed in another session."
      )
    await touchPlanningSource(sourceType(deleted.type), exceptionId, tx)
    return deleted
  })
}

export {
  createPlanningException,
  deletePlanningException,
  updatePlanningException,
}
