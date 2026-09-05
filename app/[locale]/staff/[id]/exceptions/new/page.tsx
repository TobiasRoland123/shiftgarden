import { notFound } from "next/navigation"
import { asc, eq } from "drizzle-orm"
import { ExceptionForm } from "@/components/planning/planning-components"
import { db } from "@/lib/db"
import { staffMembers } from "@/lib/db/schema"
import { planningAction } from "../../../../planning/actions"
import { planningReturnTo } from "@/lib/planning/return-to"

export default async function NewStaffExceptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const [staffMember] = await db
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      role: staffMembers.role,
      active: staffMembers.active,
      maxHoursPerWeek: staffMembers.maxHoursPerWeek,
    })
    .from(staffMembers)
    .where(eq(staffMembers.id, id))
    .limit(1)
  if (!staffMember) notFound()
  const members = await db
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
      ownerType="staff"
      ownerId={staffMember.id}
      staff={members}
      returnHref={planningReturnTo(query.returnTo, `/staff/${staffMember.id}`)}
      onAction={planningAction}
    />
  )
}
