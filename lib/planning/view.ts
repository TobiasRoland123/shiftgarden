import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  groups,
  institutionSettings,
  planningDrafts,
  planningExceptionIntervals,
  planningExceptionParticipants,
  planningExceptions,
  planningGenerationAttempts,
  planningGenerationRequests,
  planningPeriods,
  planningProposalOperations,
  planningProposals,
  planningPublishedVersionShifts,
  planningPublishedVersions,
  shiftSchedulePlans,
  staffMemberGroups,
  staffMembers,
} from "@/lib/db/schema"
import type {
  DatedSchedule,
  EffectiveInputs,
  PlanningPeriod,
  PlanningShift,
  PlanningStaff,
  ValidationIssue,
} from "@/lib/planning/contracts"
import { composeEffectiveInputs } from "@/lib/planning/effective-inputs"
import {
  intersectingIsoWeeks,
  isoWeekKey,
  timeToMinutes,
} from "@/lib/planning/dates"
import { loadEffectivePlanningInputs } from "@/lib/planning/load-inputs"
import { applyOperations } from "@/lib/planning/patch"
import {
  getDraftForPeriod,
  getDraftShifts,
  getPlanningPeriod as readPeriod,
} from "@/lib/planning/repository"
import { flattenSchedule, validateDatedSchedule } from "@/lib/planning/validate"
import type {
  GroupSummary,
  PeriodViewData,
  PlanningExceptionSummary,
  PlanningOverviewData,
  PlanningPeriodSummary,
  PreparationData,
  ProposalView,
} from "@/components/planning/types"

function asPeriod(value: typeof planningPeriods.$inferSelect): PlanningPeriod {
  return {
    id: value.id,
    groupId: value.groupId,
    startDate: value.startDate,
    endDate: value.endDate,
    timezone: value.timezone,
    lifecycle:
      value.lifecycle === "discarded" || value.lifecycle === "abandoned"
        ? "abandoned"
        : value.lifecycle,
    currentPublishedVersionId: value.currentPublishedVersionId,
  }
}
const clock = (value: string | null | undefined) => value?.slice(0, 5) ?? ""
function shiftFromRow(
  row: {
    id: string
    staffMemberId: string
    actualDate: string
    startTime: string
    endTime: string
    locked?: boolean
  },
  groupId: string
): PlanningShift {
  return {
    id: row.id,
    groupId,
    staffId: row.staffMemberId,
    date: row.actualDate,
    startTime: clock(row.startTime),
    endTime: clock(row.endTime),
    locked: row.locked ?? true,
  }
}
function issuesFrom(value: unknown): ValidationIssue[] {
  if (!value || typeof value !== "object") return []
  const candidate = value as { issues?: unknown[] }
  return Array.isArray(candidate.issues)
    ? candidate.issues.filter((item): item is ValidationIssue =>
        Boolean(item && typeof item === "object" && "message" in item)
      )
    : []
}

