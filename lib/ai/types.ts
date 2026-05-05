import { z } from "zod"
import { roleSchema } from "@/lib/validation/staff"

const utcIsoSchema = z.string().datetime({ offset: false })
const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Validation.timeFormat")
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Validation.dateFormat")

export const planningPeriodSchema = z
  .object({
    startUtc: utcIsoSchema,
    endUtc: utcIsoSchema,
  })
  .refine(
    ({ startUtc, endUtc }) => Date.parse(startUtc) < Date.parse(endUtc),
    {
      message: "Validation.endAfterStart",
      path: ["endUtc"],
    },
  )

export const planningAvailabilityWindowSchema = z
  .object({
    date: dateStringSchema,
    startUtc: utcIsoSchema,
    endUtc: utcIsoSchema,
  })
  .refine(({ startUtc, endUtc }) => startUtc < endUtc, {
    message: "Validation.endAfterStart",
    path: ["endUtc"],
  })

export const staffEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: roleSchema,
  weeklyMaxHours: z.number().int().min(0).max(60),
})

export const absenceTypeSchema = z.enum(["sick", "vacation", "other"])

export const absenceEntrySchema = z.object({
  staffId: z.string().min(1),
  startsAt: utcIsoSchema,
  endsAt: utcIsoSchema,
  type: absenceTypeSchema,
})

export const staffingRuleSchema = z.object({
  startTime: timeStringSchema,
  endTime: timeStringSchema,
  minStaff: z.number().int().min(0),
  minPedagoger: z.number().int().min(0),
})

export const groupEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  openTime: timeStringSchema,
  closeTime: timeStringSchema,
  expectedChildren: z.number().int().min(0),
  staffingRules: z.array(staffingRuleSchema),
})

export const planningRuleSchema = z.object({
  minPedagogueRatio: z.number(),
  minStaffRatio: z.number(),
  breakMinutes: z.number().int().min(0),
  breakThresholdHours: z.number(),
})

export const planningInputSchema = z.object({
  period: planningPeriodSchema,
  staff: z.array(staffEntrySchema),
  availability: z.array(planningAvailabilityWindowSchema),
  absences: z.array(absenceEntrySchema),
  groups: z.array(groupEntrySchema),
  rules: planningRuleSchema,
})

export type PlanningPeriod = z.infer<typeof planningPeriodSchema>
export type PlanningAvailabilityWindow = z.infer<
  typeof planningAvailabilityWindowSchema
>
export type StaffEntry = z.infer<typeof staffEntrySchema>
export type AbsenceType = z.infer<typeof absenceTypeSchema>
export type AbsenceEntry = z.infer<typeof absenceEntrySchema>
export type StaffingRule = z.infer<typeof staffingRuleSchema>
export type GroupEntry = z.infer<typeof groupEntrySchema>
export type PlanningRule = z.infer<typeof planningRuleSchema>
export type PlanningInput = z.infer<typeof planningInputSchema>
