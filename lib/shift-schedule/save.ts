import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"

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

export {
  buildShiftSchedulePlanInsertValues,
  buildShiftScheduleShiftInsertValues,
}

export type {
  ShiftSchedulePlanInsertValues,
  ShiftScheduleShiftInsertValues,
}