function coverageSegments(
  effective: ReturnType<typeof composeEffectiveInputs>,
  shifts: PlanningShift[],
  issues: ValidationIssue[]
): PeriodViewData["coverageSegments"] {
  const disqualifying = new Set([
    "duplicate_shift_id",
    "unknown_staff",
    "inactive_staff",
    "group_id_mismatch",
    "out_of_range_date",
    "invalid_shift_time",
    "shift_outside_opening_hours",
    "outside_availability",
    "external_overlap",
  ])
  const ineligibleIds = new Set(
    issues
      .filter((issue) => issue.shiftId && disqualifying.has(issue.code))
      .map((issue) => issue.shiftId!)
  )
  const staffById = new Map(
    effective.staff.map((person) => [person.id, person])
  )
  const result: PeriodViewData["coverageSegments"] = []
  for (const day of effective.days) {
    const dated = shifts.filter((shift) => shift.date === day.date)
    for (const demand of day.demandSegments) {
      const start = timeToMinutes(demand.startTime)
      const end = timeToMinutes(demand.endTime)
      const boundaries = new Set([start, end])
      for (const shift of dated) {
        const shiftStart = timeToMinutes(shift.startTime)
        const shiftEnd = timeToMinutes(shift.endTime)
        if (shiftStart > start && shiftStart < end) boundaries.add(shiftStart)
        if (shiftEnd > start && shiftEnd < end) boundaries.add(shiftEnd)
      }
      const sorted = [...boundaries].sort((left, right) => left - right)
      for (let index = 0; index < sorted.length - 1; index += 1) {
        const segmentStart = sorted[index]
        const segmentEnd = sorted[index + 1]
        const eligibleStaffIds = [
          ...new Set(
            dated
              .filter(
                (shift) =>
                  !ineligibleIds.has(shift.id) &&
                  timeToMinutes(shift.startTime) <= segmentStart &&
                  timeToMinutes(shift.endTime) >= segmentEnd
              )
              .map((shift) => shift.staffId)
          ),
        ]
        result.push({
          date: day.date,
          startTime: clock(
            `${String(Math.floor(segmentStart / 60)).padStart(2, "0")}:${String(segmentStart % 60).padStart(2, "0")}`
          ),
          endTime: clock(
            `${String(Math.floor(segmentEnd / 60)).padStart(2, "0")}:${String(segmentEnd % 60).padStart(2, "0")}`
          ),
          actualStaff: eligibleStaffIds.length,
          requiredStaff: demand.minStaff,
          actualPedagogs: eligibleStaffIds.filter(
            (id) => staffById.get(id)?.role === "pedagog"
          ).length,
          requiredPedagogs: demand.minPedagogs,
          eligibleStaffIds,
          sourceIds: [
            ...demand.openingSourceIds,
            ...demand.ruleSourceIds,
            ...(demand.replacementSourceId ? [demand.replacementSourceId] : []),
          ],
        })
      }
    }
  }
  return result
}

function diffShifts(
  before: PlanningShift[],
  after: PlanningShift[]
): PeriodViewData["publicationChanges"] {
  const previous = new Map(before.map((shift) => [shift.id, shift]))
  const current = new Map(after.map((shift) => [shift.id, shift]))
  const changes: PeriodViewData["publicationChanges"] = []
  for (const shift of before)
    if (!current.has(shift.id)) changes.push({ type: "delete", before: shift })
  for (const shift of after) {
    const old = previous.get(shift.id)
    if (!old) changes.push({ type: "create", after: shift })
    else if (
      old.staffId !== shift.staffId ||
      old.date !== shift.date ||
      old.startTime !== shift.startTime ||
      old.endTime !== shift.endTime ||
      old.locked !== shift.locked
    )
      changes.push({ type: "update", before: old, after: shift })
  }
  return changes
}

