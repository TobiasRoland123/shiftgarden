import { z } from "zod"

export const WEEKDAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Validation.timeFormat")

export const groupInputSchema = z
  .object({
    name: z.string().min(1, "Validation.nameRequired"),
    openTime: timeStringSchema,
    closeTime: timeStringSchema,
  })
  .refine((g) => g.openTime < g.closeTime, {
    message: "Validation.endAfterStart",
    path: ["closeTime"],
  })

export const staffingRuleInputSchema = z
  .object({
    groupId: z.string().min(1),
    weekday: z.number().int().min(0).max(6),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    minStaff: z.number().int().min(0).max(50),
    minPedagoger: z.number().int().min(0).max(50),
  })
  .refine((r) => r.startTime < r.endTime, {
    message: "Validation.endAfterStart",
    path: ["endTime"],
  })
  .refine((r) => r.minPedagoger <= r.minStaff, {
    message: "Validation.pedagogLeStaff",
    path: ["minPedagoger"],
  })

export type GroupInput = z.infer<typeof groupInputSchema>
export type StaffingRuleInput = z.infer<typeof staffingRuleInputSchema>
