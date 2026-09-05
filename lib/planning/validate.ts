import {
  enumerateDates,
  intersectingIsoWeeks,
  intervalsOverlap,
  isValidDate,
  isValidTimeInterval,
  isoWeekKey,
  minutesToTime,
  timeToMinutes,
} from "@/lib/planning/dates"
import type {
  DatedSchedule,
  DatedValidationResult,
  EffectiveInputs,
  PlanningPeriod,
  PlanningShift,
  PublishedCommitment,
  ValidationIssue,
} from "@/lib/planning/contracts"

type ValidateDatedScheduleOptions = {
  period: PlanningPeriod
  effectiveInputs: EffectiveInputs
  shifts: PlanningShift[] | DatedSchedule
  externalCommitments?: PublishedCommitment[]
}

type CheckedShift = {
  shift: PlanningShift
  structural: boolean
  eligibleForCoverage: boolean
}

function issue(
  code: ValidationIssue["code"],
  message: string,
  details: Partial<ValidationIssue> = {}
): ValidationIssue {
  return { code, severity: "error", message, ...details }
}

function flattenSchedule(
  value: PlanningShift[] | DatedSchedule,
  groupId: string
): { shifts: PlanningShift[]; dates: string[] } {
  if (Array.isArray(value))
    return {
      shifts: value,
      dates: [...new Set(value.map((shift) => shift.date))],
    }
  const shifts: PlanningShift[] = []
  const dates: string[] = []
  for (const day of value.days) {
    dates.push(day.date)
    for (const shift of day.shifts) {
      shifts.push({
        id: shift.id,
        staffId: shift.staffId,
        date: day.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        locked: shift.locked ?? false,
        groupId: shift.groupId ?? groupId,
      })
    }
  }
  return { shifts, dates }
}

function validateGeneratedDates(
  period: PlanningPeriod,
  value: DatedSchedule | PlanningShift[]
): ValidationIssue[] {
  if (Array.isArray(value)) return []
  let expectedDates: string[] = []
  try {
    expectedDates = enumerateDates(period.startDate, period.endDate)
  } catch {
    return []
  }
  const expected = new Set(expectedDates)
  const counts = new Map<string, number>()
  for (const day of value.days)
    counts.set(day.date, (counts.get(day.date) ?? 0) + 1)
  const result: ValidationIssue[] = []
  for (const date of expected) {
    if (!counts.has(date))
      result.push(
        issue("missing_date", `Schedule is missing ${date}.`, { date })
      )
  }
  for (const [date, count] of counts) {
    if (!expected.has(date))
      result.push(
        issue(
          "out_of_range_date",
          `Schedule contains ${date}, outside the requested period.`,
          { date }
        )
      )
    if (count > 1)
      result.push(
        issue(
          "duplicate_date",
          `Schedule contains ${count} entries for ${date}.`,
          { date }
        )
      )
  }
  return result
}

function commitmentKey(commitment: PublishedCommitment): string {
  return [
    commitment.versionId,
    commitment.sourcePeriodId,
    commitment.id,
    commitment.staffId,
    commitment.date,
    commitment.startTime,
    commitment.endTime,
  ].join(":")
}

