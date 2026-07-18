"use server"

import { generateText, Output } from "ai"
import { and, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { shiftSchedulePlans, shiftScheduleShifts } from "@/lib/db/schema"
import {
  formatValidationFeedbackForRetry,
  formatValidationIssuesForUser,
} from "@/lib/shift-schedule/action-validation"
import { validateCrossGroupConflicts } from "@/lib/shift-schedule/cross-group-conflicts"
import {
  getActivePlanShiftsForWeek,
  getScheduleInputByGroupId,
} from "@/lib/shift-schedule/data"
import { shiftSchedulePrompt } from "@/lib/shift-schedule/prompt"
import {
  buildShiftSchedulePlanInsertValues,
  buildShiftScheduleShiftInsertValues,
} from "@/lib/shift-schedule/save"
import { generatedScheduleSchema } from "@/lib/shift-schedule/schemas"
import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"
import { validateGeneratedSchedule } from "@/lib/shift-schedule/validate-generated"
import { validateScheduleInputSupport } from "@/lib/shift-schedule/validate-input"
import type { ScheduleValidationResult } from "@/lib/shift-schedule/validation-types"
import { isMondayWeekStart } from "@/lib/shift-schedule/week"
import { uuidPattern } from "@/lib/uuid"

const shiftScheduleModel = "openai/gpt-5.6-luna"

class FinalPlanConflictError extends Error {
  constructor(readonly validation: ScheduleValidationResult) {
    super("The generated schedule plan conflicts with another active plan.")
  }
}

function getGenerateScheduleErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message

    if (error.name === "ZodError") {
      return "The AI returned JSON, but it did not match the schedule schema. Try generating again."
    }

    if (/api key|auth|unauthorized|forbidden|401|403/i.test(message)) {
      return "AI Gateway authentication failed. Check that AI_GATEWAY_API_KEY in .env.local is valid, then restart pnpm dev."
    }

    if (
      /model.*not found|not found.*model|unknown model|unsupported model|404/i.test(
        message
      )
    ) {
      return `AI Gateway rejected the model "${shiftScheduleModel}". Choose a model that is enabled for your Vercel AI Gateway account.`
    }

    if (/failed query|database|relation .* does not exist/i.test(message)) {
      return "The AI generated a plan, but it could not be saved to the database. Check that the latest database migrations have been applied."
    }

    return `AI Gateway error: ${message}`
  }

  return "The AI schedule could not be generated because AI Gateway returned an unknown error."
}

async function generateParsedSchedulePlan({
  prompt,
}: {
  prompt: string
}): Promise<GeneratedSchedule> {
  const result = await generateText({
    model: shiftScheduleModel,
    system: shiftSchedulePrompt,
    prompt,
    output: Output.object({
      schema: generatedScheduleSchema,
    }),
    providerOptions: {
      openai: {
        reasoningEffort: "medium",
      },
    },
  })

  return generatedScheduleSchema.parse(result.output)
}

async function generateSchedulePlan(
  _previousState: unknown,
  formData: FormData
) {
  const groupId = formData.get("groupId")?.toString()
  const weekStart = formData.get("weekStart")?.toString()

  if (!groupId || !uuidPattern.test(groupId)) {
    return {
      error: "Choose a valid group before generating a plan.",
    }
  }

  if (!weekStart || !isMondayWeekStart(weekStart)) {
    return {
      error: "Choose a Monday as the plan's week start.",
    }
  }

  const scheduleInput = await getScheduleInputByGroupId(groupId)

  if (!scheduleInput) {
    return {
      error: "That group could not be found. Choose another group.",
    }
  }

  const inputSupportValidation = validateScheduleInputSupport(scheduleInput)

  if (!inputSupportValidation.valid) {
    return {
      error: formatValidationIssuesForUser(inputSupportValidation),
    }
  }

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return {
      error:
        "AI Gateway is not configured. Add AI_GATEWAY_API_KEY to .env.local, then restart pnpm dev.",
    }
  }

  try {
    const basePrompt = `Target week starts Monday ${weekStart}.\nSchedule input JSON:\n${JSON.stringify(scheduleInput, null, 2)}`
    const firstPlan = await generateParsedSchedulePlan({
      prompt: basePrompt,
    })
    const validatePlan = async (generatedSchedule: GeneratedSchedule) => {
      const validation = validateGeneratedSchedule({
        scheduleInput,
        generatedSchedule,
      })

      if (!validation.valid) {
        return validation
      }

      const activePlanShifts = await getActivePlanShiftsForWeek({
        excludedGroupId: groupId,
        staffIds: scheduleInput.staff.map((staff) => staff.id),
        weekStart,
      })

      return validateCrossGroupConflicts({
        activePlanShifts,
        generatedSchedule,
      })
    }
    const firstValidation = await validatePlan(firstPlan)
    let plan = firstPlan

    if (!firstValidation.valid) {
      const retryPlan = await generateParsedSchedulePlan({
        prompt: `${basePrompt}

The previous generated schedule failed deterministic validation. Return a corrected full JSON schedule. Fix these validation issues:
${formatValidationFeedbackForRetry(firstValidation)}`,
      })
      const retryValidation = await validatePlan(retryPlan)

      if (!retryValidation.valid) {
        return {
          error: formatValidationIssuesForUser(retryValidation),
        }
      }

      plan = retryPlan
    }

    const planId = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${weekStart}))`
      )

      const activePlanShifts = await getActivePlanShiftsForWeek({
        database: tx,
        excludedGroupId: groupId,
        staffIds: scheduleInput.staff.map((staff) => staff.id),
        weekStart,
      })
      const finalConflictValidation = validateCrossGroupConflicts({
        activePlanShifts,
        generatedSchedule: plan,
      })

      if (!finalConflictValidation.valid) {
        throw new FinalPlanConflictError(finalConflictValidation)
      }

      await tx
        .update(shiftSchedulePlans)
        .set({ status: "archived" })
        .where(
          and(
            eq(shiftSchedulePlans.groupId, groupId),
            eq(shiftSchedulePlans.weekStart, weekStart),
            eq(shiftSchedulePlans.status, "active")
          )
        )

      const [savedPlan] = await tx
        .insert(shiftSchedulePlans)
        .values(
          buildShiftSchedulePlanInsertValues({
            model: shiftScheduleModel,
            plan,
            scheduleInput,
            weekStart,
          })
        )
        .returning({ id: shiftSchedulePlans.id })
      const shifts = buildShiftScheduleShiftInsertValues({
        plan,
        planId: savedPlan.id,
      })

      if (shifts.length > 0) {
        await tx.insert(shiftScheduleShifts).values(shifts)
      }

      return savedPlan.id
    })

    return {
      plan,
      planId,
      planJson: JSON.stringify(plan, null, 2),
      weekStart,
    }
  } catch (error) {
    if (error instanceof FinalPlanConflictError) {
      return {
        error: formatValidationIssuesForUser(error.validation),
      }
    }

    return {
      error: getGenerateScheduleErrorMessage(error),
    }
  }
}

export { generateSchedulePlan }
