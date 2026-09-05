import { notFound } from "next/navigation"
import { GroupPlanning } from "@/components/planning/planning-components"
import { getPlanningGroup } from "@/lib/planning/view"

export default async function PlanningGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>
}) {
  const { groupId } = await params
  const group = await getPlanningGroup(groupId)
  if (!group) notFound()
  return <GroupPlanning group={group} periods={group.periods} />
}
