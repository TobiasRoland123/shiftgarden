"use client"

import { useTranslations } from "next-intl"

import { calculateCoverageSegments } from "@/lib/shift-schedule/coverage"
import type { CoverageSegment } from "@/lib/shift-schedule/coverage"
import { daysOfWeek } from "@/lib/shift-schedule/schemas"
import type {
  GeneratedSchedule,
  ScheduleInput,
} from "@/lib/shift-schedule/schemas"
import type { DayOfWeek } from "@/lib/shift-schedule/shifts"
import {
  getDayTimelineBounds,
  getShiftBarGeometry,
  MINUTES_PER_HOUR,
} from "@/lib/shift-schedule/timeline"
import type { TimelineBounds } from "@/lib/shift-schedule/timeline"
import type { IssueSelection } from "./validation-issue-list"

type ShiftSchedulePlanViewProps = {
  plan: GeneratedSchedule
  scheduleInput: ScheduleInput
  selectedIssue?: IssueSelection
}

type PlanShift = {
  staffId: string
  startTime: string
  endTime: string
}

/**
 * Assigned by index over the plan's sorted staff ids so a staff member looks
 * the same on every weekday and distinct staff never collide below palette
 * size. The previous char-code hash collided across only five buckets.
 */
const staffColors = [
  "bg-emerald-600 text-white dark:bg-emerald-700",
  "bg-sky-600 text-white dark:bg-sky-700",
  "bg-violet-600 text-white dark:bg-violet-700",
  "bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-white",
  "bg-rose-600 text-white dark:bg-rose-700",
  "bg-teal-600 text-white dark:bg-teal-700",
  "bg-indigo-600 text-white dark:bg-indigo-700",
  "bg-fuchsia-600 text-white dark:bg-fuchsia-700",
  "bg-lime-600 text-lime-950 dark:bg-lime-700 dark:text-white",
  "bg-orange-600 text-white dark:bg-orange-700",
  "bg-cyan-600 text-white dark:bg-cyan-700",
  "bg-pink-600 text-white dark:bg-pink-700",
] as const

function formatHour(minutes: number) {
  return `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, "0")}:00`
}

function buildStaffColorMap(plan: GeneratedSchedule) {
  const staffIds = Array.from(
    new Set(
      plan.days.flatMap((day) => day.shifts.map((shift) => shift.staffId))
    )
  ).sort()

  return new Map(
    staffIds.map((staffId, index) => [
      staffId,
      staffColors[index % staffColors.length],
    ])
  )
}

function HourGrid({ bounds }: { bounds: TimelineBounds }) {
  const hourCount = (bounds.end - bounds.start) / MINUTES_PER_HOUR

  return Array.from({ length: hourCount + 1 }, (_, index) => (
    <span
      aria-hidden="true"
      className="absolute inset-y-0 border-l border-border/60"
      key={index}
      style={{ left: `${(index / hourCount) * 100}%` }}
    />
  ))
}

function HourAxis({ bounds }: { bounds: TimelineBounds }) {
  const hourCount = (bounds.end - bounds.start) / MINUTES_PER_HOUR

  return (
    <div className="relative h-5">
      {Array.from({ length: hourCount + 1 }, (_, index) => (
        <span
          className="absolute -translate-x-1/2 text-[10px] text-muted-foreground tabular-nums"
          key={index}
          style={{ left: `${(index / hourCount) * 100}%` }}
        >
          {formatHour(bounds.start + index * MINUTES_PER_HOUR)}
        </span>
      ))}
    </div>
  )
}

