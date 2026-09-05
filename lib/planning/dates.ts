import type {
  ClockTime,
  ISODateString,
  TimeInterval,
} from "@/lib/planning/contracts"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const

function parseDate(date: string): Date {
  if (!DATE_RE.test(date)) throw new Error(`Invalid ISO date: ${date}`)
  const [year, month, day] = date.split("-").map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ISO date: ${date}`)
  }
  return parsed
}

function isValidDate(date: string): date is ISODateString {
  try {
    parseDate(date)
    return true
  } catch {
    return false
  }
}

function formatDate(date: Date): ISODateString {
  return date.toISOString().slice(0, 10)
}

function addDays(date: ISODateString, days: number): ISODateString {
  const value = parseDate(date)
  value.setUTCDate(value.getUTCDate() + days)
  return formatDate(value)
}

function compareDates(left: ISODateString, right: ISODateString): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function enumerateDates(
  startDate: ISODateString,
  endDate: ISODateString
): ISODateString[] {
  parseDate(startDate)
  parseDate(endDate)
  if (startDate > endDate) return []
  const dates: ISODateString[] = []
  for (
    let current = startDate;
    current <= endDate;
    current = addDays(current, 1)
  )
    dates.push(current)
  return dates
}

function dayOfWeek(date: ISODateString): (typeof WEEKDAY_NAMES)[number] {
  return WEEKDAY_NAMES[parseDate(date).getUTCDay()]
}

function isoWeekKey(date: ISODateString): string {
  const value = parseDate(date)
  const day = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() + 4 - day)
  const year = value.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(
    ((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  )
  return `${year}-W${String(week).padStart(2, "0")}`
}

function isoWeekStart(dateOrWeek: ISODateString | string): ISODateString {
  if (/^\d{4}-W\d{2}$/.test(dateOrWeek)) {
    const match = /^(\d{4})-W(\d{2})$/.exec(dateOrWeek)
    const year = Number(match?.[1])
    const week = Number(match?.[2])
    const jan4 = `${year}-01-04` as ISODateString
    const monday = addDays(jan4, -(parseDate(jan4).getUTCDay() || 7) + 1)
    const start = addDays(monday, (week - 1) * 7)
    if (week < 1 || week > 53 || isoWeekKey(start) !== dateOrWeek)
      throw new Error(`Invalid ISO week: ${dateOrWeek}`)
    return start
  }
  const date = parseDate(dateOrWeek)
  return addDays(formatDate(date), -(date.getUTCDay() || 7) + 1)
}

function isoWeekDates(weekOrDate: string): ISODateString[] {
  const start = isoWeekStart(weekOrDate)
  return enumerateDates(start, addDays(start, 6))
}

function intersectingIsoWeeks(
  startDate: ISODateString,
  endDate: ISODateString
): string[] {
  return [...new Set(enumerateDates(startDate, endDate).map(isoWeekKey))]
}

function timeToMinutes(time: ClockTime): number {
  if (!TIME_RE.test(time)) throw new Error(`Invalid time: ${time}`)
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): ClockTime {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440)
    throw new Error(`Invalid minute value: ${minutes}`)
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function isValidTimeInterval(interval: TimeInterval): boolean {
  try {
    return timeToMinutes(interval.endTime) > timeToMinutes(interval.startTime)
  } catch {
    return false
  }
}

function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return (
    timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
  )
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const sorted = intervals
    .filter(isValidTimeInterval)
    .toSorted(
      (a, b) =>
        timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
        timeToMinutes(a.endTime) - timeToMinutes(b.endTime)
    )
  const merged: TimeInterval[] = []
  for (const interval of sorted) {
    const previous = merged.at(-1)
    if (
      !previous ||
      timeToMinutes(interval.startTime) > timeToMinutes(previous.endTime)
    )
      merged.push({ ...interval })
    else if (timeToMinutes(interval.endTime) > timeToMinutes(previous.endTime))
      previous.endTime = interval.endTime
  }
  return merged
}

function subtractIntervals(
  source: TimeInterval,
  blocked: TimeInterval[]
): TimeInterval[] {
  if (!isValidTimeInterval(source)) return []
  const start = timeToMinutes(source.startTime)
  const end = timeToMinutes(source.endTime)
  let cursor = start
  const result: TimeInterval[] = []
  for (const exclusion of mergeIntervals(blocked)) {
    const left = Math.max(start, timeToMinutes(exclusion.startTime))
    const right = Math.min(end, timeToMinutes(exclusion.endTime))
    if (right <= left) continue
    if (left > cursor)
      result.push({
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(left),
      })
    cursor = Math.max(cursor, right)
  }
  if (cursor < end)
    result.push({
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(end),
    })
  return result
}

function intervalDurationMinutes(interval: TimeInterval): number {
  return timeToMinutes(interval.endTime) - timeToMinutes(interval.startTime)
}

/** Convert a local wall-clock value to an instant. This is used at boundaries
 * only; date/week calculations above intentionally remain calendar arithmetic. */
function zonedDateTimeToInstant(
  date: ISODateString,
  time: ClockTime,
  timezone: string
): Date {
  parseDate(date)
  timeToMinutes(time)
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  let guess = Date.UTC(year, month - 1, day, hour, minute)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess))
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    )
    const rendered = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute
    )
    const desired = Date.UTC(year, month - 1, day, hour, minute)
    guess += desired - rendered
  }
  const instant = new Date(guess)
  const finalParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)
  const finalValues = Object.fromEntries(
    finalParts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  )
  if (
    finalValues.year !== year ||
    finalValues.month !== month ||
    finalValues.day !== day ||
    finalValues.hour !== hour ||
    finalValues.minute !== minute
  ) {
    throw new Error(`Local time does not exist in ${timezone}: ${date} ${time}`)
  }
  return instant
}

export {
  addDays,
  compareDates,
  dayOfWeek,
  enumerateDates,
  formatDate,
  intersectingIsoWeeks,
  intervalDurationMinutes,
  intervalsOverlap,
  isValidDate,
  isValidTimeInterval,
  isoWeekDates,
  isoWeekKey,
  isoWeekStart,
  mergeIntervals,
  minutesToTime,
  parseDate,
  subtractIntervals,
  timeToMinutes,
  zonedDateTimeToInstant,
}
