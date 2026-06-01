"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"
import { generateSchedulePlan } from "./actions"
import { CopyJsonButton } from "./copy-json-button"

type StaffOption = {
  id: string
  name: string
}

type GenerateSchedulePlanProps = {
  copiedLabel: string
  copyLabel: string
  groupId: string
  staff: StaffOption[]
}

type GenerateSchedulePlanState = {
  error?: string
  plan?: GeneratedSchedule
  planJson?: string
}

const initialState: GenerateSchedulePlanState = {}

function getStaffName(staffById: Map<string, string>, staffId: string) {
  return staffById.get(staffId) ?? staffId
}

function GenerateSchedulePlan({
  copiedLabel,
  copyLabel,
  groupId,
  staff,
}: GenerateSchedulePlanProps) {
  const t = useTranslations("shiftSchedule")
  const [state, formAction, isPending] = useActionState(
    generateSchedulePlan,
    initialState
  )
  const staffById = new Map(
    staff.map((staffMember) => [staffMember.id, staffMember.name])
  )

  return (
    <section className="overflow-hidden rounded-lg border">
      <div className="flex flex-col gap-3 border-b bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium">{t("generatedTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("generatedDescription")}
          </p>
        </div>
        <form action={formAction}>
          <input name="groupId" type="hidden" value={groupId} />
          <Button disabled={isPending} type="submit">
            {isPending ? t("generatingPlan") : t("generatePlan")}
          </Button>
        </form>
      </div>

      <div className="grid gap-4 p-4" aria-live="polite">
        {state.error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">{t("generationErrorTitle")}</p>
            <p className="mt-1">{state.error}</p>
          </div>
        ) : null}

        {state.plan ? (
          <GeneratedPlanView
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
            plan={state.plan}
            planJson={state.planJson}
            staffById={staffById}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("generatedEmptyDescription")}
          </p>
        )}
      </div>
    </section>
  )
}

function GeneratedPlanView({
  copiedLabel,
  copyLabel,
  plan,
  planJson,
  staffById,
}: {
  copiedLabel: string
  copyLabel: string
  plan: GeneratedSchedule
  planJson?: string
  staffById: Map<string, string>
}) {
  const t = useTranslations("shiftSchedule")
  const tStaff = useTranslations("staff")

  return (
    <div className="grid gap-4">
      {plan.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <h3 className="font-medium">{t("warningsTitle")}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3">
        {plan.days.map((day) => (
          <div
            key={day.dayOfWeek}
            className="overflow-hidden rounded-lg border"
          >
            <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
              {tStaff(`weekday.${day.dayOfWeek}`)}
            </div>
            {day.shifts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">
                        {t("staffMember")}
                      </th>
                      <th className="px-4 py-2 font-medium">{t("start")}</th>
                      <th className="px-4 py-2 font-medium">{t("end")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.shifts.map((shift) => (
                      <tr
                        key={`${day.dayOfWeek}-${shift.staffId}-${shift.startTime}-${shift.endTime}`}
                        className="border-t"
                      >
                        <td className="px-4 py-2">
                          {getStaffName(staffById, shift.staffId)}
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {shift.startTime}
                        </td>
                        <td className="px-4 py-2 tabular-nums">
                          {shift.endTime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                {t("noShifts")}
              </p>
            )}
          </div>
        ))}
      </div>

      {planJson ? (
        <section className="overflow-hidden rounded-lg border">
          <div className="flex flex-col gap-3 border-b bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-medium">{t("generatedJsonTitle")}</h3>
            <CopyJsonButton
              copiedLabel={copiedLabel}
              copyLabel={copyLabel}
              value={planJson}
            />
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-6">
            {planJson}
          </pre>
        </section>
      ) : null}
    </div>
  )
}

export { GenerateSchedulePlan }
