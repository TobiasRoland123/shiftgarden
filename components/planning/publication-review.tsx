"use client"

import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Link, useRouter } from "@/i18n/navigation"
import type { PeriodViewData, PlanningAction } from "./types"
import {
  classes,
  localizedActionError,
  localizedIssue,
  Notice,
  periodLabel,
  usePlanningLocale,
} from "./shared"

export function PublicationReview({
  data,
  action,
}: {
  data: PeriodViewData
  action?: PlanningAction
}) {
  const t = useTranslations("planning")
  const locale = usePlanningLocale()
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const blocked = Boolean(
    data.issues.length || data.inputsStale || data.readOnly
  )
  function publish() {
    if (!action) return
    setError(undefined)
    startTransition(async () => {
      const result = await action({
        type: "publish",
        periodId: data.period.id,
        requestId: crypto.randomUUID(),
        expectedRevision: data.draftRevision,
        reviewedFingerprint: data.reviewedFingerprint,
        expectedBaseVersionId: data.expectedBaseVersionId,
      })
      if (!result.ok) setError(localizedActionError(result, t))
      else router.push(`/planning/periods/${data.period.id}`)
    })
  }
  return (
    <main className="flex min-h-svh flex-col gap-8 p-6 lg:p-10">
      <header>
        <Link
          href={`/planning/periods/${data.period.id}?edit=1`}
          className="inline-flex min-h-12 items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("backToCalendar")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("publicationReview")}
          </h1>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
            {t("finalCheck")}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.group.name} ·{" "}
          {periodLabel(data.period.startDate, data.period.endDate, locale)}
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <ReviewCheck
          label={t("currentValidation")}
          ok={!data.issues.length}
          detail={
            data.issues.length
              ? t("errorsToResolve", { count: data.issues.length })
              : t("noErrors")
          }
        />
        <ReviewCheck
          label={t("inputFreshness")}
          ok={!data.inputsStale}
          detail={
            data.inputsStale ? t("inputsChangedShort") : t("inputsChecked")
          }
        />
        <ReviewCheck
          label={t("commitments")}
          ok={
            !data.issues.some(
              (issue) =>
                issue.code === "external_overlap" ||
                issue.code === "max_hours_exceeded"
            )
          }
          detail={t("commitmentsChecked")}
        />
      </section>
      {data.issues.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">{t("publicationBlocked")}</h2>
          {data.issues.map((issue, index) => (
            <Notice
              issue={localizedIssue(issue, t)}
              key={`${issue.code}-${index}`}
            />
          ))}
        </section>
      ) : null}
      {data.warnings.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">{t("validationWarnings")}</h2>
          {data.warnings.map((issue, index) => (
            <Notice
              warning
              issue={localizedIssue(issue, t)}
              key={`${issue.code}-${index}`}
            />
          ))}
        </section>
      ) : null}
      {data.aiNotes.length ? (
        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">{t("proposalNotes")}</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {data.aiNotes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.sourceChanges.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">{t("changedSources")}</h2>
          {data.sourceChanges.map((source) => (
            <Notice warning key={source.sourceId} issue={source.description} />
          ))}
        </section>
      ) : null}
      {!blocked ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <h2 className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5" />
            {t("readyToPublish")}
          </h2>
          <p className="mt-2 text-sm">{t("publishDescription")}</p>
        </section>
      ) : null}
      <section className="rounded-xl border">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">{t("exactDraftChanges")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.expectedBaseVersionId
              ? t("changesFromOfficial")
              : t("changesFromGeneration")}
          </p>
        </div>
        {data.publicationChanges.length ? (
          <div className="divide-y">
            {data.publicationChanges.map((change, index) => {
              const format = (shift: NonNullable<typeof change.before>) => {
                const person = data.staff.find(
                  (item) => item.id === shift.staffId
                )
                return `${person ? `${person.firstName} ${person.lastName}` : shift.staffId} · ${shift.date} · ${shift.startTime}-${shift.endTime} · ${shift.locked ? t("locked") : t("unlocked")}`
              }
              return (
                <article
                  key={`${change.type}-${change.before?.id ?? change.after?.id}-${index}`}
                  className="grid gap-2 px-5 py-4 sm:grid-cols-[8rem_1fr_1fr]"
                >
                  <div className="text-sm font-medium">
                    {t(`proposal.${change.type}`)}
                  </div>
                  <div className="rounded bg-muted/50 p-2 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {t("before")}
                    </div>
                    {change.before ? format(change.before) : t("none")}
                  </div>
                  <div className="rounded bg-primary/5 p-2 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {t("after")}
                    </div>
                    {change.after ? format(change.after) : t("removed")}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            {t("noDraftChanges")}
          </p>
        )}
      </section>
      <section className="rounded-xl border">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">{t("draftSummary")}</h2>
        </div>
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t("revision")}</dt>
            <dd className="mt-1 font-medium">{data.draftRevision}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("shifts")}</dt>
            <dd className="mt-1 font-medium">{data.shifts.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("versionHistory")}</dt>
            <dd className="mt-1 font-medium">{data.history.length}</dd>
          </div>
        </dl>
      </section>
      {error ? <Notice issue={error} /> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button asChild variant="ghost">
          <Link href={`/planning/periods/${data.period.id}?edit=1`}>
            <ArrowLeft />
            {t("backToCalendar")}
          </Link>
        </Button>
        <Button disabled={pending || blocked} onClick={publish}>
          {pending ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />}
          {pending ? t("publishing") : t("publish")}
        </Button>
      </div>
    </main>
  )
}

function ReviewCheck({
  label,
  ok,
  detail,
}: {
  label: string
  ok: boolean
  detail: string
}) {
  return (
    <div
      className={classes(
        "rounded-xl border p-4",
        ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {ok ? (
          <CheckCircle2 className="size-4 text-emerald-700" />
        ) : (
          <AlertCircle className="size-4 text-red-700" />
        )}
        {label}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}
