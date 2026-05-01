"use client"

import { useState } from "react"
import { toast } from "sonner"

import { setAvailability } from "@/app/actions/staff"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AvailabilityWindow } from "@/lib/validation/staff"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const

type Props = {
  staffId: string
  initial: AvailabilityWindow[]
}

function normalizeTime(t: string) {
  // DB returns "HH:MM:SS"; UI uses "HH:MM".
  return t.length >= 5 ? t.slice(0, 5) : t
}

export function AvailabilityEditor({ staffId, initial }: Props) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>(() =>
    initial.map((w) => ({
      weekday: w.weekday,
      startTime: normalizeTime(w.startTime),
      endTime: normalizeTime(w.endTime),
    }))
  )
  const [saving, setSaving] = useState(false)

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
      toast.success("Availability saved")
    } catch (err) {
      console.error(err)
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        {WEEKDAYS.map((label, weekday) => {
          const dayWindows = windows
            .map((w, idx) => ({ w, idx }))
            .filter(({ w }) => w.weekday === weekday)
          return (
            <div
              key={weekday}
              className="grid grid-cols-[4rem_1fr_auto] items-start gap-3 border-b pb-3 last:border-b-0"
            >
              <div className="pt-2 font-medium">{label}</div>
              <div className="grid gap-2">
                {dayWindows.length === 0 ? (
                  <div className="pt-2 text-sm text-muted-foreground">
                    Unavailable
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
                + window
              </Button>
            </div>
          )
        })}
      </div>
      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save availability"}
        </Button>
      </div>
    </div>
  )
}
