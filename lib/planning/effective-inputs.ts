import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import { calculateGroupCapacityShortfall } from "@/lib/groups"
import {
  dayOfWeek,
  enumerateDates,
  intersectingIsoWeeks,
  intervalsOverlap,
  isValidDate,
  isValidTimeInterval,
  isoWeekKey,
  minutesToTime,
  subtractIntervals,
  timeToMinutes,
} from "@/lib/planning/dates"
import type {
  EffectiveAvailabilityInterval,
  EffectiveDay,
  EffectiveInputs,
  EffectiveOpeningInterval,
  GroupRequirementReplacement,
  OpeningReplacement,
  PlanningEvent,
  PlanningPeriod,
  PlanningStaff,
  PublishedCommitment,
  RawRecurringInput,
  SourceReference,
  StaffingDemandSegment,
  StaffUnavailability,
  TimeInterval,
  ValidationIssue,
} from "@/lib/planning/contracts"

type ComposeEffectiveInputsOptions = {
  period: PlanningPeriod
  recurring: RawRecurringInput | ScheduleInput
  openingReplacements?: OpeningReplacement[]
  requirementReplacements?: GroupRequirementReplacement[]
  unavailability?: StaffUnavailability[]
  events?: PlanningEvent[]
  commitments?: PublishedCommitment[]
  /** Exclude the version being revised, while retaining other published work. */
  replacedVersionId?: string
  sourceReferences?: SourceReference[]
}

function sourceFor(
  id: string,
  sourceType: string,
  ownerId?: string
): SourceReference {
  return { sourceId: id, sourceType, ownerId }
}

function relevantDate(date: string, period: PlanningPeriod): boolean {
  return isValidDate(date) && date >= period.startDate && date <= period.endDate
}

function validateIntervals(
  issues: ValidationIssue[],
  intervals: TimeInterval[],
  context: string
): void {
  for (const interval of intervals) {
    if (!isValidTimeInterval(interval)) {
      issues.push({
        code: "invalid_time",
        severity: "error",
        message: `${context} must have an end time after its start time.`,
        startTime: interval.startTime,
        endTime: interval.endTime,
      })
    }
  }
}

