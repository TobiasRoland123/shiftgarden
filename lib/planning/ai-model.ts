import { generateText, Output } from "ai"
import { z } from "zod"
import { datedGenerationInstructions, proposalInstructions } from "./generate"
import { isValidDate } from "./dates"

const date = z
  .string()
  .refine(isValidDate, "Use an actual date in YYYY-MM-DD format")
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const shiftFields = {
  staffId: z.string().uuid(),
  startTime: time,
  endTime: time,
}

export const generatedDatedScheduleSchema = z.object({
  groupId: z.string().uuid(),
  days: z.array(z.object({ date, shifts: z.array(z.object(shiftFields)) })),
  warnings: z.array(z.string()),
})

// A full replacement value on update makes the exact before/after review
// independent of provider-specific support for optional object properties.
export const generatedProposalSchema = z.object({
  operations: z.array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("create"), date, ...shiftFields }),
      z.object({
        type: z.literal("update"),
        shiftId: z.string().uuid(),
        date,
        ...shiftFields,
      }),
      z.object({ type: z.literal("delete"), shiftId: z.string().uuid() }),
    ])
  ),
  notes: z.array(z.string()),
})

export type GeneratedDatedSchedule = z.infer<
  typeof generatedDatedScheduleSchema
>
export type GeneratedProposal = z.infer<typeof generatedProposalSchema>

// Preserve the deployment's existing economical scheduling model. Operators can
// choose another enabled Gateway model without editing application code.
export const planningModel =
  process.env.PLANNING_AI_MODEL || "openai/gpt-5.6-luna"

export async function generateDatedSchedule(prompt: string) {
  const { output } = await generateText({
    model: planningModel,
    system: datedGenerationInstructions,
    prompt,
    output: Output.object({ schema: generatedDatedScheduleSchema }),
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(120_000),
  })
  return generatedDatedScheduleSchema.parse(output)
}

export async function generateScheduleProposal(prompt: string) {
  const { output } = await generateText({
    model: planningModel,
    system: proposalInstructions,
    prompt,
    output: Output.object({ schema: generatedProposalSchema }),
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(120_000),
  })
  return generatedProposalSchema.parse(output)
}
