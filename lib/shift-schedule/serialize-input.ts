import type { ScheduleInput } from "@/lib/shift-schedule/schemas"

const scheduleInputFormat = "shiftgarden.schedule-input.v1"

const groupColumns = ["id", "name"] as const
const staffColumns = [
  "id",
  "firstName",
  "lastName",
  "role",
  "maxHoursPerWeek",
  "active",
] as const
const availabilityColumns = [
  "staffId",
  "dayOfWeek",
  "startTime",
  "endTime",
] as const
const ruleColumns = [
  "dayOfWeek",
  "startTime",
  "endTime",
  "minPedagogs",
  "minStaff",
] as const

function serializeScheduleInput(scheduleInput: ScheduleInput) {
  return JSON.stringify({
    format: scheduleInputFormat,
    group: {
      columns: groupColumns,
      rows: [[scheduleInput.group.id, scheduleInput.group.name]],
    },
    staff: {
      columns: staffColumns,
      rows: scheduleInput.staff.map((staffMember) => [
        staffMember.id,
        staffMember.firstName,
        staffMember.lastName,
        staffMember.role,
        staffMember.maxHoursPerWeek,
        staffMember.active,
      ]),
    },
    availability: {
      columns: availabilityColumns,
      rows: scheduleInput.staff.flatMap((staffMember) =>
        staffMember.availability.map((availability) => [
          staffMember.id,
          availability.dayOfWeek,
          availability.startAvailabilityTime,
          availability.endAvailabilityTime,
        ])
      ),
    },
    rules: {
      columns: ruleColumns,
      rows: scheduleInput.rules.map((rule) => [
        rule.dayOfWeek,
        rule.startTime,
        rule.endTime,
        rule.minPedagogs,
        rule.minStaff,
      ]),
    },
  })
}

export { scheduleInputFormat, serializeScheduleInput }
