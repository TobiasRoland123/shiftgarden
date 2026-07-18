import { formatValidationFeedbackForRetry } from "@/lib/shift-schedule/action-validation"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import type { ScheduleValidationResult } from "@/lib/shift-schedule/validation-types"

type ValidatedGenerationAttempt = {
  attemptNumber: number
  plan: GeneratedSchedule
  validation: ScheduleValidationResult
}

async function generateWithValidationRetry({
  basePrompt,
  generate,
  onValidationFailed,
  scheduleInput,
  validate,
}: {
  basePrompt: string
  generate: (prompt: string) => Promise<GeneratedSchedule>
  onValidationFailed: (attempt: ValidatedGenerationAttempt) => Promise<void>
  scheduleInput: ScheduleInput
  validate: (params: {
    scheduleInput: ScheduleInput
    generatedSchedule: GeneratedSchedule
  }) => ScheduleValidationResult
}): Promise<ValidatedGenerationAttempt> {
  const firstPlan = await generate(basePrompt)
  const firstAttempt = {
    attemptNumber: 1,
    plan: firstPlan,
    validation: validate({ scheduleInput, generatedSchedule: firstPlan }),
  }

  if (firstAttempt.validation.valid) {
    return firstAttempt
  }

  await onValidationFailed(firstAttempt)

  const retryPlan = await generate(`${basePrompt}

The previous generated schedule failed deterministic validation. Return a corrected full JSON schedule. Fix these validation issues:
${formatValidationFeedbackForRetry(firstAttempt.validation)}`)
  const retryAttempt = {
    attemptNumber: 2,
    plan: retryPlan,
    validation: validate({ scheduleInput, generatedSchedule: retryPlan }),
  }

  if (!retryAttempt.validation.valid) {
    await onValidationFailed(retryAttempt)
  }

  return retryAttempt
}

export { generateWithValidationRetry }
export type { ValidatedGenerationAttempt }
