"use server"

import { revalidatePath } from "next/cache"
import { generateText, Output } from "ai"

import { locales } from "@/i18n/routing"
import { db } from "@/lib/db"
import {
  shiftScheduleGenerationAttempts,
  shiftSchedulePlans,
  shiftScheduleShifts,
} from "@/lib/db/schema"
import { getScheduleInputByGroupId } from "@/lib/shift-schedule/data"
import { generateWithValidationRetry } from "@/lib/shift-schedule/generate-with-retry"
import { shiftSchedulePrompt } from "@/lib/shift-schedule/prompt"
import { schedulePlanReviewSchema } from "@/lib/shift-schedule/review-types"
import type {
  AcceptSchedulePlanState,
  GenerateSchedulePlanState,
  ScheduleGenerationFailure,
} from "@/lib/shift-schedule/review-types"
import {
  buildShiftScheduleGenerationAttemptInsertValues,
  buildShiftSchedulePlanInsertValues,
  buildShiftScheduleShiftInsertValues,
} from "@/lib/shift-schedule/save"
import { generatedScheduleSchema } from "@/lib/shift-schedule/schemas"
import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"
import { validateGeneratedSchedule } from "@/lib/shift-schedule/validate-generated"
import { validateScheduleInputSupport } from "@/lib/shift-schedule/validate-input"
import { getValidationWarnings } from "@/lib/shift-schedule/validation-types"
import { uuidPattern } from "@/lib/uuid"

const shiftScheduleModel = "openai/gpt-5.6-luna"

function getGenerateScheduleFailure(error: unknown): ScheduleGenerationFailure {
  if (!(error instanceof Error)) {
    return { code: "unknown" }
  }

  const message = error.message

  if (error.name === "ZodError") {
    return { code: "schema_mismatch" }
  }

  if (/api key|auth|unauthorized|forbidden|401|403/i.test(message)) {
    return { code: "gateway_auth" }
  }

  if (
    /model.*not found|not found.*model|unknown model|unsupported model|404/i.test(
      message
    )
  ) {
    return { code: "model_rejected", detail: shiftScheduleModel }
  }

  if (/failed query|database|relation .* does not exist/i.test(message)) {
    return { code: "database" }
  }

  return { code: "gateway_error", detail: message }
}

function revalidateSavedPlans() {
  revalidatePath("/shift-schedule/plans")

  for (const locale of locales) {
    revalidatePath(`/${locale}/shift-schedule/plans`)
  }
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

/**
 * Produces a generated schedule plan for review. It never writes a schedule
 * plan or its shifts; only the generation attempt audit trail is recorded here.
 * Saving happens in `acceptSchedulePlan` once a user accepts the plan.
 */
async function generateSchedulePlan(
  _previousState: unknown,
  formData: FormData
): Promise<GenerateSchedulePlanState> {
  const groupId = formData.get("groupId")?.toString()

  if (!groupId || !uuidPattern.test(groupId)) {
    return { status: "failed", failure: { code: "invalid_group" } }
  }

  const scheduleInput = await getScheduleInputByGroupId(groupId)

  if (!scheduleInput) {
    return { status: "failed", failure: { code: "group_not_found" } }
  }

  const inputSupportValidation = validateScheduleInputSupport(scheduleInput)

  if (!inputSupportValidation.valid) {
    return {
      status: "failed",
      failure: {
        code: "input_not_supported",
        issues: inputSupportValidation.issues,
      },
    }
  }

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return { status: "failed", failure: { code: "gateway_not_configured" } }
  }

  try {
    const basePrompt = `Schedule input JSON:\n${JSON.stringify(scheduleInput, null, 2)}`
    const generationId = crypto.randomUUID()
    const attempt = await generateWithValidationRetry({
      basePrompt,
      generate: (prompt) => generateParsedSchedulePlan({ prompt }),
      scheduleInput,
      validate: validateGeneratedSchedule,
      onValidationFailed: async ({ attemptNumber, plan, validation }) => {
        await db.insert(shiftScheduleGenerationAttempts).values(
          buildShiftScheduleGenerationAttemptInsertValues({
            attemptNumber,
            generationId,
            model: shiftScheduleModel,
            plan,
            scheduleInput,
            validation,
          })
        )
      },
    })

    return {
      status: "reviewed",
      review: {
        plan: attempt.plan,
        scheduleInput,
        validationErrors: attempt.validation.issues.filter(
          (issue) => issue.severity === "error"
        ),
        validationWarnings: getValidationWarnings(
          inputSupportValidation,
          attempt.validation
        ),
        generationId,
        attemptNumber: attempt.attemptNumber,
      },
    }
  } catch (error) {
    return { status: "failed", failure: getGenerateScheduleFailure(error) }
  }
}

