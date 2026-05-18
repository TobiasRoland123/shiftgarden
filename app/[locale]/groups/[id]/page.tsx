import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { asc, eq } from "drizzle-orm"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { groups, groupStaffRules } from "@/lib/db/schema"
import { compareGroupStaffRules, formatWeekday } from "@/lib/groups"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations("groups")
  const tStaff = await getTranslations("staff")

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
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="w-fit">
            <Link href="/groups">{t("backToGroups")}</Link>
          </Button>
          <Button asChild>
            <Link href={`/groups/${group.id}/edit`}>{t("edit")}</Link>
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-medium tracking-normal">{group.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("detail.subtitle")}
          </p>
        </div>
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="font-medium">{t("detail.rules")}</h2>
        {sortedRules.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("detail.noRules")}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("detail.day")}</th>
                  <th className="px-4 py-3 font-medium">{t("detail.start")}</th>
                  <th className="px-4 py-3 font-medium">{t("detail.end")}</th>
                  <th className="px-4 py-3 font-medium">
                    {t("detail.minPedagogs")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("detail.minStaff")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-4 py-3">
                      {formatWeekday(rule.dayOfWeek, tStaff)}
                    </td>
                    <td className="px-4 py-3">{rule.startTime}</td>
                    <td className="px-4 py-3">{rule.endTime}</td>
                    <td className="px-4 py-3">{rule.minPedagogs}</td>
                    <td className="px-4 py-3">{rule.minStaff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