async function getPlanningOverview(): Promise<PlanningOverviewData> {
  const groupsRows = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .orderBy(asc(groups.name))
  const memberships = await db
    .select({ groupId: staffMemberGroups.groupId, active: staffMembers.active })
    .from(staffMemberGroups)
    .innerJoin(
      staffMembers,
      eq(staffMemberGroups.staffMemberId, staffMembers.id)
    )
  const countsByGroup = new Map<
    string,
    { staffCount: number; activeStaffCount: number }
  >()
  for (const row of memberships) {
    const current = countsByGroup.get(row.groupId) ?? {
      staffCount: 0,
      activeStaffCount: 0,
    }
    current.staffCount += 1
    if (row.active) current.activeStaffCount += 1
    countsByGroup.set(row.groupId, current)
  }
  const periodRows = await db
    .select()
    .from(planningPeriods)
    .where(sql`${planningPeriods.lifecycle} <> 'discarded'`)
    .orderBy(desc(planningPeriods.startDate))
  const draftRows = periodRows.length
    ? await db
        .select()
        .from(planningDrafts)
        .where(
          and(
            sql`${planningDrafts.periodId} in (${sql.join(
              periodRows.map((period) => sql`${period.id}`),
              sql`, `
            )})`,
            isNull(planningDrafts.discardedAt)
          )
        )
    : []
  const draftByPeriod = new Map(
    draftRows.map((draft) => [draft.periodId, draft])
  )
  const versionRows = periodRows.length
    ? await db
        .select()
        .from(planningPublishedVersions)
        .where(
          or(
            ...periodRows.map((period) =>
              eq(planningPublishedVersions.periodId, period.id)
            )
          )
        )
    : []
  const versionById = new Map(
    versionRows.map((version) => [version.id, version])
  )
  const periodSummaries = new Map<string, PlanningPeriodSummary[]>()
  for (const period of periodRows) {
    const draft = draftByPeriod.get(period.id)
    const issues = issuesFrom(draft?.lastValidation)
    const uncoveredDates = [
      ...new Set(
        issues
          .filter(
            (issue) =>
              issue.code === "min_staff_unmet" ||
              issue.code === "min_pedagogs_unmet"
          )
          .map((issue) => issue.date)
          .filter((date): date is string => Boolean(date))
      ),
    ]
    let inputsStale = false
    if (draft?.inputFingerprint) {
      const inputs = await loadEffectivePlanningInputs(period.id)
      if (inputs) {
        const effective = composeEffectiveInputs({
          period: inputs.period,
          recurring: inputs.recurring,
          openingReplacements: inputs.openingReplacements,
          requirementReplacements: inputs.requirementReplacements,
          unavailability: inputs.unavailability,
          events: inputs.events,
          commitments: inputs.commitments,
          replacedVersionId: period.currentPublishedVersionId ?? undefined,
          sourceReferences: inputs.sourceReferences,
        })
        inputsStale = effective.fingerprint !== draft.inputFingerprint
      }
    }
    const status: PlanningPeriodSummary["status"] = inputsStale
      ? "stale"
      : period.currentPublishedVersionId
        ? draft
          ? "revision"
          : "published"
        : draft?.state === "preparation"
          ? "preparation"
          : draft
            ? "draft"
            : "not-planned"
    const summary: PlanningPeriodSummary = {
      ...asPeriod(period),
      status,
      uncoveredDates,
      draftRevision: draft?.revision,
      publishedVersion: period.currentPublishedVersionId
        ? versionById.get(period.currentPublishedVersionId)?.versionNumber
        : undefined,
    }
    const current = periodSummaries.get(period.groupId) ?? []
    current.push(summary)
    periodSummaries.set(period.groupId, current)
  }
  const groupsData: GroupSummary[] = groupsRows.map((group) => ({
    ...group,
    ...(countsByGroup.get(group.id) ?? { staffCount: 0, activeStaffCount: 0 }),
    periods: periodSummaries.get(group.id) ?? [],
  }))
  const [legacy] = await db.select({ total: count() }).from(shiftSchedulePlans)
  return { groups: groupsData, legacyPlanCount: Number(legacy?.total ?? 0) }
}

async function getPlanningGroup(groupId: string) {
  return (await getPlanningOverview()).groups.find(
    (group) => group.id === groupId
  )
}

function sourceRows(
  inputs: NonNullable<Awaited<ReturnType<typeof loadEffectivePlanningInputs>>>,
  period: PlanningPeriod,
  groupId: string
): PreparationData["sources"] {
  const rows: PreparationData["sources"] = []
  for (const item of inputs.unavailability)
    rows.push({
      sourceId: item.id,
      sourceRevision: item.sourceRevision,
      sourceType: item.kind,
      ownerId: item.staffId,
      date: item.date,
      description: item.description,
      effect: `${item.startTime}-${item.endTime}`,
      href: `/staff/${item.staffId}/exceptions/${item.id}`,
    })
  for (const event of inputs.events.filter(
    (item) => item.date >= period.startDate && item.date <= period.endDate
  ))
    rows.push({
      sourceId: event.id,
      sourceRevision: event.sourceRevision,
      sourceType: event.kind,
      ownerId: event.ownerId,
      date: event.date,
      description: event.description,
      effect: `${event.startTime}-${event.endTime}`,
      participantCount: event.participantStaffIds.length,
      href:
        event.ownerType === "staff"
          ? `/staff/${event.ownerId}/exceptions/${event.id}`
          : event.ownerType === "group"
            ? `/groups/${event.ownerId}/exceptions/${event.id}`
            : `/settings/opening-hours/exceptions/${event.id}`,
    })
  for (const item of inputs.requirementReplacements)
    rows.push({
      sourceId: item.id,
      sourceRevision: item.sourceRevision,
      sourceType: "staffing",
      ownerId: groupId,
      date: item.date,
      effect: `${item.startTime}-${item.endTime}`,
      minStaff: item.minStaff,
      minPedagogs: item.minPedagogs,
      href: `/groups/${groupId}/exceptions/${item.id}`,
    })
  for (const item of inputs.openingReplacements)
    rows.push({
      sourceId: item.id,
      sourceRevision: item.sourceRevision,
      sourceType: item.intervals.length ? "opening" : "closure",
      ownerId: item.institutionId,
      date: item.date,
      effect: item.intervals.length
        ? item.intervals
            .map((interval) => `${interval.startTime}-${interval.endTime}`)
            .join(", ")
        : "",
      href: `/settings/opening-hours/exceptions/${item.id}`,
    })
  return rows.toSorted((a, b) => a.date.localeCompare(b.date))
}

