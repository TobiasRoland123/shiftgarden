import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import {
  flattenGeneratedShifts,
  indexStaffById,
  minutesToTime,
  timeToMinutes,
} from "@/lib/shift-schedule/shifts"
import type { DayOfWeek, ShiftWithDay } from "@/lib/shift-schedule/shifts"

type CoverageSegment = {
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  staffCount: number
  pedagogCount: number
  minStaff: number
  minPedagogs: number
  ruleIndexes: number[]
}

type StaffingRule = ScheduleInput["rules"][number]
type IndexedStaffingRule = StaffingRule & { ruleIndex: number }

function isPositiveDuration(shift: ShiftWithDay) {
  return timeToMinutes(shift.endTime) > timeToMinutes(shift.startTime)
}

function coversSegment(
  interval: { startTime: string; endTime: string },
  segmentStart: number,
  segmentEnd: number
) {
  return (
    timeToMinutes(interval.startTime) <= segmentStart &&
    timeToMinutes(interval.endTime) >= segmentEnd
  )
}

/**
 * Builds the boundary set for one weekday from the union of every staffing-rule
 * edge and every shift edge on that weekday. Sweeping the whole weekday at once
 * — rather than once per rule — keeps overlapping rules on a single coherent
 * set of segments, so the coverage display and the validators agree.
 */
function collectDayBoundaries(
  rules: IndexedStaffingRule[],
  shifts: ShiftWithDay[]
) {
  const boundaries = new Set<number>()

  for (const rule of rules) {
    boundaries.add(timeToMinutes(rule.startTime))
    boundaries.add(timeToMinutes(rule.endTime))
  }

  for (const shift of shifts) {
    boundaries.add(timeToMinutes(shift.startTime))
    boundaries.add(timeToMinutes(shift.endTime))
  }

  return Array.from(boundaries).sort((first, second) => first - second)
}

function calculateCoverageSegments({
  scheduleInput,
  generatedSchedule,
}: {
  scheduleInput: ScheduleInput
  generatedSchedule: GeneratedSchedule
}): CoverageSegment[] {
  const staffById = indexStaffById(scheduleInput)
  const allShifts =
    flattenGeneratedShifts(generatedSchedule).filter(isPositiveDuration)
  const indexedRules: IndexedStaffingRule[] = scheduleInput.rules.map(
    (rule, ruleIndex) => ({ ...rule, ruleIndex })
  )
  const daysInPlay = new Set<DayOfWeek>([
    ...indexedRules.map((rule) => rule.dayOfWeek),
    ...allShifts.map((shift) => shift.dayOfWeek),
  ])
  const segments: CoverageSegment[] = []

  for (const dayOfWeek of daysInPlay) {
    const dayRules = indexedRules.filter((rule) => rule.dayOfWeek === dayOfWeek)
    const dayShifts = allShifts.filter((shift) => shift.dayOfWeek === dayOfWeek)
    const boundaries = collectDayBoundaries(dayRules, dayShifts)

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const segmentStart = boundaries[index]
      const segmentEnd = boundaries[index + 1]
      const coveringShifts = dayShifts.filter((shift) =>
        coversSegment(shift, segmentStart, segmentEnd)
      )
      const applicableRules = dayRules.filter((rule) =>
        coversSegment(rule, segmentStart, segmentEnd)
      )

      segments.push({
        dayOfWeek,
        startTime: minutesToTime(segmentStart),
        endTime: minutesToTime(segmentEnd),
        staffCount: coveringShifts.length,
        pedagogCount: coveringShifts.filter(
          (shift) => staffById.get(shift.staffId)?.role === "pedagog"
        ).length,
        minStaff: applicableRules.reduce(
          (highest, rule) => Math.max(highest, rule.minStaff),
          0
        ),
        minPedagogs: applicableRules.reduce(
          (highest, rule) => Math.max(highest, rule.minPedagogs),
          0
        ),
        ruleIndexes: applicableRules.map((rule) => rule.ruleIndex),
      })
    }
  }

  return segments
}

function isSegmentUnmet(segment: CoverageSegment) {
  return (
    segment.staffCount < segment.minStaff ||
    segment.pedagogCount < segment.minPedagogs
  )
}

export { calculateCoverageSegments, isSegmentUnmet }

export type { CoverageSegment }
