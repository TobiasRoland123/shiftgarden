import { notFound } from "next/navigation"
import { PublicationReview } from "@/components/planning/planning-components"
import { getPlanningPeriod } from "@/lib/planning/view"
import { planningAction } from "../../../actions"

export default async function PlanningReviewPage({
  params,
}: {
  params: Promise<{ periodId: string }>
}) {
  const { periodId } = await params
  const data = await getPlanningPeriod(periodId, { edit: true })
  if (!data) notFound()
  return <PublicationReview data={data} action={planningAction} />
}
