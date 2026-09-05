import { notFound } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { ExceptionForm } from "@/components/planning/planning-components"
import { db } from "@/lib/db"
import { groups, staffMemberGroups, staffMembers } from "@/lib/db/schema"
import { planningAction } from "../../../../planning/actions"
import { planningReturnTo } from "@/lib/planning/return-to"

export default async function NewGroupExceptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const [group] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1)
  if (!group) notFound()
  const staff = await db
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      role: staffMembers.role,
      active: staffMembers.active,
      maxHoursPerWeek: staffMembers.maxHoursPerWeek,
    })
    .from(staffMemberGroups)
    .innerJoin(
      staffMembers,
      eq(staffMembers.id, staffMemberGroups.staffMemberId)
    )
    .where(eq(staffMemberGroups.groupId, group.id))
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))
  return (
    <ExceptionForm
      ownerType="group"
      ownerId={group.id}
      staff={staff}
      returnHref={planningReturnTo(query.returnTo, `/groups/${group.id}`)}
      onAction={planningAction}
    />
  )
}