function CoverageStrip({
  bounds,
  segments,
  selectedIssue,
}: {
  bounds: TimelineBounds
  segments: CoverageSegment[]
  selectedIssue?: IssueSelection
}) {
  const t = useTranslations("shiftSchedule.coverage")

  return (
    <div className="relative h-8 overflow-hidden rounded-md border bg-muted/30">
      <HourGrid bounds={bounds} />
      {segments.map((segment) => {
        const geometry = getShiftBarGeometry(
          segment.startTime,
          segment.endTime,
          bounds
        )
        const hasRequirement = segment.minStaff > 0 || segment.minPedagogs > 0
        const isUnmet =
          segment.staffCount < segment.minStaff ||
          segment.pedagogCount < segment.minPedagogs
        const isSelected =
          selectedIssue?.dayOfWeek === segment.dayOfWeek &&
          selectedIssue?.startTime === segment.startTime &&
          selectedIssue?.endTime === segment.endTime
        const label = hasRequirement
          ? t("label", {
              start: segment.startTime,
              end: segment.endTime,
              staffCount: segment.staffCount,
              minStaff: segment.minStaff,
              pedagogCount: segment.pedagogCount,
              minPedagogs: segment.minPedagogs,
            })
          : t("noRequirement")

        return (
          <span
            aria-label={label}
            className={`absolute inset-y-1 flex items-center justify-center rounded-sm px-1 text-[10px] font-medium tabular-nums ${
              !hasRequirement
                ? "bg-muted text-muted-foreground"
                : isUnmet
                  ? "bg-destructive/85 text-white"
                  : "bg-emerald-600/85 text-white"
            } ${isSelected ? "ring-2 ring-foreground ring-offset-1" : ""}`}
            key={`${segment.startTime}-${segment.endTime}-${segment.ruleIndexes.join(",")}`}
            role="img"
            style={{
              left: `${geometry.leftPercent}%`,
              width: `${geometry.widthPercent}%`,
            }}
            title={label}
          >
            {hasRequirement ? (
              <span className="truncate">
                {segment.staffCount}/{segment.minStaff}
                {segment.minPedagogs > 0
                  ? ` · ${segment.pedagogCount}/${segment.minPedagogs}`
                  : ""}
              </span>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

function StaffRow({
  availability,
  bounds,
  colorClass,
  dayOfWeek,
  name,
  selectedIssue,
  shifts,
}: {
  availability: { startTime: string; endTime: string }[]
  bounds: TimelineBounds
  colorClass: string
  dayOfWeek: DayOfWeek
  name: string
  selectedIssue?: IssueSelection
  shifts: PlanShift[]
}) {
  const t = useTranslations("shiftSchedule")

  return (
    <div className="relative h-9 overflow-hidden rounded-md border bg-background">
      <HourGrid bounds={bounds} />
      {availability.map((interval) => {
        const geometry = getShiftBarGeometry(
          interval.startTime,
          interval.endTime,
          bounds
        )

        return (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 bg-muted/70"
            key={`availability-${interval.startTime}-${interval.endTime}`}
            style={{
              left: `${geometry.leftPercent}%`,
              width: `${geometry.widthPercent}%`,
            }}
          />
        )
      })}
      {shifts.map((shift) => {
        const geometry = getShiftBarGeometry(
          shift.startTime,
          shift.endTime,
          bounds
        )
        const isSelected =
          selectedIssue?.staffId === shift.staffId &&
          selectedIssue?.dayOfWeek === dayOfWeek &&
          selectedIssue?.startTime === shift.startTime &&
          selectedIssue?.endTime === shift.endTime
        const label = t("shiftLabel", {
          name,
          start: shift.startTime,
          end: shift.endTime,
        })

        return (
          <span
            aria-label={label}
            className={`absolute inset-y-1.5 flex min-w-1 items-center justify-center rounded-sm px-1 text-[10px] font-medium tabular-nums ${colorClass} ${
              isSelected ? "ring-2 ring-foreground ring-offset-1" : ""
            }`}
            key={`shift-${shift.startTime}-${shift.endTime}`}
            role="img"
            style={{
              left: `${geometry.leftPercent}%`,
              width: `${geometry.widthPercent}%`,
            }}
            title={label}
          >
            <span className="truncate">
              {shift.startTime}-{shift.endTime}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/**
 * Renders a plan as one row per staff member per weekday, with availability
 * behind each row and a coverage strip per weekday. Shared by the review
 * surface and the saved-plan detail page.
 */
function ShiftSchedulePlanView({
  plan,
  scheduleInput,
  selectedIssue,
}: ShiftSchedulePlanViewProps) {
  const t = useTranslations("shiftSchedule")
  const tWeekday = useTranslations("staff.weekday")
  const tRole = useTranslations("staff.role")
  const staffColorMap = buildStaffColorMap(plan)
  const staffById = new Map(
    scheduleInput.staff.map((staff) => [staff.id, staff])
  )
  const shiftsByDay = new Map(
    plan.days.map((day) => [day.dayOfWeek, day.shifts])
  )
  const segments = calculateCoverageSegments({
    scheduleInput,
    generatedSchedule: plan,
  })

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">{t("calendarTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("calendarDescription")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[48rem] flex-col gap-5">
          {daysOfWeek.map((dayOfWeek) => {
            const dayShifts = shiftsByDay.get(dayOfWeek) ?? []
            const dayRules = scheduleInput.rules.filter(
              (rule) => rule.dayOfWeek === dayOfWeek
            )
            const daySegments = segments.filter(
              (segment) => segment.dayOfWeek === dayOfWeek
            )

            if (dayShifts.length === 0 && dayRules.length === 0) {
              return (
                <div
                  className="grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-3"
                  key={dayOfWeek}
                >
                  <h4 className="sticky left-0 z-10 bg-background text-sm font-medium">
                    {tWeekday(dayOfWeek)}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t("emptyDayTitle")}
                  </p>
                </div>
              )
            }

            const bounds = getDayTimelineBounds({
              dayOfWeek,
              openingHours: scheduleInput.openingHours,
              shifts: dayShifts,
            })
            const staffIds = Array.from(
              new Set(dayShifts.map((shift) => shift.staffId))
            ).sort((first, second) => {
              const firstStaff = staffById.get(first)
              const secondStaff = staffById.get(second)

              return `${firstStaff?.lastName ?? first}${firstStaff?.firstName ?? ""}`.localeCompare(
                `${secondStaff?.lastName ?? second}${secondStaff?.firstName ?? ""}`
              )
            })

            return (
              <div className="flex flex-col gap-1.5" key={dayOfWeek}>
                <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-3">
                  <h4 className="sticky left-0 z-10 bg-background text-sm font-medium">
                    {tWeekday(dayOfWeek)}
                  </h4>
                  <HourAxis bounds={bounds} />
                </div>

                <div className="grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-3">
                  <span className="sticky left-0 z-10 bg-background text-xs text-muted-foreground">
                    {t("coverage.title")}
                  </span>
                  <CoverageStrip
                    bounds={bounds}
                    segments={daySegments}
                    selectedIssue={selectedIssue}
                  />
                </div>

                {staffIds.length === 0 ? (
                  <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-3">
                    <span className="sticky left-0 z-10 bg-background" />
                    <p className="text-sm text-muted-foreground">
                      {t("noShifts")}
                    </p>
                  </div>
                ) : (
                  staffIds.map((staffId) => {
                    const staff = staffById.get(staffId)
                    const name = staff
                      ? `${staff.firstName} ${staff.lastName}`
                      : staffId

                    return (
                      <div
                        className="grid grid-cols-[11rem_minmax(0,1fr)] items-center gap-3"
                        key={staffId}
                      >
                        <span className="sticky left-0 z-10 flex min-w-0 flex-col bg-background">
                          <span className="truncate text-sm" title={name}>
                            {name}
                          </span>
                          {staff ? (
                            <span className="text-xs text-muted-foreground">
                              {tRole(staff.role)}
                            </span>
                          ) : null}
                        </span>
                        <StaffRow
                          availability={(staff?.availability ?? [])
                            .filter(
                              (interval) => interval.dayOfWeek === dayOfWeek
                            )
                            .map((interval) => ({
                              startTime: interval.startAvailabilityTime,
                              endTime: interval.endAvailabilityTime,
                            }))}
                          bounds={bounds}
                          colorClass={
                            staffColorMap.get(staffId) ?? staffColors[0]
                          }
                          dayOfWeek={dayOfWeek}
                          name={name}
                          selectedIssue={selectedIssue}
                          shifts={dayShifts.filter(
                            (shift) => shift.staffId === staffId
                          )}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export { ShiftSchedulePlanView }
