import { asc } from "drizzle-orm"
import { ExceptionForm } from "@/components/planning/planning-components"
import { db } from "@/lib/db"
import { institutionSettings, staffMembers } from "@/lib/db/schema"
import { planningAction } from "../../../../planning/actions"
import { planningReturnTo } from "@/lib/planning/return-to"

export default async function NewInstitutionExceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const query = await searchParams
  const [settings] = await db
    .select({ id: institutionSettings.id })
    .from(institutionSettings)
    .limit(1)
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
      ownerId={String(settings?.id ?? 1)}
      staff={staff}
      returnHref={planningReturnTo(query.returnTo, "/settings/opening-hours")}
      onAction={planningAction}
    />
  )
}
