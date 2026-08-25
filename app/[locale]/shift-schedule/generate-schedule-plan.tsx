"use client"

import { useActionState } from "react"
import { CircleAlert } from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import type {
  AcceptSchedulePlanState,
  GenerateSchedulePlanState,
  ScheduleGenerationFailure,
} from "@/lib/shift-schedule/review-types"
import { acceptSchedulePlan, generateSchedulePlan } from "./actions"
import { ReviewResult } from "./review-result"
import { ValidationIssueList } from "./validation-issue-list"

const initialGenerateState: GenerateSchedulePlanState = { status: "idle" }
const initialAcceptState: AcceptSchedulePlanState = { status: "idle" }

function FailureAlert({
  failure,
  scheduleInput,
}: {
  failure: ScheduleGenerationFailure
  scheduleInput?: ScheduleInput
}) {
  const t = useTranslations("shiftSchedule.failure")

  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>
        <p>{t(failure.code, { detail: failure.detail ?? "" })}</p>
        {failure.issues && failure.issues.length > 0 ? (
          <ValidationIssueList
            issues={failure.issues}
            scheduleInput={scheduleInput}
          />
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

function GeneratingState() {
  const t = useTranslations("shiftSchedule")

  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div>
        <h3 className="font-medium">{t("generatingTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("generatingDescription")}
        </p>
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

/**
 * Generation produces a plan for review and saves nothing. Only the explicit
 * accept action persists an accepted plan.
 */
function GenerateSchedulePlan({
  canGenerate,
  groupId,
  scheduleInput,
}: {
  canGenerate: boolean
  groupId: string
  scheduleInput: ScheduleInput
}) {
  const t = useTranslations("shiftSchedule")
  const [generateState, generateAction, isGenerating] = useActionState(
    generateSchedulePlan,
    initialGenerateState
  )
  const [acceptState, acceptAction, isAccepting] = useActionState(
    acceptSchedulePlan,
    initialAcceptState
  )
  const hasReview = generateState.status === "reviewed"

  return (
    <section className="flex flex-col gap-6 rounded-lg border p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-medium">
            {hasReview ? t("reviewTitle") : t("generatedTitle")}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            {hasReview ? t("reviewDescription") : t("generatedDescription")}
          </p>
        </div>
        <form action={generateAction}>
          <input type="hidden" name="groupId" value={groupId} />
          <Button type="submit" disabled={isGenerating || !canGenerate}>
            {isGenerating
              ? t("generatingPlan")
              : hasReview
                ? t("regenerate")
                : t("generatePlan")}
          </Button>
        </form>
      </div>

      {!canGenerate ? (
        <p className="text-sm text-destructive">{t("generateBlockedReason")}</p>
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-6">
        {isGenerating ? <GeneratingState /> : null}

        {!isGenerating && generateState.status === "failed" ? (
          <FailureAlert
            failure={generateState.failure}
            scheduleInput={scheduleInput}
          />
        ) : null}

        {!isGenerating && generateState.status === "reviewed" ? (
          <ReviewResult
            acceptState={acceptState}
            formAction={acceptAction}
            isAccepting={isAccepting}
            review={generateState.review}
          />
        ) : null}

        {!isGenerating && generateState.status === "idle" ? (
          <p className="text-sm text-muted-foreground">
            {t("generatedEmptyDescription")}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export { GenerateSchedulePlan }
