import {
  daySortOrder,
  formatWeekday,
  isWeekdayAvailability,
  weekdayAvailability,
  type DayOfWeek,
  type StaffRole,
  type WeekdayAvailability,
} from "@/lib/staff"

type GroupStaffRule = {
  dayOfWeek: DayOfWeek
  startTime: string
}

type GroupedStaffRules<T extends GroupStaffRule> = {
  dayOfWeek: DayOfWeek
  rules: T[]
}

type GroupTranslationKey = `weekday.${DayOfWeek}`
type GroupTranslator = (key: GroupTranslationKey) => string
type GroupCapacityStaffingRule = {
  startTime: string
  endTime: string
  minStaff: number
  minPedagogs: number
}
type StaffingRuleValues = {
  startTime: string
  endTime: string
  minStaff: number
  minPedagogs: number
}
type WeekdayStaffingRuleValues = StaffingRuleValues & {
  dayOfWeek: string
}

type GroupCapacityStaffMember = {
  active: boolean
  role: StaffRole
  maxHoursPerWeek: number
}

type GroupCapacityShortfall = {
  totalDemandHours: number
  totalCapacityHours: number
  totalShortfallHours: number
  pedagogDemandHours: number
  pedagogCapacityHours: number
  pedagogShortfallHours: number
}

function compareGroupStaffRules(left: GroupStaffRule, right: GroupStaffRule) {
  const leftIndex = daySortOrder.get(left.dayOfWeek) ?? 99
  const rightIndex = daySortOrder.get(right.dayOfWeek) ?? 99

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex
  }

  return left.startTime.localeCompare(right.startTime)
}

function groupStaffRulesByWeekday<T extends GroupStaffRule>(
  rules: readonly T[]
): GroupedStaffRules<T>[] {
  return rules
    .toSorted(compareGroupStaffRules)
    .reduce<GroupedStaffRules<T>[]>((groups, rule) => {
      const currentGroup = groups.at(-1)

      if (currentGroup?.dayOfWeek === rule.dayOfWeek) {
        currentGroup.rules.push(rule)
        return groups
      }

      groups.push({
        dayOfWeek: rule.dayOfWeek,
        rules: [rule],
      })

      return groups
    }, [])
}

function cloneStaffingRulesToAllWeekdays<T extends StaffingRuleValues>(
  rules: readonly T[]
): Array<T & { dayOfWeek: WeekdayAvailability }> {
  return weekdayAvailability.flatMap((dayOfWeek) =>
    rules.map((rule) => ({ ...rule, dayOfWeek }))
  )
}

function haveSameStaffingRulesOnAllWeekdays<
  T extends WeekdayStaffingRuleValues,
>(rules: readonly T[]) {
  const rulesByDay = weekdayAvailability.map((day) =>
    rules
      .filter((rule) => rule.dayOfWeek === day)
      .map(({ startTime, endTime, minStaff, minPedagogs }) => ({
        startTime,
        endTime,
        minStaff,
        minPedagogs,
      }))
  )
  const [firstDayRules, ...otherDaysRules] = rulesByDay

  return otherDaysRules.every(
    (dayRules) => JSON.stringify(dayRules) === JSON.stringify(firstDayRules)
  )
}

function getTimeOfDayMinutes(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":")

  return Number(hours) * 60 + Number(minutes)
}

function getStaffingRuleDurationMinutes(
  rule: Pick<GroupCapacityStaffingRule, "startTime" | "endTime">
) {
  return getTimeOfDayMinutes(rule.endTime) - getTimeOfDayMinutes(rule.startTime)
}

function calculateWeeklyStaffDemandMinutes(rules: GroupCapacityStaffingRule[]) {
  return rules.reduce(
    (total, rule) =>
      total + getStaffingRuleDurationMinutes(rule) * rule.minStaff,
    0
  )
}

function calculateWeeklyPedagogDemandMinutes(
  rules: GroupCapacityStaffingRule[]
) {
  return rules.reduce(
    (total, rule) =>
      total + getStaffingRuleDurationMinutes(rule) * rule.minPedagogs,
    0
  )
}

function calculateLinkedActiveStaffCapacityMinutes(
  staffMembers: GroupCapacityStaffMember[]
) {
  return staffMembers.reduce((total, staffMember) => {
    if (!staffMember.active) {
      return total
    }

    return total + staffMember.maxHoursPerWeek * 60
  }, 0)
}

function calculateLinkedActivePedagogCapacityMinutes(
  staffMembers: GroupCapacityStaffMember[]
) {
  return staffMembers.reduce((total, staffMember) => {
    if (!staffMember.active || staffMember.role !== "pedagog") {
      return total
    }

    return total + staffMember.maxHoursPerWeek * 60
  }, 0)
}

function minutesToHours(minutes: number) {
  return minutes / 60
}

function formatCapacityHours(hours: number) {
  return Number.isInteger(hours)
    ? String(hours)
    : String(Number(hours.toFixed(2)))
}

function calculateGroupCapacityShortfall(
  rules: GroupCapacityStaffingRule[],
  linkedStaff: GroupCapacityStaffMember[]
): GroupCapacityShortfall {
  const totalDemandMinutes = calculateWeeklyStaffDemandMinutes(rules)
  const totalCapacityMinutes =
    calculateLinkedActiveStaffCapacityMinutes(linkedStaff)
  const pedagogDemandMinutes = calculateWeeklyPedagogDemandMinutes(rules)
  const pedagogCapacityMinutes =
    calculateLinkedActivePedagogCapacityMinutes(linkedStaff)

  return {
    totalDemandHours: minutesToHours(totalDemandMinutes),
    totalCapacityHours: minutesToHours(totalCapacityMinutes),
    totalShortfallHours: minutesToHours(
      Math.max(totalDemandMinutes - totalCapacityMinutes, 0)
    ),
    pedagogDemandHours: minutesToHours(pedagogDemandMinutes),
    pedagogCapacityHours: minutesToHours(pedagogCapacityMinutes),
    pedagogShortfallHours: minutesToHours(
      Math.max(pedagogDemandMinutes - pedagogCapacityMinutes, 0)
    ),
  }
}

export {
  calculateGroupCapacityShortfall,
  calculateLinkedActivePedagogCapacityMinutes,
  calculateLinkedActiveStaffCapacityMinutes,
  calculateWeeklyPedagogDemandMinutes,
  calculateWeeklyStaffDemandMinutes,
  cloneStaffingRulesToAllWeekdays,
  compareGroupStaffRules,
  formatCapacityHours,
  formatWeekday,
  groupStaffRulesByWeekday,
  haveSameStaffingRulesOnAllWeekdays,
  getStaffingRuleDurationMinutes,
  isWeekdayAvailability,
  weekdayAvailability,
}

export type {
  GroupCapacityShortfall,
  GroupCapacityStaffingRule,
  GroupCapacityStaffMember,
  GroupedStaffRules,
  GroupTranslator,
  StaffingRuleValues,
  WeekdayStaffingRuleValues,
  WeekdayAvailability,
}
