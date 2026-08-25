"use client"

import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ScheduleInput } from "@/lib/shift-schedule/schemas"
import type { ScheduleValidationIssue } from "@/lib/shift-schedule/validation-types"
import type { DayOfWeek } from "@/lib/staff"

type IssueSelection = {
  code: string
  dayOfWeek?: string
  staffId?: string
  startTime?: string
  endTime?: string
  ruleIndex?: number
}

function isSameIssue(first: IssueSelection, second: IssueSelection) {
  return (
    first.code === second.code &&
    first.dayOfWeek === second.dayOfWeek &&
    first.staffId === second.staffId &&
    first.startTime === second.startTime &&
    first.endTime === second.endTime &&
    first.ruleIndex === second.ruleIndex
  )
}

function groupIssuesByCode(issues: ScheduleValidationIssue[]) {
  const grouped = new Map<string, ScheduleValidationIssue[]>()

  for (const issue of issues) {
    grouped.set(issue.code, [...(grouped.get(issue.code) ?? []), issue])
  }

  return Array.from(grouped.entries())
}

/**
 * Renders each issue from its stable code plus context rather than as one
 * joined string, so multiple failures stay scannable and translatable.
 */
function ValidationIssueList({
  issues,
  onSelect,
  scheduleInput,
  selectedIssue,
  tone = "error",
}: {
  issues: ScheduleValidationIssue[]
  onSelect?: (issue: IssueSelection | undefined) => void
  scheduleInput?: ScheduleInput
  selectedIssue?: IssueSelection
  tone?: "error" | "warning"
}) {
  const t = useTranslations("shiftSchedule.validation")
  const tWeekday = useTranslations("staff.weekday")

  if (issues.length === 0) {
    return null
  }

  const staffNameById = new Map(
    (scheduleInput?.staff ?? []).map((staff) => [
      staff.id,
      `${staff.firstName} ${staff.lastName}`,
    ])
  )

  function describe(issue: ScheduleValidationIssue) {
    return t(issue.code, {
      day: issue.dayOfWeek ? tWeekday(issue.dayOfWeek as DayOfWeek) : "",
      name: issue.staffId
        ? (staffNameById.get(issue.staffId) ?? issue.staffId)
        : "",
      start: issue.startTime ?? "",
      end: issue.endTime ?? "",
      number: issue.ruleIndex === undefined ? "" : issue.ruleIndex + 1,
    })
  }

  return (
    <ul className="flex flex-col gap-4">
      {groupIssuesByCode(issues).map(([code, codeIssues]) => (
        <li key={code} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={tone === "error" ? "destructive" : "secondary"}>
              {t("count", { count: codeIssues.length })}
            </Badge>
          </div>
          <ul className="flex flex-col gap-1">
            {codeIssues.map((issue, index) => {
              const selection: IssueSelection = {
                code: issue.code,
                dayOfWeek: issue.dayOfWeek,
                staffId: issue.staffId,
                startTime: issue.startTime,
                endTime: issue.endTime,
                ruleIndex: issue.ruleIndex,
              }
              const isSelected = selectedIssue
                ? isSameIssue(selectedIssue, selection)
                : false

              return (
                <li key={`${code}-${index}`}>
                  {onSelect ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={isSelected}
                      className={`h-auto w-full justify-start px-2 py-1.5 text-left text-sm whitespace-normal ${
                        isSelected ? "bg-accent" : ""
                      }`}
                      onClick={() =>
                        onSelect(isSelected ? undefined : selection)
                      }
                    >
                      {describe(issue)}
                    </Button>
                  ) : (
                    <p className="px-2 py-1.5 text-sm">{describe(issue)}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export { isSameIssue, ValidationIssueList }

export type { IssueSelection }
