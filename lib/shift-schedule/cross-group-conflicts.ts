import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"
import {
  flattenGeneratedShifts,
  timeToMinutes,
} from "@/lib/shift-schedule/validate-generated"
import { buildValidationResult } from "@/lib/shift-schedule/validation-types"
import type { ScheduleValidationResult } from "@/lib/shift-schedule/validation-types"

type ActivePlanShift = {
  dayOfWeek: string
  endTime: string
  groupId: string
  groupName: string
  planId: string
  staffId: string
  startTime: string
}

function validateCrossGroupConflicts({
  activePlanShifts,
  generatedSchedule,
}: {
  activePlanShifts: ActivePlanShift[]
  generatedSchedule: GeneratedSchedule
}): ScheduleValidationResult {
  const issues = flattenGeneratedShifts(generatedSchedule).flatMap((shift) =>
    activePlanShifts
      .filter(
        (activeShift) =>
          activeShift.staffId === shift.staffId &&
          activeShift.dayOfWeek === shift.dayOfWeek &&
          timeToMinutes(shift.startTime) < timeToMinutes(activeShift.endTime) &&
          timeToMinutes(shift.endTime) > timeToMinutes(activeShift.startTime)
      )
      .map((activeShift) => ({
        code: "cross_group_conflict" as const,
        severity: "error" as const,
        message: `Staff member ${shift.staffId} overlaps active plan ${activeShift.planId} for group ${activeShift.groupName}.`,
        dayOfWeek: shift.dayOfWeek,
        staffId: shift.staffId,
        startTime: shift.startTime,
        endTime: shift.endTime,
        conflictingGroupId: activeShift.groupId,
        conflictingGroupName: activeShift.groupName,
        conflictingPlanId: activeShift.planId,
      }))
  )

  return buildValidationResult(issues)
}

export { validateCrossGroupConflicts }
export type { ActivePlanShift }
