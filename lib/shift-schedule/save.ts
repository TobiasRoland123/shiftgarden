import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import type {
  AcceptedSchedulePlan,
  ScheduleValidationWarning,
} from "@/lib/shift-schedule/validation-types"

type ShiftSchedulePlanInsertValues = {
  groupId: string
  inputJson: ScheduleInput
  warnings: string[]
  validationWarnings: ScheduleValidationWarning[]
  model: string
}

type ShiftScheduleShiftInsertValues = {
  planId: string
  staffMemberId: string
  dayOfWeek: GeneratedSchedule["days"][number]["dayOfWeek"]
  startTime: string
  endTime: string
}

function buildShiftSchedulePlanInsertValues({
  model,
  plan,
  scheduleInput,
}: {
  model: string
  plan: AcceptedSchedulePlan
  scheduleInput: ScheduleInput
}): ShiftSchedulePlanInsertValues {
  return {
    groupId: plan.groupId,
    inputJson: scheduleInput,
    warnings: plan.warnings,
    validationWarnings: plan.validationWarnings,
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

export {
  buildShiftSchedulePlanInsertValues,
  buildShiftScheduleShiftInsertValues,
}

export type { ShiftSchedulePlanInsertValues, ShiftScheduleShiftInsertValues }
