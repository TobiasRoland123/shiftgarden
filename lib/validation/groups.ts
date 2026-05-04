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
    uniformWeek: z.boolean().default(false).optional(),
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
    minPedagogues: z.number().int().min(0).max(50),
    templateId: z.string().uuid().optional(),
  })
  .refine((r) => r.startTime < r.endTime, {
    message: "Validation.endAfterStart",
    path: ["endTime"],
  })
  .refine((r) => r.minPedagogues <= r.minStaff, {
    message: "Validation.pedagogLeStaff",
    path: ["minPedagogues"],
  })

export type GroupInput = z.infer<typeof groupInputSchema>
export type StaffingRuleInput = z.infer<typeof staffingRuleInputSchema>