async function getPreparation(
  periodId: string
): Promise<PreparationData | undefined> {
  const inputs = await loadEffectivePlanningInputs(periodId)
  if (!inputs) return undefined
  const draft = await getDraftForPeriod(periodId)
  const effective = composeEffectiveInputs({
    period: inputs.period,
    recurring: inputs.recurring,
    openingReplacements: inputs.openingReplacements,
    requirementReplacements: inputs.requirementReplacements,
    unavailability: inputs.unavailability,
    events: inputs.events,
    commitments: inputs.commitments,
    sourceReferences: inputs.sourceReferences,
  })
  return {
    period: inputs.period,
    group: inputs.recurring.group,
    staff: effective.staff,
    effectiveOpeningSummary: `${new Set(effective.days.flatMap((day) => day.openingIntervals.map((interval) => `${interval.startTime}-${interval.endTime}`))).size}`,
    demandSummary: `${effective.demand?.length ?? 0}`,
    sources: sourceRows(inputs, inputs.period, inputs.period.groupId),
    affectedDates: effective.days
      .filter(
        (day) =>
          day.demandSegments.length ||
          day.openingIntervals.length ||
          day.availability.length
      )
      .map((day) => day.date),
    inputIssues: effective.issues,
    draftRevision: draft?.revision,
    inputsStale: Boolean(
      draft?.inputFingerprint &&
      draft.inputFingerprint !== effective.fingerprint
    ),
    staffInputs: effective.staff.map((person) => {
      const availability = effective.days.flatMap((day) =>
        day.availability
          .filter((interval) => interval.staffId === person.id)
          .map((interval) => ({ ...interval, date: day.date }))
      )
      return {
        id: person.id,
        name: `${person.firstName} ${person.lastName}`,
        role: person.role,
        availabilityDates: new Set(
          availability.map((interval) => interval.date)
        ).size,
        intervalCount: availability.length,
        href: `/staff/${person.id}`,
      }
    }),
  }
}

async function getNewPreparation(
  groupId: string
): Promise<PreparationData | undefined> {
  const group = await getPlanningGroup(groupId)
  if (!group) return undefined
  const staff = await db
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      role: staffMembers.role,
      active: staffMembers.active,
      maxHoursPerWeek: staffMembers.maxHoursPerWeek,
    })
    .from(staffMemberGroups)
    .innerJoin(
      staffMembers,
      eq(staffMemberGroups.staffMemberId, staffMembers.id)
    )
    .where(eq(staffMemberGroups.groupId, groupId))
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))
  const [settings] = await db.select().from(institutionSettings).limit(1)
  return {
    period: {
      id: "new",
      groupId,
      startDate: "",
      endDate: "",
      timezone: settings?.timezone ?? "Europe/Copenhagen",
      lifecycle: "preparation",
      currentPublishedVersionId: null,
    },
    group: { id: group.id, name: group.name },
    staff,
    effectiveOpeningSummary: "configured",
    demandSummary: "configured",
    sources: [],
    affectedDates: [],
    inputIssues: [],
    inputsStale: false,
    staffInputs: staff.map((person) => ({
      id: person.id,
      name: `${person.firstName} ${person.lastName}`,
      role: person.role,
      availabilityDates: 0,
      intervalCount: 0,
      href: `/staff/${person.id}`,
    })),
  }
}

