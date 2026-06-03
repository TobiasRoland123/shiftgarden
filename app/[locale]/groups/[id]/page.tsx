import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { asc, eq } from "drizzle-orm"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import {
  groups,
  groupStaffRules,
  staffMemberGroups,
  staffMembers,
} from "@/lib/db/schema"
import {
  calculateGroupCapacityShortfall,
  compareGroupStaffRules,
  formatCapacityHours,
  formatWeekday,
} from "@/lib/groups"
import { formatStaffRole } from "@/lib/staff"
import { linkGroupToStaff, unlinkGroupFromStaff } from "./actions"

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

  const linkedStaff = await db
    .select({
      id: staffMembers.id,
      firstName: staffMembers.firstName,
      lastName: staffMembers.lastName,
      role: staffMembers.role,
      maxHoursPerWeek: staffMembers.maxHoursPerWeek,
      active: staffMembers.active,
    })
    .from(staffMemberGroups)
    .innerJoin(
      staffMembers,
      eq(staffMemberGroups.staffMemberId, staffMembers.id)
    )
    .where(eq(staffMemberGroups.groupId, group.id))
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))

  const activeStaff = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.active, true))
    .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName))
  const linkedStaffIds = new Set(
    linkedStaff.map((staffMember) => staffMember.id)
  )
  const availableStaff = activeStaff.filter(
    (staffMember) => !linkedStaffIds.has(staffMember.id)
  )

  const sortedRules = rules.toSorted(compareGroupStaffRules)
  const capacityShortfall = calculateGroupCapacityShortfall(rules, linkedStaff)

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
        {capacityShortfall.totalShortfallHours > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
            {t("detail.totalCapacityShortfall", {
              hours: formatCapacityHours(capacityShortfall.totalShortfallHours),
            })}
          </div>
        ) : null}
        {capacityShortfall.pedagogShortfallHours > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
            {t("detail.pedagogCapacityShortfall", {
              hours: formatCapacityHours(
                capacityShortfall.pedagogShortfallHours
              ),
            })}
          </div>
        ) : null}
      </div>

      <section className="rounded-lg border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-medium">{t("detail.staff")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("detail.staffDescription")}
            </p>
          </div>
          {availableStaff.length > 0 ? (
            <form
              action={linkGroupToStaff}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input name="groupId" type="hidden" value={group.id} />
              <label className="sr-only" htmlFor="staffMemberId">
                {t("detail.chooseStaff")}
              </label>
              <select
                id="staffMemberId"
                name="staffMemberId"
                required
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                defaultValue=""
              >
                <option value="" disabled>
                  {t("detail.chooseStaff")}
                </option>
                {availableStaff.map((staffMember) => (
                  <option key={staffMember.id} value={staffMember.id}>
                    {staffMember.firstName} {staffMember.lastName}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                {t("detail.addStaff")}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("detail.allStaffLinked")}
            </p>
          )}
        </div>
        {linkedStaff.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("detail.noStaff")}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t("detail.staffMember")}
                  </th>
                  <th className="px-4 py-3 font-medium">{t("detail.role")}</th>
                  <th className="px-4 py-3 font-medium">
                    {t("detail.status")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{t("detail.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linkedStaff.map((staffMember) => (
                  <tr key={staffMember.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/staff/${staffMember.id}`}>
                        {staffMember.firstName} {staffMember.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {formatStaffRole(staffMember.role, tStaff)}
                    </td>
                    <td className="px-4 py-3">
                      {staffMember.active
                        ? tStaff("status.active")
                        : tStaff("status.inactive")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={unlinkGroupFromStaff}>
                        <input name="groupId" type="hidden" value={group.id} />
                        <input
                          name="staffMemberId"
                          type="hidden"
                          value={staffMember.id}
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          {t("detail.removeStaff")}
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
