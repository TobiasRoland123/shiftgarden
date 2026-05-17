import { getTranslations } from "next-intl/server"
import { asc } from "drizzle-orm"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { staffMembers } from "@/lib/db/schema"
import { formatStaffRole } from "@/lib/staff"

export default async function StaffPage() {
  const t = await getTranslations("staff")
  const staff = await db
    .select()
    .from(staffMembers)
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-normal">{t("title")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button asChild>
          <Link href="/staff/new">{t("createNew")}</Link>
        </Button>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8">
          <h2 className="font-medium">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {t("emptyDescription")}
          </p>
          <Button asChild className="mt-4">
            <Link href="/staff/new">{t("createFirst")}</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("table.name")}</th>
                <th className="px-4 py-3 font-medium">{t("table.role")}</th>
                <th className="px-4 py-3 font-medium">{t("table.maxHours")}</th>
                <th className="px-4 py-3 font-medium">{t("table.status")}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{t("table.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3 font-medium">
                    {member.firstName} {member.lastName}
                  </td>
                  <td className="px-4 py-3">
                    {formatStaffRole(member.role, t)}
                  </td>
                  <td className="px-4 py-3">{member.maxHoursPerWeek}</td>
                  <td className="px-4 py-3">
                    {member.active ? t("status.active") : t("status.inactive")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/staff/${member.id}`}>
                        {t("table.view")}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
