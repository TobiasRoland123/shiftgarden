import { weekdays } from "@/lib/shift-schedule/schemas"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import { buildValidationResult } from "@/lib/shift-schedule/validation-types"
import type {
  ScheduleValidationIssue,
  ScheduleValidationResult,
} from "@/lib/shift-schedule/validation-types"

type GeneratedDay = GeneratedSchedule["days"][number]
type GeneratedShift = GeneratedDay["shifts"][number]
type StaffingRule = ScheduleInput["rules"][number]

type ShiftWithDay = GeneratedShift & {
  dayOfWeek: GeneratedDay["dayOfWeek"]
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)

  return hours * 60 + minutes
}

function indexStaffById(scheduleInput: ScheduleInput) {
  return new Map(scheduleInput.staff.map((staff) => [staff.id, staff]))
}

function flattenGeneratedShifts(
  generatedSchedule: GeneratedSchedule
): ShiftWithDay[] {
  return generatedSchedule.days.flatMap((day) =>
    day.shifts.map((shift) => ({
      ...shift,
      dayOfWeek: day.dayOfWeek,
    }))
  )
}

function indexShiftsByStaffAndDay(generatedSchedule: GeneratedSchedule) {
  const index = new Map<string, ShiftWithDay[]>()

  for (const shift of flattenGeneratedShifts(generatedSchedule)) {
    const key = `${shift.staffId}:${shift.dayOfWeek}`
    const shifts = index.get(key) ?? []
    shifts.push(shift)
    index.set(key, shifts)
  }

  return index
}

