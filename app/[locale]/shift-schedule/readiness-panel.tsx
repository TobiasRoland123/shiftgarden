import { AlertTriangle, CircleAlert, CircleCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { formatCapacityHours } from "@/lib/groups"
import type { GroupReadiness } from "@/lib/shift-schedule/readiness"
import type { DayOfWeek } from "@/lib/staff"

function ReadinessCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-medium tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * Shows what a user should know before spending an AI call. Blocking issues are
 * presented as errors; capacity shortfalls are group-level concerns and are
 * deliberately presented as non-blocking notices.
 */
function ReadinessPanel({ readiness }: { readiness: GroupReadiness }) {
  const t = useTranslations("shiftSchedule.readiness")
  const tWeekday = useTranslations("staff.weekday")
  const { capacityShortfall } = readiness
  const hasStaffShortfall = capacityShortfall.totalShortfallHours > 0
  const hasPedagogShortfall = capacityShortfall.pedagogShortfallHours > 0

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-medium">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {readiness.blockingIssues.length > 0 ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{t("blockedTitle")}</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 pl-4">
              {readiness.blockingIssues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>
                  {t(`blocking.${issue.code}`, {
                    day: issue.dayOfWeek
                      ? tWeekday(issue.dayOfWeek as DayOfWeek)
                      : "",
                    start: issue.startTime ?? "",
                    end: issue.endTime ?? "",
                  })}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CircleCheck />
          <AlertTitle>{t("readyTitle")}</AlertTitle>
          <AlertDescription>{t("readyDescription")}</AlertDescription>
        </Alert>
      )}

      {hasStaffShortfall ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{t("capacity.staffTitle")}</AlertTitle>
          <AlertDescription>
            <p>
              {t("capacity.staffDescription", {
                capacity: formatCapacityHours(
                  capacityShortfall.totalCapacityHours
                ),
                demand: formatCapacityHours(capacityShortfall.totalDemandHours),
                shortfall: formatCapacityHours(
                  capacityShortfall.totalShortfallHours
                ),
              })}
            </p>
            <p className="text-muted-foreground">{t("capacity.note")}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {hasPedagogShortfall ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{t("capacity.pedagogTitle")}</AlertTitle>
          <AlertDescription>
            <p>
              {t("capacity.pedagogDescription", {
                capacity: formatCapacityHours(
                  capacityShortfall.pedagogCapacityHours
                ),
                demand: formatCapacityHours(
                  capacityShortfall.pedagogDemandHours
                ),
                shortfall: formatCapacityHours(
                  capacityShortfall.pedagogShortfallHours
                ),
              })}
            </p>
            <p className="text-muted-foreground">{t("capacity.note")}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ReadinessCount
          label={t("linkedActiveStaff")}
          value={readiness.linkedActiveStaffCount}
        />
        <ReadinessCount
          label={t("linkedStaff")}
          value={readiness.linkedStaffCount}
        />
        <ReadinessCount
          label={t("staffingRules")}
          value={readiness.staffingRuleCount}
        />
        <ReadinessCount
          label={t("openingHours")}
          value={readiness.openingHoursCount}
        />
      </dl>
    </section>
  )
}

export { ReadinessPanel }
