"use server"

import { generateText, Output } from "ai"

import { getScheduleInputByGroupId } from "@/lib/shift-schedule/data"
import { shiftSchedulePrompt } from "@/lib/shift-schedule/prompt"
import { generatedScheduleSchema } from "@/lib/shift-schedule/schemas"
import { uuidPattern } from "@/lib/uuid"

const shiftScheduleModel = "openai/gpt-5.4"

function getGenerateScheduleErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message

    if (error.name === "ZodError") {
      return "The AI returned JSON, but it did not match the schedule schema. Try generating again."
    }

    if (/api key|auth|unauthorized|forbidden|401|403/i.test(message)) {
      return "AI Gateway authentication failed. Check that AI_GATEWAY_API_KEY in .env.local is valid, then restart pnpm dev."
    }

    if (/model|not found|404|unsupported/i.test(message)) {
      return `AI Gateway rejected the model "${shiftScheduleModel}". Choose a model that is enabled for your Vercel AI Gateway account.`
    }

    return `AI Gateway error: ${message}`
  }

  return "The AI schedule could not be generated because AI Gateway returned an unknown error."
}

async function generateSchedulePlan(
  _previousState: unknown,
  formData: FormData
) {
  const groupId = formData.get("groupId")?.toString()

  if (!groupId || !uuidPattern.test(groupId)) {
    return {
      error: "Choose a valid group before generating a plan.",
    }
  }

  const scheduleInput = await getScheduleInputByGroupId(groupId)

  if (!scheduleInput) {
    return {
      error: "That group could not be found. Choose another group.",
    }
  }

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return {
      error:
        "AI Gateway is not configured. Add AI_GATEWAY_API_KEY to .env.local, then restart pnpm dev.",
    }
  }

  try {
    const result = await generateText({
      model: shiftScheduleModel,
      system: shiftSchedulePrompt,
      prompt: `Schedule input JSON:\n${JSON.stringify(scheduleInput, null, 2)}`,
      output: Output.object({
        schema: generatedScheduleSchema,
      }),
    })
    const plan = generatedScheduleSchema.parse(result.output)

    return {
      plan,
      planJson: JSON.stringify(plan, null, 2),
    }
  } catch (error) {
    return {
      error: getGenerateScheduleErrorMessage(error),
    }
  }
}

export { generateSchedulePlan }
