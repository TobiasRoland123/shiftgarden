import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import { timeToMinutes } from "@/lib/shift-schedule/shifts"
import type { DayOfWeek } from "@/lib/shift-schedule/shifts"

const MINUTES_PER_HOUR = 60
const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 17

type TimelineBounds = {
  end: number
  start: number
}

type TimeInterval = {
  startTime: string
  endTime: string
}

function roundOutward(
  startMinutes: number,
  endMinutes: number
): TimelineBounds {
  return {
    start: Math.floor(startMinutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR,
    end: Math.ceil(endMinutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR,
  }
}

function getTimelineBounds(
  plan: Pick<GeneratedSchedule, "days">
): TimelineBounds {
  const shifts = plan.days.flatMap((day) => day.shifts)

  if (shifts.length === 0) {
    return {
      end: DEFAULT_END_HOUR * MINUTES_PER_HOUR,
      start: DEFAULT_START_HOUR * MINUTES_PER_HOUR,
    }
  }

  return roundOutward(
    Math.min(...shifts.map((shift) => timeToMinutes(shift.startTime))),
    Math.max(...shifts.map((shift) => timeToMinutes(shift.endTime)))
  )
}

/**
 * Bounds for one weekday's axis. Institution opening hours define the axis
 * where they exist; otherwise the axis falls back to that weekday's shifts so a
 * plan still renders for a weekday with no configured opening hours.
 */
function getDayTimelineBounds({
  dayOfWeek,
  openingHours,
  shifts,
}: {
  dayOfWeek: DayOfWeek
  openingHours: ScheduleInput["openingHours"]
  shifts: TimeInterval[]
}): TimelineBounds {
  const dayOpeningHours = openingHours.filter(
    (interval) => interval.dayOfWeek === dayOfWeek
  )
  const candidates: TimeInterval[] = [...dayOpeningHours, ...shifts]

  if (candidates.length === 0) {
    return {
      end: DEFAULT_END_HOUR * MINUTES_PER_HOUR,
      start: DEFAULT_START_HOUR * MINUTES_PER_HOUR,
    }
  }

  return roundOutward(
    Math.min(
      ...candidates.map((interval) => timeToMinutes(interval.startTime))
    ),
    Math.max(...candidates.map((interval) => timeToMinutes(interval.endTime)))
  )
}

function getShiftBarGeometry(
  startTime: string,
  endTime: string,
  bounds: TimelineBounds
) {
  const duration = bounds.end - bounds.start

  return {
    leftPercent: ((timeToMinutes(startTime) - bounds.start) / duration) * 100,
    widthPercent:
      ((timeToMinutes(endTime) - timeToMinutes(startTime)) / duration) * 100,
  }
}

export {
  getDayTimelineBounds,
  getShiftBarGeometry,
  getTimelineBounds,
  MINUTES_PER_HOUR,
}

export type { TimelineBounds }
