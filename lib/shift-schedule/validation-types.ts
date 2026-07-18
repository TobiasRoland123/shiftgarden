import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"

type ScheduleValidationIssueCode =
  | "group_id_mismatch"
  | "missing_weekday"
  | "duplicate_weekday"
  | "unsupported_weekend_rule"
  | "unknown_staff"
  | "inactive_staff"
  | "invalid_shift_time"
  | "outside_availability"
  | "max_hours_exceeded"
  | "overlapping_shift"
  | "shift_outside_staffing_rule"
  | "min_staff_unmet"
  | "min_pedagogs_unmet"

type ScheduleValidationSeverity = "error" | "warning"

type ScheduleValidationIssue = {
  code: ScheduleValidationIssueCode
  severity: ScheduleValidationSeverity
  message: string
  dayOfWeek?: string
  staffId?: string
  startTime?: string
  endTime?: string
  ruleIndex?: number
}

type ScheduleValidationResult = {
  valid: boolean
  issues: ScheduleValidationIssue[]
}

type ScheduleValidationWarning = Omit<ScheduleValidationIssue, "severity"> & {
  severity: "warning"
}

type AcceptedSchedulePlan = GeneratedSchedule & {
  validationWarnings: ScheduleValidationWarning[]
}

function buildValidationResult(
  issues: ScheduleValidationIssue[]
): ScheduleValidationResult {
  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
  }
}

function getValidationWarnings(
  ...results: ScheduleValidationResult[]
): ScheduleValidationWarning[] {
  return results.flatMap((result) =>
    result.issues.filter(
      (issue): issue is ScheduleValidationWarning =>
        issue.severity === "warning"
    )
  )
}

export { buildValidationResult, getValidationWarnings }

export type {
  AcceptedSchedulePlan,
  ScheduleValidationIssue,
  ScheduleValidationIssueCode,
  ScheduleValidationResult,
  ScheduleValidationSeverity,
  ScheduleValidationWarning,
}
