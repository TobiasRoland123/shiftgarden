import { getPlanningOverview } from "@/lib/planning/view"
import { PlanningOverview } from "@/components/planning/planning-components"

export default async function PlanningPage() {
  return <PlanningOverview data={await getPlanningOverview()} />
}
