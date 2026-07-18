import { asc } from "drizzle-orm"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { db } from "@/lib/db"
import { groups } from "@/lib/db/schema"
import { getScheduleInputForGroup } from "@/lib/shift-schedule/data"
import { uuidPattern } from "@/lib/uuid"
import { currentMonday } from "@/lib/shift-schedule/week"
import { CopyJsonButton } from "./copy-json-button"
import { GenerateSchedulePlan } from "./generate-schedule-plan"

type ShiftSchedulePageProps = {
  searchParams: Promise<{
    groupId?: string
  }>
}

export default async function ShiftSchedulePage({
  searchParams,
}: ShiftSchedulePageProps) {
  const { groupId } = await searchParams
  const t = await getTranslations("shiftSchedule")

  const groupList = await db.select().from(groups).orderBy(asc(groups.name))
  const hasGroupId = Boolean(groupId)
  const hasValidGroupId = groupId ? uuidPattern.test(groupId) : false
  const selectedGroup = hasValidGroupId
    ? groupList.find((group) => group.id === groupId)
    : undefined

  const schedulePreview = selectedGroup
    ? await getScheduleInputForGroup(selectedGroup)
    : undefined

  const statusMessage = !hasGroupId
    ? t("emptyDescription")
    : hasValidGroupId
      ? selectedGroup
        ? undefined
        : t("groupNotFound")
      : t("invalidGroup")
  const schedulePreviewJson = schedulePreview
    ? JSON.stringify(schedulePreview, null, 2)
    : undefined

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-normal">{t("title")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/shift-schedule/plans">{t("savedPlans")}</Link>
        </Button>
      </div>

      <section className="rounded-lg border p-4">
        <form className="flex flex-col gap-3 sm:max-w-md" method="get">
          <label className="text-sm font-medium" htmlFor="groupId">
            {t("chooseGroup")}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              id="groupId"
              name="groupId"
              required
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              defaultValue={selectedGroup?.id ?? ""}
            >
              <option value="" disabled>
                {t("groupPlaceholder")}
              </option>
              {groupList.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <Button type="submit">{t("showJson")}</Button>
          </div>
        </form>
      </section>

      {groupList.length === 0 ? (
        <section className="rounded-lg border border-dashed p-8">
          <h2 className="font-medium">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {t("noGroups")}
          </p>
        </section>
      ) : statusMessage ? (
        <section className="rounded-lg border border-dashed p-8">
          <h2 className="font-medium">{t("previewTitle")}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {statusMessage}
          </p>
        </section>
      ) : schedulePreview ? (
        <>
          <GenerateSchedulePlan
            copiedLabel={t("copiedJson")}
            copyLabel={t("copyJson")}
            groupId={schedulePreview.group.id}
            defaultWeekStart={currentMonday()}
            staff={schedulePreview.staff.map((staffMember) => ({
              id: staffMember.id,
              name: `${staffMember.firstName} ${staffMember.lastName}`,
            }))}
          />

          <section className="overflow-hidden rounded-lg border">
            <div className="flex flex-col gap-3 border-b bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-medium">{t("previewTitle")}</h2>
              {schedulePreviewJson ? (
                <CopyJsonButton
                  copiedLabel={t("copiedJson")}
                  copyLabel={t("copyJson")}
                  value={schedulePreviewJson}
                />
              ) : null}
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-6">
              {schedulePreviewJson}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  )
}
