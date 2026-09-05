import { notFound } from "next/navigation"
import { Preparation } from "@/components/planning/planning-components"
import { getNewPreparation } from "@/lib/planning/view"
import { planningAction } from "../../../actions"

export default async function NewPlanningPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const data = await getNewPreparation(groupId)
  if (!data) notFound()
  return <Preparation data={data} action={planningAction} />
}
