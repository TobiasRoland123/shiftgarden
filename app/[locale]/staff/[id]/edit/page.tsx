import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { asc, eq } from "drizzle-orm"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { staffMemberAvailability, staffMembers } from "@/lib/db/schema"
import { daySortOrder } from "@/lib/staff"
import { updateStaff } from "../../new/actions"
import { StaffForm } from "../../new/staff-form"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations("staff")

  if (!uuidPattern.test(id)) {
    notFound()
  }

  const [staffMember] = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.id, id))
    .limit(1)

  if (!staffMember) {
    notFound()
  }

  const availability = await db
    .select()
    .from(staffMemberAvailability)
    .where(eq(staffMemberAvailability.staffMemberId, staffMember.id))
    .orderBy(asc(staffMemberAvailability.startAvailabilityTime))

  const sortedAvailability = availability.toSorted((left, right) => {
    const leftIndex = daySortOrder.get(left.dayOfWeek) ?? 99
    const rightIndex = daySortOrder.get(right.dayOfWeek) ?? 99

    return leftIndex - rightIndex
  })

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href={`/staff/${staffMember.id}`}>
            {t("backToStaffMember")}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-medium tracking-normal">
            {t("editTitle")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("editDescription")}
          </p>
        </div>
      </div>

      <StaffForm
        action={updateStaff}
        initialValues={{
          id: staffMember.id,
          firstName: staffMember.firstName,
          lastName: staffMember.lastName,
          role: staffMember.role,
          maxHoursPerWeek: staffMember.maxHoursPerWeek,
          active: staffMember.active,
          availability: sortedAvailability,
        }}
      />
    </div>
  )
}