async function getPlanningPeriod(
  periodId: string,
  options: { edit?: boolean; version?: number } = {}
): Promise<PeriodViewData | undefined> {
  const record = await readPeriod(periodId)
  if (!record) return undefined
  if (
    !record.currentPublishedVersionId &&
    ["abandoned", "discarded"].includes(record.lifecycle)
  )
    return undefined
  const period = asPeriod(record)
  const inputs = await loadEffectivePlanningInputs(periodId)
  if (!inputs) return undefined
  const effective = composeEffectiveInputs({
    period,
    recurring: inputs.recurring,
    openingReplacements: inputs.openingReplacements,
    requirementReplacements: inputs.requirementReplacements,
    unavailability: inputs.unavailability,
    events: inputs.events,
    commitments: inputs.commitments,
    replacedVersionId: period.currentPublishedVersionId ?? undefined,
    sourceReferences: inputs.sourceReferences,
  })
  const versions = await db
    .select()
    .from(planningPublishedVersions)
    .where(eq(planningPublishedVersions.periodId, periodId))
    .orderBy(desc(planningPublishedVersions.versionNumber))
  const requestedVersion = options.version
    ? versions.find((item) => item.versionNumber === options.version)
    : undefined
  const version =
    requestedVersion ??
    versions.find((item) => item.id === period.currentPublishedVersionId)
  const draft =
    !requestedVersion && (options.edit || !period.currentPublishedVersionId)
      ? await getDraftForPeriod(periodId)
      : undefined
  const versionInput = version?.inputSnapshot as EffectiveInputs | undefined
  const versionDisplay = version?.displaySnapshot as
    | { staff?: PlanningStaff[]; aiNotes?: string[] }
    | undefined
  const displayEffective =
    !draft && versionInput?.days ? versionInput : effective
  const draftRows = draft ? await getDraftShifts(draft.id) : []
  let rows: PlanningShift[] = []
  let staff: PlanningStaff[] =
    !draft && version
      ? (versionDisplay?.staff ?? displayEffective.staff)
      : effective.staff
  if (draft) rows = draftRows.map((row) => shiftFromRow(row, period.groupId))
  else if (version) {
    const publishedRows = await db
      .select()
      .from(planningPublishedVersionShifts)
      .where(eq(planningPublishedVersionShifts.versionId, version.id))
    rows = publishedRows.map((row) =>
      shiftFromRow(
        {
          id: row.shiftId,
          staffMemberId: row.staffMemberId ?? `snapshot-${row.shiftId}`,
          actualDate: row.actualDate,
          startTime: row.startTime,
          endTime: row.endTime,
        },
        period.groupId
      )
    )
    const byId = new Map(staff.map((person) => [person.id, person]))
    for (const row of publishedRows) {
      const id = row.staffMemberId ?? `snapshot-${row.shiftId}`
      if (!byId.has(id))
        byId.set(id, {
          id,
          firstName: row.staffFirstName,
          lastName: row.staffLastName,
          role: row.staffRole,
          active: false,
          maxHoursPerWeek: 0,
        })
    }
    staff = [...byId.values()]
  }
  const snapshotValidation = version?.validationSnapshot as {
    issues?: ValidationIssue[]
    warnings?: ValidationIssue[]
  } | null
  const validation =
    draft || !version
      ? validateDatedSchedule({
          period,
          effectiveInputs: effective,
          shifts: rows,
        })
      : {
          valid: !snapshotValidation?.issues?.length,
          issues: snapshotValidation?.issues ?? [],
          warnings: snapshotValidation?.warnings ?? [],
        }
  const proposalRow = draft
    ? (
        await db
          .select()
          .from(planningProposals)
          .where(
            and(
              eq(planningProposals.draftId, draft.id),
              eq(planningProposals.state, "pending")
            )
          )
          .limit(1)
      )[0]
    : undefined
  let proposal: ProposalView | undefined
  if (proposalRow) {
    const operationRows = await db
      .select()
      .from(planningProposalOperations)
      .where(eq(planningProposalOperations.proposalId, proposalRow.id))
      .orderBy(asc(planningProposalOperations.operationIndex))
    const operations: ProposalView["operations"] = []
    for (const operation of operationRows) {
      if (operation.operation === "create" && operation.afterSnapshot)
        operations.push({
          type: "create",
          shift: operation.afterSnapshot as PlanningShift,
        })
      else if (operation.operation === "delete" && operation.targetShiftId)
        operations.push({ type: "delete", shiftId: operation.targetShiftId })
      else if (operation.operation === "update" && operation.targetShiftId)
        operations.push({
          type: "update",
          shiftId: operation.targetShiftId,
          changes: (operation.afterSnapshot ?? {}) as Partial<
            Omit<PlanningShift, "id">
          >,
        })
    }
    proposal = {
      id: proposalRow.id,
      requestId: proposalRow.requestId,
      periodId,
      groupId: period.groupId,
      baseDraftRevision: proposalRow.draftRevision,
      inputFingerprint: proposalRow.inputFingerprint,
      scope: proposalRow.scope as ProposalView["scope"],
      operations,
      candidate: applyOperations(rows, operations, period.groupId),
      before: rows,
      issues: issuesFrom(proposalRow.afterValidation),
      warnings:
        (proposalRow.afterValidation as { warnings?: ValidationIssue[] } | null)
          ?.warnings ?? [],
      prompt: proposalRow.requestText,
      notes: proposalRow.notes,
      state: proposalRow.state,
    }
  }
  const weeklyBudgets = staff.flatMap((person) => {
    const weeks = intersectingIsoWeeks(period.startDate, period.endDate)
    return weeks.map((week) => ({
      week,
      staffId: person.id,
      shiftMinutes: rows
        .filter(
          (shift) =>
            shift.staffId === person.id && isoWeekKey(shift.date) === week
        )
        .reduce(
          (sum, shift) =>
            sum + timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime),
          0
        ),
      attendanceMinutes: displayEffective.events
        .filter(
          (event) =>
            event.participantStaffIds.includes(person.id) &&
            event.countsTowardWeeklyHours &&
            isoWeekKey(event.date) === week
        )
        .reduce(
          (sum, event) =>
            sum + timeToMinutes(event.endTime) - timeToMinutes(event.startTime),
          0
        ),
      externalMinutes: displayEffective.commitments
        .filter(
          (commitment) =>
            commitment.authoritative !== false &&
            commitment.staffId === person.id &&
            isoWeekKey(commitment.date) === week
        )
        .reduce(
          (sum, commitment) =>
            sum +
            timeToMinutes(commitment.endTime) -
            timeToMinutes(commitment.startTime),
          0
        ),
      maxMinutes: person.maxHoursPerWeek * 60,
    }))
  })
  const history = await Promise.all(
    versions.map(async (item) => ({
      version: item.versionNumber,
      publishedAt: item.publishedAt.toISOString(),
      shiftCount: Number(
        (
          await db
            .select({ total: count() })
            .from(planningPublishedVersionShifts)
            .where(eq(planningPublishedVersionShifts.versionId, item.id))
        )[0]?.total ?? 0
      ),
    }))
  )
  let publicationBaseline: PlanningShift[] = []
  if (draft?.basePublishedVersionId) {
    const [baselineVersion] = await db
      .select()
      .from(planningPublishedVersions)
      .where(eq(planningPublishedVersions.id, draft.basePublishedVersionId))
      .limit(1)
    const baselineRows = await db
      .select()
      .from(planningPublishedVersionShifts)
      .where(
        eq(
          planningPublishedVersionShifts.versionId,
          draft.basePublishedVersionId
        )
      )
    const savedShifts =
      (
        baselineVersion?.displaySnapshot as
          | { shifts?: PlanningShift[] }
          | undefined
      )?.shifts ?? []
    publicationBaseline = baselineRows.map((row) =>
      shiftFromRow(
        {
          id: row.shiftId,
          staffMemberId: row.staffMemberId ?? `snapshot-${row.shiftId}`,
          actualDate: row.actualDate,
          startTime: row.startTime,
          endTime: row.endTime,
          locked: savedShifts.find((shift) => shift.id === row.shiftId)?.locked,
        },
        period.groupId
      )
    )
  } else if (draft) {
    const [generation] = await db
      .select()
      .from(planningGenerationRequests)
      .where(
        and(
          eq(planningGenerationRequests.draftId, draft.id),
          eq(planningGenerationRequests.status, "accepted")
        )
      )
      .orderBy(desc(planningGenerationRequests.createdAt))
      .limit(1)
    if (generation) {
      const [attempt] = await db
        .select()
        .from(planningGenerationAttempts)
        .where(eq(planningGenerationAttempts.requestId, generation.requestId))
        .orderBy(desc(planningGenerationAttempts.attemptNumber))
        .limit(1)
      if (attempt?.outputSnapshot)
        publicationBaseline = flattenSchedule(
          attempt.outputSnapshot as DatedSchedule,
          period.groupId
        ).shifts
    }
  }
  const sourceRowsForPeriod = sourceRows(inputs, period, period.groupId)
  const sourceHref = (source: {
    sourceId: string
    sourceType?: string
    ownerId?: string
  }) => {
    const exception = sourceRowsForPeriod.find(
      (item) => item.sourceId === source.sourceId
    )
    if (exception)
      return {
        sourceId: source.sourceId,
        href: exception.href,
        label: exception.description,
      }
    if (
      source.sourceType === "institution_settings" ||
      source.sourceType === "institution_opening_hours"
    )
      return {
        sourceId: source.sourceId,
        href: "/settings/opening-hours",
        label: "Opening hours",
      }
    if (
      source.sourceType === "group" ||
      source.sourceType === "group_staff_rules"
    )
      return {
        sourceId: source.sourceId,
        href: `/groups/${period.groupId}`,
        label: record.group.name,
      }
    if (
      source.sourceType === "staff" ||
      source.sourceType === "staff_availability" ||
      source.sourceType === "staff_membership"
    ) {
      const person = effective.staff.find((item) => item.id === source.ownerId)
      return {
        sourceId: source.sourceId,
        href: `/staff/${source.ownerId}`,
        label: person ? `${person.firstName} ${person.lastName}` : undefined,
      }
    }
    if (source.sourceType === "published_version")
      return {
        sourceId: source.sourceId,
        href: `/planning/periods/${source.ownerId}`,
        label: "Published commitment",
      }
    return undefined
  }
  const sourceLinks = [
    ...new Map(
      (effective.sourceReferences ?? [])
        .map(sourceHref)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => [`${item.sourceId}:${item.href}`, item])
    ).values(),
  ]
  const sourceKey = (source: { sourceId: string; sourceType?: string }) =>
    `${source.sourceType ?? "source"}:${source.sourceId}`
  const priorSources = new Map(
    (
      (
        (draft?.inputSnapshot ?? version?.inputSnapshot) as {
          sourceReferences?: Array<{
            sourceId: string
            sourceRevision: string | number
            sourceType?: string
            ownerId?: string
          }>
        } | null
      )?.sourceReferences ?? []
    ).map((source) => [sourceKey(source), source])
  )
  const currentSources = new Map(
    (effective.sourceReferences ?? []).map((source) => [
      sourceKey(source),
      source,
    ])
  )
  const changedIds = new Set<string>()
  for (const [id, current] of currentSources)
    if (
      String(priorSources.get(id)?.sourceRevision ?? "") !==
      String(current.sourceRevision)
    )
      changedIds.add(id)
  for (const id of priorSources.keys())
    if (!currentSources.has(id)) changedIds.add(id)
  const sourceChanges = [...changedIds].map((key) => {
    const source = currentSources.get(key) ?? priorSources.get(key)!
    const linked = sourceHref(source)
    return {
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      description:
        linked?.label ?? `${source.sourceType ?? "Source"} ${source.sourceId}`,
      href: linked?.href,
    }
  })
  return {
    period,
    group: versionInput?.group ?? record.group,
    staff,
    shifts: rows,
    events: displayEffective.events,
    issues: validation.issues,
    warnings: validation.warnings ?? [],
    draftRevision: draft?.revision ?? 1,
    draftState: draft?.state ?? "editing",
    publishedVersion: version?.versionNumber,
    proposal,
    weeklyBudgets,
    history,
    readOnly: !draft,
    reviewedFingerprint:
      draft?.inputFingerprint ??
      version?.inputFingerprint ??
      effective.fingerprint,
    expectedBaseVersionId: period.currentPublishedVersionId ?? null,
    effectiveFingerprint: effective.fingerprint,
    inputsStale: Boolean(
      draft?.inputFingerprint &&
      draft.inputFingerprint !== effective.fingerprint
    ),
    aiNotes: draft?.aiNotes ?? versionDisplay?.aiNotes ?? [],
    sourceChanges,
    sourceLinks,
    publicationChanges: diffShifts(publicationBaseline, rows),
    undoAvailable: Boolean(
      draft?.undoSnapshot && draft.undoRevision === draft.revision
    ),
    coverageSegments: coverageSegments(
      displayEffective,
      rows,
      validation.issues
    ),
    calendarDays: displayEffective.days.map((day) => ({
      date: day.date,
      openingIntervals: day.openingIntervals,
      demandSegments: day.demandSegments.map((segment) => ({
        startTime: segment.startTime,
        endTime: segment.endTime,
        minStaff: segment.minStaff,
        minPedagogs: segment.minPedagogs,
        sourceIds: [
          ...segment.openingSourceIds,
          ...segment.ruleSourceIds,
          ...(segment.replacementSourceId ? [segment.replacementSourceId] : []),
        ],
      })),
      availability: day.availability,
    })),
  }
}

