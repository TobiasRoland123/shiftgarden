import { calculateGroupCapacityShortfall } from "@/lib/groups"
import type { GroupCapacityShortfall } from "@/lib/groups"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import { validateStaffingRulesWithinOpeningHours } from "@/lib/shift-schedule/validate-input"
import type { ScheduleValidationIssue } from "@/lib/shift-schedule/validation-types"

type GroupReadinessBlockingCode =
  | "no_opening_hours"
  | "no_staffing_rules"
  | "no_linked_active_staff"
  | "staffing_rule_outside_opening_hours"

type GroupReadinessBlockingIssue = {
  code: GroupReadinessBlockingCode
  dayOfWeek?: string
  startTime?: string
  endTime?: string
  ruleIndex?: number
}

type GroupReadiness = {
  blockingIssues: GroupReadinessBlockingIssue[]
  capacityShortfall: GroupCapacityShortfall
  linkedActiveStaffCount: number
  linkedStaffCount: number
  staffingRuleCount: number
  openingHoursCount: number
  canGenerate: boolean
}

function toBlockingIssue(
  issue: ScheduleValidationIssue
): GroupReadinessBlockingIssue {
  return {
    code: "staffing_rule_outside_opening_hours",
    dayOfWeek: issue.dayOfWeek,
    startTime: issue.startTime,
    endTime: issue.endTime,
    ruleIndex: issue.ruleIndex,
  }
}

/**
 * Summarises whether a group can produce a generated schedule plan at all, and
 * what a user should know before spending an AI call. Blocking issues make
 * generation pointless; capacity shortfalls are group-level concerns that do
 * not prove a plan cannot be accepted, so they never block.
 */
function getGroupReadiness(scheduleInput: ScheduleInput): GroupReadiness {
  const linkedActiveStaff = scheduleInput.staff.filter((staff) => staff.active)
  const blockingIssues: GroupReadinessBlockingIssue[] = []

  if (scheduleInput.openingHours.length === 0) {
    blockingIssues.push({ code: "no_opening_hours" })
  }

  if (scheduleInput.rules.length === 0) {
    blockingIssues.push({ code: "no_staffing_rules" })
  }

  if (linkedActiveStaff.length === 0) {
    blockingIssues.push({ code: "no_linked_active_staff" })
  }

  blockingIssues.push(
    ...validateStaffingRulesWithinOpeningHours(scheduleInput).map(
      toBlockingIssue
    )
  )

  return {
    blockingIssues,
    capacityShortfall: calculateGroupCapacityShortfall(
      scheduleInput.rules,
      scheduleInput.staff
    ),
    linkedActiveStaffCount: linkedActiveStaff.length,
    linkedStaffCount: scheduleInput.staff.length,
    staffingRuleCount: scheduleInput.rules.length,
    openingHoursCount: scheduleInput.openingHours.length,
    canGenerate: blockingIssues.length === 0,
  }
}

function hasCapacityShortfall(shortfall: GroupCapacityShortfall) {
  return (
    shortfall.totalShortfallHours > 0 || shortfall.pedagogShortfallHours > 0
  )
}

export { getGroupReadiness, hasCapacityShortfall }

export type {
  GroupReadiness,
  GroupReadinessBlockingCode,
  GroupReadinessBlockingIssue,
}
