"use client"

import { ArrowLeft, CalendarDays, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import type { PlanningOverviewData } from "./types"
import { periodLabel, StatusBadge, usePlanningLocale } from "./shared"

export function PlanningOverview({ data }: { data: PlanningOverviewData }) {
  const t = useTranslations("planning")
  const locale = usePlanningLocale()
  return (
    <main className="flex min-h-svh flex-col gap-8 p-6 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{t("title")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {t("overviewHeading")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button asChild>
          <a href="#groups">
            <Plus />
            {t("createSchedule")}
          </a>
        </Button>
      </header>
      {!data.groups.length ? (
        <section className="rounded-xl border border-dashed p-8">
          <h2 className="font-medium">{t("noGroups")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("noGroupsDescription")}
          </p>
          <Button className="mt-4" asChild>
            <Link href="/groups/new">{t("createGroup")}</Link>
          </Button>
        </section>
      ) : (
        <section
          id="groups"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {data.groups.map((group) => (
            <article
              key={group.id}
              className="rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    <Link
                      className="hover:underline"
                      href={`/planning/groups/${group.id}`}
                    >
                      {group.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("groupSummary", {
                      staff: group.activeStaffCount,
                      periods: group.periods.length,
                    })}
                  </p>
                </div>
                <CalendarDays aria-hidden className="size-5 text-primary" />
              </div>
              <div className="mt-5 space-y-2">
                {group.periods.slice(0, 3).map((period) => (
                  <Link
                    key={period.id}
                    href={`/planning/periods/${period.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span>
                      {periodLabel(period.startDate, period.endDate, locale)}
                    </span>
                    <StatusBadge
                      status={period.status}
                      uncoveredDates={period.uncoveredDates.length}
                    />
                  </Link>
                ))}
                {!group.periods.length ? (
                  <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                    {t("noPeriods")}
                  </p>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/planning/groups/${group.id}/new`}>
                    {t("newSchedule")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/planning/groups/${group.id}`}>
                    {t("viewGroup")}
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
      {data.legacyPlanCount ? (
        <Button asChild variant="link" className="w-fit px-0">
          <Link href="/shift-schedule/plans">
            <ArrowLeft />
            {t("legacyPlans", { count: data.legacyPlanCount })}
          </Link>
        </Button>
      ) : null}
    </main>
  )
}

export function GroupPlanning({
  group,
  periods,
}: {
  group: { id: string; name: string }
  periods: PlanningOverviewData["groups"][number]["periods"]
}) {
  const t = useTranslations("planning")
  const locale = usePlanningLocale()
  return (
    <main className="flex min-h-svh flex-col gap-8 p-6 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/planning"
            className="inline-flex min-h-12 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t("title")}
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {group.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("groupDescription")}
          </p>
        </div>
        <Button asChild>
          <Link href={`/planning/groups/${group.id}/new`}>
            <Plus />
            {t("createSchedule")}
          </Link>
        </Button>
      </header>
      <section className="rounded-xl border">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">{t("datedPeriods")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("periodsDescription")}
          </p>
        </div>
        {!periods.length ? (
          <p className="p-8 text-sm text-muted-foreground">
            {t("noPeriodsForGroup")}
          </p>
        ) : (
          <div className="divide-y">
            {periods.map((period) => (
              <Link
                href={`/planning/periods/${period.id}`}
                key={period.id}
                className="flex min-h-16 flex-col justify-center gap-3 px-5 py-4 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">
                    {periodLabel(period.startDate, period.endDate, locale)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {period.uncoveredDates.length
                      ? t("datesNeedCoverage", {
                          count: period.uncoveredDates.length,
                        })
                      : period.status === "published"
                        ? t("publishedVersion", {
                            version: period.publishedVersion ?? 1,
                          })
                        : t("readyToContinue")}
                  </div>
                </div>
                <StatusBadge
                  status={period.status}
                  uncoveredDates={period.uncoveredDates.length}
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
