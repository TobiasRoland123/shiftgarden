import { asc } from "drizzle-orm"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { db } from "@/lib/db"
import { groups } from "@/lib/db/schema"
import { getScheduleInputForGroup } from "@/lib/shift-schedule/data"
import { getGroupReadiness } from "@/lib/shift-schedule/readiness"
import { uuidPattern } from "@/lib/uuid"
import { GenerateSchedulePlan } from "./generate-schedule-plan"
import { GroupPicker } from "./group-picker"
import { ReadinessPanel } from "./readiness-panel"

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

  const scheduleInput = selectedGroup
    ? await getScheduleInputForGroup(selectedGroup)
    : undefined
  const readiness = scheduleInput ? getGroupReadiness(scheduleInput) : undefined

  const statusMessage = !hasGroupId
    ? t("emptyDescription")
    : hasValidGroupId
      ? selectedGroup
        ? undefined
        : t("groupNotFound")
      : t("invalidGroup")

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

      {groupList.length === 0 ? (
        <section className="rounded-lg border border-dashed p-8">
          <h2 className="font-medium">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            {t("noGroups")}
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-lg border p-4">
            <GroupPicker
              groups={groupList.map((group) => ({
                id: group.id,
                name: group.name,
              }))}
              label={t("chooseGroup")}
              placeholder={t("groupPlaceholder")}
              selectedGroupId={selectedGroup?.id}
            />
          </section>

          {statusMessage ? (
            <section className="rounded-lg border border-dashed p-8">
              <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                {statusMessage}
              </p>
            </section>
          ) : null}

          {readiness && scheduleInput ? (
            <>
              <ReadinessPanel readiness={readiness} />
              <GenerateSchedulePlan
                canGenerate={readiness.canGenerate}
                groupId={scheduleInput.group.id}
                scheduleInput={scheduleInput}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
