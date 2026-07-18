import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import type { ScheduleValidationResult } from "@/lib/shift-schedule/validation-types"

type ShiftSchedulePlanInsertValues = {
  groupId: string
  inputJson: ScheduleInput
  warnings: string[]
  model: string
}

type ShiftScheduleShiftInsertValues = {
  planId: string
  staffMemberId: string
  dayOfWeek: GeneratedSchedule["days"][number]["dayOfWeek"]
  startTime: string
  endTime: string
}

type ShiftScheduleGenerationAttemptInsertValues = {
  generationId: string
  groupId: string
  status: "validation_failed" | "accepted"
  attemptNumber: number
  model: string
  inputJson: ScheduleInput
  outputJson: GeneratedSchedule
  validationErrors: ScheduleValidationResult["issues"]
  acceptedPlanId: string | null
}

function buildShiftSchedulePlanInsertValues({
  model,
  plan,
  scheduleInput,
}: {
  model: string
  plan: GeneratedSchedule
  scheduleInput: ScheduleInput
}): ShiftSchedulePlanInsertValues {
  return {
    groupId: plan.groupId,
    inputJson: scheduleInput,
    warnings: plan.warnings,
    model,
  }
}

function buildShiftScheduleShiftInsertValues({
  plan,
  planId,
}: {
  plan: GeneratedSchedule
  planId: string
}): ShiftScheduleShiftInsertValues[] {
  return plan.days.flatMap((day) =>
    day.shifts.map((shift) => ({
      planId,
      staffMemberId: shift.staffId,
      dayOfWeek: day.dayOfWeek,
      startTime: shift.startTime,
      endTime: shift.endTime,
    }))
  )
}

function buildShiftScheduleGenerationAttemptInsertValues({
  acceptedPlanId = null,
  attemptNumber,
  generationId,
  model,
  plan,
  scheduleInput,
  validation,
}: {
  acceptedPlanId?: string | null
  attemptNumber: number
  generationId: string
  model: string
  plan: GeneratedSchedule
  scheduleInput: ScheduleInput
  validation: ScheduleValidationResult
}): ShiftScheduleGenerationAttemptInsertValues {
  return {
    generationId,
    groupId: scheduleInput.group.id,
    status: validation.valid ? "accepted" : "validation_failed",
    attemptNumber,
    model,
    inputJson: scheduleInput,
    outputJson: plan,
    validationErrors: validation.issues.filter(
      (issue) => issue.severity === "error"
    ),
    acceptedPlanId,
  }
}

export {
  buildShiftScheduleGenerationAttemptInsertValues,
  buildShiftSchedulePlanInsertValues,
  buildShiftScheduleShiftInsertValues,
}

export type {
  ShiftScheduleGenerationAttemptInsertValues,
  ShiftSchedulePlanInsertValues,
  ShiftScheduleShiftInsertValues,
}
