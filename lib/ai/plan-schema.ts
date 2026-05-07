import { z } from "zod"

const utcIsoSchema = z.string().datetime({ offset: false })

export const planShiftSchema = z
  .object({
    staffId: z.string().min(1),
    groupId: z.string().min(1),
    start: utcIsoSchema,
    end: utcIsoSchema,
  })
  .refine(({ start, end }) => start < end, {
    message: "Validation.endAfterStart",
    path: ["end"],
  })

export const planSchema = z.object({
  shifts: z.array(planShiftSchema),
})

export type PlanShift = z.infer<typeof planShiftSchema>
export type Plan = z.infer<typeof planSchema>
