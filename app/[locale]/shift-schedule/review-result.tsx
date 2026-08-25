"use client"

import { useState } from "react"
import { CircleAlert, CircleCheck, Info, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import type {
  AcceptSchedulePlanState,
  ScheduleGenerationFailure,
  SchedulePlanReview,
} from "@/lib/shift-schedule/review-types"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import { JsonDisclosure } from "./json-disclosure"
import { ShiftSchedulePlanView } from "./shift-schedule-plan-view"
import { ValidationIssueList } from "./validation-issue-list"
import type { IssueSelection } from "./validation-issue-list"
import { VerdictBanner } from "./verdict-banner"

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

function ReviewResult({
  acceptState,
  formAction,
  isAccepting,
  review,
}: {
  acceptState: AcceptSchedulePlanState
  formAction: (formData: FormData) => void
  isAccepting: boolean
  review: SchedulePlanReview
}) {
  const t = useTranslations("shiftSchedule")
  const [selectedIssue, setSelectedIssue] = useState<IssueSelection>()
  const isAccepted = review.validationErrors.length === 0
  const hasSaved = acceptState.status === "accepted"

  return (
    <div className="flex flex-col gap-6">
      <VerdictBanner validationErrorCount={review.validationErrors.length} />

      {review.validationErrors.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
          <div>
            <h3 className="font-medium">{t("validation.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("validation.description")}
            </p>
          </div>
          <ValidationIssueList
            issues={review.validationErrors}
            onSelect={setSelectedIssue}
            scheduleInput={review.scheduleInput}
            selectedIssue={selectedIssue}
          />
        </section>
      ) : null}

      {review.validationWarnings.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <h3 className="font-medium">{t("validationWarningsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("validationWarningsDescription")}
              </p>
            </div>
          </div>
          <ValidationIssueList
            issues={review.validationWarnings}
            onSelect={setSelectedIssue}
            scheduleInput={review.scheduleInput}
            selectedIssue={selectedIssue}
            tone="warning"
          />
        </section>
      ) : null}

      <ShiftSchedulePlanView
        plan={review.plan}
        scheduleInput={review.scheduleInput}
        selectedIssue={selectedIssue}
      />

      {review.plan.warnings.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <h3 className="font-medium">{t("aiWarningsTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("aiWarningsDescription")}
              </p>
            </div>
          </div>
          <ul className="flex list-disc flex-col gap-1 pl-8 text-sm">
            {review.plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {acceptState.status === "failed" ? (
        <FailureAlert
          failure={acceptState.failure}
          scheduleInput={review.scheduleInput}
        />
      ) : null}

      {hasSaved ? (
        <Alert>
          <CircleCheck />
          <AlertTitle>{t("savedTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{t("savedDescription", { planId: acceptState.planId })}</span>
            <Button asChild size="sm" variant="outline">
              <Link href={`/shift-schedule/plans/${acceptState.planId}`}>
                {t("viewSavedPlan")}
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : isAccepted ? (
        <form action={formAction}>
          <input
            type="hidden"
            name="review"
            value={JSON.stringify({
              plan: review.plan,
              scheduleInput: review.scheduleInput,
              validationErrors: review.validationErrors,
              validationWarnings: review.validationWarnings,
              generationId: review.generationId,
              attemptNumber: review.attemptNumber,
            })}
          />
          <Button type="submit" disabled={isAccepting}>
            {isAccepting ? t("accepting") : t("accept")}
          </Button>
        </form>
      ) : null}

      <JsonDisclosure
        copiedLabel={t("copiedJson")}
        copyLabel={t("copyJson")}
        label={t("developerDetails")}
        entries={[
          {
            title: t("previewTitle"),
            value: JSON.stringify(review.scheduleInput, null, 2),
          },
          {
            title: t("generatedJsonTitle"),
            value: JSON.stringify(review.plan, null, 2),
          },
        ]}
      />
    </div>
  )
}

export { ReviewResult }
