"use client"

import { ArrowLeft, ExternalLink, RefreshCw, Sparkles } from "lucide-react"
import { FormEvent, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link, useRouter } from "@/i18n/navigation"
import type { PlanningAction, PreparationData } from "./types"
import {
  dateLabel,
  localizedActionError,
  localizedIssue,
  Notice,
  usePlanningLocale,
} from "./shared"

export function Preparation({
  data,
  action,
}: {
  data: PreparationData
  action?: PlanningAction
}) {
  const t = useTranslations("planning")
  const locale = usePlanningLocale()
  const router = useRouter()
  const [startDate, setStartDate] = useState(data.period.startDate)
  const [endDate, setEndDate] = useState(data.period.endDate)
  const [error, setError] = useState<string>()
  const [conflictPeriodId, setConflictPeriodId] = useState<string>()
  const [pending, startTransition] = useTransition()
  const isNew = data.period.id === "new"
  const datesChanged =
    !isNew &&
    (startDate !== data.period.startDate || endDate !== data.period.endDate)
  const blockingIssues = data.inputIssues.filter(
    (issue) => issue.severity === "error"
  )
  const sourceLabel = (source: PreparationData["sources"][number]) =>
    source.description ||
    (source.sourceType === "staffing"
      ? t("staffingRequirement", {
          staff: source.minStaff ?? 0,
          pedagogs: source.minPedagogs ?? 0,
        })
      : t(`exceptionKinds.${source.sourceType as "closure"}`))
  const sourceEffect = (source: PreparationData["sources"][number]) =>
    source.sourceType === "closure"
      ? t("closedAllDay")
      : source.participantCount !== undefined
        ? `${source.effect} · ${t("participantCount", { count: source.participantCount })}`
        : source.effect

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action) return
    if (!startDate || !endDate || endDate < startDate) {
      setError(t("dateRangeError"))
      return
    }
    setError(undefined)
    setConflictPeriodId(undefined)
    startTransition(async () => {
      const saved = isNew
        ? await action({
            type: "savePreparation",
            groupId: data.group.id,
            startDate,
            endDate,
          })
        : await action({
            type: "updatePreparation",
            periodId: data.period.id,
            expectedRevision: data.draftRevision ?? 1,
            startDate,
            endDate,
          })
      if (!saved.ok) {
        setError(localizedActionError(saved, t))
        setConflictPeriodId(saved.conflictPeriodId)
        return
      }
      const periodId = saved.periodId ?? data.period.id
      if (isNew) router.push(`/planning/periods/${periodId}/prepare`)
      else router.refresh()
    })
  }

  function generate() {
    if (!action || isNew || datesChanged) return
    setError(undefined)
    startTransition(async () => {
      const result = await action({
        type: "generate",
        periodId: data.period.id,
        requestId: crypto.randomUUID(),
        expectedRevision: data.draftRevision ?? 1,
      })
      if (!result.ok) setError(localizedActionError(result, t))
      else router.push(`/planning/periods/${data.period.id}?edit=1`)
    })
  }

  function refreshInputs() {
    if (!action || isNew) return
    setError(undefined)
    startTransition(async () => {
      const result = await action({
        type: "refreshInputs",
        periodId: data.period.id,
        expectedRevision: data.draftRevision ?? 1,
      })
      if (!result.ok) setError(localizedActionError(result, t))
      else router.refresh()
    })
  }

  return (
    <main className="flex min-h-svh flex-col gap-8 p-6 lg:p-10">
      <header>
        <Link
          href={`/planning/groups/${data.group.id}`}
          className="inline-flex min-h-12 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {data.group.name}
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">
              {t("newSchedule")}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("preparePeriod")}
            </h1>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {t("preparation")}
          </span>
        </div>
      </header>
      <form onSubmit={submit} className="space-y-8">
        <section className="grid gap-5 rounded-xl border p-5 lg:grid-cols-[1fr_1.2fr]">
          <fieldset>
            <legend className="font-semibold">{t("inclusiveDates")}</legend>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("inclusiveDatesDescription")}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label htmlFor="planning-start" className="text-sm font-medium">
                {t("startDate")}
              </label>
              <label
                htmlFor="planning-end"
                className="hidden text-sm font-medium sm:block"
              >
                {t("endDate")}
              </label>
              <Input
                id="planning-start"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value)
                  setError(undefined)
                }}
                className="min-h-12 text-base"
              />
              <label
                htmlFor="planning-end"
                className="text-sm font-medium sm:hidden"
              >
                {t("endDate")}
              </label>
              <Input
                id="planning-end"
                name="endDate"
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(event) => {
                  setEndDate(event.target.value)
                  setError(undefined)
                }}
                className="min-h-12 text-base"
              />
            </div>
          </fieldset>
          <div className="rounded-lg bg-muted/50 p-4">
            <h2 className="font-semibold">{t("effectiveInputs")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("openingHours")}</dt>
                <dd className="text-right font-medium">
                  {t("patterns", { count: data.effectiveOpeningSummary })}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("coverageRules")}</dt>
                <dd className="text-right font-medium">
                  {t("segments", { count: data.demandSummary })}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("datesAffected")}</dt>
                <dd className="font-medium">{data.affectedDates.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("timezone")}</dt>
                <dd className="font-medium">{data.period.timezone}</dd>
              </div>
            </dl>
            {!isNew ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="link" className="px-0">
                  <Link
                    href={{
                      pathname: "/settings/opening-hours",
                      query: {
                        returnTo: `/planning/periods/${data.period.id}/prepare`,
                      },
                    }}
                  >
                    {t("viewOpeningSettings")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="link">
                  <Link
                    href={{
                      pathname: `/groups/${data.group.id}`,
                      query: {
                        returnTo: `/planning/periods/${data.period.id}/prepare`,
                      },
                    }}
                  >
                    {t("viewGroupSettings")}
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </section>
        {!isNew ? (
          <section className="rounded-xl border">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">{t("planningStaff")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("planningStaffDescription")}
              </p>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {data.staffInputs.map((person) => (
                <Link
                  key={person.id}
                  href={{
                    pathname: person.href as "/staff/[id]",
                    query: {
                      returnTo: `/planning/periods/${data.period.id}/prepare`,
                    },
                  }}
                  className="flex min-h-14 items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50"
                >
                  <div>
                    <div className="text-sm font-medium">{person.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("availabilitySummary", {
                        dates: person.availabilityDates,
                        intervals: person.intervalCount,
                      })}
                    </div>
                  </div>
                  <ExternalLink className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        {data.inputsStale ? (
          <section className="space-y-3">
            <Notice warning issue={t("preparationInputsChanged")} />
            <Button
              type="button"
              variant="outline"
              onClick={refreshInputs}
              disabled={pending}
            >
              <RefreshCw />
              {t("refreshAndReview")}
            </Button>
          </section>
        ) : null}
        {data.inputIssues.length ? (
          <section className="space-y-2">
            <h2 className="font-semibold">
              {blockingIssues.length
                ? t("resolveInputs")
                : t("validationWarnings")}
            </h2>
            {data.inputIssues.map((issue, index) => (
              <Notice
                warning={issue.severity === "warning"}
                issue={localizedIssue(issue, t)}
                key={`${issue.code}-${index}`}
              />
            ))}
          </section>
        ) : null}
        <section className="rounded-xl border">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold">{t("exceptionsAffecting")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("sourceOwnershipDescription")}
              </p>
            </div>
            {!isNew ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={{
                      pathname: "/settings/opening-hours/exceptions/new",
                      query: {
                        returnTo: `/planning/periods/${data.period.id}/prepare`,
                      },
                    }}
                  >
                    {t("addOpeningException")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={{
                      pathname: `/groups/${data.group.id}/exceptions/new`,
                      query: {
                        returnTo: `/planning/periods/${data.period.id}/prepare`,
                      },
                    }}
                  >
                    {t("addStaffingException")}
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
          {!data.sources.length ? (
            <p className="p-5 text-sm text-muted-foreground">
              {isNew ? t("saveToReviewInputs") : t("noExceptionsAffecting")}
            </p>
          ) : (
            <div className="divide-y">
              {data.sources.map((source) => (
                <div
                  key={`${source.sourceId}-${source.date}`}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[8rem_1fr_auto]"
                >
                  <span className="text-sm font-medium">
                    {dateLabel(source.date, locale)}
                  </span>
                  <div>
                    <div className="text-sm font-medium">
                      {sourceLabel(source)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {sourceEffect(source)} ·{" "}
                      {t(`exceptionKinds.${source.sourceType as "closure"}`)}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={{
                        pathname: source.href as "/settings/opening-hours",
                        query: {
                          returnTo: `/planning/periods/${data.period.id}/prepare`,
                        },
                      }}
                    >
                      <ExternalLink />
                      {t("viewSource")}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
        {error ? (
          <div className="space-y-2">
            <Notice issue={error} />
            {conflictPeriodId ? (
              <Button asChild variant="outline">
                <Link href={`/planning/periods/${conflictPeriodId}`}>
                  {t("openConflictingPeriod")}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button asChild variant="ghost">
            <Link href={`/planning/groups/${data.group.id}`}>
              <ArrowLeft />
              {t("backToGroup")}
            </Link>
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              variant={isNew || datesChanged ? "default" : "outline"}
              disabled={pending}
            >
              {pending ? <RefreshCw className="animate-spin" /> : null}
              {isNew ? t("savePreparation") : t("saveDates")}
            </Button>
            {!isNew ? (
              <Button
                type="button"
                onClick={generate}
                disabled={
                  pending ||
                  datesChanged ||
                  data.inputsStale ||
                  Boolean(blockingIssues.length)
                }
              >
                {pending ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {pending ? t("generatingDraft") : t("generateFresh")}
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </main>
  )
}
