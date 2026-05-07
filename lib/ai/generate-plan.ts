import { openai } from "@ai-sdk/openai"
import { Output, generateText } from "ai"

import { planSchema, type Plan } from "./plan-schema"
import { buildPlannerPrompt } from "./prompt"
import type { PlanningInput } from "./types"

export interface GeneratePlanOptions {
  model?: string
  signal?: AbortSignal
}

export async function generatePlan(
  input: PlanningInput,
  opts: GeneratePlanOptions = {}
): Promise<Plan> {
  const { system, user } = buildPlannerPrompt(input)
  const modelId =
    opts.model ?? process.env.OPENAI_PLANNER_MODEL ?? "gpt-4o"

  const { output } = await generateText({
    model: openai(modelId),
    output: Output.object({ schema: planSchema }),
    system,
    prompt: user,
    abortSignal: opts.signal,
  })

  return output
}