function validateDatedSchedule({
  period,
  effectiveInputs,
  shifts: value,
  externalCommitments = [],
}: ValidateDatedScheduleOptions): DatedValidationResult {
  const result: ValidationIssue[] = [
    ...effectiveInputs.issues,
    ...validateGeneratedDates(period, value),
  ]
  const { shifts } = flattenSchedule(value, period.groupId)
  if (!Array.isArray(value) && value.groupId !== period.groupId) {
    result.push(
      issue(
        "group_id_mismatch",
        `Schedule group ${value.groupId} does not match ${period.groupId}.`
      )
    )
  }
  if (effectiveInputs.group.id !== period.groupId) {
    result.push(
      issue(
        "group_id_mismatch",
        `Effective input group ${effectiveInputs.group.id} does not match ${period.groupId}.`
      )
    )
  }

  const staffById = new Map(
    effectiveInputs.staff.map((staff) => [staff.id, staff])
  )
  const dayByDate = new Map(effectiveInputs.days.map((day) => [day.date, day]))
  const shiftIdCounts = new Map<string, number>()
  for (const shift of shifts)
    shiftIdCounts.set(shift.id, (shiftIdCounts.get(shift.id) ?? 0) + 1)
  for (const [shiftId, count] of shiftIdCounts) {
    if (!shiftId || count > 1) {
      result.push(
        issue(
          "duplicate_shift_id",
          "Every shift must have a non-empty unique stable ID.",
          { shiftId: shiftId || undefined }
        )
      )
    }
  }

  const checked: CheckedShift[] = []
  for (const shift of shifts) {
    const base = {
      date: shift.date,
      staffId: shift.staffId,
      shiftId: shift.id,
      startTime: shift.startTime,
      endTime: shift.endTime,
    }
    let structural = true
    let eligibleForCoverage = true
    const staff = staffById.get(shift.staffId)
    if (!staff) {
      result.push(
        issue(
          "unknown_staff",
          `Shift references unknown staff member ${shift.staffId}.`,
          base
        )
      )
      structural = false
      eligibleForCoverage = false
    } else if (!staff.active) {
      result.push(
        issue(
          "inactive_staff",
          `Shift schedules inactive staff member ${shift.staffId}.`,
          base
        )
      )
      eligibleForCoverage = false
    }
    if (shift.groupId !== undefined && shift.groupId !== period.groupId) {
      result.push(
        issue("group_id_mismatch", "Shift belongs to a different group.", base)
      )
      structural = false
      eligibleForCoverage = false
    }
    if (
      !isValidDate(shift.date) ||
      shift.date < period.startDate ||
      shift.date > period.endDate
    ) {
      result.push(
        issue(
          "out_of_range_date",
          `Shift date ${shift.date} is outside the requested period.`,
          { ...base, date: shift.date }
        )
      )
      structural = false
      eligibleForCoverage = false
    }
    if (!isValidTimeInterval(shift)) {
      result.push(
        issue(
          "invalid_shift_time",
          "Shift end time must be after start time.",
          base
        )
      )
      structural = false
      eligibleForCoverage = false
    }
    if (!shift.id || shiftIdCounts.get(shift.id) !== 1) {
      structural = false
      eligibleForCoverage = false
    }
    const day = dayByDate.get(shift.date)
    if (structural && day) {
      const insideOpening = day.openingIntervals.some(
        (opening) =>
          timeToMinutes(opening.startTime) <= timeToMinutes(shift.startTime) &&
          timeToMinutes(opening.endTime) >= timeToMinutes(shift.endTime)
      )
      if (!insideOpening) {
        result.push(
          issue(
            "shift_outside_opening_hours",
            "Shift must fit one effective institution opening interval.",
            base
          )
        )
        eligibleForCoverage = false
      }
      const insideAvailability = day.availability.some(
        (available) =>
          available.staffId === shift.staffId &&
          timeToMinutes(available.startTime) <=
            timeToMinutes(shift.startTime) &&
          timeToMinutes(available.endTime) >= timeToMinutes(shift.endTime)
      )
      if (!insideAvailability) {
        result.push(
          issue(
            "outside_availability",
            `Shift is outside staff member ${shift.staffId}'s effective availability.`,
            base
          )
        )
        eligibleForCoverage = false
      }
    } else if (structural && !day) {
      result.push(
        issue(
          "invalid_date",
          "Shift date has no corresponding effective input day.",
          base
        )
      )
      structural = false
      eligibleForCoverage = false
    }
    checked.push({ shift, structural, eligibleForCoverage })
  }

  const structuralShifts = checked
    .filter((entry) => entry.structural)
    .map((entry) => entry.shift)
  const shiftsByStaffDate = new Map<string, PlanningShift[]>()
  for (const shift of structuralShifts) {
    const key = `${shift.staffId}:${shift.date}`
    shiftsByStaffDate.set(key, [...(shiftsByStaffDate.get(key) ?? []), shift])
  }
  for (const entries of shiftsByStaffDate.values()) {
    for (let index = 0; index < entries.length; index += 1) {
      for (let other = index + 1; other < entries.length; other += 1) {
        const left = entries[index]
        const right = entries[other]
        if (!intervalsOverlap(left, right)) continue
        result.push(
          issue(
            "overlapping_shift",
            `Shifts overlap for staff member ${right.staffId}.`,
            {
              date: right.date,
              staffId: right.staffId,
              shiftId: right.id,
              startTime: minutesToTime(
                Math.max(
                  timeToMinutes(left.startTime),
                  timeToMinutes(right.startTime)
                )
              ),
              endTime: minutesToTime(
                Math.min(
                  timeToMinutes(left.endTime),
                  timeToMinutes(right.endTime)
                )
              ),
              details: { otherShiftId: left.id },
            }
          )
        )
      }
    }
  }

  const shiftsByDate = new Map<string, PlanningShift[]>()
  for (const shift of structuralShifts)
    shiftsByDate.set(shift.date, [
      ...(shiftsByDate.get(shift.date) ?? []),
      shift,
    ])
  for (const entries of shiftsByDate.values()) {
    for (let index = 0; index < entries.length; index += 1) {
      for (let other = index + 1; other < entries.length; other += 1) {
        const first = entries[index]
        const second = entries[other]
        if (
          first.staffId === second.staffId ||
          first.startTime === second.startTime
        )
          continue
        const earlier =
          timeToMinutes(first.startTime) < timeToMinutes(second.startTime)
            ? first
            : second
        const later = earlier === first ? second : first
        if (timeToMinutes(earlier.endTime) > timeToMinutes(later.endTime)) {
          result.push(
            issue(
              "fifo_end_order_inversion",
              `Staff member ${later.staffId} starts later but ends earlier.`,
              {
                date: later.date,
                staffId: later.staffId,
                shiftId: later.id,
                startTime: later.startTime,
                endTime: later.endTime,
                details: { earlierShiftId: earlier.id },
              }
            )
          )
        }
      }
    }
  }

  const commitmentByKey = new Map<string, PublishedCommitment>()
  for (const commitment of [
    ...effectiveInputs.commitments,
    ...externalCommitments,
  ]) {
    if (!isValidDate(commitment.date) || !isValidTimeInterval(commitment))
      continue
    commitmentByKey.set(commitmentKey(commitment), commitment)
  }
  const commitments = [...commitmentByKey.values()].filter(
    (commitment) => commitment.authoritative !== false
  )
  const advisoryCommitments = [...commitmentByKey.values()].filter(
    (commitment) => commitment.authoritative === false
  )
  const externallyBlockedShiftIds = new Set<string>()
  for (const shift of structuralShifts) {
    for (const commitment of commitments) {
      if (
        shift.staffId !== commitment.staffId ||
        shift.date !== commitment.date ||
        !intervalsOverlap(shift, commitment)
      )
        continue
      externallyBlockedShiftIds.add(shift.id)
      result.push(
        issue(
          "external_overlap",
          `Shift overlaps an authoritative assignment in group ${commitment.sourceGroupId}.`,
          {
            date: shift.date,
            staffId: shift.staffId,
            shiftId: shift.id,
            startTime: minutesToTime(
              Math.max(
                timeToMinutes(shift.startTime),
                timeToMinutes(commitment.startTime)
              )
            ),
            endTime: minutesToTime(
              Math.min(
                timeToMinutes(shift.endTime),
                timeToMinutes(commitment.endTime)
              )
            ),
            details: {
              sourceGroupId: commitment.sourceGroupId,
              sourcePeriodId: commitment.sourcePeriodId,
              sourceVersionId: commitment.versionId,
              sourceShiftId: commitment.id,
            },
          }
        )
      )
    }
  }
  for (const shift of structuralShifts) {
    for (const commitment of advisoryCommitments) {
      if (
        shift.staffId !== commitment.staffId ||
        shift.date !== commitment.date ||
        !intervalsOverlap(shift, commitment)
      )
        continue
      result.push({
        code: "other_draft_conflict",
        severity: "warning",
        message: `Shift overlaps an unpublished draft in group ${commitment.sourceGroupId}.`,
        date: shift.date,
        staffId: shift.staffId,
        shiftId: shift.id,
        startTime: minutesToTime(
          Math.max(
            timeToMinutes(shift.startTime),
            timeToMinutes(commitment.startTime)
          )
        ),
        endTime: minutesToTime(
          Math.min(
            timeToMinutes(shift.endTime),
            timeToMinutes(commitment.endTime)
          )
        ),
        details: {
          conflictType: "overlap",
          sourceGroupId: commitment.sourceGroupId,
          sourcePeriodId: commitment.sourcePeriodId,
          sourceShiftId: commitment.id,
        },
      })
    }
  }

  let weeks: string[] = []
  try {
    weeks = intersectingIsoWeeks(period.startDate, period.endDate)
  } catch {
    // The effective input issues already describe the invalid period.
  }
  const allByStaffWeek = new Map<string, number>()
  for (const shift of structuralShifts) {
    const key = `${shift.staffId}:${isoWeekKey(shift.date)}`
    allByStaffWeek.set(
      key,
      (allByStaffWeek.get(key) ?? 0) +
        timeToMinutes(shift.endTime) -
        timeToMinutes(shift.startTime)
    )
  }
  for (const commitment of commitments) {
    const week = isoWeekKey(commitment.date)
    if (!weeks.includes(week)) continue
    const key = `${commitment.staffId}:${week}`
    allByStaffWeek.set(
      key,
      (allByStaffWeek.get(key) ?? 0) +
        timeToMinutes(commitment.endTime) -
        timeToMinutes(commitment.startTime)
    )
  }
  const countedAttendance = new Set<string>()
  for (const event of effectiveInputs.events) {
    if (
      !event.countsTowardWeeklyHours ||
      !isValidDate(event.date) ||
      !isValidTimeInterval(event)
    )
      continue
    const week = isoWeekKey(event.date)
    if (!weeks.includes(week)) continue
    for (const staffId of new Set(event.participantStaffIds)) {
      const attendanceKey = `${event.id}:${event.date}:${staffId}`
      if (countedAttendance.has(attendanceKey)) continue
      countedAttendance.add(attendanceKey)
      const key = `${staffId}:${week}`
      allByStaffWeek.set(
        key,
        (allByStaffWeek.get(key) ?? 0) +
          timeToMinutes(event.endTime) -
          timeToMinutes(event.startTime)
      )
    }
  }
  const advisoryByStaffWeek = new Map<
    string,
    {
      minutes: number
      sourceGroupIds: Set<string>
      sourcePeriodIds: Set<string>
    }
  >()
  for (const commitment of advisoryCommitments) {
    const week = isoWeekKey(commitment.date)
    if (!weeks.includes(week)) continue
    const key = `${commitment.staffId}:${week}`
    const aggregate = advisoryByStaffWeek.get(key) ?? {
      minutes: 0,
      sourceGroupIds: new Set<string>(),
      sourcePeriodIds: new Set<string>(),
    }
    aggregate.minutes +=
      timeToMinutes(commitment.endTime) - timeToMinutes(commitment.startTime)
    aggregate.sourceGroupIds.add(commitment.sourceGroupId)
    if (commitment.sourcePeriodId)
      aggregate.sourcePeriodIds.add(commitment.sourcePeriodId)
    advisoryByStaffWeek.set(key, aggregate)
  }
  for (const [key, advisory] of advisoryByStaffWeek) {
    const separator = key.lastIndexOf(":")
    const staffId = key.slice(0, separator)
    const week = key.slice(separator + 1)
    const staff = staffById.get(staffId)
    const committedMinutes = allByStaffWeek.get(key) ?? 0
    if (
      staff &&
      committedMinutes + advisory.minutes > staff.maxHoursPerWeek * 60
    ) {
      result.push({
        code: "other_draft_conflict",
        severity: "warning",
        message: `Unpublished work in another group competes for ${staffId}'s ${week} weekly hours.`,
        staffId,
        details: {
          conflictType: "weekly_hours",
          week,
          committedMinutes,
          advisoryMinutes: advisory.minutes,
          maximumMinutes: staff.maxHoursPerWeek * 60,
          sourceGroupIds: [...advisory.sourceGroupIds],
          sourcePeriodIds: [...advisory.sourcePeriodIds],
        },
      })
    }
  }
  for (const [key, minutes] of allByStaffWeek) {
    const separator = key.lastIndexOf(":")
    const staffId = key.slice(0, separator)
    const week = key.slice(separator + 1)
    const staff = staffById.get(staffId)
    if (staff && minutes > staff.maxHoursPerWeek * 60) {
      result.push(
        issue(
          "max_hours_exceeded",
          `Staff member ${staffId} exceeds the weekly maximum hours.`,
          {
            staffId,
            details: {
              week,
              minutes,
              maximumMinutes: staff.maxHoursPerWeek * 60,
            },
          }
        )
      )
    }
  }

  const coverageEligible = checked
    .filter(
      (entry) =>
        entry.structural &&
        entry.eligibleForCoverage &&
        !externallyBlockedShiftIds.has(entry.shift.id)
    )
    .map((entry) => entry.shift)
  for (const day of effectiveInputs.days) {
    const datedShifts = structuralShifts.filter(
      (shift) => shift.date === day.date
    )
    const datedEligible = coverageEligible.filter(
      (shift) => shift.date === day.date
    )
    for (const demand of day.demandSegments) {
      const demandStart = timeToMinutes(demand.startTime)
      const demandEnd = timeToMinutes(demand.endTime)
      const boundaries = new Set([demandStart, demandEnd])
      for (const shift of datedShifts) {
        const start = timeToMinutes(shift.startTime)
        const end = timeToMinutes(shift.endTime)
        if (start > demandStart && start < demandEnd) boundaries.add(start)
        if (end > demandStart && end < demandEnd) boundaries.add(end)
      }
      const sortedBoundaries = [...boundaries].sort(
        (left, right) => left - right
      )
      for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
        const start = sortedBoundaries[index]
        const end = sortedBoundaries[index + 1]
        const eligible = new Set(
          datedEligible
            .filter(
              (shift) =>
                timeToMinutes(shift.startTime) <= start &&
                timeToMinutes(shift.endTime) >= end
            )
            .map((shift) => shift.staffId)
        )
        const pedagogs = [...eligible].filter(
          (staffId) => staffById.get(staffId)?.role === "pedagog"
        ).length
        const details = {
          date: day.date,
          startTime: minutesToTime(start),
          endTime: minutesToTime(end),
          ruleIds: demand.ruleSourceIds,
          sourceIds: [
            ...demand.openingSourceIds,
            ...(demand.replacementSourceId ? [demand.replacementSourceId] : []),
          ],
        }
        if (eligible.size < demand.minStaff) {
          result.push(
            issue("min_staff_unmet", "Minimum staff coverage is not met.", {
              ...details,
              details: { actual: eligible.size, required: demand.minStaff },
            })
          )
        }
        if (pedagogs < demand.minPedagogs) {
          result.push(
            issue(
              "min_pedagogs_unmet",
              "Minimum pedagog coverage is not met.",
              {
                ...details,
                details: { actual: pedagogs, required: demand.minPedagogs },
              }
            )
          )
        }
      }
    }
  }

  return {
    valid: !result.some((entry) => entry.severity === "error"),
    issues: result,
    warnings: result.filter((entry) => entry.severity === "warning"),
  }
}

export { flattenSchedule, validateDatedSchedule, validateGeneratedDates }
export type { ValidateDatedScheduleOptions }
