import { eq } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { GroupForm } from "@/components/group-form"
import { StaffingRulesEditor } from "@/components/staffing-rules-editor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { groups, staffingRules } from "@/drizzle/schema"
import { db } from "@/lib/db"

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations("GroupsDetailPage")
  const [row] = await db.select().from(groups).where(eq(groups.id, id)).limit(1)
  if (!row) notFound()

  const rules = await db
    .select()
    .from(staffingRules)
    .where(eq(staffingRules.groupId, id))

  return (
    <div className="grid gap-6 p-6">
      <h1 className="text-2xl font-semibold">{row.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupForm
            mode="edit"
            groupId={id}
            initial={{
              name: row.name,
              openTime: row.openTime,
              closeTime: row.closeTime,
              uniformWeek: row.uniformWeek,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("staffingRules")}</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffingRulesEditor
            groupId={id}
            initial={rules}
            uniformWeek={row.uniformWeek}
            groupName={row.name}
            openTime={row.openTime}
            closeTime={row.closeTime}
          />
        </CardContent>
      </Card>
    </div>
  )
}
