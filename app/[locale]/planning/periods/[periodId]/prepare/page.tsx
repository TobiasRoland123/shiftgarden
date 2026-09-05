import { notFound } from "next/navigation"
import { Preparation } from "@/components/planning/planning-components"
import { getPreparation } from "@/lib/planning/view"
import { planningAction } from "../../../actions"

export default async function SavedPreparationPage({
  params,
}: {
  params: Promise<{ periodId: string }>
}) {
  const { periodId } = await params
  const data = await getPreparation(periodId)
  if (!data) notFound()
  return <Preparation data={data} action={planningAction} />
}
