import { notFound } from "next/navigation"
import { asc } from "drizzle-orm"
import { ExceptionForm } from "@/components/planning/planning-components"
import { db } from "@/lib/db"
import { staffMembers } from "@/lib/db/schema"
import { getPlanningException } from "@/lib/planning/view"
import { planningAction } from "../../../../planning/actions"
import { planningReturnTo } from "@/lib/planning/return-to"

export default async function InstitutionExceptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ exceptionId: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { exceptionId } = await params
  const query = await searchParams
  const existing = await getPlanningException(exceptionId)
  if (!existing || existing.ownerType !== "institution") notFound()
  const staff = await db
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      role: staffMembers.role,
      active: staffMembers.active,
      maxHoursPerWeek: staffMembers.maxHoursPerWeek,
    })
    .from(staffMembers)
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))
  return (
    <ExceptionForm
      ownerType="institution"
      ownerId={existing.ownerId}
      staff={staff}
      existing={existing}
      returnHref={planningReturnTo(query.returnTo, "/settings/opening-hours")}
      onAction={planningAction}
    />
  )
}
