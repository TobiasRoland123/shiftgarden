import { and, asc, eq, gte, lte, or } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  groupStaffRules,
  groups,
  institutionOpeningHours,
  planningDraftShifts,
  planningDrafts,
  planningExceptionIntervals,
  planningExceptionParticipants,
  planningExceptions,
  planningPeriods,
  planningPublishedVersionShifts,
  planningPublishedVersions,
  planningSourceRevisions,
  staffMemberAvailability,
  staffMemberGroups,
  staffMembers,
} from "@/lib/db/schema"
import type {
  GroupRequirementReplacement,
  OpeningReplacement,
  PlanningEvent,
  PlanningPeriod,
  PublishedCommitment,
  RawRecurringInput,
  SourceReference,
  StaffUnavailability,
} from "@/lib/planning/contracts"
import {
  addDays,
  enumerateDates,
  intersectingIsoWeeks,
  isoWeekKey,
  isoWeekStart,
} from "@/lib/planning/dates"
import {
  getInstitutionSettings,
  type PlanningExecutor,
  type PlanningSourceType,
} from "@/lib/planning/source-coordination"
import { buildScheduleInput } from "@/lib/shift-schedule/build"

type LoadInputsResult = {
  period: PlanningPeriod
  recurring: RawRecurringInput
  openingReplacements: OpeningReplacement[]
  requirementReplacements: GroupRequirementReplacement[]
  unavailability: StaffUnavailability[]
  events: PlanningEvent[]
  commitments: PublishedCommitment[]
  sourceReferences: SourceReference[]
}

const clock = (value: string | null) => value?.slice(0, 5)

function revisionKey(sourceType: PlanningSourceType, sourceId: string) {
  return `${sourceType}:${sourceId}`
}

