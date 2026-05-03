import { eq } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { AvailabilityEditor } from "@/components/availability-editor"
import { StaffForm } from "@/components/staff-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { staff, staffAvailability } from "@/drizzle/schema"
import { db } from "@/lib/db"

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations("StaffDetailPage")
  const [row] = await db.select().from(staff).where(eq(staff.id, id)).limit(1)
  if (!row) notFound()

  const windows = await db
    .select({
      weekday: staffAvailability.weekday,
      startTime: staffAvailability.startTime,
      endTime: staffAvailability.endTime,
    })
    .from(staffAvailability)
    .where(eq(staffAvailability.staffId, id))

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{row.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffForm
            mode="edit"
            staffId={id}
            initial={{
              name: row.name,
              email: row.email ?? "",
              role: row.role,
              weeklyContractHours: row.weeklyContractHours,
              active: row.active,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("weeklyAvailability")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityEditor
            staffId={id}
            initial={windows}
            weeklyContractHours={row.weeklyContractHours}
          />
        </CardContent>
      </Card>
    </div>
  )
}
