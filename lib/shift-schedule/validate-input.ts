import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import { buildValidationResult } from "@/lib/shift-schedule/validation-types"
import type {
  ScheduleValidationIssue,
  ScheduleValidationResult,
} from "@/lib/shift-schedule/validation-types"

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function validateStaffingRulesWithinOpeningHours(
  scheduleInput: ScheduleInput
): ScheduleValidationIssue[] {
  return scheduleInput.rules.flatMap((rule, ruleIndex) => {
    const fitsOpeningHours = scheduleInput.openingHours.some(
      (interval) =>
        interval.dayOfWeek === rule.dayOfWeek &&
        timeToMinutes(interval.startTime) <= timeToMinutes(rule.startTime) &&
        timeToMinutes(interval.endTime) >= timeToMinutes(rule.endTime)
    )

    if (fitsOpeningHours) {
      return []
    }

    return [
      {
        code: "staffing_rule_outside_opening_hours",
        severity: "error",
        message:
          "Each staffing rule must fit within one opening-hours interval.",
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        ruleIndex,
      } satisfies ScheduleValidationIssue,
    ]
  })
}

function validateScheduleInputSupport(
  scheduleInput: ScheduleInput
): ScheduleValidationResult {
  return buildValidationResult(
    validateStaffingRulesWithinOpeningHours(scheduleInput)
  )
}

export { validateScheduleInputSupport, validateStaffingRulesWithinOpeningHours }
