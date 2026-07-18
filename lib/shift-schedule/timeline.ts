import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"

const MINUTES_PER_HOUR = 60
const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 17

type TimelineBounds = {
  end: number
  start: number
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * MINUTES_PER_HOUR + minutes
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

  return {
    end:
      Math.ceil(
        Math.max(...shifts.map((shift) => timeToMinutes(shift.endTime))) /
          MINUTES_PER_HOUR
      ) * MINUTES_PER_HOUR,
    start:
      Math.floor(
        Math.min(...shifts.map((shift) => timeToMinutes(shift.startTime))) /
          MINUTES_PER_HOUR
      ) * MINUTES_PER_HOUR,
  }
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

export { getShiftBarGeometry, getTimelineBounds, MINUTES_PER_HOUR }
