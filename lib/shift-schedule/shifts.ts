import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"

type GeneratedDay = GeneratedSchedule["days"][number]
type GeneratedShift = GeneratedDay["shifts"][number]
type DayOfWeek = GeneratedDay["dayOfWeek"]
type ShiftWithDay = GeneratedShift & {
  dayOfWeek: DayOfWeek
}

const MINUTES_PER_HOUR = 60

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)

  return hours * MINUTES_PER_HOUR + minutes
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  const remainder = minutes % MINUTES_PER_HOUR

  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
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

export {
  flattenGeneratedShifts,
  indexShiftsByStaffAndDay,
  indexStaffById,
  minutesToTime,
  timeToMinutes,
}

export type { DayOfWeek, GeneratedDay, GeneratedShift, ShiftWithDay }
