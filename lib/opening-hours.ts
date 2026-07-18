import { daysOfWeek, type DayOfWeek } from "@/lib/staff"

type TimeInterval = {
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function isDayOfWeek(value: string): value is DayOfWeek {
  return daysOfWeek.includes(value as DayOfWeek)
}

function intervalFitsWithin(
  interval: TimeInterval,
  containers: TimeInterval[]
) {
  return containers.some(
    (container) =>
      container.dayOfWeek === interval.dayOfWeek &&
      timeToMinutes(container.startTime) <= timeToMinutes(interval.startTime) &&
      timeToMinutes(container.endTime) >= timeToMinutes(interval.endTime)
  )
}

function validateOpeningHours(intervals: TimeInterval[]) {
  const errors: string[] = []

  for (const day of daysOfWeek) {
    const sorted = intervals
      .filter((interval) => interval.dayOfWeek === day)
      .toSorted((left, right) => left.startTime.localeCompare(right.startTime))

    sorted.forEach((interval, index) => {
      if (interval.endTime <= interval.startTime) {
        errors.push("Opening-hours end time must be after start time.")
      }

      const previous = sorted[index - 1]
      if (previous && interval.startTime < previous.endTime) {
        errors.push("Opening-hours intervals on the same day cannot overlap.")
      }
    })
  }

  return [...new Set(errors)]
}

export { intervalFitsWithin, isDayOfWeek, timeToMinutes, validateOpeningHours }
export type { TimeInterval }
