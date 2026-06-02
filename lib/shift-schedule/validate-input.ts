import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import { buildValidationResult } from "@/lib/shift-schedule/validation-types"
import type {
  ScheduleValidationIssue,
  ScheduleValidationResult,
} from "@/lib/shift-schedule/validation-types"

const unsupportedRuleDays = new Set(["saturday", "sunday"])

function validateSupportedRuleDays(
  scheduleInput: ScheduleInput
): ScheduleValidationIssue[] {
  return scheduleInput.rules.flatMap((rule, ruleIndex) => {
    if (!unsupportedRuleDays.has(rule.dayOfWeek)) {
      return []
    }

    return [
      {
        code: "unsupported_weekend_rule",
        severity: "error",
        message:
          "Generated schedule plans currently support Monday through Friday only.",
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
  return buildValidationResult(validateSupportedRuleDays(scheduleInput))
}

export { validateScheduleInputSupport, validateSupportedRuleDays }