/**
 * Saves a reviewed plan. The review travels through client state, so the plan
 * is re-validated here against a freshly loaded schedule input rather than the
 * copy the client sent back.
 */
async function acceptSchedulePlan(
  _previousState: unknown,
  formData: FormData
): Promise<AcceptSchedulePlanState> {
  const rawReview = formData.get("review")?.toString()

  if (!rawReview) {
    return { status: "failed", failure: { code: "invalid_review" } }
  }

  let parsedReview

  try {
    parsedReview = schedulePlanReviewSchema.parse(JSON.parse(rawReview))
  } catch {
    return { status: "failed", failure: { code: "invalid_review" } }
  }

  const groupId = parsedReview.plan.groupId

  if (!uuidPattern.test(groupId)) {
    return { status: "failed", failure: { code: "invalid_group" } }
  }

  const scheduleInput = await getScheduleInputByGroupId(groupId)

  if (!scheduleInput) {
    return { status: "failed", failure: { code: "group_not_found" } }
  }

  const inputSupportValidation = validateScheduleInputSupport(scheduleInput)

  if (!inputSupportValidation.valid) {
    return {
      status: "failed",
      failure: {
        code: "input_not_supported",
        issues: inputSupportValidation.issues,
      },
    }
  }

  const validation = validateGeneratedSchedule({
    scheduleInput,
    generatedSchedule: parsedReview.plan,
  })

  if (!validation.valid) {
    return {
      status: "failed",
      failure: {
        code: "plan_no_longer_valid",
        issues: validation.issues.filter((issue) => issue.severity === "error"),
      },
    }
  }

  const acceptedPlan = {
    ...parsedReview.plan,
    validationWarnings: getValidationWarnings(
      inputSupportValidation,
      validation
    ),
  }

  try {
    const planId = await db.transaction(async (tx) => {
      const [savedPlan] = await tx
        .insert(shiftSchedulePlans)
        .values(
          buildShiftSchedulePlanInsertValues({
            model: shiftScheduleModel,
            plan: acceptedPlan,
            scheduleInput,
          })
        )
        .returning({ id: shiftSchedulePlans.id })
      const shifts = buildShiftScheduleShiftInsertValues({
        plan: parsedReview.plan,
        planId: savedPlan.id,
      })

      if (shifts.length > 0) {
        await tx.insert(shiftScheduleShifts).values(shifts)
      }

      await tx.insert(shiftScheduleGenerationAttempts).values(
        buildShiftScheduleGenerationAttemptInsertValues({
          acceptedPlanId: savedPlan.id,
          attemptNumber: parsedReview.attemptNumber,
          generationId: parsedReview.generationId,
          model: shiftScheduleModel,
          plan: parsedReview.plan,
          scheduleInput,
          validation,
        })
      )

      return savedPlan.id
    })

    revalidateSavedPlans()

    return { status: "accepted", planId }
  } catch (error) {
    return { status: "failed", failure: getGenerateScheduleFailure(error) }
  }
}

export { acceptSchedulePlan, generateSchedulePlan }
