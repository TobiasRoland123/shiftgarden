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

type StaffGroupRow = {
  staffMemberId: string
  firstName: string
  lastName: string
  groupId: string | null
  groupName: string | null
}

type StaffOption = {
  id: string
  name: string
  groups: { id: string; name: string }[]
}

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

function buildAvailableStaffOptions(
  rows: StaffGroupRow[],
  linkedStaffIds: ReadonlySet<string>
) {
  const optionsById = new Map<string, StaffOption>()

  for (const row of rows) {
    if (linkedStaffIds.has(row.staffMemberId)) {
      continue
    }

    let option = optionsById.get(row.staffMemberId)
    if (!option) {
      option = {
        id: row.staffMemberId,
        name: `${row.firstName} ${row.lastName}`,
        groups: [],
      }
      optionsById.set(row.staffMemberId, option)
    }

    if (
      row.groupId &&
      row.groupName &&
      !option.groups.some((group) => group.id === row.groupId)
    ) {
      option.groups.push({ id: row.groupId, name: row.groupName })
    }
  }

  return [...optionsById.values()].map((option) => ({
    ...option,
    groups: option.groups.toSorted((left, right) =>
      left.name.localeCompare(right.name)
    ),
  }))
}

export {
  daySortOrder,
  buildAvailableStaffOptions,
  formatStaffRole,
  formatWeekday,
  isStaffRole,
  isWeekdayAvailability,
  daysOfWeek,
  staffRoles,
  weekdayAvailability,
}

export type { DayOfWeek, StaffRole, WeekdayAvailability }
export type { StaffGroupRow, StaffOption }
