import { z } from "zod"

const daysOfWeek = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

const staffRoles = ["pedagog", "assistant", "substitute"] as const
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected time in HH:mm format")

const scheduleInputSchema = z.object({
  group: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  openingHours: z.array(
    z.object({
      dayOfWeek: z.enum(daysOfWeek),
      startTime: timeSchema,
      endTime: timeSchema,
    })
  ),
  staff: z.array(
    z.object({
      id: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      role: z.enum(staffRoles),
      maxHoursPerWeek: z.number().int().positive(),
      active: z.boolean(),
      availability: z.array(
        z.object({
          dayOfWeek: z.enum(daysOfWeek),
          startAvailabilityTime: timeSchema,
          endAvailabilityTime: timeSchema,
        })
      ),
    })
  ),
  rules: z.array(
    z.object({
      dayOfWeek: z.enum(daysOfWeek),
      startTime: timeSchema,
      endTime: timeSchema,
      minPedagogs: z.number().int().nonnegative(),
      minStaff: z.number().int().nonnegative(),
    })
  ),
})

const generatedScheduleSchema = z.object({
  groupId: z.string().min(1).describe("The id of the group being scheduled."),
  days: z
    .array(
      z.object({
        dayOfWeek: z
          .enum(daysOfWeek)
          .describe("The day of the week these shifts belong to."),
        shifts: z.array(
          z.object({
            staffId: z
              .string()
              .min(1)
              .describe("The id of the scheduled staff member."),
            startTime: timeSchema.describe("Shift start time in HH:mm format."),
            endTime: timeSchema.describe("Shift end time in HH:mm format."),
          })
        ),
      })
    )
    .describe("Generated shifts grouped by day of the week."),
  warnings: z
    .array(z.string())
    .describe(
      "Only actual scheduling problems or unmet constraints. Use an empty array when the schedule satisfies the hard constraints."
    ),
})

type ScheduleInput = z.infer<typeof scheduleInputSchema>
type GeneratedSchedule = z.infer<typeof generatedScheduleSchema>

export { daysOfWeek, generatedScheduleSchema, scheduleInputSchema, timeSchema }

export type { GeneratedSchedule, ScheduleInput }
