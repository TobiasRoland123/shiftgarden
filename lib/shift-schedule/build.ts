import {
  scheduleInputSchema,
  type ScheduleInput,
} from "@/lib/shift-schedule/schemas"

type ScheduleGroup = {
  id: string
  name: string
}

type ScheduleStaffMember = {
  id: string
  firstName: string
  lastName: string
  role: "pedagog" | "assistant" | "substitute"
  maxHoursPerWeek: number
  active: boolean
}

type ScheduleAvailability = {
  staffMemberId: string
  dayOfWeek:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday"
  startAvailabilityTime: string
  endAvailabilityTime: string
}

type ScheduleRule = {
  dayOfWeek: ScheduleAvailability["dayOfWeek"]
  startTime: string
  endTime: string
  minPedagogs: number
  minStaff: number
}

type ScheduleOpeningHours = Pick<
  ScheduleRule,
  "dayOfWeek" | "startTime" | "endTime"
>

type BuildScheduleInputParams = {
  group: ScheduleGroup
  linkedStaff: ScheduleStaffMember[]
  availability: ScheduleAvailability[]
  openingHours: ScheduleOpeningHours[]
  rules: ScheduleRule[]
}

function toTimeValue(time: string) {
  return time.slice(0, 5)
}

function buildScheduleInput({
  group,
  linkedStaff,
  availability,
  openingHours,
  rules,
}: BuildScheduleInputParams): ScheduleInput {
  return scheduleInputSchema.parse({
    group: {
      id: group.id,
      name: group.name,
    },
    openingHours: openingHours.map((interval) => ({
      ...interval,
      startTime: toTimeValue(interval.startTime),
      endTime: toTimeValue(interval.endTime),
    })),
    staff: linkedStaff.map((staffMember) => ({
      ...staffMember,
      availability: availability
        .filter((entry) => entry.staffMemberId === staffMember.id)
        .map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          startAvailabilityTime: toTimeValue(entry.startAvailabilityTime),
          endAvailabilityTime: toTimeValue(entry.endAvailabilityTime),
        })),
    })),
    rules: rules.map((rule) => ({
      ...rule,
      startTime: toTimeValue(rule.startTime),
      endTime: toTimeValue(rule.endTime),
    })),
  })
}

export { buildScheduleInput }

export type {
  BuildScheduleInputParams,
  ScheduleAvailability,
  ScheduleGroup,
  ScheduleOpeningHours,
  ScheduleRule,
  ScheduleStaffMember,
}
