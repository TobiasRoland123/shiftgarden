import {
  daySortOrder,
  formatWeekday,
  isWeekdayAvailability,
  weekdayAvailability,
  type DayOfWeek,
  type WeekdayAvailability,
} from "@/lib/staff"

type GroupStaffRule = {
  dayOfWeek: DayOfWeek
  startTime: string
}

type GroupTranslationKey = `weekday.${DayOfWeek}`
type GroupTranslator = (key: GroupTranslationKey) => string

function compareGroupStaffRules(left: GroupStaffRule, right: GroupStaffRule) {
  const leftIndex = daySortOrder.get(left.dayOfWeek) ?? 99
  const rightIndex = daySortOrder.get(right.dayOfWeek) ?? 99

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex
  }

  return left.startTime.localeCompare(right.startTime)
}

export {
  compareGroupStaffRules,
  formatWeekday,
  isWeekdayAvailability,
  weekdayAvailability,
}

export type { GroupTranslator, WeekdayAvailability }
