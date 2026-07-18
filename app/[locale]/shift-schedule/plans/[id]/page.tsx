import { asc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { db } from "@/lib/db"
import {
  groups,
  shiftSchedulePlans,
  shiftScheduleShifts,
  staffMembers,
} from "@/lib/db/schema"
import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"
import { daysOfWeek } from "@/lib/shift-schedule/schemas"
import type { AcceptedSchedulePlan } from "@/lib/shift-schedule/validation-types"
import { uuidPattern } from "@/lib/uuid"
import { ShiftSchedulePlanView } from "../../shift-schedule-plan-view"

type GeneratedScheduleDay = GeneratedSchedule["days"][number]["dayOfWeek"]

type SavedPlanDetailPageProps = {
  params: Promise<{
    id: string
    locale: string
  }>
}

function formatDateTime(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function isGeneratedScheduleDay(day: string): day is GeneratedScheduleDay {
  return (daysOfWeek as readonly string[]).includes(day)
}

export default async function SavedPlanDetailPage({
  params,
}: SavedPlanDetailPageProps) {
  const { id, locale } = await params
  const t = await getTranslations("shiftSchedule")

  if (!uuidPattern.test(id)) {
    notFound()
  }

  const [savedPlan] = await db
    .select({
      id: shiftSchedulePlans.id,
      createdAt: shiftSchedulePlans.createdAt,
      groupId: shiftSchedulePlans.groupId,
      groupName: groups.name,
      model: shiftSchedulePlans.model,
      aiWarnings: shiftSchedulePlans.warnings,
      validationWarnings: shiftSchedulePlans.validationWarnings,
    })
    .from(shiftSchedulePlans)
    .innerJoin(groups, eq(shiftSchedulePlans.groupId, groups.id))
    .where(eq(shiftSchedulePlans.id, id))
    .limit(1)

  if (!savedPlan) {
    notFound()
  }

  const shifts = await db
    .select({
      id: shiftScheduleShifts.id,
      staffMemberId: shiftScheduleShifts.staffMemberId,
      staffFirstName: staffMembers.firstName,
      staffLastName: staffMembers.lastName,
      dayOfWeek: shiftScheduleShifts.dayOfWeek,
      startTime: shiftScheduleShifts.startTime,
      endTime: shiftScheduleShifts.endTime,
    })
    .from(shiftScheduleShifts)
    .innerJoin(
      staffMembers,
      eq(shiftScheduleShifts.staffMemberId, staffMembers.id)
    )
    .where(eq(shiftScheduleShifts.planId, savedPlan.id))
    .orderBy(
      asc(shiftScheduleShifts.dayOfWeek),
      asc(shiftScheduleShifts.startTime),
      asc(staffMembers.lastName),
      asc(staffMembers.firstName)
    )

  const shiftsByDay = new Map<
    GeneratedScheduleDay,
    GeneratedSchedule["days"][number]["shifts"]
  >(daysOfWeek.map((day) => [day, []]))
  const staffById = Object.fromEntries(
    shifts.map((shift) => [
      shift.staffMemberId,
      `${shift.staffFirstName} ${shift.staffLastName}`,
    ])
  )

  for (const shift of shifts) {
    if (!isGeneratedScheduleDay(shift.dayOfWeek)) {
      continue
    }

    shiftsByDay.get(shift.dayOfWeek)?.push({
      staffId: shift.staffMemberId,
      startTime: shift.startTime,
      endTime: shift.endTime,
    })
  }

  const plan: AcceptedSchedulePlan = {
    groupId: savedPlan.groupId,
    warnings: savedPlan.aiWarnings,
    validationWarnings: savedPlan.validationWarnings,
    days: daysOfWeek.map((day) => ({
      dayOfWeek: day,
      shifts: shiftsByDay.get(day) ?? [],
    })),
  }

  return (
    <div className="flex min-h-svh flex-col gap-6 p-6">
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/shift-schedule/plans">{t("backToSavedPlans")}</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-medium tracking-normal">
            {savedPlan.groupName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("savedPlanDetailDescription")}
          </p>
        </div>
      </div>

      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("detail.group")}
          </div>
          <div className="mt-1 text-sm">{savedPlan.groupName}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("detail.createdAt")}
          </div>
          <div className="mt-1 text-sm">
            {formatDateTime(savedPlan.createdAt, locale)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("detail.model")}
          </div>
          <div className="mt-1 text-sm">{savedPlan.model}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("detail.aiWarnings")}
          </div>
          <div className="mt-1 text-sm">{savedPlan.aiWarnings.length}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("detail.validationWarnings")}
          </div>
          <div className="mt-1 text-sm">
            {savedPlan.validationWarnings.length}
          </div>
        </div>
      </section>

      <ShiftSchedulePlanView plan={plan} staffById={staffById} />
    </div>
  )
}
