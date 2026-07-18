import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { asc, eq } from "drizzle-orm"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import {
  groups,
  staffMemberAvailability,
  staffMemberGroups,
  staffMembers,
} from "@/lib/db/schema"
import {
  daySortOrder,
  formatStaffRole,
  formatWeekday,
  getAvailabilityHoursMismatch,
} from "@/lib/staff"
import { linkStaffToGroup, unlinkStaffFromGroup } from "./actions"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function StaffDetailPage({
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

  const linkedGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
    })
    .from(staffMemberGroups)
    .innerJoin(groups, eq(staffMemberGroups.groupId, groups.id))
    .where(eq(staffMemberGroups.staffMemberId, staffMember.id))
    .orderBy(asc(groups.name))

  const groupList = await db.select().from(groups).orderBy(asc(groups.name))
  const linkedGroupIds = new Set(linkedGroups.map((group) => group.id))
  const availableGroups = groupList.filter(
    (group) => !linkedGroupIds.has(group.id)
  )

  const sortedAvailability = availability.toSorted((left, right) => {
    const leftIndex = daySortOrder.get(left.dayOfWeek) ?? 99
    const rightIndex = daySortOrder.get(right.dayOfWeek) ?? 99

    return leftIndex - rightIndex
  })
  const availabilityHoursMismatch = getAvailabilityHoursMismatch(
    availability,
    staffMember.maxHoursPerWeek
  )

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="w-fit">
            <Link href="/staff">{t("backToStaff")}</Link>
          </Button>
          <Button asChild>
            <Link href={`/staff/${staffMember.id}/edit`}>{t("edit")}</Link>
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-medium tracking-normal">
            {staffMember.firstName} {staffMember.lastName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatStaffRole(staffMember.role, t)}
          </p>
        </div>
      </div>

      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("detail.role")}
          </div>
          <div className="mt-1 text-sm">
            {formatStaffRole(staffMember.role, t)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("detail.maxHours")}
          </div>
          <div className="mt-1 text-sm">{staffMember.maxHoursPerWeek}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("detail.status")}
          </div>
          <div className="mt-1 text-sm">
            {staffMember.active ? t("status.active") : t("status.inactive")}
          </div>
        </div>
      </section>

      {availabilityHoursMismatch ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          {t("detail.availabilityHoursMismatch", availabilityHoursMismatch)}
        </div>
      ) : null}

      <section className="rounded-lg border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-medium">{t("detail.groups")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("detail.groupsDescription")}
            </p>
          </div>
          {availableGroups.length > 0 ? (
            <form
              action={linkStaffToGroup}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input
                name="staffMemberId"
                type="hidden"
                value={staffMember.id}
              />
              <label className="sr-only" htmlFor="groupId">
                {t("detail.chooseGroup")}
              </label>
              <select
                id="groupId"
                name="groupId"
                required
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                defaultValue=""
              >
                <option value="" disabled>
                  {t("detail.chooseGroup")}
                </option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                {t("detail.addGroup")}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("detail.allGroupsLinked")}
            </p>
          )}
        </div>
        {linkedGroups.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("detail.noGroups")}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("detail.group")}</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t("detail.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linkedGroups.map((group) => (
                  <tr key={group.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/groups/${group.id}`}>{group.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={unlinkStaffFromGroup}>
                        <input
                          name="staffMemberId"
                          type="hidden"
                          value={staffMember.id}
                        />
                        <input name="groupId" type="hidden" value={group.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          {t("detail.removeGroup")}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-medium">{t("detail.availability")}</h2>
        {sortedAvailability.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("detail.noAvailability")}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("detail.day")}</th>
                  <th className="px-4 py-3 font-medium">{t("detail.start")}</th>
                  <th className="px-4 py-3 font-medium">{t("detail.end")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedAvailability.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      {formatWeekday(row.dayOfWeek, t)}
                    </td>
                    <td className="px-4 py-3">{row.startAvailabilityTime}</td>
                    <td className="px-4 py-3">{row.endAvailabilityTime}</td>
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