async function loadEffectivePlanningInputs(
  periodId: string,
  executor: PlanningExecutor = db
): Promise<LoadInputsResult | undefined> {
  const [periodRow] = await executor
    .select({ period: planningPeriods, group: groups })
    .from(planningPeriods)
    .innerJoin(groups, eq(groups.id, planningPeriods.groupId))
    .where(eq(planningPeriods.id, periodId))
    .limit(1)
  if (!periodRow) return undefined

  const settings = await getInstitutionSettings(executor)
  const period: PlanningPeriod = {
    ...periodRow.period,
    lifecycle:
      periodRow.period.lifecycle === "discarded" ||
      periodRow.period.lifecycle === "abandoned"
        ? "abandoned"
        : periodRow.period.lifecycle,
  }
  const linkedStaff = await executor
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      role: staffMembers.role,
      maxHoursPerWeek: staffMembers.maxHoursPerWeek,
      active: staffMembers.active,
    })
    .from(staffMemberGroups)
    .innerJoin(
      staffMembers,
      eq(staffMembers.id, staffMemberGroups.staffMemberId)
    )
    .where(eq(staffMemberGroups.groupId, period.groupId))
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))
  const staffIds = linkedStaff.map((staff) => staff.id)
  const availability =
    staffIds.length > 0
      ? await executor
          .select({
            staffMemberId: staffMemberAvailability.staffMemberId,
            dayOfWeek: staffMemberAvailability.dayOfWeek,
            startAvailabilityTime:
              staffMemberAvailability.startAvailabilityTime,
            endAvailabilityTime: staffMemberAvailability.endAvailabilityTime,
          })
          .from(staffMemberAvailability)
          .where(
            or(
              ...staffIds.map((id) =>
                eq(staffMemberAvailability.staffMemberId, id)
              )
            )
          )
          .orderBy(
            asc(staffMemberAvailability.dayOfWeek),
            asc(staffMemberAvailability.startAvailabilityTime)
          )
      : []
  const rules = await executor
    .select({
      dayOfWeek: groupStaffRules.dayOfWeek,
      startTime: groupStaffRules.startTime,
      endTime: groupStaffRules.endTime,
      minPedagogs: groupStaffRules.minPedagogs,
      minStaff: groupStaffRules.minStaff,
    })
    .from(groupStaffRules)
    .where(eq(groupStaffRules.groupId, period.groupId))
    .orderBy(asc(groupStaffRules.dayOfWeek), asc(groupStaffRules.startTime))
  const openingHours = await executor
    .select({
      dayOfWeek: institutionOpeningHours.dayOfWeek,
      startTime: institutionOpeningHours.startTime,
      endTime: institutionOpeningHours.endTime,
    })
    .from(institutionOpeningHours)
    .orderBy(
      asc(institutionOpeningHours.dayOfWeek),
      asc(institutionOpeningHours.startTime)
    )
  const recurring = buildScheduleInput({
    group: periodRow.group,
    linkedStaff,
    availability,
    openingHours,
    rules,
  }) as RawRecurringInput

  const weekStart = isoWeekStart(period.startDate)
  const weekEnd = addDays(isoWeekStart(period.endDate), 6)
  const exceptionRows = await executor
    .select()
    .from(planningExceptions)
    .where(
      and(
        lte(planningExceptions.startDate, weekEnd),
        gte(planningExceptions.endDate, weekStart)
      )
    )
  const exceptionIds = exceptionRows.map((row) => row.id)
  const intervals =
    exceptionIds.length > 0
      ? await executor
          .select()
          .from(planningExceptionIntervals)
          .where(
            or(
              ...exceptionIds.map((id) =>
                eq(planningExceptionIntervals.exceptionId, id)
              )
            )
          )
      : []
  const participants =
    exceptionIds.length > 0
      ? await executor
          .select()
          .from(planningExceptionParticipants)
          .where(
            or(
              ...exceptionIds.map((id) =>
                eq(planningExceptionParticipants.exceptionId, id)
              )
            )
          )
      : []
  const datesFor = (start: string, end: string, includeWholeWeeks = false) =>
    enumerateDates(start, end).filter((date) =>
      includeWholeWeeks
        ? date >= weekStart && date <= weekEnd
        : date >= period.startDate && date <= period.endDate
    )
  const exceptionSource = (
    id: string,
    revision: number,
    sourceType: "exception" | "event",
    ownerId?: string
  ): SourceReference => ({
    sourceId: id,
    sourceRevision: revision,
    sourceType,
    ownerId,
  })

  const openingReplacements: OpeningReplacement[] = exceptionRows
    .filter(
      (row) =>
        row.ownerType === "institution" &&
        (row.type === "opening_replacement" || row.type === "closed_date")
    )
    .flatMap((row) =>
      datesFor(row.startDate, row.endDate).map((date) => ({
        id: row.id,
        institutionId: String(row.institutionId ?? settings.id),
        date,
        intervals:
          row.type === "closed_date"
            ? []
            : intervals
                .filter((item) => item.exceptionId === row.id)
                .map((item) => ({
                  startTime: item.startTime.slice(0, 5),
                  endTime: item.endTime.slice(0, 5),
                  source: exceptionSource(
                    row.id,
                    row.sourceRevision,
                    "exception",
                    String(row.institutionId ?? settings.id)
                  ),
                })),
        sourceRevision: row.sourceRevision,
        source: exceptionSource(
          row.id,
          row.sourceRevision,
          "exception",
          String(row.institutionId ?? settings.id)
        ),
      }))
    )
  const requirementReplacements: GroupRequirementReplacement[] = exceptionRows
    .filter(
      (row) =>
        row.type === "staffing_replacement" &&
        row.groupId === period.groupId &&
        row.minStaff !== null &&
        row.minPedagogs !== null &&
        row.startTime &&
        row.endTime
    )
    .flatMap((row) =>
      datesFor(row.startDate, row.endDate).map((date) => ({
        id: row.id,
        groupId: period.groupId,
        date,
        startTime: clock(row.startTime)!,
        endTime: clock(row.endTime)!,
        minStaff: row.minStaff!,
        minPedagogs: row.minPedagogs!,
        sourceRevision: row.sourceRevision,
        source: exceptionSource(
          row.id,
          row.sourceRevision,
          "exception",
          period.groupId
        ),
      }))
    )
  const unavailability: StaffUnavailability[] = exceptionRows
    .filter(
      (row) =>
        (row.type === "leave" ||
          row.type === "sickness" ||
          row.type === "partial_unavailability") &&
        row.staffMemberId !== null &&
        staffIds.includes(row.staffMemberId)
    )
    .flatMap((row) =>
      datesFor(row.startDate, row.endDate).map((date) => ({
        id: row.id,
        staffId: row.staffMemberId!,
        kind:
          row.type === "partial_unavailability" ? "unavailability" : row.type,
        date,
        startTime: clock(row.startTime) ?? "00:00",
        endTime: clock(row.endTime) ?? "23:59",
        sourceRevision: row.sourceRevision,
        description: row.reason ?? undefined,
        source: exceptionSource(
          row.id,
          row.sourceRevision,
          "exception",
          row.staffMemberId!
        ),
      }))
    )
  const events: PlanningEvent[] = exceptionRows
    .filter(
      (row) =>
        (row.type === "meeting" || row.type === "training") &&
        row.startTime !== null &&
        row.endTime !== null
    )
    .flatMap((row) => {
      const linkedParticipantIds = participants
        .filter((item) => item.exceptionId === row.id)
        .map((item) => item.staffMemberId)
        .filter((id) => staffIds.includes(id))
      if (linkedParticipantIds.length === 0) return []
      return datesFor(row.startDate, row.endDate, true).map((date) => ({
        id: row.id,
        date,
        startTime: clock(row.startTime)!,
        endTime: clock(row.endTime)!,
        ownerType: row.ownerType,
        ownerId: String(
          row.groupId ?? row.institutionId ?? row.staffMemberId ?? ""
        ),
        kind: row.type as "meeting" | "training",
        participantStaffIds: linkedParticipantIds,
        countsTowardWeeklyHours: row.countsTowardWeeklyHours,
        sourceRevision: row.sourceRevision,
        description: row.reason ?? undefined,
        source: exceptionSource(
          row.id,
          row.sourceRevision,
          "event",
          String(row.groupId ?? row.institutionId ?? row.staffMemberId ?? "")
        ),
      }))
    })

  const weeks = new Set(intersectingIsoWeeks(period.startDate, period.endDate))
  const publishedRows = await executor
    .select({
      shift: planningPublishedVersionShifts,
      version: planningPublishedVersions,
      period: planningPeriods,
    })
    .from(planningPublishedVersionShifts)
    .innerJoin(
      planningPublishedVersions,
      eq(planningPublishedVersions.id, planningPublishedVersionShifts.versionId)
    )
    .innerJoin(
      planningPeriods,
      eq(planningPeriods.id, planningPublishedVersions.periodId)
    )
  const commitments: PublishedCommitment[] = publishedRows
    .filter(
      ({ shift, version, period: sourcePeriod }) =>
        weeks.has(isoWeekKey(shift.actualDate)) &&
        sourcePeriod.currentPublishedVersionId === version.id &&
        sourcePeriod.id !== period.id &&
        shift.staffMemberId !== null &&
        staffIds.includes(shift.staffMemberId)
    )
    .map(({ shift, version, period: sourcePeriod }) => ({
      id: shift.shiftId,
      staffId: shift.staffMemberId!,
      date: shift.actualDate,
      startTime: shift.startTime.slice(0, 5),
      endTime: shift.endTime.slice(0, 5),
      locked: true,
      sourceGroupId: sourcePeriod.groupId,
      sourcePeriodId: sourcePeriod.id,
      versionId: version.id,
      authoritative: true,
    }))
  const draftRows = await executor
    .select({
      shift: planningDraftShifts,
      draft: planningDrafts,
      period: planningPeriods,
    })
    .from(planningDraftShifts)
    .innerJoin(
      planningDrafts,
      eq(planningDrafts.id, planningDraftShifts.draftId)
    )
    .innerJoin(planningPeriods, eq(planningPeriods.id, planningDrafts.periodId))
  const advisoryCommitments: PublishedCommitment[] = draftRows
    .filter(
      ({ shift, draft, period: sourcePeriod }) =>
        draft.discardedAt === null &&
        (draft.state === "editing" || draft.state === "reviewing") &&
        sourcePeriod.id !== period.id &&
        weeks.has(isoWeekKey(shift.actualDate)) &&
        staffIds.includes(shift.staffMemberId)
    )
    .map(({ shift, period: sourcePeriod }) => ({
      id: shift.id,
      staffId: shift.staffMemberId,
      date: shift.actualDate,
      startTime: shift.startTime.slice(0, 5),
      endTime: shift.endTime.slice(0, 5),
      locked: shift.locked,
      sourceGroupId: sourcePeriod.groupId,
      sourcePeriodId: sourcePeriod.id,
      authoritative: false,
    }))

  const revisionRows = await executor.select().from(planningSourceRevisions)
  const revisions = new Map(
    revisionRows.map((row) => [
      revisionKey(row.sourceType, row.sourceId),
      row.revision,
    ])
  )
  const source = (
    sourceType: PlanningSourceType,
    sourceId: string,
    ownerId?: string,
    aliasId = sourceId
  ): SourceReference => ({
    sourceId: aliasId,
    sourceRevision: revisions.get(revisionKey(sourceType, sourceId)) ?? 0,
    sourceType,
    ownerId,
  })
  const relevantExceptionIds = new Set([
    ...openingReplacements.map((item) => item.id),
    ...requirementReplacements.map((item) => item.id),
    ...unavailability.map((item) => item.id),
    ...events.map((item) => item.id),
  ])
  const sourceReferences: SourceReference[] = [
    source("institution_settings", String(settings.id), String(settings.id)),
    source(
      "institution_opening_hours",
      String(settings.id),
      String(settings.id)
    ),
    source("group", period.groupId, period.groupId),
    source("group_staff_rules", period.groupId, period.groupId),
    ...openingHours.map((opening, index) =>
      source(
        "institution_opening_hours",
        String(settings.id),
        String(settings.id),
        `opening:${opening.dayOfWeek}:${index}`
      )
    ),
    ...rules.map((rule, index) =>
      source(
        "group_staff_rules",
        period.groupId,
        period.groupId,
        `rule:${rule.dayOfWeek}:${index}`
      )
    ),
    ...staffIds.flatMap((staffId) => [
      source("staff", staffId, staffId),
      source("staff_availability", staffId, staffId),
      source("staff_membership", `${staffId}:${period.groupId}`, staffId),
    ]),
    ...exceptionRows
      .filter((row) => relevantExceptionIds.has(row.id))
      .map((row) =>
        exceptionSource(
          row.id,
          row.sourceRevision,
          row.type === "meeting" || row.type === "training"
            ? "event"
            : "exception",
          String(row.groupId ?? row.staffMemberId ?? row.institutionId ?? "")
        )
      ),
    ...[
      ...new Set(
        commitments.map((item) => item.sourcePeriodId).filter(Boolean)
      ),
    ].map((sourcePeriodId) =>
      source("published_version", sourcePeriodId!, sourcePeriodId!)
    ),
  ]

  return {
    period,
    recurring,
    openingReplacements,
    requirementReplacements,
    unavailability,
    events,
    commitments: [...commitments, ...advisoryCommitments],
    sourceReferences,
  }
}

export { loadEffectivePlanningInputs }
export type { LoadInputsResult }