const exceptionKind = (
  type: (typeof planningExceptions.$inferSelect)["type"]
): PlanningExceptionSummary["kind"] =>
  type === "closed_date"
    ? "closure"
    : type === "opening_replacement"
      ? "opening"
      : type === "staffing_replacement"
        ? "staffing"
        : type === "partial_unavailability"
          ? "unavailability"
          : type

async function getOwnerPlanningExceptions(
  ownerType: "institution" | "group" | "staff",
  ownerId: string
): Promise<PlanningExceptionSummary[]> {
  const predicate =
    ownerType === "institution"
      ? eq(planningExceptions.institutionId, Number(ownerId))
      : ownerType === "group"
        ? eq(planningExceptions.groupId, ownerId)
        : eq(planningExceptions.staffMemberId, ownerId)
  const rows = await db
    .select()
    .from(planningExceptions)
    .where(predicate)
    .orderBy(
      desc(planningExceptions.startDate),
      desc(planningExceptions.createdAt)
    )
  if (!rows.length) return []
  const intervals = await db
    .select()
    .from(planningExceptionIntervals)
    .where(
      or(
        ...rows.map((row) => eq(planningExceptionIntervals.exceptionId, row.id))
      )
    )
  const participants = await db
    .select()
    .from(planningExceptionParticipants)
    .where(
      or(
        ...rows.map((row) =>
          eq(planningExceptionParticipants.exceptionId, row.id)
        )
      )
    )
  return rows.map((row) => ({
    id: row.id,
    revision: row.sourceRevision,
    ownerType,
    ownerId,
    kind: exceptionKind(row.type),
    date: row.startDate,
    endDate: row.endDate,
    startTime: clock(row.startTime) || undefined,
    endTime: clock(row.endTime) || undefined,
    description: row.reason ?? undefined,
    participantStaffIds: participants
      .filter((item) => item.exceptionId === row.id)
      .map((item) => item.staffMemberId),
    countsTowardWeeklyHours: row.countsTowardWeeklyHours,
    openingIntervals: intervals
      .filter((item) => item.exceptionId === row.id)
      .map((item) => ({
        startTime: clock(item.startTime),
        endTime: clock(item.endTime),
      })),
    minStaff: row.minStaff ?? undefined,
    minPedagogs: row.minPedagogs ?? undefined,
  }))
}

async function getPlanningException(exceptionId: string) {
  const [row] = await db
    .select()
    .from(planningExceptions)
    .where(eq(planningExceptions.id, exceptionId))
    .limit(1)
  if (!row) return undefined
  const ownerId =
    row.ownerType === "institution"
      ? String(row.institutionId)
      : row.ownerType === "group"
        ? row.groupId!
        : row.staffMemberId!
  return (await getOwnerPlanningExceptions(row.ownerType, ownerId)).find(
    (item) => item.id === exceptionId
  )
}

export {
  getNewPreparation,
  getOwnerPlanningExceptions,
  getPlanningException,
  getPlanningGroup,
  getPlanningOverview,
  getPlanningPeriod,
  getPreparation,
}