function validateScheduleGroupId({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationIssue[] {
  if (scheduleInput.group.id === generatedSchedule.groupId) {
    return []
  }

  return [
    {
      code: "group_id_mismatch",
      severity: "error",
      message: `Generated group ${generatedSchedule.groupId} does not match selected group ${scheduleInput.group.id}.`,
    },
  ]
}

function validateWeekdays(
  generatedSchedule: GeneratedSchedule
): ScheduleValidationIssue[] {
  const counts = new Map<string, number>()

  for (const day of generatedSchedule.days) {
    counts.set(day.dayOfWeek, (counts.get(day.dayOfWeek) ?? 0) + 1)
  }

  return [
    ...weekdays.flatMap((dayOfWeek) =>
      counts.has(dayOfWeek)
        ? []
        : [
            {
              code: "missing_weekday",
              severity: "error",
              message: `Generated schedule is missing ${dayOfWeek}.`,
              dayOfWeek,
            } satisfies ScheduleValidationIssue,
          ]
    ),
    ...Array.from(counts.entries()).flatMap(([dayOfWeek, count]) =>
      count > 1
        ? [
            {
              code: "duplicate_weekday",
              severity: "error",
              message: `Generated schedule contains ${count} entries for ${dayOfWeek}.`,
              dayOfWeek,
            } satisfies ScheduleValidationIssue,
          ]
        : []
    ),
  ]
}

function validateKnownStaffIds({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationIssue[] {
  const staffById = indexStaffById(scheduleInput)

  return flattenGeneratedShifts(generatedSchedule).flatMap((shift) => {
    if (staffById.has(shift.staffId)) {
      return []
    }

    return [
      {
        code: "unknown_staff",
        severity: "error",
        message: `Generated shift references unknown staff member ${shift.staffId}.`,
        dayOfWeek: shift.dayOfWeek,
        staffId: shift.staffId,
        startTime: shift.startTime,
        endTime: shift.endTime,
      } satisfies ScheduleValidationIssue,
    ]
  })
}

function validateActiveStaffOnly({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationIssue[] {
  const staffById = indexStaffById(scheduleInput)

  return flattenGeneratedShifts(generatedSchedule).flatMap((shift) => {
    const staff = staffById.get(shift.staffId)

    if (!staff || staff.active) {
      return []
    }

    return [
      {
        code: "inactive_staff",
        severity: "error",
        message: `Generated shift schedules inactive staff member ${shift.staffId}.`,
        dayOfWeek: shift.dayOfWeek,
        staffId: shift.staffId,
        startTime: shift.startTime,
        endTime: shift.endTime,
      } satisfies ScheduleValidationIssue,
    ]
  })
}

function validateShiftTimes(
  generatedSchedule: GeneratedSchedule
): ScheduleValidationIssue[] {
  return flattenGeneratedShifts(generatedSchedule).flatMap((shift) => {
    if (timeToMinutes(shift.endTime) > timeToMinutes(shift.startTime)) {
      return []
    }

    return [
      {
        code: "invalid_shift_time",
        severity: "error",
        message: "Generated shift end time must be after start time.",
        dayOfWeek: shift.dayOfWeek,
        staffId: shift.staffId,
        startTime: shift.startTime,
        endTime: shift.endTime,
      } satisfies ScheduleValidationIssue,
    ]
  })
}

function validateAvailability({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationIssue[] {
  const staffById = indexStaffById(scheduleInput)

  return flattenGeneratedShifts(generatedSchedule).flatMap((shift) => {
    const staff = staffById.get(shift.staffId)

    if (!staff) {
      return []
    }

    const shiftStart = timeToMinutes(shift.startTime)
    const shiftEnd = timeToMinutes(shift.endTime)
    const fitsAvailability = staff.availability
      .filter((availability) => availability.dayOfWeek === shift.dayOfWeek)
      .some(
        (availability) =>
          timeToMinutes(availability.startAvailabilityTime) <= shiftStart &&
          timeToMinutes(availability.endAvailabilityTime) >= shiftEnd
      )

    if (fitsAvailability) {
      return []
    }

    return [
      {
        code: "outside_availability",
        severity: "error",
        message: `Generated shift is outside staff member ${shift.staffId}'s availability.`,
        dayOfWeek: shift.dayOfWeek,
        staffId: shift.staffId,
        startTime: shift.startTime,
        endTime: shift.endTime,
      } satisfies ScheduleValidationIssue,
    ]
  })
}

function validateMaxWeeklyHours({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationIssue[] {
  const staffById = indexStaffById(scheduleInput)
  const minutesByStaffId = new Map<string, number>()

  for (const shift of flattenGeneratedShifts(generatedSchedule)) {
    if (
      !staffById.has(shift.staffId) ||
      timeToMinutes(shift.endTime) <= timeToMinutes(shift.startTime)
    ) {
      continue
    }

    minutesByStaffId.set(
      shift.staffId,
      (minutesByStaffId.get(shift.staffId) ?? 0) +
        timeToMinutes(shift.endTime) -
        timeToMinutes(shift.startTime)
    )
  }

  return Array.from(minutesByStaffId.entries()).flatMap(
    ([staffId, scheduledMinutes]) => {
      const staff = staffById.get(staffId)

      if (!staff || scheduledMinutes <= staff.maxHoursPerWeek * 60) {
        return []
      }

      return [
        {
          code: "max_hours_exceeded",
          severity: "error",
          message: `Generated schedule exceeds staff member ${staffId}'s weekly maximum hours.`,
          staffId,
        } satisfies ScheduleValidationIssue,
      ]
    }
  )
}

function validateNoOverlaps(
  generatedSchedule: GeneratedSchedule
): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = []

  for (const shifts of indexShiftsByStaffAndDay(generatedSchedule).values()) {
    const sortedShifts = [...shifts].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    )

    for (let index = 1; index < sortedShifts.length; index += 1) {
      const previous = sortedShifts[index - 1]
      const current = sortedShifts[index]

      if (timeToMinutes(current.startTime) >= timeToMinutes(previous.endTime)) {
        continue
      }

      issues.push({
        code: "overlapping_shift",
        severity: "error",
        message: `Generated shifts overlap for staff member ${current.staffId}.`,
        dayOfWeek: current.dayOfWeek,
        staffId: current.staffId,
        startTime: current.startTime,
        endTime: current.endTime,
      })
    }
  }

  return issues
}

function validateFifoEndOrder(
  generatedSchedule: GeneratedSchedule
): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = []

  for (const day of generatedSchedule.days) {
    for (let firstIndex = 0; firstIndex < day.shifts.length; firstIndex += 1) {
      const first = day.shifts[firstIndex]

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < day.shifts.length;
        secondIndex += 1
      ) {
        const second = day.shifts[secondIndex]

        if (first.staffId === second.staffId) {
          continue
        }

        const firstStart = timeToMinutes(first.startTime)
        const secondStart = timeToMinutes(second.startTime)
        const firstEnd = timeToMinutes(first.endTime)
        const secondEnd = timeToMinutes(second.endTime)
        const earlier = firstStart < secondStart ? first : second
        const later = firstStart < secondStart ? second : first
        const earlierEnd = firstStart < secondStart ? firstEnd : secondEnd
        const laterEnd = firstStart < secondStart ? secondEnd : firstEnd

        if (firstStart === secondStart || earlierEnd <= laterEnd) {
          continue
        }

        issues.push({
          code: "fifo_end_order_inversion",
          severity: "error",
          message: `Staff member ${later.staffId} starts after ${earlier.staffId} but ends earlier. Adjust their end times so staff who start earlier do not finish later.`,
          dayOfWeek: day.dayOfWeek,
          staffId: later.staffId,
          startTime: later.startTime,
          endTime: later.endTime,
        })
      }
    }
  }

  return issues
}

function isShiftInInterval(shift: ShiftWithDay, start: number, end: number) {
  return (
    timeToMinutes(shift.startTime) < end && timeToMinutes(shift.endTime) > start
  )
}

function isIntervalCoveredByRules(
  rules: StaffingRule[],
  start: number,
  end: number
) {
  return rules.some(
    (rule) =>
      timeToMinutes(rule.startTime) <= start &&
      timeToMinutes(rule.endTime) >= end
  )
}

function validateShiftSegmentsInsideRules({
  generatedSchedule,
  rules,
}: {
  generatedSchedule: GeneratedSchedule
  rules: ScheduleInput["rules"]
}) {
  return flattenGeneratedShifts(generatedSchedule).flatMap((shift) => {
    const sameDayRules = rules.filter(
      (rule) => rule.dayOfWeek === shift.dayOfWeek
    )
    const shiftStart = timeToMinutes(shift.startTime)
    const shiftEnd = timeToMinutes(shift.endTime)
    const boundaries = new Set([shiftStart, shiftEnd])

    for (const rule of sameDayRules) {
      const ruleStart = timeToMinutes(rule.startTime)
      const ruleEnd = timeToMinutes(rule.endTime)

      if (ruleStart > shiftStart && ruleStart < shiftEnd) {
        boundaries.add(ruleStart)
      }

      if (ruleEnd > shiftStart && ruleEnd < shiftEnd) {
        boundaries.add(ruleEnd)
      }
    }

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b)
    const uncoveredSegment = sortedBoundaries
      .slice(0, -1)
      .map((start, index) => ({ start, end: sortedBoundaries[index + 1] }))
      .find(
        (segment) =>
          segment.end > segment.start &&
          !isIntervalCoveredByRules(sameDayRules, segment.start, segment.end)
      )

    if (!uncoveredSegment) {
      return []
    }

    return [
      {
        code: "shift_outside_staffing_rule",
        severity: "error",
        message: "Generated shift includes time outside staffing-rule periods.",
        dayOfWeek: shift.dayOfWeek,
        staffId: shift.staffId,
        startTime: shift.startTime,
        endTime: shift.endTime,
      } satisfies ScheduleValidationIssue,
    ]
  })
}

function validateStaffingRules({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationIssue[] {
  const staffById = indexStaffById(scheduleInput)
  const allShifts = flattenGeneratedShifts(generatedSchedule)
  const issues: ScheduleValidationIssue[] = [
    ...validateShiftSegmentsInsideRules({
      generatedSchedule,
      rules: scheduleInput.rules,
    }),
  ]

  scheduleInput.rules.forEach((rule, ruleIndex) => {
    if (!weekdays.includes(rule.dayOfWeek as (typeof weekdays)[number])) {
      return
    }

    const ruleStart = timeToMinutes(rule.startTime)
    const ruleEnd = timeToMinutes(rule.endTime)
    const sameDayShifts = allShifts.filter(
      (shift) =>
        shift.dayOfWeek === rule.dayOfWeek &&
        timeToMinutes(shift.endTime) > timeToMinutes(shift.startTime) &&
        isShiftInInterval(shift, ruleStart, ruleEnd)
    )
    const boundaries = new Set([ruleStart, ruleEnd])

    for (const shift of sameDayShifts) {
      const shiftStart = timeToMinutes(shift.startTime)
      const shiftEnd = timeToMinutes(shift.endTime)

      if (shiftStart > ruleStart && shiftStart < ruleEnd) {
        boundaries.add(shiftStart)
      }

      if (shiftEnd > ruleStart && shiftEnd < ruleEnd) {
        boundaries.add(shiftEnd)
      }
    }

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b)

    for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
      const segmentStart = sortedBoundaries[index]
      const segmentEnd = sortedBoundaries[index + 1]
      const coveringShifts = sameDayShifts.filter(
        (shift) =>
          timeToMinutes(shift.startTime) <= segmentStart &&
          timeToMinutes(shift.endTime) >= segmentEnd
      )
      const staffCount = coveringShifts.length
      const pedagogCount = coveringShifts.filter(
        (shift) => staffById.get(shift.staffId)?.role === "pedagog"
      ).length

      if (staffCount < rule.minStaff) {
        issues.push({
          code: "min_staff_unmet",
          severity: "error",
          message: "Generated schedule does not meet minimum staff coverage.",
          dayOfWeek: rule.dayOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
          ruleIndex,
        })
        break
      }

      if (pedagogCount < rule.minPedagogs) {
        issues.push({
          code: "min_pedagogs_unmet",
          severity: "error",
          message: "Generated schedule does not meet minimum pedagog coverage.",
          dayOfWeek: rule.dayOfWeek,
          startTime: rule.startTime,
          endTime: rule.endTime,
          ruleIndex,
        })
        break
      }
    }
  })

  return issues
}

function validateGeneratedSchedule({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationResult {
  return buildValidationResult([
    ...validateScheduleGroupId({ scheduleInput, generatedSchedule }),
    ...validateWeekdays(generatedSchedule),
    ...validateKnownStaffIds({ scheduleInput, generatedSchedule }),
    ...validateActiveStaffOnly({ scheduleInput, generatedSchedule }),
    ...validateShiftTimes(generatedSchedule),
    ...validateAvailability({ scheduleInput, generatedSchedule }),
    ...validateMaxWeeklyHours({ scheduleInput, generatedSchedule }),
    ...validateNoOverlaps(generatedSchedule),
    ...validateFifoEndOrder(generatedSchedule),
    ...validateStaffingRules({ scheduleInput, generatedSchedule }),
  ])
}

export {
  flattenGeneratedShifts,
  indexShiftsByStaffAndDay,
  indexStaffById,
  timeToMinutes,
  validateActiveStaffOnly,
  validateAvailability,
  validateFifoEndOrder,
  validateGeneratedSchedule,
  validateKnownStaffIds,
  validateMaxWeeklyHours,
  validateNoOverlaps,
  validateScheduleGroupId,
  validateShiftTimes,
  validateStaffingRules,
  validateWeekdays,
}