function overlapping<T extends TimeInterval>(items: T[]): [T, T][] {
  const valid = items.filter(isValidTimeInterval)
  const result: [T, T][] = []
  for (let index = 0; index < valid.length; index += 1) {
    for (let other = index + 1; other < valid.length; other += 1) {
      if (intervalsOverlap(valid[index], valid[other]))
        result.push([valid[index], valid[other]])
    }
  }
  return result
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return "undefined"
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(",")}}`
}

function sorted<T>(items: T[]): T[] {
  return items.toSorted((left, right) =>
    stableSerialize(left).localeCompare(stableSerialize(right))
  )
}

function fingerprintEffectiveInputs(
  inputs: Omit<EffectiveInputs, "fingerprint" | "issues"> | EffectiveInputs
): string {
  const coreSourceTypes = new Set([
    "institution_settings",
    "institution_opening_hours",
    "group",
    "group_staff_rules",
    "staff",
    "staff_availability",
    "staff_membership",
    "published_version",
  ])
  const relevantSourceIds = new Set<string>([
    ...(inputs.events ?? []).map((event) => event.id),
    ...(inputs.unavailability ?? []).map((absence) => absence.id),
    ...(inputs.days ?? []).flatMap(
      (day) => day.openingReplacementSourceIds ?? []
    ),
    ...(inputs.days ?? []).flatMap((day) =>
      day.openingIntervals.flatMap((interval) =>
        interval.source?.sourceId ? [interval.source.sourceId] : []
      )
    ),
    ...(inputs.days ?? []).flatMap((day) =>
      day.demandSegments.flatMap((segment) => [
        ...segment.openingSourceIds,
        ...segment.ruleSourceIds,
        ...(segment.replacementSourceId ? [segment.replacementSourceId] : []),
      ])
    ),
  ])
  const period = inputs.period
    ? {
        groupId: inputs.period.groupId,
        startDate: inputs.period.startDate,
        endDate: inputs.period.endDate,
        timezone: inputs.period.timezone,
      }
    : undefined
  const staff = sorted(
    (inputs.staff ?? []).map((member) => ({
      id: member.id,
      role: member.role,
      active: member.active,
      maxHoursPerWeek: member.maxHoursPerWeek,
    }))
  )
  const days = sorted(
    (inputs.days ?? []).map((day) => ({
      date: day.date,
      openingIntervals: sorted(
        day.openingIntervals.map((interval) => ({
          startTime: interval.startTime,
          endTime: interval.endTime,
          sourceId: interval.source?.sourceId,
          sourceRevision: interval.source?.sourceRevision,
        }))
      ),
      demandSegments: sorted(day.demandSegments),
      availability: sorted(
        day.availability.map((interval) => ({
          staffId: interval.staffId,
          date: interval.date,
          startTime: interval.startTime,
          endTime: interval.endTime,
          sourceIds: sorted(
            (interval.sources ?? []).map((source) => source.sourceId)
          ),
        }))
      ),
      openingReplacementSourceIds: sorted(
        day.openingReplacementSourceIds ?? []
      ),
    }))
  )
  const commitments = sorted(
    (inputs.commitments ?? [])
      .filter((commitment) => commitment.authoritative !== false)
      .map((commitment) => ({
        id: commitment.id,
        staffId: commitment.staffId,
        date: commitment.date,
        startTime: commitment.startTime,
        endTime: commitment.endTime,
        sourceGroupId: commitment.sourceGroupId,
        sourcePeriodId: commitment.sourcePeriodId,
        versionId: commitment.versionId,
      }))
  )
  const events = sorted(
    (inputs.events ?? []).map((event) => ({
      id: event.id,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      ownerType: event.ownerType,
      ownerId: event.ownerId,
      kind: event.kind,
      participantStaffIds: sorted([...new Set(event.participantStaffIds)]),
      countsTowardWeeklyHours: event.countsTowardWeeklyHours,
      sourceRevision: event.sourceRevision,
    }))
  )
  const unavailability = sorted(
    (inputs.unavailability ?? []).map((absence) => ({
      id: absence.id,
      staffId: absence.staffId,
      kind: absence.kind,
      date: absence.date,
      startTime: absence.startTime,
      endTime: absence.endTime,
      sourceRevision: absence.sourceRevision,
    }))
  )
  const sourceReferences = sorted(
    (inputs.sourceReferences ?? [])
      .filter(
        (source) =>
          relevantSourceIds.has(source.sourceId) ||
          (source.sourceType !== undefined &&
            coreSourceTypes.has(source.sourceType))
      )
      .map((source) => ({
        sourceId: source.sourceId,
        sourceRevision: source.sourceRevision,
        sourceType: source.sourceType,
        ownerId: source.ownerId,
      }))
  )
  const serialized = stableSerialize({
    groupId: inputs.group.id,
    period,
    timezone: inputs.timezone,
    staff,
    days,
    commitments,
    events,
    unavailability,
    sourceReferences,
  })
  return `v2-${serialized}`
}

function composeEffectiveInputs(
  options: ComposeEffectiveInputsOptions
): EffectiveInputs {
  const { period, recurring } = options
  const issues: ValidationIssue[] = []
  let dates: string[] = []
  let periodWeeks = new Set<string>()
  try {
    dates = enumerateDates(period.startDate, period.endDate)
    if (period.startDate > period.endDate) {
      issues.push({
        code: "invalid_period_range",
        severity: "error",
        message: "Planning period end date must be on or after its start date.",
      })
    } else {
      periodWeeks = new Set(
        intersectingIsoWeeks(period.startDate, period.endDate)
      )
    }
  } catch {
    issues.push({
      code: "invalid_date",
      severity: "error",
      message: "Planning period must use valid ISO calendar dates.",
    })
  }

  const staff: PlanningStaff[] = recurring.staff.map((entry) => ({
    ...entry,
    availability: entry.availability.map((availability) => ({
      startTime: availability.startAvailabilityTime,
      endTime: availability.endAvailabilityTime,
      dayOfWeek: availability.dayOfWeek,
    })),
  }))
  const staffIds = new Set(staff.map((entry) => entry.id))
  const capacity = calculateGroupCapacityShortfall(recurring.rules, staff)
  if (capacity.totalShortfallHours > 0) {
    issues.push({
      code: "group_capacity_shortfall",
      severity: "warning",
      message: `Recurring weekly staffing demand exceeds linked active staff capacity by ${capacity.totalShortfallHours} hours.`,
      details: capacity,
    })
  }
  if (capacity.pedagogShortfallHours > 0) {
    issues.push({
      code: "group_pedagog_capacity_shortfall",
      severity: "warning",
      message: `Recurring weekly pedagog demand exceeds linked active pedagog capacity by ${capacity.pedagogShortfallHours} hours.`,
      details: capacity,
    })
  }
  validateIntervals(issues, recurring.openingHours, "Opening interval")
  validateIntervals(issues, recurring.rules, "Staffing rule")
  for (const [index, rule] of recurring.rules.entries()) {
    if (!isValidTimeInterval(rule)) continue
    const fitsOrdinaryOpening = recurring.openingHours.some(
      (opening) =>
        opening.dayOfWeek === rule.dayOfWeek &&
        isValidTimeInterval(opening) &&
        timeToMinutes(opening.startTime) <= timeToMinutes(rule.startTime) &&
        timeToMinutes(opening.endTime) >= timeToMinutes(rule.endTime)
    )
    if (!fitsOrdinaryOpening) {
      issues.push({
        code: "staffing_rule_outside_opening_hours",
        severity: "error",
        message:
          "Each recurring staffing rule must fit within one ordinary opening interval.",
        startTime: rule.startTime,
        endTime: rule.endTime,
        ruleIds: [`rule:${rule.dayOfWeek}:${index}`],
      })
    }
  }

  const openingReplacements = (options.openingReplacements ?? []).filter(
    (replacement) => relevantDate(replacement.date, period)
  )
  for (const replacement of openingReplacements) {
    validateIntervals(issues, replacement.intervals, "Opening replacement")
    for (const [left, right] of overlapping(replacement.intervals)) {
      issues.push({
        code: "conflicting_replacement",
        severity: "error",
        message: "Opening replacement intervals overlap.",
        date: replacement.date,
        startTime: left.startTime,
        endTime: right.endTime,
        sourceIds: [replacement.id],
      })
    }
  }
  for (const date of new Set(
    openingReplacements.map((replacement) => replacement.date)
  )) {
    const sameDate = openingReplacements.filter(
      (replacement) => replacement.date === date
    )
    if (sameDate.length > 1) {
      issues.push({
        code: "conflicting_replacement",
        severity: "error",
        message:
          "A date cannot have more than one institution opening replacement.",
        date,
        sourceIds: sameDate.map((replacement) => replacement.id),
      })
    }
  }

  const requirementReplacements = (
    options.requirementReplacements ?? []
  ).filter(
    (replacement) =>
      replacement.groupId === period.groupId &&
      relevantDate(replacement.date, period)
  )
  for (const replacement of requirementReplacements)
    validateIntervals(issues, [replacement], "Staffing replacement")
  for (let index = 0; index < requirementReplacements.length; index += 1) {
    for (
      let other = index + 1;
      other < requirementReplacements.length;
      other += 1
    ) {
      const left = requirementReplacements[index]
      const right = requirementReplacements[other]
      if (
        left.date === right.date &&
        isValidTimeInterval(left) &&
        isValidTimeInterval(right) &&
        intervalsOverlap(left, right)
      ) {
        issues.push({
          code: "conflicting_replacement",
          severity: "error",
          message:
            "Overlapping dated staffing replacements conflict and must be resolved.",
          date: left.date,
          startTime: left.startTime,
          endTime: left.endTime,
          sourceIds: [left.id, right.id],
        })
      }
    }
  }

  const relevantUnavailability = (options.unavailability ?? []).filter(
    (absence) =>
      staffIds.has(absence.staffId) && relevantDate(absence.date, period)
  )
  for (const absence of relevantUnavailability)
    validateIntervals(issues, [absence], "Staff unavailability")

  const eventByKey = new Map<string, PlanningEvent>()
  for (const event of options.events ?? []) {
    if (!isValidDate(event.date) || !periodWeeks.has(isoWeekKey(event.date)))
      continue
    const participantStaffIds = [
      ...new Set(
        Array.isArray(event.participantStaffIds)
          ? event.participantStaffIds.filter((staffId) => staffIds.has(staffId))
          : []
      ),
    ]
    if (participantStaffIds.length === 0) continue
    const normalized = { ...event, participantStaffIds }
    const key = `${event.id}:${event.date}`
    const existing = eventByKey.get(key)
    if (existing && stableSerialize(existing) !== stableSerialize(normalized)) {
      issues.push({
        code: "invalid_event",
        severity: "error",
        message: "The same event/date was loaded with conflicting details.",
        date: event.date,
        sourceIds: [event.id],
      })
      continue
    }
    eventByKey.set(key, normalized)
  }
  const linkedEvents = [...eventByKey.values()]
  for (const event of linkedEvents) {
    validateIntervals(issues, [event], "Event")
    if (
      !event.id ||
      !event.ownerId ||
      !["institution", "group", "staff"].includes(event.ownerType)
    ) {
      issues.push({
        code: "invalid_owner",
        severity: "error",
        message: "Event must have a valid typed owner.",
        date: event.date,
        sourceIds: [event.id],
      })
    }
    if (
      !Array.isArray(event.participantStaffIds) ||
      event.participantStaffIds.length === 0 ||
      typeof event.countsTowardWeeklyHours !== "boolean"
    ) {
      issues.push({
        code: "invalid_event",
        severity: "error",
        message:
          "Event must have participants and an explicit weekly-hours setting.",
        date: event.date,
        sourceIds: [event.id],
      })
    }
    if (
      event.ownerType === "staff" &&
      staffIds.has(event.ownerId) &&
      !event.participantStaffIds.includes(event.ownerId)
    ) {
      issues.push({
        code: "invalid_participant",
        severity: "error",
        message:
          "An individual staff event must include its owner as the participant.",
        date: event.date,
        staffId: event.ownerId,
        sourceIds: [event.id],
      })
    }
  }
  for (let index = 0; index < linkedEvents.length; index += 1) {
    for (let other = index + 1; other < linkedEvents.length; other += 1) {
      const left = linkedEvents[index]
      const right = linkedEvents[other]
      if (
        left.date !== right.date ||
        !left.countsTowardWeeklyHours ||
        !right.countsTowardWeeklyHours ||
        !isValidTimeInterval(left) ||
        !isValidTimeInterval(right) ||
        !intervalsOverlap(left, right)
      )
        continue
      for (const staffId of left.participantStaffIds.filter((participant) =>
        right.participantStaffIds.includes(participant)
      )) {
        issues.push({
          code: "overlapping_counted_event",
          severity: "error",
          message: "Counted event attendance overlaps for a participant.",
          date: left.date,
          startTime: minutesToTime(
            Math.max(
              timeToMinutes(left.startTime),
              timeToMinutes(right.startTime)
            )
          ),
          endTime: minutesToTime(
            Math.min(timeToMinutes(left.endTime), timeToMinutes(right.endTime))
          ),
          staffId,
          sourceIds: [left.id, right.id],
        })
      }
    }
  }

  const commitmentByKey = new Map<string, PublishedCommitment>()
  for (const commitment of options.commitments ?? []) {
    if (
      !staffIds.has(commitment.staffId) ||
      !isValidDate(commitment.date) ||
      !periodWeeks.has(isoWeekKey(commitment.date)) ||
      (options.replacedVersionId !== undefined &&
        commitment.versionId === options.replacedVersionId)
    )
      continue
    if (!isValidTimeInterval(commitment)) {
      if (commitment.authoritative !== false) {
        issues.push({
          code: "invalid_shift_time",
          severity: "error",
          message:
            "Published commitment end time must be after its start time.",
          date: commitment.date,
          startTime: commitment.startTime,
          endTime: commitment.endTime,
          staffId: commitment.staffId,
          shiftId: commitment.id,
        })
      }
      continue
    }
    const key = [
      commitment.versionId,
      commitment.sourcePeriodId,
      commitment.id,
      commitment.staffId,
      commitment.date,
      commitment.startTime,
      commitment.endTime,
    ].join(":")
    commitmentByKey.set(key, commitment)
  }
  const commitments = [...commitmentByKey.values()]
  const days: EffectiveDay[] = []

  for (const date of dates) {
    const weekday = dayOfWeek(date)
    const datedOpening = openingReplacements.filter(
      (replacement) => replacement.date === date
    )
    const recurringOpening: EffectiveOpeningInterval[] = recurring.openingHours
      .map((interval, index) => ({ interval, index }))
      .filter(
        ({ interval }) =>
          interval.dayOfWeek === weekday && isValidTimeInterval(interval)
      )
      .map(({ interval, index }) => ({
        startTime: interval.startTime,
        endTime: interval.endTime,
        source: sourceFor(`opening:${weekday}:${index}`, "institution-opening"),
      }))
    const openingIntervals =
      datedOpening.length > 0
        ? datedOpening.flatMap((replacement) =>
            replacement.intervals
              .filter(isValidTimeInterval)
              .map((interval) => ({
                ...interval,
                source:
                  interval.source ??
                  replacement.source ??
                  sourceFor(
                    replacement.id,
                    "opening-replacement",
                    replacement.institutionId
                  ),
              }))
          )
        : recurringOpening
    const dateRules = recurring.rules
      .map((rule, index) => ({
        rule,
        sourceId: `rule:${rule.dayOfWeek}:${index}`,
      }))
      .filter(
        ({ rule }) => rule.dayOfWeek === weekday && isValidTimeInterval(rule)
      )
    const replacements = requirementReplacements.filter(
      (replacement) =>
        replacement.date === date && isValidTimeInterval(replacement)
    )
    const boundaries = new Set<number>()
    for (const opening of openingIntervals) {
      boundaries.add(timeToMinutes(opening.startTime))
      boundaries.add(timeToMinutes(opening.endTime))
    }
    for (const { rule } of dateRules) {
      boundaries.add(timeToMinutes(rule.startTime))
      boundaries.add(timeToMinutes(rule.endTime))
    }
    for (const replacement of replacements) {
      boundaries.add(timeToMinutes(replacement.startTime))
      boundaries.add(timeToMinutes(replacement.endTime))
    }
    const sortedBoundaries = [...boundaries].sort((left, right) => left - right)
    const demandSegments: StaffingDemandSegment[] = []
    for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
      const start = sortedBoundaries[index]
      const end = sortedBoundaries[index + 1]
      const openingSources = openingIntervals.filter(
        (opening) =>
          timeToMinutes(opening.startTime) <= start &&
          timeToMinutes(opening.endTime) >= end
      )
      if (openingSources.length === 0) continue
      const activeReplacements = replacements.filter(
        (replacement) =>
          timeToMinutes(replacement.startTime) <= start &&
          timeToMinutes(replacement.endTime) >= end
      )
      const activeRules = dateRules.filter(
        ({ rule }) =>
          timeToMinutes(rule.startTime) <= start &&
          timeToMinutes(rule.endTime) >= end
      )
      const replacement = activeReplacements[0]
      const minStaff =
        replacement?.minStaff ??
        (activeRules.length
          ? Math.max(...activeRules.map(({ rule }) => rule.minStaff))
          : 0)
      const minPedagogs =
        replacement?.minPedagogs ??
        (activeRules.length
          ? Math.max(...activeRules.map(({ rule }) => rule.minPedagogs))
          : 0)
      if (minStaff === 0 && minPedagogs === 0) continue
      demandSegments.push({
        date,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        minStaff,
        minPedagogs,
        openingSourceIds: openingSources.map(
          (opening) => opening.source?.sourceId ?? "opening"
        ),
        ruleSourceIds: activeRules.map(({ sourceId }) => sourceId),
        replacementSourceId: replacement?.id,
        suppressedRuleSourceIds: replacement
          ? activeRules.map(({ sourceId }) => sourceId)
          : [],
      })
    }
    for (const replacement of replacements) {
      const fitsOpening = openingIntervals.some(
        (opening) =>
          timeToMinutes(opening.startTime) <=
            timeToMinutes(replacement.startTime) &&
          timeToMinutes(opening.endTime) >= timeToMinutes(replacement.endTime)
      )
      if (!fitsOpening) {
        issues.push({
          code: "staffing_rule_outside_opening_hours",
          severity: "error",
          message:
            "Dated staffing replacement must fit one effective institution opening interval.",
          date,
          startTime: replacement.startTime,
          endTime: replacement.endTime,
          sourceIds: [
            replacement.id,
            ...datedOpening.map((opening) => opening.id),
          ],
        })
      }
    }

    const availability: EffectiveAvailabilityInterval[] = []
    for (const member of staff) {
      const recurringAvailability = (member.availability ?? []).filter(
        (entry) => entry.dayOfWeek === weekday && isValidTimeInterval(entry)
      )
      const blocked = [
        ...relevantUnavailability.filter(
          (absence) =>
            absence.staffId === member.id &&
            absence.date === date &&
            isValidTimeInterval(absence)
        ),
        ...linkedEvents.filter(
          (event) =>
            event.date === date &&
            event.participantStaffIds.includes(member.id) &&
            isValidTimeInterval(event)
        ),
        ...commitments.filter(
          (commitment) =>
            commitment.authoritative !== false &&
            commitment.date === date &&
            commitment.staffId === member.id
        ),
      ]
      for (const interval of recurringAvailability) {
        for (const result of subtractIntervals(interval, blocked)) {
          availability.push({
            ...result,
            staffId: member.id,
            date,
            sources: blocked.map(
              (entry) =>
                ("source" in entry ? entry.source : undefined) ??
                sourceFor(entry.id, "planning-constraint")
            ),
          })
        }
      }
    }
    days.push({
      date,
      dayOfWeek: weekday,
      openingIntervals,
      demandSegments,
      availability,
      openingReplacementSourceIds: datedOpening.map(
        (replacement) => replacement.id
      ),
    })
  }

  const base = {
    group: recurring.group,
    period,
    timezone: period.timezone,
    staff,
    days,
    commitments,
    events: linkedEvents,
    unavailability: relevantUnavailability,
    demand: days.flatMap((day) => day.demandSegments),
    sourceReferences: options.sourceReferences,
  }
  return { ...base, fingerprint: fingerprintEffectiveInputs(base), issues }
}

function summarizeChangedSources(
  previous: EffectiveInputs,
  current: EffectiveInputs
) {
  if (previous.fingerprint === current.fingerprint) {
    return { changed: false, changedDates: [], sourceIds: [] }
  }
  const changedDates = new Set<string>()
  const sourceIds = new Set<string>()
  const previousDays = new Map(
    previous.days.map((day) => [day.date, stableSerialize(day)])
  )
  const currentDays = new Map(
    current.days.map((day) => [day.date, stableSerialize(day)])
  )
  for (const date of new Set([...previousDays.keys(), ...currentDays.keys()])) {
    if (previousDays.get(date) !== currentDays.get(date)) changedDates.add(date)
  }
  const entityValues = (inputs: EffectiveInputs) => [
    ...(inputs.events ?? []).map((event) => ({
      id: event.id,
      date: event.date,
      value: stableSerialize(event),
    })),
    ...(inputs.unavailability ?? []).map((absence) => ({
      id: absence.id,
      date: absence.date,
      value: stableSerialize(absence),
    })),
    ...(inputs.commitments ?? [])
      .filter((commitment) => commitment.authoritative !== false)
      .map((commitment) => ({
        id: commitment.id,
        date: commitment.date,
        value: stableSerialize(commitment),
      })),
  ]
  const previousEntities = new Map(
    entityValues(previous).map((entry) => [`${entry.id}:${entry.date}`, entry])
  )
  const currentEntities = new Map(
    entityValues(current).map((entry) => [`${entry.id}:${entry.date}`, entry])
  )
  for (const key of new Set([
    ...previousEntities.keys(),
    ...currentEntities.keys(),
  ])) {
    const before = previousEntities.get(key)
    const after = currentEntities.get(key)
    if (before?.value !== after?.value) {
      changedDates.add(after?.date ?? before!.date)
      sourceIds.add(after?.id ?? before!.id)
    }
  }
  const staffValue = (staff: PlanningStaff) =>
    stableSerialize({
      id: staff.id,
      role: staff.role,
      active: staff.active,
      maxHoursPerWeek: staff.maxHoursPerWeek,
    })
  const previousStaff = new Map(
    previous.staff.map((staff) => [staff.id, staffValue(staff)])
  )
  const currentStaff = new Map(
    current.staff.map((staff) => [staff.id, staffValue(staff)])
  )
  for (const staffId of new Set([
    ...previousStaff.keys(),
    ...currentStaff.keys(),
  ])) {
    if (previousStaff.get(staffId) !== currentStaff.get(staffId)) {
      sourceIds.add(staffId)
      for (const day of current.days) changedDates.add(day.date)
    }
  }
  const coreSourceTypes = new Set([
    "institution_settings",
    "institution_opening_hours",
    "group",
    "group_staff_rules",
    "staff",
    "staff_availability",
    "staff_membership",
    "published_version",
  ])
  for (const source of current.sourceReferences ?? []) {
    if (
      !(previous.sourceReferences ?? []).some(
        (old) =>
          old.sourceId === source.sourceId &&
          old.sourceRevision === source.sourceRevision
      )
    ) {
      sourceIds.add(source.sourceId)
      if (source.sourceType && coreSourceTypes.has(source.sourceType))
        for (const day of current.days) changedDates.add(day.date)
    }
  }
  for (const source of previous.sourceReferences ?? []) {
    if (
      !(current.sourceReferences ?? []).some(
        (next) =>
          next.sourceId === source.sourceId &&
          next.sourceRevision === source.sourceRevision
      )
    ) {
      sourceIds.add(source.sourceId)
      if (source.sourceType && coreSourceTypes.has(source.sourceType))
        for (const day of current.days) changedDates.add(day.date)
    }
  }
  return {
    changed: true,
    changedDates: [...changedDates].sort(),
    sourceIds: [...sourceIds].sort(),
  }
}

export {
  composeEffectiveInputs,
  fingerprintEffectiveInputs,
  summarizeChangedSources,
}
export type { ComposeEffectiveInputsOptions }
