import { z } from "zod"

export const ROLES = ["pedagogue", "assistant", "substitute"] as const
export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

const timeStringSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM")

export const availabilityWindowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
  })
  .refine((w) => w.startTime < w.endTime, {
    message: "End must be after start",
    path: ["endTime"],
  })

export const staffInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.union([z.email(), z.literal("")]),
  role: roleSchema,
  weeklyContractHours: z.number().int().min(0).max(60),
  active: z.boolean(),
})

export const setAvailabilityInputSchema = z.object({
  staffId: z.string().min(1),
  windows: z.array(availabilityWindowSchema),
})

export type StaffInput = z.infer<typeof staffInputSchema>
export type AvailabilityWindow = z.infer<typeof availabilityWindowSchema>
export type SetAvailabilityInput = z.infer<typeof setAvailabilityInputSchema>
