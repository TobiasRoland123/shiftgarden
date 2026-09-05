"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import type {
  PlanningAction,
  PlanningActionCommand,
  PlanningActionResult,
} from "./types"
import type { ValidationIssue } from "@/lib/planning/contracts"

type PlanningTranslator = ReturnType<typeof useTranslations<"planning">>

const issueKeys: Record<string, string> = {
  min_staff_unmet: "issues.minStaff",
  min_pedagogs_unmet: "issues.minPedagogs",
  outside_availability: "issues.availability",
  max_hours_exceeded: "issues.hours",
  overlapping_shift: "issues.overlap",
  external_overlap: "issues.external",
  shift_outside_opening_hours: "issues.opening",
  fifo_end_order_inversion: "issues.fifo",
  stale_proposal: "issues.stale",
  invalid_period_range: "issues.period",
  staffing_rule_outside_opening_hours: "issues.ruleOutsideOpening",
  conflicting_replacement: "issues.conflictingReplacement",
  replacement_outside_opening_hours: "issues.replacementOutsideOpening",
  overlapping_counted_event: "issues.eventOverlap",
  group_capacity_shortfall: "issues.capacity",
  group_pedagog_capacity_shortfall: "issues.pedagogCapacity",
  other_draft_conflict: "issues.otherDraft",
  inactive_staff: "issues.inactive",
  unknown_staff: "issues.unknownStaff",
  invalid_shift_time: "issues.invalidTime",
}

const errorKeys: Record<string, string> = {
  invalid_request: "errors.invalidRequest",
  stale_revision: "errors.staleRevision",
  stale_source: "errors.staleSource",
  stale_undo: "errors.staleUndo",
  overlapping_period: "errors.overlappingPeriod",
  period_overlap: "errors.overlappingPeriod",
  validation_failed: "errors.validationFailed",
  stale_inputs: "errors.staleInputs",
  stale_proposal: "errors.staleProposal",
  proposal_missing: "errors.proposalMissing",
  proposal_closed: "errors.proposalClosed",
  operation_failed: "errors.operationFailed",
}

export function localizedIssue(issue: ValidationIssue, t: PlanningTranslator) {
  const key = issueKeys[issue.code]
  return key ? t(key as "issues.minStaff") : issue.message
}

export function localizedActionError(
  result: PlanningActionResult & { ok: false },
  t: PlanningTranslator
) {
  const key = result.code ? errorKeys[result.code] : undefined
  return key ? t(key as "errors.invalidRequest") : result.error
}

export function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ")
}

export function dateLabel(
  value: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions
) {
  const parsed = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat(
    locale,
    options ?? { day: "numeric", month: "short", year: "numeric" }
  ).format(parsed)
}

export function periodLabel(start: string, end: string, locale: string) {
  return `${dateLabel(start, locale)} - ${dateLabel(end, locale)}`
}

export function Notice({
  issue,
  warning = false,
}: {
  issue: ValidationIssue | string
  warning?: boolean
}) {
  const message = typeof issue === "string" ? issue : issue.message
  return (
    <div
      role={warning ? "status" : "alert"}
      className={classes(
        "flex gap-2 rounded-lg border px-3 py-2 text-sm",
        warning
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-red-200 bg-red-50 text-red-950"
      )}
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function StatusBadge({
  status,
  uncoveredDates = 0,
}: {
  status: string
  uncoveredDates?: number
}) {
  const t = useTranslations("planning")
  const labels: Record<string, string> = {
    "not-planned": t("notPlanned"),
    preparation: t("preparing"),
    draft: t("draft"),
    revision: t("revision"),
    stale: t("needsReview"),
    published: t("published"),
  }
  return (
    <span
      className={classes(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "published"
          ? "bg-emerald-100 text-emerald-800"
          : status === "stale" || uncoveredDates > 0
            ? "bg-amber-100 text-amber-900"
            : "bg-muted text-muted-foreground"
      )}
    >
      {uncoveredDates
        ? t("uncovered", { count: uncoveredDates })
        : (labels[status] ?? status)}
    </span>
  )
}

export function ActionButton({
  action,
  command,
  onSuccess,
  onError,
  children,
  ...props
}: {
  action?: PlanningAction
  command: PlanningActionCommand
  onSuccess?: (result: PlanningActionResult & { ok: true }) => void
  onError?: (result: PlanningActionResult & { ok: false }) => void
  children: React.ReactNode
} & React.ComponentProps<typeof Button>) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  function run() {
    if (!action) return
    setError(undefined)
    startTransition(async () => {
      const result = await action(command)
      if (!result.ok) {
        setError(result.error)
        onError?.(result)
      } else onSuccess?.(result)
    })
  }
  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <Button
        {...props}
        type="button"
        disabled={pending || props.disabled}
        onClick={run}
      >
        {pending ? <RefreshCw aria-hidden className="animate-spin" /> : null}
        {children}
      </Button>
      {error ? (
        <span role="alert" className="max-w-72 text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  )
}

export function usePlanningLocale() {
  const locale = useLocale()
  return locale === "da" ? "da-DK" : "en-GB"
}

export function newActorId() {
  if (typeof window === "undefined")
    return "00000000-0000-4000-8000-000000000000"
  const key = "shiftgarden.planning.actor"
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const value = crypto.randomUUID()
  window.sessionStorage.setItem(key, value)
  return value
}

export function minutes(time: string) {
  const [hours, mins] = time.split(":").map(Number)
  return hours * 60 + mins
}

export function clock(total: number) {
  const bounded = Math.max(
    0,
    Math.min(23 * 60 + 59, Math.round(total / 15) * 15)
  )
  return `${String(Math.floor(bounded / 60)).padStart(2, "0")}:${String(bounded % 60).padStart(2, "0")}`
}
