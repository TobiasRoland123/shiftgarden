import { z } from "zod"

import {
  generatedScheduleSchema,
  scheduleInputSchema,
} from "@/lib/shift-schedule/schemas"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import type {
  ScheduleValidationIssue,
  ScheduleValidationWarning,
} from "@/lib/shift-schedule/validation-types"

/**
 * Why generation could not produce a plan at all. Rendered through next-intl as
 * `shiftSchedule.failure.<code>`; `detail` carries the untranslatable part such
 * as a model name or a gateway message.
 */
type ScheduleGenerationFailureCode =
  | "invalid_group"
  | "group_not_found"
  | "input_not_supported"
  | "invalid_review"
  | "plan_no_longer_valid"
  | "gateway_not_configured"
  | "schema_mismatch"
  | "gateway_auth"
  | "model_rejected"
  | "database"
  | "gateway_error"
  | "unknown"

type ScheduleGenerationFailure = {
  code: ScheduleGenerationFailureCode
  detail?: string
  issues?: ScheduleValidationIssue[]
}

/**
 * A generated schedule plan handed to the user for review. It is not persisted.
 * Zero `validationErrors` means the plan is an accepted plan and may be saved.
 */
type SchedulePlanReview = {
  plan: GeneratedSchedule
  scheduleInput: ScheduleInput
  validationErrors: ScheduleValidationIssue[]
  validationWarnings: ScheduleValidationWarning[]
  generationId: string
  attemptNumber: number
}

type GenerateSchedulePlanState =
  | { status: "idle" }
  | { status: "failed"; failure: ScheduleGenerationFailure }
  | { status: "reviewed"; review: SchedulePlanReview }

type AcceptSchedulePlanState =
  | { status: "idle" }
  | { status: "failed"; failure: ScheduleGenerationFailure }
  | { status: "accepted"; planId: string }

const validationIssueSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  dayOfWeek: z.string().optional(),
  staffId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  ruleIndex: z.number().int().optional(),
})

/**
 * A review round-trips through client state between generation and acceptance,
 * so the accept action re-parses it rather than trusting its shape.
 */
const schedulePlanReviewSchema = z.object({
  plan: generatedScheduleSchema,
  scheduleInput: scheduleInputSchema,
  validationErrors: z.array(validationIssueSchema),
  validationWarnings: z.array(validationIssueSchema),
  generationId: z.string().uuid(),
  attemptNumber: z.number().int().positive(),
})

function isAcceptedReview(review: SchedulePlanReview) {
  return review.validationErrors.length === 0
}

export { isAcceptedReview, schedulePlanReviewSchema, validationIssueSchema }

export type {
  AcceptSchedulePlanState,
  GenerateSchedulePlanState,
  ScheduleGenerationFailure,
  ScheduleGenerationFailureCode,
  SchedulePlanReview,
}
