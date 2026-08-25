import { calculateCoverageSegments } from "@/lib/shift-schedule/coverage"
import { daysOfWeek } from "@/lib/shift-schedule/schemas"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import {
  flattenGeneratedShifts,
  indexShiftsByStaffAndDay,
  indexStaffById,
  timeToMinutes,
} from "@/lib/shift-schedule/shifts"
import { buildValidationResult } from "@/lib/shift-schedule/validation-types"
import type {
  ScheduleValidationIssue,
  ScheduleValidationResult,
} from "@/lib/shift-schedule/validation-types"

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
    ...daysOfWeek.flatMap((dayOfWeek) =>
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

function validateShiftsWithinOpeningHours({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationIssue[] {
  return flattenGeneratedShifts(generatedSchedule).flatMap((shift) => {
    const shiftStart = timeToMinutes(shift.startTime)
    const shiftEnd = timeToMinutes(shift.endTime)
    const fitsOpeningHours = scheduleInput.openingHours.some(
      (interval) =>
        interval.dayOfWeek === shift.dayOfWeek &&
        timeToMinutes(interval.startTime) <= shiftStart &&
        timeToMinutes(interval.endTime) >= shiftEnd
    )

    if (fitsOpeningHours) {
      return []
    }

    return [
      {
        code: "shift_outside_opening_hours",
        severity: "error",
        message: "Generated shift is outside institution opening hours.",
        dayOfWeek: shift.dayOfWeek,
        staffId: shift.staffId,
        startTime: shift.startTime,
        endTime: shift.endTime,
      } satisfies ScheduleValidationIssue,
    ]
  })
}

/**
 * Reports every unsatisfied coverage segment for every staffing rule. Issues
 * carry the failing segment's time range rather than the whole rule's, so a
 * reader can see where coverage breaks down, and each applicable rule is
 * checked independently because overlapping rules never replace one another.
 */
function validateStaffingRules({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = []
  const segments = calculateCoverageSegments({
    scheduleInput,
    generatedSchedule,
  })

  for (const segment of segments) {
    for (const ruleIndex of segment.ruleIndexes) {
      const rule = scheduleInput.rules[ruleIndex]

      if (segment.staffCount < rule.minStaff) {
        issues.push({
          code: "min_staff_unmet",
          severity: "error",
          message: `Generated schedule provides ${segment.staffCount} of ${rule.minStaff} required staff from ${segment.startTime} to ${segment.endTime}.`,
          dayOfWeek: segment.dayOfWeek,
          startTime: segment.startTime,
          endTime: segment.endTime,
          ruleIndex,
        })
      }

      if (segment.pedagogCount < rule.minPedagogs) {
        issues.push({
          code: "min_pedagogs_unmet",
          severity: "error",
          message: `Generated schedule provides ${segment.pedagogCount} of ${rule.minPedagogs} required pedagogs from ${segment.startTime} to ${segment.endTime}.`,
          dayOfWeek: segment.dayOfWeek,
          startTime: segment.startTime,
          endTime: segment.endTime,
          ruleIndex,
        })
      }
    }
  }

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
    ...validateShiftsWithinOpeningHours({ scheduleInput, generatedSchedule }),
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
  validateShiftsWithinOpeningHours,
  validateStaffingRules,
  validateWeekdays,
}
