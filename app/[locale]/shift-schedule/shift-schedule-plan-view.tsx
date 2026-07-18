"use client"

import type { CSSProperties } from "react"
import { useTranslations } from "next-intl"

import type { GeneratedSchedule } from "@/lib/shift-schedule/schemas"
import type { AcceptedSchedulePlan } from "@/lib/shift-schedule/validation-types"
import { CopyJsonButton } from "./copy-json-button"

type ShiftSchedulePlanViewProps = {
  copiedLabel?: string
  copyLabel?: string
  plan: AcceptedSchedulePlan
  planJson?: string
  staffById: Record<string, string>
}

function getStaffName(staffById: Record<string, string>, staffId: string) {
  return staffById[staffId] ?? staffId
}

const MINUTES_PER_HOUR = 60
const DEFAULT_START_HOUR = 8
const DEFAULT_END_HOUR = 17
const shiftColors = [
  "border-emerald-600/40 bg-emerald-600 text-white dark:bg-emerald-700",
  "border-sky-600/40 bg-sky-600 text-white dark:bg-sky-700",
  "border-violet-600/40 bg-violet-600 text-white dark:bg-violet-700",
  "border-amber-600/40 bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-white",
  "border-rose-600/40 bg-rose-600 text-white dark:bg-rose-700",
] as const

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * MINUTES_PER_HOUR + minutes
}

function formatHour(minutes: number) {
  return `${String(minutes / MINUTES_PER_HOUR).padStart(2, "0")}:00`
}

function getTimelineBounds(plan: GeneratedSchedule) {
  const shifts = plan.days.flatMap((day) => day.shifts)

  if (shifts.length === 0) {
    return {
      end: DEFAULT_END_HOUR * MINUTES_PER_HOUR,
      start: DEFAULT_START_HOUR * MINUTES_PER_HOUR,
    }
  }

  return {
    end:
      Math.ceil(
        Math.max(...shifts.map((shift) => timeToMinutes(shift.endTime))) /
          MINUTES_PER_HOUR
      ) * MINUTES_PER_HOUR,
    start:
      Math.floor(
        Math.min(...shifts.map((shift) => timeToMinutes(shift.startTime))) /
          MINUTES_PER_HOUR
      ) * MINUTES_PER_HOUR,
  }
}

function getStaffColor(staffId: string) {
  const hash = [...staffId].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  )

  return shiftColors[hash % shiftColors.length]
}

function TimelineGrid({ hourCount }: { hourCount: number }) {
  return Array.from({ length: hourCount + 1 }, (_, index) => (
    <span
      aria-hidden="true"
      className="absolute inset-y-0 border-l border-border/70"
      key={index}
      style={{ left: `${(index / hourCount) * 100}%` }}
    />
  ))
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
  const { end: timelineEnd, start: timelineStart } = getTimelineBounds(plan)
  const timelineDuration = timelineEnd - timelineStart
  const hourCount = timelineDuration / MINUTES_PER_HOUR
  const hourLabels = Array.from(
    { length: hourCount + 1 },
    (_, index) => timelineStart + index * MINUTES_PER_HOUR
  )

  return (
    <div className="grid gap-4">
      {plan.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <h3 className="font-medium">{t("aiWarningsTitle")}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {plan.validationWarnings.length > 0 ? (
        <div className="rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
          <h3 className="font-medium">{t("validationWarningsTitle")}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {plan.validationWarnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-1 border-b bg-muted/40 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-medium">{t("calendarTitle")}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("calendarDescription")}
            </p>
          </div>
          <p className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">
            {formatHour(timelineStart)}–{formatHour(timelineEnd)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
            <div className="grid grid-cols-[11rem_minmax(0,1fr)] border-b bg-muted/20">
              <div className="sticky left-0 z-20 flex items-center border-r bg-muted px-4 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("staffMember")}
              </div>
              <div className="relative h-11">
                <TimelineGrid hourCount={hourCount} />
                {hourLabels.map((minutes, index) => (
                  <span
                    className={`absolute top-3 text-xs text-muted-foreground tabular-nums ${
                      index === 0
                        ? "translate-x-2"
                        : index === hourCount
                          ? "-translate-x-[calc(100%+0.5rem)]"
                          : "-translate-x-1/2"
                    }`}
                    key={minutes}
                    style={{ left: `${(index / hourCount) * 100}%` }}
                  >
                    {formatHour(minutes)}
                  </span>
                ))}
              </div>
            </div>

            {plan.days.map((day) => (
              <div className="border-b last:border-b-0" key={day.dayOfWeek}>
                <div className="border-b bg-muted/35 text-sm font-semibold">
                  <span className="sticky left-0 inline-block px-4 py-2">
                    {tStaff(`weekday.${day.dayOfWeek}`)}
                  </span>
                </div>
                {day.shifts.length > 0 ? (
                  day.shifts.map((shift) => {
                    const staffName = getStaffName(staffById, shift.staffId)
                    const shiftLabel = t("shiftLabel", {
                      end: shift.endTime,
                      name: staffName,
                      start: shift.startTime,
                    })
                    const style: CSSProperties = {
                      left: `${((timeToMinutes(shift.startTime) - timelineStart) / timelineDuration) * 100}%`,
                      width: `${((timeToMinutes(shift.endTime) - timeToMinutes(shift.startTime)) / timelineDuration) * 100}%`,
                    }

                    return (
                      <div
                        className="grid grid-cols-[11rem_minmax(0,1fr)] border-b last:border-b-0"
                        key={`${day.dayOfWeek}-${shift.staffId}-${shift.startTime}-${shift.endTime}`}
                      >
                        <div className="sticky left-0 z-10 flex min-h-14 items-center border-r bg-card px-4 text-sm font-medium">
                          <span className="truncate" title={staffName}>
                            {staffName}
                          </span>
                        </div>
                        <div className="relative min-h-14 bg-muted/5">
                          <TimelineGrid hourCount={hourCount} />
                          <div
                            aria-label={shiftLabel}
                            className={`absolute inset-y-2 min-w-1 overflow-hidden rounded-md border px-2.5 shadow-sm ${getStaffColor(shift.staffId)}`}
                            style={style}
                            title={shiftLabel}
                          >
                            <span className="flex h-full items-center truncate text-xs font-semibold tabular-nums">
                              {shift.startTime}–{shift.endTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    {t("noShifts")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

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
