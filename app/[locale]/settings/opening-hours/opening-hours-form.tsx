"use client"

import { Plus, Trash2 } from "lucide-react"
import { useActionState, useState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { daysOfWeek, formatWeekday } from "@/lib/staff"
import { updateOpeningHours } from "./actions"

type IntervalInput = { key: string; startTime: string; endTime: string }
type InitialInterval = {
  id: string
  dayOfWeek: (typeof daysOfWeek)[number]
  startTime: string
  endTime: string
}

function OpeningHoursForm({ intervals }: { intervals: InitialInterval[] }) {
  const t = useTranslations("openingHours")
  const tStaff = useTranslations("staff")
  const [state, formAction, isPending] = useActionState(updateOpeningHours, {
    errors: [],
  })
  const [byDay, setByDay] = useState(
    () =>
      Object.fromEntries(
        daysOfWeek.map((day) => [
          day,
          intervals
            .filter((interval) => interval.dayOfWeek === day)
            .map((interval) => ({
              key: interval.id,
              startTime: interval.startTime.slice(0, 5),
              endTime: interval.endTime.slice(0, 5),
            })),
        ])
      ) as Record<(typeof daysOfWeek)[number], IntervalInput[]>
  )

  return (
    <form action={formAction} className="flex max-w-4xl flex-col gap-6">
      {state.errors.length > 0 ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">{t("errorTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.saved ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
          {t("saved")}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-lg border p-4">
        {daysOfWeek.map((day) => (
          <div key={day} className="grid gap-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">
                {formatWeekday(day, tStaff)}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setByDay((current) => ({
                    ...current,
                    [day]: [
                      ...current[day],
                      { key: crypto.randomUUID(), startTime: "", endTime: "" },
                    ],
                  }))
                }
              >
                <Plus />
                {t("addInterval")}
              </Button>
            </div>
            <input
              name={`${day}-interval-count`}
              type="hidden"
              value={byDay[day].length}
            />
            {byDay[day].length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("closed")}</p>
            ) : (
              <div className="grid gap-2">
                {byDay[day].map((interval, index) => (
                  <div
                    key={interval.key}
                    className="grid gap-2 rounded-md bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  >
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      {t("startTime")}
                      <Input
                        name={`${day}-${index}-startTime`}
                        type="time"
                        defaultValue={interval.startTime}
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      {t("endTime")}
                      <Input
                        name={`${day}-${index}-endTime`}
                        type="time"
                        defaultValue={interval.endTime}
                        required
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("removeInterval")}
                      onClick={() =>
                        setByDay((current) => ({
                          ...current,
                          [day]: current[day].filter(
                            (row) => row.key !== interval.key
                          ),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
      <Button className="w-fit" type="submit" disabled={isPending}>
        {isPending ? t("saving") : t("save")}
      </Button>
    </form>
  )
}

export { OpeningHoursForm }
