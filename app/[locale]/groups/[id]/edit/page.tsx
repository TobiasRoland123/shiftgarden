import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { asc, eq } from "drizzle-orm"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { groups, groupStaffRules } from "@/lib/db/schema"
import { compareGroupStaffRules } from "@/lib/groups"
import { updateGroup } from "../../new/actions"
import { GroupForm } from "../../new/group-form"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations("groups")

  if (!uuidPattern.test(id)) {
    notFound()
  }

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1)

  if (!group) {
    notFound()
  }

  const rules = await db
    .select()
    .from(groupStaffRules)
    .where(eq(groupStaffRules.groupId, group.id))
    .orderBy(asc(groupStaffRules.startTime))

  const sortedRules = rules.toSorted(compareGroupStaffRules)

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href={`/groups/${group.id}`}>{t("backToGroup")}</Link>
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

      <GroupForm
        action={updateGroup}
        initialValues={{
          id: group.id,
          name: group.name,
          rules: sortedRules,
        }}
      />
    </div>
  )
}
