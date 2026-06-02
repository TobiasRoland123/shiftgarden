"use client"

import { useTranslations } from "next-intl"

import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"
import { CopyJsonButton } from "./copy-json-button"

type ShiftSchedulePlanViewProps = {
  copiedLabel?: string
  copyLabel?: string
  plan: GeneratedSchedule
  planJson?: string
  staffById: Record<string, string>
}

function getStaffName(staffById: Record<string, string>, staffId: string) {
  return staffById[staffId] ?? staffId
}

function ShiftSchedulePlanView({
  copiedLabel,
  copyLabel,
  plan,
  planJson,
  staffById,
}: ShiftSchedulePlanViewProps) {
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

      {planJson && copyLabel && copiedLabel ? (
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

export { ShiftSchedulePlanView }
