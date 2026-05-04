"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import { setAvailability } from "@/app/actions/staff"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AvailabilityWindow } from "@/lib/validation/staff"

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"] as const

type Props = {
  staffId: string
  initial: AvailabilityWindow[]
  weeklyMaxHours: number
}

function normalizeTime(t: string) {
  // DB returns "HH:MM:SS"; UI uses "HH:MM".
  return t.length >= 5 ? t.slice(0, 5) : t
}

function minutesFromTime(t: string) {
  const [hours, minutes] = normalizeTime(t).split(":").map(Number)
  return hours * 60 + minutes
}

function formatHours(minutes: number) {
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours}` : `${hours.toFixed(1)}`
}

export function AvailabilityEditor({
  staffId,
  initial,
  weeklyMaxHours,
}: Props) {
  const t = useTranslations("AvailabilityEditor")
  const [windows, setWindows] = useState<AvailabilityWindow[]>(() =>
    initial.map((w) => ({
      weekday: w.weekday,
      startTime: normalizeTime(w.startTime),
      endTime: normalizeTime(w.endTime),
    }))
  )
  const [savedWindows, setSavedWindows] = useState<AvailabilityWindow[]>(() =>
    initial.map((w) => ({
      weekday: w.weekday,
      startTime: normalizeTime(w.startTime),
      endTime: normalizeTime(w.endTime),
    }))
  )
  const [saving, setSaving] = useState(false)
  const hasChanges = JSON.stringify(windows) !== JSON.stringify(savedWindows)
  const availableMinutes = windows.reduce((total, w) => {
    if (!w.startTime || !w.endTime || w.startTime >= w.endTime) return total
    return total + minutesFromTime(w.endTime) - minutesFromTime(w.startTime)
  }, 0)
  const maxMinutes = weeklyMaxHours * 60
  const hasAvailabilityWarning = availableMinutes < maxMinutes

  function update(idx: number, patch: Partial<AvailabilityWindow>) {
    setWindows((ws) => ws.map((w, i) => (i === idx ? { ...w, ...patch } : w)))
  }

  function remove(idx: number) {
    setWindows((ws) => ws.filter((_, i) => i !== idx))
  }

  function addWindow(weekday: number) {
    setWindows((ws) => [
      ...ws,
      { weekday, startTime: "08:00", endTime: "16:00" },
    ])
  }

  async function save() {
    setSaving(true)
    try {
      await setAvailability({ staffId, windows })
      setSavedWindows(windows)
      toast.success(t("toasts.saved"))
    } catch (err) {
      console.error(err)
      toast.error(t("toasts.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        {WEEKDAYS.map((dayKey, weekday) => {
          const dayWindows = windows
            .map((w, idx) => ({ w, idx }))
            .filter(({ w }) => w.weekday === weekday)
          return (
            <div
              key={weekday}
              className="grid grid-cols-[4rem_1fr_auto] items-start gap-3 border-b pb-3 last:border-b-0"
            >
              <div className="pt-2 font-medium">{t(`weekdays.${dayKey}`)}</div>
              <div className="grid gap-2">
                {dayWindows.length === 0 ? (
                  <div className="pt-2 text-sm text-muted-foreground">
                    {t("unavailable")}
                  </div>
                ) : (
                  dayWindows.map(({ w, idx }) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={w.startTime}
                        onChange={(e) =>
                          update(idx, { startTime: e.target.value })
                        }
                        className="w-32"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={w.endTime}
                        onChange={(e) =>
                          update(idx, { endTime: e.target.value })
                        }
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(idx)}
                      >
                        ×
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addWindow(weekday)}
              >
                {t("buttons.addWindow")}
              </Button>
            </div>
          )
        })}
      </div>
      {hasAvailabilityWarning ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {t("warnings.availabilityBelowMax", {
            availableHours: formatHours(availableMinutes),
            maxHours: formatHours(maxMinutes),
          })}
        </div>
      ) : null}
      <div>
        <Button onClick={save} disabled={saving || !hasChanges}>
          {saving ? t("buttons.saving") : t("buttons.save")}
        </Button>
      </div>
    </div>
  )
}
