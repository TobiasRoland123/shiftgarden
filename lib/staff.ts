const staffRoles = ["pedagog", "assistant", "substitute"] as const

const weekdayAvailability = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const

const daysOfWeek = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

const daySortOrder = new Map<string, number>(
  daysOfWeek.map((day, index) => [day, index])
)

type StaffRole = (typeof staffRoles)[number]
type WeekdayAvailability = (typeof weekdayAvailability)[number]
type DayOfWeek = (typeof daysOfWeek)[number]
type StaffTranslationKey = `role.${StaffRole}` | `weekday.${DayOfWeek}`
type StaffTranslator = (key: StaffTranslationKey) => string

function isStaffRole(value: string): value is StaffRole {
  return staffRoles.includes(value as StaffRole)
}

function isWeekdayAvailability(value: string): value is WeekdayAvailability {
  return weekdayAvailability.includes(value as WeekdayAvailability)
}

function formatStaffRole(role: StaffRole, t: StaffTranslator) {
  return t(`role.${role}`)
}

function formatWeekday(day: DayOfWeek, t: StaffTranslator) {
  return t(`weekday.${day}`)
}

export {
  daySortOrder,
  formatStaffRole,
  formatWeekday,
  isStaffRole,
  isWeekdayAvailability,
  daysOfWeek,
  staffRoles,
  weekdayAvailability,
}

export type { DayOfWeek, StaffRole, WeekdayAvailability }
