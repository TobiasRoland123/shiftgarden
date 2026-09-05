import { notFound, redirect } from "next/navigation"
import { CalendarWorkspace } from "@/components/planning/planning-components"
import { getPlanningPeriod } from "@/lib/planning/view"
import { planningAction } from "../../actions"

export default async function PlanningPeriodPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; periodId: string }>
  searchParams: Promise<{ edit?: string; version?: string }>
}) {
  const { locale, periodId } = await params
  const query = await searchParams
  const version = query.version ? Number(query.version) : undefined
  const data = await getPlanningPeriod(periodId, {
    edit: query.edit === "1",
    version: Number.isFinite(version) ? version : undefined,
  })
  if (!data) notFound()
  if (
    !query.version &&
    (data.draftState === "preparation" ||
      data.draftState === "failed" ||
      data.draftState === "generating")
  )
    redirect(
      `${locale === "en" ? "" : `/${locale}`}/planning/periods/${periodId}/prepare`
    )
  return <CalendarWorkspace data={data} action={planningAction} />
}
